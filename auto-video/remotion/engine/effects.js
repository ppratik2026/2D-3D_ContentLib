// Effects and game props for the 2D stage: fire, explosion, water splash, umbrella, cricket bat / ball / stumps,
// skipping rope, kite, ladder. All deterministic from t. Fire/explosion units are world units (screen height = 1).
import * as THREE from 'three';

const noOut = (o) => { o.traverse((m) => { if (m.isMesh) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => (x.userData.outlineParameters = { visible: false })); }); return o; };
const h1 = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };

export function makeFire(n = 14) { // flames + smoke + warm glow; place with group.position, size with scale (1 = 0.3 screen tall)
  const g = new THREE.Group(); const flames = []; const smoke = [];
  const cols = [0xffd23f, 0xff9a1f, 0xff5a1f, 0xe8341c];
  for (let i = 0; i < n; i++) { const m = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.14, 7), new THREE.MeshBasicMaterial({ color: cols[i % cols.length], transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending })); g.add(m); flames.push(m); }
  for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(new THREE.CircleGeometry(0.05, 14), new THREE.MeshBasicMaterial({ color: 0x3a3a3e, transparent: true, opacity: 0.35, depthWrite: false })); g.add(m); smoke.push(m); }
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.28, 24), new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.18, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending })); glow.position.set(0, 0.06, -0.01); g.add(glow);
  noOut(g);
  return { group: g, set(t, k = 1) { // k = strength 0..1
    flames.forEach((f, i) => { const life = (t * (1.6 + h1(i, 1)) + h1(i, 2)) % 1; const x = (h1(i, 3) - 0.5) * 0.16 * (1 - life * 0.6); f.position.set(x + Math.sin(t * 9 + i) * 0.01, 0.03 + life * 0.16, i * 0.0005); f.scale.setScalar(k * (1 - life) * (0.7 + h1(i, 4) * 0.8)); f.material.opacity = 0.9 * (1 - life); });
    smoke.forEach((s, i) => { const life = (t * 0.35 + i / smoke.length) % 1; s.position.set((h1(i, 5) - 0.5) * 0.1 + life * 0.05, 0.2 + life * 0.35, -0.005); s.scale.setScalar(k * (0.6 + life * 1.8)); s.material.opacity = 0.32 * (1 - life) * k; });
    glow.scale.setScalar(k * (1 + Math.sin(t * 13) * 0.05)); glow.material.opacity = 0.18 * k; } };
}

export function makeExplosion() { // flash, fireball, smoke ring and debris; set(dt) with dt = seconds since the blast
  const g = new THREE.Group(); const add = (geo, color, op, blend) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, toneMapped: false, blending: blend ? THREE.AdditiveBlending : THREE.NormalBlending })); g.add(m); return m; };
  const flash = add(new THREE.CircleGeometry(1, 32), 0xfff4c0, 1, true); const ball = add(new THREE.CircleGeometry(0.2, 28), 0xff7b1f, 0.95, true); const core = add(new THREE.CircleGeometry(0.12, 24), 0xffe27a, 1, true);
  const puffs = Array.from({ length: 10 }, (_, i) => add(new THREE.CircleGeometry(0.09, 16), 0x3b3b40, 0.6));
  const debris = Array.from({ length: 16 }, (_, i) => add(new THREE.PlaneGeometry(0.018, 0.012), i % 3 ? 0x5a4632 : 0x2a2a2e, 1));
  noOut(g);
  return { group: g, set(dt) {
    const on = dt >= 0 && dt < 3.2; g.visible = on; if (!on) return;
    flash.scale.setScalar(0.6 + dt * 3); flash.material.opacity = Math.max(0, 0.9 - dt * 4.5);
    const fb = Math.min(1, dt / 0.35); ball.scale.setScalar(0.3 + fb * 1.4); ball.material.opacity = Math.max(0, 0.95 - Math.max(0, dt - 0.3) * 1.2); core.scale.setScalar(0.3 + fb * 1.1); core.material.opacity = Math.max(0, 1 - dt * 1.6);
    puffs.forEach((p, i) => { const a = (i / puffs.length) * Math.PI * 2; const r = 0.05 + Math.min(1, dt / 1.2) * 0.32; p.position.set(Math.cos(a) * r, 0.08 + Math.sin(a) * r * 0.6 + dt * 0.08, -0.002); p.scale.setScalar(0.8 + dt * 1.2); p.material.opacity = Math.max(0, 0.6 - Math.max(0, dt - 0.6) * 0.25); });
    debris.forEach((d, i) => { const a = h1(i, 7) * Math.PI; const v = 0.6 + h1(i, 8) * 0.8; d.position.set(Math.cos(a) * v * dt, Math.sin(a) * v * dt - 0.9 * dt * dt, 0.001); d.rotation.z = dt * 12 + i; d.material.opacity = dt < 1.6 ? 1 : 0; });
  } };
}

export function makeSplash() { const g = new THREE.Group(); const drops = Array.from({ length: 14 }, () => { const m = new THREE.Mesh(new THREE.CircleGeometry(0.006, 6), new THREE.MeshBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.85 })); g.add(m); return m; });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.036, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })); ring.scale.y = 0.3; g.add(ring); noOut(g);
  return { group: g, set(t) { drops.forEach((d, i) => { const life = (t * 1.6 + i / drops.length) % 1; const a = h1(i, 9) * Math.PI; d.position.set(Math.cos(a) * 0.06 * life, Math.sin(a) * 0.08 * life - 0.12 * life * life, 0); d.material.opacity = 0.85 * (1 - life); }); const l = (t * 0.8) % 1; ring.scale.set(1 + l * 2, 0.3 + l * 0.6, 1); ring.material.opacity = 0.6 * (1 - l); } };
}

// ---------- props (metres; parented to a hand by the stage each frame) ----------
export function makeProps(toon) {
  const P = {}; const grp = (...ms) => { const g = new THREE.Group(); ms.forEach((m) => g.add(m)); return g; };
  const mesh = (geo, c, x = 0, y = 0, z = 0, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, typeof c === 'string' ? toon(c) : c); m.position.set(x, y, z); m.rotation.x = rx; m.rotation.z = rz; return m; };
  { const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2.4), toon('#1d3f8f')); canopy.position.y = 0.72; const c2 = canopy.material.clone(); c2.side = THREE.DoubleSide; canopy.material = c2;
    P.umbrella = grp(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.95, 8), '#2a2a2e', 0, 0.42, 0), canopy, mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12, Math.PI), '#2a2a2e', 0.05, -0.04, 0, 0, Math.PI)); }
  P.bat = grp(mesh(new THREE.BoxGeometry(0.1, 0.55, 0.035), '#e3c48a', 0, -0.36, 0), mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 8), '#2a2a2e', 0, -0.02, 0));
  P.ball = mesh(new THREE.SphereGeometry(0.036, 12, 10), '#c0283a');
  P.stumps = grp(...[-0.08, 0, 0.08].map((x) => mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.72, 8), '#f1e3c2', x, 0.36, 0)), mesh(new THREE.BoxGeometry(0.2, 0.015, 0.02), '#f1e3c2', 0, 0.73, 0));
  P.rope = mesh(new THREE.TorusGeometry(0.62, 0.012, 6, 40), '#e84a5f'); P.rope.material.userData.outlineParameters = { visible: false }; // turned around the kid by the stage
  P.kite = grp(mesh(new THREE.CircleGeometry(0.22, 4), new THREE.MeshToonMaterial({ color: 0xff4d6d, side: THREE.DoubleSide }), 0, 0, 0), mesh(new THREE.PlaneGeometry(0.02, 0.3), new THREE.MeshToonMaterial({ color: 0xffd166, side: THREE.DoubleSide }), 0, -0.3, 0));
  P.ladder = grp(mesh(new THREE.BoxGeometry(0.05, 2.6, 0.05), '#a0703c', -0.22, 1.3, 0), mesh(new THREE.BoxGeometry(0.05, 2.6, 0.05), '#a0703c', 0.22, 1.3, 0), ...Array.from({ length: 8 }, (_, i) => mesh(new THREE.BoxGeometry(0.44, 0.04, 0.04), '#b8854a', 0, 0.25 + i * 0.3, 0)));
  P.oar = grp(mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.4, 8), '#a0703c', 0, -0.4, 0), mesh(new THREE.BoxGeometry(0.12, 0.3, 0.02), '#a0703c', 0, -1.1, 0));
  return P;
}
// a line between two points (kite string / rope); reuse one mesh and update its points
export function makeLine(color = 0xffffff) { const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]); const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color })); l.userData.outlineParameters = { visible: false };
  return { obj: l, set(a, b) { const p = geo.attributes.position; p.setXYZ(0, a.x, a.y, a.z); p.setXYZ(1, b.x, b.y, b.z); p.needsUpdate = true; geo.computeBoundingSphere(); } }; }

// ---------- v1.3: festivals, birthday, football / kabaddi ----------
const basic = (c, op = 1, add = false) => { const m = new THREE.MeshBasicMaterial({ color: c, transparent: op < 1 || add, opacity: op, depthWrite: false, toneMapped: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, side: THREE.DoubleSide }); m.userData.outlineParameters = { visible: false }; return m; };
const FW_COLS = [0xff4d6d, 0xffd166, 0x06d6a0, 0x4cc9f0, 0xf72585, 0xffffff, 0xff9f1c];
// fireworks in the sky: bursts every ~1.3 s (world units, placed in front of the background)
export function makeFireworks(nBursts = 4, per = 36) {
  const g = new THREE.Group(); const parts = []; const rockets = [];
  for (let b = 0; b < nBursts; b++) { for (let i = 0; i < per; i++) { const m = new THREE.Mesh(new THREE.CircleGeometry(0.0055, 6), basic(FW_COLS[(b * 3 + (i % 2)) % FW_COLS.length], 1, true)); g.add(m); parts.push({ m, b, i }); } const r = new THREE.Mesh(new THREE.CircleGeometry(0.004, 6), basic(0xffe9a8, 1, true)); g.add(r); rockets.push(r); }
  return { group: g, set(t, AR) { const period = 1.3 * nBursts;
    for (let b = 0; b < nBursts; b++) { const tb = ((t - b * 1.3) % period + period) % period; const cycle = Math.floor((t - b * 1.3) / period); const cx = (0.15 + h1(b, cycle) * 0.7) * AR, cy = 0.68 + h1(b + 9, cycle) * 0.22;
      const r = rockets[b]; r.visible = tb < 0.6; if (r.visible) r.position.set(cx, 0.35 + (cy - 0.35) * (tb / 0.6), 0);
      for (const p of parts) if (p.b === b) { const dt = tb - 0.6; p.m.visible = dt > 0 && dt < 1.6; if (!p.m.visible) continue; const a = (p.i / per) * Math.PI * 2; const sp = 0.16 * (0.7 + h1(p.i, b) * 0.6);
        p.m.position.set(cx + Math.cos(a) * sp * dt, cy + Math.sin(a) * sp * dt - 0.05 * dt * dt, 0); p.m.material.opacity = Math.max(0, 1 - dt / 1.6); p.m.scale.setScalar(1.4 - dt * 0.5); } } } };
}
export function makeDiyas(n = 14) { const g = new THREE.Group(); const flames = [];
  for (let i = 0; i < n; i++) { const d = new THREE.Group(); const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshToonMaterial({ color: 0xb5562a })); bowl.scale.y = 0.6; d.add(bowl);
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.08, 8), basic(0xffb02e, 1, true)); f.position.y = 0.045; d.add(f); const glow = new THREE.Mesh(new THREE.CircleGeometry(0.09, 14), basic(0xffa040, 0.25, true)); glow.position.set(0, 0.05, -0.01); d.add(glow); flames.push(f); d.userData.i = i; g.add(d); }
  return { group: g, items: g.children, set(t) { flames.forEach((f, i) => { f.scale.set(1, 0.85 + 0.2 * Math.sin(t * 13 + i * 2), 1); f.rotation.z = Math.sin(t * 9 + i) * 0.12; }); } };
}
export function makeLights(n = 40) { const g = new THREE.Group(); const bulbs = []; const wire = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.002), basic(0x222222)); g.add(wire);
  for (let i = 0; i < n; i++) { const m = new THREE.Mesh(new THREE.CircleGeometry(0.006, 8), basic(FW_COLS[i % FW_COLS.length], 1, true)); g.add(m); bulbs.push(m); }
  return { group: g, set(t, AR, y = 0.93) { wire.scale.x = AR; wire.position.set(AR / 2, y, 0); bulbs.forEach((b, i) => { const x = ((i + 0.5) / bulbs.length) * AR; b.position.set(x, y - 0.012 - Math.sin((i / bulbs.length) * Math.PI * 6) * 0.012, 0.001); b.material.opacity = (Math.floor(t * 3) + i) % 3 === 0 ? 0.35 : 1; }); } };
}
// coloured powder puffs (gulal) drifting and bursting
export function makePowder(n = 26) { const g = new THREE.Group(); const cols = [0xff3d8b, 0x2ecc71, 0xffd400, 0x3b82f6, 0xff7a00, 0xa855f7]; const puffs = [];
  for (let i = 0; i < n; i++) { const m = new THREE.Mesh(new THREE.CircleGeometry(0.05, 14), basic(cols[i % cols.length], 0.5)); g.add(m); puffs.push(m); }
  return { group: g, set(t, AR, around = []) { puffs.forEach((p, i) => { const life = (t * 0.45 + h1(i, 3)) % 1; const src = around.length ? around[i % around.length] : { x: h1(i, 4) * AR, y: 0.45 }; const a = h1(i, 5) * Math.PI * 2;
      p.position.set(src.x + Math.cos(a) * life * 0.18, src.y + Math.sin(a) * life * 0.12 + life * 0.06, 0); p.scale.setScalar(0.3 + life * 1.5); p.material.opacity = 0.45 * (1 - life); }); } };
}
export function makeSpark(n = 18, color = 0xffe28a) { const g = new THREE.Group(); const ps = []; for (let i = 0; i < n; i++) { const m = new THREE.Mesh(new THREE.CircleGeometry(0.004, 5), basic(color, 1, true)); g.add(m); ps.push(m); }
  return { group: g, set(t, up = false) { ps.forEach((p, i) => { const life = (t * 2.2 + h1(i, 6)) % 1; const a = up ? Math.PI / 2 + (h1(i, 7) - 0.5) * 0.9 : h1(i, 7) * Math.PI * 2; const sp = up ? 0.35 : 0.06;
      p.position.set(Math.cos(a) * sp * life, Math.sin(a) * sp * life - (up ? 0.25 * life * life : 0), 0); p.material.opacity = 1 - life; }); } };
}
export function makeFestProps(toon) {
  const P = {}; const mesh = (geo, c, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, typeof c === 'string' ? toon(c) : c); m.position.set(x, y, z); return m; }; const grp = (...ms) => { const g = new THREE.Group(); ms.forEach((m) => g.add(m)); return g; };
  const candles = [-0.1, 0, 0.1].map((x) => grp(mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.08, 6), '#7fd3ff', x, 0.36, 0), mesh(new THREE.ConeGeometry(0.012, 0.035, 6), basic(0xffb02e, 1, true), x, 0.42, 0)));
  P.cake = grp(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 12), '#8a5a32', 0, 0.06, 0), mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.03, 20), '#f4f4f2', 0, 0.13, 0), mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.14, 20), '#f7c6d9', 0, 0.21, 0), mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.1, 20), '#ffffff', 0, 0.32, 0), ...candles); P.cake.userData.candles = candles;
  P.balloons = grp(...[0xff4d6d, 0xffd166, 0x4cc9f0, 0x06d6a0, 0xf72585].map((c, i) => grp(mesh(new THREE.SphereGeometry(0.035, 12, 10), new THREE.MeshToonMaterial({ color: c }), (i - 2) * 0.045, 0.02 * (i % 2), 0), mesh(new THREE.PlaneGeometry(0.002, 0.12), basic(0x444444), (i - 2) * 0.045, -0.07, 0))));
  P.football = mesh(new THREE.SphereGeometry(0.11, 14, 12), '#f4f4f2');
  P.goal = grp(mesh(new THREE.BoxGeometry(0.08, 2.2, 0.08), '#f4f4f2', 0, 1.1, -0.9), mesh(new THREE.BoxGeometry(0.08, 2.2, 0.08), '#f4f4f2', 0, 1.1, 0.9), mesh(new THREE.BoxGeometry(0.08, 0.08, 1.9), '#f4f4f2', 0, 2.2, 0), mesh(new THREE.PlaneGeometry(1.0, 2.2), basic(0xffffff, 0.25), -0.5, 1.1, 0));
  P.line = mesh(new THREE.PlaneGeometry(0.004, 0.25), basic(0xffffff, 0.9));
  P.pichkari = grp(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.32, 10), '#2ecc71', 0.12, 0, 0), mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 8), '#ffd400', 0.32, 0, 0)); P.pichkari.children.forEach((c) => (c.rotation.z = Math.PI / 2));
  P.sparkler = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.35, 6), '#8a8d96', 0.0, 0.17, 0);
  P.diya = grp(mesh(new THREE.SphereGeometry(0.05, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), '#b5562a'), mesh(new THREE.ConeGeometry(0.018, 0.06, 8), basic(0xffb02e, 1, true), 0, 0.035, 0));
  return P;
}
