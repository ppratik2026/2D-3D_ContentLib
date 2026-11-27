// 2D Cartoon Stage: a painted background image + characters drawn flat (toon shading, black outline) standing on
// the background's ground line, like Indian 2D cartoon story channels. Orthographic camera: x 0..AR, y 0..1 (image space).
// Also: vehicles (drive in / get in / chase), foot chases, catching + handcuffs, place markers (judge, desk, witness box,
// bed, jail cell…) with "cover" patches cut from the background so people stand behind desks and benches.
import * as THREE from 'three';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';
import { loadActorKit, createActor, poseActor, headPos, handPos, footPos } from './actors.js';
import { makeVehicle } from './vehicles.js';
import { createFlatActor, poseFlat, makeFlatCup, makeFlatWallet } from './flat.js';
import { createBeanActor } from './bean.js';
import { loadFonts, makeBubble, makeBattery, makeBigText, makeNote, makeAura, makeDreamCloud, makeDot, makeFlatDog } from './doodle.js';
import { makeAnimal, makeExtra, makeSafa, makeBirds } from './creatures.js';
import { makeKite, makeCurve, makeFestPack, makeFish, makeWeeds } from './effects.js';
import { makeFire, makeExplosion, makeSplash, makeProps, makeLine, makeFireworks, makeDiyas, makeLights, makePowder, makeSpark, makeFestProps } from './effects.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const sm = (a, b, t) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
const lerp = (a, b, k) => a + (b - a) * k;
const poseAny = (a, t, pp) => (a.flat ? poseFlat(a, t, pp) : poseActor(a, t, pp));
const CUP = /coffee|cup|tea|chai|glass|juice/i;
const FACE = 1.05; // yaw for a 3/4 side view
const SIT_TYPES = new Set(['seat', 'desk', 'judge']);
// who goes to which marker at the start of a scene (by the character's role)
const ROLE = [
  ['judge', /judge|magistrate|jaj|nyayadhish|न्याय/i], ['bed', /patient|injured|sick|ghayal|bimar|marij|मरीज़|घायल/i],
  ['cell', /thief|chor|criminal|accused|prisoner|qaidi|kaidi|suspect|culprit|murderer|robber|dacoit|daku|चोर|मुजरिम/i],
  ['witness', /accused|thief|chor|criminal|suspect|witness|gawah|culprit|murderer|robber|चोर|गवाह/i],
  ['board', /teacher|professor|sir$|madam|master|principal|शिक्षक/i],
  ['desk', /inspector|officer|doctor|teacher|principal|boss|manager|clerk|judge|sho|commissioner|dcp|acp|receptionist/i],
  ['counter', /scientist|forensic|lab|chemist|shopkeeper|dukandar|cashier|doctor|pharmacist|receptionist|banker|waiter|barista|chaiwala|cafe owner|bartender/i],
];

export async function createStageEngine({ canvas, width, height, tl, url }) {
  const perf = tl.perf || {}; const AR = width / height;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: perf.aa !== false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(perf.scale || 1); renderer.setSize(width, height, false); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
  renderer.localClippingEnabled = true;
  const outline = new OutlineEffect(renderer, { defaultThickness: tl.flat ? 0.0032 : 0.0012, defaultColor: tl.flat ? [0.086, 0.086, 0.11] : [0.05, 0.04, 0.04] });
  await loadFonts();
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
  bgMat.alphaTest = 0.5; bgMat.transparent = false; // backgrounds with see-through windows (PNG alpha) show the moving view behind
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
      if (m.cover == null || !w || m.type === 'window' || m.type === 'climb') continue;
      const x0 = m.x - w / 2, x1 = m.x + w / 2, y0 = m.cover, y1 = Math.min(1, m.y + (m.type === 'bed' ? 0.2 : 0.04));
      const geo = new THREE.PlaneGeometry((x1 - x0) * AR, y1 - y0); const uv = geo.attributes.uv;
      for (let k = 0; k < uv.count; k++) { const u = uv.getX(k) ? x1 : x0, v = uv.getY(k) ? y0 : y1; uv.setXY(k, f.ox + f.rx * u, f.oy + f.ry * (1 - v)); }
      const p = noOutline(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }))); p.position.set(((x0 + x1) / 2) * AR, 1 - (y0 + y1) / 2, zOf(m.y) + 0.6); g.add(p);
    }
  }

  // actors
  const kit = tl.flat ? null : await loadActorKit(url); const actors = {}; const holders = {};
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }); shadowMat.userData.outlineParameters = { visible: false };
  const roleOf = {};
  for (const ch of tl.story.characters) {
    if (ch.hidden || ch.id === 'narrator') continue;
    roleOf[ch.id] = `${ch.role || ''} ${ch.name || ''}`;
    const cast = (tl.cast && tl.cast[ch.id]) || { file: 'assets/AvatarSample_C.vrm', type: 'vrm' };
    let a; if (tl.bean) a = createBeanActor(scene, ch); else if (tl.flat) a = createFlatActor(scene, ch); else try { a = await createActor(kit, scene, ch, cast, { simpleMat: grad, toon: grad }); } catch (e) { console.warn(e.message); a = await createActor(kit, scene, ch, ch.gender === 'female' ? { file: 'assets/AvatarSample_A.vrm', type: 'vrm' } : { file: 'assets/AvatarSample_C.vrm', type: 'vrm' }, { simpleMat: grad }); }
    const h = new THREE.Group(); scene.add(h); const pivot = new THREE.Group(); h.add(pivot); pivot.add(a.o); const sh = new THREE.Mesh(new THREE.CircleGeometry(0.32, 24), shadowMat); sh.rotation.x = -Math.PI / 2; sh.scale.set(1, 0.45, 1); sh.position.y = 0.01; h.add(sh);
    const clip = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e5); a.o.traverse((m) => { if (m.isMesh) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => { x.clippingPlanes = [clip]; }); });
    if (a.shadow) { const au = makeAura('#ff3a26'); au.scale.set(a.height * 1.25, a.height * 1.5, 1); au.position.set(0, a.height * 0.52, -0.3); au.renderOrder = -1; h.add(au); a.aura = au; } /* inner voice: black figure in a red glow */
    actors[ch.id] = a; holders[ch.id] = { h, pivot, sh, clip }; h.visible = false;
  }
  // vehicles
  const vehicles = {};
  for (const v of tl.vehicles || []) { const m = makeVehicle(v.type, v.color, grad); m.front ??= m.type === 'train' ? 8.1 : m.len / 2; m.rear ??= m.type === 'train' ? 26.2 : m.len / 2; m.group.visible = false; scene.add(m.group); vehicles[v.key] = m; }
  // animals, crowd people, baraat extras
  const animals = {}; for (const a of (tl.animals || []).filter((x) => x.type !== 'birds')) { const m = tl.bean && a.type === 'dog' ? makeFlatDog(['#e3b66a', '#f1ede2', '#9a7452', '#c98a4a'][(a.seed || 1) % 4]) : makeAnimal(a.type, a.seed || 1, { grad }); m.group.visible = false; scene.add(m.group); animals[a.key] = m; }
  const extras = []; for (let i = 0; i < Math.min(14, tl.crowdMax || 0); i++) { const e = tl.flat ? flatExtra(i) : makeExtra(i + 1, grad); e.group.visible = false; scene.add(e.group); extras.push(e); }
  // flat style crowd: the same code-drawn people (they face the camera, dance / cheer / clap / watch / walk)
  function flatExtra(i) { const TOPS = ['#d9534f', '#3f7fbf', '#3f9b5a', '#e67ab4', '#f39c32', '#7a4fb3', '#2f8f8f', '#c0583f', '#5aa5c9']; const fem = i % 2 === 1;
    const ch = { id: 'extra' + i + 'x'.repeat(i % 5), name: '', gender: fem ? 'female' : 'male', age: i % 7 === 3 ? 'old' : i % 6 === 5 ? 'child' : 'adult', role: 'crowd', top_color: TOPS[i % TOPS.length], bottom_color: ['#2f3a4f', '#f2c418', '#5a3a2a', '#e8e0d0'][i % 4] };
    const a = (tl.bean ? createBeanActor : createFlatActor)(new THREE.Group(), ch); const g = new THREE.Group(); a.o.parent?.remove(a.o); g.add(a.o);
    if (tl.bean && a.materials) { const fog = new THREE.Color('#4a4c56'), f = i % 2 ? 0.58 : 0.4; for (const q of a.materials) q.m.color.copy(q.base).lerp(fog, f); } /* people further back are dimmer (depth) */
    return { flat: true, group: g, set(t, mood_) { const mood = mood_ && mood_.mood ? mood_.mood : mood_; const dist = mood_ && mood_.dist != null ? mood_.dist : t * 0.3; const walk = mood === 'walk'; const dir = (mood_ && mood_.dir) || 1; const name = { dance: 'dance', cheer: (i + Math.floor(t * 0.5)) % 3 ? 'wave' : 'clap', clap: 'clap', watch: i % 4 === 0 ? 'point' : '', queue: i % 3 === 1 ? 'scroll_phone' : '' }[mood] || '';
      poseFlat(a, t + i * 0.37, { yaw: walk ? 1.4 * dir : mood === 'queue' ? 1.15 * dir : ((i % 3) - 1) * 0.3, walk: walk ? 1 : 0, walkDist: walk ? dist + i * 0.37 : null, gesture: name ? { name, k: 1, ph: ((t + i * 0.3) * 0.5) % 1 } : null, emotion: mood === 'watch' || mood === 'walk' || mood === 'queue' ? (tl.bean ? 'tired' : 'neutral') : 'happy', mouth: mood === 'cheer' ? Math.abs(Math.sin(t * 6 + i)) * 0.6 : 0 }); } }; }
  const safa = makeSafa(grad); safa.visible = false; scene.add(safa);
  const confetti = []; { const cols = [0xff4d6d, 0xffd166, 0x06d6a0, 0x4cc9f0, 0xf72585, 0xffffff]; for (let i = 0; i < 46; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 0.018), new THREE.MeshBasicMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide, depthTest: false, toneMapped: false })); m.userData.outlineParameters = { visible: false }; m.visible = false; m.position.z = 44; scene.add(m); confetti.push(m); } }
  // cinematic rig (far away from the stage): the speaker faces a perspective camera, the listener's shoulder in front,
  // a blurred copy of the background behind them — over-the-shoulder, close-up and reaction shots like TV serials
  const rigCam = new THREE.PerspectiveCamera(30, AR, 0.05, 80); const RIG = new THREE.Vector3(1000, 0, 0);
  const blurTex = {}; for (const [id, t0] of Object.entries(bgTex)) { const img = t0.image; const cv = document.createElement('canvas'); cv.width = 800; cv.height = 450; const x = cv.getContext('2d'); x.filter = 'blur(10px) saturate(1.08)';
    const ia = img.width / img.height; const sw = ia > AR ? img.height * AR : img.width, sh = ia > AR ? img.height : img.width / AR; x.drawImage(img, (img.width - sw) / 2, (img.height - sh) * 0.35, sw, sh * 0.75, -20, -20, 840, 490); const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; blurTex[id] = tx; }
  const board = new THREE.Mesh(new THREE.PlaneGeometry(26, 15), new THREE.MeshBasicMaterial({ toneMapped: false })); board.material.userData.outlineParameters = { visible: false }; board.position.set(RIG.x, 1.9, -6); scene.add(board);
  const board2 = new THREE.Mesh(new THREE.PlaneGeometry(26, 15), new THREE.MeshBasicMaterial({ toneMapped: false })); board2.material.userData.outlineParameters = { visible: false }; board2.visible = false; scene.add(board2); // the moving view behind see-through windows
  const bench = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.78, 0.4), toon('#7a4a2a')); bench.position.set(RIG.x, 0.39, 0.55); bench.visible = false; scene.add(bench);
  const benchTop = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.07, 0.55), toon('#5a3520')); benchTop.position.set(RIG.x, 0.8, 0.55); benchTop.visible = false; scene.add(benchTop);
  if (tl.flat) { bench.scale.y = 0.62; bench.position.y = 0.39 * 0.62; benchTop.position.y = 0.8 * 0.62; } // flat people sit lower
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
  // v1.5: garba, rakhi, Eid, Christmas, travel windows, underwater
  const FPK = makeFestPack(toon); const pool = {}; const take = (kind, id, make) => { const k = kind + ':' + id; if (!pool[k]) { pool[k] = make(); scene.add(pool[k]); } return pool[k]; };
  const xtree = FPK.tree(); xtree.visible = false; scene.add(xtree); const moon = FPK.moon(); moon.visible = false; moon.position.z = 6; scene.add(moon);
  const lanterns = [0xff8c2a, 0xffd23f, 0x06d6a0, 0xf72585, 0x4cc9f0, 0xff8c2a, 0xffd23f].map((c) => { const l = FPK.lantern(c); l.visible = false; scene.add(l); return l; });
  const fish = makeFish(9); fish.group.visible = false; fish.group.position.z = 44; scene.add(fish.group); const weeds = makeWeeds(10); weeds.group.visible = false; weeds.group.position.z = 46; scene.add(weeds.group);
  const winCv = document.createElement('canvas'); winCv.width = 2048; winCv.height = 512; const winTex = new THREE.CanvasTexture(winCv); winTex.colorSpace = THREE.SRGBColorSpace; winTex.wrapS = THREE.RepeatWrapping; let winKind = null;
  const drawWin = (kind) => { if (winKind === kind) return; winKind = kind; const x = winCv.getContext('2d'), w = 2048, h = 512; const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, kind === 'plane' ? '#4f8fd8' : '#7cc0f0'); g.addColorStop(1, kind === 'plane' ? '#cfe6fb' : '#e2f1fb'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    if (kind === 'plane') { for (let i = 0; i < 14; i++) { x.fillStyle = 'rgba(255,255,255,0.9)'; const cx = i * 150 + 40, cy = 120 + (i % 4) * 80; for (let k = 0; k < 4; k++) { x.beginPath(); x.arc(cx + k * 30, cy + (k % 2) * 10, 28 + k * 4, 0, 7); x.fill(); } } }
    else { x.fillStyle = '#7aa884'; x.beginPath(); x.moveTo(0, h * 0.55); for (let i = 0; i <= 16; i++) x.lineTo((i / 16) * w, h * (0.42 + (i % 2) * 0.1)); x.lineTo(w, h); x.lineTo(0, h); x.fill(); x.fillStyle = '#62a84c'; x.fillRect(0, h * 0.62, w, h);
      if (kind === 'bus' || kind === 'car') for (let i = 0; i < 16; i++) { x.fillStyle = ['#d9a441', '#c0574a', '#5a87b8', '#e2c9a0'][i % 4]; const bh = 120 + (i % 3) * 60; x.fillRect(i * 128, h * 0.7 - bh, 110, bh); x.fillStyle = '#fff6c8'; for (let r = 0; r < 4; r++) x.fillRect(i * 128 + 15 + (r % 2) * 50, h * 0.7 - bh + 20 + Math.floor(r / 2) * 40, 30, 22); }
      else for (let i = 0; i < 18; i++) { const cx = i * 114 + 30; x.fillStyle = '#6b4426'; x.fillRect(cx - 6, h * 0.5, 12, 90); x.fillStyle = '#2f7d32'; x.beginPath(); x.arc(cx, h * 0.48, 40, 0, 7); x.fill(); if (i % 3 === 0) { x.fillStyle = '#555'; x.fillRect(cx + 50, h * 0.28, 6, h * 0.5); } } }
    winTex.needsUpdate = true; };
  const winMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: winTex, toneMapped: false })); winMesh.material.userData.outlineParameters = { visible: false }; winMesh.visible = false; scene.add(winMesh);
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
  P.drink = P.sip = P.hold_cup = P.cup;
  P.phone = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.15, 0.015), toon('#15151a'));
  P.scroll_phone = (() => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.13, 0.012), toon('#15151a')); const scr = noOutline(new THREE.Mesh(new THREE.PlaneGeometry(0.055, 0.105), new THREE.MeshBasicMaterial({ color: 0xbfe0ff, toneMapped: false }))); scr.position.z = 0.007; g.add(b, scr); return g; })();
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
  P.receive = P.give; P.laddu = FPK.laddu();
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
    const free = sc.cast.filter((c) => !anchor[c]); const busy = [...new Set([...Object.values(anchor), ...ms.filter((m) => ['counter', 'desk', 'judge', 'witness', 'bed', 'cell'].includes(m.type))])].map((m) => { const w = m.w || 0.12; return [m.x - w / 2, m.x + w / 2]; }); /* nobody stands inside a counter / desk / bench painting */ const sp = spots(free, parked, busy);
    // when a chase ends, the next movement of the scene
    for (const e of ev) if (['car_chase', 'foot_chase', 'baraat', 'game', 'swim', 'birthday', 'garba', 'beat'].includes(e.kind)) { const nx = ev.find((x) => x.t0 >= e.t1 - 0.01 && x !== e && !['gesture', 'animal', 'crowd', 'fire', 'fire_out', 'holi', 'diwali', 'cracker', 'fly_by', 'eid', 'christmas', 'moving_view'].includes(x.kind)); e._until = Math.max(e.t1, nx ? nx.t0 : sc.end - 0.4); }
    const p = { b, ms, ev, vkeys, akeys, chase, involved, inside, anchor, sp, parked }; plan.set(sc, p); return p;
  }
  const PARK = { x: 0.8, row: 1 }; const VSCALE = 0.85;
  function stateAt(sc, t) {
    const p = planOf(sc); const b = p.b;
    const C = {}, V = {}; let scroll = 0, chasing = null, shake = 0, crowd = { mood: null, count: 0 }, baraat = null; const A = {}; const FX = { fires: [], booms: [], game: null, splash: [] }; const links = {};
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
    const gapOf = (cc) => (0.5 * heightAt(b, feet(cc))) / AR; // one comfortable step apart
    function applyLinks() { for (const [f, l] of Object.entries(links)) { const L = C[l.to], F = C[f]; if (!L || !F) continue; L.linkLead = { id: f, mode: l.mode }; F.link = { id: l.to, mode: l.mode };
      if (L.inV || F.inV) continue; if (L.walk || L.run) l.dir = L.face; const dir = l.dir || L.face || 1; const g = gapOf(L);
      F.visible = L.visible; F.anchor = null; F.sit = 0; F.lie = 0; F.walk = L.walk; F.run = L.run; F.walkDist = L.walkDist; F.feetY = L.feetY != null ? L.feetY + (l.mode === 'hand' ? -0.012 : 0.012) : null; F.row = L.row + (l.mode === 'hand' ? 0.05 : -0.04);
      if (l.mode === 'hand') { F.x = L.x - dir * g * (tl.bean ? 1.4 : 0.78); F.face = dir; if (L.walk || L.run) F.keepFace = L.keepFace = true; } else { F.x = L.x + dir * g * 0.62; F.face = dir; if (!L.walk && !L.run) L.face = F.x > L.x ? 1 : -1; F.keepFace = L.keepFace = true; } } }
    for (const e of p.ev) {
      if (t < e.t0) break; const until = e._until ?? e.t1; const k = Math.min(1, (t - e.t0) / Math.max(0.01, e.t1 - e.t0)), done = t >= e.t1;
      const c = C[e.char];
      const go = (cc, x0, x1, run, kk = k) => { cc.x = lerp(x0, x1, kk); cc.walkDist = (Math.abs(x1 - x0) * kk * AR) / Math.max(0.05, heightAt(b, feet(cc)) / 1.7); if (kk < 1 && Math.abs(x1 - x0) > 0.005) { cc.face = x1 > x0 ? 1 : -1; cc[run ? 'run' : 'walk'] = 1; } else cc.walk = cc.run = 0; };
      const free = (cc) => { cc.anchor = null; cc.feetY = null; cc.sit = 0; cc.lie = 0; cc.swim = 0; cc.climbed = null; };
      applyLinks();
      if (e.char && links[e.char] && !['hold_hands', 'escort', 'gesture', 'let_go', 'beat', 'handcuff'].includes(e.kind)) { const L0 = links[e.char]; delete links[e.char]; if (C[e.char]) C[e.char].link = null; if (C[L0.to]) C[L0.to].linkLead = null; } // the one being led moves on their own
      if (e.kind === 'gesture') { if (C[e.char] && ['drink', 'sip', 'hold_cup'].includes(e.name)) C[e.char].holding = 'cup'; if (C[e.char] && e.name === 'put_down' && t >= e.t0 + 0.5) C[e.char].holding = C[e.char].sit > 0.5 && C[e.char].anchor?.tableY != null ? 'cup' : null; /* at a table the cup stays on the table */ continue; }
      if (e.kind === 'animal' && e.animal === 'birds') { const a = A.birds; if (a && e.act === 'fly') { a.fly = { t0: e.t0, t1: e.t1 }; } continue; }
      if (e.kind === 'animal') { const a = A[e.animal]; if (!a) continue; const side = (x) => (x < 0.5 ? -0.15 : 1.15); const on = !done;
        if (e.act === 'enter') { a.visible = true; const x0 = side(a.home.x); a.x = lerp(x0, a.home.x, k); a.face = a.home.x > x0 ? 1 : -1; a.move = on ? 1 : 0; }
        else if (e.act === 'exit' || e.act === 'run') { const x0 = a.x, x1 = e.act === 'run' ? (a.face > 0 ? 1.2 : -0.2) : side(x0); a.x = lerp(x0, x1, k); a.face = x1 > x0 ? 1 : -1; a.move = on ? 1 : 0; a.run = e.act === 'run' && on ? 1 : 0; if (done) a.visible = false; }
        else if (e.act === 'leash' && C[e.target]) { a.visible = true; a.leash = e.target; }
        else if (e.act === 'follow' && C[e.target]) { const tc = C[e.target]; a.visible = true; const x0 = a.x, x1 = tc.x + (x0 < tc.x ? -0.09 : 0.09); a.x = lerp(x0, x1, sm(0, 1, k)); a.row = tc.row + 0.05; a.face = x1 > x0 ? 1 : -1; a.move = on ? 1 : 0; }
        else if (on) { a.visible = true; a.act = e.act === 'jump' || e.act === 'chatter' ? 'jump' : ['bark', 'moo', 'neigh', 'bleat', 'meow', 'trumpet', 'roar'].includes(e.act) ? 'bark' : e.act === 'sit' ? 'sit' : null; a.head = e.act === 'graze' ? 'down' : ['moo', 'neigh', 'trumpet', 'bleat'].includes(e.act) ? 'up' : null; }
        else if (e.act === 'sit') a.act = 'sit';
        continue; }
      if (e.kind === 'fly_by') { const v = V[e.vehicle]; if (v) { v.visible = t < e.t1; v.fly = { k }; v.spin = k * 40; v.bob = 1; } continue; }
      if (e.kind === 'eid') { FX.eid = { k: sm(e.t0, e.t0 + 1.5, t) }; continue; }
      if (e.kind === 'christmas') { FX.xmas = { k: sm(e.t0, e.t0 + 1.5, t), caps: e.caps !== false }; continue; }
      if (e.kind === 'moving_view') { FX.moving = { kind: e.vkind || 'train' }; shake = Math.max(shake, 0.25); continue; }
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
        case 'enter': c.visible = true; free(c); go(c, side(c.home.x), c.home.x, false); c.leaving = !done; break;
        case 'exit': case 'run_exit': { if (c.anchor && c.anchor.type === 'door' && e.kind === 'exit') { const m = c.anchor; c.walk = done ? 0 : 1; c.back = true; c.x = m.x; c.feetY = lerp(m.y, m.y - 0.035, k); c.walkDist = k * 1.2; c.fade = sm(0.55, 1, k); if (done) c.visible = false; break; }
          c.leaving = true; const x0 = c.x, fy = c.feetY; free(c); c.feetY = fy; go(c, x0, side(x0), e.kind === 'run_exit'); if (done) c.visible = false; break; }
        case 'walk_to': { const tc = e.target && C[e.target]; const x0 = c.x; const x1 = tc ? tc.x + (x0 < tc.x ? -0.11 : 0.11) : c.home.x; free(c); c.row = tc ? tc.row : c.home.row; go(c, x0, x1, false); if (done && tc) c.face = tc.x > c.x ? 1 : -1; break; }
        case 'go_to': { const m = p.ms.find((x) => x.type === e.place) || p.ms.find((x) => x.type === 'seat'); if (!m) break; const x0 = c.x, y0 = feet(c); c.anchor = null; c.lie = 0;
          const kw = sm(0, 0.75, k); c.x = lerp(x0, m.x, kw); c.feetY = lerp(y0, m.y, kw); if (kw < 1 && Math.abs(m.x - x0) > 0.005) { c.face = m.x > x0 ? 1 : -1; c.walk = 1; } else c.walk = 0;
          c.sit = SIT_TYPES.has(m.type) ? sm(0.75, 1, k) : 0; c.lie = m.type === 'bed' ? sm(0.75, 1, k) : 0; if (done) c.anchor = m; break; }
        case 'sit': { const s = p.ms.filter((x) => x.type === 'seat' && !Object.values(C).some((o) => o !== c && o.anchor === x && o.sit > 0)).sort((u, v) => Math.abs(u.x - c.x) - Math.abs(v.x - c.x))[0]; if (s) { const x0 = c.x, y0 = feet(c), far = Math.abs(s.x - x0) > 0.03; const kw = far ? sm(0, 0.6, k) : 1; c.x = lerp(x0, s.x, kw); c.feetY = lerp(y0, s.y, kw); if (far && kw < 1) { c.walk = 1; c.face = s.x > x0 ? 1 : -1; c.walkDist = (Math.abs(s.x - x0) * kw * AR) / Math.max(0.05, heightAt(b, feet(c)) / 1.7); } else c.walk = 0; c.sit = far ? sm(0.62, 1, k) : sm(0.3, 1, k); c.anchor = s; c._sitting = true; } break; }
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
          if (active) { chasing = { kind: 'foot', runner: e.char }; crowd = { mood: null, count: 0 }; } const fs = tl.flat ? 0.42 : 0.22; scroll += (tt - e.t0) * fs; for (const an of Object.values(A)) an.x -= (tt - e.t0) * fs; /* animals stay on the ground that scrolls */ for (const v of Object.values(V)) { v.x -= (tt - e.t0) * fs; v.siren = false; v.bob = 0; if (v.x < -0.8) v.visible = false; } break; }
        case 'catch': { const tc = C[e.target]; if (!tc) break; const x0 = c.x; free(c); c.row = tc.row; const x1 = tc.x - (x0 < tc.x ? 0.1 : -0.1); const kw = sm(0, 0.55, k); c.x = lerp(x0, x1, kw); c.run = kw < 1 ? 1 : 0; c.walk = 0; c.face = x1 >= x0 ? 1 : -1;
          tc.run = 0; tc.walk = 0; if (k > 0.5) { c.grab = e.target; tc.struggle = 1 - sm(0.9, 1, k) * 0.5; c.face = tc.x > c.x ? 1 : -1; tc.face = -c.face; } break; }
        case 'handcuff': { const tc = C[e.target]; if (!tc) break; const g = Object.values(C).find((o) => o !== c && o.grab === e.target);
          for (const o of Object.values(C)) if (o.grab === e.target && k > 0.25) { o.grab = null; if (o !== c) { o.x += (o.x < tc.x ? -0.04 : 0.04) * sm(0.25, 0.4, k); } } const sideX = g ? (g.x < tc.x ? 1 : -1) : (c.x < tc.x ? -1 : 1); const x0 = c.x, x1 = tc.x + sideX * 0.1;
          if (Math.abs(x1 - x0) > 0.01) { free(c); c.row = tc.row; const kw = sm(0, 0.3, k); c.x = lerp(x0, x1, kw); c.walk = kw < 1 ? 1 : 0; } c.grab = null; c.face = tc.x > c.x ? 1 : -1; tc.struggle = 0.4 * (1 - sm(0.4, 0.6, k)); if (k >= 0.5) tc.cuffed = true; c._cuff = k > 0.3 && !done; break; }
        case 'hug': case 'fight': case 'push': case 'slap': case 'give': { const tc = C[e.target]; if (!tc) break; const seated = e.kind === 'give' && c.sit > 0.5; const x0 = c.x; if (!seated) { free(c); c.row = tc.row; } const gap = e.kind === 'hug' ? 0.06 : e.kind === 'fight' ? 0.09 : 0.085;
          const x1 = seated ? x0 : tc.x + (x0 < tc.x ? -gap : gap); const kw = sm(0, 0.35, k); c.x = lerp(x0, x1, kw); c.walk = kw < 1 && Math.abs(x1 - x0) > 0.01 ? 1 : 0; if (kw >= 1) { c.face = tc.x > c.x ? 1 : -1; tc.face = -c.face; }
          const act = k > 0.35 && !done; const kk = sm(0.35, 0.45, k) * (1 - sm(0.92, 1, k));
          if (e.kind === 'hug' && act) { c._g = { name: 'hug', k: kk }; tc._g = { name: 'hug', k: kk }; tc.walk = tc.run = 0; }
          if (e.kind === 'fight' && act) { c._g = { name: 'punch', k: kk }; tc._g = { name: Math.floor(t * 3) % 2 ? 'punch' : 'hit_back', k: kk }; c.struggle = 0.3; tc.struggle = 0.5; shake = 0.6; }
          if (e.kind === 'push') { if (act) c._g = { name: 'push', k: kk }; if (k > 0.5) { tc.x += (tc.x > c.x ? 1 : -1) * 0.09 * sm(0.5, 0.75, k); tc.struggle = done ? 0 : 0.6; } }
          if (e.kind === 'slap' && act) { c._g = { name: 'slap', k: kk }; if (k > 0.6) tc._g = { name: 'hit_back', k: sm(0.6, 0.7, k) * (1 - sm(0.9, 1, k)) }; }
          if (e.kind === 'give' && CUP.test(e.item || '') && k > 0.7) tc.holding = 'cup';
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
          { const x0 = c.x, r0 = c.row; free(c); c.visible = true; const kk = sm(e.t0, e.t0 + 1.8, t); c.x = lerp(x0, 0.5, kk); c.row = lerp(r0, 0.5, kk); if (kk < 1 && Math.abs(0.5 - x0) > 0.01) { c.walk = 1; c.face = 0.5 > x0 ? 1 : -1; c.walkDist = (Math.abs(0.5 - x0) * kk * AR) / (heightAt(b, feet(c)) / 1.7); } else { c.face = 1; c.frontal = true; } }
          const others = Object.entries(C).filter(([id, o]) => id !== e.char && o.visible && !o.inV);           const kIn = sm(e.t0, e.t0 + 1.8, t); others.forEach(([id, o], i) => { const x0 = o.x, r0 = o.row; free(o); const side = i % 2 ? 1 : -1; const r = Math.floor(i / 2); const tx = 0.5 + side * (0.19 + r * 0.12); o.x = lerp(x0, tx, kIn); o.row = lerp(r0, 0.32 + r * 0.25, kIn); if (kIn < 1 && Math.abs(tx - x0) > 0.01) { o.walk = 1; o.face = tx > x0 ? 1 : -1; o.walkDist = (Math.abs(tx - x0) * kIn * AR) / (heightAt(b, feet(o)) / 1.7); } else o.face = side > 0 ? -1 : 1; });
          const phase = q < 0.42 ? 'song' : q < 0.55 ? 'blow' : q < 0.76 ? 'cut' : 'feed'; FX.birthday = { char: e.char, active, phase, q, blown: q >= 0.52, cut: q >= 0.66, t0: e.t0, feedTo: others[0]?.[0] };
          if (active) { c._g = phase === 'blow' ? { name: 'blow', k: 1 } : phase === 'cut' ? { name: 'cut', k: 1 } : phase === 'feed' ? { name: 'give', k: 1 } : { name: 'laugh', k: 1 };
            others.forEach(([id, o], i) => { o._g = phase === 'feed' && i === 0 ? { name: 'receive', k: 1 } : { name: 'clap', k: 1 }; }); if (phase === 'feed' && others[0]) { const o = others[0][1]; const kf = sm(0.76, 0.82, q); const x0 = o.x; o.x = lerp(x0, 0.62, kf); o.row = lerp(o.row, 0.45, kf); if (kf < 1) { o.walk = 1; o.face = 0.62 > x0 ? 1 : -1; } else o.face = -1; } }
          break; }
        case 'garba': { const until = e._until ?? e.t1; const active = t < until; const ds = [e.char, ...(e.with || [])].filter((id) => C[id]); const n = ds.length;
          ds.forEach((id, i) => { const cc = C[id]; free(cc); cc.inV = null; cc.visible = true; const a0 = (i / n) * Math.PI * 2, sp = 0.45; const a = a0 + (Math.min(t, until) - e.t0) * sp; cc.x = 0.5 + Math.cos(a) * 0.26; cc.row = 0.4 + Math.sin(a) * 0.36;
            cc.face = -Math.sin(a) > 0 ? 1 : -1; cc.walk = active ? 1 : 0; cc.walkDist = (Math.min(t, until) - e.t0) * sp * 0.26 * AR / Math.max(0.05, heightAt(b, feet(cc)) / 1.7); if (active) cc._g = { name: 'dandiya', k: 1 }; });
          FX.garba = { active, ds }; if (active) crowd = { mood: 'dance', count: Math.max(crowd.count, Math.min(extras.length, 8)) }; break; }
        case 'rakhi': { const tc = C[e.target]; if (!tc) break; const q = k; const x0 = c.x; free(c); c.row = tc.row; const x1 = tc.x + (x0 < tc.x ? -0.085 : 0.085); const kw = sm(0, 0.18, q); c.x = lerp(x0, x1, kw); c.walk = kw < 1 && Math.abs(x1 - x0) > 0.01 ? 1 : 0;
          if (kw >= 1) { c.face = tc.x > c.x ? 1 : -1; tc.face = -c.face; }
          if (!done) { if (q > 0.2 && q < 0.4) c._g = { name: 'aarti', k: 1 }; if (q >= 0.4 && q < 0.65) { c._g = { name: 'cuff', k: 1 }; tc._g = { name: 'give', k: 1 }; } if (q >= 0.65 && q < 0.82) { c._g = { name: 'give', k: 1, item: 'laddu' }; tc._g = { name: 'receive', k: 1 }; } if (q >= 0.82) { tc._g = { name: 'give', k: 1, item: 'give' }; c._g = { name: 'receive', k: 1 }; } }
          if (q >= 0.55) tc.rakhi = true; break; }
        case 'hold_hands': if (C[e.target]) { links[e.target] = { to: e.char, mode: 'hand', dir: c.face }; } break;
        case 'let_go': for (const [f, l] of Object.entries(links)) if (f === e.char || l.to === e.char || f === e.target) { delete links[f]; if (C[f]) C[f].link = null; if (C[l.to]) C[l.to].linkLead = null; } break;
        case 'escort': { const tc = C[e.target]; if (!tc) break; for (const [f, l] of Object.entries(links)) if (f === e.target) { delete links[f]; if (C[l.to]) C[l.to].linkLead = null; }
          const gap = gapOf(tc) * 0.8; const x0 = c.x; const x1 = tc.x + (x0 < tc.x ? -gap : gap); if (Math.abs(x1 - x0) > 0.01 && !done) { free(c); c.row = tc.row; go(c, x0, x1, false, sm(0, 0.8, k)); } c.face = tc.x > c.x ? 1 : -1; tc.face = c.face;
          if (k >= 0.6) links[e.target] = { to: e.char, mode: 'arm', dir: c.face }; break; }
        case 'pickpocket': { const tc = C[e.target]; if (!tc) break; const back = -(tc.face || 1); const x0 = c.x; let x1 = tc.x + back * gapOf(tc) * 0.62; if (x1 < 0.07 || x1 > 0.93) x1 = tc.x - back * gapOf(tc) * 0.62; free(c); c.row = tc.sit ? tc.row : tc.row + 0.05; c.feetY = tc.feetY != null ? tc.feetY - 0.01 : null;
          const kw = sm(0, 0.38, k); c.x = lerp(x0, x1, kw); if (kw < 1 && Math.abs(x1 - x0) > 0.01) { c.face = x1 > x0 ? 1 : -1; c.walk = 1; c.walkDist = (Math.abs(x1 - x0) * kw * AR) / Math.max(0.05, heightAt(b, feet(c)) / 1.7); } else { c.walk = 0; c.face = tc.x > c.x ? 1 : -1; }
          c._touch = tc._touch = true; if (k < 0.9) tc.keepFace = true; if (!done && k > 0.38 && k < 0.8) c._g = { name: 'pickpocket', k: sm(0.38, 0.45, k) * (1 - sm(0.74, 0.8, k)) }; if (!done && k >= 0.8) c._g = { name: 'look_around', k: 1 };
          FX.wallet = { from: e.target, to: e.char, q: k, owner: k < 0.6 ? e.target : e.char, hidden: k > 0.86 }; break; }
        case 'beat': { const until = e._until ?? e.t1; const active = t < until; const ws = (e.with || []).filter((id) => C[id]); c._touch = true; if (c.sit) { c.sit = 0; c.anchor = null; } { const x0 = c.x, cx = Math.min(0.68, Math.max(0.32, x0)); const kc = sm(e.t0, e.t0 + 0.8, t); if (Math.abs(cx - x0) > 0.01) { free(c); c.x = lerp(x0, cx, kc); if (kc < 1) { c.walk = 1; c.face = cx > x0 ? 1 : -1; } else c.walk = 0; } for (const o of Object.values(C)) if (o.grab === e.char) o.grab = null; } // pull the victim to the middle so everybody fits
          ws.forEach((id, i) => { const w = C[id]; w._touch = true; const sideW = i % 2 ? 1 : -1; const r = Math.floor(i / 2); const tx = c.x + sideW * gapOf(c) * (0.72 + r * 0.55); const x0 = w.x; free(w); w.visible = true; w.inV = null; w.row = c.row + (r ? 0.08 * (i % 2 ? 1 : -1) : 0);
            const kw = sm(e.t0, e.t0 + 0.9, t); w.x = lerp(x0, tx, kw); if (kw < 1 && Math.abs(tx - x0) > 0.01) { w.run = 1; w.face = tx > x0 ? 1 : -1; } else { w.run = 0; w.face = c.x > w.x ? 1 : -1; }
            if (active && kw >= 1) { const cyc = Math.floor((t - e.t0) * 1.1 + i * 0.7) % 3; w._g = { name: cyc === 2 && r === 0 ? 'kick' : cyc === 1 ? 'slap' : 'punch', k: 1, ph: ((t - e.t0) * 1.6 + i * 0.37) % 1 }; } else if (!active) w._g = { name: 'angry', k: 1 - sm(until, until + 1.5, t) }; });
          if (active && t > e.t0 + 0.9) { c._g = { name: 'cower', k: 1 }; c.struggle = 0.8; c.x += Math.sin(t * 17) * 0.004; shake = Math.max(shake, 0.5); } else if (!active) { c._g = { name: 'cower', k: 1 - sm(until, until + 2.5, t) }; c.struggle = 0; }
          break; }
        case 'thoughts': { const until = e._until ?? e.t1; if (t < until + 0.5) { FX.thoughts = { char: e.char, t0: e.t0, until, items: e.items || [] }; if (t < until) { c.worry = true; c._g = { name: 'cower', k: sm(e.t0, e.t0 + 0.6, t) * 0.6 }; } } break; }
        case 'dream': { const until = e._until ?? e.t1; if (t < until + 0.6) FX.dream = { char: e.char, t0: e.t0, until, bg: e.dreamBg, with: e.with || [] }; break; }
        case 'sleep': { const bed = p.ms.find((m) => m.type === 'bed'); if (bed && !c.inV && !(c.anchor && c.anchor.type === 'bed')) { /* walk to the bed, then lie down on it */ const x0 = c.x, x1 = bed.x - (bed.w || 0.3) * 0.3; const wd = Math.min(3.5, Math.abs(x1 - x0) * 4.5); const kw = wd > 0.05 ? Math.min(1, (t - e.t0) / wd) : 1;
            if (kw < 1) { free(c); go(c, x0, x1, false, kw); break; } c.anchor = bed; c.feetY = bed.y; c.x = bed.x; c.sit = 0; c.walk = c.run = 0; c.lie = sm(e.t0 + wd, e.t0 + wd + 0.6, t); c.sleeping = true; break; }
          c.lie = sm(0, 0.6, k); c.sit = 0; c.walk = c.run = 0; c.sleeping = true; break; }
        default: break;
      }
    }
    applyLinks();
    for (const a of Object.values(A)) if (a.leash && C[a.leash]) { const o = C[a.leash]; a.visible = o.visible && !o.inV; const dir = o.face || 1; const g = gapOf(o) * 0.95; a.x = o.x + dir * g; a.row = o.row - 0.04; a.face = dir; a.move = o.walk || o.run ? 1 : 0; a.run = o.run ? 1 : 0; a.dist = (o.x * AR) / Math.max(0.05, heightAt(b, feet(o)) / 1.7) * dir; } /* the dog walks a little ahead of the owner on its leash */
    for (const c0 of Object.values(C)) if (c0.visible && !c0.inV && !c0.leaving && !c0.link && !chasing && !c0.anchor) c0.x = Math.min(0.9, Math.max(0.1, c0.x)); /* stay inside the picture (only entering / leaving people use the edges) */
    // keep people apart (except those touching on purpose)
    { const TOUCH = new Set(['hug', 'punch', 'hit_back', 'grab', 'cuff', 'give', 'receive', 'push', 'slap', 'aarti', 'dandiya']); const touching = new Set(Object.entries(C).filter(([, c]) => c.grab || c._cuff || c.link || c.linkLead || c._touch || (c._g && TOUCH.has(c._g.name))).map(([id]) => id));
      const L = Object.entries(C).filter(([, c]) => c.visible && !c.inV && !c.lie && !c.swim && !c.climbed); /* seated people stay put, standing people step away from them */
      for (let it = 0; it < 5; it++) for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const [ia, A1] = L[i], [ib, B1] = L[j]; if (touching.has(ia) && touching.has(ib)) continue;
        const fa = feet(A1), fb = feet(B1); if (Math.abs(fa - fb) > 0.3) continue; const gap = ((tl.bean ? 0.55 : 0.42) * Math.max(heightAt(b, fa), heightAt(b, fb))) / AR * (A1.sit > 0.5 || B1.sit > 0.5 ? 1.45 : 1); /* seated legs stick out */ const dx = B1.x - A1.x; if (Math.abs(dx) >= gap) continue;
        const push = (gap - Math.abs(dx)) / 2; const sgn = dx === 0 ? (ia < ib ? 1 : -1) : Math.sign(dx); const am = A1.anchor ? 0 : 1, bm = B1.anchor ? 0 : 1; const tot = Math.max(1, am + bm);
        A1.x = Math.max(0.08, Math.min(0.92, A1.x - sgn * push * 2 * (am / tot))); B1.x = Math.max(0.08, Math.min(0.92, B1.x + sgn * push * 2 * (bm / tot))); } }
    return { C, V, A, FX, scroll, chasing, shake, crowd, baraat };
  }
  const TINT = { day: [0xffffff, 1.6, 1.3], morning: [0xfff1dc, 1.5, 1.2], evening: [0xffd2a0, 1.3, 1.0], night: [0x9fb2ff, 0.85, 0.55] };

  // outline switches set on meshes → copy onto their materials (OutlineEffect reads the material)
  scene.traverse((o) => { if (o.isMesh && o.userData.outlineParameters) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => (m.userData.outlineParameters = o.userData.outlineParameters)); });
  // flat 2D people: hands that really hold another hand / an arm / a pocket, mugs with steam, the stolen wallet
  const flatProps = {}; const fprop = (k, make) => { if (!flatProps[k]) { flatProps[k] = make(); scene.add(flatProps[k]); } return flatProps[k]; };
  const mirrorOf = (yaw) => (Math.abs(yaw) < 0.45 ? 1 : Math.sign(yaw));
  const toLocal = (id, W, mir) => { const H = holders[id].h; const s = H.scale.x; return { x: ((W.x - H.position.x) / s) * mir, y: (W.y - H.position.y) / s }; };
  const holdY = (id) => { const H = holders[id].h; return H.position.y + 0.56 * actors[id].parts.k * H.scale.x; };
  let flatState = null;
  function flatExtras(id, c, a, pp, t, S) {
    const mir = mirrorOf(pp.yaw); const vis = flatState.vis; const st = flatState.st;
    const L = c.linkLead, F = c.link;
    if (!c.inV && !c.lie) {
      if (L && L.mode === 'hand' && vis.includes(L.id) && actors[L.id].flat && !st[L.id].inV) { const o = holders[L.id].h, h = holders[id].h; const W = V3((h.position.x + o.position.x) / 2, (holdY(id) + holdY(L.id)) / 2, 0); pp.holdB = toLocal(id, W, mir); }
      if (F && F.mode === 'hand' && vis.includes(F.id) && actors[F.id].flat && !st[F.id].inV) { const o = holders[F.id].h, h = holders[id].h; const W = V3((h.position.x + o.position.x) / 2, (holdY(id) + holdY(F.id)) / 2, 0); pp.holdF = toLocal(id, W, mir); }
      if (L && L.mode === 'arm' && vis.includes(L.id) && actors[L.id].flat && !st[L.id].inV) { const th = actors[L.id], H = holders[L.id].h; const tm = st[L.id].face || 1; const P_ = th.parts; const W = V3(H.position.x + (-P_.shoulderB.x * 0.6) * tm * H.scale.x, H.position.y + (P_.shoulderB.y - P_.armU * 0.55) * H.scale.x, 0); pp.holdF = toLocal(id, W, mir); pp.gesture = null; }
    }
    const W_ = S.FX.wallet; if (W_ && W_.to === id && W_.q > 0.38 && W_.q < 0.62 && vis.includes(W_.from)) { const vH = holders[W_.from].h; const vm = st[W_.from].face || 1; const vk = actors[W_.from].parts?.k || 1; const W = V3(vH.position.x - 0.1 * vk * vm * vH.scale.x, vH.position.y + (st[W_.from].sit > 0.5 ? 0.36 : 0.5) * vk * vH.scale.x, 0); pp.holdF = toLocal(id, W, mir); }
    const gname = pp.gesture?.name; const an = c.anchor; const atTable = c.sit > 0.5 && an && an.type === 'seat' && an.tableY != null && !c.inV;
    if (atTable) { const H = holders[id].h, s = H.scale.x, k_ = a.parts.k || 1, dir = c.face || 1; const top = 1 - an.tableY; const tableCup = ((an.cup || an.stool) && !flatState.served) || c.holding === 'cup'; /* a cafe table has cups, unless the waiter brings them in this scene */ const sipping = ['drink', 'sip'].includes(gname);
      const cupX = H.position.x + dir * 0.36 * k_ * s; if (tableCup && !sipping) flatState.tableCups.push({ id, x: cupX, y: top, z: H.position.z + 0.15 * s, s, mir: dir }); /* the cup stands on the table until it is picked up */
      if (!gname && !pp.holdF && !pp.talk) { pp.holdF = toLocal(id, V3(cupX - dir * 0.075 * s, top + 0.03 * s, 0), mir); pp.holdB = toLocal(id, V3(H.position.x + dir * 0.24 * k_ * s, top + 0.012 * s, 0), mir); } /* hands rest on the table */
      if (!sipping) { flatState.cups.push({ id, mir, show: false }); return; } }
    if (!pp.holdF) for (const [k_, an_] of Object.entries(S.A)) if (an_.leash === id && an_.visible && animals[k_]?.group.userData.collar) { const col = new THREE.Vector3(); animals[k_].group.updateMatrixWorld(true); animals[k_].group.userData.collar.getWorldPosition(col); const H = holders[id].h; const s = H.scale.x;
      pp.holdF = toLocal(id, V3(lerp(H.position.x, col.x, 0.42), H.position.y + 0.62 * (a.parts.k || 1) * s, 0), mir); flatState.leash = { id, k: k_, col }; } /* holding the dog's leash */
    if (c.holding === 'cup' && !gname && !pp.holdF && !c.walk && !c.run) pp.gesture = { name: 'hold_cup', k: 1 };
    flatState.cups.push({ id, mir, show: (c.holding === 'cup' || ['drink', 'sip', 'hold_cup'].includes(pp.gesture?.name) || (c._g?.item && CUP.test(c._g.item))) && !c.inV, ph: pp.gesture?.ph, sip: ['drink', 'sip'].includes(pp.gesture?.name) });
  }
  function placeFlatProps(t, S, vis) {
    for (const m of Object.values(flatProps)) m.visible = false;
    for (const q of flatState.tableCups || []) { if (!vis.includes(q.id)) continue; const m = fprop('tcup:' + q.id, () => makeFlatCup()); m.visible = true; m.scale.set(q.s * q.mir * 0.9, q.s * 0.9, q.s); m.rotation.z = 0; m.position.set(q.x, q.y + 0.006 * q.s, q.z); m.userData.set?.(t, 1); }
    const LS = flatState.leash; if (LS && vis.includes(LS.id)) { const m = fprop('leash', () => { const g = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x8a2a22, toneMapped: false })); g.userData.outlineParameters = { visible: false }; g.material.userData.outlineParameters = { visible: false }; return g; }); const hp = handPos(actors[LS.id]); const s = holders[LS.id].h.scale.x;
      const dx = LS.col.x - hp.x, dy = LS.col.y - hp.y; m.visible = true; m.scale.set(Math.hypot(dx, dy), 0.018 * s, 1); m.rotation.z = Math.atan2(dy, dx); m.position.set((hp.x + LS.col.x) / 2, (hp.y + LS.col.y) / 2 - 0.004, Math.max(hp.z, LS.col.z) + 0.2); }
    for (const q of flatState.cups) { if (!q.show || !vis.includes(q.id)) continue; const m = fprop('cup:' + q.id, () => makeFlatCup()); const hp = handPos(actors[q.id]); const s = holders[q.id].h.scale.x;
      m.visible = true; m.scale.set(s * q.mir, s, s); const lift = q.sip && q.ph != null ? sm(0.18, 0.3, q.ph) * (1 - sm(0.72, 0.85, q.ph)) : 0; m.rotation.z = q.mir * 0.75 * lift; m.position.set(hp.x - 0.05 * s * Math.sin(m.rotation.z), hp.y - 0.055 * s, hp.z + 0.09 * s); m.userData.set(t, 1 - lift * 0.6); }
    const W_ = S.FX.wallet; if (W_ && !W_.hidden) { const who = W_.owner; if (vis.includes(who)) { const m = fprop('wallet', () => makeFlatWallet()); const s = holders[who].h.scale.x; m.visible = true; m.scale.setScalar(s);
      if (who === W_.from) { const H = holders[who].h; const vm = st_(who).face || 1; const vk = actors[who].parts?.k || 1; m.position.set(H.position.x - 0.1 * vk * vm * s, H.position.y + (st_(who).sit > 0.5 ? 0.36 : 0.5) * vk * s, H.position.z + 0.12 * s); m.scale.setScalar(s * 0.8); }
      else { const hp = handPos(actors[who]); m.position.set(hp.x, hp.y + 0.03 * s, hp.z + 0.08 * s); } } }
  }
  let st_ = () => ({});
  const sharpTex = {};
  // odometer: how far each person really moved on the ground (body + scrolling ground), so the feet never slide
  const odo = {};
  function odometer(id, t, S) { const H = holders[id].h; const s = Math.max(1e-4, H.scale.x); const gx = H.position.x + (S.scroll || 0) * AR, gy = H.position.z * 0.05;
    const o = odo[id]; if (!o || t <= o.t || t - o.t > 0.25) { odo[id] = { t, gx, gy, d: o ? o.d : 0, v: 0, ok: false }; return odo[id]; }
    const dd = Math.hypot(gx - o.gx, (gy - o.gy) * 2.2) / s; o.v = o.v * 0.55 + (dd / (t - o.t)) * 0.45; o.d += dd; o.t = t; o.gx = gx; o.gy = gy; o.ok = true; return o; }
  // flat style: vehicles, animals and props lose their 3D shading (flat colours + a dark outline), like vector cartoons
  const flatMats = new Map();
  function flattenScene() { scene.traverse((o) => { if (!o.isMesh || o === bg || o === board) return; const ms = Array.isArray(o.material) ? o.material : [o.material];
    const nm = ms.map((m) => { if (!m || m.isMeshBasicMaterial || m.isShaderMaterial) return m; let f = flatMats.get(m); if (!f) { f = new THREE.MeshBasicMaterial({ color: m.color ? m.color.clone() : 0xffffff, map: m.map || null, transparent: m.transparent, opacity: m.opacity, side: m.side, depthWrite: m.depthWrite, depthTest: m.depthTest, clippingPlanes: m.clippingPlanes || null, toneMapped: false });
      if (m.emissive && m.emissive.getHex() && m.emissiveIntensity) f.color.add(m.emissive.clone().multiplyScalar(m.emissiveIntensity * 0.6));
      f.userData.outlineParameters = m.userData.outlineParameters || { thickness: 0.0032 }; flatMats.set(m, f); } return f; });
    o.material = Array.isArray(o.material) ? nm : nm[0]; }); }
  function renderAt(t) {
    if (tl.flat) flattenScene();
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
    const st = S.C; const vis = []; const yawOf = {}; const ppOf = {};
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
      if (c.swim && !c.inV) { py -= 0.02 * sc_ * 1.7; if (sc.weather !== 'underwater') clip.constant = -(py + 0.13 * sc_); else py += 0.12; }
      if (c.jump) py += c.jump * 0.05 * sc_ * 1.7; if (S.FX.moving && !c.walk) py += Math.abs(Math.sin(t * 9 + px * 7)) * 0.0025;
      if (sc.weather === 'underwater' && !c.inV) { py += 0.01 + Math.sin(t * 1.3 + px * 5) * 0.006; }
      if (!show) continue; h.visible = true; vis.push(id);
      const childK = a.height / 1.7; h.scale.setScalar((sc_ * 1.7 * childK) / a.height); h.position.set(px, py, pz); h.rotation.y = 0;
      // lying down: roll the body flat, head towards the left
      pivot.rotation.z = c.swim ? -c.face * Math.PI / 2 * 0.92 : c.lie * Math.PI / 2; pivot.position.set(c.swim ? -c.face * 0.8 : c.lie * 0.85, c.swim ? 0.15 : c.lie * 0.12, 0);
    }
    // animals
    for (const [k, m] of Object.entries(animals)) { const a = S.A[k]; m.group.visible = !!(a && a.visible); if (!m.group.visible) continue; const fy = rowY(b, a.row); const sc2 = heightAt(b, fy) / 1.7;
      m.group.scale.setScalar(sc2); m.group.position.set(a.x * AR, 1 - fy, zOf(fy) + 0.05); m.group.rotation.y = a.face > 0 ? -0.3 : Math.PI + 0.3; if (m.flat) { m.group.rotation.y = 0; m.group.scale.set(sc2 * a.face, sc2, sc2); } m.set(t, { phase: a.leash ? (a.dist || 0) * 9 : t * (a.run ? 12 : 7), moving: a.move, run: a.run, head: a.head, act: a.act }); }
    // crowd people in the back rows (they face the camera)
    extras.forEach((e, i) => { const on = !!S.crowd.mood && i < S.crowd.count; e.group.visible = on; if (!on) return; const n = S.crowd.count; const row = 0.72 + (i % 2) * 0.28; const fy = rowY(b, row);
      const walk = S.crowd.mood === 'walk'; const dir = e.flat && walk && i % 2 ? -1 : 1; const spd = (tl.flat ? 0.05 : 0.03) * (1 + (i % 3) * 0.12); let x = ((i + 0.5) / n) * 0.94 + 0.03 + (walk ? dir * ((t * spd) % 1.1) : 0); let fy2 = fy, qd = 1;
      const ctr = S.crowd.mood === 'queue' ? p.ms.find((m) => m.type === 'counter') : null; if (ctr) { qd = ctr.x > 0.5 ? 1 : -1; x = ctr.x - qd * ((ctr.w || 0.2) / 2 + 0.05 + i * (tl.bean ? 0.1 : 0.075)); fy2 = b.groundNear - 0.03 - (i % 2) * 0.015; }
      const sc2 = heightAt(b, fy2) / 1.7;
      e.group.scale.setScalar(sc2); e.group.position.set((((x % 1.1) + 1.1) % 1.1) * AR, 1 - fy2, zOf(fy2) - 0.2); e.group.rotation.y = e.flat ? 0 : walk ? 0 : -Math.PI / 2 + Math.sin(i) * 0.25; e.set(t, e.flat && walk ? { mood: 'walk', dir, dist: (t * spd * AR) / Math.max(0.05, sc2) } : e.flat && ctr ? { mood: 'queue', dir: qd } : S.crowd.mood); });
    // baraat: groom's safa + confetti
    confetti.forEach((m, i) => { m.visible = !!(S.baraat && S.baraat.active); if (!m.visible) return; const y = 1.05 - (((t * (0.09 + (i % 5) * 0.012)) + i * 0.137) % 1.15); m.position.x = ((i * 0.618) % 1) * AR + Math.sin(t * 1.7 + i) * 0.02; m.position.y = y; m.rotation.set(t * 2 + i, t * 3 + i * 0.5, 0); });
    // talk / look / gestures
    flatState = { vis, st, cups: [], tableCups: [], leash: null, served: p.ev.some((e) => e.kind === 'give' && CUP.test(e.item || '')) }; st_ = (id) => st[id] || {};
    let lastLine = null; for (const x of tl.lines) if (x.scene === sc.index && x.start <= t) lastLine = x;
    for (const id of vis) {
      const c = st[id]; const a = actors[id]; const speaking = line && line.char === id;
      const others = vis.filter((x) => x !== id);
      const lookId = c.grab || (line && line.char !== id && vis.includes(line.char) ? line.char : lastLine && lastLine.char !== id && vis.includes(lastLine.char) ? lastLine.char : others[0]);
      let seatLock = false; if (c.sit > 0.5 && c.anchor && c.anchor.type === 'seat' && c.anchor.face) { c.face = c.anchor.face; seatLock = true; } else if (c.sit > 0.5 && c.anchor && c.anchor.type === 'seat') { const mate = vis.filter((o) => o !== id && st[o].sit > 0.5 && st[o].anchor && st[o].anchor.type === 'seat').sort((p_, q) => Math.abs(st[p_].x - c.x) - Math.abs(st[q].x - c.x))[0]; if (mate && Math.abs(st[mate].x - c.x) < 0.4) { c.face = st[mate].x > c.x ? 1 : -1; seatLock = true; } } // people at a table face each other
      if (!seatLock && !c.walk && !c.run && !c.inV && lookId && !c.lie && !c.swim && !c.frontal && !c.keepFace) c.face = st[lookId].x > c.x ? 1 : -1;
      const frontal = c.frontal ? 0.15 : c.anchor && (c.anchor.type === 'judge' || c.anchor.type === 'desk' || c.anchor.type === 'board') ? 0.4 : 1;
      const yaw = c.swim ? c.face * Math.PI / 2 : c.lie ? Math.PI / 2 : (c.walk || c.run) && !c.inV ? c.face * 1.4 : c.inV ? (c.ride ? Math.PI / 2 - 0.35 : 1.3) : c.face * FACE * frontal;
      const odo_ = a.flat ? odometer(id, t, S) : null; const odoD = odo_ ? odo_.d : null;
      if (odo_ && odo_.ok && !c.inV && !c.lie && !c.swim && !(c.sit > 0.5) && !c.climbed) { const v = odo_.v; // legs follow the real speed: no marching on the spot, no sliding
        if (v < 0.22) { c.walk = 0; c.run = 0; } else if (c.run || v > 2.6) { c.run = 1; c.walk = 0; } else { c.walk = 1; c.run = 0; } }
      const pp = { visible: true, back: !!c.back, pos: V3(0, 0, 0), yaw: c.back ? 0 : yaw, lie: c.lie > 0.5, walk: c.lie ? 0 : c.walk, run: c.lie ? 0 : c.run, sit: c.lie ? 0 : c.sit, drop: Math.max(0.2, a.hipY - 0.5), cuffed: c.cuffed, struggle: c.struggle, swim: c.swim, walkDist: a.flat ? odoD : c.walkDist ?? (c.run || c.walk ? t * 1.3 : null), ride: c.ride || 0, pillion: c.pillion, rideType: c.rideType, moving: !!(c.inV && S.V[c.inV.key]?.bob) };
      pp.look = lookId && !c.lie ? headPos(actors[lookId]).clone() : null;
      if (speaking) { const f = Math.floor((t - line.start) * 30); pp.mouth = line.mouth[f] || 0; pp.talk = c.walk || c.run || c.cuffed || c.inV || c.lie ? 0 : 0.5 * sm(line.start, line.start + 0.3, t) * (1 - sm(line.end - 0.3, line.end, t)); pp.emotion = line.emotion; }
      else if (lastLine && lastLine.char === id && t - lastLine.end < 2) pp.emotion = lastLine.emotion;
      const g = sc.events.find((e) => e.kind === 'gesture' && e.char === id && t >= e.t0 && t < e.t1); if (g) pp.gesture = { name: g.name, k: sm(g.t0, g.t0 + 0.3, t) * (1 - sm(g.t1 - 0.3, g.t1, t)), ph: (t - g.t0) / Math.max(0.01, g.t1 - g.t0) };
      if (c.grab) pp.gesture = { name: 'grab', k: 1 }; if (c._cuff) pp.gesture = { name: 'cuff', k: 1 }; if (c._g && c._g.k > 0) pp.gesture = c._g; if (c.swim && !c.inV) pp.gesture = { name: 'swim', k: 1 }; if (c.sleeping && c.lie > 0.5) pp.emotion = 'sleep';
      if (c.worry) pp.emotion = 'worried';
      if (a.flat) flatExtras(id, c, a, pp, t, S);
      poseAny(a, t, pp); yawOf[id] = pp.yaw; ppOf[id] = pp;
    }
    safa.visible = false; if (S.baraat && vis.includes(S.baraat.groom)) { const hp = headPos(actors[S.baraat.groom]); const hs = holders[S.baraat.groom].h.scale.x; safa.visible = true; safa.position.set(hp.x, hp.y + 0.15 * hs, hp.z + 0.01); safa.scale.setScalar(hs * 1.05); }
    if (tl.flat) placeFlatProps(t, S, vis);
    // props + handcuffs
    for (const p_ of Object.values(P)) p_.visible = false;
    for (const id of vis) { const ev = sc.events.find((e) => e.kind === 'gesture' && e.char === id && t >= e.t0 && t < e.t1); const g = st[id]._g?.item ? { name: st[id]._g.item === 'money' ? 'money' : st[id]._g.item === 'laddu' ? 'laddu' : CUP.test(st[id]._g.item) ? 'cup' : 'give' } : ev || (st[id]._g && P[st[id]._g.name] && !['give', 'receive'].includes(st[id]._g.name) ? { name: st[id]._g.name } : null); const pr = g && P[g.name]; if (!pr || pr.visible) continue; if (actors[id].flat && pr === P.cup) continue;
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
    // v1.5 festivals / travel / underwater
    { for (const m of Object.values(pool)) m.visible = false;
      if (S.FX.garba?.active) for (const id of S.FX.garba.ds) { if (!vis.includes(id)) continue; const sticks = [take('dl', id, FPK.dandiya), take('dr', id, FPK.dandiya)]; ['Left', 'Right'].forEach((sd, i) => { const hp = handPos(actors[id], sd); const m = sticks[i]; m.visible = true; m.position.set(hp.x, hp.y, hp.z + 0.03); m.scale.setScalar(holders[id].h.scale.x); m.rotation.z = (i ? -1 : 1) * (0.7 + Math.sin(t * 6) * 0.3); }); }
      for (const id of vis) if (st[id].rakhi && !st[id].inV) { const r = take('rk', id, FPK.rakhi); const hp = handPos(actors[id]); r.visible = true; r.position.set(hp.x, hp.y + 0.006, hp.z + 0.04); r.scale.setScalar(holders[id].h.scale.x * 1.1); }
      const X = S.FX.xmas; xtree.visible = !!X; if (X) { const fy = rowY(b, 0.85); const s2 = heightAt(b, fy) / 1.7; xtree.position.set(0.86 * AR, 1 - fy, zOf(fy)); xtree.scale.setScalar(s2 * X.k); xtree.userData.lights.forEach((l, i) => { l.material.opacity = (Math.floor(t * 3) + i) % 3 ? 1 : 0.3; });
        if (X.caps) for (const id of vis) { const cap = take('cap', id, FPK.santa); const hp = headPos(actors[id]); const hs = holders[id].h.scale.x; cap.visible = true; cap.position.set(hp.x, hp.y + 0.16 * hs, hp.z + 0.01); cap.scale.setScalar(hs); cap.rotation.z = -st[id].face * 0.25; } }
      lights.group.visible = lights.group.visible || !!X || !!S.FX.garba?.active; if (X || S.FX.garba?.active) lights.set(t, AR);
      const E = S.FX.eid; moon.visible = !!E; lanterns.forEach((l, i) => { l.visible = !!E; if (E) { l.position.set(((i + 0.5) / lanterns.length) * AR, 0.9 - (i % 2) * 0.03 + Math.sin(t * 1.2 + i) * 0.004, 46); l.scale.setScalar(0.9); } }); if (E) { moon.position.set(0.82 * AR, 0.86, 6); moon.scale.setScalar(1.3); }
      const holes = !!b.windowHoles; const M = S.FX.moving || (holes ? { kind: b.windowView || 'train', still: true } : null); const wm = M && p.ms.find((m) => m.type === 'window'); winMesh.visible = !!wm; if (wm) { drawWin(M.kind); const w = wm.w || 0.3, top = wm.cover ?? wm.y - 0.25; winMesh.position.set(wm.x * AR, 1 - (top + wm.y) / 2, holes ? -101 : -99); winMesh.scale.set(w * AR, wm.y - top, 1); winTex.offset.x = M.still ? 0.3 : (t * (M.kind === 'plane' ? 0.03 : 0.25)) % 1; winTex.repeat.x = Math.min(1, (w * AR) / (wm.y - top) / 4); }
      const UW = sc.weather === 'underwater'; fish.group.visible = weeds.group.visible = UW; if (UW) { fish.set(t, AR); weeds.set(t, AR); } }
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
    if (tl.flat && ['ots', 'cu', 'react'].includes(shot.type) && shot.char && vis.includes(shot.char) && !S.chasing) { // flat style: close shots are zooms into the real scene (2D cartoon framing)
      let who = shot.char; let lid = shot.listener && vis.includes(shot.listener) ? shot.listener : null;
      if (lid && Math.abs(st[lid].x - st[who].x) > 0.36) { if (shot.type === 'react') who = lid; lid = null; } // far apart: stay on the speaker
      const hp = headPos(actors[who]); const push = 1 + 0.05 * sm(shot.t0, shot.t1, t);
      if (shot.type === 'ots' && lid) { const ho = headPos(actors[lid]); zoom = 1.75 * push; cx = hp.x * 0.62 + ho.x * 0.38; cy = Math.max(hp.y, ho.y) - 0.13; }
      else { zoom = 2.3 * push; cx = hp.x; cy = hp.y - 0.07; } }
    if (S.shake) { cx += Math.sin(t * 23) * 0.003; cy += Math.sin(t * 31) * 0.003; }
    const hw = AR / 2 / zoom, hh = 0.5 / zoom; cx = Math.min(AR - hw, Math.max(hw, cx)); cy = Math.min(1 - hh, Math.max(hh, cy));
    cam.left = cx - hw; cam.right = cx + hw; cam.top = cy + hh; cam.bottom = cy - hh; cam.updateProjectionMatrix();
    // cinematic shots (fall back to the stage camera when the people are in vehicles, lying, swimming…)
    const cine = !tl.flat && ['ots', 'cu', 'react'].includes(shot.type) && shot.char && vis.includes(shot.char) && !st[shot.char].inV && !st[shot.char].lie && !st[shot.char].swim && !st[shot.char].climbed && !S.chasing;
    if (cine) { const sid = shot.char; const lid = shot.listener && vis.includes(shot.listener) && !st[shot.listener].inV && !st[shot.listener].lie ? shot.listener : null; const ots = shot.type === 'ots' && lid;
      for (const id of Object.keys(actors)) holders[id].h.visible = id === sid || (ots && id === lid);
      const side = lid ? (st[lid].x < st[sid].x ? -1 : 1) : (st[sid].face > 0 ? -1 : 1); // where the listener is (camera side)
      const place = (id, pos, yaw) => { const { h, pivot } = holders[id]; h.scale.setScalar(1); h.position.copy(pos); pivot.rotation.z = 0; pivot.position.set(0, 0, 0); h.rotation.y = actors[id].flat ? 0 : yaw - (yawOf[id] || 0); h.updateMatrixWorld(true); };
      const lSat = lid && st[lid].sit > 0.5; place(sid, RIG.clone(), side * 0.38); if (ots) place(lid, RIG.clone().add(V3(side * (tl.flat ? 0.82 : 0.6), lSat ? 0.35 : 0, tl.flat ? 0.55 : 1.25)), Math.PI + side * 0.5);
      // re-pose with the new positions: the speaker looks at the listener (or near the camera), the listener at the speaker
      const repose = (id, target) => { const pp = ppOf[id]; if (!pp) return; pp.look = target; if (actors[id].flat) { pp.holdF = pp.holdB = null; pp.back = id !== sid; pp.yaw = id === sid ? side * 0.2 : -side; pp.walk = pp.run = 0; } poseAny(actors[id], t, pp); if (actors[id].flat) pp.back = false; };
      repose(sid, lid && ots ? headPos(actors[lid]) : V3(RIG.x + side * 0.6, headPos(actors[sid]).y, 2.5)); if (ots) repose(lid, headPos(actors[sid]));
      if (tl.flat) { for (const q of flatState.cups) if (q.id === sid || q.id === lid) q.mir = mirrorOf(ppOf[q.id]?.yaw || 0); else q.show = false; placeFlatProps(t, { FX: {} }, [sid, lid].filter(Boolean)); }
      const sat = st[sid].anchor && (st[sid].anchor.type === 'judge' || st[sid].anchor.type === 'desk'); bench.visible = benchTop.visible = !!sat;
      board.material.map = blurTex[sc.background] || null; board.material.needsUpdate = true; board.material.color.set(tint[0]).lerp(new THREE.Color(0xffffff), 0.55);
      const hp = headPos(actors[sid]); const look = hp.clone().add(V3(0, -0.04, 0));
      look.y = hp.y + 0.02; if (ots) { rigCam.fov = 30; rigCam.position.set(RIG.x + side * (tl.flat ? 0.5 : 0.95), Math.max(hp.y, headPos(actors[lid]).y) + 0.08, 2.9); }
      else { rigCam.fov = shot.type === 'react' ? 24 : 26; rigCam.position.set(RIG.x + side * 0.45, hp.y + 0.06, 2.15); look.y = hp.y - 0.06; }
      rigCam.aspect = AR; rigCam.updateProjectionMatrix(); rigCam.lookAt(look);
      if (bgTex[sc.background]) { // close shots: the real background, sharp, cropped around the people talking (no blur)
        const id = sc.background; sharpTex[id] ||= (() => { const c = bgTex[id].clone(); c.wrapS = c.wrapT = THREE.ClampToEdgeWrapping; c.needsUpdate = true; return c; })(); const tx = sharpTex[id]; const f = fit[id];
        const fyS = st[sid].feetY ?? rowY(b, st[sid].row); const hS = heightAt(b, fyS); const cw = ots ? 0.62 : 0.44, ch = cw;
        let cx = ots && lid ? (st[sid].x * 0.65 + st[lid].x * 0.35) : st[sid].x, cy = fyS - hS * 0.62; cx = Math.min(1 - cw / 2, Math.max(cw / 2, cx)); cy = Math.min(1 - ch / 2, Math.max(ch / 2, cy));
        tx.repeat.set(f.rx * cw, f.ry * ch); tx.offset.set(f.ox + f.rx * (cx - cw / 2), f.oy + f.ry * (1 - (cy + ch / 2)));
        board.material.map = tx; board.material.color.set(tint[0]); board.material.needsUpdate = true;
        const D = 7, hh_ = 2 * D * Math.tan((rigCam.fov * Math.PI) / 360) * 1.02; const dir = V3(0, 0, -1).applyQuaternion(rigCam.quaternion);
        board.position.copy(rigCam.position).addScaledVector(dir, D); board.quaternion.copy(rigCam.quaternion); board.scale.set((hh_ * AR) / 26, hh_ / 15, 1);
        board.material.alphaTest = 0.5; board2.visible = !!b.windowHoles; if (b.windowHoles) { drawWin(b.windowView || 'train'); board2.material.map = winTex; board2.position.copy(rigCam.position).addScaledVector(dir, D + 0.3); board2.quaternion.copy(rigCam.quaternion); board2.scale.copy(board.scale); } }
      else board2.visible = false;
      outline.render(scene, rigCam); return; }
    bench.visible = benchTop.visible = false;
    if (shot.type === 'cake' && S.FX.birthday) { const tfy = rowY(b, 0.22); const ts = heightAt(b, tfy) / 1.7; zoom = 2.6; cx = 0.5 * AR; cy = 1 - tfy + 1.0 * ts; const hw2 = AR / 2 / zoom, hh2 = 0.5 / zoom; cam.left = cx - hw2; cam.right = cx + hw2; cam.top = cy + hh2; cam.bottom = cy - hh2; cam.updateProjectionMatrix(); }
    doodles(t, S, sc, b, line, vis, st);
    outline.render(scene, cam);
  }
  // ---- Bean Night doodles: speech bubbles, battery meter, big words, red worry notes, dream cloud (all styles can use them) ----
  const DD = { bubble: new Map(), big: new Map(), notes: new Map(), dream: new Map(), dots: [], battery: null, dim: null }; const OVZ = 48;
  const ddAll = () => [...DD.bubble.values(), ...DD.big.values(), ...DD.notes.values(), ...DD.dream.values(), ...DD.dots, DD.battery, DD.dim].filter(Boolean);
  const keep = (map, key, make, max = 40) => { let m = map.get(key); if (!m) { m = make(); scene.add(m); map.set(key, m); if (map.size > max) { const [k0, m0] = map.entries().next().value; if (k0 !== key) { scene.remove(m0); m0.material.map?.dispose(); m0.material.dispose(); map.delete(k0); } } } return m; };
  const lineText = (l) => { const lg = tl.bubbleLang || 'hinglish'; return String((lg === 'hindi' ? l.hindi : lg === 'english' ? l.english : l.hinglish) || l.hinglish || l.hindi || l.english || '').trim(); };
  const isShadow = (id) => !!actors[id]?.shadow;
  const battEv = tl.scenes.flatMap((x) => x.events.filter((e) => e.kind === 'battery')).sort((a_, b_) => a_.t0 - b_.t0);
  function topOf(id) { const hp = headPos(actors[id]); const s = holders[id].h.scale.x; const r = actors[id].parts?.headR || 0.15; return { x: hp.x, y: hp.y + r * s * 1.45, s }; }
  function put(m, x, y, h, sc = 1, z = OVZ) { const vw = cam.right - cam.left, vh = cam.top - cam.bottom; const w = h * m.userData.aspect; const mg = vh * 0.02;
    x = Math.min(cam.right - w / 2 - mg, Math.max(cam.left + w / 2 + mg, x)); y = Math.min(cam.top - h / 2 - mg, Math.max(cam.bottom + h / 2 + mg, y)); m.visible = true; m.scale.set(w * sc, h * sc, 1); m.position.set(x, y, z); return { x, y, w, h, vw }; }
  function doodles(t, S, sc, b, line, vis, st) {
    for (const m of ddAll()) m.visible = false; const vh = cam.top - cam.bottom, px = vh / 720; // one output pixel (720p) in world units
    for (const id of vis) if (actors[id].aura) actors[id].aura.material.opacity = 0.7 + Math.sin(t * 2.4) * 0.15;
    const pop = (t0) => { const q = Math.min(1, Math.max(0, (t - t0) / 0.22)); return q < 1 ? 0.6 + 0.55 * Math.sin(q * Math.PI * 0.75) : 1; };
    // battery meter (above that person, or the top-left corner)
    let battTop = null; const be = battEv.filter((e) => e.t0 <= t && e.t0 >= sc.start - 0.01).pop();
    if (be && t < be.t0 + 3.4) { const prev = battEv[battEv.indexOf(be) - 1]; const v0 = prev ? prev.value : be.value; const v = lerp(v0, be.value, sm(be.t0 + 0.2, be.t0 + 1.0, t)); DD.battery ||= (() => { const m = makeBattery(); scene.add(m); return m; })(); DD.battery.userData.set(Math.round(v), be.color);
      const fade = 1 - sm(be.t0 + 3.0, be.t0 + 3.4, t); DD.battery.material.opacity = fade; const h = 70 * px; if (be.char && vis.includes(be.char)) { const tp = topOf(be.char); battTop = { id: be.char, y: tp.y + h }; put(DD.battery, tp.x, tp.y + h * 0.55, h, pop(be.t0)); } else put(DD.battery, cam.left + h * 2, cam.top - h, h, pop(be.t0)); }
    // speech bubble: the line in chunks above the speaker (inner voice: red glowing words); narrator at the bottom
    if (tl.bean && line) { const txt = lineText(line); const words = txt.split(/\s+/).filter(Boolean); const per = 9; const n = Math.max(1, Math.ceil(words.length / per)); const q = Math.min(n - 1, Math.floor(((t - line.start) / Math.max(0.1, line.end - line.start)) * n));
      const chunk = words.slice(q * per, (q + 1) * per).join(' '); const who = line.char; const red = isShadow(who);
      if (chunk) { const m = keep(DD.bubble, `${line.id}:${q}`, () => makeBubble(chunk, { red })); const H_ = (red ? 0.85 : 0.55) * px * (m.material.map.image.height); const t0 = q === 0 ? line.start : -9;
        if (who !== 'narrator' && vis.includes(who)) { const tp = topOf(who); const y0 = battTop && battTop.id === who ? battTop.y + 10 * px : tp.y + 14 * px; put(m, tp.x, y0 + H_ / 2, H_, pop(t0)); m.material.opacity = 1 - sm(line.end - 0.08, line.end + 0.12, t); }
        else put(m, (cam.left + cam.right) / 2, cam.bottom + H_ / 2 + 30 * px, H_, 1); } }
    // big words ("GO!")
    for (const e of sc.events) if (e.kind === 'big_text' && t >= e.t0 && t < e.t1) { const m = keep(DD.big, e.text + '|' + (e.color || ''), () => makeBigText(e.text, e.color || '#f2f2f2')); put(m, (cam.left + cam.right) / 2, (cam.top + cam.bottom) / 2 + vh * 0.12, vh * 0.3, pop(e.t0) * (1 + 0.04 * Math.sin((t - e.t0) * 9))); m.material.opacity = 1 - sm(e.t1 - 0.3, e.t1, t); }
    // worry attack: red sticky notes appear one by one around the person, the room goes dark
    const TH = S.FX.thoughts; if (TH && vis.includes(TH.char)) { const items = TH.items.length ? TH.items : ['sab dekh rahe hain', 'late ho gaya', 'galat ho jayega', 'kya sochenge log', 'main fail hoon', 'peeche mudo', 'bhaag jao', 'sab hasenge'];
      const N = Math.min(18, Math.max(10, items.length)); const dur = Math.max(1.5, TH.until - TH.t0); const out = 1 - sm(TH.until, TH.until + 0.45, t); const hp = headPos(actors[TH.char]);
      DD.dim ||= (() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x050002, transparent: true, depthWrite: false, toneMapped: false })); m.userData.outlineParameters = { visible: false }; m.material.userData.outlineParameters = { visible: false }; scene.add(m); return m; })();
      DD.dim.visible = true; DD.dim.material.opacity = 0.5 * sm(TH.t0, TH.t0 + 0.8, t) * out; DD.dim.scale.set(AR * 2, 2, 1); DD.dim.position.set(AR / 2, 0.5, 5);
      for (let i = 0; i < N; i++) { const at = TH.t0 + 0.3 + i * Math.min(0.32, (dur * 0.7) / N); if (t < at) continue; const m = keep(DD.notes, TH.char + ':' + i + ':' + items[i % items.length], () => makeNote(items[i % items.length], i), 60);
        const ang = i * 2.39996 + 0.4, rad = 0.3 + 0.6 * ((i * 0.618) % 1); const vw = cam.right - cam.left; const x = hp.x + Math.cos(ang) * rad * vw * 0.42 + Math.sin(t * 1.3 + i) * 4 * px, y = hp.y + Math.sin(ang) * rad * vh * 0.42 + Math.cos(t * 1.1 + i * 2) * 4 * px;
        put(m, x, y, 128 * px, pop(at) * out, OVZ - 1 + i * 0.01); m.rotation.z = (((i * 0.37) % 1) - 0.5) * 0.5; } }
    // dream / imagination: a red-glowing cloud above the dreamer with the place and the people in it
    const DR = S.FX.dream; if (DR && vis.includes(DR.char)) { const want = String(DR.bg || '').toLowerCase(); const bgs = tl.backgrounds || {};
      const bid = bgs[DR.bg] ? DR.bg : Object.keys(bgs).find((k) => want && (k.toLowerCase().includes(want) || String(bgs[k].name || '').toLowerCase().includes(want) || String(bgs[k].place || '').toLowerCase().includes(want))) || sc.background;
      const nf = Math.min(4, (DR.with || []).length); const m = keep(DD.dream, bid + ':' + nf, () => makeDreamCloud(bgTex[bid]?.image, nf), 6); const tp = topOf(DR.char);
      const grow = sm(DR.t0 + 0.5, DR.t0 + 1.2, t) * (1 - sm(DR.until, DR.until + 0.6, t)); const vw = cam.right - cam.left; const side = tp.x < (cam.left + cam.right) / 2 ? 1 : -1; const H_ = vh * 0.52;
      const cx_ = Math.min(cam.right - H_ * 0.8, Math.max(cam.left + H_ * 0.8, tp.x + side * vw * 0.2)); const cy_ = Math.min(cam.top - H_ / 2 - vh * 0.03, tp.y + vh * 0.2 + H_ * 0.3) + Math.sin(t * 1.2) * 3 * px;
      if (grow > 0.01) put(m, cx_, cy_, H_, grow);
      for (let i = 0; i < 3; i++) { const d = DD.dots[i] || (DD.dots[i] = (() => { const x = makeDot(); scene.add(x); return x; })()); const k = sm(DR.t0 + i * 0.18, DR.t0 + 0.2 + i * 0.18, t) * (1 - sm(DR.until, DR.until + 0.5, t)); if (k < 0.01) continue;
        const f = (i + 1) / 4; put(d, lerp(tp.x, cx_ - side * H_ * 0.45, f), lerp(tp.y + 6 * px, cy_ - H_ * 0.4, f), (14 + i * 9) * px, k); } }
  }
  function doorWorld(m, seat) { if (m.doors) { const sx = m.seats[Math.min(seat, m.seats.length - 1)][0]; return m.doors.reduce((b_, d) => (Math.abs(d - sx) < Math.abs(b_ - sx) ? d : b_), m.doors[0]); } return seat > 0 && m.seats[1] ? m.seats[1][0] : m.doorX; }
  return { renderAt };
}
