// Characters: VRM (toon/anime) or GLB (realistic), Mixamo animation retargeted, procedural poses, face + lip-sync.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V3(0, 1, 0);

export const POOL = {
  vrm: { male: ['AvatarSample_C.vrm'], female: ['AvatarSample_A.vrm', 'AvatarSample_B.vrm', 'girl.vrm'], child_male: ['Seed-san.vrm'], child_female: ['girl.vrm'] },
  glb: { male: ['readyplayer.me.glb'], female: ['Michelle.glb'] },
};
const VRM_MAP = { Hips: 'hips', Spine: 'spine', Spine1: 'chest', Spine2: 'upperChest', Neck: 'neck', Head: 'head', LeftShoulder: 'leftShoulder', LeftArm: 'leftUpperArm', LeftForeArm: 'leftLowerArm', LeftHand: 'leftHand', RightShoulder: 'rightShoulder', RightArm: 'rightUpperArm', RightForeArm: 'rightLowerArm', RightHand: 'rightHand', LeftUpLeg: 'leftUpperLeg', LeftLeg: 'leftLowerLeg', LeftFoot: 'leftFoot', LeftToeBase: 'leftToes', RightUpLeg: 'rightUpperLeg', RightLeg: 'rightLowerLeg', RightFoot: 'rightFoot', RightToeBase: 'rightToes' };

export async function loadActorKit(url) {
  const loader = new GLTFLoader(); loader.register((p) => new VRMLoaderPlugin(p));
  const soldier = await loader.loadAsync(url('Soldier.glb'));
  const clip = (n) => soldier.animations.find((c) => c.name === n);
  const srcRest = SkeletonUtils.clone(soldier.scene); { const m = new THREE.AnimationMixer(srcRest); m.clipAction(clip('TPose')).play(); m.update(0); } srcRest.updateMatrixWorld(true);
  const cache = {};
  const load = async (file) => (cache[file] ||= loader.loadAsync(url(file)));
  return { loader, soldier, clip, srcRest, load, urlOf: url };
}

// ---------- retargeting ----------
function retargetVRM(kit, clip, vrm) {
  const tracks = [], q = new THREE.Quaternion(), restInv = new THREE.Quaternion(), parentRest = new THREE.Quaternion(); const v0 = vrm.meta && vrm.meta.metaVersion === '0';
  for (const tr of clip.tracks) { const [node, prop] = tr.name.split('.'); if (prop !== 'quaternion') continue; const vb = VRM_MAP[node.replace('mixamorig', '')]; if (!vb) continue;
    const vn = vrm.humanoid.getNormalizedBoneNode(vb), mn = kit.srcRest.getObjectByName(node); if (!vn || !mn) continue;
    mn.getWorldQuaternion(restInv).invert(); mn.parent.getWorldQuaternion(parentRest); const vals = tr.values.slice();
    for (let k = 0; k < vals.length; k += 4) { q.fromArray(vals, k).premultiply(parentRest).multiply(restInv); q.toArray(vals, k); }
    if (!v0) for (let k = 0; k < vals.length; k++) if (k % 2 === 0) vals[k] *= -1;
    tracks.push(new THREE.QuaternionKeyframeTrack(vn.name + '.quaternion', tr.times, vals)); }
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}
function tPoseRest(root) { // put a bind pose (A-pose) into a T-pose
  root.updateMatrixWorld(true);
  const align = (bn, want) => { const b = root.getObjectByName(bn); if (!b) return; const c = b.children.find((x) => x.isBone); if (!c) return; root.updateMatrixWorld(true);
    const d = c.getWorldPosition(V3()).sub(b.getWorldPosition(V3())).normalize(); const rq = new THREE.Quaternion().setFromUnitVectors(d, want);
    const pq = b.parent.getWorldQuaternion(new THREE.Quaternion()); b.quaternion.premultiply(pq.clone().invert().multiply(rq).multiply(pq)); root.updateMatrixWorld(true); };
  for (const [side, x] of [['Left', 1], ['Right', -1]]) for (const bn of ['Arm', 'ForeArm', 'Hand']) align(side + bn, V3(x, 0, 0));
  for (const side of ['Left', 'Right']) for (const bn of ['UpLeg', 'Leg']) align(side + bn, V3(0, -1, 0));
}
function retargetRPM(kit, clip, tgtRest) {
  const FLIP = new THREE.Quaternion().setFromAxisAngle(UP, Math.PI); const tracks = [], q = new THREE.Quaternion(), A1 = new THREE.Quaternion(), B1 = new THREE.Quaternion();
  for (const tr of clip.tracks) { const [node, prop] = tr.name.split('.'); if (prop !== 'quaternion') continue;
    const sb = kit.srcRest.getObjectByName(node), tb = tgtRest.getObjectByName(node.replace('mixamorig', '')); if (!sb || !tb) continue;
    const PsW = sb.parent.getWorldQuaternion(new THREE.Quaternion()), SsW = sb.getWorldQuaternion(new THREE.Quaternion()), PtW = tb.parent.getWorldQuaternion(new THREE.Quaternion()), StW = tb.getWorldQuaternion(new THREE.Quaternion());
    A1.copy(PtW).invert().multiply(FLIP).multiply(PsW); B1.copy(SsW).invert().multiply(FLIP).multiply(StW);
    const vals = tr.values.slice(); for (let k = 0; k < vals.length; k += 4) { q.fromArray(vals, k); q.premultiply(A1).multiply(B1); q.toArray(vals, k); }
    tracks.push(new THREE.QuaternionKeyframeTrack(tb.name + '.quaternion', tr.times, vals)); }
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}
const stripQ = (c, noHip) => { c = c.clone(); c.tracks = c.tracks.filter((t) => /\.quaternion$/.test(t.name) && !(noHip && t.name === 'mixamorigHips.quaternion')); return c; };

// ---------- actor creation ----------
export async function createActor(kit, scene, ch, mode, index) {
  const age = ch.age, child = age === 'child';
  const key = child ? (ch.gender === 'female' ? 'child_female' : 'child_male') : ch.gender;
  const list = POOL[mode][key] || POOL[mode][ch.gender]; const file = list[index % list.length];
  const height = child ? 1.25 : ch.gender === 'female' ? 1.62 : 1.76;
  const a = { id: ch.id, name: ch.name, ch, mode, bones: {}, morph: [] };
  if (mode === 'vrm') {
    const g = await kit.loader.loadAsync(kitUrl(kit, file)); const vrm = g.userData.vrm; VRMUtils.rotateVRM0(vrm);
    a.vrm = vrm; a.o = vrm.scene; scene.add(a.o);
    a.o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; tintVRM(m, ch); if (kit.simpleMat) simplify(m, kit.simpleMat); } });
    for (const [k, v] of Object.entries(VRM_MAP)) { const n = vrm.humanoid.getNormalizedBoneNode(v); if (n) a.bones[k] = n; }
    a.hipRest = a.bones.Hips.position.clone(); vrm.update(0); a.o.updateMatrixWorld(true);
    const hy = vrm.humanoid.getRawBoneNode('head').getWorldPosition(V3()).y; a.o.scale.setScalar(height / (hy + 0.11));
    a.mix = new THREE.AnimationMixer(a.o);
    a.actions = { walk: a.mix.clipAction(retargetVRM(kit, kit.clip('Walk'), vrm)), run: a.mix.clipAction(retargetVRM(kit, kit.clip('Run'), vrm)), idle: a.mix.clipAction(retargetVRM(kit, kit.clip('Idle'), vrm)) };
  } else {
    const g = await kit.load(file); const rpm = /readyplayer/.test(file);
    a.o = SkeletonUtils.clone(g.scene); scene.add(a.o);
    a.o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.material = m.material.clone(); tintGLB(m, ch);
      if (m.morphTargetDictionary && 'mouthOpen' in m.morphTargetDictionary) a.morph.push(m); } });
    a.o.traverse((b) => { if (b.isBone) a.bones[b.name.replace('mixamorig', '')] = b; });
    a.mix = new THREE.AnimationMixer(a.o);
    if (rpm) { const rest = SkeletonUtils.clone(g.scene); tPoseRest(rest); a.hipRest = a.bones.Hips.position.clone();
      a.actions = Object.fromEntries(['Walk', 'Run', 'Idle'].map((n) => [n.toLowerCase(), a.mix.clipAction(retargetRPM(kit, kit.clip(n), rest))])); }
    else { const tr = kit.clip('Idle').tracks.find((t) => t.name === 'mixamorigHips.position'); const hp = g.animations.map((c) => c.tracks.find((t) => t.name === 'mixamorigHips.position')).find(Boolean);
      a.hipRest = hp ? V3(hp.values[0], hp.values[1], hp.values[2]) : a.bones.Hips.position.clone();
      a.actions = Object.fromEntries(['Walk', 'Run', 'Idle'].map((n) => [n.toLowerCase(), a.mix.clipAction(stripQ(kit.clip(n), true))])); }
    a.bones.Hips.position.copy(a.hipRest); a.o.updateMatrixWorld(true);
    const hy = a.bones.Head.getWorldPosition(V3()).y; a.o.scale.setScalar(height / (hy + 0.12));
  }
  for (const act of Object.values(a.actions)) { act.play(); act.weight = 0; }
  // which way does the model face after the idle clip? → yawOffset so that yaw 0 means facing +Z
  a.yawOffset = 0; a.actions.idle.weight = 1; a.actions.idle.time = 0; a.mix.update(0); if (a.vrm) a.vrm.update(0); a.o.rotation.set(0, 0, 0); a.o.position.set(0, 0, 0); a.o.updateMatrixWorld(true);
  const f = faceDir(a); a.yawOffset = -Math.atan2(f.x, f.z); a.actions.idle.weight = 0;
  a.o.updateMatrixWorld(true); a.hipY = a.bones.Hips.getWorldPosition(V3()).y;
  a.height = height;
  return a;
}
function kitUrl(kit, f) { return kit.urlOf ? kit.urlOf(f) : f; }
function faceDir(a) {
  const up = (n) => n && n.updateWorldMatrix(true, false);
  if (a.vrm) { const h = a.vrm.humanoid, le = h.getRawBoneNode('leftEye'), re = h.getRawBoneNode('rightEye'), hd = h.getRawBoneNode('head'); up(le); up(re); up(hd); const hp = V3().setFromMatrixPosition(hd.matrixWorld);
    if (le && re) { const m = V3().setFromMatrixPosition(le.matrixWorld).add(V3().setFromMatrixPosition(re.matrixWorld)).multiplyScalar(0.5).sub(hp); m.y = 0; if (m.lengthSq() > 1e-8) return m.normalize(); } }
  const le = a.eyeL || (a.eyeL = a.o.getObjectByName('LeftEye')), re = a.eyeR || (a.eyeR = a.o.getObjectByName('RightEye')), hd = a.bones.Head; up(le); up(re); up(hd); up(a.bones.LeftToeBase);
  if (le && re) { const m = le.getWorldPosition(V3()).add(re.getWorldPosition(V3())).multiplyScalar(0.5).sub(hd.getWorldPosition(V3())); m.y = 0; if (m.lengthSq() > 1e-8) return m.normalize(); }
  // fallback: toes are in front of the feet
  const lf = a.bones.LeftFoot, lt = a.bones.LeftToeBase; if (lf && lt) { const m = lt.getWorldPosition(V3()).sub(lf.getWorldPosition(V3())); m.y = 0; if (m.lengthSq() > 1e-8) return m.normalize(); }
  return V3(0, 0, 1);
}
const col = (h) => new THREE.Color(h);
function simplify(m, grad) { // MToon → MeshToonMaterial (much cheaper on software WebGL)
  const conv = (mat) => { if (!mat || !mat.isShaderMaterial) return mat; const map = mat.map || mat.uniforms?.map?.value || null; const c = (mat.color || mat.uniforms?.litFactor?.value || new THREE.Color(1, 1, 1)).clone();
    const n = new THREE.MeshToonMaterial({ map, color: c, gradientMap: grad, transparent: mat.transparent, alphaTest: mat.alphaTest || (mat.transparent ? 0 : 0.5), side: mat.side }); n.name = mat.name; return n; };
  m.material = Array.isArray(m.material) ? m.material.map(conv) : conv(m.material); }
function recolorTex(map) { // grey + lift the cloth texture so the story colour can show on dark clothes
  const img = map && map.image; if (!img || !img.width) return map;
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data; let mx = 1;
  for (let i = 0; i < p.length; i += 4) { const l = 0.3 * p[i] + 0.59 * p[i + 1] + 0.11 * p[i + 2]; if (p[i + 3] > 10 && l > mx) mx = l; }
  for (let i = 0; i < p.length; i += 4) { const l = (0.3 * p[i] + 0.59 * p[i + 1] + 0.11 * p[i + 2]) / mx; const v = 255 * (0.45 + 0.55 * l); p[i] = p[i + 1] = p[i + 2] = v; }
  x.putImageData(d, 0, 0); const t = new THREE.CanvasTexture(c); t.flipY = map.flipY; t.colorSpace = map.colorSpace; t.wrapS = map.wrapS; t.wrapT = map.wrapT; t.channel = map.channel; return t;
}
function tintVRM(m, ch) {
  const ms = Array.isArray(m.material) ? m.material : [m.material];
  for (const mat of ms) { const n = mat.name || '';
    const isTop = /Tops|huku/i.test(n), isBottom = /Bottoms/i.test(n), isHair = /HAIR/i.test(n);
    const c = isTop ? ch.top_color : isBottom ? ch.bottom_color : isHair ? (ch.age === 'old' ? '#c8c8c8' : ch.hair_color) : null;
    if (!c || !mat.color) continue;
    if (isTop || isBottom) { const map = mat.map || mat.uniforms?.map?.value; const nt = recolorTex(map); if (nt !== map) { mat.map = nt; if (mat.uniforms?.map) mat.uniforms.map.value = nt; if (mat.shadeMultiplyTexture !== undefined) mat.shadeMultiplyTexture = nt; } }
    const k = col(c); if (isHair) k.lerp(col('#ffffff'), 0.25);
    mat.color.copy(k); if (mat.shadeColorFactor) mat.shadeColorFactor.copy(k).multiplyScalar(0.55); mat.needsUpdate = true; }
}
function tintGLB(m, ch) {
  const mat = m.material, n = m.name;
  if (/Outfit_Top/.test(n)) { mat.color.set(ch.top_color); mat.map = null; }
  if (/Outfit_Bottom/.test(n)) { mat.color.set(ch.bottom_color); mat.map = null; }
  if (/Headwear|Hair/.test(n)) mat.color.set(ch.age === 'old' ? '#9a9a9a' : ch.hair_color).lerp(new THREE.Color('#ffffff'), 0.25);
  if (/Beard/.test(n) && ch.age === 'young') m.visible = false;
}

// ---------- posing ----------
const _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _m4 = new THREE.Matrix4();
function rotW(a, bone, axis, ang) { const b = a.bones[bone]; if (!b || !ang) return; b.parent.updateWorldMatrix(true, false); _pq.setFromRotationMatrix(_m4.extractRotation(b.parent.matrixWorld)); _q.setFromAxisAngle(axis, ang); const inv = _pq.clone().invert(); b.quaternion.premultiply(inv.multiply(_q).multiply(_pq)); }
export const dirs = (yaw) => ({ F: V3(Math.sin(yaw), 0, Math.cos(yaw)), R: V3(Math.sin(yaw), 0, Math.cos(yaw)).cross(UP).normalize() });
const VOW = ['aa', 'ih', 'ou', 'ee', 'oh'];

export function poseActor(a, t, st) {
  // st: {visible,pos,yaw,walk,run,sit,drop,look,gesture:{name,k},mouth,emotion,talk}
  a.o.visible = st.visible !== false; if (!a.o.visible) return;
  const w = { walk: st.walk || 0, run: st.run || 0 }; w.idle = Math.max(0, 1 - w.walk - w.run);
  for (const [k, act] of Object.entries(a.actions)) { act.weight = w[k] || 0; act.time = (t * (k === 'idle' ? 1 : 1.05) + a.id.length * 0.37) % act.getClip().duration; }
  a.mix.update(0); a.bones.Hips.position.copy(a.hipRest);
  a.o.position.copy(st.pos); a.o.rotation.set(0, st.yaw + a.yawOffset, 0);
  const { F, R } = dirs(st.yaw);
  const s = st.sit || 0;
  if (s > 0) { a.o.position.y -= s * st.drop; a.o.position.addScaledVector(F, -0.1 * s);
    for (const side of ['Left', 'Right']) { rotW(a, side + 'UpLeg', R, 1.5 * s); rotW(a, side + 'Leg', R, -1.45 * s); }
    rotW(a, 'Spine', R, -0.04 * s); }
  const arm = (side, up, fore, inward = 0) => { rotW(a, side + 'Arm', R, up); if (inward) rotW(a, side + 'Arm', UP, (side === 'Right' ? 1 : -1) * inward); rotW(a, side + 'ForeArm', R, fore); };
  if (s > 0.5 && !st.gesture) { arm('Right', 0.35 * s, 0.6 * s, 0.25 * s); arm('Left', 0.35 * s, 0.6 * s, 0.25 * s); }
  if (st.talk) { const k = st.talk; arm('Right', (0.3 + 0.12 * Math.sin(t * 3.1)) * k, (0.8 + 0.3 * Math.sin(t * 5.3)) * k, 0.15 * k); }
  const g = st.gesture; let face = st.emotion || 'neutral';
  if (g) { const k = g.k, n = g.name;
    if (n === 'wave') { rotW(a, 'RightArm', F, -2.2 * k); rotW(a, 'RightForeArm', F, (-0.3 + 0.4 * Math.sin(t * 12)) * k); face = 'happy'; }
    if (n === 'point') arm('Right', 1.35 * k, 0.05 * k, 0.15 * k);
    if (n === 'think') { arm('Right', 0.9 * k, 2.0 * k, 0.5 * k); rotW(a, 'Head', R, 0.08 * k); }
    if (n === 'phone') { arm('Right', 0.5 * k, 2.3 * k, -0.2 * k); rotW(a, 'RightArm', F, -0.6 * k); }
    if (n === 'drink') arm('Right', 0.4 * k, 1.6 * k, 0.4 * k);
    if (n === 'shock') { arm('Right', 0.8 * k, 1.2 * k, -0.3 * k); arm('Left', 0.8 * k, 1.2 * k, -0.3 * k); rotW(a, 'Spine1', R, -0.12 * k); face = 'surprised'; }
    if (n === 'laugh') { rotW(a, 'Head', R, (-0.12 + Math.sin(t * 14) * 0.04) * k); face = 'happy'; }
    if (n === 'nod') rotW(a, 'Head', R, Math.sin(t * 7) * 0.1 * k);
  }
  // head: look at target (measured, so it also corrects for the clip's own twist)
  if (a.vrm) a.vrm.update(0);
  { a.bones.Head.updateWorldMatrix(true, false); const hp = V3().setFromMatrixPosition(a.bones.Head.matrixWorld); let tgt = st.look ? st.look.clone() : hp.clone().addScaledVector(F, 3);
    if (g && g.name === 'look_around') tgt = hp.clone().add(V3(Math.sin(t * 2.2) * 3 * F.z + F.x * 2, 0, -Math.sin(t * 2.2) * 3 * F.x + F.z * 2));
    const hf = faceDir(a); const d = tgt.sub(hp); d.y = 0; d.normalize();
    let ang = Math.atan2(hf.x * d.z - hf.z * d.x, hf.x * d.x + hf.z * d.z); ang = -Math.max(-1.2, Math.min(1.2, ang));
    rotW(a, 'Neck', UP, ang * 0.45); rotW(a, 'Head', UP, ang * 0.55); }
  if (st.talk) rotW(a, 'Head', R, Math.sin(t * 4.1) * 0.04 * st.talk);
  // face
  const mouth = st.mouth || 0;
  if (a.vrm) { const em = a.vrm.expressionManager;
    if (em) { for (const v of VOW) em.setValue(v, 0); if (mouth > 0.02) em.setValue(VOW[Math.floor(t * 7.3 + a.id.length) % 5], Math.min(1, mouth * 1.1));
      const per = 3.1 + a.id.length * 0.29, q = (t + a.id.length * 1.7) % per; em.setValue('blink', face === 'happy' ? 0 : q < 0.16 ? 1 - Math.abs(q - 0.08) / 0.08 : 0);
      for (const e of ['happy', 'sad', 'angry', 'surprised']) em.setValue(e, 0);
      const emo = { happy: 'happy', sad: 'sad', angry: 'angry', surprised: 'surprised', scared: 'surprised' }[face]; if (emo) em.setValue(emo, mouth > 0.05 ? 0.45 : 0.8); }
    a.vrm.update(0); }
  for (const m of a.morph) { const d = m.morphTargetDictionary; m.morphTargetInfluences[d.mouthOpen] = Math.min(1, mouth * 0.9); if ('mouthSmile' in d) m.morphTargetInfluences[d.mouthSmile] = face === 'happy' ? 0.7 : 0.15; }
  a.o.updateMatrixWorld(true);
}
export const headPos = (a) => { const n = a.vrm ? a.vrm.humanoid.getRawBoneNode('head') : a.bones.Head; n.updateWorldMatrix(true, false); return V3().setFromMatrixPosition(n.matrixWorld); };
export const handPos = (a, side = 'Right') => { const n = a.vrm ? a.vrm.humanoid.getRawBoneNode(side.toLowerCase() + 'Hand') : a.bones[side + 'Hand']; n.updateWorldMatrix(true, false); return V3().setFromMatrixPosition(n.matrixWorld); };
