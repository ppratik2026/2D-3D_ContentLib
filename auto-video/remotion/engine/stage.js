// 2D Cartoon Stage: a painted background image + characters drawn flat (toon shading, black outline) standing on
// the background's ground line, like Indian 2D cartoon story channels. Orthographic camera: x 0..AR, y 0..1 (image space).
// Also: vehicles (drive in / get in / chase), foot chases, catching + handcuffs, place markers (judge, desk, witness box,
// bed, jail cell…) with "cover" patches cut from the background so people stand behind desks and benches.
import * as THREE from 'three';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';
import { loadActorKit, createActor, poseActor, headPos, handPos } from './actors.js';
import { makeVehicle } from './vehicles.js';

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
  for (const v of tl.vehicles || []) { const m = makeVehicle(v.type, v.color, grad); m.group.visible = false; scene.add(m.group); vehicles[v.key] = m; }
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
    const inside = {}; // characters who start the scene inside a vehicle
    for (const e of ev) { if (e.kind === 'drive_in' || e.kind === 'car_chase') { [e.char, ...(e.with || [])].forEach((id, i) => { if (id && !(id in inside)) inside[id] = { key: e.vehicle, seat: i }; }); if (e.kind === 'car_chase' && e.chaser) (e.chasers || []).forEach((id, i) => { if (!(id in inside)) inside[id] = { key: e.chaser, seat: i }; }); } }
    // markers taken by role at the start (only for people standing in the scene at the start)
    const anchor = {}; const used = new Set();
    for (const [type, re] of ROLE) for (const m of ms.filter((x) => x.type === type)) {
      if (used.has(m.i)) continue; const id = sc.initial.find((c) => !anchor[c] && !(c in inside) && re.test(roleOf[c] || '')); if (id) { anchor[id] = m; used.add(m.i); }
    }
    const parked = vkeys.some((k) => { const f = ev.find((e) => e.vehicle === k || e.chaser === k); return f && f.kind !== 'drive_in' && f.kind !== 'car_chase'; });
    const free = sc.cast.filter((c) => !anchor[c]); const busy = Object.values(anchor).map((m) => { const w = m.w || 0.12; return [m.x - w / 2, m.x + w / 2]; }); const sp = spots(free, parked, busy);
    // when a chase ends, the next movement of the scene
    for (const e of ev) if (e.kind === 'car_chase' || e.kind === 'foot_chase') { const nx = ev.find((x) => x.t0 >= e.t1 - 0.01 && x !== e && x.kind !== 'gesture'); e._until = Math.max(e.t1, nx ? nx.t0 : sc.end - 0.4); }
    const p = { b, ms, ev, vkeys, chase, involved, inside, anchor, sp, parked }; plan.set(sc, p); return p;
  }
  const PARK = { x: 0.8, row: 1 }; const VSCALE = 0.85;
  function stateAt(sc, t) {
    const p = planOf(sc); const b = p.b;
    const C = {}, V = {}; let scroll = 0, chasing = null, shake = 0;
    p.vkeys.forEach((k, i) => { const f = p.ev.find((e) => e.vehicle === k || e.chaser === k); const visible = f && f.kind !== 'drive_in' && f.kind !== 'car_chase'; const park = [0.78, 0.3, 0.55][i % 3]; V[k] = { visible, park, x: park, row: PARK.row, spin: 0, door: 0, siren: false, bob: 0, used: 0 }; });
    for (const id of sc.cast) {
      const s = p.sp[id] || { x: 0.5, row: 0 }; const an = p.anchor[id];
      C[id] = { visible: sc.initial.includes(id), x: an ? an.x : s.x, row: s.row, home: s, feetY: an ? an.y : null, face: s.x < 0.5 ? 1 : -1, walk: 0, run: 0, sit: an && SIT_TYPES.has(an.type) ? 1 : 0, lie: 0, anchor: an || null, inV: null, inK: 0, cuffed: false, grab: null, struggle: 0 };
      if (an && an.type === 'bed') C[id].lie = 1;
      if (p.inside[id]) { C[id].inV = p.inside[id]; C[id].inK = 1; C[id].visible = false; }
    }
    const feet = (c) => c.feetY ?? rowY(b, c.row);
    const vFeet = (v) => rowY(b, v.row);
    const vScale = (v) => (heightAt(b, vFeet(v)) / 1.7) * VSCALE;
    const doorX = (k, seat) => { const v = V[k], m = vehicles[k]; const s = vScale(v); const dx = seat > 0 && m.seats[1] ? m.seats[1][0] : m.doorX; return v.x + (dx * s) / AR; };
    const side = (x) => (x < 0.5 ? -0.1 : 1.1);
    for (const e of p.ev) {
      if (t < e.t0) break; const until = e._until ?? e.t1; const k = Math.min(1, (t - e.t0) / Math.max(0.01, e.t1 - e.t0)), done = t >= e.t1;
      const c = C[e.char];
      const go = (cc, x0, x1, run, kk = k) => { cc.x = lerp(x0, x1, kk); if (kk < 1 && Math.abs(x1 - x0) > 0.005) { cc.face = x1 > x0 ? 1 : -1; cc[run ? 'run' : 'walk'] = 1; } else cc.walk = cc.run = 0; };
      const free = (cc) => { cc.anchor = null; cc.feetY = null; cc.sit = 0; cc.lie = 0; };
      if (e.kind === 'gesture') continue;
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
        case 'drive_in': { const v = V[e.vehicle]; if (!v) break; v.visible = true; const kk = 1 - (1 - k) * (1 - k); v.x = lerp(-0.7, v.park, kk); v.row = PARK.row; v.spin += (v.x + 0.7) * AR / vScale(v); v.siren = vehicles[e.vehicle].lights.length > 0 && !done; v.bob = done ? 0 : 1; break; }
        case 'drive_away': { const v = V[e.vehicle]; if (!v) break; const x0 = v.x; v.x = lerp(x0, 1.8, k * k); v.spin += (v.x - x0) * AR / vScale(v); v.siren = vehicles[e.vehicle].lights.length > 0; v.bob = 1; if (done) v.visible = false; break; }
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
        case 'sleep': c.lie = sm(0, 0.6, k); c.sit = 0; c.walk = c.run = 0; c.sleeping = true; break;
        default: break;
      }
    }
    return { C, V, scroll, chasing, shake };
  }
  const TINT = { day: [0xffffff, 1.6, 1.3], morning: [0xfff1dc, 1.5, 1.2], evening: [0xffd2a0, 1.3, 1.0], night: [0x9fb2ff, 0.85, 0.55] };

  function renderAt(t) {
    const sc = sceneAt(t); const p = planOf(sc); const b = p.b; const tex = bgTex[sc.background] || null; bgMat.map = tex; bgMat.needsUpdate = true;
    const S = stateAt(sc, t);
    if (tex) { const f = fit[sc.background]; tex.offset.x = f.ox + S.scroll * f.rx; }
    for (const [id, g] of Object.entries(coverGroups)) g.visible = id === sc.background;
    const tint = TINT[sc.time_of_day] || TINT.day; hemi.color.set(tint[0]); hemi.intensity = tint[1]; key.color.set(tint[0]); key.intensity = tint[2];
    const line = lineAt(t);
    // vehicles
    for (const [k, m] of Object.entries(vehicles)) { const v = S.V[k]; m.group.visible = !!(v && v.visible); if (!m.group.visible) continue;
      const fy = rowY(b, v.row); const s = (heightAt(b, fy) / 1.7) * VSCALE; m.group.scale.setScalar(s); m.group.position.set(v.x * AR, 1 - fy + (v.bob ? Math.abs(Math.sin(t * 17 + k.length)) * 0.004 : 0), zOf(fy) - 0.4); m.set(t, { spin: v.spin, door: v.door, siren: v.siren }); }
    // characters
    for (const id of Object.keys(actors)) holders[id].h.visible = false;
    const st = S.C; const vis = [];
    for (const [id, c] of Object.entries(st)) {
      const { h, pivot, sh, clip } = holders[id]; const a = actors[id]; clip.constant = 1e5;
      let show = c.visible; let px, py, pz, sc_;
      if (c.inV && S.V[c.inV.key]) { const v = S.V[c.inV.key], m = vehicles[c.inV.key]; show = v.visible && (c.visible || c.inK > 0 || true); const fy = rowY(b, v.row); const s = (heightAt(b, fy) / 1.7) * VSCALE; const seat = m.seats[Math.min(c.inV.seat, m.seats.length - 1)];
        const dX = v.x * AR + (c.inK < 1 ? (doorWorld(m, c.inV.seat) * (1 - c.inK) + seat[0] * c.inK) : seat[0]) * s; px = dX; py = 1 - fy + (seat[1] - 0.5) * s * c.inK + (v.bob ? Math.abs(Math.sin(t * 17)) * 0.004 : 0); pz = zOf(fy) - 0.4 + lerp(1.1, -0.05, c.inK) * s; sc_ = s; c.face = 1; c.sit = c.inK; c.walk = 0; sh.visible = false;
        if (c.inK > 0.98) c.visible = true; clip.constant = -(1 - fy + 0.36 * s); }
      else { const fy = c.feetY ?? rowY(b, c.row); sc_ = c.anchor && c.anchor.type === 'bed' ? ((c.anchor.w || 0.3) * AR * 0.8) / 1.7 : heightAt(b, fy) / 1.7; px = c.x * AR; py = 1 - fy; pz = zOf(fy); sh.visible = c.lie < 0.5; }
      if (!show) continue; h.visible = true; vis.push(id);
      const childK = a.height / 1.7; h.scale.setScalar((sc_ * 1.7 * childK) / a.height); h.position.set(px, py, pz);
      // lying down: roll the body flat, head towards the left
      pivot.rotation.z = c.lie * Math.PI / 2; pivot.position.set(c.lie * 0.85, c.lie * 0.12, 0);
    }
    // talk / look / gestures
    let lastLine = null; for (const x of tl.lines) if (x.scene === sc.index && x.start <= t) lastLine = x;
    for (const id of vis) {
      const c = st[id]; const a = actors[id]; const speaking = line && line.char === id;
      const others = vis.filter((x) => x !== id);
      const lookId = c.grab || (line && line.char !== id && vis.includes(line.char) ? line.char : lastLine && lastLine.char !== id && vis.includes(lastLine.char) ? lastLine.char : others[0]);
      if (!c.walk && !c.run && !c.inV && lookId && !c.lie) c.face = st[lookId].x > c.x ? 1 : -1;
      const frontal = c.anchor && (c.anchor.type === 'judge' || c.anchor.type === 'desk' || c.anchor.type === 'board') ? 0.4 : 1;
      const yaw = c.lie ? Math.PI / 2 : c.inV ? 1.3 : c.face * FACE * frontal;
      const pp = { visible: true, pos: V3(0, 0, 0), yaw, lie: c.lie > 0.5, walk: c.lie ? 0 : c.walk, run: c.lie ? 0 : c.run, sit: c.lie ? 0 : c.sit, drop: Math.max(0.2, a.hipY - 0.5), cuffed: c.cuffed, struggle: c.struggle };
      pp.look = lookId && !c.lie ? headPos(actors[lookId]).clone() : null;
      if (speaking) { const f = Math.floor((t - line.start) * 30); pp.mouth = line.mouth[f] || 0; pp.talk = c.walk || c.run || c.cuffed || c.inV || c.lie ? 0 : 0.5 * sm(line.start, line.start + 0.3, t) * (1 - sm(line.end - 0.3, line.end, t)); pp.emotion = line.emotion; }
      else if (lastLine && lastLine.char === id && t - lastLine.end < 2) pp.emotion = lastLine.emotion;
      const g = sc.events.find((e) => e.kind === 'gesture' && e.char === id && t >= e.t0 && t < e.t1); if (g) pp.gesture = { name: g.name, k: sm(g.t0, g.t0 + 0.3, t) * (1 - sm(g.t1 - 0.3, g.t1, t)) };
      if (c.grab) pp.gesture = { name: 'grab', k: 1 }; if (c._cuff) pp.gesture = { name: 'cuff', k: 1 }; if (c._g && c._g.k > 0) pp.gesture = c._g; if (c.sleeping && c.lie > 0.5) pp.emotion = 'sleep';
      poseActor(a, t, pp);
    }
    // props + handcuffs
    for (const p_ of Object.values(P)) p_.visible = false;
    for (const id of vis) { const ev = sc.events.find((e) => e.kind === 'gesture' && e.char === id && t >= e.t0 && t < e.t1); const g = st[id]._g?.item ? { name: st[id]._g.item === 'money' ? 'money' : 'give' } : ev; const pr = g && P[g.name]; if (!pr || pr.visible) continue;
      const hp = pr.userData.mid ? handPos(actors[id], 'Left').add(handPos(actors[id])).multiplyScalar(0.5) : handPos(actors[id], pr.userData.hand || 'Right'); const s = holders[id].h.scale.x; pr.visible = true; pr.position.copy(hp); pr.scale.setScalar(s * (actors[id].height / 1.7)); pr.position.z += 0.02;
      if (pr.userData.rot) { pr.rotation.set(0, 0, pr.userData.rot * st[id].face); continue; }
      pr.rotation.set(0, 0, g.name === 'torch' ? (st[id].face > 0 ? -0.35 : Math.PI + 0.35) : 0); if (g.name === 'gavel') pr.rotation.z = 0.6; }
    for (const [id, c] of Object.entries(st)) { if (!c.cuffed && !cuffs[id]) continue; cuffs[id] ||= cuffMesh(); const m = cuffs[id]; m.visible = c.cuffed && vis.includes(id) && !c.inV; if (!m.visible) continue;
      const l = handPos(actors[id], 'Left'), r = handPos(actors[id], 'Right'); m.position.copy(l).add(r).multiplyScalar(0.5); m.position.z += 0.03; m.scale.setScalar(holders[id].h.scale.x * 1.3); m.rotation.set(0, 0, Math.atan2(r.y - l.y, r.x - l.x)); }
    // speed lines
    for (let i = 0; i < speed.length; i++) { const l = speed[i]; l.visible = !!S.chasing; if (!l.visible) continue; const sp = S.chasing.kind === 'car' ? 3.2 : 1.8; const y = 0.15 + ((i * 0.618) % 1) * 0.75; l.position.x = AR + 0.3 - ((t * sp + i * 0.37) % 1) * (AR + 0.6); l.position.y = y; }
    // camera: wide / two-shot / speaker / vehicle / hands (cuts, like TV cartoons)
    let shot = { type: 'wide' }; for (const x of tl.shots) if (t >= x.t0 && t < x.t1) shot = x;
    let zoom = 1 + 0.04 * sm(sc.start, sc.end ?? sc.start + 20, t), cx = AR / 2, cy = 0.5;
    if ((shot.type === 'speaker' || shot.type === 'two') && shot.char && vis.includes(shot.char)) {
      const hp = headPos(actors[shot.char]);
      if (shot.type === 'speaker') { zoom = 1.75; cx = hp.x; cy = hp.y - 0.12; }
      else { const o = vis.filter((x) => x !== shot.char).sort((p_, q) => Math.abs(st[p_].x - st[shot.char].x) - Math.abs(st[q].x - st[shot.char].x))[0]; const ho = o ? headPos(actors[o]) : hp; zoom = 1.35; cx = (hp.x + ho.x) / 2; cy = (hp.y + ho.y) / 2 - 0.15; }
    } else if (shot.type === 'vehicle' && vehicles[shot.vehicle]?.group.visible) { const m = vehicles[shot.vehicle]; zoom = 1.6; cx = m.group.position.x; cy = m.group.position.y + m.top * m.group.scale.x * 0.55; }
    else if (shot.type === 'hands' && shot.char && vis.includes(shot.char)) { const l = handPos(actors[shot.char], 'Left'), r = handPos(actors[shot.char], 'Right'); zoom = 2.8; cx = (l.x + r.x) / 2; cy = (l.y + r.y) / 2 + 0.02; }
    if (S.shake) { cx += Math.sin(t * 23) * 0.003; cy += Math.sin(t * 31) * 0.003; }
    const hw = AR / 2 / zoom, hh = 0.5 / zoom; cx = Math.min(AR - hw, Math.max(hw, cx)); cy = Math.min(1 - hh, Math.max(hh, cy));
    cam.left = cx - hw; cam.right = cx + hw; cam.top = cy + hh; cam.bottom = cy - hh; cam.updateProjectionMatrix();
    outline.render(scene, cam);
  }
  function doorWorld(m, seat) { return seat > 0 && m.seats[1] ? m.seats[1][0] : m.doorX; }
  return { renderAt };
}
