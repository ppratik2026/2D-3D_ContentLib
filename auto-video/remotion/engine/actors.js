// Characters: any humanoid .vrm / .glb / .gltf / .fbx. Mixamo animations (walk/idle/run) are retargeted onto it,
// procedural poses add sitting, gestures and head-look; face = VRM expressions, blendshapes or a jaw bone.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V3(0, 1, 0);
const CANON = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'];
const VRM_MAP = { Hips: 'hips', Spine: 'spine', Spine1: 'chest', Spine2: 'upperChest', Neck: 'neck', Head: 'head', LeftShoulder: 'leftShoulder', LeftArm: 'leftUpperArm', LeftForeArm: 'leftLowerArm', LeftHand: 'leftHand', RightShoulder: 'rightShoulder', RightArm: 'rightUpperArm', RightForeArm: 'rightLowerArm', RightHand: 'rightHand', LeftUpLeg: 'leftUpperLeg', LeftLeg: 'leftLowerLeg', LeftFoot: 'leftFoot', LeftToeBase: 'leftToes', RightUpLeg: 'rightUpperLeg', RightLeg: 'rightLowerLeg', RightFoot: 'rightFoot', RightToeBase: 'rightToes' };
const MOUTH_KEYS = ['mouthOpen', 'jawOpen', 'viseme_aa', 'viseme_AA', 'Fcl_MTH_A', 'MTH_A', 'vrc.v_aa', 'v_aa', 'aa', 'A', 'MouthOpen', 'Mouth_Open', 'mouth_open', 'JawOpen'];
const SMILE_KEYS = ['mouthSmile', 'mouthSmile_L', 'Fcl_MTH_Joy', 'Fcl_ALL_Joy', 'happy', 'Joy', 'smile', 'Smile'];
const BLINK_KEYS = ['eyesClosed', 'eyeBlinkLeft', 'Fcl_EYE_Close', 'blink', 'Blink', 'eyeBlink_L', 'EyeBlink'];

export async function loadActorKit(url) {
  const loader = new GLTFLoader(); loader.register((p) => new VRMLoaderPlugin(p)); const fbx = new FBXLoader();
  const soldier = await loader.loadAsync(url('assets/Soldier.glb'));
  const clip = (n) => soldier.animations.find((c) => c.name === n);
  const srcRest = SkeletonUtils.clone(soldier.scene); { const m = new THREE.AnimationMixer(srcRest); m.clipAction(clip('TPose')).play(); m.update(0); } srcRest.updateMatrixWorld(true);
  const srcMap = mapRig(srcRest); const srcFacing = restFacing(srcRest, srcMap);
  const cache = {};
  const loadModel = (file, type) => (cache[file] ||= type === 'fbx' ? fbx.loadAsync(url(file)).then((o) => ({ scene: o, animations: o.animations || [] })) : loader.loadAsync(url(file)));
  return { loader, soldier, clip, srcRest, srcMap, srcFacing, loadModel, url };
}

// ---------- rig detection: map any bone naming (Mixamo, VRM, Unreal/MakeHuman, Blender, CC) to canonical names ----------
function tokens(name) { return name.replace(/^mixamorig\d*[:_]?/i, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[:._\-|]+/g, ' ').toLowerCase().split(/\s+/).filter(Boolean); }
export function mapRig(root) {
  const bones = []; root.traverse((b) => { if (b.isBone) bones.push(b); });
  const depth = (b) => { let d = 0; while (b.parent) { d++; b = b.parent; } return d; };
  const cand = {};
  const put = (k, b) => { if (!cand[k] || depth(b) < depth(cand[k])) cand[k] = b; };
  for (const b of bones) {
    const t = tokens(b.name); const has = (...w) => w.some((x) => t.some((y) => y === x || y.startsWith(x)));
    if (has('twist', 'roll', 'ik', 'pole', 'target', 'nub', 'end', 'helper', 'corrective')) continue;
    const side = t.includes('left') || t.includes('l') ? 'Left' : t.includes('right') || t.includes('r') ? 'Right' : null;
    if (!side) {
      if (has('hips', 'pelvis', 'hip')) put('Hips', b);
      else if (has('neck')) put('Neck', b);
      else if (has('head') && !has('top')) put('Head', b);
      else if (has('spine', 'chest', 'abdomen', 'torso', 'upperchest')) (cand._spine ||= []).push(b);
      continue;
    }
    if (has('thumb', 'index', 'middle', 'ring', 'pinky', 'little', 'finger')) continue;
    if (has('shoulder', 'clavicle', 'collar')) put(side + 'Shoulder', b);
    else if (has('forearm', 'lowerarm', 'elbow') || (has('arm') && has('fore', 'lower'))) put(side + 'ForeArm', b);
    else if (has('upperarm') || has('arm')) put(side + 'Arm', b);
    else if (has('hand', 'wrist')) put(side + 'Hand', b);
    else if (has('upleg', 'thigh', 'upperleg') || (has('leg') && has('up', 'upper'))) put(side + 'UpLeg', b);
    else if (has('toe', 'ball')) put(side + 'ToeBase', b);
    else if (has('foot', 'ankle')) put(side + 'Foot', b);
    else if (has('leg', 'calf', 'shin', 'knee', 'lowerleg')) put(side + 'Leg', b);
  }
  const spine = (cand._spine || []).sort((a, b) => depth(a) - depth(b)); delete cand._spine;
  ['Spine', 'Spine1', 'Spine2'].forEach((k, i) => { if (spine[i]) cand[k] = spine[i]; });
  return cand;
}
export function rigProblems(map) {
  const miss = ['Hips', 'Head', 'LeftArm', 'RightArm', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg'].filter((k) => !map[k]); if (miss.length) return miss.map((k) => k + ' missing');
  const under = (c, p) => { for (let x = c && c.parent; x; x = x.parent) if (x === p) return true; return false; };
  const bad = [];
  for (const s of ['Left', 'Right']) { if (!under(map[s + 'Leg'], map[s + 'UpLeg'])) bad.push(s + ' leg chain'); if (map[s + 'Foot'] && !under(map[s + 'Foot'], map[s + 'Leg'])) bad.push(s + ' foot not attached to leg (IK rig)'); if (!under(map[s + 'UpLeg'], map.Hips)) bad.push(s + ' leg not under hips'); }
  if (!under(map.Head, map.Hips)) bad.push('head not under hips');
  return bad;
}

function restFacing(root, map) { // direction the character faces at rest (from heel → toe, else eyes)
  root.updateMatrixWorld(true);
  const f = map.LeftFoot, t = map.LeftToeBase;
  if (f && t) { const d = V3().setFromMatrixPosition(t.matrixWorld).sub(V3().setFromMatrixPosition(f.matrixWorld)); d.y = 0; if (d.lengthSq() > 1e-8) return d.normalize(); }
  const l = map.LeftArm, r = map.RightArm; if (l && r) { const s = V3().setFromMatrixPosition(r.matrixWorld).sub(V3().setFromMatrixPosition(l.matrixWorld)); return V3(-s.z, 0, s.x).normalize().negate(); }
  return V3(0, 0, 1);
}
function tPose(root, map) { // A-pose → T-pose (arms horizontal, legs straight), measured in world space
  const align = (b, want) => { if (!b) return; const c = b.children.find((x) => x.isBone); if (!c) return; root.updateMatrixWorld(true);
    const d = V3().setFromMatrixPosition(c.matrixWorld).sub(V3().setFromMatrixPosition(b.matrixWorld)).normalize(); const rq = new THREE.Quaternion().setFromUnitVectors(d, want);
    const pq = b.parent.getWorldQuaternion(new THREE.Quaternion()); b.quaternion.premultiply(pq.clone().invert().multiply(rq).multiply(pq)); };
  const fwd = restFacing(root, map); const side = V3().crossVectors(UP, fwd).normalize(); // character's left
  for (const [s, dir] of [['Left', side], ['Right', side.clone().negate()]]) { align(map[s + 'Arm'], dir); align(map[s + 'ForeArm'], dir); align(map[s + 'Hand'], dir); }
  for (const s of ['Left', 'Right']) { align(map[s + 'UpLeg'], V3(0, -1, 0)); align(map[s + 'Leg'], V3(0, -1, 0)); }
  root.updateMatrixWorld(true);
}
function retargetGeneric(kit, clip, tRest, tMap, nameOf) {
  const tFacing = restFacing(tRest, tMap);
  const turn = new THREE.Quaternion().setFromUnitVectors(kit.srcFacing, tFacing);
  const tracks = [], q = new THREE.Quaternion(), A1 = new THREE.Quaternion(), B1 = new THREE.Quaternion();
  const srcByName = {}; for (const [k, b] of Object.entries(kit.srcMap)) srcByName[b.name] = k;
  for (const tr of clip.tracks) { const [node, prop] = tr.name.split('.'); if (prop !== 'quaternion') continue;
    const key = srcByName[node]; const sb = kit.srcMap[key], tb = tMap[key]; if (!sb || !tb) continue;
    const PsW = sb.parent.getWorldQuaternion(new THREE.Quaternion()), SsW = sb.getWorldQuaternion(new THREE.Quaternion()), PtW = tb.parent.getWorldQuaternion(new THREE.Quaternion()), StW = tb.getWorldQuaternion(new THREE.Quaternion());
    A1.copy(PtW).invert().multiply(turn).multiply(PsW); B1.copy(SsW).invert().multiply(turn.clone().invert()).multiply(StW);
    const vals = tr.values.slice(); for (let k = 0; k < vals.length; k += 4) { q.fromArray(vals, k); q.premultiply(A1).multiply(B1); q.toArray(vals, k); }
    tracks.push(new THREE.QuaternionKeyframeTrack(nameOf(key) + '.quaternion', tr.times, vals)); }
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}
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

// ---------- actor creation ----------
// cast: { file, type: 'vrm'|'glb'|'fbx' }   ch: story character (colours, age, gender)
export async function createActor(kit, scene, ch, cast, opts = {}) {
  const child = ch.age === 'child';
  const height = child ? 1.25 : ch.gender === 'female' ? 1.62 : 1.76;
  const a = { id: ch.id, name: ch.name, ch, bones: {}, face: [], problems: [] };
  if (cast.type === 'vrm') {
    const g = await kit.loader.loadAsync(kit.url(cast.file)); const vrm = g.userData.vrm; if (!vrm) throw new Error('Not a valid VRM: ' + cast.file);
    VRMUtils.rotateVRM0(vrm); a.vrm = vrm; a.o = vrm.scene; scene.add(a.o);
    a.o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; tintVRM(m, ch); if (opts.simpleMat) simplify(m, opts.simpleMat); } });
    for (const [k, v] of Object.entries(VRM_MAP)) { const n = vrm.humanoid.getNormalizedBoneNode(v); if (n) a.bones[k] = n; }
    a.hipRest = a.bones.Hips.position.clone(); vrm.update(0); a.o.updateMatrixWorld(true);
    const hy = vrm.humanoid.getRawBoneNode('head').getWorldPosition(V3()).y; a.o.scale.setScalar(height / (hy + 0.11));
    a.mix = new THREE.AnimationMixer(a.o);
    a.actions = Object.fromEntries(['Walk', 'Run', 'Idle'].map((n) => [n.toLowerCase(), a.mix.clipAction(retargetVRM(kit, kit.clip(n), vrm))]));
  } else {
    const g = await kit.loadModel(cast.file, cast.type);
    a.o = SkeletonUtils.clone(g.scene);
    const map = mapRig(a.o); a.problems = rigProblems(map); if (!a.problems.length) scene.add(a.o); if (a.problems.length) throw new Error(`Not a standard humanoid rig: ${a.problems.join(', ')}. Use a Mixamo / VRoid / MakeHuman style rig.`);
    a.bones = map;
    a.o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
      m.material = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : m.material.clone(); tintGLB(m, ch); if (opts.toon) toonify(m, opts.toon);
      const d = m.morphTargetDictionary; if (d) { const mk = MOUTH_KEYS.find((k) => k in d), sk = SMILE_KEYS.find((k) => k in d), bk = BLINK_KEYS.find((k) => k in d); if (mk || sk || bk) a.face.push({ m, mouth: d[mk], smile: d[sk], blink: d[bk] }); } } });
    a.o.traverse((b) => { if (b.isBone && !a.jaw && /jaw/i.test(b.name)) a.jaw = b; }); if (a.jaw) a.jawRest = a.jaw.quaternion.clone();
    const rest = SkeletonUtils.clone(g.scene); const rmap = mapRig(rest); tPose(rest, rmap);
    a.hipRest = map.Hips.position.clone(); a.mix = new THREE.AnimationMixer(a.o);
    a.actions = Object.fromEntries(['Walk', 'Run', 'Idle'].map((n) => [n.toLowerCase(), a.mix.clipAction(retargetGeneric(kit, kit.clip(n), rest, rmap, (k) => map[k].name))]));
    a.o.updateMatrixWorld(true);
    // size from bones only (meshes can have their own scale): head height above the lowest foot/toe bone
    const yOf = (b) => (b ? b.getWorldPosition(V3()).y : Infinity); const toe = Math.min(yOf(map.LeftToeBase), yOf(map.RightToeBase)), foot = Math.min(yOf(map.LeftFoot), yOf(map.RightFoot));
    const low = isFinite(toe) ? toe - 0.02 * (map.Head.getWorldPosition(V3()).y - toe) : foot - 0.05 * (map.Head.getWorldPosition(V3()).y - foot);
    const sc = height / Math.max(1e-4, (map.Head.getWorldPosition(V3()).y - low) * 1.07); a.o.scale.multiplyScalar(sc); a.o.updateMatrixWorld(true);
    a.yLift = -(low * sc);
  }
  a._legRest = {}; for (const b of ['LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot', 'Spine', 'Spine1', 'Hips']) if (a.bones[b]) a._legRest[b] = a.bones[b].quaternion.clone(); // rest pose (legs straight)
  for (const act of Object.values(a.actions)) { act.play(); act.weight = 0; }
  a.yawOffset = 0; a.actions.idle.weight = 1; a.actions.idle.time = 0; a.mix.update(0); if (a.vrm) a.vrm.update(0); a.o.rotation.set(0, 0, 0); a.o.position.set(0, a.yLift || 0, 0); a.o.updateMatrixWorld(true);
  const f = faceDir(a); a.yawOffset = -Math.atan2(f.x, f.z); a.actions.idle.weight = 0;
  a.o.updateMatrixWorld(true); a.hipY = a.bones.Hips.getWorldPosition(V3()).y; a.height = height;
  a.hasLipSync = !!(a.vrm?.expressionManager || a.face.some((x) => x.mouth !== undefined) || a.jaw);
  return a;
}
function faceDir(a) {
  const up = (n) => n && n.updateWorldMatrix(true, false);
  if (a.vrm) { const h = a.vrm.humanoid, le = h.getRawBoneNode('leftEye'), re = h.getRawBoneNode('rightEye'), hd = h.getRawBoneNode('head'); up(le); up(re); up(hd); const hp = V3().setFromMatrixPosition(hd.matrixWorld);
    if (le && re) { const m = V3().setFromMatrixPosition(le.matrixWorld).add(V3().setFromMatrixPosition(re.matrixWorld)).multiplyScalar(0.5).sub(hp); m.y = 0; if (m.lengthSq() > 1e-8) return m.normalize(); } }
  if (!a.eyes) { a.eyes = []; a.o.traverse((b) => { if (b.isBone && /eye/i.test(b.name) && !/brow|lid|lash/i.test(b.name) && a.eyes.length < 2) a.eyes.push(b); }); }
  const hd = a.bones.Head; up(hd); const hp = V3().setFromMatrixPosition(hd.matrixWorld);
  if (a.eyes.length === 2) { a.eyes.forEach(up); const m = V3().setFromMatrixPosition(a.eyes[0].matrixWorld).add(V3().setFromMatrixPosition(a.eyes[1].matrixWorld)).multiplyScalar(0.5).sub(hp); m.y = 0; if (m.lengthSq() > 1e-8) return m.normalize(); }
  const lf = a.bones.LeftFoot, lt = a.bones.LeftToeBase; if (lf && lt) { up(lt); const m = V3().setFromMatrixPosition(lt.matrixWorld).sub(V3().setFromMatrixPosition(lf.matrixWorld)); m.y = 0; if (m.lengthSq() > 1e-8) return m.normalize(); }
  return V3(0, 0, 1);
}

// ---------- colours / materials ----------
const col = (h) => new THREE.Color(h);
function simplify(m, grad) { // MToon → MeshToonMaterial (much cheaper on software WebGL)
  const conv = (mat) => { if (!mat || !mat.isShaderMaterial) return mat; const map = mat.map || mat.uniforms?.map?.value || null; const c = (mat.color || mat.uniforms?.litFactor?.value || new THREE.Color(1, 1, 1)).clone();
    const n = new THREE.MeshToonMaterial({ map, color: c, gradientMap: grad, alphaTest: Math.max(0.5, mat.alphaTest || mat.uniforms?.alphaTest?.value || 0), transparent: false, side: mat.side }); n.name = mat.name;
    // the outline pass ignores cut-out alpha (it would paint hidden cloth parts), so only outline fully opaque parts
    n.userData.outlineParameters = { visible: !(mat.transparent || (mat.alphaTest || 0) > 0 || /CLOTH|HAIR|Tops|Bottoms|Shoes/i.test(mat.name || '')) }; return n; };
  m.material = Array.isArray(m.material) ? m.material.map(conv) : conv(m.material); }
function toonify(m, grad) {
  const conv = (mat) => { if (!mat || mat.isMeshToonMaterial || mat.isShaderMaterial) return mat; const n = new THREE.MeshToonMaterial({ map: mat.map || null, color: mat.color ? mat.color.clone() : new THREE.Color(1, 1, 1), gradientMap: grad, transparent: mat.transparent, opacity: mat.opacity, alphaTest: mat.alphaTest, side: mat.side }); n.name = mat.name; return n; };
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
function tintGLB(m, ch) { // only for models with clearly named outfit meshes (e.g. Ready Player Me); custom models keep their look
  const mats = Array.isArray(m.material) ? m.material : [m.material]; const n = m.name;
  for (const mat of mats) { if (!mat.color) continue;
    if (/Outfit_Top/.test(n)) { mat.color.set(ch.top_color); mat.map = null; }
    if (/Outfit_Bottom/.test(n)) { mat.color.set(ch.bottom_color); mat.map = null; }
    if (/Wolf3D_(Headwear|Hair)/.test(n)) mat.color.set(ch.age === 'old' ? '#9a9a9a' : ch.hair_color).lerp(new THREE.Color('#ffffff'), 0.25); }
  if (/Wolf3D_Beard/.test(n) && ch.age === 'young') m.visible = false;
}

// ---------- posing ----------
const _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _m4 = new THREE.Matrix4();
function rotW(a, bone, axis, ang) { const b = a.bones[bone]; if (!b || !ang) return; b.parent.updateWorldMatrix(true, false); _pq.setFromRotationMatrix(_m4.extractRotation(b.parent.matrixWorld)); _q.setFromAxisAngle(axis, ang); const inv = _pq.clone().invert(); b.quaternion.premultiply(inv.multiply(_q).multiply(_pq)); }
export const dirs = (yaw) => ({ F: V3(Math.sin(yaw), 0, Math.cos(yaw)), R: V3(Math.sin(yaw), 0, Math.cos(yaw)).cross(UP).normalize() });
const VOW = ['aa', 'ih', 'ou', 'ee', 'oh'];

const side0 = (st) => (st.rideType === 'cycle' && !st.pillion && st.moving ? 'pedal' : '');
export function poseActor(a, t, st) {
  // st: {visible,pos,yaw,walk,run,sit,drop,look,gesture:{name,k},mouth,emotion,talk,cuffed,struggle}
  a.o.visible = st.visible !== false; if (!a.o.visible) return;
  const w = { walk: st.walk || 0, run: st.run || 0 }; w.idle = Math.max(0, 1 - w.walk - w.run);
  for (const [k, act] of Object.entries(a.actions)) { act.weight = w[k] || 0; act.time = (t * (k === 'idle' ? 1 : 1.05) + a.id.length * 0.37) % act.getClip().duration; }
  if (!a._legRest) { a._legRest = {}; for (const b of ['LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot', 'Spine', 'Spine1', 'Hips']) if (a.bones[b]) a._legRest[b] = a.bones[b].quaternion.clone(); }
  a.mix.update(0); a.bones.Hips.position.copy(a.hipRest); if (a.jaw) a.jaw.quaternion.copy(a.jawRest);
  if (st.lie) { for (const [b, q] of Object.entries(a._legRest)) a.bones[b].quaternion.copy(q); } // lying: straight legs and back
  a.o.position.copy(st.pos); a.o.position.y += a.yLift || 0; a.o.rotation.set(0, st.yaw + a.yawOffset, 0);
  const { F, R } = dirs(st.yaw);
  const s = st.sit || 0;
  if (s > 0) { a.o.position.y -= s * st.drop; a.o.position.addScaledVector(F, -0.1 * s);
    for (const side of ['Left', 'Right']) { rotW(a, side + 'UpLeg', R, 1.5 * s); rotW(a, side + 'Leg', R, -1.45 * s); }
    rotW(a, 'Spine', R, -0.04 * s); }
  const arm = (side, up, fore, inward = 0) => { rotW(a, side + 'Arm', R, up); if (inward) rotW(a, side + 'Arm', UP, (side === 'Right' ? 1 : -1) * inward); rotW(a, side + 'ForeArm', R, fore); };
  if (st.ride) { const r = st.ride; for (const side of ['Left', 'Right']) { rotW(a, side + 'UpLeg', R, 1.0 * r); rotW(a, side + 'Leg', R, -1.05 * r); }
    if (side0(st) === 'pedal') { rotW(a, 'LeftUpLeg', R, Math.sin(t * 7) * 0.35 * r); rotW(a, 'RightUpLeg', R, -Math.sin(t * 7) * 0.35 * r); }
    if (!st.gesture) { if (st.pillion) { arm('Right', 0.35 * r, 0.7 * r, 0.3 * r); arm('Left', 0.35 * r, 0.7 * r, 0.3 * r); } else if (st.rideType === 'horse') { arm('Right', 0.75 * r, 0.9 * r, 0.35 * r); arm('Left', 0.75 * r, 0.9 * r, 0.35 * r); } else { arm('Right', 1.15 * r, 0.35 * r, 0.25 * r); arm('Left', 1.15 * r, 0.35 * r, 0.25 * r); } } }
  if (st.lie && !st.gesture) { arm('Right', 0.05, 0.25, -0.15); arm('Left', 0.05, 0.25, -0.15); }
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
    if (n === 'hands_up') { rotW(a, 'RightArm', F, -2.5 * k); rotW(a, 'LeftArm', F, 2.5 * k); rotW(a, 'RightForeArm', F, -0.25 * k); rotW(a, 'LeftForeArm', F, 0.25 * k); face = 'scared'; }
    if (n === 'salute') { arm('Right', 1.3 * k, 2.2 * k, 0.9 * k); rotW(a, 'RightArm', F, -0.5 * k); }
    if (n === 'namaste') { arm('Right', 0.6 * k, 1.9 * k, 0.75 * k); arm('Left', 0.6 * k, 1.9 * k, 0.75 * k); rotW(a, 'Head', R, 0.12 * k); face = 'happy'; }
    if (n === 'cry') { arm('Right', 0.9 * k, 2.2 * k, 0.6 * k); arm('Left', 0.9 * k, 2.2 * k, 0.6 * k); rotW(a, 'Head', R, (0.25 + Math.sin(t * 9) * 0.03) * k); rotW(a, 'Spine1', R, 0.12 * k); face = 'sad'; }
    if (n === 'examine') { arm('Right', 1.0 * k, 1.5 * k, 0.35 * k); rotW(a, 'Spine1', R, 0.18 * k); rotW(a, 'Head', R, 0.15 * k); }
    if (n === 'test_tube') { arm('Right', 1.05 * k, 1.75 * k, 0.3 * k); rotW(a, 'Head', R, -0.06 * k); }
    if (n === 'torch') arm('Right', 1.25 * k, 0.15 * k, 0.1 * k);
    if (n === 'read' || n === 'file') { arm('Right', 0.75 * k, 1.25 * k, 0.55 * k); arm('Left', 0.75 * k, 1.25 * k, 0.55 * k); rotW(a, 'Head', R, 0.2 * k); }
    if (n === 'write') { arm('Left', 0.7 * k, 1.3 * k, 0.6 * k); arm('Right', (0.75 + 0.06 * Math.sin(t * 11)) * k, 1.35 * k, (0.45 + 0.08 * Math.sin(t * 7)) * k); rotW(a, 'Head', R, 0.22 * k); }
    if (n === 'gavel') { const h = Math.max(0, Math.sin(t * 9)); arm('Right', (0.9 + 0.5 * h) * k, (0.9 - 0.4 * h) * k, 0.3 * k); }
    if (n === 'grab') arm('Right', 1.35 * k, 0.1 * k, 0.35 * k);
    if (n === 'cuff') { arm('Right', 0.95 * k, 0.9 * k, 0.55 * k); arm('Left', 0.95 * k, 0.9 * k, 0.55 * k); rotW(a, 'Spine1', R, 0.12 * k); }
    if (n === 'clap') { const c = Math.abs(Math.sin(t * 10)); arm('Right', 0.9 * k, 1.5 * k, (0.5 + 0.25 * c) * k); arm('Left', 0.9 * k, 1.5 * k, (0.5 + 0.25 * c) * k); face = 'happy'; }
    if (n === 'cook') { arm('Right', 0.85 * k, 0.75 * k, 0.25 * k); arm('Left', (0.8 + 0.12 * Math.sin(t * 7)) * k, (1.2 + 0.15 * Math.cos(t * 7)) * k, (0.65 + 0.1 * Math.sin(t * 7)) * k); rotW(a, 'Head', R, 0.25 * k); }
    if (n === 'chop') { arm('Left', 0.7 * k, 0.9 * k, 0.45 * k); const c = Math.abs(Math.sin(t * 8)); arm('Right', (0.8 + 0.35 * c) * k, (0.7 + 0.5 * c) * k, 0.3 * k); rotW(a, 'Head', R, 0.3 * k); rotW(a, 'Spine1', R, 0.1 * k); }
    if (n === 'eat') { arm('Left', 0.75 * k, 1.1 * k, 0.5 * k); const c = (Math.sin(t * 3.2) + 1) / 2; arm('Right', (0.55 + 0.45 * c) * k, (1.0 + 1.1 * c) * k, (0.35 + 0.15 * c) * k); }
    if (n === 'serve') { arm('Right', 0.95 * k, 0.6 * k, 0.45 * k); arm('Left', 0.95 * k, 0.6 * k, 0.45 * k); }
    if (n === 'sweep') { const c = Math.sin(t * 3.5); arm('Right', 0.55 * k, 0.4 * k, (0.35 + 0.35 * c) * k); arm('Left', 0.75 * k, 0.6 * k, (0.5 + 0.35 * c) * k); rotW(a, 'Spine1', R, 0.35 * k); rotW(a, 'Spine', R, 0.12 * k); rotW(a, 'Head', R, 0.2 * k); }
    if (n === 'aarti') { const c = t * 2.4; arm('Right', (1.0 + 0.18 * Math.sin(c)) * k, (1.05 + 0.18 * Math.cos(c)) * k, (0.45 + 0.15 * Math.cos(c)) * k); arm('Left', 0.25 * k, 0.5 * k, 0); face = 'happy'; }
    if (n === 'pray') { arm('Right', 0.6 * k, 1.95 * k, 0.78 * k); arm('Left', 0.6 * k, 1.95 * k, 0.78 * k); rotW(a, 'Head', R, 0.28 * k); rotW(a, 'Spine1', R, 0.12 * k); }
    if (n === 'dance') { const c = Math.sin(t * 6), d = Math.sin(t * 6 + Math.PI); rotW(a, 'RightArm', F, (-1.9 - 0.4 * c) * k); rotW(a, 'LeftArm', F, (1.9 + 0.4 * d) * k); rotW(a, 'RightForeArm', F, (-0.6 * c) * k); rotW(a, 'LeftForeArm', F, (0.6 * d) * k); rotW(a, 'Spine', UP, 0.25 * c * k); rotW(a, 'Hips', F, 0.08 * c * k); face = 'happy'; }
    if (n === 'knock') { const c = Math.max(0, Math.sin(t * 14)); arm('Right', (1.1 + 0.25 * c) * k, (1.6 - 0.5 * c) * k, 0.1 * k); }
    if (n === 'shiver') { rotW(a, 'Spine1', UP, Math.sin(t * 31) * 0.06 * k); arm('Right', 0.5 * k, 1.9 * k, 0.9 * k); arm('Left', 0.5 * k, 1.9 * k, 0.9 * k); rotW(a, 'Head', R, 0.15 * k); face = 'scared'; }
    if (n === 'type') { const c = Math.sin(t * 13); arm('Right', 0.7 * k, (0.75 + 0.06 * c) * k, 0.45 * k); arm('Left', 0.7 * k, (0.75 - 0.06 * c) * k, 0.45 * k); rotW(a, 'Head', R, 0.22 * k); }
    if (n === 'hug') { arm('Right', 1.25 * k, 0.95 * k, 1.05 * k); arm('Left', 1.25 * k, 0.95 * k, 1.05 * k); rotW(a, 'Spine1', R, 0.1 * k); face = 'happy'; }
    if (n === 'punch') { const c = Math.max(0, Math.sin(t * 9)), d = Math.max(0, Math.sin(t * 9 + Math.PI)); arm('Right', (0.9 + 0.55 * c) * k, (1.9 - 1.7 * c) * k, 0.25 * k); arm('Left', (0.9 + 0.55 * d) * k, (1.9 - 1.7 * d) * k, 0.25 * k); rotW(a, 'Spine', UP, 0.2 * (c - d) * k); face = 'angry'; }
    if (n === 'push') { arm('Right', 1.35 * k, 0.15 * k, 0.15 * k); arm('Left', 1.35 * k, 0.15 * k, 0.15 * k); rotW(a, 'Spine1', R, 0.15 * k); face = 'angry'; }
    if (n === 'slap') { const c = Math.min(1, Math.max(0, (Math.sin(t * 5) + 0.2))); arm('Right', 1.3 * k, 0.3 * k, (-0.6 + 1.6 * c) * k); face = 'angry'; }
    if (n === 'give' || n === 'receive') arm('Right', 1.1 * k, 0.35 * k, 0.3 * k);
    const ph = g.ph ?? ((t * 0.7) % 1);
    if (n === 'kick') { // back-swing → strike at ph 0.3 → follow-through
      const back = ph < 0.2 ? Math.sin((ph / 0.2) * Math.PI / 2) : ph < 0.3 ? 1 - (ph - 0.2) / 0.1 : 0; const fwd = ph < 0.2 ? 0 : ph < 0.32 ? (ph - 0.2) / 0.12 : ph < 0.5 ? 1 - (ph - 0.32) / 0.18 : 0;
      rotW(a, 'RightUpLeg', R, (-0.75 * back + 1.45 * fwd) * k); rotW(a, 'RightLeg', R, (-1.2 * back - 0.15 * fwd) * k); rotW(a, 'Spine1', R, (0.08 * back - 0.18 * fwd) * k);
      arm('Left', 0.9 * k, 0.2 * k, -0.6 * k); arm('Right', (0.2 + 0.5 * back) * k, 0.3 * k, -0.3 * k); }
    if (n === 'raid') { arm('Right', 1.2 * k, 0.2 * k, -0.2 * k); arm('Left', 1.2 * k, 0.2 * k, -0.2 * k); rotW(a, 'Spine1', R, 0.25 * k); face = 'angry'; }
    if (n === 'pichkari') { arm('Right', 1.2 * k, 0.4 * k, 0.4 * k); arm('Left', 1.2 * k, 0.5 * k, 0.6 * k); face = 'happy'; }
    if (n === 'sparkler') { const c = t * 5; arm('Right', (1.1 + 0.3 * Math.sin(c)) * k, (0.5 + 0.3 * Math.cos(c)) * k, 0.2 * k); face = 'happy'; }
    if (n === 'blow') { rotW(a, 'Spine1', R, 0.3 * k); rotW(a, 'Head', R, 0.2 * k); arm('Right', 0.3 * k, 0.4 * k, 0.2 * k); arm('Left', 0.3 * k, 0.4 * k, 0.2 * k); }
    if (n === 'gulal') { const w = Math.sin(Math.min(1, ((t * 0.8) % 1) / 0.3) * Math.PI); arm('Right', (0.6 + 1.0 * w) * k, (1.2 - 0.9 * w) * k, 0.3 * k); face = 'happy'; }
    if (n === 'umbrella') { arm('Right', 0.85 * k, 1.75 * k, 0.55 * k); rotW(a, 'RightArm', F, -0.35 * k); }
    if (n === 'bat') { const sw = Math.sin(Math.min(1, Math.max(0, (ph - 0.55) / 0.25)) * Math.PI); arm('Right', (0.6 + 0.9 * sw) * k, (0.5 - 0.3 * sw) * k, (0.7 - 1.2 * sw) * k); arm('Left', (0.6 + 0.9 * sw) * k, (0.5 - 0.3 * sw) * k, (0.7 - 1.2 * sw) * k); rotW(a, 'Spine', UP, (0.5 - 1.0 * sw) * k); rotW(a, 'Spine1', R, 0.2 * k); }
    if (n === 'bowl') { const w = Math.min(1, Math.max(0, (ph - 0.3) / 0.25)); rotW(a, 'RightArm', R, (-0.4 - 3.4 * w) * k); arm('Left', 0.9 * k, 0.3 * k, 0); rotW(a, 'Spine1', R, 0.25 * w * k); }
    if (n === 'throw') { const w = Math.sin(Math.min(1, ph / 0.35) * Math.PI); rotW(a, 'RightArm', R, (-0.6 - 1.6 * w) * k); rotW(a, 'RightForeArm', R, 0.6 * k); }
    if (n === 'catch') { arm('Right', 1.35 * k, 0.5 * k, 0.45 * k); arm('Left', 1.35 * k, 0.5 * k, 0.45 * k); face = 'happy'; }
    if (n === 'swim') { const c = t * 4; rotW(a, 'RightArm', R, (Math.sin(c) * 1.6 + 1.2) * k); rotW(a, 'LeftArm', R, (Math.sin(c + Math.PI) * 1.6 + 1.2) * k); rotW(a, 'RightUpLeg', R, Math.sin(t * 9) * 0.25 * k); rotW(a, 'LeftUpLeg', R, -Math.sin(t * 9) * 0.25 * k); rotW(a, 'Head', R, -0.6 * k); }
    if (n === 'climb') { const c = Math.sin(t * 5); rotW(a, 'RightArm', F, (-2.4 - 0.4 * c) * k); rotW(a, 'LeftArm', F, (2.4 - 0.4 * c) * k); rotW(a, 'RightUpLeg', R, (0.5 + 0.4 * c) * k); rotW(a, 'LeftUpLeg', R, (0.5 - 0.4 * c) * k); rotW(a, 'RightLeg', R, -0.8 * k); rotW(a, 'LeftLeg', R, -0.8 * k); }
    if (n === 'row') { const c = Math.sin(t * 3); arm('Right', (0.9 + 0.35 * c) * k, (0.6 - 0.4 * c) * k, 0.3 * k); arm('Left', (0.9 + 0.35 * c) * k, (0.6 - 0.4 * c) * k, 0.3 * k); rotW(a, 'Spine1', R, 0.15 * c * k); }
    if (n === 'cut') { const w = Math.max(0, Math.sin(t * 4)); arm('Right', (0.9 - 0.35 * w) * k, (0.7 + 0.2 * w) * k, 0.45 * k); arm('Left', 0.7 * k, 0.9 * k, 0.5 * k); rotW(a, 'Spine1', R, 0.2 * k); rotW(a, 'Head', R, 0.3 * k); face = 'happy'; }
    if (n === 'kite') { const tug = Math.max(0, Math.sin(t * 2.2)) * 0.25; rotW(a, 'RightArm', R, -tug * k); arm('Right', 1.6 * k, 0.4 * k, 0.1 * k); rotW(a, 'RightArm', F, -0.6 * k); arm('Left', 1.0 * k, 0.8 * k, 0.4 * k); rotW(a, 'Head', R, -0.35 * k); face = 'happy'; }
    if (n === 'skip') { const c = Math.sin(t * 9); rotW(a, 'RightArm', F, (-0.45 + 0.15 * c) * k); rotW(a, 'LeftArm', F, (0.45 - 0.15 * c) * k); face = 'happy'; }
    if (n === 'hit_back') { rotW(a, 'Spine1', R, -0.22 * k); rotW(a, 'Head', UP, 0.35 * k); face = 'surprised'; }
    if (n === 'angry') { arm('Right', 0.5 * k, 1.7 * k, -0.1 * k); arm('Left', 0.5 * k, 1.7 * k, -0.1 * k); face = 'angry'; }
  }
  if (st.cuffed) { arm('Right', 0.5, 0.75, 0.62); arm('Left', 0.5, 0.75, 0.62); }
  if (st.struggle) { rotW(a, 'Spine1', UP, Math.sin(t * 13) * 0.18 * st.struggle); rotW(a, 'Head', R, -0.08 * st.struggle); face = 'scared'; }
  // head: look at target (measured, so it also corrects for the clip's own twist)
  if (a.vrm) a.vrm.update(0);
  { a.bones.Head.updateWorldMatrix(true, false); const hp = V3().setFromMatrixPosition(a.bones.Head.matrixWorld); let tgt = st.look ? st.look.clone() : hp.clone().addScaledVector(F, 3);
    if (g && g.name === 'look_around') tgt = hp.clone().add(V3(Math.sin(t * 2.2) * 3 * F.z + F.x * 2, 0, -Math.sin(t * 2.2) * 3 * F.x + F.z * 2));
    const hf = faceDir(a); const d = tgt.sub(hp); d.y = 0; d.normalize();
    let ang = Math.atan2(hf.x * d.z - hf.z * d.x, hf.x * d.x + hf.z * d.z); ang = -Math.max(-1.2, Math.min(1.2, ang));
    rotW(a, 'Neck', UP, ang * 0.45); rotW(a, 'Head', UP, ang * 0.55); }
  if (st.talk) rotW(a, 'Head', R, Math.sin(t * 4.1) * 0.04 * st.talk);
  // face
  const mouth = st.mouth || 0; const per = 3.1 + a.id.length * 0.29, q = (t + a.id.length * 1.7) % per; const blink = face === 'sleep' ? 1 : face === 'happy' ? 0 : q < 0.16 ? 1 - Math.abs(q - 0.08) / 0.08 : 0;
  if (a.vrm) { const em = a.vrm.expressionManager;
    if (em) { for (const v of VOW) em.setValue(v, 0); if (mouth > 0.02) em.setValue(VOW[Math.floor(t * 7.3 + a.id.length) % 5], Math.min(1, mouth * 1.1));
      em.setValue('blink', blink);
      for (const e of ['happy', 'sad', 'angry', 'surprised']) em.setValue(e, 0);
      const emo = { happy: 'happy', sad: 'sad', angry: 'angry', surprised: 'surprised', scared: 'surprised' }[face]; if (emo) em.setValue(emo, mouth > 0.05 ? 0.45 : 0.8); }
    a.vrm.update(0); }
  for (const f of a.face) { const inf = f.m.morphTargetInfluences; if (f.mouth !== undefined) inf[f.mouth] = Math.min(1, mouth * 0.9); if (f.smile !== undefined) inf[f.smile] = face === 'happy' ? 0.7 : 0.15; if (f.blink !== undefined) inf[f.blink] = blink; }
  if (a.jaw && !a.face.some((f) => f.mouth !== undefined) && mouth > 0.02) { a.jaw.updateWorldMatrix(true, false); rotW({ bones: { J: a.jaw } }, 'J', R, 0.22 * mouth); }
  a.o.updateMatrixWorld(true);
}
export const headPos = (a) => { const n = a.vrm ? a.vrm.humanoid.getRawBoneNode('head') : a.bones.Head; n.updateWorldMatrix(true, false); return V3().setFromMatrixPosition(n.matrixWorld); };
export const footPos = (a, side = 'Right') => { const n = a.vrm ? a.vrm.humanoid.getRawBoneNode(side.toLowerCase() + 'Foot') : a.bones[side + 'Foot']; n.updateWorldMatrix(true, false); return V3().setFromMatrixPosition(n.matrixWorld); };
export const handPos = (a, side = 'Right') => { const n = a.vrm ? a.vrm.humanoid.getRawBoneNode(side.toLowerCase() + 'Hand') : a.bones[side + 'Hand']; n.updateWorldMatrix(true, false); return V3().setFromMatrixPosition(n.matrixWorld); };
