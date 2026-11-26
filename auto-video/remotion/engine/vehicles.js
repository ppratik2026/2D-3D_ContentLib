// Cartoon vehicles for the 2D Cartoon Stage, built from code (no model files, no licences):
// car, taxi, police jeep, ambulance, auto rickshaw, van. Units are metres; the vehicle drives towards +x and
// shows its side to the camera (+z). Window openings are real holes, so the people sitting inside are visible.
import * as THREE from 'three';

import { makeAnimal } from './creatures.js';
export const VEHICLE_TYPES = ['car', 'taxi', 'police_jeep', 'ambulance', 'auto', 'van', 'bike', 'scooter', 'cycle', 'horse'];
const OPEN = new Set(['bike', 'scooter', 'cycle', 'horse']);

function shapeOf(pts, holes = []) {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  return s;
}
function arch(cx, r, y0, n = 9) { const out = []; for (let i = 0; i <= n; i++) { const a = (Math.PI * i) / n; /* right → left */ out.push([cx + Math.cos(a) * r, y0 + Math.sin(a) * r]); } return out; }
function textTex(text, bg, fg, w = 512, h = 128) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); } x.fillStyle = fg; x.font = `900 ${Math.round(h * 0.62)}px "Arial Black", Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function crossTex() { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#d61f26'; x.fillRect(46, 14, 36, 100); x.fillRect(14, 46, 100, 36); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

// side profiles: [lower body points, cabin outline, window holes, door rect [x0,x1,y0,y1], seats [[x,y]], wheels [x], wheel radius, length]
const SPEC = {
  car: () => { const r = 0.34, y0 = 0.3;
    const body = [[-2.1, 0.45], [-2.1, 0.86], [-1.95, 0.98], [1.25, 1.0], [1.95, 0.9], [2.12, 0.74], [2.12, 0.45], [1.85, y0], ...arch(1.35, 0.44, y0).map(([x, y]) => [x, y]), [-0.95, y0], ...arch(-1.35, 0.44, y0), [-1.92, y0]];
    const cab = [[-1.3, 0.98], [-0.85, 1.46], [0.5, 1.46], [1.2, 0.98]];
    const holes = [[[-1.08, 1.04], [-0.76, 1.39], [-0.12, 1.39], [-0.12, 1.04]], [[-0.02, 1.04], [-0.02, 1.39], [0.44, 1.39], [0.98, 1.04]]];
    return { body, cab, holes, door: [-0.05, 1.0, 0.36, 1.0], doorRear: [-1.05, -0.05, 0.36, 1.0], seats: [[0.35, 0.5], [-0.65, 0.5]], wheels: [1.35, -1.35], r, len: 4.24, depth: 1.75, top: 1.46 }; },
  jeep: () => { const r = 0.38, y0 = 0.36;
    const body = [[-2.05, 0.5], [-2.05, 1.12], [1.1, 1.14], [2.05, 1.08], [2.1, 0.55], [1.9, y0], ...arch(1.3, 0.48, y0), [-0.85, y0], ...arch(-1.3, 0.48, y0), [-1.85, y0]];
    const cab = [[-2.05, 1.12], [-2.05, 1.98], [0.7, 1.98], [1.1, 1.12]];
    const holes = [[[-1.9, 1.2], [-1.9, 1.88], [-0.95, 1.88], [-0.95, 1.2]], [[-0.85, 1.2], [-0.85, 1.88], [-0.05, 1.88], [-0.05, 1.2]], [[0.05, 1.2], [0.05, 1.88], [0.62, 1.88], [0.98, 1.2]]];
    return { body, cab, holes, door: [0.0, 1.05, 0.45, 1.14], doorRear: [-0.9, 0.0, 0.45, 1.14], seats: [[0.4, 0.6], [-0.45, 0.6], [-1.4, 0.6]], wheels: [1.3, -1.3], r, len: 4.15, depth: 1.8, top: 1.98 }; },
  van: () => { const r = 0.36, y0 = 0.34;
    const body = [[-2.4, 0.48], [-2.4, 1.15], [1.5, 1.15], [2.35, 1.05], [2.4, 0.55], [2.2, y0], ...arch(1.6, 0.46, y0), [-1.15, y0], ...arch(-1.6, 0.46, y0), [-2.2, y0]];
    const cab = [[-2.4, 1.15], [-2.4, 2.3], [1.0, 2.3], [1.5, 1.15]];
    const holes = [[[0.15, 1.22], [0.15, 2.0], [0.92, 2.0], [1.36, 1.22]], [[-0.8, 1.3], [-0.8, 2.0], [0.0, 2.0], [0.0, 1.3]]];
    return { body, cab, holes, door: [0.1, 1.45, 0.42, 1.15], doorRear: [-0.9, 0.05, 0.42, 1.15], seats: [[0.6, 0.6], [-0.4, 0.6]], wheels: [1.6, -1.6], r, len: 4.8, depth: 1.9, top: 2.3 }; },
  auto: () => { const r = 0.26, y0 = 0.24;
    const body = [[-1.3, 0.42], [-1.3, 0.92], [0.55, 0.92], [1.1, 1.05], [1.3, 0.8], [1.25, 0.4], [1.22, y0], ...arch(0.88, 0.3, y0), [-0.6, y0], ...arch(-0.95, 0.32, y0), [-1.25, y0]];
    const cab = [[-1.35, 0.92], [-1.35, 1.75], [-0.9, 1.92], [0.6, 1.92], [1.1, 1.3], [1.1, 1.05], [0.55, 0.92]];
    const holes = [[[-1.2, 1.0], [-1.2, 1.72], [-0.85, 1.82], [0.5, 1.82], [0.95, 1.28], [0.95, 1.08], [0.5, 1.0]]];
    return { body, cab, holes, door: null, doorRear: null, seats: [[0.55, 0.52], [-0.55, 0.5]], wheels: [0.9, -0.95], r, len: 2.65, depth: 1.35, top: 1.92 }; },
};
SPEC.taxi = SPEC.car; SPEC.police_jeep = SPEC.jeep; SPEC.ambulance = SPEC.van;

const LOOK = {
  car: { body: null, cab: null, trim: '#1c1c22' },
  taxi: { body: '#f2c418', cab: '#f2c418', trim: '#1c1c22', sign: ['TAXI', '#1c1c22', '#f2c418'] },
  police_jeep: { body: '#f4f4f2', cab: '#f4f4f2', trim: '#1d3f8f', stripe: '#1d3f8f', text: ['POLICE', null, '#1d3f8f'], lights: ['#ff2a2a', '#2a6bff'] },
  ambulance: { body: '#f7f7f5', cab: '#f7f7f5', trim: '#d61f26', stripe: '#d61f26', text: ['AMBULANCE', null, '#d61f26'], cross: true, lights: ['#ff2a2a', '#ff2a2a'] },
  auto: { body: '#2f8f3a', cab: '#1d1d1f', trim: '#f2c418', stripe: '#f2c418' },
  van: { body: null, cab: null, trim: '#1c1c22' },
};

// two-wheelers and the riding horse: riders sit on top, fully visible
function makeOpen(type, color, grad) {
  const g = new THREE.Group(); const toon = (c) => new THREE.MeshToonMaterial({ color: new THREE.Color(c), gradientMap: grad });
  const tube = (mat, r, x0, y0, x1, y1, z = 0) => { const len = Math.hypot(x1 - x0, y1 - y0); const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, z); m.rotation.z = Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2; g.add(m); return m; };
  const wheels = []; const wheel = (x, r, spokes) => { const w = new THREE.Group(); w.position.set(x, r, 0.0);
    const tyre = new THREE.Mesh(new THREE.TorusGeometry(r * 0.9, r * 0.12, 8, 28), toon('#18181b')); w.add(tyre);
    if (spokes) for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(r * 1.75, 0.012, 0.012), toon('#b9bcc4')); s.rotation.z = (i * Math.PI) / 6; s.userData.outlineParameters = { visible: false }; w.add(s); }
    else { const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.62, 0.1, 16), toon('#9aa0aa')); hub.rotation.x = Math.PI / 2; w.add(hub); const sp = new THREE.Mesh(new THREE.BoxGeometry(r * 1.1, 0.05, 0.12), toon('#5a5d66')); sp.userData.outlineParameters = { visible: false }; w.add(sp); }
    g.add(w); wheels.push(w); return w; };
  const c = color || ({ bike: '#1d1d1f', scooter: '#c0392b', cycle: '#2f6fb5' })[type] || '#c0392b'; const body = toon(c), dark = toon('#2a2a2e'), steel = toon('#b9bcc4'), seatM = toon('#1c1c1f');
  let seats, len, top, r = 0.3, horse = null;
  if (type === 'cycle') { r = 0.34; wheel(-0.52, r, true); wheel(0.52, r, true);
    tube(body, 0.022, -0.52, r, -0.08, r); tube(body, 0.022, -0.08, r, -0.18, 0.88); tube(body, 0.022, -0.52, r, -0.18, 0.84); tube(body, 0.022, -0.18, 0.84, 0.42, 0.9); tube(body, 0.022, -0.08, r, 0.42, 0.9); tube(body, 0.022, 0.42, 0.95, 0.52, r);
    tube(steel, 0.015, 0.42, 0.9, 0.38, 1.08); tube(dark, 0.02, 0.3, 1.08, 0.5, 1.1, 0); const sd = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.12), seatM); sd.position.set(-0.2, 0.92, 0); g.add(sd);
    const crank = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.015, 6, 16), steel); crank.position.set(-0.08, r, 0.05); g.add(crank); const rack = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.14), steel); rack.position.set(-0.5, 0.8, 0); g.add(rack);
    seats = [[-0.2, 0.92], [-0.52, 0.84]]; len = 1.75; top = 1.1; }
  else if (type === 'scooter') { r = 0.27; wheel(-0.62, r, false); wheel(0.62, r, false);
    const shp = new THREE.Shape([[-0.95, 0.42], [-0.95, 0.72], [-0.55, 0.82], [-0.15, 0.82], [-0.05, 0.45], [0.38, 0.45], [0.5, 1.05], [0.66, 1.08], [0.72, 0.55], [0.82, 0.42], [0.62, 0.36], [-0.3, 0.36]].map(([x, y]) => new THREE.Vector2(x, y)));
    const geo = new THREE.ExtrudeGeometry(shp, { depth: 0.42, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 }); geo.translate(0, 0, -0.21); g.add(new THREE.Mesh(geo, body));
    const sd = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.55, 4, 10), seatM); sd.rotation.z = Math.PI / 2; sd.position.set(-0.52, 0.88, 0); sd.scale.set(0.7, 1, 1.2); g.add(sd);
    tube(dark, 0.03, 0.58, 1.06, 0.55, 1.22); tube(dark, 0.022, 0.45, 1.22, 0.68, 1.24); const hl = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff3c4, toneMapped: false })); hl.position.set(0.72, 1.12, 0); g.add(hl);
    seats = [[-0.35, 0.9], [-0.72, 0.92]]; len = 1.8; top = 1.25; }
  else if (type === 'bike') { r = 0.32; wheel(-0.68, r, false); wheel(0.68, r, false);
    const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.3, 4, 10), body); tank.rotation.z = Math.PI / 2 - 0.15; tank.position.set(0.18, 0.88, 0); tank.scale.set(1, 1, 0.8); g.add(tank);
    const eng = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 0.3), toon('#55585f')); eng.position.set(0, 0.5, 0); g.add(eng); tube(steel, 0.035, -0.6, 0.4, 0.05, 0.42, 0.18);
    const sd = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.09, 0.26), seatM); sd.position.set(-0.32, 0.86, 0); g.add(sd); const guard = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.24), body); guard.position.set(-0.72, 0.72, 0); guard.rotation.z = -0.25; g.add(guard);
    tube(dark, 0.03, -0.68, r, -0.1, 0.62); tube(steel, 0.03, 0.68, r, 0.45, 1.0); tube(dark, 0.022, 0.36, 1.05, 0.56, 1.08); const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 14), new THREE.MeshBasicMaterial({ color: 0xfff3c4, toneMapped: false })); hl.rotation.z = Math.PI / 2; hl.position.set(0.55, 0.95, 0); g.add(hl);
    seats = [[-0.2, 0.9], [-0.58, 0.92]]; len = 2.05; top = 1.1; }
  else { horse = makeAnimal('horse', 7, { grad, color: color || '#f3f1ec' }); g.add(horse.group);
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.74), toon('#c0283a')); cloth.position.set(-0.05, horse.back - 0.12, 0); g.add(cloth);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.06, 0.76), toon('#e8b923')); trim.position.set(-0.05, horse.back - 0.36, 0); trim.userData.outlineParameters = { visible: false }; g.add(trim);
    seats = [[-0.05, horse.back + 0.05]]; len = horse.len; top = horse.height; }
  return { type, group: g, wheels, lights: [], door: null, len, top, seats, wheelR: r, doorX: seats[0][0], open: true,
    set(t, { spin = 0, moving = 0 } = {}) { for (const w of wheels) w.rotation.z = -spin / r; if (horse) horse.set(t, { phase: spin * 2.6, moving, run: 0 }); } };
}

export function makeVehicle(type, color, grad) {
  if (OPEN.has(type)) return makeOpen(type, color, grad);
  const sp = (SPEC[type] || SPEC.car)(); const look = LOOK[type] || LOOK.car;
  const g = new THREE.Group(); const toon = (c, extra = {}) => new THREE.MeshToonMaterial({ color: new THREE.Color(c), gradientMap: grad, ...extra });
  const bodyCol = look.body || color || '#c0392b', cabCol = look.cab || bodyCol;
  const D = sp.depth;
  const ext = (shape, depth, mat) => { const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 2, curveSegments: 6 }); geo.translate(0, 0, -depth / 2); const m = new THREE.Mesh(geo, mat); g.add(m); return m; };
  ext(shapeOf(sp.body), D, toon(bodyCol));
  ext(shapeOf(sp.cab, sp.holes), D - 0.12, toon(cabCol));
  // dark interior floor + seat backs, so the inside does not look hollow
  const inner = new THREE.Mesh(new THREE.BoxGeometry(sp.len * 0.8, 0.08, D * 0.8), toon('#2a2a30')); inner.position.set(0, 0.72, 0); g.add(inner);
  for (const [sx] of sp.seats) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, D * 0.7), toon('#3a3a44')); b.position.set(sx - 0.42, 0.95, -0.15); b.userData.outlineParameters = { visible: false }; g.add(b); }
  // stripe / text / signs
  const side = D / 2 + 0.06;
  if (look.stripe) { const s = new THREE.Mesh(new THREE.BoxGeometry(sp.len * 0.92, 0.1, 0.02), toon(look.stripe)); s.position.set(0, type === 'auto' ? 0.5 : 0.62, side); s.userData.outlineParameters = { visible: false }; g.add(s); }
  if (look.text) { const [txt, bg, fg] = look.text; const m = new THREE.Mesh(new THREE.PlaneGeometry(type === 'ambulance' ? 2.0 : 1.3, 0.32), new THREE.MeshBasicMaterial({ map: textTex(txt, bg, fg, txt.length > 6 ? 900 : 512), transparent: true, toneMapped: false }));
    m.position.set(type === 'ambulance' ? -0.9 : -0.85, type === 'ambulance' ? 0.82 : 0.86, side + 0.01); m.userData.outlineParameters = { visible: false }; g.add(m); }
  if (look.cross) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), new THREE.MeshBasicMaterial({ map: crossTex(), toneMapped: false })); m.position.set(-1.6, 1.7, side - 0.02); m.userData.outlineParameters = { visible: false }; g.add(m); }
  if (look.sign) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.3), new THREE.MeshBasicMaterial({ map: textTex(...look.sign, 256, 96), toneMapped: false })); m.position.set(-0.15, sp.top + 0.12, 0); g.add(m); }
  // siren light bar
  const lights = [];
  if (look.lights) { const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.5), toon('#222226')); base.position.set(-0.2, sp.top + 0.06, 0); g.add(base);
    look.lights.forEach((c, i) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.42), new THREE.MeshBasicMaterial({ color: new THREE.Color(c), toneMapped: false })); m.position.set(-0.4 + i * 0.42, sp.top + 0.17, 0); m.userData.base = new THREE.Color(c); g.add(m); lights.push(m); }); }
  // lamps
  const lamp = (c, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.3), new THREE.MeshBasicMaterial({ color: c, toneMapped: false })); m.position.set(x, y, D / 2 - 0.2); m.userData.outlineParameters = { visible: false }; g.add(m); };
  lamp(0xfff3c4, sp.len / 2 + 0.02, type === 'auto' ? 0.95 : 0.78); lamp(0xd8231d, -sp.len / 2 - 0.02, 0.82);
  // wheels with a visible spoke so the turning shows
  const wheels = [];
  for (const wx of sp.wheels) for (const wz of [D / 2 - 0.12, -D / 2 + 0.12]) {
    const w = new THREE.Group(); w.position.set(wx, sp.r, wz);
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(sp.r, sp.r, 0.24, 20), toon('#18181b')); tyre.rotation.x = Math.PI / 2; w.add(tyre);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(sp.r * 0.55, sp.r * 0.55, 0.26, 16), toon('#b9bcc4')); hub.rotation.x = Math.PI / 2; hub.userData.outlineParameters = { visible: false }; w.add(hub);
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(sp.r * 1.0, 0.07, 0.28), toon('#5a5d66')); spoke.userData.outlineParameters = { visible: false }; w.add(spoke);
    g.add(w); wheels.push(w);
  }
  // door (front, near side): swings open towards the camera around its front edge
  let door = null;
  if (sp.door) { const [x0, x1, y0, y1] = sp.door; const hinge = new THREE.Group(); hinge.position.set(x1, 0, side - 0.03); const p = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, 0.05), toon(bodyCol)); p.position.set(-(x1 - x0) / 2, (y0 + y1) / 2, 0); hinge.add(p);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.04), toon('#2a2a2e')); handle.position.set(-(x1 - x0) + 0.2, y1 - 0.16, 0.04); handle.userData.outlineParameters = { visible: false }; hinge.add(handle); g.add(hinge); door = hinge; }
  return {
    type, group: g, wheels, lights, door, len: sp.len, top: sp.top, seats: sp.seats, wheelR: sp.r,
    doorX: sp.door ? (sp.door[0] + sp.door[1]) / 2 : sp.seats[1] ? sp.seats[1][0] : 0, // where people get in
    set(t, { spin = 0, door: d = 0, siren = false } = {}) {
      for (const w of wheels) w.rotation.z = -spin / sp.r;
      if (door) door.rotation.y = -1.15 * d;
      lights.forEach((m, i) => { const on = siren && Math.floor(t * 6 + i) % 2 === 0; m.material.color.copy(m.userData.base).multiplyScalar(on ? 1.6 : 0.35); });
    },
  };
}
