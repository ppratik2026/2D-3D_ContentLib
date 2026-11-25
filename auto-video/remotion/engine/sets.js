// Procedural 3D locations. Each set returns a group plus "spots": entrance, slots (stand/seat) and a wide camera.
import * as THREE from 'three';

let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

export function makeKit(style) {
  const toon = style !== 'realistic';
  const grad = (() => { const d = new Uint8Array([70, 140, 210, 255]); const t = new THREE.DataTexture(d, 4, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; })();
  const tex = (w, h, draw, rep) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };
  const M = (o) => toon ? new THREE.MeshToonMaterial({ gradientMap: grad, ...stripPBR(o) }) : new THREE.MeshStandardMaterial({ roughness: 0.8, ...o });
  const T = {
    brick: () => tex(256, 128, (x, w, h) => { x.fillStyle = '#d8c9b2'; x.fillRect(0, 0, w, h); for (let r = 0; r < 8; r++) for (let c = 0; c < 5; c++) { const g = 0.82 + rnd() * 0.28; x.fillStyle = `rgb(${150 * g | 0},${68 * g | 0},${48 * g | 0})`; x.fillRect(c * 56 + (r % 2) * 28 - 20, r * 16 + 2, 52, 13); } }, [4, 3]),
    wood: () => tex(256, 256, (x, w, h) => { for (let i = 0; i < 8; i++) { const g = 0.85 + rnd() * 0.3; x.fillStyle = `rgb(${120 * g | 0},${80 * g | 0},${50 * g | 0})`; x.fillRect(0, i * 32, w, 32); x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, i * 32, w, 2); } }, [4, 4]),
    tiles: () => tex(128, 128, (x, w, h) => { x.fillStyle = '#b8b1a5'; x.fillRect(0, 0, w, h); x.strokeStyle = '#8c857a'; x.lineWidth = 3; for (let i = 0; i <= 2; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, h); x.stroke(); x.beginPath(); x.moveTo(0, i * 64); x.lineTo(w, i * 64); x.stroke(); } }, [30, 6]),
    asphalt: () => tex(128, 128, (x, w, h) => { x.fillStyle = '#3b3d42'; x.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { const g = 48 + rnd() * 40; x.fillStyle = `rgb(${g},${g},${g + 3})`; x.fillRect(rnd() * w, rnd() * h, 1.5, 1.5); } }, [40, 3]),
    grass: () => tex(128, 128, (x, w, h) => { x.fillStyle = '#5d8a3e'; x.fillRect(0, 0, w, h); for (let i = 0; i < 1200; i++) { x.fillStyle = `rgba(${40 + rnd() * 50 | 0},${100 + rnd() * 60 | 0},${30 + rnd() * 30 | 0},0.7)`; x.fillRect(rnd() * w, rnd() * h, 1, 3); } }, [20, 20]),
    window: () => tex(64, 64, (x, w, h) => { x.fillStyle = '#9fc2d6'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,0.35)'; x.beginPath(); x.moveTo(0, 50); x.lineTo(30, 0); x.lineTo(44, 0); x.lineTo(14, 64); x.fill(); }),
    board: (title, lines, bg = '#22261f', fg = '#f1ede2') => tex(512, 320, (x, w, h) => { x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = fg; x.font = 'bold 44px Georgia'; x.textAlign = 'center'; x.fillText(title, w / 2, 60); x.font = '28px Georgia'; x.textAlign = 'left'; lines.forEach((l, i) => x.fillText(l, 40, 120 + i * 42)); }),
  };
  return { toon, M, T, grad };
}
function stripPBR(o) { const r = { ...o }; delete r.roughness; delete r.metalness; delete r.clearcoat; delete r.envMapIntensity; return r; }

function builder(kit, group) {
  const box = (w, h, d, mat, x, y, z, ry = 0, shadow = true) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = shadow; m.receiveShadow = true; group.add(m); return m; };
  const cyl = (rt, rb, h, mat, x, y, z, seg = 20) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; group.add(m); return m; };
  const plane = (w, h, mat, x, y, z, rx = 0, ry = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); m.receiveShadow = true; group.add(m); return m; };
  // a room: floor + 4 inward-facing walls (invisible from outside, so cameras never get blocked) + ceiling
  const room = (W, D, H, floorMat, wallMats) => {
    plane(W, D, floorMat, 0, 0, 0, -Math.PI / 2);
    const [b, l, r, f] = wallMats;
    plane(W, H, b, 0, H / 2, -D / 2, 0, 0); plane(D, H, l, -W / 2, H / 2, 0, 0, Math.PI / 2); plane(D, H, r, W / 2, H / 2, 0, 0, -Math.PI / 2); plane(W, H, f, 0, H / 2, D / 2, 0, Math.PI);
    plane(W, D, kit.M({ color: 0xf1ece2 }), 0, H, 0, Math.PI / 2);
  };
  const chair = (x, z, ry, mat) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; group.add(g);
    const add = (w, h, d, px, py, pz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(px, py, pz); m.castShadow = true; m.receiveShadow = true; g.add(m); };
    add(0.45, 0.05, 0.45, 0, 0.45, 0); add(0.45, 0.5, 0.04, 0, 0.72, -0.21); for (const [a, b] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) add(0.04, 0.45, 0.04, a, 0.225, b); };
  const lamp = (x, y, z, color = 0xffd39a) => { const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshBasicMaterial({ color })); bulb.position.set(x, y, z); group.add(bulb); const l = new THREE.PointLight(color, 3, 8, 1.6); l.position.set(x, y - 0.1, z); l.userData.lamp = true; if (!kit.noLamps) group.add(l); return l; };
  const plant = (x, z, s = 1) => { cyl(0.22 * s, 0.17 * s, 0.45 * s, kit.M({ color: 0xc9b9a0 }), x, 0.22 * s, z); const leaf = kit.M({ color: 0x3f7a3a }); for (let k = 0; k < 5; k++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26 * s, 1), leaf); m.position.set(x + (rnd() - 0.5) * 0.4 * s, (0.7 + rnd() * 0.45) * s, z + (rnd() - 0.5) * 0.4 * s); m.castShadow = true; group.add(m); } };
  const tree = (x, z, s = 1) => { cyl(0.12 * s, 0.18 * s, 2.6 * s, kit.M({ color: 0x5a4230 }), x, 1.3 * s, z, 10); const leaf = kit.M({ color: 0x4c7d36 }); for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry((0.9 + rnd() * 0.5) * s, 1), leaf); m.position.set(x + (rnd() - 0.5) * 1.2 * s, (2.9 + rnd()) * s, z + (rnd() - 0.5) * 1.2 * s); m.castShadow = true; group.add(m); } };
  const table = (x, z, r = 0.45, mat) => { cyl(r, r, 0.04, mat, x, 0.76, z, 28); cyl(0.04, 0.05, 0.74, kit.M({ color: 0x2a2a2a, metalness: 0.8, roughness: 0.4 }), x, 0.38, z, 10); };
  const desk = (x, z, ry, w = 1.5) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; group.add(g); const wood = kit.M({ color: 0x8a6440 });
    const add = (bw, bh, bd, px, py, pz, mat = wood) => { const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat); m.position.set(px, py, pz); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
    add(w, 0.05, 0.75, 0, 0.75, 0); add(0.05, 0.73, 0.7, -w / 2 + 0.05, 0.37, 0); add(0.05, 0.73, 0.7, w / 2 - 0.05, 0.37, 0); return { g, add }; };
  return { box, cyl, plane, room, chair, lamp, plant, tree, table, desk };
}

const SEAT_H = 0.45;
export function buildSet(name, kit) {
  const group = new THREE.Group(); group.name = name; const b = builder(kit, group); const { M, T } = kit; seed = 7 + name.length * 13;
  const S = { name, group, indoor: true, lamps: [], slots: [], entrance: { pos: V3(-4, 0, 1.5), yaw: Math.PI / 2 }, wide: { pos: V3(0, 1.65, 3.6), look: V3(0, 0.95, -0.8) }, sky: 0x10141c };
  const slot = (x, z, yaw, seat) => S.slots.push({ stand: { pos: V3(x, 0, z), yaw }, seat: seat ? { pos: V3(seat[0], 0, seat[1]), yaw: seat[2] ?? yaw } : null });
  if (name === 'cafe') {
    b.room(12, 10, 3.6, M({ map: T.wood(), color: 0xffffff }), [M({ map: T.brick() }), M({ color: 0xe6dccb }), M({ color: 0xe6dccb }), M({ color: 0xe6dccb })]);
    b.box(4, 1.05, 0.7, M({ color: 0x6b4a30 }), 2.2, 0.53, -4.3); b.box(4.1, 0.06, 0.8, M({ color: 0x1d1d1d }), 2.2, 1.08, -4.3); b.box(0.7, 0.6, 0.45, M({ color: 0xb8bcc0, metalness: 0.9, roughness: 0.3 }), 3.4, 1.4, -4.4);
    b.plane(1.8, 1.1, M({ map: T.board('MENU', ['Espresso ..... 120', 'Cappuccino ... 180', 'Latte ........ 190', 'Croissant .... 150']) }), -1.6, 2.2, -4.97);
    const tm = M({ color: 0xf3efe6 }), cm = M({ color: 0x5b3a26 });
    b.table(0, -0.5, 0.42, tm); b.chair(-0.75, -0.5, Math.PI / 2, cm); b.chair(0.75, -0.5, -Math.PI / 2, cm);
    for (const [x, z] of [[-3.2, -2.6], [3.6, -1.6], [-3.4, 1.4]]) { b.table(x, z, 0.42, tm); b.chair(x - 0.75, z, Math.PI / 2, cm); b.chair(x + 0.75, z, -Math.PI / 2, cm); }
    b.plant(-5.4, -4.3); b.plant(5.4, -4.4); b.plant(5.4, 2.0);
    for (const [x, z] of [[0, -0.5], [-3.2, -2.6], [3.4, -2.2]]) S.lamps.push(b.lamp(x, 2.6, z));
    b.box(1.4, 2.4, 0.08, M({ color: 0x3a2a1e }), -5.95, 1.2, 2.2, Math.PI / 2, false);
    slot(-1.25, -0.5, Math.PI / 2, [-0.75, -0.5]); slot(1.25, -0.5, -Math.PI / 2, [0.75, -0.5]); slot(0.15, -1.45, 0); slot(-1.7, 0.7, Math.PI * 0.75);
    S.entrance = { pos: V3(-5.6, 0, 2.2), yaw: Math.PI / 2 }; S.wide = { pos: V3(0.4, 1.7, 3.4), look: V3(0, 0.9, -1.0) };
  } else if (name === 'home') {
    b.room(11, 9, 3.2, M({ map: T.wood(), color: 0xd9c4a8 }), [M({ color: 0xd8e0c8 }), M({ color: 0xe9e0cf }), M({ color: 0xe9e0cf }), M({ color: 0xe9e0cf })]);
    const sofa = M({ color: 0x6a7fa0 }); b.box(2.4, 0.42, 0.9, sofa, 0, 0.21, -2.6); b.box(2.4, 0.5, 0.2, sofa, 0, 0.65, -3.0); b.box(0.2, 0.6, 0.9, sofa, -1.2, 0.3, -2.6); b.box(0.2, 0.6, 0.9, sofa, 1.2, 0.3, -2.6);
    b.box(1.2, 0.4, 0.6, M({ color: 0x6b4a30 }), 0, 0.2, -1.4); const rug = b.plane(3.2, 2.2, M({ color: 0xa8553f }), 0, 0.005, -1.6, -Math.PI / 2);
    b.box(0.9, 0.45, 0.9, M({ color: 0x8a5a3a }), 2.3, 0.22, -1.2); b.box(0.9, 0.5, 0.18, M({ color: 0x8a5a3a }), 2.7, 0.6, -1.2, Math.PI / 2);
    b.box(0.06, 0.8, 1.4, M({ color: 0x111111 }), -5.4, 1.4, -1.0); b.box(0.5, 0.5, 1.8, M({ color: 0x5b3e28 }), -5.2, 0.25, -1.0);
    b.plane(1.6, 1.3, M({ map: T.window(), emissive: 0x99bbcc, emissiveIntensity: 0.25 }), 1.5, 1.7, -4.49); b.plant(-4.6, -3.8); b.plant(4.8, 3.6);
    S.lamps.push(b.lamp(-2.0, 2.4, -2.8), b.lamp(2.2, 2.4, 0.2));
    slot(-0.7, -1.9, 0, [-0.55, -2.55, 0]); slot(0.7, -1.9, 0, [0.55, -2.55, 0]); slot(1.7, -0.6, -Math.PI / 2, [2.25, -1.2, -Math.PI / 2]); slot(-1.8, 0.2, Math.PI * 0.7);
    S.entrance = { pos: V3(5.0, 0, 1.6), yaw: -Math.PI / 2 }; S.wide = { pos: V3(-0.3, 1.65, 3.0), look: V3(0, 0.8, -1.6) };
  } else if (name === 'office' || name === 'police') {
    const police = name === 'police';
    b.room(12, 10, 3.2, M({ map: T.tiles(), color: police ? 0x9aa4ad : 0xcfc8bd }), [M({ color: police ? 0x8c9aa3 : 0xdfe6ea }), M({ color: 0xd9dde0 }), M({ color: 0xd9dde0 }), M({ color: 0xd9dde0 })]);
    const d = b.desk(0, -1.3, 0, 1.8); d.add(0.55, 0.36, 0.04, 0.3, 1.0, -0.15, M({ color: 0x151515 })); d.add(0.3, 0.02, 0.22, -0.4, 0.79, 0.05, M({ color: 0xf2f2f2 }));
    const cm = M({ color: police ? 0x30363d : 0x2b3a55 }); b.chair(0, -2.0, 0, cm); b.chair(-0.6, -0.35, Math.PI, cm); b.chair(0.6, -0.35, Math.PI, cm);
    if (police) { b.plane(2.6, 1.5, M({ map: T.board('EVIDENCE', ['Suspect: ???', 'Time: 9:40 PM', 'Clue: red scarf', 'Witness: guard'], '#c9b48a', '#2a1d10') }), 0, 1.9, -4.97); for (let i = 0; i < 4; i++) b.box(0.6, 1.4, 0.5, M({ color: 0x59636b }), -5.6, 0.7, -3.5 + i * 0.7); }
    else { b.plane(2.4, 1.2, M({ color: 0xffffff }), 0, 1.8, -4.97); for (const x of [-3.4, 3.4]) { const dd = b.desk(x, -2.8, 0, 1.4); dd.add(0.5, 0.33, 0.04, 0, 0.98, -0.15, M({ color: 0x151515 })); b.chair(x, -2.1, Math.PI, cm); } b.plant(5.3, -4.3); }
    S.lamps.push(b.lamp(0, 3.0, -1.0, 0xf4f1ff), b.lamp(-3, 3.0, -2.5, 0xf4f1ff));
    slot(0, -2.6, 0, [0, -2.0, 0]); slot(-0.6, 0.35, Math.PI, [-0.6, -0.35, Math.PI]); slot(0.6, 0.35, Math.PI, [0.6, -0.35, Math.PI]); slot(2.0, -0.6, -Math.PI / 2);
    S.entrance = { pos: V3(-5.5, 0, 1.8), yaw: Math.PI / 2 }; S.wide = { pos: V3(2.6, 1.7, 2.6), look: V3(-0.2, 0.9, -1.2) };
  } else if (name === 'classroom') {
    b.room(12, 10, 3.3, M({ map: T.wood(), color: 0xc8b090 }), [M({ color: 0xe8e2c8 }), M({ color: 0xe8e2c8 }), M({ color: 0xe8e2c8 }), M({ color: 0xe8e2c8 })]);
    b.plane(3.4, 1.4, M({ map: T.board('Aaj ka paath', ['1. Imaandari', '2. Mehnat', '3. Dosti'], '#203528') }), 0, 1.8, -4.97);
    const d = b.desk(0, -3.4, 0, 1.4); const cm = M({ color: 0x6b4a30 });
    for (const [x, z] of [[-1.1, -0.4], [1.1, -0.4], [-1.1, 1.2], [1.1, 1.2]]) { const dd = b.desk(x, z - 0.6, Math.PI, 0.9); b.chair(x, z, Math.PI, cm); }
    S.lamps.push(b.lamp(0, 3.1, -1.5, 0xf4f1ff));
    slot(0, -2.8, 0); slot(-1.1, -0.4 + 0.65, Math.PI, [-1.1, -0.4 + 0.05, Math.PI]); slot(1.1, -0.4 + 0.65, Math.PI, [1.1, -0.4 + 0.05, Math.PI]); slot(-1.1, 1.85, Math.PI, [-1.1, 1.25, Math.PI]);
    S.entrance = { pos: V3(5.5, 0, -2.5), yaw: -Math.PI / 2 }; S.wide = { pos: V3(2.4, 1.75, 3.4), look: V3(0, 0.9, -1.4) };
  } else if (name === 'street') {
    S.indoor = false; S.sky = 0x8fb7da;
    b.plane(200, 8, M({ map: T.asphalt() }), 0, 0, 5, -Math.PI / 2);
    for (let x = -60; x < 60; x += 6) b.box(3, 0.01, 0.15, M({ color: 0xf0ede4 }), x, 0.006, 5, 0, false);
    b.box(200, 0.12, 5, M({ map: T.tiles() }), 0, 0.06, -0.5); b.box(200, 0.15, 0.2, M({ color: 0x8d8a84 }), 0, 0.075, 2.0, 0, false);
    const cols = [0xd8c3a5, 0xb7c9cf, 0xc9a7a0, 0xe4d9c5, 0xa9b39c];
    for (let x = -40; x < 40; x += 9) { const h = 6 + rnd() * 7; b.box(8.6, h, 6, M({ color: cols[Math.floor(rnd() * 5)] }), x, h / 2, -6); for (let fy = 1; fy < h / 3; fy++) for (const wx of [-2.5, 0, 2.5]) b.plane(1.1, 1.3, M({ map: T.window(), emissive: 0xffd590, emissiveIntensity: 0.05 }), x + wx, fy * 3 + 0.8, -2.99); }
    b.box(6, 0.8, 0.3, M({ color: 0x1f2a24 }), 0, 3.2, -2.9); b.plane(5.4, 0.6, M({ map: T.board('BEAN & BREW', [], '#1f2a24', '#f4d48f') }), 0, 3.2, -2.74);
    b.plane(1.3, 2.4, M({ color: 0x3a2a1e }), 1.5, 1.2, -2.98); b.plane(3.2, 2.0, M({ map: T.window(), emissive: 0xffc070, emissiveIntensity: 0.4 }), -1.4, 1.3, -2.98);
    for (let x = -35; x < 35; x += 10) { if (Math.abs(x + 5) > 4) b.tree(x + 5, 1.4, 0.85); b.cyl(0.06, 0.08, 4.2, M({ color: 0x2b2d30 }), x, 2.1, 1.7); S.lamps.push(b.lamp(x, 4.25, 1.7, 0xffe2a8)); }
    slot(-0.7, 0, Math.PI / 2); slot(0.7, 0, -Math.PI / 2); slot(0, -0.9, 0); slot(-0.1, 0.9, Math.PI);
    S.entrance = { pos: V3(-9, 0, 0.4), yaw: Math.PI / 2 }; S.wide = { pos: V3(0.8, 1.6, 5.4), look: V3(0, 1.0, -0.6) };
  } else if (name === 'park' || name === 'forest') {
    S.indoor = false; S.sky = 0x9cc4e4; const forest = name === 'forest';
    b.plane(120, 120, M({ map: T.grass(), color: forest ? 0x8aa070 : 0xffffff }), 0, 0, 0, -Math.PI / 2);
    b.plane(2.2, 60, M({ color: forest ? 0x7a6448 : 0xc8b694 }), 0, 0.01, 0, -Math.PI / 2, Math.PI / 2 * 0.2);
    for (let i = 0; i < (forest ? 60 : 22); i++) { const a = rnd() * Math.PI * 2, r = (forest ? 4 : 7) + rnd() * 22; const x = Math.cos(a) * r, z = Math.sin(a) * r - 4; if (z > 3 && Math.abs(x) < 6) continue; b.tree(x, z, 0.8 + rnd() * 0.6); }
    if (!forest) { const wood = M({ color: 0x7a5232 }); b.box(1.6, 0.06, 0.45, wood, 0, 0.45, -1.0); b.box(1.6, 0.4, 0.06, wood, 0, 0.7, -1.22); for (const x of [-0.7, 0.7]) b.box(0.06, 0.45, 0.4, M({ color: 0x2a2a2a }), x, 0.22, -1.0); for (const x of [-4, 4]) { b.cyl(0.06, 0.08, 3.6, M({ color: 0x2b2d30 }), x, 1.8, -1.6); S.lamps.push(b.lamp(x, 3.65, -1.6, 0xffe2a8)); } }
    else { const log = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 2.0, 12), M({ color: 0x5d4128 })); log.rotation.z = Math.PI / 2; log.position.set(0, 0.22, -1.0); log.castShadow = true; group.add(log); }
    const sh = forest ? 0.32 : SEAT_H;
    slot(-0.5, -0.4, 0, [-0.4, -1.0, 0]); slot(0.5, -0.4, 0, [0.4, -1.0, 0]); slot(1.6, 0.2, -Math.PI / 2); slot(-1.6, 0.4, Math.PI / 2);
    S.seatH = sh; S.entrance = { pos: V3(-8, 0, 1.0), yaw: Math.PI / 2 }; S.wide = { pos: V3(0.6, 1.6, 4.2), look: V3(0, 0.9, -0.6) };
  } else if (name === 'alley') {
    S.indoor = false; S.sky = 0x0b0f18;
    b.plane(6, 40, M({ map: T.asphalt(), color: 0x9a9a9a }), 0, 0, -10, -Math.PI / 2);
    for (const x of [-3, 3]) { const w = b.box(0.4, 9, 40, M({ map: T.brick(), color: 0x9a8a80 }), x, 4.5, -10); }
    for (const z of [-3, -8, -14]) { b.box(0.7, 1.0, 0.6, M({ color: 0x2f4a3a }), -2.3, 0.5, z); b.cyl(0.3, 0.3, 0.8, M({ color: 0x4a4a4a }), 2.3, 0.4, z + 1.5); }
    b.cyl(0.05, 0.05, 1.2, M({ color: 0x222222 }), 2.6, 3.6, -2, 6); S.lamps.push(b.lamp(2.4, 3.0, -2, 0xffcf80));
    b.plane(6, 9, M({ color: 0x15171c }), 0, 4.5, -29.5);
    slot(-0.7, -1.5, Math.PI / 2); slot(0.7, -1.5, -Math.PI / 2); slot(0, -2.5, 0); slot(0.1, -0.5, Math.PI);
    S.entrance = { pos: V3(0, 0, -14), yaw: 0 }; S.wide = { pos: V3(0.6, 1.6, 3.2), look: V3(0, 1.0, -2.5) };
  }
  if (!S.seatH) S.seatH = SEAT_H;
  return S;
}
