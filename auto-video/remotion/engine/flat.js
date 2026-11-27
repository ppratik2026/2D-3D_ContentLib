// "Flat 2D Explainer" characters, drawn in code: big round head, dot eyes that blink, a mouth that talks,
// a pill body, stick arms and legs with round hands — like YouTube explainer cartoons. Outfits come from the role
// (police, judge, lawyer, doctor, waiter, thief …). Arms use 2-bone IK, so hands really reach a cup, a mouth or a hand.
// The object is shaped like the 3D actors (o, height, hipY, bones.Head / RightHand …) so the stage can use it the same way.
import * as THREE from 'three';

export { hash, mat, INK, shade, rrect, outlined, circle, pill, bar };
const SKINS = ['#f1c79a', '#e5b07e', '#d79d6c', '#f6d2b0', '#c98d5e', '#eab98c'];
const hash = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967295; };
const mat = (c) => { const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(c), side: THREE.DoubleSide }); m.userData.outlineParameters = { visible: false }; return m; };
const INK = '#16161c';
const shade = (c, k = 0.72) => { const x = new THREE.Color(c); x.multiplyScalar(k); return '#' + x.getHexString(); }; // far-side limbs are a little darker

function rrect(w, h, r) { const s = new THREE.Shape(); const x = -w / 2, y = -h / 2; r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; }
// a filled shape with a dark outline behind it
function outlined(geoFill, geoLine, color, z = 0) { const g = new THREE.Group(); const line = new THREE.Mesh(geoLine, mat(INK)); line.position.z = z - 0.002; const fill = new THREE.Mesh(geoFill, mat(color)); fill.position.z = z; g.add(line, fill); g.userData.fill = fill; return g; }
const circle = (r, color, ow = 0.018, z = 0) => outlined(new THREE.CircleGeometry(r, 40), new THREE.CircleGeometry(r + ow, 40), color, z);
const pill = (w, h, color, ow = 0.018, z = 0, r = null) => outlined(new THREE.ShapeGeometry(rrect(w, h, r ?? Math.min(w, h) / 2), 10), new THREE.ShapeGeometry(rrect(w + ow * 2, h + ow * 2, (r ?? Math.min(w, h) / 2) + ow), 10), color, z);
const bar = (w, h, color, z = 0) => { const m = new THREE.Mesh(new THREE.ShapeGeometry(rrect(w, h, Math.min(w, h) / 2), 6), mat(color)); m.position.z = z; return m; };

function outfit(ch) { // colours and extras from the role
  const r = `${ch.role || ''} ${ch.name || ''}`.toLowerCase();
  const o = { top: ch.top_color || '#3a6ea5', legs: INK, coat: null, cap: null, stripes: null, vest: null, bow: null, bands: false, robe: false, badge: false, belt: false, glasses: false, mask: false, apron: null };
  if (/police|inspector|constable|havaldar|si\b|sub-inspector|officer/.test(r)) Object.assign(o, { top: '#b59a63', legs: '#8c7548', cap: '#8c7548', badge: true, belt: true });
  else if (/judge|magistrate|jaj/.test(r)) Object.assign(o, { top: '#1c1c22', robe: true, bands: true, glasses: true });
  else if (/lawyer|advocate|vakil/.test(r)) Object.assign(o, { top: '#f4f4f2', coat: '#1c1c22', bands: true, legs: '#2b2b30' });
  else if (/doctor|nurse/.test(r)) Object.assign(o, { coat: '#f7f7f5' });
  else if (/waiter|server|barista/.test(r)) Object.assign(o, { top: '#f7f7f5', vest: '#2b3a55', bow: '#c0283a' });
  else if (/thief|chor|pickpocket|robber|criminal|accused/.test(r)) Object.assign(o, { top: '#2b2b30', stripes: '#e9e9ee', cap: '#2b2b30', mask: true });
  else if (/teacher|professor|clerk|scientist/.test(r)) o.glasses = true;
  if (ch.age === 'old') o.glasses = o.glasses || hash(ch.id) > 0.5;
  return o;
}

export function createFlatActor(scene, ch) {
  const kid = ch.age === 'child', old = ch.age === 'old', fem = ch.gender === 'female';
  const H = kid ? 1.15 : old ? 1.55 : fem ? 1.6 : 1.68; const k = H / 1.68; const O = outfit(ch);
  const skin = SKINS[Math.floor(hash(ch.id + 'skin') * SKINS.length)]; const hairC = old ? '#d9d9de' : ch.hair_color || '#1c1612';
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body); // body: bob / lean / sit offset
  const legLen = 0.56 * k, thigh = legLen * 0.5, shin = legLen * 0.5, armU = 0.25 * k, armL = 0.24 * k, torsoH = 0.5 * k, torsoW = 0.36 * k, headR = 0.235 * k * (kid ? 1.1 : 1);
  const hipY = legLen, chestY = hipY + torsoH, headY = chestY + headR * 0.82;
  const a = { flat: true, o: root, height: H, hipY, bones: {}, face: [], hasLipSync: true, ch, id: ch.id, H, legLen };
  // legs (back leg first, behind the body)
  const mkLimb = (len1, len2, w, color, z, handColor, foot) => { const top = new THREE.Group(); top.position.z = z; const up = bar(w, len1 + w, color); up.position.y = -len1 / 2; top.add(up);
    const knee = new THREE.Group(); knee.position.y = -len1; top.add(knee); const lo = bar(w, len2 + w, color); lo.position.y = -len2 / 2; knee.add(lo); const end = new THREE.Group(); end.position.y = -len2; knee.add(end);
    if (foot) { const f = pill(0.13 * k, 0.07 * k, INK, 0.0, 0.001, 0.03 * k); f.position.set(0.035 * k, -0.015, 0); end.add(f); } else { const hnd = circle(0.045 * k, handColor, 0.014, 0.002); end.add(hnd); }
    return { top, knee, end }; };
  const legColor = O.robe ? INK : O.legs !== INK ? O.legs : fem ? '#3b3b48' : ch.bottom_color || '#2f3a4f'; const lw = 0.068 * k;
  const legB = mkLimb(thigh, shin, lw, shade(legColor, 0.68), -0.03, null, true), legF = mkLimb(thigh, shin, lw, legColor, 0.03, null, true);
  legB.top.position.set(-0.05 * k, hipY, -0.03); legF.top.position.set(0.05 * k, hipY, 0.03); body.add(legB.top, legF.top);
  const armW = 0.056 * k; const sleeve = O.coat || O.top;
  const armB = mkLimb(armU, armL, armW, O.robe ? INK : INK, -0.05, skin, false), armF = mkLimb(armU, armL, armW, INK, 0.06, skin, false);
  const shX = torsoW * 0.42; armB.top.position.set(-shX, chestY - 0.06 * k, -0.05); armF.top.position.set(shX, chestY - 0.06 * k, 0.06); body.add(armB.top, armF.top);
  // sleeves (short coloured part at the shoulder)
  for (const arm of [armB, armF]) { const sl = bar(armW * 2.1, armU * 0.55, arm === armB ? shade(sleeve, 0.8) : sleeve, 0.003); sl.position.y = -armU * 0.25; arm.top.add(sl); }
  // torso
  const torso = new THREE.Group(); torso.position.set(0, hipY + torsoH / 2 - 0.01, 0); body.add(torso);
  const tH = O.robe ? torsoH + legLen * 0.55 : torsoH; const tY = O.robe ? -legLen * 0.27 : 0;
  const t0 = pill(torsoW, tH, O.coat || O.top, 0.02, 0, torsoW * 0.45); t0.position.y = tY; torso.add(t0);
  const deco = new THREE.Group(); torso.add(deco); const torsoMain = torso; { const torso = deco; // front details (hidden in back view)
  if (O.stripes) for (let i = 0; i < 5; i++) { const s = bar(torsoW * 0.92, 0.035 * k, O.stripes, 0.004); s.position.y = -tH / 2 + 0.08 * k + i * 0.08 * k; torso.add(s); }
  if (O.coat) { const inner = pill(torsoW * 0.36, tH * 0.92, O.top, 0.01, 0.005, 0.05); inner.position.y = 0.01; torso.add(inner); }
  if (O.vest) { const v = pill(torsoW * 0.82, tH * 0.72, O.vest, 0.01, 0.006, 0.08); v.position.y = -0.04; torso.add(v); const shirt = bar(torsoW * 0.18, tH * 0.7, O.top, 0.008); shirt.position.y = -0.03; torso.add(shirt); }
  if (O.bow) { const b1 = circle(0.028 * k, O.bow, 0.008, 0.01); b1.position.set(-0.03 * k, tH / 2 - 0.05 * k, 0); const b2 = circle(0.028 * k, O.bow, 0.008, 0.01); b2.position.set(0.03 * k, tH / 2 - 0.05 * k, 0); torso.add(b1, b2); }
  if (O.bands) { for (const dx of [-0.018, 0.018]) { const b = bar(0.03 * k, 0.11 * k, '#f7f7f5', 0.01); b.position.set(dx * k, tH / 2 - 0.08 * k + tY, 0); torso.add(b); } }
  if (O.badge) { const b = circle(0.025 * k, '#e8b923', 0.006, 0.01); b.position.set(-torsoW * 0.22, tH * 0.2, 0); torso.add(b); }
  if (O.belt) { const b = bar(torsoW, 0.04 * k, '#3a2b1c', 0.007); b.position.y = -tH / 2 + 0.06 * k; torso.add(b); }
  if (!O.robe && !O.coat && !O.vest && !O.stripes && !O.badge) { const v = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([[-0.05, 0], [0, -0.08], [0.05, 0], [0.04, 0], [0, -0.06], [-0.04, 0]].map(([x, y]) => new THREE.Vector2(x * k, y * k)))), mat(INK)); v.position.set(0, tH / 2 - 0.01, 0.006); torso.add(v); }
  if (fem && !O.robe && !O.coat && ch.age !== 'child') { const dup = bar(0.05 * k, tH * 0.95, ch.bottom_color || '#f2c418', 0.008); dup.rotation.z = 0.55; dup.position.set(0.02, 0.02, 0); torso.add(dup); }
  }
  // head
  const head = new THREE.Group(); head.position.set(0, headY, 0.08); body.add(head);
  const back = new THREE.Group(); head.add(back); // hair behind the head (long hair / bun)
  if (fem && !kid) { const hb = pill(headR * 2.15, headR * (old ? 2.1 : 2.7), hairC, 0.018, -0.02, headR); hb.position.y = old ? -0.02 : -headR * 0.38; back.add(hb); }
  if (fem && (kid || old)) { const bun = circle(headR * 0.42, hairC, 0.015, -0.025); bun.position.set(-headR * 0.75, headR * 0.6, 0); back.add(bun); }
  const skull = circle(headR, skin, 0.022, 0); head.add(skull);
  const face = new THREE.Group(); face.position.z = 0.01; head.add(face);
  const nose = circle(headR * 0.16, skin, 0.014, -0.004); nose.position.set(headR * 0.97, -headR * 0.05, 0); nose.visible = false; head.add(nose); a._nose = nose; // shows only in side view
  const eyes = [], lids = []; for (const dx of [-0.38, 0.38]) { const e = new THREE.Mesh(new THREE.CircleGeometry(0.03 * k, 18), mat(INK)); e.position.set(dx * headR, 0.04 * k, 0.004); face.add(e); eyes.push(e);
    const lid = new THREE.Mesh(new THREE.PlaneGeometry(0.075 * k, 0.07 * k), mat(skin)); lid.position.set(dx * headR, 0.075 * k, 0.006); lid.scale.y = 0.01; face.add(lid); lids.push(lid); }
  const brows = [-0.38, 0.38].map((dx) => { const b = bar(0.07 * k, 0.016 * k, INK, 0.007); b.position.set(dx * headR, 0.115 * k, 0); face.add(b); return b; });
  for (const dx of [-0.6, 0.6]) { const c = new THREE.Mesh(new THREE.CircleGeometry(0.032 * k, 14), new THREE.MeshBasicMaterial({ color: 0xff8a8a, transparent: true, opacity: 0.45 })); c.material.userData.outlineParameters = { visible: false }; c.position.set(dx * headR, -0.035 * k, 0.003); face.add(c); }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.045 * k, 0.009 * k, 6, 18, Math.PI * 0.9), mat(INK)); smile.rotation.z = Math.PI * 1.05; smile.position.set(0, -0.055 * k, 0.006); face.add(smile);
  const mouthO = new THREE.Group(); mouthO.position.set(0, -0.085 * k, 0.006); face.add(mouthO); const mo = new THREE.Mesh(new THREE.CircleGeometry(0.04 * k, 20), mat('#3a1416')); const tongue = new THREE.Mesh(new THREE.CircleGeometry(0.022 * k, 14), mat('#e05a6a')); tongue.position.set(0, -0.015 * k, 0.001); mouthO.add(mo, tongue);
  if (ch.gender === 'male' && (ch.age === 'adult' || old) && hash(ch.id + 'm') > 0.45) { const mu = new THREE.Mesh(new THREE.ShapeGeometry(rrect(0.11 * k, 0.03 * k, 0.015 * k)), mat(old ? '#d9d9de' : hairC)); mu.position.set(0, -0.035 * k, 0.007); face.add(mu); }
  if (fem && !kid) { const bindi = new THREE.Mesh(new THREE.CircleGeometry(0.012 * k, 10), mat('#d61f26')); bindi.position.set(0, 0.11 * k, 0.007); face.add(bindi); }
  if (O.glasses) for (const dx of [-0.38, 0.38]) { const g = new THREE.Mesh(new THREE.RingGeometry(0.048 * k, 0.062 * k, 24), mat(INK)); g.position.set(dx * headR, 0.04 * k, 0.008); face.add(g); }
  if (O.mask) { const m = bar(headR * 1.75, 0.075 * k, INK, 0.0065); m.position.set(0, 0.045 * k, 0); face.add(m); for (const e of eyes) e.material = mat('#f4f4f2'); }
  // hair on top (front)
  const hairTop = new THREE.Mesh(new THREE.CircleGeometry(headR * 1.04, 40, Math.PI * 0.08, Math.PI * 0.84), mat(hairC)); hairTop.position.set(0, headR * 0.4, 0.012); hairTop.scale.set(0.96, 0.62, 1); head.add(hairTop);
  const hairLine = new THREE.Mesh(new THREE.CircleGeometry(headR * 1.08, 40, Math.PI * 0.06, Math.PI * 0.88), mat(INK)); hairLine.position.set(0, headR * 0.4, 0.011); hairLine.scale.set(0.96, 0.64, 1); head.add(hairLine);
  { const hs = Math.floor(hash(ch.id + 'hair') * 3); if (!fem && !old && hs > 0) { const tuft = circle(headR * (hs === 1 ? 0.32 : 0.24), hairC, 0.014, 0.0125); tuft.position.set(headR * (hs === 1 ? 0.45 : -0.2), headR * (hs === 1 ? 0.78 : 0.95), 0); head.add(tuft); a._tuft = tuft; } }
  if (old && ch.gender === 'male') { hairTop.visible = hairLine.visible = false; for (const dx of [-0.95, 0.95]) { const s = circle(headR * 0.25, hairC, 0.01, -0.005); s.position.set(dx * headR, 0, 0); head.add(s); } }
  if (O.cap) { const cap = pill(headR * 2.1, headR * 0.55, O.cap, 0.018, 0.02, headR * 0.25); cap.position.set(0, headR * 0.78, 0); head.add(cap); const peak = bar(headR * 1.0, headR * 0.12, INK, 0.021); peak.position.set(headR * 0.65, headR * 0.5, 0); head.add(peak); }
  // back view (for over-the-shoulder shots): full hair, no face
  const backHair = new THREE.Group(); backHair.visible = false; head.add(backHair); { for (const dx of [-1, 1]) { const ear = circle(headR * 0.2, skin, 0.012, 0.025); ear.position.set(dx * headR * 0.95, -headR * 0.05, 0); backHair.add(ear); } const bh = circle(headR * 1.0, hairC, 0.022, 0.03); backHair.add(bh); if (fem && !kid) { const bh2 = pill(headR * 2.0, headR * 2.3, hairC, 0.02, 0.031, headR); bh2.position.y = -headR * 0.45; backHair.add(bh2); } }
  // bones for props / camera
  const mk = (parent, x, y) => { const g = new THREE.Group(); g.position.set(x, y, 0); parent.add(g); return g; };
  a.bones.Head = mk(head, 0, -headR * 0.2); a.bones.RightHand = armF.end; a.bones.LeftHand = armB.end; a.bones.RightFoot = legF.end; a.bones.LeftFoot = legB.end; a.bones.Hips = mk(body, 0, hipY);
  a.parts = { deco, root, body, head, face, back, backHair, hairTop, hairLine, eyes, lids, brows, smile, mouthO, armF, armB, legF, legB, torso, shoulderF: armF.top.position.clone(), shoulderB: armB.top.position.clone(), armU, armL, chestY, headY, headR, thigh, shin, k };
  scene.add(root); return a;
}

// 2-bone IK in the plane: returns shoulder and elbow angles so the hand reaches (dx, dy) from the shoulder (elbow bends "down/back")
function ik(dx, dy, L1, L2) { const d = Math.min(L1 + L2 - 1e-4, Math.max(1e-4, Math.hypot(dx, dy))); const a2 = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2))));
  const base = Math.atan2(dx, -dy); const a1 = base - Math.asin(Math.max(-1, Math.min(1, (L2 * Math.sin(a2)) / d))); return { sh: a1, el: Math.PI - a2 }; }
const sm = (a, b, t) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); };

// hand targets (facing right, metres, relative to the shoulder) for gestures; null = arm hangs (slight swing)
function gesture(name, kk, t, ph, P) {
  const s = P.k; const T = (x, y) => ({ x: x * s, y: y * s }); const g = { F: null, B: null, lean: 0, tilt: 0, face: null };
  const mouth = { x: P.headR * 0.55 - P.shoulderF.x, y: P.headY - 0.08 * s - P.shoulderF.y };
  switch (name) {
    case 'drink': { const lift = sm(0, 0.3, ph) * (1 - sm(0.72, 1, ph)); g.F = { x: lerp(0.16 * s, mouth.x, lift), y: lerp(-0.2 * s, mouth.y, lift) }; g.tilt = -0.12 * lift; g.cup = true; break; }
    case 'hold_cup': g.F = T(0.17, -0.22); g.cup = true; break;
    case 'wave': g.F = T(0.08 + Math.sin(t * 10) * 0.07, 0.38); g.face = 'happy'; break;
    case 'point': g.F = T(0.46, 0.06); break;
    case 'think': g.F = { x: mouth.x - 0.02 * s, y: mouth.y - 0.06 * s }; g.tilt = 0.12; break;
    case 'scroll_phone': g.F = T(0.22, -0.1 + Math.sin(t * 0.7) * 0.004); g.B = T(0.3, -0.12); g.tilt = 0.2; g.look = 0.9; g.phone = true; break;
    case 'phone': g.F = { x: P.headR * 0.95 - P.shoulderF.x, y: P.headY - P.shoulderF.y }; break;
    case 'shock': g.F = T(0.12, 0.28); g.B = T(-0.12, 0.28); g.face = 'surprised'; g.lean = -0.06; break;
    case 'hands_up': g.F = T(0.08, 0.46); g.B = T(-0.08, 0.46); g.face = 'scared'; break;
    case 'clap': { const c = Math.abs(Math.sin(t * 9)); g.F = T(0.12 + 0.05 * c, -0.04); g.B = T(0.32 - 0.05 * c, -0.04); g.face = 'happy'; break; }
    case 'namaste': case 'pray': g.F = T(0.02, -0.12); g.B = T(0.29, -0.12); g.tilt = 0.1; break;
    case 'salute': g.F = { x: P.headR * 0.3 - P.shoulderF.x, y: P.headY + 0.08 * s - P.shoulderF.y }; break;
    case 'cry': g.F = { x: mouth.x, y: mouth.y + 0.06 * s }; g.B = { x: mouth.x + 0.25 * s, y: mouth.y + 0.06 * s }; g.face = 'sad'; g.tilt = 0.15; break;
    case 'angry': g.F = T(0.1, -0.3); g.B = T(-0.05, -0.3); g.face = 'angry'; g.lean = 0.05; break;
    case 'laugh': g.face = 'happy'; g.tilt = -0.1 + Math.sin(t * 14) * 0.04; break;
    case 'nod': g.tilt = Math.sin(t * 7) * 0.12; break;
    case 'look_around': g.look = Math.sin(t * 2.2); break;
    case 'grab': g.F = T(0.42, 0.02); g.lean = 0.08; g.face = 'angry'; break;
    case 'cuff': g.F = T(0.36, -0.12); g.B = T(0.55, -0.12); g.lean = 0.06; break;
    case 'give': case 'receive': case 'serve': g.F = T(0.38, -0.08); if (name === 'serve') g.B = T(0.58, -0.08); break;
    case 'punch': { const c = Math.max(0, Math.sin(t * 9)), d = Math.max(0, Math.sin(t * 9 + Math.PI)); g.F = T(0.2 + 0.3 * c, 0.05); g.B = T(0.4 + 0.3 * d, 0.05); g.face = 'angry'; g.lean = 0.08; break; }
    case 'kick': { const w = Math.sin(Math.min(1, ph / 0.3) * Math.PI); g.kick = w; g.face = 'angry'; g.F = T(0.1, -0.2); g.B = T(-0.2, 0.0); break; }
    case 'hit_back': g.lean = -0.18; g.face = 'scared'; g.F = T(0.2, 0.25); g.B = T(0.05, 0.3); break;
    case 'write': g.B = T(0.32, -0.12); g.F = T(0.3 + Math.sin(t * 11) * 0.02, -0.04); g.tilt = 0.15; break;
    case 'read': case 'file': g.F = T(0.3, -0.05); g.B = T(0.48, -0.05); g.tilt = 0.12; break;
    case 'pickpocket': g.F = T(0.42, -0.42 + Math.sin(t * 6) * 0.02); g.lean = 0.12; g.face = 'sly'; break;
    case 'gavel': { const h = Math.max(0, Math.sin(t * 9)); g.F = T(0.32, -0.05 + 0.22 * h); break; }
    case 'sip': { const lift = sm(0, 0.25, ph) * (1 - sm(0.75, 1, ph)); g.F = { x: lerp(0.17 * s, mouth.x, lift), y: lerp(-0.22 * s, mouth.y, lift) }; g.tilt = -0.15 * lift; g.cup = true; g.sipping = lift > 0.9; break; }
    case 'cower': g.F = T(0.12, 0.36); g.B = T(0.26, 0.4); g.face = 'scared'; g.lean = -0.16; g.crouch = 0.12; break;
    case 'hug': g.F = T(0.42, 0.04); g.B = T(0.5, 0.06); g.lean = 0.06; g.face = 'happy'; break;
    case 'push': g.F = T(0.5, 0.08); g.B = T(0.62, 0.08); g.lean = 0.12; break;
    case 'slap': { const w = sm(0.3, 0.55, ph); g.F = T(0.15 + 0.35 * w, 0.4 - 0.35 * w); g.face = 'angry'; break; }
    case 'dance': g.F = T(0.2, 0.42 + Math.sin(t * 6) * 0.05); g.B = T(-0.2, 0.42 - Math.sin(t * 6) * 0.05); g.face = 'happy'; g.tilt = Math.sin(t * 6) * 0.1; break;
    case 'eat': { const up = Math.max(0, Math.sin(t * 3)); g.B = T(0.3, -0.18); g.F = { x: lerp(0.3 * s, mouth.x, up), y: lerp(-0.12 * s, mouth.y, up) }; break; }
    case 'cook': case 'chop': case 'type': g.F = T(0.36 + Math.sin(t * 8) * 0.03, -0.2); g.B = T(0.48, -0.2); break;
    case 'examine': case 'torch': case 'test_tube': g.F = T(0.38, 0.05); g.tilt = 0.1; break;
    case 'blow': g.lean = 0.08; g.face = 'happy'; break;
    case 'cut': g.F = T(0.36, -0.15 + Math.abs(Math.sin(t * 4)) * 0.05); g.B = T(0.48, -0.15); break;
    case 'climb': g.F = T(0.08, 0.4 + Math.sin(t * 6) * 0.08); g.B = T(0.18, 0.4 - Math.sin(t * 6) * 0.08); break;
    case 'aarti': { const a = t * 3; g.F = T(0.32 + Math.cos(a) * 0.08, -0.05 + Math.sin(a) * 0.08); break; }
    case 'put_down': g.F = T(0.36, -0.26); g.lean = 0.05; break;
    case 'hold_hand': g.F = T(0.2, -0.42); break;
    case 'hold_hand_b': g.B = T(-0.2, -0.42); break;
    default: break;
  }
  return g;
}
const lerp = (a, b, k) => a + (b - a) * k;

export function poseFlat(a, t, st) {
  const P = a.parts; a.o.visible = st.visible !== false; if (!a.o.visible) return;
  const yaw = st.yaw || 0; const face = Math.abs(yaw) < 0.45 ? 0 : Math.sign(yaw); // 0 = front view
  a.o.position.copy(st.pos || new THREE.Vector3()); a.o.scale.set(face < 0 ? -1 : 1, 1, 1);
  const back = !!st.back; P.face.visible = !back; P.backHair.visible = back; P.deco.visible = !back; P.back.visible = !back; P.hairTop.visible = P.hairLine.visible = !back && !(a.ch.age === 'old' && a.ch.gender === 'male'); if (a._tuft) a._tuft.visible = !back; if (a._side) a._side.visible = !back;
  const k = P.k, w = st.walk || 0, r = st.run || 0; const moving = Math.max(w, r);
  const dist = st.walkDist != null ? st.walkDist : t * 1.2; const ph = (dist / (r ? 1.4 : 0.85)) * Math.PI * 2 + a.id.length;
  // legs
  const sit = st.sit || 0, ride = st.ride || 0; let hipF = 0, hipB = 0, kneeF = 0, kneeB = 0;
  const seat = Math.max(sit, ride);
  // gait with planted feet: each foot stays on the ground while the body passes over it (no sliding), then swings forward with a lift
  let drop = 0, gaitP = 0, gait = false, rollF = 0, rollB = 0;
  if (moving && seat < 0.5 && !st.lie) { gait = true; const run = r > 0; const legL = P.thigh + P.shin; const S = (run ? 0.95 : 0.6) * legL, sF = run ? 0.38 : 0.62, L = S / sF, lift = (run ? 0.18 : 0.065) * k; // short cartoon steps: the standing leg stays almost straight
    gaitP = (((dist / L) + (a.id.length % 7) * 0.13) % 1 + 1) % 1;
    const foot = (u) => { u = ((u % 1) + 1) % 1; if (u < sF) return { x: S / 2 - (u / sF) * S, y: 0, st: true }; const v = (u - sF) / (1 - sF); const e = v * v * (3 - 2 * v); return { x: -S / 2 + e * S, y: lift * Math.sin(Math.PI * v), st: false }; };
    const fF = foot(gaitP), fB = foot(gaitP + 0.5); const roll = (u) => { u = ((u % 1) + 1) % 1; if (u < 0.14) return 0.32 * (1 - u / 0.14); if (u < sF && u > sF - 0.16) return -0.55 * ((u - (sF - 0.16)) / 0.16); if (u >= sF) { const v = (u - sF) / (1 - sF); return -0.55 * (1 - Math.min(1, v * 3)) + 0.18 * Math.sin(Math.PI * v); } return 0; }; rollF = roll(gaitP); rollB = roll(gaitP + 0.5); const reach = legL * 0.995; let hh = Infinity;
    for (const f of [fF, fB]) if (f.st) hh = Math.min(hh, Math.sqrt(Math.max(0.01, reach * reach - f.x * f.x)));
    if (hh === Infinity) hh = reach + lift * 0.35; // both feet in the air (running)
    hh = Math.min(hh, legL); drop = legL - hh; const ank = 0.03 * k;
    const legIK = (f) => { const sol = ik(-f.x, f.y + ank - hh, P.thigh, P.shin); return [-sol.sh, -sol.el]; };
    [hipF, kneeF] = legIK(fF); [hipB, kneeB] = legIK(fB); } hipF = lerp(hipF, ride ? 1.1 : 1.55, seat); hipB = lerp(hipB, ride ? 1.0 : 1.5, seat); kneeF = lerp(kneeF, -1.55, seat); kneeB = lerp(kneeB, -1.55, seat);
  const g = gesture(st.gesture?.name || (st.talk ? 'talk' : ''), st.gesture?.k ?? 1, t, st.gesture?.ph ?? ((t * 0.5) % 1), P);
  if (g.crouch && !seat) { hipF += 0.55; hipB += 0.45; kneeF -= 1.0; kneeB -= 0.9; }
  if (g.kick) { hipF = -0.5 + 1.8 * g.kick; kneeF = -0.9 * (1 - g.kick); }
  if (st.lie) { hipF = hipB = kneeF = kneeB = 0; }
  P.legF.top.rotation.z = hipF; P.legF.knee.rotation.z = kneeF; P.legB.top.rotation.z = hipB; P.legB.knee.rotation.z = kneeB;
  P.legF.end.rotation.z = seat > 0.5 ? 0 : -(hipF + kneeF) + rollF; P.legB.end.rotation.z = seat > 0.5 ? 0 : -(hipB + kneeB) + rollB; // soles stay flat
  // body bob / lean / sit drop
  P.body.position.y = gait ? -drop : 0; P.body.position.y -= seat * (P.thigh * 0.95) + (g.crouch || 0) * k; P.body.rotation.z = -(g.lean + (moving ? (r ? 0.14 : 0.04) : 0) + (st.struggle ? Math.sin(t * 13) * 0.08 * st.struggle : 0));
  // arms: IK to targets, or swing / hang
  const gk = st.gesture?.k ?? 1;
  const arm = (side, target) => { const A = side === 'F' ? P.armF : P.armB; const S = side === 'F' ? P.shoulderF : P.shoulderB;
    let sh, el; if (target) { const sol = ik(target.x + (side === 'B' ? (P.shoulderF.x - S.x) : 0), target.y, P.armU, P.armL); sh = sol.sh * gk; el = sol.el * gk; }
    else { const sw = gait ? Math.cos(gaitP * Math.PI * 2) * (side === 'F' ? -1 : 1) * (r ? 0.95 : 0.45) : 0; sh = sw + (side === 'F' ? 0.08 : -0.08); el = gait ? (r ? 1.5 : 0.3 + 0.15 * Math.max(0, sw)) : 0.12; if (seat > 0.5 && !moving) { sh = 0.55; el = 0.9; } }
    A.top.rotation.z = sh; A.knee.rotation.z = el; };
  let F = g.F, B = g.B;
  if (st.talk && !F) { const c = Math.sin(t * 3.1), d = Math.sin(t * 5.3); F = { x: (0.22 + 0.06 * c) * k, y: (-0.12 + 0.08 * d) * k }; }
  if (st.cuffed) { F = { x: 0.14 * k, y: -0.3 * k }; B = { x: 0.3 * k, y: -0.3 * k }; }
  const toSh = (q) => ({ x: q.x - P.shoulderF.x, y: q.y - P.shoulderF.y - P.body.position.y }); // root-local point → shoulder target
  if (st.holdF) F = toSh(st.holdF); if (st.holdB) B = toSh(st.holdB);
  arm('F', F); arm('B', B);
  // head: tilt, nod, look; face
  P.head.rotation.z = -(g.tilt || 0) + (st.talk ? Math.sin(t * 4.1) * 0.04 * st.talk : 0) + (gait ? Math.sin(gaitP * Math.PI * 4) * (r ? 0.05 : 0.03) : 0);
  P.head.position.y = P.headY + (gait ? -Math.cos(gaitP * Math.PI * 4) * 0.008 * k : 0); P.torso.rotation.z = gait ? Math.sin(gaitP * Math.PI * 2) * 0.035 : 0;
  const FX = P.fx || { eyeX: 0.38 * P.headR, eyeY: 0.04 * k, lidY: 0.075 * k, lidDrop: 0.035 * k, browY: 0.115 * k, browUp: 0.025 * k, browBase: 0, smileY: -0.055 * k, frownY: -0.095 * k, look: 0.07 * k, shift: P.headR * 0.16, mouthShift: 0.04 * k };
  const side = face !== 0 && !back; if (a._nose) a._nose.visible = side; P.face.position.x = side ? FX.shift : 0;
  const emo = g.face || st.emotion || 'neutral'; const tired = emo === 'tired' || emo === 'sleepy' || emo === 'bored';
  const per = 3.3 + a.id.length * 0.31, q = (t + a.id.length * 1.7) % per; const blink0 = q < 0.14 ? 1 - Math.abs(q - 0.07) / 0.07 : 0; const blink = emo === 'sleep' || g.sipping ? 1 : Math.max(blink0, tired ? 0.5 : 0);
  if (P.bags) P.bags.visible = tired && !back;
  const look = g.look != null ? g.look : face === 0 ? 0 : 0.45; P.eyes.forEach((e, i) => { e.position.x = (i ? 1 : -1) * FX.eyeX + look * FX.look; });
  P.lids.forEach((l, i) => { l.scale.y = Math.max(0.01, blink); l.position.x = P.eyes[i].position.x; l.position.y = FX.lidY - blink * FX.lidDrop; });
  const browA = FX.browBase + (emo === 'angry' ? 0.3 : emo === 'sad' || emo === 'scared' || emo === 'worried' ? -0.38 : emo === 'surprised' ? -0.1 : tired ? -0.05 : 0); P.brows.forEach((b, i) => { b.rotation.z = (i ? 1 : -1) * browA; b.position.x = P.eyes[i].position.x; b.position.y = FX.browY + (emo === 'surprised' ? FX.browUp : 0) - (tired ? FX.browUp * 0.4 : 0); });
  const mouth = st.mouth || 0; const open = Math.max(mouth, emo === 'surprised' || emo === 'scared' ? 0.5 : emo === 'happy' && g.face === 'happy' ? 0.25 : 0);
  const down = emo === 'sad' || emo === 'angry' || emo === 'worried'; P.smile.visible = open < 0.12; P.smile.rotation.z = down ? (P.smileDown ?? Math.PI * 0.05 + Math.PI) : emo === 'happy' || emo === 'laugh' ? (P.smileUp ?? Math.PI * 1.05) : (P.smileFlat ?? Math.PI * 1.05); P.smile.position.y = down ? FX.frownY : FX.smileY;
  if (P.smileNeutral) { const neutral = !down && !(emo === 'happy' || emo === 'laugh') && open < 0.12; P.smileNeutral.visible = neutral; if (neutral) P.smile.visible = false; P.smileNeutral.position.x = look * FX.mouthShift; }
  P.smile.position.x = look * FX.mouthShift;
  P.mouthO.visible = open >= 0.12; P.mouthO.scale.set(0.8 + open * 0.4, 0.25 + open * 1.0, 1); P.mouthO.position.x = look * FX.mouthShift;
  a.o.updateMatrixWorld(true);
}

// flat props: a coffee mug with steam, a wallet
export function makeFlatCup(color = '#f4f1ea') {
  const g = new THREE.Group(); const body = pill(0.1, 0.12, color, 0.012, 0, 0.025); body.position.set(0.0, 0.05, 0); g.add(body);
  const band = bar(0.1, 0.022, '#b5472f', 0.003); band.position.set(0, 0.05, 0); g.add(band);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.011, 6, 16), mat(INK)); handle.position.set(0.06, 0.055, -0.001); g.add(handle);
  const top = new THREE.Mesh(new THREE.CircleGeometry(0.046, 20), mat('#6b3e22')); top.scale.y = 0.25; top.position.set(0, 0.108, 0.004); g.add(top);
  const steam = []; for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 4, 10, Math.PI), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })); s.material.userData.outlineParameters = { visible: false }; s.position.set(-0.025 + i * 0.025, 0.14, 0.005); g.add(s); steam.push(s); }
  g.userData.set = (t, hot = 1) => steam.forEach((s, i) => { const q = (t * 0.7 + i * 0.33) % 1; s.position.y = 0.13 + q * 0.09; s.rotation.z = Math.sin(t * 3 + i) * 0.6 + (i % 2 ? Math.PI : 0); s.material.opacity = 0.65 * Math.sin(q * Math.PI) * hot; });
  return g;
}
export function makeFlatWallet() { const g = new THREE.Group(); const w = pill(0.13, 0.09, '#6b3e22', 0.012, 0, 0.015); g.add(w); const f = bar(0.12, 0.02, '#8a5530', 0.003); f.position.y = 0.015; g.add(f); const n = bar(0.07, 0.035, '#5aa55a', -0.002); n.position.set(0.02, 0.045, 0); g.add(n); return g; }
