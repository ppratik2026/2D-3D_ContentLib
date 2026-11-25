// 2D Cartoon Stage: a painted background image + characters drawn flat (toon shading, black outline) standing on
// the background's ground line, like Indian 2D cartoon story channels. Orthographic camera: x 0..AR, y 0..1 (image space).
import * as THREE from 'three';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';
import { loadActorKit, createActor, poseActor, headPos, handPos } from './actors.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const sm = (a, b, t) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
const FACE = 1.05; // yaw for a 3/4 side view

export async function createStageEngine({ canvas, width, height, tl, url }) {
  const perf = tl.perf || {}; const AR = width / height;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: perf.aa !== false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(perf.scale || 1); renderer.setSize(width, height, false); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
  const outline = new OutlineEffect(renderer, { defaultThickness: 0.0012, defaultColor: [0.05, 0.04, 0.04] });
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x000000);
  const cam = new THREE.OrthographicCamera(0, AR, 1, 0, 0.1, 400); cam.position.set(0, 0, 50); cam.lookAt(0, 0, 0);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8a8a, 1.6); const key = new THREE.DirectionalLight(0xffffff, 1.3); key.position.set(-1, 2, 3); scene.add(hemi, key, key.target);

  // backgrounds (cover-fit into 16:9)
  const tl_ = new THREE.TextureLoader(); const bgTex = {};
  for (const [id, b] of Object.entries(tl.backgrounds || {})) { const t = await tl_.loadAsync(url(b.file)); t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 8;
    const ia = t.image.width / t.image.height; if (ia > AR) { t.repeat.set(AR / ia, 1); t.offset.set((1 - AR / ia) / 2, 0); } else { t.repeat.set(1, ia / AR); t.offset.set(0, (1 - ia / AR) / 2); } bgTex[id] = t; }
  const bgMat = new THREE.MeshBasicMaterial({ toneMapped: false }); bgMat.userData.outlineParameters = { visible: false };
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(AR, 1), bgMat); bg.position.set(AR / 2, 0.5, -100); scene.add(bg);

  // actors
  const kit = await loadActorKit(url); const actors = {}; const holders = {};
  const grad = (() => { const d = new Uint8Array([110, 200, 255]); const t = new THREE.DataTexture(d, 3, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }); shadowMat.userData.outlineParameters = { visible: false };
  for (const ch of tl.story.characters) {
    const cast = (tl.cast && tl.cast[ch.id]) || { file: 'assets/AvatarSample_C.vrm', type: 'vrm' };
    let a; try { a = await createActor(kit, scene, ch, cast, { simpleMat: grad, toon: grad }); } catch (e) { console.warn(e.message); a = await createActor(kit, scene, ch, ch.gender === 'female' ? { file: 'assets/AvatarSample_A.vrm', type: 'vrm' } : { file: 'assets/AvatarSample_C.vrm', type: 'vrm' }, { simpleMat: grad }); }
    const h = new THREE.Group(); scene.add(h); h.add(a.o); const sh = new THREE.Mesh(new THREE.CircleGeometry(0.32, 24), shadowMat); sh.rotation.x = -Math.PI / 2; sh.scale.set(1, 0.45, 1); sh.position.y = 0.01; h.add(sh);
    actors[ch.id] = a; holders[ch.id] = h; h.visible = false;
  }
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.09, 12), new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: grad })); scene.add(cup);

  // ---------- layout & director ----------
  const sceneAt = (t) => { let s = tl.scenes[0]; for (const sc of tl.scenes) if (t >= sc.start - 0.001) s = sc; return s; };
  const lineAt = (t) => tl.lines.find((l) => t >= l.start && t < l.end) || null;
  const B = (sc) => tl.backgrounds[sc.background] || { groundNear: 0.93, groundFar: 0.74, heightNear: 0.62, seats: [] };
  function spots(sc) { // stand spots for everyone in the scene: x in 0..1, row 0 (front) .. 1 (back)
    const n = sc.cast.length; const out = {};
    sc.cast.forEach((id, i) => { const two = n > 4; const row = two ? (i % 2) * 0.55 : 0; const k = two ? Math.floor(i / 2) : i, m = two ? Math.ceil(n / 2) : n;
      const x = m === 1 ? 0.5 : 0.2 + (0.6 * k) / (m - 1) + (two && i % 2 ? 0.06 : 0); out[id] = { x, row }; });
    return out;
  }
  function bodyState(sc, id, t) {
    const sp = spots(sc)[id] || { x: 0.5, row: 0 }; const b = B(sc);
    const ev = sc.events.filter((e) => e.char === id && e.kind !== 'gesture').sort((x, y) => x.t0 - y.t0);
    const st = { visible: sc.initial.includes(id), x: sp.x, row: sp.row, feetY: null, face: sp.x < 0.5 ? 1 : -1, walk: 0, run: 0, sit: 0 };
    const side = (x) => (x < 0.5 ? -0.1 : 1.1);
    const seatFor = () => { const seats = b.seats || []; if (!seats.length) return null; const i = sc.cast.indexOf(id) % seats.length; return seats[i]; };
    const first = ev.find((e) => e.kind === 'sit' || e.kind === 'stand'); const seat0 = seatFor();
    if (st.visible && seat0 && first && first.kind === 'stand') { st.x = seat0.x; st.feetY = seat0.y; st.sit = 1; }
    for (const e of ev) {
      if (t < e.t0) break; const k = Math.min(1, (t - e.t0) / (e.t1 - e.t0)), done = t >= e.t1;
      const go = (x0, x1, run) => { st.x = x0 + (x1 - x0) * (done ? 1 : k); if (!done && Math.abs(x1 - x0) > 0.005) { st.face = x1 > x0 ? 1 : -1; st[run ? 'run' : 'walk'] = 1; } else st.walk = st.run = 0; };
      if (e.kind === 'enter') { st.visible = true; st.sit = 0; st.feetY = null; go(side(sp.x), sp.x); }
      else if (e.kind === 'exit' || e.kind === 'run_exit') { const x0 = st.x; st.sit = 0; st.feetY = null; go(x0, side(x0), e.kind === 'run_exit'); if (done) st.visible = false; }
      else if (e.kind === 'walk_to') { const tgt = e.target && sc.cast.includes(e.target) ? bodyState(sc, e.target, e.t0) : null; const x0 = st.x; const x1 = tgt ? tgt.x + (x0 < tgt.x ? -0.11 : 0.11) : sp.x; st.sit = 0; st.feetY = null; go(x0, x1); if (done && tgt) st.face = tgt.x > st.x ? 1 : -1; }
      else if (e.kind === 'sit') { const s = seatFor(); if (s) { const x0 = st.x; st.x = x0 + (s.x - x0) * sm(0, 0.6, k); st.feetY = s.y; st.sit = sm(0.3, 1, k); } }
      else if (e.kind === 'stand' && st.sit > 0) { st.sit = 1 - sm(0, 0.7, k); if (done) st.feetY = null; }
    }
    return st;
  }
  const TINT = { day: [0xffffff, 1.6, 1.3], morning: [0xfff1dc, 1.5, 1.2], evening: [0xffd2a0, 1.3, 1.0], night: [0x9fb2ff, 0.85, 0.55] };

  function renderAt(t) {
    const sc = sceneAt(t); const b = B(sc); bgMat.map = bgTex[sc.background] || null; bgMat.needsUpdate = true;
    const tint = TINT[sc.time_of_day] || TINT.day; hemi.color.set(tint[0]); hemi.intensity = tint[1]; key.color.set(tint[0]); key.intensity = tint[2];
    const line = lineAt(t); const st = {};
    for (const id of Object.keys(actors)) { holders[id].visible = false; if (sc.cast.includes(id)) st[id] = bodyState(sc, id, t); }
    // place holders: feet on the ground line, smaller in the back row
    const farScale = Math.max(0.45, 1 - (b.groundNear - b.groundFar) * 1.9);
    for (const [id, s] of Object.entries(st)) {
      const h = holders[id], a = actors[id]; if (!s.visible) continue; h.visible = true;
      const feetY = s.feetY ?? (b.groundNear + (b.groundFar - b.groundNear) * s.row);
      const hW = b.heightNear * (1 + (farScale - 1) * Math.min(1, Math.max(0, (b.groundNear - feetY) / Math.max(0.01, b.groundNear - b.groundFar))));
      const childK = a.height / 1.7; h.scale.setScalar((hW * childK) / a.height);
      h.position.set(s.x * AR, 1 - feetY, 10 + feetY * 20);
    }
    // talk / look / gestures
    let lastLine = null; for (const x of tl.lines) if (x.scene === sc.index && x.start <= t) lastLine = x;
    for (const [id, s] of Object.entries(st)) {
      if (!s.visible) { actors[id].o.visible = false; continue; }
      const a = actors[id]; const speaking = line && line.char === id;
      const others = Object.keys(st).filter((x) => x !== id && st[x].visible);
      const lookId = line && line.char !== id && st[line.char]?.visible ? line.char : lastLine && lastLine.char !== id && st[lastLine.char]?.visible ? lastLine.char : others[0];
      // face the person they talk to / look at
      if (!s.walk && !s.run && lookId) s.face = st[lookId].x > s.x ? 1 : -1;
      const p = { visible: true, pos: V3(0, 0, 0), yaw: s.face * FACE, walk: s.walk, run: s.run, sit: s.sit, drop: Math.max(0.2, a.hipY - 0.5) };
      p.look = lookId ? headPos(actors[lookId]).clone() : null;
      if (speaking) { const f = Math.floor((t - line.start) * 30); p.mouth = line.mouth[f] || 0; p.talk = s.walk ? 0 : 0.5 * sm(line.start, line.start + 0.3, t) * (1 - sm(line.end - 0.3, line.end, t)); p.emotion = line.emotion; }
      else if (lastLine && lastLine.char === id && t - lastLine.end < 2) p.emotion = lastLine.emotion;
      const g = sc.events.find((e) => e.kind === 'gesture' && e.char === id && t >= e.t0 && t < e.t1); if (g) p.gesture = { name: g.name, k: sm(g.t0, g.t0 + 0.3, t) * (1 - sm(g.t1 - 0.3, g.t1, t)) };
      poseActor(a, t, p);
    }
    cup.visible = false; for (const [id, s] of Object.entries(st)) if (s.visible) { const a = actors[id]; const g = sc.events.find((e) => e.kind === 'gesture' && e.name === 'drink' && e.char === id && t >= e.t0 && t < e.t1); if (g) { cup.visible = true; cup.position.copy(handPos(a)); cup.scale.setScalar(holders[id].scale.x); } }
    // camera: wide / two-shot / speaker zoom (cuts, like TV cartoons)
    let shot = { type: 'wide' }; for (const x of tl.shots) if (t >= x.t0 && t < x.t1) shot = x;
    let zoom = 1 + 0.04 * sm(sc.start, sc.end ?? sc.start + 20, t), cx = AR / 2, cy = 0.5;
    const vis = Object.keys(st).filter((x) => st[x].visible);
    if (shot.type !== 'wide' && shot.char && vis.includes(shot.char)) {
      const hp = headPos(actors[shot.char]);
      if (shot.type === 'speaker') { zoom = 1.75; cx = hp.x; cy = hp.y - 0.12; }
      else { const o = vis.filter((x) => x !== shot.char).sort((p, q) => Math.abs(st[p].x - st[shot.char].x) - Math.abs(st[q].x - st[shot.char].x))[0]; const ho = o ? headPos(actors[o]) : hp; zoom = 1.35; cx = (hp.x + ho.x) / 2; cy = (hp.y + ho.y) / 2 - 0.15; }
    }
    const hw = AR / 2 / zoom, hh = 0.5 / zoom; cx = Math.min(AR - hw, Math.max(hw, cx)); cy = Math.min(1 - hh, Math.max(hh, cy));
    cam.left = cx - hw; cam.right = cx + hw; cam.top = cy + hh; cam.bottom = cy - hh; cam.updateProjectionMatrix();
    outline.render(scene, cam);
  }
  return { renderAt };
}
