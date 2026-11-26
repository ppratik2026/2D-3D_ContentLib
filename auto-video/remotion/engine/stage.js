// 2D Cartoon Stage: a painted background image + characters drawn flat (toon shading, black outline) standing on
// the background's ground line, like Indian 2D cartoon story channels. Orthographic camera: x 0..AR, y 0..1 (image space).
// Also: vehicles (drive in / get in / chase), foot chases, catching + handcuffs, place markers (judge, desk, witness box,
// bed, jail cell…) with "cover" patches cut from the background so people stand behind desks and benches.
import * as THREE from 'three';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';
import { loadActorKit, createActor, poseActor, headPos, handPos, footPos } from './actors.js';
import { makeVehicle } from './vehicles.js';
import { makeAnimal, makeExtra, makeSafa, makeBirds } from './creatures.js';
import { makeKite, makeCurve } from './effects.js';
import { makeFire, makeExplosion, makeSplash, makeProps, makeLine, makeFireworks, makeDiyas, makeLights, makePowder, makeSpark, makeFestProps } from './effects.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const sm = (a, b, t) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
const lerp = (a, b, k) => a + (b - a) * k;
const FACE = 1.05; // yaw for a 3/4 side view
const SIT_TYPES = new Set(['seat', 'desk', 'judge']);
// who goes to which marker at the start of a scene (by the character's role)
const ROLE = [
  ['judge', /judge|magistrate|jaj|nyayadhish|न्याय/i], ['bed', /patient|injured|sick|ghayal|bimar|marij|मरीज़|घायल/i],
  ['cell', /thief|chor|criminal|accused|prisoner|qaidi|kaidi|suspect|culprit|murderer|robber|dacoit|daku|चोर|मुजरिम/i],
  ['witness', /accused|thief|chor|criminal|suspect|witness|gawah|culprit|murderer|robber|चोर|गवाह/i],
  ['board', /teacher|professor|sir$|madam|master|principal|शिक्षक/i],
  ['desk', /inspector|officer|doctor|teacher|principal|boss|manager|clerk|judge|sho|commissioner|dcp|acp|receptionist/i],
  ['counter', /scientist|forensic|lab|chemist|shopkeeper|dukandar|cashier|doctor|pharmacist|receptionist|banker|waiter/i],
];

export async function createStageEngine({ canvas, width, height, tl, url }) {
  const perf = tl.perf || {}; const AR = width / height;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: perf.aa !== false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(perf.scale || 1); renderer.setSize(width, height, false); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
  renderer.localClippingEnabled = true;
  const outline = new OutlineEffect(renderer, { defaultThickness: 0.0012, defaultColor: [0.05, 0.04, 0.04] });
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x000000);
  const cam = new THREE.OrthographicCamera(0, AR, 1, 0, 0.1, 400); cam.position.set(0, 0, 50); cam.lookAt(0, 0, 0);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8a8a, 1.6); const key = new THREE.DirectionalLight(0xffffff, 1.3); key.position.set(-1, 2, 3); scene.add(hemi, key, key.target);
  const grad = (() => { const d = new Uint8Array([110, 200, 255]); const t = new THREE.DataTexture(d, 3, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
  const toon = (c) => new THREE.MeshToonMaterial({ color: new THREE.Color(c), gradientMap: grad });
  const noOutline = (m) => { (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => (x.userData.outlineParameters = { visible: false })); return m; };

  // backgrounds (cover-fit into 16:9; mirrored repeat so chases can scroll them)
  const tl_ = new THREE.TextureLoader(); const bgTex = {}, fit = {};
  for (const [id, b] of Object.entries(tl.backgrounds || {})) { const t = await tl_.loadAsync(url(b.file)); t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 8; t.wrapS = THREE.MirroredRepeatWrapping;
    const ia = t.image.width / t.image.height; if (ia > AR) { t.repeat.set(AR / ia, 1); t.offset.set((1 - AR / ia) / 2, 0); } else { t.repeat.set(1, ia / AR); t.offset.set(0, (1 - ia / AR) / 2); }
    bgTex[id] = t; fit[id] = { rx: t.repeat.x, ry: t.repeat.y, ox: t.offset.x, oy: t.offset.y }; }
  const bgMat = new THREE.MeshBasicMaterial({ toneMapped: false }); bgMat.userData.outlineParameters = { visible: false };
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(AR, 1), bgMat); bg.position.set(AR / 2, 0.5, -100); scene.add(bg);
  const B = (sc) => tl.backgrounds?.[sc.background] || { groundNear: 0.93, groundFar: 0.74, heightNear: 0.62, seats: [] };
  const marks = (b) => (b.seats || []).map((m, i) => ({ type: 'seat', ...m, i }));
  const farScaleOf = (b) => Math.max(0.45, 1 - (b.groundNear - b.groundFar) * 1.9);
  const heightAt = (b, feetY) => b.heightNear * (1 + (farScaleOf(b) - 1) * Math.min(1, Math.max(0, (b.groundNear - feetY) / Math.max(0.01, b.groundNear - b.groundFar))));
  const rowY = (b, row) => b.groundNear + (b.groundFar - b.groundNear) * row;
  const zOf = (feetY) => 10 + feetY * 20;

  // cover patches (a piece of the background drawn in front of the person: desk, judge's bench, witness box, bed) + jail bars
  const coverGroups = {};
  for (const [id, b] of Object.entries(tl.backgrounds || {})) {
    const g = new THREE.Group(); g.visible = false; scene.add(g); coverGroups[id] = g; const f = fit[id]; if (!f) continue;
    const tex = bgTex[id].clone(); tex.repeat.set(1, 1); tex.offset.set(0, 0); tex.needsUpdate = true;
    for (const m of marks(b)) {
      const w = m.w || ({ judge: 0.26, desk: 0.22, bed: 0.3, witness: 0.12, counter: 0.22, cell: 0.24 })[m.type] || 0;
      if (m.type === 'cell') { // iron bars in front of the prisoner
        const top = m.cover ?? Math.max(0.02, m.y - heightAt(b, m.y) * 1.3); const x0 = (m.x - w / 2) * AR, x1 = (m.x + w / 2) * AR; const n = Math.max(5, Math.round((x1 - x0) / 0.045));
        const mat = toon('#2b2d33'); const z = zOf(m.y) + 0.6;
        for (let k = 0; k <= n; k++) { const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, m.y - top, 8), mat); bar.position.set(lerp(x0, x1, k / n), 1 - (top + m.y) / 2, z); g.add(bar); }
        for (const yy of [top + 0.015, lerp(top, m.y, 0.45), m.y - 0.02]) { const h = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 0.02, 0.012, 0.012), mat); h.position.set((x0 + x1) / 2, 1 - yy, z); g.add(h); }
        continue;
      }
      if (m.cover == null || !w) continue;
      const x0 = m.x - w / 2, x1 = m.x + w / 2, y0 = m.cover, y1 = Math.min(1, m.y + (m.type === 'bed' ? 0.2 : 0.04));
      const geo = new THREE.PlaneGeometry((x1 - x0) * AR, y1 - y0); const uv = geo.attributes.uv;
      for (let k = 0; k < uv.count; k++) { const u = uv.getX(k) ? x1 : x0, v = uv.getY(k) ? y0 : y1; uv.setXY(k, f.ox + f.rx * u, f.oy + f.ry * (1 - v)); }
      const p = noOutline(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }))); p.position.set(((x0 + x1) / 2) * AR, 1 - (y0 + y1) / 2, zOf(m.y) + 0.6); g.add(p);
    }
  }

  // actors
  const kit = await loadActorKit(url); const actors = {}; const holders = {};
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }); shadowMat.userData.outlineParameters = { visible: false };
  const roleOf = {};
  for (const ch of tl.story.characters) {
    if (ch.hidden || ch.id === 'narrator') continue;
    roleOf[ch.id] = `${ch.role || ''} ${ch.name || ''}`;
    const cast = (tl.cast && tl.cast[ch.id]) || { file: 'assets/AvatarSample_C.vrm', type: 'vrm' };
    let a; try { a = await createActor(kit, scene, ch, cast, { simpleMat: grad, toon: grad }); } catch (e) { console.warn(e.message); a = await createActor(kit, scene, ch, ch.gender === 'female' ? { file: 'assets/AvatarSample_A.vrm', type: 'vrm' } : { file: 'assets/AvatarSample_C.vrm', type: 'vrm' }, { simpleMat: grad }); }
    const h = new THREE.Group(); scene.add(h); const pivot = new THREE.Group(); h.add(pivot); pivot.add(a.o); const sh = new THREE.Mesh(new THREE.CircleGeometry(0.32, 24), shadowMat); sh.rotation.x = -Math.PI / 2; sh.scale.set(1, 0.45, 1); sh.position.y = 0.01; h.add(sh);
    const clip = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e5); a.o.traverse((m) => { if (m.isMesh) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => { x.clippingPlanes = [clip]; }); });
    actors[ch.id] = a; holders[ch.id] = { h, pivot, sh, clip }; h.visible = false;
  }
  // vehicles
  const vehicles = {};
  for (const v of tl.vehicles || []) { const m = makeVehicle(v.type, v.color, grad); m.front ??= m.type === 'train' ? 8.1 : m.len / 2; m.rear ??= m.type === 'train' ? 26.2 : m.len / 2; m.group.visible = false; scene.add(m.group); vehicles[v.key] = m; }
  // animals, crowd people, baraat extras
  const animals = {}; for (const a of (tl.animals || []).filter((x) => x.type !== 'birds')) { const m = makeAnimal(a.type, a.seed || 1, { grad }); m.group.visible = false; scene.add(m.group); animals[a.key] = m; }
  const extras = []; for (let i = 0; i < Math.min(14, tl.crowdMax || 0); i++) { const e = makeExtra(i + 1, grad); e.group.visible = false; scene.add(e.group); extras.push(e); }
  const safa = makeSafa(grad); safa.visible = false; scene.add(safa);
  const confetti = []; { const cols = [0xff4d6d, 0xffd166, 0x06d6a0, 0x4cc9f0, 0xf72585, 0xffffff]; for (let i = 0; i < 46; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 0.018), new THREE.MeshBasicMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide, depthTest: false, toneMapped: false })); m.userData.outlineParameters = { visible: false }; m.visible = false; m.position.z = 44; scene.add(m); confetti.push(m); } }
  // camera angles for chases: drone (top view) and front view use roads drawn here, so no extra background is needed
  const mkCanvasTex = (w, h, draw) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'); draw(x, w, h); const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.wrapS = THREE.RepeatWrapping; return { tx, cv, x }; };
  const drone = mkCanvasTex(2048, 1152, (x, w, h) => { x.fillStyle = '#5fa84a'; x.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { x.fillStyle = i % 2 ? '#58a044' : '#66b050'; x.fillRect(i * 52, 0, 26, h); }
    x.fillStyle = '#c9c2a8'; x.fillRect(0, h * 0.3, w, h * 0.4); x.fillStyle = '#4a4d55'; x.fillRect(0, h * 0.33, w, h * 0.34); x.fillStyle = '#f4f1e6'; x.fillRect(0, h * 0.345, w, 6); x.fillRect(0, h * 0.655 - 6, w, 6);
    for (let i = 0; i < 20; i++) x.fillRect(i * 110 + 20, h * 0.5 - 4, 60, 8); for (let i = 0; i < 18; i++) for (const yy of [0.15, 0.85]) { const cx = i * 118 + (yy > 0.5 ? 60 : 0), cy = h * yy + Math.sin(i * 7) * 40; x.fillStyle = '#2f7d32'; x.beginPath(); x.arc(cx, cy, 52, 0, 7); x.fill(); x.strokeStyle = '#1d4f1f'; x.lineWidth = 5; x.stroke(); x.fillStyle = '#3f9442'; x.beginPath(); x.arc(cx - 12, cy - 12, 26, 0, 7); x.fill(); } });
  drone.tx.repeat.set(1, 1);
  const front = mkCanvasTex(1600, 900, () => {});
  const drawFront = (t) => { const x = front.x, w = 1600, h = 900; const g = x.createLinearGradient(0, 0, 0, h * 0.42); g.addColorStop(0, '#7cc0f0'); g.addColorStop(1, '#d8ecf8'); x.fillStyle = g; x.fillRect(0, 0, w, h * 0.42);
    x.fillStyle = '#7aa884'; x.beginPath(); x.moveTo(0, h * 0.42); for (let i = 0; i <= 8; i++) x.lineTo((i / 8) * w, h * (0.32 + (i % 2) * 0.07)); x.lineTo(w, h * 0.42); x.fill(); x.fillStyle = '#62a84c'; x.fillRect(0, h * 0.42, w, h * 0.58);
    x.fillStyle = '#4a4d55'; x.beginPath(); x.moveTo(w * 0.47, h * 0.42); x.lineTo(w * 0.53, h * 0.42); x.lineTo(w * 1.05, h); x.lineTo(-w * 0.05, h); x.fill(); x.strokeStyle = '#f4f1e6'; x.lineWidth = 6; x.beginPath(); x.moveTo(w * 0.475, h * 0.42); x.lineTo(0, h); x.moveTo(w * 0.525, h * 0.42); x.lineTo(w, h); x.stroke();
    x.fillStyle = '#f4f1e6'; for (let i = 0; i < 8; i++) { const k = ((i / 8) + t * 0.9) % 1; const kk = k * k; const y0 = h * 0.42 + kk * h * 0.58, y1 = h * 0.42 + Math.min(1, (k + 0.05) ** 2) * h * 0.58; const half = (yy) => 3 + ((yy - h * 0.42) / (h * 0.58)) * 14; x.beginPath(); x.moveTo(w / 2 - half(y0), y0); x.lineTo(w / 2 + half(y0), y0); x.lineTo(w / 2 + half(y1), y1); x.lineTo(w / 2 - half(y1), y1); x.fill(); }
    for (let i = 0; i < 10; i++) { const k = ((i / 10) + t * 0.9) % 1; const kk = k * k; const y = h * 0.42 + kk * h * 0.58; const side = i % 2 ? 1 : -1; const xx = w / 2 + side * (w * 0.06 + kk * w * 0.7); const r = 8 + kk * 120; x.fillStyle = '#6b4426'; x.fillRect(xx - r * 0.12, y - r * 1.2, r * 0.24, r * 1.2); x.fillStyle = '#2f7d32'; x.beginPath(); x.arc(xx, y - r * 1.4, r * 0.7, 0, 7); x.fill(); }
    front.tx.needsUpdate = true; };
  // effects + game props (v1.2)
  const fires = Array.from({ length: 3 }, () => { const f = makeFire(); f.group.visible = false; scene.add(f.group); return f; });
  const booms = Array.from({ length: 2 }, () => { const f = makeExplosion(); f.group.visible = false; scene.add(f.group); return f; });
  const splashes = Array.from({ length: 3 }, () => { const f = makeSplash(); f.group.visible = false; scene.add(f.group); return f; });
  const birds = makeBirds(9, grad); birds.group.visible = false; scene.add(birds.group);
  const GP = makeProps(toon); for (const p of Object.values(GP)) { p.visible = false; scene.add(p); }
  const kiteLine = makeCurve(16, 0xf4f4f4); kiteLine.obj.visible = false; kiteLine.obj.position.z = 45; scene.add(kiteLine.obj); const kite = makeKite(); kite.group.visible = false; scene.add(kite.group);
  const charkhi = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 12), toon('#d63a4a')); charkhi.rotation.x = Math.PI / 2; charkhi.visible = false; scene.add(charkhi);
  const puffs = Array.from({ length: 4 }, () => { const m = new THREE.Mesh(new THREE.CircleGeometry(0.01, 10), new THREE.MeshBasicMaterial({ color: 0x9a9aa0, transparent: true, opacity: 0.5, depthWrite: false })); m.material.userData.outlineParameters = { visible: false }; m.visible = false; scene.add(m); return m; });
  const fworks = makeFireworks(5); fworks.group.visible = false; fworks.group.position.z = 6; scene.add(fworks.group);
  const diyas = makeDiyas(16); diyas.group.visible = false; scene.add(diyas.group); const lights = makeLights(44); lights.group.visible = false; lights.group.position.z = 46; scene.add(lights.group);
  const powder = makePowder(30); powder.group.visible = false; powder.group.position.z = 45; scene.add(powder.group);
  const sparks = [0, 1, 2].map(() => { const sp = makeSpark(18); sp.group.visible = false; sp.group.position.z = 46; scene.add(sp.group); return sp; }); const anaar = makeSpark(40, 0xffd27a); anaar.group.visible = false; scene.add(anaar.group);
  const FP = makeFestProps(toon); for (const p of Object.values(FP)) { p.visible = false; scene.add(p); } const spray = makeLine(0xff3d8b); spray.obj.visible = false; scene.add(spray.obj);
  const umbrellas = {}; const umbrellaFor = (id) => { if (!umbrellas[id]) { const u = makeProps(toon).umbrella; scene.add(u); umbrellas[id] = u; } return umbrellas[id]; };
  // props held in the hand
  const P = {};
  P.cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.09, 12), toon('#ffffff'));
  P.phone = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.15, 0.015), toon('#15151a'));
  P.file = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.32, 0.02), toon('#d9a441'));
  P.write = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.015), toon('#f1efe6'));
  P.read = P.file;
  P.examine = (() => { const g = new THREE.Group(); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.011, 8, 24), toon('#3a2b1c')); const glass = noOutline(new THREE.Mesh(new THREE.CircleGeometry(0.058, 20), new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.45 }))); const hd = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.11, 8), toon('#3a2b1c')); hd.position.y = -0.11; g.add(ring, glass, hd); return g; })();
  P.test_tube = (() => { const g = new THREE.Group(); const t = noOutline(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.15, 10), new THREE.MeshBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.6 }))); const liq = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.07, 10), new THREE.MeshBasicMaterial({ color: 0x3fd47a })); liq.position.y = -0.035; g.add(t, liq); return g; })();
  P.gavel = (() => { const g = new THREE.Group(); const hd = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.13, 12), toon('#6b3d1f')); hd.rotation.z = Math.PI / 2; hd.position.y = 0.09; const st = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.2, 8), toon('#6b3d1f')); g.add(hd, st); return g; })();
  P.torch = (() => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.018, 0.16, 10), toon('#2a2a30')); b.rotation.z = Math.PI / 2; const beam = noOutline(new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.6, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }))); beam.rotation.z = Math.PI / 2; beam.position.x = 0.88; g.add(b, beam); return g; })();
  const grp = (...ms) => { const g = new THREE.Group(); ms.forEach((m) => g.add(m)); return g; };
  const mesh = (geo, c, x = 0, y = 0, z = 0, rz = 0, rx = 0) => { const m = new THREE.Mesh(geo, typeof c === 'string' ? toon(c) : c); m.position.set(x, y, z); m.rotation.z = rz; m.rotation.x = rx; return m; };
  P.cook = grp(mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.05, 20), '#2b2b30', 0.16, -0.02, 0), mesh(new THREE.BoxGeometry(0.2, 0.025, 0.03), '#3a2b1c', 0.0, 0, 0));
  P.chop = grp(mesh(new THREE.BoxGeometry(0.26, 0.06, 0.012), '#e3e7ee', 0.17, 0, 0), mesh(new THREE.BoxGeometry(0.11, 0.045, 0.03), '#3a2b1c', 0, 0, 0));
  P.eat = grp(mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.02, 20), '#f4f4f2', 0, 0, 0, 0, Math.PI / 2 - 0.4), mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.025, 14), '#e0a95a', 0, 0.015, 0.01, 0, Math.PI / 2 - 0.4)); P.eat.userData.hand = 'Left';
  P.serve = grp(mesh(new THREE.BoxGeometry(0.34, 0.02, 0.22), '#b98a4c', 0, 0, 0), mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.08, 12), '#ffffff', -0.07, 0.05, 0), mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.08, 12), '#ffffff', 0.07, 0.05, 0));
  P.sweep = grp(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 8), '#c9a15a', 0, -0.3, 0), mesh(new THREE.ConeGeometry(0.1, 0.32, 10), '#d8c27a', 0, -0.85, 0)); P.sweep.userData.rot = 0.35;
  P.aarti = grp(mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.015, 24), '#d4a017', 0, 0, 0), mesh(new THREE.ConeGeometry(0.02, 0.06, 8), new THREE.MeshBasicMaterial({ color: 0xffa31a, toneMapped: false }), 0, 0.045, 0), mesh(new THREE.SphereGeometry(0.02, 8, 8), '#e0402a', 0.07, 0.02, 0));
  P.type = grp(mesh(new THREE.BoxGeometry(0.34, 0.02, 0.24), '#3a3d45', 0, 0, 0), mesh(new THREE.BoxGeometry(0.34, 0.22, 0.015), '#3a3d45', 0, 0.11, -0.12, 0, -0.25), mesh(new THREE.PlaneGeometry(0.3, 0.18), new THREE.MeshBasicMaterial({ color: 0x9fd0ff, toneMapped: false }), 0, 0.11, -0.11, 0, -0.25)); P.type.userData.mid = true;
  P.give = grp(mesh(new THREE.BoxGeometry(0.14, 0.12, 0.12), '#d63a4a', 0, 0, 0), mesh(new THREE.BoxGeometry(0.15, 0.025, 0.125), '#ffd166', 0, 0, 0));
  P.money = mesh(new THREE.BoxGeometry(0.16, 0.08, 0.02), '#5aa55a');
  P.receive = P.give;
  for (const p of Object.values(P)) { p.visible = false; scene.add(p); }
  const cuffs = {}; const cuffMesh = () => { const g = new THREE.Group(); const m = toon('#c9ccd4'); for (const dx of [-0.05, 0.05]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.009, 8, 20), m); r.position.x = dx; g.add(r); } const c = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.008, 0.008), m); g.add(c); g.visible = false; scene.add(g); return g; };
  // speed lines for chases
  const speed = []; { const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthTest: false }); m.userData.outlineParameters = { visible: false }; for (let i = 0; i < 16; i++) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.25 + (i % 4) * 0.08, 0.003), m); l.visible = false; l.position.z = 45; scene.add(l); speed.push(l); } }

  // ---------- director: the full state of a scene at time t ----------
  const sceneAt = (t) => { let s = tl.scenes[0]; for (const sc of tl.scenes) if (t >= sc.start - 0.001) s = sc; return s; };
  const lineAt = (t) => tl.lines.find((l) => t >= l.start && t < l.end) || null;
  function spots(ids, squeeze, busy = []) { // stand spots: x in 0..1, row 0 (front) .. 1 (back); avoids places taken near the front
    const n = ids.length; const out = {}; const lo = squeeze ? 0.14 : 0.2, hi = squeeze ? 0.58 : 0.8;
    let xs = []; for (let x = 0.1; x <= 0.9001; x += 0.01) if (!busy.some(([a, b]) => x > a - 0.05 && x < b + 0.05) && (!squeeze || x < 0.6)) xs.push(+x.toFixed(2));
    const plain = !busy.length || xs.length < 8;
    ids.forEach((id, i) => { const two = n > 4; const row = two ? (i % 2) * 0.55 : 0; const k = two ? Math.floor(i / 2) : i, m = two ? Math.ceil(n / 2) : n;
      let x; if (plain) x = m === 1 ? (lo + hi) / 2 : lo + ((hi - lo) * k) / (m - 1); else { const a = Math.max(0, Math.round(xs.length * 0.12)), b = Math.min(xs.length - 1, Math.round(xs.length * 0.88)); x = xs[m === 1 ? Math.round((a + b) / 2) : Math.round(a + ((b - a) * k) / (m - 1))]; }
      out[id] = { x: x + (two && i % 2 ? 0.06 : 0), row }; });
    return out;
  }
  const plan = new Map(); // per scene: things that do not depend on t
  function planOf(sc) {
    if (plan.has(sc)) return plan.get(sc);
    const b = B(sc); const ms = marks(b); const ev = [...sc.events].sort((x, y) => x.t0 - y.t0);
    const vkeys = [...new Set(ev.map((e) => e.vehicle).concat(ev.map((e) => e.chaser)).filter(Boolean))].filter((k) => vehicles[k]);
    const chase = ev.some((e) => e.kind === 'car_chase' || e.kind === 'foot_chase');
    const involved = new Set(ev.filter((e) => e.kind === 'car_chase' || e.kind === 'foot_chase').flatMap((e) => [e.char, ...(e.chasers || [])]));
    const akeys = [...new Set(ev.filter((e) => e.kind === 'animal').map((e) => e.animal))].filter((k) => animals[k] || k === 'birds');
    const inside = {}; // characters who start the scene inside a vehicle
    for (const e of ev) if (e.kind === 'baraat' && e.char && e.vehicle && !(e.char in inside)) inside[e.char] = { key: e.vehicle, seat: 0 };
    for (const e of ev) { if (e.kind === 'drive_in' || e.kind === 'car_chase') { [e.char, ...(e.with || [])].forEach((id, i) => { if (id && !(id in inside)) inside[id] = { key: e.vehicle, seat: i }; }); if (e.kind === 'car_chase' && e.chaser) (e.chasers || []).forEach((id, i) => { if (!(id in inside)) inside[id] = { key: e.chaser, seat: i }; }); } }
    // markers taken by role at the start (only for people standing in the scene at the start)
    const anchor = {}; const used = new Set();
    for (const [type, re] of ROLE) for (const m of ms.filter((x) => x.type === type)) {
      if (used.has(m.i)) continue; const id = sc.initial.find((c) => !anchor[c] && !(c in inside) && re.test(roleOf[c] || '')); if (id) { anchor[id] = m; used.add(m.i); }
    }
    const parked = vkeys.some((k) => { const f = ev.find((e) => e.vehicle === k || e.chaser === k); return f && f.kind !== 'drive_in' && f.kind !== 'car_chase'; });
    const free = sc.cast.filter((c) => !anchor[c]); const busy = Object.values(anchor).map((m) => { const w = m.w || 0.12; return [m.x - w / 2, m.x + w / 2]; }); const sp = spots(free, parked, busy);
    // when a chase ends, the next movement of the scene
    for (const e of ev) if (['car_chase', 'foot_chase', 'baraat', 'game', 'swim', 'birthday'].includes(e.kind)) { const nx = ev.find((x) => x.t0 >= e.t1 - 0.01 && x !== e && !['gesture', 'animal', 'crowd', 'fire', 'fire_out', 'holi', 'diwali', 'cracker', 'fly_by'].includes(x.kind)); e._until = Math.max(e.t1, nx ? nx.t0 : sc.end - 0.4); }
    const p = { b, ms, ev, vkeys, akeys, chase, involved, inside, anchor, sp, parked }; plan.set(sc, p); return p;
  }
  const PARK = { x: 0.8, row: 1 }; const VSCALE = 0.85;
  function stateAt(sc, t) {
    const p = planOf(sc); const b = p.b;
    const C = {}, V = {}; let scroll = 0, chasing = null, shake = 0, crowd = { mood: null, count: 0 }, baraat = null; const A = {}; const FX = { fires: [], booms: [], game: null, splash: [] };
    for (const k of p.akeys) { const f = p.ev.find((e) => e.kind === 'animal' && e.animal === k); const type = animals[k]?.type || k; const home = type === 'dog' || type === 'cat' || type === 'monkey' ? { x: 0.08, row: 0.1 } : type === 'goat' ? { x: 0.12, row: 0.5 } : { x: 0.16, row: 0.92 };
      A[k] = { visible: f && f.act !== 'enter', x: home.x, row: home.row, home, face: home.x < 0.5 ? 1 : -1, move: 0, run: 0, head: null, act: null }; }
    p.vkeys.forEach((k, i) => { const f = p.ev.find((e) => e.vehicle === k || e.chaser === k); const visible = f && !['drive_in', 'car_chase', 'baraat', 'fly_by'].includes(f.kind); const park = [0.78, 0.3, 0.55][i % 3]; V[k] = { visible, park, alt: 0, fly: null, x: park, row: PARK.row, spin: 0, door: 0, siren: false, bob: 0, used: 0 }; });
    for (const id of sc.cast) {
      const s = p.sp[id] || { x: 0.5, row: 0 }; const an = p.anchor[id];
      C[id] = { visible: sc.initial.includes(id), x: an ? an.x : s.x, row: s.row, home: s, feetY: an ? an.y : null, face: s.x < 0.5 ? 1 : -1, walk: 0, run: 0, sit: an && SIT_TYPES.has(an.type) ? 1 : 0, lie: 0, anchor: an || null, inV: null, inK: 0, cuffed: false, grab: null, struggle: 0 };
      if (an && an.type === 'bed') C[id].lie = 1;
      if (p.inside[id]) { C[id].inV = p.inside[id]; C[id].inK = 1; C[id].visible = false; }
    }
    const feet = (c) => c.feetY ?? rowY(b, c.row);
    const vFeet = (v) => rowY(b, v.row);
    const vScale = (v) => (heightAt(b, vFeet(v)) / 1.7) * VSCALE;
    const doorX = (k, seat) => { const v = V[k], m = vehicles[k]; const s = vScale(v); return v.x + (doorWorld(m, seat) * s) / AR; };
    const side = (x) => (x < 0.5 ? -0.1 : 1.1);
    for (const e of p.ev) {
      if (t < e.t0) break; const until = e._until ?? e.t1; const k = Math.min(1, (t - e.t0) / Math.max(0.01, e.t1 - e.t0)), done = t >= e.t1;
      const c = C[e.char];
      const go = (cc, x0, x1, run, kk = k) => { cc.x = lerp(x0, x1, kk); if (kk < 1 && Math.abs(x1 - x0) > 0.005) { cc.face = x1 > x0 ? 1 : -1; cc[run ? 'run' : 'walk'] = 1; } else cc.walk = cc.run = 0; };
      const free = (cc) => { cc.anchor = null; cc.feetY = null; cc.sit = 0; cc.lie = 0; cc.swim = 0; cc.climbed = null; };
      if (e.kind === 'gesture') continue;
      if (e.kind === 'animal' && e.animal === 'birds') { const a = A.birds; if (a && e.act === 'fly') { a.fly = { t0: e.t0, t1: e.t1 }; } continue; }
      if (e.kind === 'animal') { const a = A[e.animal]; if (!a) continue; const side = (x) => (x < 0.5 ? -0.15 : 1.15); const on = !done;
        if (e.act === 'enter') { a.visible = true; const x0 = side(a.home.x); a.x = lerp(x0, a.home.x, k); a.face = a.home.x > x0 ? 1 : -1; a.move = on ? 1 : 0; }
        else if (e.act === 'exit' || e.act === 'run') { const x0 = a.x, x1 = e.act === 'run' ? (a.face > 0 ? 1.2 : -0.2) : side(x0); a.x = lerp(x0, x1, k); a.face = x1 > x0 ? 1 : -1; a.move = on ? 1 : 0; a.run = e.act === 'run' && on ? 1 : 0; if (done) a.visible = false; }
        else if (e.act === 'follow' && C[e.target]) { const tc = C[e.target]; a.visible = true; const x0 = a.x, x1 = tc.x + (x0 < tc.x ? -0.09 : 0.09); a.x = lerp(x0, x1, sm(0, 1, k)); a.row = tc.row + 0.05; a.face = x1 > x0 ? 1 : -1; a.move = on ? 1 : 0; }
        else if (on) { a.visible = true; a.act = e.act === 'jump' || e.act === 'chatter' ? 'jump' : ['bark', 'moo', 'neigh', 'bleat', 'meow', 'trumpet', 'roar'].includes(e.act) ? 'bark' : e.act === 'sit' ? 'sit' : null; a.head = e.act === 'graze' ? 'down' : ['moo', 'neigh', 'trumpet', 'bleat'].includes(e.act) ? 'up' : null; }
        else if (e.act === 'sit') a.act = 'sit';
        continue; }
      if (e.kind === 'fly_by') { const v = V[e.vehicle]; if (v) { v.visible = t < e.t1; v.fly = { k }; v.spin = k * 40; v.bob = 1; } continue; }
      if (e.kind === 'holi') { FX.holi = { k: sm(e.t0, e.t0 + 3, t), t0: e.t0 }; continue; }
      if (e.kind === 'diwali') { FX.diwali = { k: sm(e.t0, e.t0 + 1.5, t), lights: e.lights !== false, fireworks: e.fireworks !== false, diyas: e.diyas !== false }; continue; }
      if (e.kind === 'cracker') { FX.crackers = [...(FX.crackers || []), { x: { left: 0.25, center: 0.5, right: 0.75 }[e.where] ?? 0.62, type: e.type || 'anaar', dt: t - e.t0, d: e.t1 - e.t0 }]; if (e.type === 'bomb' && t - e.t0 > 1 && t - e.t0 < 1.5) shake = 0.8; continue; }
      if (e.kind === 'fire') { const tc = e.target && C[e.target]; FX.fires.push({ x: tc ? tc.x + 0.13 : e.x ?? 0.72, row: tc ? tc.row + 0.1 : 0.35, k: sm(e.t0, e.t0 + 1.2, t), size: e.size || 1 }); continue; }
      if (e.kind === 'fire_out') { for (const f of FX.fires) f.k *= 1 - sm(e.t0, e.t1, t); continue; }
      if (e.kind === 'explosion') { const tc = e.target && C[e.target]; const x = tc ? tc.x + 0.18 : e.x ?? 0.65; FX.booms.push({ x, row: 0.45, dt: t - e.t0 }); if (t - e.t0 < 1.2) shake = 1.6;
        for (const c2 of Object.values(C)) if (c2.visible && Math.abs(c2.x - x) < 0.35 && t - e.t0 < 2.2) c2._g = { name: 'shock', k: sm(e.t0, e.t0 + 0.2, t) * (1 - sm(e.t0 + 1.8, e.t0 + 2.2, t)) };
        if (!e.small) FX.fires.push({ x, row: 0.5, k: sm(e.t0 + 0.3, e.t0 + 1.5, t) * 0.9, size: 1.3 }); continue; }
      if (e.kind === 'crowd') { crowd = { mood: e.mood === 'none' ? null : e.mood || 'watch', count: Math.min(extras.length, e.count || 8) }; continue; }
      if (e.kind === 'baraat') { const v = V[e.vehicle]; const until = e._until ?? e.t1; const active = t < until; const tt = Math.min(t, until);
        if (v) { v.visible = true; v.row = 0.55; v.x = 0.6 + 0.02 * Math.sin((tt - e.t0) * 0.6); v.spin = (tt - e.t0) * 1.1; v.bob = active ? 1 : 0; }
        (e.with || []).filter((id) => C[id]).forEach((id, i, arr) => { const cc = C[id]; cc.visible = true; cc.inV = null; cc.anchor = null; cc.feetY = null; cc.row = 0; cc.x = arr.length === 1 ? 0.3 : 0.14 + (0.32 * i) / (arr.length - 1); if (active) cc._g = { name: 'dance', k: 1 }; });
        crowd = { mood: active ? 'dance' : 'watch', count: Math.max(crowd.count, Math.min(extras.length, 10)) }; scroll += (tt - e.t0) * 0.05; baraat = { groom: e.char, active }; continue; }
      if (!c && !['drive_away'].includes(e.kind)) continue;
      switch (e.kind) {
        case 'enter': c.visible = true; free(c); go(c, side(c.home.x), c.home.x, false); break;
        case 'exit': case 'run_exit': { const x0 = c.x, fy = c.feetY; free(c); c.feetY = fy; go(c, x0, side(x0), e.kind === 'run_exit'); if (done) c.visible = false; break; }
        case 'walk_to': { const tc = e.target && C[e.target]; const x0 = c.x; const x1 = tc ? tc.x + (x0 < tc.x ? -0.11 : 0.11) : c.home.x; free(c); c.row = tc ? tc.row : c.home.row; go(c, x0, x1, false); if (done && tc) c.face = tc.x > c.x ? 1 : -1; break; }
        case 'go_to': { const m = p.ms.find((x) => x.type === e.place) || p.ms.find((x) => x.type === 'seat'); if (!m) break; const x0 = c.x, y0 = feet(c); c.anchor = null; c.lie = 0;
          const kw = sm(0, 0.75, k); c.x = lerp(x0, m.x, kw); c.feetY = lerp(y0, m.y, kw); if (kw < 1 && Math.abs(m.x - x0) > 0.005) { c.face = m.x > x0 ? 1 : -1; c.walk = 1; } else c.walk = 0;
          c.sit = SIT_TYPES.has(m.type) ? sm(0.75, 1, k) : 0; c.lie = m.type === 'bed' ? sm(0.75, 1, k) : 0; if (done) c.anchor = m; break; }
        case 'sit': { const s = p.ms.find((x) => x.type === 'seat' && !Object.values(C).some((o) => o !== c && o.anchor === x)); if (s) { const x0 = c.x; c.x = lerp(x0, s.x, sm(0, 0.6, k)); c.feetY = s.y; c.sit = sm(0.3, 1, k); if (done) c.anchor = s; } break; }
        case 'stand': if (c.lie > 0) c.lie = 1 - sm(0, 0.8, k); else if (c.sit > 0) c.sit = 1 - sm(0, 0.7, k); if (done) { c.anchor = c.anchor && !SIT_TYPES.has(c.anchor.type) && c.anchor.type !== 'bed' ? c.anchor : null; if (!c.anchor) c.feetY = c.feetY; } break;
        case 'faint': case 'lie': c.lie = sm(0, 0.6, k); c.sit = 0; c.walk = c.run = 0; break;
        case 'drive_in': { const v = V[e.vehicle]; if (!v) break; v.visible = true; const mv = vehicles[e.vehicle]; if (mv.air) v.alt = 0.55 * (1 - sm(0.45, 1, k)); v.row = PARK.row; const s0 = vScale(v); if (mv.type === 'train') v.park = 0.5 - (mv.doors[0] * s0) / AR; const xs = -(mv.front * s0) / AR - 0.05; const kk = 1 - (1 - k) * (1 - k); v.x = lerp(xs, v.park, kk); v.spin += (v.x - xs) * AR / s0; v.siren = vehicles[e.vehicle].lights.length > 0 && !done; v.bob = done ? 0 : 1; break; }
        case 'drive_away': { const v = V[e.vehicle]; if (!v) break; const x0 = v.x; const air = vehicles[e.vehicle].air; if (air) v.alt = 0.7 * sm(0, 0.6, k); v.x = lerp(x0, 1.05 + (vehicles[e.vehicle].rear * vScale(v)) / AR, air ? sm(0.3, 1, k) ** 2 : k * k); v.spin += (v.x - x0) * AR / vScale(v); v.siren = vehicles[e.vehicle].lights.length > 0; v.bob = 1; if (done) v.visible = false; break; }
        case 'get_in': { const v = V[e.vehicle]; if (!v) break;
          if (!v.visible || v.x < 0.05) { if (!v._back) v._back = { x0: v.visible ? v.x : -0.8 }; v.visible = true; v.row = 0.9; const tx = Math.min(0.85, Math.max(0.35, c.x + 0.12)); const kk = sm(0, 0.35, k); v.x = lerp(v._back.x0, tx, 1 - (1 - kk) * (1 - kk)); v.spin += (v.x - v._back.x0) * AR / vScale(v); v.siren = kk < 1 && vehicles[e.vehicle].lights.length > 0; v.bob = kk < 1 ? 1 : 0; } const seat = Object.values(C).filter((o) => o.inV && o.inV.key === e.vehicle).length; const dx = doorX(e.vehicle, seat); const x0 = c.x, y0 = feet(c);
          free(c); const kw = sm(0, 0.5, k); c.x = lerp(x0, dx, kw); c.feetY = lerp(y0, vFeet(v) + 0.025, kw); if (kw < 1) { c.face = dx > x0 ? 1 : -1; c.walk = 1; } else c.walk = 0;
          v.door = Math.max(v.door, sm(0.45, 0.6, k) * (1 - sm(0.85, 1, k))); if (k > 0.62) { c.inV = { key: e.vehicle, seat }; c.inK = sm(0.62, 0.85, k); } break; }
        case 'get_out': { const v = V[e.vehicle] || (c.inV && V[c.inV.key]); if (!v || !c.inV) break; const kk = c.inV.key; const seat = c.inV.seat; const dx = doorX(kk, seat);
          v.door = Math.max(v.door, sm(0, 0.15, k) * (1 - sm(0.6, 0.8, k))); c.visible = true; c.inK = 1 - sm(0.15, 0.45, k); if (k >= 0.45) { c.inV = null; c.x = lerp(dx, dx - 0.1, sm(0.45, 1, k)); c.feetY = lerp(vFeet(v) + 0.025, vFeet(v) + 0.06, sm(0.45, 1, k)); c.face = -1; c.walk = k < 1 ? 1 : 0; } else { c.x = dx; } break; }
        case 'car_chase': { const r = V[e.vehicle], q = e.chaser && V[e.chaser]; const active = t < until; const tt = Math.min(t, until);
          for (const [v, base, amp, ph] of [[r, 0.7, 0.04, 0], [q, 0.27, 0.05, 1.7]]) { if (!v) continue; v.visible = true; v.row = 1; v.x = base + amp * Math.sin((tt - e.t0) * 0.9 + ph); v.spin = (tt - e.t0) * 14 / vScale(v); v.bob = active ? 1 : 0; }
          if (q) q.siren = vehicles[e.chaser].lights.length > 0; if (r && !active) r.siren = false;
          for (const id of Object.keys(C)) if (!C[id].inV && !p.involved.has(id)) C[id].visible = false;
          if (active) { chasing = { kind: 'car', runner: e.vehicle, chaser: e.chaser }; shake = 1; }
          scroll += (tt - e.t0) * 0.42; break; }
        case 'foot_chase': { const active = t < until; const tt = Math.min(t, until); const ch = [e.char, ...(e.chasers || [])].filter((id) => C[id]);
          ch.forEach((id, i) => { const cc = C[id]; free(cc); cc.inV = null; cc.visible = true; cc.face = 1; cc.run = active ? 1 : 0; cc.walk = 0; cc.row = i === 0 ? 0 : (i % 2) * 0.45; cc.x = i === 0 ? 0.68 + 0.04 * Math.sin((tt - e.t0) * 1.1) : 0.36 - 0.1 * (i - 1) + 0.05 * Math.sin((tt - e.t0) * 0.8 + i); });
          for (const id of Object.keys(C)) if (!ch.includes(id) && !C[id].inV) C[id].visible = false;
          if (active) chasing = { kind: 'foot', runner: e.char }; scroll += (tt - e.t0) * 0.22; for (const v of Object.values(V)) { v.x -= (tt - e.t0) * 0.22; v.siren = false; v.bob = 0; if (v.x < -0.8) v.visible = false; } break; }
        case 'catch': { const tc = C[e.target]; if (!tc) break; const x0 = c.x; free(c); c.row = tc.row; const x1 = tc.x - (x0 < tc.x ? 0.1 : -0.1); const kw = sm(0, 0.55, k); c.x = lerp(x0, x1, kw); c.run = kw < 1 ? 1 : 0; c.walk = 0; c.face = x1 >= x0 ? 1 : -1;
          tc.run = 0; tc.walk = 0; if (k > 0.5) { c.grab = e.target; tc.struggle = 1 - sm(0.9, 1, k) * 0.5; c.face = tc.x > c.x ? 1 : -1; tc.face = -c.face; } break; }
        case 'handcuff': { const tc = C[e.target]; if (!tc) break; const g = Object.values(C).find((o) => o !== c && o.grab === e.target);
          for (const o of Object.values(C)) if (o.grab === e.target && k > 0.25) { o.grab = null; if (o !== c) { o.x += (o.x < tc.x ? -0.04 : 0.04) * sm(0.25, 0.4, k); } } const sideX = g ? (g.x < tc.x ? 1 : -1) : (c.x < tc.x ? -1 : 1); const x0 = c.x, x1 = tc.x + sideX * 0.1;
          if (Math.abs(x1 - x0) > 0.01) { free(c); c.row = tc.row; const kw = sm(0, 0.3, k); c.x = lerp(x0, x1, kw); c.walk = kw < 1 ? 1 : 0; } c.grab = null; c.face = tc.x > c.x ? 1 : -1; tc.struggle = 0.4 * (1 - sm(0.4, 0.6, k)); if (k >= 0.5) tc.cuffed = true; c._cuff = k > 0.3 && !done; break; }
        case 'hug': case 'fight': case 'push': case 'slap': case 'give': { const tc = C[e.target]; if (!tc) break; const x0 = c.x; free(c); c.row = tc.row; const gap = e.kind === 'hug' ? 0.06 : e.kind === 'fight' ? 0.09 : 0.085;
          const x1 = tc.x + (x0 < tc.x ? -gap : gap); const kw = sm(0, 0.35, k); c.x = lerp(x0, x1, kw); c.walk = kw < 1 && Math.abs(x1 - x0) > 0.01 ? 1 : 0; if (kw >= 1) { c.face = tc.x > c.x ? 1 : -1; tc.face = -c.face; }
          const act = k > 0.35 && !done; const kk = sm(0.35, 0.45, k) * (1 - sm(0.92, 1, k));
          if (e.kind === 'hug' && act) { c._g = { name: 'hug', k: kk }; tc._g = { name: 'hug', k: kk }; tc.walk = tc.run = 0; }
          if (e.kind === 'fight' && act) { c._g = { name: 'punch', k: kk }; tc._g = { name: Math.floor(t * 3) % 2 ? 'punch' : 'hit_back', k: kk }; c.struggle = 0.3; tc.struggle = 0.5; shake = 0.6; }
          if (e.kind === 'push') { if (act) c._g = { name: 'push', k: kk }; if (k > 0.5) { tc.x += (tc.x > c.x ? 1 : -1) * 0.09 * sm(0.5, 0.75, k); tc.struggle = done ? 0 : 0.6; } }
          if (e.kind === 'slap' && act) { c._g = { name: 'slap', k: kk }; if (k > 0.6) tc._g = { name: 'hit_back', k: sm(0.6, 0.7, k) * (1 - sm(0.9, 1, k)) }; }
          if (e.kind === 'give' && act) { const handoff = k > 0.7; c._g = { name: 'give', k: kk, item: handoff ? null : e.item || 'give' }; tc._g = { name: 'receive', k: sm(0.5, 0.6, k) * (1 - sm(0.92, 1, k)), item: handoff ? e.item || 'give' : null }; }
          break; }
        case 'swim': { const x0 = c.x; free(c); c.visible = true; c.swim = 1; const dir = x0 < 0.5 ? 1 : -1; const until = e._until ?? e.t1; const tt = Math.min(t, until); c.x = x0 + dir * Math.min(0.6, (tt - e.t0) * 0.06); c.face = dir; c.row = 0.85; FX.splash.push({ id: e.char }); break; }
        case 'climb': { const m = p.ms.find((x) => x.type === 'climb'); const x0 = c.x, y0 = feet(c); const tx = m ? m.x : x0; const top = m ? m.y : y0 - heightAt(b, y0) * 0.75; free(c);
          const kw = sm(0, 0.25, k); c.x = lerp(x0, tx, kw); c.walk = kw < 1 && Math.abs(tx - x0) > 0.01 ? 1 : 0; c.feetY = lerp(y0, top, sm(0.25, 1, k)); if (k > 0.25 && !done) c._g = { name: 'climb', k: 1 }; c.climbed = { x: tx, ground: y0, top, ladder: !m }; if (done) c.face = tx < 0.5 ? 1 : -1; break; }
        case 'climb_down': { const cl = c.climbed; if (!cl) break; c.feetY = lerp(cl.top, cl.ground, sm(0, 0.85, k)); if (!done) c._g = { name: 'climb', k: 1 }; if (done) { c.climbed = null; c.feetY = null; } else c.climbed = cl; break; }
        case 'game': { const until = e._until ?? e.t1; const active = t < until; const kids = [e.char, ...(e.with || [])].filter((id) => C[id]); kids.forEach((id) => { const cc = C[id]; free(cc); cc.inV = null; cc.visible = true; cc.row = 0; });
          FX.game = { game: e.game, kids, t0: e.t0, active, until };
          const P0 = (i, x, face, row = 0) => { const cc = C[kids[i]]; if (!cc) return; cc.x = x; cc.face = face; cc.row = row; };
          if (e.game === 'cricket') { P0(0, 0.7, -1); P0(1, 0.26, 1); kids.slice(2).forEach((id, i) => P0(i + 2, 0.42 + i * 0.12, -1, 0.7)); const ph = ((t - e.t0) % 3.2) / 3.2;
            if (active) { C[kids[0]]._g = { name: 'bat', k: 1, ph }; if (kids[1]) { C[kids[1]]._g = { name: 'bowl', k: 1, ph }; C[kids[1]].walk = ph < 0.3 ? 1 : 0; C[kids[1]].x = 0.2 + Math.min(0.3, ph) * 0.25; } kids.slice(2).forEach((id) => { C[id]._g = { name: ph > 0.65 && ph < 0.95 ? 'clap' : 'look_around', k: 1 }; }); } }
          else if (e.game === 'football') { P0(0, 0.22, 1); P0(1, 0.58, -1); kids.slice(2).forEach((id, i) => P0(i + 2, 0.4 + i * 0.16, -1, 0.65)); const ph = ((t - e.t0) % 2.4) / 2.4; const a = Math.floor((t - e.t0) / 2.4) % 2 === 0;
            const cyc = Math.floor((t - e.t0) / 2.4), shotCyc = Math.max(1, Math.floor(((e._until ?? e.t1) - e.t0) / 2.4) - 1); const goalNow = cyc > shotCyc || (cyc === shotCyc && ph > 0.85); if (cyc === shotCyc) { const sh = a ? kids[0] : kids[1]; if (C[sh]) C[sh].face = 1; } if (active && goalNow) kids.forEach((id) => { if (C[id]) C[id]._g = { name: 'hands_up', k: 1 }; });
            if (active && !goalNow) { const kk = a ? kids[0] : kids[1]; if (C[kk]) C[kk]._g = { name: 'kick', k: 1, ph }; const ot = a ? kids[1] : kids[0]; if (C[ot]) C[ot].walk = ph > 0.5 ? 1 : 0; kids.slice(2).forEach((id) => { C[id].run = 1; C[id].x += Math.sin(t * 1.3) * 0.05; }); } }
          else if (e.game === 'kabaddi') { const ph = ((t - e.t0) % 6) / 6; const rx = ph < 0.35 ? lerp(0.25, 0.6, ph / 0.35) : ph < 0.45 ? 0.6 : ph < 0.75 ? lerp(0.6, 0.25, (ph - 0.45) / 0.3) : 0.25;
            P0(0, rx, ph < 0.45 ? 1 : -1); if (active && C[kids[0]]) { C[kids[0]].run = ph < 0.35 || (ph > 0.45 && ph < 0.75) ? 1 : 0; C[kids[0]]._g = { name: 'raid', k: 1 }; }
            kids.slice(1).forEach((id, i) => { const base = 0.68 + (i % 3) * 0.09; const chase = ph > 0.4 && ph < 0.7 ? -0.08 * Math.sin(((ph - 0.4) / 0.3) * Math.PI) : 0; P0(i + 1, base + chase, -1, (i % 2) * 0.4); if (active) C[id]._g = { name: ph > 0.35 && ph < 0.5 ? 'grab' : 'catch', k: 1 }; }); }
          else if (e.game === 'ball') { P0(0, 0.3, 1); P0(1, 0.66, -1); kids.slice(2).forEach((id, i) => P0(i + 2, 0.48, 1, 0.7)); const ph = ((t - e.t0) % 2.8) / 2.8; if (active) { const a = ph < 0.5; C[kids[0]]._g = { name: a ? 'throw' : 'catch', k: 1, ph: a ? ph * 2 : 0 }; if (kids[1]) C[kids[1]]._g = { name: a ? 'catch' : 'throw', k: 1, ph: a ? 0 : (ph - 0.5) * 2 }; } }
          else if (e.game === 'skip') { P0(0, 0.5, 1); kids.slice(1).forEach((id, i) => P0(i + 1, 0.25 + i * 0.5, i ? -1 : 1, 0.3)); if (active) { C[kids[0]]._g = { name: 'skip', k: 1 }; C[kids[0]].jump = Math.abs(Math.sin((t - e.t0) * Math.PI * 1.5)); kids.slice(1).forEach((id) => { C[id]._g = { name: 'clap', k: 1 }; }); } }
          else if (e.game === 'kite') { P0(0, 0.3, 1); kids.slice(1).forEach((id, i) => P0(i + 1, 0.55 + i * 0.13, -1, (i % 2) * 0.4)); if (active) { C[kids[0]]._g = { name: 'kite', k: 1 }; kids.slice(1).forEach((id) => { C[id]._g = { name: 'point', k: 1 }; }); } }
          else { const n = kids.length; kids.forEach((id, i) => { const cc = C[id]; const a = (t - e.t0) * 1.1 + (i * Math.PI * 2) / n - (i === 0 ? 0.5 : 0); cc.x = 0.5 + Math.cos(a) * 0.3; cc.row = 0.35 + Math.sin(a) * 0.35; cc.face = -Math.sin(a) > 0 ? 1 : -1; cc.run = active ? 1 : 0; cc._g = active ? { name: 'laugh', k: 1 } : null; }); }
          break; }
        case 'birthday': { const until = e._until ?? e.t1; const D = Math.max(4, until - e.t0); const q = Math.min(1, (t - e.t0) / D); const active = t < until;
          free(c); c.visible = true; c.x = 0.5; c.row = 0.5; c.face = 1; c.frontal = true;
          const others = Object.entries(C).filter(([id, o]) => id !== e.char && o.visible && !o.inV); others.forEach(([id, o], i) => { free(o); const side = i % 2 ? 1 : -1; const r = Math.floor(i / 2); o.x = 0.5 + side * (0.19 + r * 0.12); o.row = 0.32 + r * 0.25; o.face = side > 0 ? -1 : 1; });
          const phase = q < 0.42 ? 'song' : q < 0.55 ? 'blow' : q < 0.76 ? 'cut' : 'feed'; FX.birthday = { char: e.char, active, phase, q, blown: q >= 0.52, cut: q >= 0.66, t0: e.t0, feedTo: others[0]?.[0] };
          if (active) { c._g = phase === 'blow' ? { name: 'blow', k: 1 } : phase === 'cut' ? { name: 'cut', k: 1 } : phase === 'feed' ? { name: 'give', k: 1 } : { name: 'laugh', k: 1 };
            others.forEach(([id, o], i) => { o._g = phase === 'feed' && i === 0 ? { name: 'receive', k: 1 } : { name: 'clap', k: 1 }; }); if (phase === 'feed' && others[0]) { others[0][1].x = 0.62; others[0][1].row = 0.45; others[0][1].face = -1; } }
          break; }
        case 'sleep': c.lie = sm(0, 0.6, k); c.sit = 0; c.walk = c.run = 0; c.sleeping = true; break;
        default: break;
      }
    }
    // keep people apart (except those touching on purpose)
    { const TOUCH = new Set(['hug', 'punch', 'hit_back', 'grab', 'cuff', 'give', 'receive', 'push', 'slap']); const touching = new Set(Object.entries(C).filter(([, c]) => c.grab || c._cuff || (c._g && TOUCH.has(c._g.name))).map(([id]) => id));
      const L = Object.entries(C).filter(([, c]) => c.visible && !c.inV && !c.lie && !c.swim && !c.climbed && !(c.anchor && SIT_TYPES.has(c.anchor.type)));
      for (let it = 0; it < 5; it++) for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const [ia, A1] = L[i], [ib, B1] = L[j]; if (touching.has(ia) && touching.has(ib)) continue;
        const fa = feet(A1), fb = feet(B1); if (Math.abs(fa - fb) > 0.3) continue; const gap = (0.42 * Math.max(heightAt(b, fa), heightAt(b, fb))) / AR; const dx = B1.x - A1.x; if (Math.abs(dx) >= gap) continue;
        const push = (gap - Math.abs(dx)) / 2; const sgn = dx === 0 ? (ia < ib ? 1 : -1) : Math.sign(dx); const am = A1.anchor ? 0 : 1, bm = B1.anchor ? 0 : 1; const tot = Math.max(1, am + bm);
        A1.x = Math.max(0.04, Math.min(0.96, A1.x - sgn * push * 2 * (am / tot))); B1.x = Math.max(0.04, Math.min(0.96, B1.x + sgn * push * 2 * (bm / tot))); } }
    return { C, V, A, FX, scroll, chasing, shake, crowd, baraat };
  }
  const TINT = { day: [0xffffff, 1.6, 1.3], morning: [0xfff1dc, 1.5, 1.2], evening: [0xffd2a0, 1.3, 1.0], night: [0x9fb2ff, 0.85, 0.55] };

  // outline switches set on meshes → copy onto their materials (OutlineEffect reads the material)
  scene.traverse((o) => { if (o.isMesh && o.userData.outlineParameters) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => (m.userData.outlineParameters = o.userData.outlineParameters)); });
  function renderAt(t) {
    const sc = sceneAt(t); const p = planOf(sc); const b = p.b; const tex = bgTex[sc.background] || null; if (bgMat.map !== tex) { bgMat.map = tex; bgMat.needsUpdate = true; }
    const S = stateAt(sc, t);
    if (tex) { const f = fit[sc.background]; tex.offset.x = f.ox + S.scroll * f.rx; }
    for (const [id, g] of Object.entries(coverGroups)) g.visible = id === sc.background;
    const tint = TINT[sc.time_of_day] || TINT.day; hemi.color.set(tint[0]); hemi.intensity = tint[1]; key.color.set(tint[0]); key.intensity = tint[2];
    const line = lineAt(t);
    // vehicles
    for (const [k, m] of Object.entries(vehicles)) { const v = S.V[k]; m.group.visible = !!(v && v.visible); if (!m.group.visible) continue;
      m.group.rotation.x = 0; m.group.rotation.y = 0; const fy = rowY(b, v.row); const s = (heightAt(b, fy) / 1.7) * VSCALE; m.group.scale.setScalar(s); m.group.position.set(v.x * AR, 1 - fy + (v.alt || 0) + (m.floatY || 0) * s + (v.bob && !m.floatY && !m.air ? Math.abs(Math.sin(t * 17 + k.length)) * 0.004 : 0), zOf(fy) - 0.4); if (v.fly) { const ss = s * 0.22; m.group.scale.setScalar(ss); m.group.position.set(-0.4 * AR + v.fly.k * 2.0 * AR, 0.74 + Math.sin(v.fly.k * 3) * 0.02, 4); } m.set(t, { spin: v.spin, door: v.door, siren: v.siren, moving: v.bob ? 1 : 0 }); }
    // characters
    for (const id of Object.keys(actors)) holders[id].h.visible = false;
    const st = S.C; const vis = [];
    for (const [id, c] of Object.entries(st)) {
      const { h, pivot, sh, clip } = holders[id]; const a = actors[id]; clip.constant = 1e5;
      let show = c.visible; let px, py, pz, sc_;
      if (c.inV && S.V[c.inV.key]) { const v = S.V[c.inV.key], m = vehicles[c.inV.key]; show = v.visible && (c.visible || c.inK > 0 || true); const fy = rowY(b, v.row); const s = (heightAt(b, fy) / 1.7) * VSCALE; const seat = m.seats[Math.min(c.inV.seat, m.seats.length - 1)];
        const dX = v.x * AR + (c.inK < 1 ? (doorWorld(m, c.inV.seat) * (1 - c.inK) + seat[0] * c.inK) : seat[0]) * s; px = dX; py = 1 - fy + (seat[1] - 0.5) * s * c.inK + (v.bob ? Math.abs(Math.sin(t * 17)) * 0.004 : 0); pz = zOf(fy) - 0.4 + lerp(1.1, -0.05, c.inK) * s; sc_ = s; c.face = 1; c.sit = c.inK; c.walk = 0; sh.visible = false;
        if (c.inK > 0.98) c.visible = true; if (v.alt) py += v.alt; if (v.fly) show = false;
        if (m.sitPose) { py = 1 - fy + (m.floatY || 0) * s + (seat[1] - 0.5) * s * c.inK; pz = zOf(fy) - 0.4 + lerp(0.6, 0, c.inK) * s; c.sit = c.inK; c.ride = 0; if (v.bob && c.inV.seat === 0) c._g = { name: 'row', k: 1 }; clip.constant = -(1 - fy + (m.floatY || 0) * s + 0.12 * s); }
        else if (m.open) { // riders sit on top: no clipping; hips on the seat, ride pose
          const hip = a.hipY * (s * 1.7 * (a.height / 1.7) / a.height) * 0.94; py = 1 - fy + lerp(0, seat[1] * s - hip, c.inK) + (v.bob ? Math.abs(Math.sin(t * 17)) * 0.004 : 0); pz = zOf(fy) - 0.4 + lerp(0.6, 0.05, c.inK) * s; c.sit = 0; c.ride = c.inK; c.pillion = c.inV.seat > 0; c.rideType = m.type;
        } else clip.constant = -(1 - fy + (v.alt || 0) + (m.floor ?? 0.36) * s); }
      else { const fy = c.feetY ?? rowY(b, c.row); sc_ = c.anchor && c.anchor.type === 'bed' ? ((c.anchor.w || 0.3) * AR * 0.8) / 1.7 : heightAt(b, fy) / 1.7; px = c.x * AR; py = 1 - fy; pz = zOf(fy); sh.visible = c.lie < 0.5; }
      if (c.swim && !c.inV) { py -= 0.02 * sc_ * 1.7; clip.constant = -(py + 0.13 * sc_); }
      if (c.jump) py += c.jump * 0.05 * sc_ * 1.7;
      if (!show) continue; h.visible = true; vis.push(id);
      const childK = a.height / 1.7; h.scale.setScalar((sc_ * 1.7 * childK) / a.height); h.position.set(px, py, pz);
      // lying down: roll the body flat, head towards the left
      pivot.rotation.z = c.swim ? -c.face * Math.PI / 2 * 0.92 : c.lie * Math.PI / 2; pivot.position.set(c.swim ? -c.face * 0.8 : c.lie * 0.85, c.swim ? 0.15 : c.lie * 0.12, 0);
    }
    // animals
    for (const [k, m] of Object.entries(animals)) { const a = S.A[k]; m.group.visible = !!(a && a.visible); if (!m.group.visible) continue; const fy = rowY(b, a.row); const sc2 = heightAt(b, fy) / 1.7;
      m.group.scale.setScalar(sc2); m.group.position.set(a.x * AR, 1 - fy, zOf(fy) + 0.05); m.group.rotation.y = a.face > 0 ? -0.3 : Math.PI + 0.3; m.set(t, { phase: t * (a.run ? 12 : 7), moving: a.move, run: a.run, head: a.head, act: a.act }); }
    // crowd people in the back rows (they face the camera)
    extras.forEach((e, i) => { const on = !!S.crowd.mood && i < S.crowd.count; e.group.visible = on; if (!on) return; const n = S.crowd.count; const row = 0.72 + (i % 2) * 0.28; const fy = rowY(b, row);
      const walk = S.crowd.mood === 'walk'; const x = ((i + 0.5) / n) * 0.94 + 0.03 + (walk ? ((t * 0.03) % 1) : 0); const sc2 = heightAt(b, fy) / 1.7;
      e.group.scale.setScalar(sc2); e.group.position.set((((x % 1.1) + 1.1) % 1.1) * AR, 1 - fy, zOf(fy) - 0.2); e.group.rotation.y = walk ? 0 : -Math.PI / 2 + Math.sin(i) * 0.25; e.set(t, S.crowd.mood); });
    // baraat: groom's safa + confetti
    confetti.forEach((m, i) => { m.visible = !!(S.baraat && S.baraat.active); if (!m.visible) return; const y = 1.05 - (((t * (0.09 + (i % 5) * 0.012)) + i * 0.137) % 1.15); m.position.x = ((i * 0.618) % 1) * AR + Math.sin(t * 1.7 + i) * 0.02; m.position.y = y; m.rotation.set(t * 2 + i, t * 3 + i * 0.5, 0); });
    // talk / look / gestures
    let lastLine = null; for (const x of tl.lines) if (x.scene === sc.index && x.start <= t) lastLine = x;
    for (const id of vis) {
      const c = st[id]; const a = actors[id]; const speaking = line && line.char === id;
      const others = vis.filter((x) => x !== id);
      const lookId = c.grab || (line && line.char !== id && vis.includes(line.char) ? line.char : lastLine && lastLine.char !== id && vis.includes(lastLine.char) ? lastLine.char : others[0]);
      if (!c.walk && !c.run && !c.inV && lookId && !c.lie && !c.swim && !c.frontal) c.face = st[lookId].x > c.x ? 1 : -1;
      const frontal = c.frontal ? 0.15 : c.anchor && (c.anchor.type === 'judge' || c.anchor.type === 'desk' || c.anchor.type === 'board') ? 0.4 : 1;
      const yaw = c.swim ? c.face * Math.PI / 2 : c.lie ? Math.PI / 2 : c.inV ? (c.ride ? Math.PI / 2 - 0.35 : 1.3) : c.face * FACE * frontal;
      const pp = { visible: true, pos: V3(0, 0, 0), yaw, lie: c.lie > 0.5, walk: c.lie ? 0 : c.walk, run: c.lie ? 0 : c.run, sit: c.lie ? 0 : c.sit, drop: Math.max(0.2, a.hipY - 0.5), cuffed: c.cuffed, struggle: c.struggle, swim: c.swim, ride: c.ride || 0, pillion: c.pillion, rideType: c.rideType, moving: !!(c.inV && S.V[c.inV.key]?.bob) };
      pp.look = lookId && !c.lie ? headPos(actors[lookId]).clone() : null;
      if (speaking) { const f = Math.floor((t - line.start) * 30); pp.mouth = line.mouth[f] || 0; pp.talk = c.walk || c.run || c.cuffed || c.inV || c.lie ? 0 : 0.5 * sm(line.start, line.start + 0.3, t) * (1 - sm(line.end - 0.3, line.end, t)); pp.emotion = line.emotion; }
      else if (lastLine && lastLine.char === id && t - lastLine.end < 2) pp.emotion = lastLine.emotion;
      const g = sc.events.find((e) => e.kind === 'gesture' && e.char === id && t >= e.t0 && t < e.t1); if (g) pp.gesture = { name: g.name, k: sm(g.t0, g.t0 + 0.3, t) * (1 - sm(g.t1 - 0.3, g.t1, t)) };
      if (c.grab) pp.gesture = { name: 'grab', k: 1 }; if (c._cuff) pp.gesture = { name: 'cuff', k: 1 }; if (c._g && c._g.k > 0) pp.gesture = c._g; if (c.swim && !c.inV) pp.gesture = { name: 'swim', k: 1 }; if (c.sleeping && c.lie > 0.5) pp.emotion = 'sleep';
      poseActor(a, t, pp);
    }
    safa.visible = false; if (S.baraat && vis.includes(S.baraat.groom)) { const hp = headPos(actors[S.baraat.groom]); const hs = holders[S.baraat.groom].h.scale.x; safa.visible = true; safa.position.set(hp.x, hp.y + 0.15 * hs, hp.z + 0.01); safa.scale.setScalar(hs * 1.05); }
    // props + handcuffs
    for (const p_ of Object.values(P)) p_.visible = false;
    for (const id of vis) { const ev = sc.events.find((e) => e.kind === 'gesture' && e.char === id && t >= e.t0 && t < e.t1); const g = st[id]._g?.item ? { name: st[id]._g.item === 'money' ? 'money' : 'give' } : ev; const pr = g && P[g.name]; if (!pr || pr.visible) continue;
      const hp = pr.userData.mid ? handPos(actors[id], 'Left').add(handPos(actors[id])).multiplyScalar(0.5) : handPos(actors[id], pr.userData.hand || 'Right'); const s = holders[id].h.scale.x; pr.visible = true; pr.position.copy(hp); pr.scale.setScalar(s * (actors[id].height / 1.7)); pr.position.z += 0.02;
      if (pr.userData.rot) { pr.rotation.set(0, 0, pr.userData.rot * st[id].face); continue; }
      pr.rotation.set(0, 0, g.name === 'torch' ? (st[id].face > 0 ? -0.35 : Math.PI + 0.35) : 0); if (g.name === 'gavel') pr.rotation.z = 0.6; }
    for (const [id, c] of Object.entries(st)) { if (!c.cuffed && !cuffs[id]) continue; cuffs[id] ||= cuffMesh(); const m = cuffs[id]; m.visible = c.cuffed && vis.includes(id) && !c.inV; if (!m.visible) continue;
      const l = handPos(actors[id], 'Left'), r = handPos(actors[id], 'Right'); m.position.copy(l).add(r).multiplyScalar(0.5); m.position.z += 0.03; m.scale.setScalar(holders[id].h.scale.x * 1.3); m.rotation.set(0, 0, Math.atan2(r.y - l.y, r.x - l.x)); }
    // fire, explosions, splashes
    fires.forEach((f, i) => { const d = S.FX.fires[i]; f.group.visible = !!(d && d.k > 0.01); if (!f.group.visible) return; const fy = rowY(b, d.row); const sc2 = heightAt(b, fy) * 1.2 * d.size; f.group.position.set(d.x * AR, 1 - fy, zOf(fy) + 0.3); f.group.scale.setScalar(sc2); f.set(t + i * 3.1, d.k); });
    booms.forEach((f, i) => { const d = S.FX.booms[i]; f.group.visible = !!d; if (!d) return; const fy = rowY(b, d.row); f.group.position.set(d.x * AR, 1 - fy + 0.1, 46); f.group.scale.setScalar(heightAt(b, fy) * 1.1); f.set(d.dt); });
    splashes.forEach((f, i) => { const d = S.FX.splash[i]; f.group.visible = !!(d && vis.includes(d.id)); if (!f.group.visible) return; const h_ = holders[d.id].h; f.group.position.set(h_.position.x + st[d.id].face * 0.05, h_.position.y + 0.01, h_.position.z + 0.3); f.group.scale.setScalar(h_.scale.x * 3); f.set(t + i); });
    // birds crossing the sky
    { const a = S.A.birds; const fl = a?.fly; birds.group.visible = !!(fl && t >= fl.t0 && t < fl.t1); if (birds.group.visible) { const k = (t - fl.t0) / (fl.t1 - fl.t0); birds.group.position.set(-0.15 + k * (AR + 0.3), 0.82 + Math.sin(k * 3) * 0.03, 47); birds.set(t); } }
    // game props
    for (const p_ of Object.values(GP)) p_.visible = false; kiteLine.obj.visible = false; kite.group.visible = false; charkhi.visible = false;
    for (const [id, c] of Object.entries(st)) if (c.climbed?.ladder && vis.includes(id)) { const L = GP.ladder; L.visible = true; const fy = c.climbed.ground; const s2 = heightAt(b, fy) / 1.7; L.position.set(c.climbed.x * AR, 1 - fy, zOf(fy) - 0.05); L.scale.setScalar(s2); }
    { const G = S.FX.game; if (G && G.active) { const k0 = G.kids[0], k1 = G.kids[1]; const hs = (id) => holders[id].h.scale.x;
        if (G.game === 'cricket' && vis.includes(k0)) { const ph = ((t - G.t0) % 3.2) / 3.2; const bat = GP.bat; bat.visible = true; const hp = handPos(actors[k0]); bat.position.copy(hp); bat.scale.setScalar(hs(k0)); bat.rotation.set(0, 0, st[k0].face > 0 ? -0.4 : 0.4);
          const stp = GP.stumps; stp.visible = true; const h0 = holders[k0].h; stp.position.set(h0.position.x + 0.09 * AR * (st[k0].face > 0 ? -1 : 1) * 0.5, h0.position.y, h0.position.z - 0.1); stp.scale.setScalar(hs(k0));
          const ball = GP.ball; ball.scale.setScalar(hs(k0) * 1.2); const from = k1 && vis.includes(k1) ? handPos(actors[k1]) : hp.clone().add(V3(-0.6, 0.05, 0)); const to = hp.clone().add(V3(0, -0.04, 0));
          if (ph > 0.45 && ph < 0.62) { const q = (ph - 0.45) / 0.17; ball.visible = true; ball.position.lerpVectors(from, to, q); ball.position.y = lerp(from.y, to.y, q) + (q < 0.7 ? 0 : -0.04 * Math.sin(((q - 0.7) / 0.3) * Math.PI)); }
          else if (ph >= 0.62 && ph < 0.95) { const q = (ph - 0.62) / 0.33; ball.visible = true; ball.position.set(to.x - st[k0].face * q * 0.9, to.y + q * 0.5 - q * q * 0.1, to.z + 0.1); } }
        if (G.game === 'ball' && k1 && vis.includes(k0) && vis.includes(k1)) { const ph = ((t - G.t0) % 2.8) / 2.8; const a = ph < 0.5; const q = ((ph % 0.5) / 0.5 - 0.3) / 0.6; if (q > 0 && q < 1) { const p0 = handPos(actors[a ? k0 : k1]), p1 = handPos(actors[a ? k1 : k0]); const ball = GP.ball; ball.visible = true; ball.scale.setScalar(hs(k0) * 2); ball.position.lerpVectors(p0, p1, q); ball.position.y += Math.sin(q * Math.PI) * 0.12; ball.position.z += 0.1; } }
        if (G.game === 'skip' && vis.includes(k0)) { const rope = GP.rope; rope.visible = true; const h0 = holders[k0].h; rope.position.set(h0.position.x, h0.position.y + 0.85 * hs(k0) + (st[k0].jump || 0) * 0.05 * hs(k0) * 1.7, h0.position.z); rope.scale.set(hs(k0) * 0.55, hs(k0), hs(k0)); rope.rotation.set(0, (t - G.t0) * Math.PI * 3, 0); }
        if (G.game === 'kite' && vis.includes(k0)) { const hp = handPos(actors[k0]); const kp = V3(Math.min(AR - 0.1, hp.x + 0.75 + Math.sin(t * 0.7) * 0.06), 0.84 + Math.sin(t * 1.1) * 0.035, 45); kite.group.visible = true; kite.group.position.copy(kp); kite.group.scale.setScalar(0.075); kite.set(t); kiteLine.obj.visible = true; kiteLine.set(V3(hp.x, hp.y, 0), V3(kp.x, kp.y - 0.04, 0), 0.06);
          const lh = handPos(actors[k0], 'Left'); charkhi.visible = true; charkhi.position.set(lh.x, lh.y, lh.z + 0.02); charkhi.scale.setScalar(holders[k0].h.scale.x); } } }
    // umbrellas (gesture "umbrella", or everyone outdoors when told by a "umbrella" event)
    for (const [id, u] of Object.entries(umbrellas)) u.visible = false;
    for (const id of vis) { const ev = sc.events.find((e) => e.kind === 'gesture' && e.name === 'umbrella' && e.char === id && t >= e.t0 && t < e.t1); if (!ev) continue; const u = umbrellaFor(id); u.visible = true; const hp = handPos(actors[id]); u.position.set(hp.x, hp.y - 0.02 * holders[id].h.scale.x, hp.z + 0.05); u.scale.setScalar(holders[id].h.scale.x); u.rotation.set(0, 0, -st[id].face * 0.12); }
    // Holi: everyone gets colour (emissive tint), gulal clouds around people, pichkari spray
    { const H_ = S.FX.holi; const cols = [0xff3d8b, 0x2ecc71, 0xffd400, 0x3b82f6, 0xa855f7, 0xff7a00]; let i = 0;
      for (const [id, a] of Object.entries(actors)) { const k = H_ && vis.includes(id) ? H_.k * 0.18 : 0; const col = new THREE.Color(cols[i++ % cols.length]); a.o.traverse((m) => { if (m.isMesh) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => { if (x.emissive) { x.emissive.copy(col); x.emissiveIntensity = k; } }); }); }
      powder.group.visible = !!H_; if (H_) powder.set(t, AR, vis.map((id) => ({ x: holders[id].h.position.x, y: holders[id].h.position.y + 0.95 * holders[id].h.scale.x * 1.7 })));
      FP.pichkari.visible = false; spray.obj.visible = false; for (const id of vis) { const ev = sc.events.find((e) => e.kind === 'gesture' && e.name === 'pichkari' && e.char === id && t >= e.t0 && t < e.t1); if (!ev) continue; const hp = handPos(actors[id]); const hs = holders[id].h.scale.x; FP.pichkari.visible = true; FP.pichkari.position.copy(hp); FP.pichkari.scale.setScalar(hs); FP.pichkari.rotation.set(0, 0, st[id].face > 0 ? 0 : Math.PI); spray.obj.visible = true; spray.set(V3(hp.x + st[id].face * 0.36 * hs, hp.y, 45), V3(hp.x + st[id].face * (0.25 + 0.05 * Math.sin(t * 9)), hp.y - 0.08, 45)); break; } }
    // Diwali: diyas along the front, string lights, fireworks; sparklers in hands; crackers on the ground
    { const D = S.FX.diwali; diyas.group.visible = !!(D && D.diyas); lights.group.visible = !!(D && D.lights); fworks.group.visible = !!(D && D.fireworks);
      if (diyas.group.visible) { const fy = b.groundNear - 0.005; diyas.items.forEach((d, i) => { const x = ((i + 0.5) / diyas.items.length) * AR; d.position.set(x, 1 - fy, zOf(fy) + 2); d.scale.setScalar(heightAt(b, fy) * 0.55); }); diyas.set(t); }
      if (lights.group.visible) lights.set(t, AR); if (fworks.group.visible) fworks.set(t, AR);
      let n = 0; for (const sp of sparks) sp.group.visible = false; FP.sparkler.visible = false; FP.diya.visible = false;
      for (const id of vis) { const ev = sc.events.find((e) => e.kind === 'gesture' && (e.name === 'sparkler' || e.name === 'diya') && e.char === id && t >= e.t0 && t < e.t1); if (!ev) continue; const hp = handPos(actors[id]); const hs = holders[id].h.scale.x;
        if (ev.name === 'diya') { FP.diya.visible = true; FP.diya.position.set(hp.x, hp.y + 0.01, hp.z + 0.03); FP.diya.scale.setScalar(hs); continue; }
        if (n < sparks.length) { FP.sparkler.visible = true; FP.sparkler.position.set(hp.x, hp.y, hp.z + 0.02); FP.sparkler.scale.setScalar(hs); FP.sparkler.rotation.z = -st[id].face * 0.7; const sp = sparks[n++]; sp.group.visible = true; sp.group.position.set(hp.x - st[id].face * Math.sin(0.7) * 0.35 * hs + st[id].face * 0.0, hp.y + Math.cos(0.7) * 0.35 * hs, 46); sp.group.scale.setScalar(hs * 1.7); sp.set(t + n); } }
      anaar.group.visible = false; for (const cr of S.FX.crackers || []) { if (cr.dt < 0 || cr.dt > cr.d) continue; const fy = b.groundNear - 0.02; if (cr.type === 'anaar') { anaar.group.visible = true; anaar.group.position.set(cr.x * AR, 1 - fy, 46); anaar.group.scale.setScalar(heightAt(b, fy) * 1.6); anaar.set(t, true); }
        else { const bm = booms[1]; bm.group.visible = cr.dt > 1 && cr.dt < 2.5; if (bm.group.visible) { bm.group.position.set(cr.x * AR, 1 - fy + 0.03, 46); bm.group.scale.setScalar(heightAt(b, fy) * 0.35); bm.set(cr.dt - 1); } } } }
    // birthday: cake in front of the person, balloons, confetti; candles go out at the end
    { const B_ = S.FX.birthday; FP.cake.visible = FP.balloons.visible = FP.table.visible = FP.knife.visible = FP.slice.visible = false; puffs.forEach((p_) => (p_.visible = false));
      if (B_ && vis.includes(B_.char)) { const h_ = holders[B_.char].h; const hs = h_.scale.x; const tfy = rowY(b, 0.22); const ts = heightAt(b, tfy) / 1.7;
        FP.table.visible = true; FP.table.position.set(0.5 * AR, 1 - tfy, zOf(tfy) + 0.5); FP.table.scale.setScalar(ts);
        FP.cake.visible = true; FP.cake.position.set(0.5 * AR, 1 - tfy + 0.8 * ts, zOf(tfy) + 0.6); FP.cake.scale.setScalar(ts * 0.95); FP.cake.rotation.set(0.35, 0, 0);
        for (const cdl of FP.cake.userData.candles) cdl.children[1].visible = !B_.blown;
        if (B_.phase === 'blow' || (B_.blown && B_.q < 0.6)) puffs.forEach((p_, i) => { const life = ((t * 0.8) + i * 0.25) % 1; p_.visible = true; p_.position.set(0.5 * AR + (i - 1.5) * 0.012 * ts * 10 + life * 0.01, 1 - tfy + 1.35 * ts + life * 0.06, zOf(tfy) + 0.7); p_.scale.setScalar(1 + life * 2); p_.material.opacity = 0.5 * (1 - life); });
        if (B_.phase === 'cut') { const ct = Math.max(0, Math.sin(t * 4)); FP.knife.visible = true; FP.knife.position.set(0.5 * AR + 0.06 * ts * 3, 1 - tfy + (1.25 - 0.25 * ct) * ts, zOf(tfy) + 0.9); FP.knife.scale.setScalar(ts * 1.6); FP.knife.rotation.set(0, 0, -1.25); }
        if (B_.cut) { FP.slice.visible = true; const fe = B_.phase === 'feed' ? handPos(actors[B_.char]) : null; if (fe) FP.slice.position.set(fe.x, fe.y + 0.01, fe.z + 0.6); else FP.slice.position.set(0.5 * AR + 0.1 * ts * 3, 1 - tfy + 0.95 * ts, zOf(tfy) + 0.7); FP.slice.scale.setScalar(ts * 1.3); } FP.balloons.visible = true; FP.balloons.position.set(0.12 * AR, 0.82 + Math.sin(t * 1.2) * 0.01, 45); FP.balloons.scale.setScalar(1.6);
        confetti.forEach((m, i) => { m.visible = B_.active && i % 2 === 0; if (!m.visible) return; const y = 1.05 - (((t * (0.08 + (i % 5) * 0.01)) + i * 0.137) % 1.15); m.position.set(((i * 0.618) % 1) * AR, y, 44); m.rotation.set(t * 2 + i, t * 3, 0); }); } }
    // football / kabaddi props
    { const G = S.FX.game; FP.football.visible = FP.goal.visible = FP.line.visible = false;
      if (G && G.game === 'football' && G.active && vis.includes(G.kids[0]) && G.kids[1] && vis.includes(G.kids[1])) { const ph = ((t - G.t0) % 2.4) / 2.4; const a = Math.floor((t - G.t0) / 2.4) % 2 === 0; const h0 = holders[a ? G.kids[0] : G.kids[1]].h, h1_ = holders[a ? G.kids[1] : G.kids[0]].h;
        const kk = a ? G.kids[0] : G.kids[1], rr = a ? G.kids[1] : G.kids[0]; const f0 = footPos(actors[kk]), f1 = footPos(actors[rr]); const dir = Math.sign(h1_.position.x - h0.position.x) || 1; const br = 0.11 * h0.scale.x;
        const cyc = Math.floor((t - G.t0) / 2.4), shotCyc = Math.max(1, Math.floor((G.until - G.t0) / 2.4) - 1); const lastShot = cyc >= shotCyc; const gx = 0.93 * AR; const q = Math.max(0, Math.min(1, (ph - 0.3) / 0.55)); let bx, by;
        if (cyc > shotCyc) { bx = gx - 0.02; by = h0.position.y + br; } else if (ph < 0.3) { bx = f0.x + (lastShot ? 1 : dir) * 0.06 * h0.scale.x * 1.7; by = h0.position.y + br; } else if (lastShot) { bx = lerp(f0.x + 0.06, gx, q); by = h0.position.y + br + Math.sin(q * Math.PI) * 0.12; } else { bx = lerp(f0.x + dir * 0.06 * h0.scale.x * 1.7, f1.x - dir * 0.05 * h0.scale.x * 1.7, q); by = h0.position.y + br; }
        FP.football.visible = true; FP.football.position.set(bx, by, Math.max(h0.position.z, h1_.position.z) + 0.2); FP.football.scale.setScalar(h0.scale.x); FP.football.rotation.z = -q * 14 * dir;
        const gfy = b.groundNear - 0.02; FP.goal.visible = true; FP.goal.position.set(0.95 * AR, 1 - gfy, zOf(gfy) - 0.5); FP.goal.scale.setScalar(heightAt(b, gfy) / 1.7); FP.goal.rotation.y = -0.5; if (lastShot && q > 0.95) FP.goal.children[3].scale.x = 1 + Math.sin(t * 30) * 0.15; }
      if (G && G.game === 'kabaddi') { const fy = b.groundNear - 0.08; FP.line.visible = true; FP.line.position.set(0.5 * AR, 1 - fy, zOf(fy) - 1); FP.line.scale.set(1, (b.groundNear - b.groundFar + 0.1) * 4, 1); } }
    // speed lines
    for (let i = 0; i < speed.length; i++) { const l = speed[i]; l.visible = !!S.chasing; if (!l.visible) continue; const sp = S.chasing.kind === 'car' ? 3.2 : 1.8; const y = 0.15 + ((i * 0.618) % 1) * 0.75; l.position.x = AR + 0.3 - ((t * sp + i * 0.37) % 1) * (AR + 0.6); l.position.y = y; }
    // camera: wide / two-shot / speaker / vehicle / hands (cuts, like TV cartoons)
    let shot = { type: 'wide' }; for (const x of tl.shots) if (t >= x.t0 && t < x.t1) shot = x;
    let zoom = 1 + 0.04 * sm(sc.start, sc.end ?? sc.start + 20, t), cx = AR / 2, cy = 0.5;
    if ((shot.type === 'speaker' || shot.type === 'two') && shot.char && vis.includes(shot.char)) {
      const hp = headPos(actors[shot.char]);
      if (shot.type === 'speaker') { zoom = 1.75; cx = hp.x; cy = hp.y - 0.12; }
      else { const o = vis.filter((x) => x !== shot.char).sort((p_, q) => Math.abs(st[p_].x - st[shot.char].x) - Math.abs(st[q].x - st[shot.char].x))[0]; const ho = o ? headPos(actors[o]) : hp; zoom = 1.35; cx = (hp.x + ho.x) / 2; cy = (hp.y + ho.y) / 2 - 0.15; }
    } else if (shot.type === 'wheels' && vehicles[shot.vehicle]?.group.visible) { const m = vehicles[shot.vehicle]; const s = m.group.scale.x; const wx = (m.wheels[0]?.position.x ?? m.len * 0.3); zoom = 3.4; cx = m.group.position.x + wx * s; cy = m.group.position.y + (m.wheelR || 0.3) * s * 1.6;
    } else if ((shot.type === 'drone' || shot.type === 'front') && S.chasing && S.chasing.kind === 'car') { // special views: swap the road, turn the vehicles
      for (const id of Object.keys(actors)) holders[id].h.visible = false; for (const e_ of extras) e_.group.visible = false; for (const a_ of Object.values(animals)) a_.group.visible = false;
      const keys = [S.chasing.runner, S.chasing.chaser].filter((k) => vehicles[k]);
      if (shot.type === 'drone') { bgMat.map = drone.tx; drone.tx.offset.x = (t * 0.9) % 1; bgMat.needsUpdate = true;
        keys.forEach((k, i) => { const m = vehicles[k]; const v = S.V[k]; m.group.visible = true; const s = 0.06; m.group.scale.setScalar(s); m.group.rotation.set(Math.PI / 2, 0, 0); m.group.position.set((v.x - 0.05) * AR, 0.5 + (i ? -0.08 : 0.08), 40 + i); m.set(t, { spin: v.spin, siren: v.siren, moving: 1 }); });
        for (const k of Object.keys(vehicles)) if (!keys.includes(k)) vehicles[k].group.visible = false; }
      else { drawFront(t); bgMat.map = front.tx; front.tx.offset.x = 0; bgMat.needsUpdate = true; const main = shot.vehicle && vehicles[shot.vehicle] ? shot.vehicle : keys[0];
        keys.forEach((k) => { const m = vehicles[k]; const v = S.V[k]; const isMain = k === main; m.group.visible = true; const s = isMain ? 0.11 : 0.05; m.group.scale.setScalar(s); m.group.rotation.set(0.12, -Math.PI / 2, 0); m.group.position.set(AR / 2 + (isMain ? 0.03 : -0.02) + Math.sin(t * 2) * 0.01, isMain ? 0.06 : 0.36, isMain ? 40 : 30); m.set(t, { spin: v.spin, siren: v.siren, moving: 1 }); });
        for (const k of Object.keys(vehicles)) if (!keys.includes(k)) vehicles[k].group.visible = false; }
      for (const l of speed) l.visible = shot.type === 'front' ? false : l.visible;
      zoom = 1; cx = AR / 2; cy = 0.5;
    } else if (shot.type === 'vehicle' && vehicles[shot.vehicle]?.group.visible) { const m = vehicles[shot.vehicle]; zoom = 1.6; cx = m.group.position.x; cy = m.group.position.y + m.top * m.group.scale.x * 0.55; }
    else if (shot.type === 'hands' && shot.char && vis.includes(shot.char)) { const l = handPos(actors[shot.char], 'Left'), r = handPos(actors[shot.char], 'Right'); zoom = 2.8; cx = (l.x + r.x) / 2; cy = (l.y + r.y) / 2 + 0.02; }
    if (S.shake) { cx += Math.sin(t * 23) * 0.003; cy += Math.sin(t * 31) * 0.003; }
    const hw = AR / 2 / zoom, hh = 0.5 / zoom; cx = Math.min(AR - hw, Math.max(hw, cx)); cy = Math.min(1 - hh, Math.max(hh, cy));
    cam.left = cx - hw; cam.right = cx + hw; cam.top = cy + hh; cam.bottom = cy - hh; cam.updateProjectionMatrix();
    outline.render(scene, cam);
  }
  function doorWorld(m, seat) { if (m.doors) { const sx = m.seats[Math.min(seat, m.seats.length - 1)][0]; return m.doors.reduce((b_, d) => (Math.abs(d - sx) < Math.abs(b_ - sx) ? d : b_), m.doors[0]); } return seat > 0 && m.seats[1] ? m.seats[1][0] : m.doorX; }
  return { renderAt };
}
