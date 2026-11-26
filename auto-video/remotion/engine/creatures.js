// Cartoon animals (dog, cow, horse) and simple crowd people ("extras") built from code, toon-shaded.
// Units: metres, facing +x, feet at y = 0. Everything is posed deterministically from t.
import * as THREE from 'three';

const rnd = (seed) => { let a = (seed * 2654435761) >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

function limb(mat, r, len, x, y, z) { // pivot at the top, hangs down
  const g = new THREE.Group(); g.position.set(x, y, z);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.85, len, 10), mat); m.position.y = -len / 2; g.add(m); g.userData.len = len; return g;
}

const SPECS = {
  dog: { len: 0.62, hip: 0.36, legR: 0.045, body: 0.17, neck: 0.16, head: [0.2, 0.15, 0.14], snout: 0.1, colors: ['#b7793e', '#e9dcc4', '#3b2a1e', '#8a5a2b'], ears: 'flop', tail: 0.26 },
  cow: { len: 1.5, hip: 0.75, legR: 0.075, body: 0.36, neck: 0.3, head: [0.36, 0.3, 0.26], snout: 0.14, colors: ['#f2efe6', '#e6dccb', '#c9a77a'], patch: '#3a2c22', ears: 'side', horns: true, tail: 0.6 },
  goat: { len: 0.75, hip: 0.42, legR: 0.04, body: 0.2, neck: 0.2, head: [0.22, 0.16, 0.14], snout: 0.08, colors: ['#f2efe6', '#3a2c22', '#8a5a2b', '#d9c9a8'], ears: 'side', horns: true, beard: true, tail: 0.1 },
  cat: { len: 0.42, hip: 0.2, legR: 0.025, body: 0.1, neck: 0.08, head: [0.13, 0.11, 0.12], snout: 0.03, colors: ['#f2a950', '#3a3a3e', '#e9e4da', '#9b8a7a'], ears: 'cat', tail: 0.32 },
  elephant: { len: 2.6, hip: 1.35, legR: 0.21, body: 0.78, neck: 0.15, head: [0.75, 0.8, 0.7], snout: 0.0, colors: ['#8e8e96', '#7d7d86'], ears: 'big', trunk: true, tusks: true, tail: 0.6 },
  horse: { len: 1.6, hip: 0.95, legR: 0.07, body: 0.34, neck: 0.55, head: [0.48, 0.22, 0.2], snout: 0.12, colors: ['#f3f1ec', '#8b5a32', '#3b2a1e'], ears: 'up', mane: true, tail: 0.7 },
};

export function makeAnimal(type, seed = 1, opts = {}) {
  const S = SPECS[type] || SPECS.dog; const R = rnd(seed); const grad = opts.grad;
  const toon = (c) => new THREE.MeshToonMaterial({ color: new THREE.Color(c), gradientMap: grad });
  const col = opts.color || S.colors[Math.floor(R() * S.colors.length)]; const mat = toon(col), dark = toon('#2a211b'), pink = toon('#e8a7a0');
  const g = new THREE.Group(); const body = new THREE.Group(); g.add(body);
  const L = S.len, H = S.hip;
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(S.body, L - S.body * 1.4, 6, 14), mat); torso.rotation.z = Math.PI / 2; torso.position.set(0, H + S.body * 0.55, 0); body.add(torso);
  if (S.patch) for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(S.body * (0.45 + R() * 0.25), 10, 8), toon(S.patch)); p.scale.set(1.2, 0.8, 0.35); p.position.set((R() - 0.5) * L * 0.6, H + S.body * (0.6 + R() * 0.5), S.body * 0.78); p.userData.outlineParameters = { visible: false }; body.add(p); }
  // neck + head
  const neck = new THREE.Group(); neck.position.set(L / 2 - S.body * 0.3, H + S.body * 0.9, 0); body.add(neck);
  const nm = new THREE.Mesh(new THREE.CylinderGeometry(S.body * 0.45, S.body * 0.6, S.neck, 10), mat); nm.position.y = S.neck / 2; nm.rotation.z = -0.5; nm.position.x = S.neck * 0.22; neck.add(nm);
  const head = new THREE.Group(); head.position.set(S.neck * 0.48, S.neck * 0.92, 0); neck.add(head);
  const [hx, hy, hz] = S.head; const hm = new THREE.Mesh(new THREE.BoxGeometry(hx, hy, hz), mat); hm.position.x = hx * 0.3; head.add(hm);
  const sn = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.001, S.snout), hy * 0.7, hz * 0.85), type === 'dog' || type === 'cat' ? dark : pink); sn.visible = S.snout > 0; sn.position.set(hx * 0.3 + hx / 2 + S.snout / 2 - 0.02, -hy * 0.12, 0); head.add(sn);
  for (const z of [hz / 2 + 0.002, -hz / 2 - 0.002]) { const e = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.018, hy * 0.09), 8, 6), dark); e.position.set(hx * 0.45, hy * 0.18, z); e.userData.outlineParameters = { visible: false }; head.add(e); }
  for (const z of [hz * 0.35, -hz * 0.35]) { const ear = new THREE.Mesh(new THREE.BoxGeometry(hx * 0.22, hy * (S.ears === 'flop' ? 0.6 : 0.45), 0.02), S.ears === 'flop' ? dark : mat);
    if (S.ears === 'flop') { ear.position.set(hx * 0.05, -hy * 0.05, z * 1.5); } else if (S.ears === 'side') { ear.position.set(0, hy * 0.25, z * 1.9); ear.rotation.x = z > 0 ? 1.2 : -1.2; } else { ear.position.set(0, hy * 0.62, z); } head.add(ear); }
  if (S.horns) for (const z of [hz * 0.3, -hz * 0.3]) { const h = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.16, 8), toon('#e8e0c8')); h.position.set(-hx * 0.05, hy * 0.62, z); h.rotation.x = z > 0 ? 0.6 : -0.6; head.add(h); }
  if (S.beard) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.09, 0.05), toon('#d9d3c4')); b.position.set(hx * 0.55, -hy * 0.6, 0); head.add(b); }
  if (S.ears === 'cat') for (const z of [hz * 0.3, -hz * 0.3]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 4), mat); e.position.set(hx * 0.1, hy * 0.6, z); head.add(e); }
  if (S.ears === 'big') for (const z of [hz * 0.52, -hz * 0.52]) { const e = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), mat); e.material = mat.clone(); e.material.side = THREE.DoubleSide; e.position.set(-hx * 0.15, -hy * 0.05, z); e.rotation.y = z > 0 ? 0.25 : -0.25; head.add(e); }
  if (S.trunk) { let prev = head; let x = hx * 0.3 + hx / 2, y = -hy * 0.15; const segs = []; for (let i = 0; i < 6; i++) { const g2 = new THREE.Group(); g2.position.set(i === 0 ? x : 0, i === 0 ? y : -0.17, 0); const r = 0.13 - i * 0.015; const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r, 0.2, 10), mat); m.position.y = -0.09; g2.add(m); g2.rotation.z = i === 0 ? 0.25 : 0.08; prev.add(g2); prev = g2; segs.push(g2); } head.userData.trunk = segs; }
  if (S.tusks) for (const z of [hz * 0.28, -hz * 0.28]) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.42, 8), toon('#f4efe2')); t.position.set(hx * 0.75, -hy * 0.42, z); t.rotation.z = -2.0; head.add(t); }
  if (S.mane) { const m = new THREE.Mesh(new THREE.BoxGeometry(S.neck * 0.25, S.neck * 1.05, 0.05), toon('#3b2a1e')); m.position.set(-S.body * 0.15, S.neck * 0.55, 0); m.rotation.z = -0.5; neck.add(m); }
  // legs (front pair / back pair), knees
  const legs = []; const lx = L / 2 - S.body * 0.6;
  for (const [x, z] of [[lx, S.body * 0.55], [lx, -S.body * 0.55], [-lx, S.body * 0.55], [-lx, -S.body * 0.55]]) {
    const up = limb(mat, S.legR, H * 0.55, x, H + 0.02, z); const low = limb(mat, S.legR * 0.8, H * 0.5, 0, -H * 0.55, 0); up.add(low);
    const hoof = new THREE.Mesh(new THREE.CylinderGeometry(S.legR * 0.95, S.legR, 0.05, 8), dark); hoof.position.y = -H * 0.5; low.add(hoof); body.add(up); legs.push({ up, low });
  }
  // tail
  const tail = new THREE.Group(); tail.position.set(-L / 2 + S.body * 0.1, H + S.body * 1.1, 0); body.add(tail);
  const tm = new THREE.Mesh(new THREE.CylinderGeometry(type === 'elephant' ? 0.03 : 0.02, type === 'horse' ? 0.06 : 0.025, S.tail, 8), type === 'horse' ? toon('#3b2a1e') : mat); tm.position.y = -S.tail / 2; tail.add(tm); tail.rotation.z = type === 'dog' ? -2.3 : type === 'cat' ? -2.6 : type === 'goat' ? -2.0 : -0.25;
  const height = H + S.body * 1.1 + S.neck;
  return {
    type, group: g, height, len: L, back: H + S.body * 1.1,
    // pose: gait = walk/run phase (radians), moving 0..1, run 0..1, head 'down' | 'up' | null, act 'bark' | 'sit' | null
    set(t, { phase = t * 6, moving = 0, run = 0, head: hd = null, act = null } = {}) {
      const amp = moving * (run ? 0.75 : 0.42); const ph = phase;
      const off = run ? [0, 0.6, Math.PI, Math.PI + 0.6] : [0, Math.PI, Math.PI, 0]; // trot / gallop
      legs.forEach((l, i) => { const s = Math.sin(ph + off[i]); l.up.rotation.z = s * amp; l.low.rotation.z = Math.max(0, -Math.cos(ph + off[i])) * amp * 1.2 * (i < 2 ? -1 : 1); });
      body.position.y = moving ? Math.abs(Math.sin(ph)) * (run ? 0.06 : 0.02) * H : 0; body.rotation.z = 0;
      neck.rotation.z = hd === 'down' ? -1.05 : hd === 'up' ? 0.25 : Math.sin(t * 1.3 + seed) * 0.05;
      tail.rotation.x = Math.sin(t * (type === 'dog' ? 14 : 3) + seed) * (type === 'dog' ? 0.5 : 0.2);
      if (head.userData.trunk) head.userData.trunk.forEach((g2, i) => { g2.rotation.z = (i === 0 ? 0.25 : 0.08) + Math.sin(t * 1.6 + i * 0.6) * 0.08 + (act === 'bark' ? -0.35 * Math.max(0, Math.sin(t * 4)) : 0); });
      if (type === 'cat') tail.rotation.z = -2.6 + Math.sin(t * 2) * 0.2;
      if (act === 'bark') { body.position.y += Math.abs(Math.sin(t * 9)) * 0.05 * H; neck.rotation.z += Math.abs(Math.sin(t * 9)) * 0.25; }
      if (act === 'sit' && type === 'dog') { body.rotation.z = 0.45; body.position.y = -0.08; legs[2].up.rotation.z = -1.2; legs[3].up.rotation.z = -1.2; legs[2].low.rotation.z = 2.2; legs[3].low.rotation.z = 2.2; }
    },
  };
}

// ---------- crowd people (cheap, for the background) ----------
const SKIN = ['#c68a5e', '#b07850', '#8d5a3b', '#d39b72', '#a06a45'];
const CLOTH = ['#d63a4a', '#f2c418', '#2f8f3a', '#2f6fb5', '#e67ab4', '#ff8c2a', '#7a4fa0', '#f4f1e8', '#18a5a7', '#c0392b'];
export function makeExtra(seed, grad) {
  const R = rnd(seed + 11); const toon = (c) => new THREE.MeshToonMaterial({ color: new THREE.Color(c), gradientMap: grad });
  const female = R() < 0.5; const h = 1.55 + R() * 0.2; const skin = toon(SKIN[Math.floor(R() * SKIN.length)]); const top = toon(CLOTH[Math.floor(R() * CLOTH.length)]); const low = toon(female ? CLOTH[Math.floor(R() * CLOTH.length)] : ['#f4f1e8', '#2b2b30', '#5a4a3a'][Math.floor(R() * 3)]);
  const g = new THREE.Group(); const body = new THREE.Group(); g.add(body);
  const legH = h * 0.47; const legs = [];
  for (const z of [0.07, -0.07]) { const l = limb(low, 0.055, legH, 0, legH, z); body.add(l); legs.push(l); }
  if (female) { const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.26, legH * 0.9, 12), low); skirt.position.y = legH * 0.55; body.add(skirt); }
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, h * 0.2, 4, 10), top); torso.position.y = legH + h * 0.15; body.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 14, 12), skin); head.position.y = legH + h * 0.36; body.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon('#1c1612')); hair.position.y = head.position.y + 0.01; hair.rotation.z = 0.25; body.add(hair);
  if (female) { const bun = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), toon('#1c1612')); bun.position.set(-0.1, head.position.y, 0); body.add(bun); }
  const arms = []; for (const z of [0.2, -0.2]) { const a = limb(top, 0.05, h * 0.33, 0, legH + h * 0.27, z); const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), skin); hand.position.y = -h * 0.33; a.add(hand); body.add(a); arms.push(a); }
  // face (towards +x): eyes, smile
  const dark = toon('#1c1612'); for (const z of [0.035, -0.035]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), dark); e.position.set(0.098, head.position.y + 0.015, z); e.userData.outlineParameters = { visible: false }; body.add(e); }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 4, 10, Math.PI), toon('#8a2a2a')); mouth.position.set(0.1, head.position.y - 0.035, 0); mouth.rotation.set(Math.PI, Math.PI / 2, 0); mouth.userData.outlineParameters = { visible: false }; body.add(mouth);
  if (!female && R() < 0.5) { const kurta = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, h * 0.22, 12), top); kurta.position.y = legH + 0.02; body.add(kurta); }
  if (female) { const dup = new THREE.Mesh(new THREE.BoxGeometry(0.05, h * 0.3, 0.34), toon(CLOTH[Math.floor(R() * CLOTH.length)])); dup.position.set(0.05, legH + h * 0.16, 0); dup.rotation.x = 0.5; body.add(dup); }
  const phase0 = R() * 6.28;
  return {
    group: g, height: h,
    set(t, mood = 'watch') { const p = t * 6 + phase0;
      legs[0].rotation.z = legs[1].rotation.z = 0; arms[0].rotation.set(0, 0, 0); arms[1].rotation.set(0, 0, 0); body.position.y = 0; body.rotation.y = 0;
      if (mood === 'dance') { body.position.y = Math.abs(Math.sin(p)) * 0.05; arms[0].rotation.x = -2.3 + Math.sin(p) * 0.35; arms[1].rotation.x = 2.3 - Math.sin(p + 2) * 0.35; body.rotation.y = Math.sin(p * 0.5) * 0.4; legs[0].rotation.z = Math.sin(p) * 0.25; }
      else if (mood === 'cheer') { arms[0].rotation.x = -2.2 + Math.sin(p * 1.3) * 0.25; arms[1].rotation.x = 2.2 - Math.sin(p * 1.3 + 1) * 0.25; body.position.y = Math.max(0, Math.sin(p * 0.7)) * 0.04; }
      else if (mood === 'clap') { const c = Math.abs(Math.sin(p * 1.5)); arms[0].rotation.set(-0.5 - c * 0.3, 0, 1.2); arms[1].rotation.set(0.5 + c * 0.3, 0, 1.2); }
      else if (mood === 'walk') { legs[0].rotation.z = Math.sin(p) * 0.45; legs[1].rotation.z = -Math.sin(p) * 0.45; arms[0].rotation.z = -Math.sin(p) * 0.4; arms[1].rotation.z = Math.sin(p) * 0.4; body.position.y = Math.abs(Math.sin(p)) * 0.02; }
      else { body.rotation.y = Math.sin(t * 0.4 + phase0) * 0.15; arms[0].rotation.x = -0.08; arms[1].rotation.x = 0.08; }
    },
  };
}

// a festive turban (safa) for the groom
export function makeSafa(grad) {
  const toon = (c) => new THREE.MeshToonMaterial({ color: new THREE.Color(c), gradientMap: grad });
  const g = new THREE.Group(); const t = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.045, 10, 20), toon('#d63a4a')); t.rotation.x = Math.PI / 2; g.add(t);
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.105, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon('#e8b923')); top.position.y = 0.02; g.add(top);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.09), toon('#d63a4a')); tail.position.set(-0.12, -0.06, 0); g.add(tail);
  const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), new THREE.MeshBasicMaterial({ color: 0x3fd47a })); jewel.position.set(0.12, 0.03, 0); g.add(jewel);
  return g;
}

// a flock of birds flying across the sky (V shapes flapping)
export function makeBirds(n = 9, grad) {
  const g = new THREE.Group(); const mat = new THREE.MeshBasicMaterial({ color: 0x1c1c22, side: THREE.DoubleSide }); const birds = [];
  for (let i = 0; i < n; i++) { const b = new THREE.Group(); const w1 = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.008), mat), w2 = w1.clone(); w1.position.x = -0.017; w2.position.x = 0.017; const p1 = new THREE.Group(), p2 = new THREE.Group(); p1.add(w1); p2.add(w2); b.add(p1, p2);
    b.userData = { p1, p2, ox: (i % 3) * -0.05 - Math.floor(i / 3) * 0.03, oy: ((i * 7) % 5) * 0.012 * (i % 2 ? 1 : -1), ph: i * 1.3 }; g.add(b); birds.push(b); }
  g.traverse((m) => { if (m.isMesh) m.material.userData.outlineParameters = { visible: false }; });
  return { group: g, set(t) { for (const b of birds) { const f = Math.sin(t * 10 + b.userData.ph) * 0.6; b.userData.p1.rotation.z = f; b.userData.p2.rotation.z = -f; b.position.set(b.userData.ox, b.userData.oy + Math.sin(t * 1.5 + b.userData.ph) * 0.006, 0); } } };
}
