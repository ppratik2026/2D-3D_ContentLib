// The 3D engine used inside Remotion: builds sets + actors from the timeline, then renderAt(t) poses everything
// deterministically for time t (seconds) and renders. No state between frames → safe for parallel rendering.
import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';
import { makeKit, buildSet } from './sets.js';
import { loadActorKit, createActor, poseActor, headPos, handPos, dirs } from './actors.js';
export { loadActorKit, createActor, poseActor, headPos } from './actors.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const sm = (a, b, t) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
const SEATED_DEFAULT = new Set(['cafe', 'home', 'office', 'police', 'classroom', 'park']);
const LOC_BOUNDS = { cafe: [5.6, 4.6], home: [5.1, 4.1], office: [5.6, 4.6], police: [5.6, 4.6], classroom: [5.6, 4.6] };

import { createStageEngine } from './stage.js';
export async function createEngine({ canvas, width, height, tl, url }) {
  if (tl.mode === 'stage') return createStageEngine({ canvas, width, height, tl, url });
  const style = tl.style; const realistic = style === 'realistic';
  const perf = tl.perf || {};
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: perf.aa !== false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(perf.scale || 1); renderer.setSize(width, height, false);
  renderer.shadowMap.enabled = perf.shadows !== false; renderer.shadowMap.type = realistic ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  renderer.toneMapping = realistic ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const outline = style === 'anime' ? new OutlineEffect(renderer, { defaultThickness: 0.0035, defaultColor: [0.08, 0.06, 0.06] }) : null;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.05, 300);
  if (realistic) { const hdr = await new RGBELoader().loadAsync(url('assets/venice_sunset_1k.hdr')); hdr.mapping = THREE.EquirectangularReflectionMapping; scene.environment = hdr; scene.environmentIntensity = 0.35; }

  // lights
  const sun = new THREE.DirectionalLight(0xffffff, 2); sun.castShadow = true; sun.shadow.mapSize.set(realistic ? 2048 : 1024, realistic ? 2048 : 1024); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 0.5, far: 60 }); scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x6b5440, 1); scene.add(hemi);
  const amb = new THREE.AmbientLight(0xffffff, 0.25); scene.add(amb);

  // sets (only the locations that the story uses)
  const kit = makeKit(style); kit.noLamps = !!perf.noLamps; const sets = {};
  for (const sc of tl.scenes) if (!sets[sc.location]) { sets[sc.location] = buildSet(sc.location, kit); scene.add(sets[sc.location].group); }

  if (perf.actorShadowsOnly !== false) for (const S of Object.values(sets)) S.group.traverse((m) => { if (m.isMesh) m.castShadow = false; });
  // actors
  const akit = await loadActorKit(url); const actors = {};
  for (const ch of tl.story.characters) {
    if (ch.hidden || ch.id === 'narrator') continue;
    const cast = (tl.cast && tl.cast[ch.id]) || { file: 'assets/AvatarSample_C.vrm', type: 'vrm' };
    try { actors[ch.id] = await createActor(akit, scene, ch, cast, { simpleMat: perf.simpleMat ? kit.grad : null, toon: kit.toon ? kit.grad : null }); }
    catch (e) { console.warn('Actor failed, using fallback:', e.message); actors[ch.id] = await createActor(akit, scene, ch, ch.gender === 'female' ? { file: 'assets/AvatarSample_A.vrm', type: 'vrm' } : { file: 'assets/AvatarSample_C.vrm', type: 'vrm' }, { simpleMat: perf.simpleMat ? kit.grad : null }); }
  }
  // props
  const cupMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.09, 16), cupMat); cup.castShadow = true; scene.add(cup);
  const phone = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.15, 0.012), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 })); scene.add(phone);

  // ---------- director ----------
  const lineAt = (t) => tl.lines.find((l) => t >= l.start && t < l.end) || null;
  const sceneAt = (t) => { let s = tl.scenes[0]; for (const sc of tl.scenes) if (t >= sc.start - 0.001) s = sc; return s; };
  function slotOf(sc, id) { const S = sets[sc.location]; const i = sc.cast.indexOf(id); return S.slots[(i < 0 ? 0 : i) % S.slots.length]; }
  function bodyState(sc, id, t) {
    const S = sets[sc.location], slot = slotOf(sc, id); const ev = sc.events.filter((e) => e.char === id && e.kind !== 'gesture').sort((a, b) => a.t0 - b.t0);
    const firstPosture = ev.find((e) => e.kind === 'sit' || e.kind === 'stand');
    const startsIn = sc.initial.includes(id);
    let st = { visible: startsIn, pos: slot.stand.pos.clone(), yaw: slot.stand.yaw, sit: 0, walk: 0, run: 0 };
    const seated = startsIn && slot.seat && (firstPosture ? firstPosture.kind === 'stand' : SEATED_DEFAULT.has(sc.location));
    if (seated) { st.pos = slot.seat.pos.clone(); st.yaw = slot.seat.yaw; st.sit = 1; }
    for (const e of ev) {
      if (t < e.t0) break;
      const k = Math.min(1, (t - e.t0) / (e.t1 - e.t0)), done = t >= e.t1;
      const walkTo = (from, to, run) => { const p = from.clone().lerp(to, done ? 1 : k); const d = to.clone().sub(from); st.pos = p; if (!done && d.lengthSq() > 1e-4) { st.yaw = Math.atan2(d.x, d.z); st[run ? 'run' : 'walk'] = 1; } else { st.walk = st.run = 0; } };
      if (e.kind === 'enter') { st.visible = true; st.sit = 0; walkTo(S.entrance.pos, slot.stand.pos); if (done) st.yaw = slot.stand.yaw; }
      else if (e.kind === 'exit' || e.kind === 'run_exit') { const from = st.pos.clone(); st.sit = 0; walkTo(from, S.entrance.pos, e.kind === 'run_exit'); if (done) st.visible = false; }
      else if (e.kind === 'walk_to') { const tgt = e.target && actors[e.target] ? bodyState(sc, e.target, e.t0).pos : slot.stand.pos; const from = st.pos.clone(); const to = tgt.clone().add(from.clone().sub(tgt).setY(0).normalize().multiplyScalar(0.85)); st.sit = 0; walkTo(from, to); if (done) { const d = tgt.clone().sub(to); st.yaw = Math.atan2(d.x, d.z); } }
      else if (e.kind === 'sit' && slot.seat) { const from = st.pos.clone(); st.pos = from.lerp(slot.seat.pos, sm(0, 1, k)); st.yaw = slot.seat.yaw; st.sit = sm(0.2, 1, k); st.walk = 0; }
      else if (e.kind === 'stand' && st.sit > 0) { st.pos = (slot.seat ? slot.seat.pos : st.pos).clone().lerp(slot.stand.pos, sm(0.3, 1, k)); st.sit = 1 - sm(0, 0.7, k); }
    }
    st.drop = Math.max(0.2, actors[id].hipY - (S.seatH + 0.12));
    return st;
  }

  // ---------- lighting per place / time ----------
  const TOD = {
    morning: { sun: 0xffe2b8, si: 2.2, dir: V3(-6, 6, 4), sky: 0xbcd6ee, hemi: 0.9, lamps: 0 },
    day: { sun: 0xffffff, si: 2.8, dir: V3(-4, 10, 5), sky: 0x8fbfe6, hemi: 1.0, lamps: 0 },
    evening: { sun: 0xffb070, si: 1.8, dir: V3(-8, 4, 3), sky: 0xe9a27a, hemi: 0.7, lamps: 2.5 },
    night: { sun: 0x9fb4ff, si: 0.5, dir: V3(-5, 9, 2), sky: 0x0c1222, hemi: 0.35, lamps: 4 },
  };
  function light(sc) {
    const S = sets[sc.location]; const L = TOD[sc.time_of_day] || TOD.day;
    for (const k in sets) sets[k].group.visible = k === sc.location;
    if (S.indoor) { sun.color.set(L === TOD.night ? 0x8899cc : 0xfff1dc); sun.intensity = L === TOD.night ? 0.4 : 1.4; sun.position.set(-3, 6, 3); sun.target.position.set(0, 0, -1);
      hemi.color.set(0xfff2e0); hemi.groundColor.set(0x6b5440); hemi.intensity = L === TOD.night ? 0.45 : 0.85; amb.intensity = 0.25;
      for (const l of S.lamps) l.intensity = L === TOD.night ? 5 : L === TOD.evening ? 3.5 : 1.5; scene.background = new THREE.Color(0x222222); scene.fog = null; }
    else { sun.color.set(L.sun); sun.intensity = L.si; sun.position.copy(L.dir); sun.target.position.set(0, 0, 0);
      hemi.color.set(L.sky); hemi.groundColor.set(0x4f4636); hemi.intensity = L.hemi; amb.intensity = sc.location === 'alley' ? 0.15 : 0.2;
      for (const l of S.lamps) l.intensity = L.lamps * (sc.location === 'alley' ? 2.5 : 1);
      const sky = sc.location === 'alley' && sc.time_of_day !== 'day' ? 0x0b0f18 : L.sky; scene.background = new THREE.Color(sky); scene.fog = new THREE.Fog(sky, 18, 70); }
    renderer.toneMappingExposure = realistic ? (S.indoor ? 1.0 : 0.95) : 1;
  }

  // ---------- camera ----------
  function shotAt(t) { let s = null; for (const x of tl.shots) if (t >= x.t0 && t < x.t1) s = x; return s || { type: 'wide' }; }
  function camera_(sc, t, st) {
    const S = sets[sc.location]; const shot = shotAt(t); const vis = Object.keys(st).filter((id) => st[id].visible);
    let pos, look, fov = 50;
    const wide = () => { const d = Math.sin(t * 0.15) * 0.25; pos = S.wide.pos.clone().add(V3(d, 0, 0)); look = S.wide.look.clone(); fov = 50; };
    const H = (id) => headPos(actors[id]);
    if (shot.type === 'wide' || !shot.char || !vis.includes(shot.char) || vis.length === 0) wide();
    else {
      const sp = shot.char; const others = vis.filter((x) => x !== sp).sort((a, b) => st[a].pos.distanceTo(st[sp].pos) - st[b].pos.distanceTo(st[sp].pos));
      const hs = H(sp);
      if (others.length === 0) { const { F } = dirs(st[sp].yaw); pos = hs.clone().addScaledVector(F, 1.7).add(V3(0.3, 0.02, 0)); look = hs.clone().add(V3(0, -0.12, 0)); fov = 36; }
      else {
        const ho = H(others[0]); const ab = hs.clone().sub(ho); ab.y = 0; const dist = ab.length(); ab.normalize();
        let side = V3(-ab.z, 0, ab.x); if (side.dot(S.wide.pos.clone().sub(ho)) < 0) side.negate();
        if (shot.type === 'two') { const mid = hs.clone().add(ho).multiplyScalar(0.5); pos = mid.clone().addScaledVector(side, Math.max(1.8, dist * 1.25 + 1.0)).add(V3(0, 0.15, 0)); look = mid.add(V3(0, -0.15, 0)); fov = 44; }
        else { pos = ho.clone().addScaledVector(ab, -0.75).addScaledVector(side, 0.38).add(V3(0, 0.06, 0)); look = hs.clone().add(V3(0, -0.08, 0)); fov = 34; }
      }
      const B = LOC_BOUNDS[sc.location]; if (B) { pos.x = Math.max(-B[0], Math.min(B[0], pos.x)); pos.z = Math.max(-B[1], Math.min(B[1], pos.z)); }
      pos.y = Math.max(0.6, pos.y);
    }
    camera.position.copy(pos); camera.lookAt(look); camera.fov = fov; camera.updateProjectionMatrix();
  }

  function renderAt(t) {
    const sc = sceneAt(t); light(sc);
    const line = lineAt(t); const st = {};
    for (const id of Object.keys(actors)) {
      if (!sc.cast.includes(id)) { actors[id].o.visible = false; continue; }
      st[id] = bodyState(sc, id, t);
    }
    const lastLine = (() => { let l = null; for (const x of tl.lines) if (x.scene === sc.index && x.start <= t) l = x; return l; })();
    for (const [id, s] of Object.entries(st)) {
      const a = actors[id]; const speaking = line && line.char === id;
      const others = Object.keys(st).filter((x) => x !== id && st[x].visible);
      const lookId = line && line.char !== id && st[line.char]?.visible ? line.char : lastLine && lastLine.char !== id && st[lastLine.char]?.visible ? lastLine.char : others[0];
      s.look = lookId ? headPos(actors[lookId]).clone() : null;
      if (speaking) { const f = Math.floor((t - line.start) * 30); s.mouth = line.mouth[f] || 0; s.talk = s.walk ? 0 : 0.5 * sm(line.start, line.start + 0.3, t) * (1 - sm(line.end - 0.3, line.end, t)); s.emotion = line.emotion; }
      else if (lastLine && lastLine.char === id && t - lastLine.end < 2) s.emotion = lastLine.emotion;
      const g = sc.events.find((e) => e.kind === 'gesture' && e.char === id && t >= e.t0 && t < e.t1);
      if (g) s.gesture = { name: g.name, k: sm(g.t0, g.t0 + 0.3, t) * (1 - sm(g.t1 - 0.3, g.t1, t)) };
      poseActor(a, t, s);
    }
    // props in hand
    cup.visible = phone.visible = false;
    for (const [id, s] of Object.entries(st)) { if (!s.gesture || !s.visible) continue; const hp = handPos(actors[id]);
      if (s.gesture.name === 'drink') { cup.visible = true; cup.position.copy(hp).add(V3(0, 0.03, 0)); }
      if (s.gesture.name === 'phone') { phone.visible = true; phone.position.copy(hp); phone.rotation.set(0, s.yaw, 0.3); } }
    camera_(sc, t, st);
    if (outline) outline.render(scene, camera); else renderer.render(scene, camera);
  }
  return { renderAt };
}
