// ================= v4.18: 🧸 Cartoon 2D — HD Village style =================
// Indian village cartoon look: asli anupaat wale characters (shading, lungi / dhoti / saree border + pallu, moonchh, chappal),
// props (charpai, gilaas, lathi), jaanwar (bhains, gaay, bakri, kutta), aur BHAARI backgrounds parat-dar-parat
// (aasmaan → door ke ped → khet / ghar / ped → aage ki ghaas) + camera pan + parallax + hilte patte, udti chidiya, chalte baadal.
// cartoon2d.js ke helpers use karta hai. Video tab → 🧸 Cartoon 2D → Look: HD village.

const HD_INK = '#2b1d16';
const hdRnd = (seed) => { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
function hdCol(hex, f) { return tcShade(hex, f); }
function hdGradX(x, x0, x1, col, dark = 0.8, light = 1.08) { const g = x.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, hdCol(col, dark)); g.addColorStop(0.55, col); g.addColorStop(1, hdCol(col, light)); return g; }
function hdGradY(x, y0, y1, c0, c1) { const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, c0); g.addColorStop(1, c1); return g; }
function hdPath(x, pts) { x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]); x.closePath(); }
function hdHull(pts) { const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p; const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); const lo = [], up = []; for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); } for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); } up.pop(); lo.pop(); return lo.concat(up); }
function hdFillStroke(x, fill, lw = 1.8, ink = HD_INK) { x.fillStyle = fill; x.fill(); if (lw) { x.strokeStyle = ink; x.lineWidth = lw; x.lineJoin = 'round'; x.stroke(); } }
// 2-haddi IK: kooliha / kandha → ghutna / kohni → pair / haath (mod hamesha aage +x)
function hdIK(A, F, L1, L2, bend = 1) {
  let dx = F[0] - A[0], dy = F[1] - A[1], d = Math.hypot(dx, dy); const max = L1 + L2 - 0.01;
  if (d > max) { F = [A[0] + dx / d * max, A[1] + dy / d * max]; dx = F[0] - A[0]; dy = F[1] - A[1]; d = max; }
  d = Math.max(d, Math.abs(L1 - L2) + 0.01);
  const a = Math.acos(tcClamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1)), base = Math.atan2(dy, dx), ang = base - a * bend;
  return [[A[0] + Math.cos(ang) * L1, A[1] + Math.sin(ang) * L1], F];
}
// mota-patla ang (do parat: pehle sab ki kaali rekha, phir rang)
function hdSeg(a, b, w0, w1) { const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d; return [[a[0] + nx * w0, a[1] + ny * w0], [b[0] + nx * w1, b[1] + ny * w1], [b[0] - nx * w1, b[1] - ny * w1], [a[0] - nx * w0, a[1] - ny * w0]]; }
function hdLimb(x, pts, ws, col, ow = 1.8) {
  const segs = []; for (let i = 0; i < pts.length - 1; i++) segs.push(hdSeg(pts[i], pts[i + 1], ws[i] / 2, ws[i + 1] / 2));
  const all = (fill) => { x.fillStyle = fill; for (const sg of segs) { hdPath(x, sg); x.fill(); } for (let i = 0; i < pts.length; i++) { x.beginPath(); x.arc(pts[i][0], pts[i][1], ws[i] / 2, 0, 7); x.fill(); } };
  // 1) bahar ki rekha (thoda mota kaala), 2) saaf ek rang — jod par koi dhabba nahi
  x.save(); x.strokeStyle = HD_INK; x.lineWidth = ow * 2; x.lineJoin = 'round'; for (const sg of segs) { hdPath(x, sg); x.stroke(); } for (let i = 0; i < pts.length; i++) { x.beginPath(); x.arc(pts[i][0], pts[i][1], ws[i] / 2, 0, 7); x.stroke(); } x.restore();
  all(col);
  // halki parchhai ek taraf (cel shading)
  x.save(); x.beginPath(); for (const sg of segs) { x.moveTo(sg[0][0], sg[0][1]); x.lineTo(sg[1][0], sg[1][1]); x.lineTo(sg[2][0], sg[2][1]); x.lineTo(sg[3][0], sg[3][1]); x.closePath(); } x.clip();
  x.fillStyle = 'rgba(0,0,0,0.13)'; for (const sg of segs) { const m0 = [(sg[0][0] + sg[3][0]) / 2, (sg[0][1] + sg[3][1]) / 2], m1 = [(sg[1][0] + sg[2][0]) / 2, (sg[1][1] + sg[2][1]) / 2]; hdPath(x, [[m0[0] * 0.6 + sg[3][0] * 0.4, m0[1] * 0.6 + sg[3][1] * 0.4], [m1[0] * 0.6 + sg[2][0] * 0.4, m1[1] * 0.6 + sg[2][1] * 0.4], sg[2], sg[3]]); x.fill(); }
  x.restore();
}

// ---------- kapde ki rang-sajja ----------
function hdPattern(x, kind, col, box) {
  const [x0, y0, x1, y1] = box;
  x.save(); x.globalAlpha = 0.35;
  if (kind === 'checks') { x.strokeStyle = hdCol(col, 0.55); x.lineWidth = 2.2; for (let X = x0 - 4; X < x1; X += 11) { x.beginPath(); x.moveTo(X, y0); x.lineTo(X, y1); x.stroke(); } for (let Y = y0; Y < y1; Y += 11) { x.beginPath(); x.moveTo(x0, Y); x.lineTo(x1, Y); x.stroke(); } x.strokeStyle = hdCol(col, 1.5); x.lineWidth = 1; for (let X = x0 + 2; X < x1; X += 11) { x.beginPath(); x.moveTo(X, y0); x.lineTo(X, y1); x.stroke(); } }
  else if (kind === 'dots') { x.fillStyle = hdCol(col, 1.6); for (let Y = y0 + 4; Y < y1; Y += 9) for (let X = x0 + ((Y / 9) % 2) * 4.5; X < x1; X += 9) { x.beginPath(); x.arc(X, Y, 1.7, 0, 7); x.fill(); } }
  else if (kind === 'stripes') { x.strokeStyle = hdCol(col, 0.6); x.lineWidth = 2; for (let X = x0; X < x1; X += 8) { x.beginPath(); x.moveTo(X, y0); x.lineTo(X, y1); x.stroke(); } }
  x.restore();
}
// HD kapde (village + baaki): top, neeche, details
const HD_OUTFITS = {
  kurta_lungi: { top: 'kurta', low: 'lungi', lab: 'Kurta + lungi (village)' }, vest_lungi: { top: 'vest', low: 'lungi', gamchha: 1, lab: 'Vest + lungi + gamchha' },
  kurta_dhoti: { top: 'kurta', low: 'dhoti', lab: 'Kurta + dhoti' }, shirt_dhoti: { top: 'shirt', low: 'dhoti', lab: 'Half shirt + dhoti' },
  shirt_pant: { top: 'shirt', low: 'pant', lab: 'Shirt + pant' }, kurta_pajama: { top: 'kurta', low: 'pant', lab: 'Kurta pajama' },
  tshirt_shorts: { top: 'tshirt', low: 'shorts', lab: 'T-shirt + shorts (kid)' }, saree: { top: 'blouse', low: 'saree', lab: 'Saree' },
  lehenga_choli: { top: 'blouse', low: 'skirt_long', dupatta: 1, lab: 'Lehenga choli / ghagra' }, salwar: { top: 'kameez', low: 'pant', dupatta: 1, lab: 'Salwar kameez' },
  frock: { top: 'frock', low: 'bare', lab: 'Frock (girl)' }, suit: { top: 'suit', low: 'pant', lab: 'Suit' },
};
function hdOutfitOf(sp) {
  if (HD_OUTFITS[sp.hdOutfit]) return sp.hdOutfit;
  const o = sp.outfit, kid = sp.age === 'child' || sp.age === 'toddler';
  if (o === 'saree') return 'saree'; if (o === 'lehenga') return 'lehenga_choli'; if (o === 'salwar') return 'salwar'; if (o === 'frock' || o === 'dress') return kid ? 'frock' : 'salwar';
  if (o === 'dhoti') return 'kurta_dhoti'; if (o === 'kurta') return sp.region === 'indian' && (sp.age === 'old' || tcHash(sp.name || '') % 2) ? 'kurta_lungi' : 'kurta_pajama';
  if (o === 'suit' || o === 'coat') return 'suit'; if (o === 'shorts' || (kid && sp.gender === 'm')) return 'tshirt_shorts';
  if (sp.gender === 'f') return kid ? 'frock' : 'saree';
  return 'shirt_pant';
}
const HD_BODY = { // y upar ki taraf minus; adult ~300 lamba
  adult: { h: 300, sh: -244, waist: -168, hip: -150, tw: 30, hr: 25, L1: 78, L2: 74, A1: 54, A2: 50, lw: 22, aw: 15 },
  old: { h: 288, sh: -232, waist: -160, hip: -144, tw: 30, hr: 25, L1: 74, L2: 72, A1: 52, A2: 48, lw: 21, aw: 14, hunch: 8 },
  teen: { h: 262, sh: -210, waist: -146, hip: -130, tw: 25, hr: 24, L1: 68, L2: 64, A1: 47, A2: 44, lw: 19, aw: 13 },
  child: { h: 206, sh: -160, waist: -112, hip: -98, tw: 21, hr: 25, L1: 52, L2: 48, A1: 37, A2: 35, lw: 16, aw: 11 },
  toddler: { h: 156, sh: -114, waist: -80, hip: -68, tw: 18, hr: 24, L1: 36, L2: 33, A1: 28, A2: 26, lw: 14, aw: 10 },
};

// ---------- HD character ----------
function tcDrawCharHD(x, sp, st, k) {
  if (sp.animal) return hdDrawAnimal(x, sp, st, k);
  const B = { ...(HD_BODY[sp.age] || HD_BODY.adult) }, fem = sp.gender === 'f', t = st.t;
  if (fem && sp.age !== 'toddler' && sp.age !== 'child') { B.tw *= 0.88; B.aw *= 0.9; }
  const OK = hdOutfitOf(sp), O = HD_OUTFITS[OK], skin = sp.skin, top = sp.top, low = sp.bottom;
  const pat = sp.pattern || (O.low === 'lungi' ? 'checks' : O.top === 'shirt' && tcHash(sp.name || '') % 2 ? 'dots' : 'plain');
  x.save(); x.translate(st.x, st.y); x.scale(k * (st.f || 1), k);
  // parchhai
  const lift = st.jump || 0; x.save(); x.globalAlpha = 0.25; tcEll(x, 0, 2, 44 * (B.h / 300) * (1 - Math.min(0.5, lift / 300)), 9, '#000'); x.restore();
  const walking = st.walk > 0, amp = st.walk || 0, ph = st.ph || 0, sit = st.sit || 0, floor = st.sitFloor || 0;
  let bob = walking ? Math.abs(Math.cos(ph)) * 4 * amp : Math.sin(t * 2 + st.seed) * 0.8;
  if (st.dance) bob = Math.abs(Math.sin(st.dph)) * 10; if (st.laugh) bob += Math.abs(Math.sin(t * 15)) * 2.5;
  const seatH = B.L2 * 1.05, hipDrop = sit * (-B.hip - seatH) + floor * (-B.hip - 20);
  x.translate(0, -lift - bob + hipDrop);
  if (sit > 0.01) hdCharpai(x, -hipDrop, seatH, B, sit);
  const hunch = B.hunch || 0;
  // ---- taangein (IK) ----
  const legOf = (near) => {
    const hx = near ? B.tw * 0.28 : -B.tw * 0.22, H0 = [hx, B.hip];
    if (sit > 0.2) return hdIK(H0, [hx + 52 * (B.h / 300) + (near ? 4 : -6), -hipDrop], B.L1, B.L2, 1).concat([H0]);
    if (floor > 0.2) return hdIK(H0, [hx + (near ? 6 : 16), -hipDrop - 4], B.L1, B.L2, 1).concat([H0]);
    const s2 = near ? 0 : Math.PI; let sw = walking ? Math.sin(ph + s2) * amp : 0; if (st.dance) sw = 0.3 * Math.sin(st.dph + s2);
    const fx = hx * 0.5 + sw * B.L1 * 0.42, fy = -2 - (walking ? Math.max(0, -Math.cos(ph + s2)) * 12 * amp : 0) - (lift > 4 ? 14 : 0);
    return hdIK(H0, [fx, fy], B.L1, B.L2, 1).concat([H0]);
  };
  const legs = [legOf(false), legOf(true)]; // [knee, foot, hip]
  const lowKind = O.low;
  const legCol = lowKind === 'pant' || lowKind === 'dhoti' ? low : skin;
  const legW = lowKind === 'dhoti' ? [B.lw * 1.7, B.lw * 1.4, B.lw * 0.9] : lowKind === 'pant' ? [B.lw * 1.15, B.lw * 0.95, B.lw * 0.8] : [B.lw, B.lw * 0.78, B.lw * 0.6];
  legs.forEach(([kn, ft, hp], i) => {
    const c = i === 0 ? hdCol(legCol, 0.9) : legCol;
    if (lowKind === 'shorts') { hdLimb(x, [hp, kn, ft], [B.lw * 0.95, B.lw * 0.75, B.lw * 0.6], i === 0 ? hdCol(skin, 0.9) : skin); hdLimb(x, [hp, [hp[0] * 0.4 + kn[0] * 0.6, hp[1] * 0.4 + kn[1] * 0.6]], [B.lw * 1.35, B.lw * 1.3], i === 0 ? hdCol(low, 0.9) : low); }
    else hdLimb(x, [hp, kn, ft], legW, c);
    if (lowKind === 'dhoti') { x.strokeStyle = hdCol(low, 0.7); x.lineWidth = 1.2; for (let j = 1; j <= 3; j++) { const p = j / 4; x.beginPath(); x.moveTo(hp[0] * (1 - p) + kn[0] * p - 6, hp[1] * (1 - p) + kn[1] * p); x.lineTo(hp[0] * (1 - p) + kn[0] * p + 7, hp[1] * (1 - p) + kn[1] * p + 5); x.stroke(); } }
    // chappal
    x.save(); x.translate(ft[0], ft[1]); tcEll(x, 8, 1, 15 * B.h / 300, 4.5, '#3a2a22', 1.4); tcEll(x, 6, -3, 11 * B.h / 300, 5, i === 0 ? hdCol(skin, 0.9) : skin, 1.4); x.strokeStyle = '#6d3b22'; x.lineWidth = 2.2; x.beginPath(); x.moveTo(2, -4); x.lineTo(10, -6); x.stroke(); x.restore();
  });
  // ---- neeche ka kapda (lungi / saree / lehenga) — taangon ke hisaab se hull ----
  const along = (leg, f) => [leg[0][0] * (1 - f) + leg[1][0] * f, leg[0][1] * (1 - f) + leg[1][1] * f];
  const wrapLow = (frac, flare, col, border) => {
    const pts = [[-B.tw * 1.02, B.waist - 4], [B.tw * 1.02, B.waist - 4]];
    for (const L of legs) { const h = L[2], kn = L[0], p = along(L, frac); for (const s of [-1, 1]) { pts.push([h[0] + s * B.lw * 0.9, h[1] + 10]); pts.push([kn[0] + s * B.lw * (0.8 + flare * 0.3), kn[1]]); pts.push([p[0] + s * B.lw * (0.7 + flare), p[1]]); } }
    const hull = hdHull(pts); hdPath(x, hull); x.fillStyle = hdGradX(x, -B.tw * 1.3, B.tw * 1.3, col, 0.8, 1.06); x.fill();
    x.save(); hdPath(x, hull); x.clip();
    if (pat === 'checks' && lowKind === 'lungi') hdPattern(x, 'checks', col, [-B.tw * 2, B.waist - 6, B.tw * 3, 4]);
    if (border) { const by = Math.max(...hull.map((q) => q[1])); x.fillStyle = border; x.fillRect(-B.tw * 3, by - 9, B.tw * 6, 9); x.fillStyle = '#f2c14e'; x.fillRect(-B.tw * 3, by - 11, B.tw * 6, 2); }
    // silvatein
    x.strokeStyle = hdCol(col, 0.62); x.lineWidth = 1.3; const by = Math.max(...hull.map((q) => q[1]));
    if (lowKind === 'saree') for (let j = 0; j < 5; j++) { x.beginPath(); x.moveTo(B.tw * 0.25 + j * 4, B.waist + 18); x.lineTo(B.tw * 0.15 + j * 5.5, by); x.stroke(); }
    else { x.beginPath(); x.moveTo(B.tw * 0.55, B.waist); x.quadraticCurveTo(B.tw * 0.35, (B.waist + by) / 2, B.tw * 0.6, by); x.stroke(); x.beginPath(); x.moveTo(-B.tw * 0.5, B.waist + 8); x.quadraticCurveTo(-B.tw * 0.3, (B.waist + by) / 2, -B.tw * 0.5, by - 4); x.stroke(); }
    x.restore();
    hdPath(x, hull); x.strokeStyle = HD_INK; x.lineWidth = 1.8; x.lineJoin = 'round'; x.stroke();
    if (lowKind === 'lungi') { tcEll(x, B.tw * 0.45, B.waist + 2, 6, 4, hdCol(col, 0.85), 1.3); }
  };
  if (lowKind === 'lungi') wrapLow(sit > 0.2 || floor > 0.2 ? 0.55 : 0.5, 0.15, low);
  if (lowKind === 'saree') wrapLow(0.93, 0.35, top, sp.border || hdCol(top, 0.55));
  if (lowKind === 'skirt_long') wrapLow(0.92, 0.6, low, sp.border || '#f2c14e');
  // ---- peeche ki baanh ----
  const armA = (near) => {
    let a1 = near ? 0.1 : -0.08, a2 = near ? 0.2 : 0.25;
    if (walking) { const s2 = near ? Math.PI : 0; a1 = Math.sin(ph + s2) * 0.5 * amp; a2 = 0.35; if (st.run) { a1 *= 1.6; a2 = 1.3; } }
    if (st.talkG > 0.01 && near) { a1 = a1 * (1 - st.talkG) + (0.55 + 0.3 * st.talkA) * st.talkG; a2 = a2 * (1 - st.talkG) + (1.0 + 0.25 * Math.sin(t * 5)) * st.talkG; }
    if (st.talkG > 0.01 && !near && st.talkA > 0.5) { a1 = 0.25; a2 = 0.6; }
    if (st.wave > 0.01 && near) { a1 = a1 * (1 - st.wave) + 2.6 * st.wave; a2 = a2 * (1 - st.wave) + (0.25 * Math.sin(t * 10) - 0.2) * st.wave; }
    if (st.dance) { const s2 = near ? 0 : Math.PI; a1 = (near ? 2.3 : -2.3) + 0.4 * Math.sin(st.dph + s2); a2 = near ? -0.4 : 0.4; }
    if (st.think && near) { a1 = 0.75; a2 = 2.35; }
    if (st.point && near) { a1 = 1.5; a2 = 0; }
    if (st.cry && near) { a1 = 0.9; a2 = 2.2; }
    if (st.namaste) { a1 = near ? 0.35 : 0.55; a2 = near ? 2.6 : 2.35; }
    if (st.laugh || st.hipsHands) { a1 = near ? 0.12 : -0.05; a2 = near ? 1.35 : 1.2; }
    if (st.scared) { a1 = 1.25; a2 = 1.9; }
    if ((sit > 0.2 || floor > 0.2) && !st.wave && !st.think && !st.point && !st.cry && !(st.talkG > 0.2)) { a1 = near ? 0.55 : 0.45; a2 = 0.95; }
    return [a1, a2];
  };
  const shoulder = (near) => [(near ? B.tw * 0.45 : -B.tw * 0.62) + hunch, B.sh + 12 + hunch * 0.4];
  const armPts = (near) => { const [a1, a2] = armA(near), S = shoulder(near); const E = [S[0] + Math.sin(a1) * B.A1, S[1] + Math.cos(a1) * B.A1]; const Hd = [E[0] + Math.sin(a1 + a2) * B.A2, E[1] + Math.cos(a1 + a2) * B.A2]; return [S, E, Hd, a1 + a2]; };
  const sleeveLen = { vest: 0, blouse: 0.35, tshirt: 0.45, shirt: 0.5, frock: 0.3, kurta: 1, kameez: 1, suit: 1 }[O.top] ?? 1;
  const topCol = O.top === 'vest' ? '#f4f1ea' : top;
  const drawArm = (near) => {
    const [S, E, Hd, ang] = armPts(near), dim = near ? 1 : 0.88;
    hdLimb(x, [S, E, Hd], [B.aw * 1.05, B.aw * 0.9, B.aw * 0.75], hdCol(skin, dim));
    if (sleeveLen > 0) { const m = sleeveLen >= 1 ? [Hd[0] * 0.85 + E[0] * 0.15, Hd[1] * 0.85 + E[1] * 0.15] : [S[0] * (1 - sleeveLen * 1.6) + E[0] * sleeveLen * 1.6, S[1] * (1 - sleeveLen * 1.6) + E[1] * sleeveLen * 1.6]; hdLimb(x, sleeveLen >= 1 ? [S, E, m] : [S, m], sleeveLen >= 1 ? [B.aw * 1.45, B.aw * 1.3, B.aw * 1.2] : [B.aw * 1.5, B.aw * 1.4], hdCol(topCol, dim)); }
    if (fem && sp.age !== 'toddler') { x.strokeStyle = near ? '#e2b33c' : '#2e7d32'; x.lineWidth = 2.2; for (let j = 0; j < 2; j++) { const p = 0.72 + j * 0.06, bx = E[0] * (1 - p) + Hd[0] * p, by = E[1] * (1 - p) + Hd[1] * p; x.beginPath(); x.ellipse(bx, by, B.aw * 0.5, 2, ang, 0, 7); x.stroke(); } }
    hdHand(x, Hd, ang, B.aw, hdCol(skin, dim), st.wave > 0.5 && near);
    if (near && st.prop === 'glass') { x.save(); x.translate(Hd[0] + 3, Hd[1] - 6); hdPath(x, [[-5, -10], [5, -10], [4, 6], [-4, 6]]); hdFillStroke(x, 'rgba(200,220,230,0.85)', 1.4); x.fillStyle = '#b8742e'; x.fillRect(-4.3, -3, 8.6, 9); x.restore(); }
    if (near && (st.prop === 'stick' || (sp.extras || []).includes('stick')) && !st.wave && !st.dance) { hdLimb(x, [[Hd[0] + 2, Hd[1] - 14], [Hd[0] + 12, -hipDrop + lift + bob - 2]], [4.5, 4.5], '#7a5230', 1.2); }
  };
  drawArm(false);
  // ---- dhad ----
  x.save(); x.translate(hunch * 0.5, 0);
  const tb = { kurta: B.hip + (B.h * 0.22), kameez: B.hip + B.h * 0.27, shirt: B.waist + 10, tshirt: B.waist + 12, vest: B.waist + 8, blouse: B.sh + (B.waist - B.sh) * 0.55, frock: B.waist + 4, suit: B.hip + 6 }[O.top] ?? B.waist;
  const sitBot = sit > 0.2 || floor > 0.2 ? Math.min(tb, B.hip + 8) : tb;
  const fl = O.top === 'kurta' || O.top === 'kameez' ? 1.12 : O.top === 'frock' ? 1.0 : 1.0;
  const torso = () => { x.beginPath(); x.moveTo(-B.tw, B.sh + 16); x.quadraticCurveTo(-B.tw, B.sh, -B.tw + 13, B.sh); x.lineTo(B.tw - 13, B.sh); x.quadraticCurveTo(B.tw, B.sh, B.tw, B.sh + 16); x.lineTo(B.tw * (fem ? 0.86 : 0.95), B.waist); x.lineTo(B.tw * fl, sitBot); x.lineTo(-B.tw * fl, sitBot); x.lineTo(-B.tw * (fem ? 0.86 : 0.95), B.waist); x.closePath(); };
  if (O.top === 'frock') { // frock: jhaalar wala ghera
    const fy = Math.min(B.hip + B.L1 * 0.65, -hipDrop - 10), swg = walking ? Math.sin(ph) * 4 : 0;
    hdPath(x, [[-B.tw * 0.9, B.waist], [B.tw * 0.9, B.waist], [B.tw * 1.7 + swg, fy], [-B.tw * 1.6 + swg, fy]]); x.fillStyle = hdGradX(x, -B.tw * 1.6, B.tw * 1.7, top); x.fill(); x.strokeStyle = HD_INK; x.lineWidth = 1.8; x.stroke();
    x.strokeStyle = '#fff8'; x.lineWidth = 3; x.beginPath(); x.moveTo(-B.tw * 1.55 + swg, fy - 4); x.lineTo(B.tw * 1.65 + swg, fy - 4); x.stroke();
  }
  if (O.top === 'blouse') { x.fillStyle = hdCol(skin, 0.95); hdPath(x, [[-B.tw * 0.86, B.waist - 22], [B.tw * 0.86, B.waist - 22], [B.tw * 0.9, B.waist + 2], [-B.tw * 0.9, B.waist + 2]]); x.fill(); x.strokeStyle = HD_INK; x.lineWidth = 1.6; x.stroke(); }
  torso(); x.fillStyle = hdGradX(x, -B.tw, B.tw, O.top === 'blouse' ? low : topCol, 0.76, 1.08); x.fill();
  x.save(); torso(); x.clip();
  if (pat === 'dots' || pat === 'checks' && O.low !== 'lungi') hdPattern(x, pat, topCol, [-B.tw * 1.3, B.sh, B.tw * 1.3, sitBot]);
  if (O.top === 'vest') { x.fillStyle = hdCol(skin, 0.95); x.beginPath(); x.ellipse(B.tw * 0.1, B.sh - 2, B.tw * 0.42, 22, 0, 0, Math.PI); x.fill(); }
  x.restore();
  torso(); x.strokeStyle = HD_INK; x.lineWidth = 1.8; x.lineJoin = 'round'; x.stroke();
  x.strokeStyle = hdCol(topCol, 0.55); x.lineWidth = 1.4;
  if (O.top === 'kurta' || O.top === 'kameez') { x.beginPath(); x.moveTo(B.tw * 0.22, B.sh + 2); x.lineTo(B.tw * 0.22, B.sh + 40); x.stroke(); for (let j = 0; j < 3; j++) tcEll(x, B.tw * 0.22, B.sh + 10 + j * 10, 2, 2, hdCol(topCol, 1.4), 0.8); if (sitBot === tb) { x.strokeStyle = HD_INK; x.beginPath(); x.moveTo(B.tw * fl - 1, tb); x.lineTo(B.tw * 0.98, tb - 28); x.stroke(); } x.strokeStyle = hdCol(topCol, 0.6); x.beginPath(); x.moveTo(-B.tw * 0.3, B.waist); x.quadraticCurveTo(-B.tw * 0.1, B.waist + 20, -B.tw * 0.4, sitBot); x.stroke(); }
  if (O.top === 'shirt' || O.top === 'tshirt') { tcPoly(x, [[B.tw * 0.25 - 11, B.sh - 1], [B.tw * 0.25, B.sh + 12], [B.tw * 0.25 + 11, B.sh - 1]], O.top === 'shirt' ? hdCol(topCol, 0.85) : hdCol(skin, 0.95), 1.3); if (O.top === 'shirt') { x.beginPath(); x.moveTo(B.tw * 0.25, B.sh + 12); x.lineTo(B.tw * 0.25, sitBot); x.stroke(); } }
  if (O.top === 'suit') { tcPoly(x, [[B.tw * 0.2 - 9, B.sh], [B.tw * 0.2, B.sh + 34], [B.tw * 0.2 + 9, B.sh]], '#fafafa', 1.2); tcPoly(x, [[B.tw * 0.2 - 3, B.sh + 6], [B.tw * 0.2 + 3, B.sh + 6], [B.tw * 0.2 + 4, B.sh + 30], [B.tw * 0.2, B.sh + 35], [B.tw * 0.2 - 4, B.sh + 30]], '#b71c1c', 1); }
  // saree ka pallu: kamar se kandhe par, peeche latakta
  if (O.low === 'saree') {
    const border = sp.border || hdCol(top, 0.55);
    hdPath(x, [[-B.tw * 0.9, B.sh + 2], [-B.tw * 0.35, B.sh - 1], [B.tw * 0.95, B.waist + 22], [B.tw * 0.45, B.waist + 30]]); x.fillStyle = hdGradX(x, -B.tw, B.tw, top, 0.8, 1.1); x.fill(); x.strokeStyle = HD_INK; x.lineWidth = 1.6; x.stroke();
    x.strokeStyle = border; x.lineWidth = 4.5; x.beginPath(); x.moveTo(-B.tw * 0.35, B.sh + 1); x.lineTo(B.tw * 0.92, B.waist + 22); x.stroke();
    hdPath(x, [[-B.tw * 0.95, B.sh + 4], [-B.tw * 0.6, B.sh + 2], [-B.tw * 1.1, B.waist + 30], [-B.tw * 1.45, B.waist + 24]]); x.fillStyle = hdCol(top, 0.8); x.fill(); x.strokeStyle = HD_INK; x.lineWidth = 1.5; x.stroke();
  }
  if (O.dupatta) { x.strokeStyle = sp.border || hdCol(top, 1.35); x.lineWidth = 8; x.lineCap = 'round'; x.beginPath(); x.moveTo(-B.tw * 0.85, B.sh + 3); x.quadraticCurveTo(B.tw * 0.1, B.sh + 34, B.tw * 0.85, B.sh + 3); x.stroke(); x.lineWidth = 1.2; x.strokeStyle = HD_INK; x.stroke(); }
  if (O.gamchha || (sp.extras || []).includes('scarf')) { const gc = '#d84343'; hdLimb(x, [[-B.tw * 0.7, B.sh + 2], [B.tw * 0.3, B.sh + 6], [B.tw * 0.55, B.sh + 46]], [9, 9, 9], gc, 1.3); x.save(); x.strokeStyle = '#fff9'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(B.tw * 0.35, B.sh + 12); x.lineTo(B.tw * 0.5, B.sh + 40); x.stroke(); x.restore(); }
  x.restore();
  // ---- gardan + sar ----
  const hr = B.hr, nod = st.talkA ? Math.sin(t * 6) * 1.6 * st.talkA : 0;
  const tilt = (st.sleep ? 0.3 : 0) + (st.laugh ? Math.sin(t * 15) * 0.05 : 0) + (st.cry ? 0.1 : 0) + (st.think ? -0.06 : 0) + (st.look ? 0 : 0);
  const hx = 3 + hunch, hy = B.sh - hr * 1.05 + nod * 0.4;
  hdLimb(x, [[hunch * 0.6, B.sh + 6], [hx - 1, hy + hr * 0.65]], [hr * 0.5, hr * 0.48], hdCol(skin, 0.86));
  x.save(); x.translate(hx, hy); x.rotate(tilt);
  hdHead(x, sp, st, hr, fem);
  x.restore();
  drawArm(true);
  x.restore();
  if (st.sleep) { x.save(); x.fillStyle = HD_INK; x.font = `bold ${hr * k * 0.7}px sans-serif`; const z = (t * 0.8) % 1; x.globalAlpha = 1 - z; x.fillText('Z', st.x + (st.f || 1) * hr * k * 1.2, st.y + (hy - hr - z * 30) * k); x.restore(); }
}
function hdHand(x, P, ang, aw, col, open) {
  x.save(); x.translate(P[0], P[1]); x.rotate(-ang);
  tcEll(x, 0, aw * 0.45, aw * 0.6, aw * 0.75, col, 1.5); // hatheli
  if (open) for (let j = -1.5; j <= 1.5; j++) { tcEll(x, j * aw * 0.28, aw * 1.15, aw * 0.13, aw * 0.4, col, 1.1); }
  else { x.strokeStyle = hdCol(col, 0.6); x.lineWidth = 1; for (let j = 0; j < 3; j++) { x.beginPath(); x.moveTo(-aw * 0.3 + j * aw * 0.25, aw * 0.75); x.lineTo(-aw * 0.28 + j * aw * 0.25, aw * 1.0); x.stroke(); } }
  tcEll(x, aw * 0.5, aw * 0.4, aw * 0.18, aw * 0.36, col, 1.2, -0.5); // angootha
  x.restore();
}
function hdHead(x, sp, st, hr, fem) {
  const skin = sp.skin, hc = sp.hairColor, h = sp.hair, open = st.blink, emo = st.emo || 'happy', kid = sp.age === 'child' || sp.age === 'toddler', old = sp.age === 'old';
  const crx = hr * 0.88, cry = hr;
  // peeche ke baal (lambe / choti / jooda)
  if (fem && h !== 'short' && h !== 'bald') {
    if (h === 'bun') { tcEll(x, -hr * 0.75, -hr * 0.05, hr * 0.42, hr * 0.4, hc, 1.6); }
    else if (h === 'braid') { for (let j = 0; j < 6; j++) tcEll(x, -hr * 0.55 - j * 1.2, hr * 0.5 + j * hr * 0.32, hr * 0.2, hr * 0.2, hdCol(hc, j % 2 ? 1 : 0.85), 1.3); }
    else if (h === 'pigtails' || h === 'ponytail') { tcEll(x, -hr * 0.92, hr * 0.15, hr * 0.26, hr * 0.5, hc, 1.6, 0.3); }
    else { x.beginPath(); x.moveTo(-crx * 1.02, -hr * 0.2); x.quadraticCurveTo(-crx * 1.25, hr * 1.4, -crx * 0.2, hr * 1.55); x.lineTo(crx * 0.2, hr * 0.5); x.closePath(); x.fillStyle = hdGradX(x, -crx, crx, hc, 0.7, 1.2); x.fill(); x.strokeStyle = HD_INK; x.lineWidth = 1.6; x.stroke(); }
  }
  // kaan
  tcEll(x, -crx * 0.62, hr * 0.08, hr * 0.15, hr * 0.24, hdCol(skin, 0.92), 1.5);
  x.strokeStyle = hdCol(skin, 0.6); x.lineWidth = 1; x.beginPath(); x.arc(-crx * 0.62, hr * 0.08, hr * 0.08, -1, 1.5); x.stroke();
  if (fem && (sp.extras || []).includes('earrings') !== false && sp.age !== 'toddler') { tcEll(x, -crx * 0.62, hr * 0.38, hr * 0.06, hr * 0.08, '#e2b33c', 1); }
  // chehra (khopdi + jabda ek saath)
  const face = () => { x.beginPath(); x.ellipse(0, 0, crx, cry, 0, Math.PI * 0.95, Math.PI * 2.08); x.quadraticCurveTo(crx * 0.95, hr * 0.62, crx * 0.42, hr * 0.98); x.quadraticCurveTo(crx * 0.15, hr * 1.12, -crx * 0.25, hr * 0.92); x.quadraticCurveTo(-crx * 0.85, hr * 0.55, -crx * 0.94, hr * 0.15); x.closePath(); };
  face(); const fg = x.createLinearGradient(-crx, 0, crx, 0); fg.addColorStop(0, hdCol(skin, 0.84)); fg.addColorStop(0.5, skin); fg.addColorStop(1, hdCol(skin, 1.06)); x.fillStyle = fg; x.fill(); x.strokeStyle = HD_INK; x.lineWidth = 1.8; x.stroke();
  if ((sp.extras || []).includes('beard')) { x.save(); face(); x.clip(); x.fillStyle = hc; x.beginPath(); x.moveTo(-crx, hr * 0.25); x.quadraticCurveTo(0, hr * 0.55, crx, hr * 0.3); x.lineTo(crx, hr * 1.3); x.lineTo(-crx, hr * 1.3); x.fill(); x.restore(); }
  // aage ke baal
  if (h !== 'bald' && h !== 'turban' && h !== 'hijab') {
    const hairPath = () => { const a1 = Math.atan2(-0.44 / 1.04, 0.8 / 0.95); x.beginPath(); x.moveTo(crx * 0.8, -hr * 0.42); x.ellipse(0, -hr * 0.05, crx * 1.06, hr * 1.04, 0, a1, Math.PI * 0.92, true); x.lineTo(-crx * 0.5, hr * 0.32); x.quadraticCurveTo(-crx * 0.45, -hr * 0.05, -crx * 0.25, -hr * 0.35); if (fem) { x.quadraticCurveTo(crx * 0.05, -hr * 0.58, crx * 0.12, -hr * 0.55); x.quadraticCurveTo(crx * 0.45, -hr * 0.62, crx * 0.8, -hr * 0.42); } else { x.quadraticCurveTo(crx * 0.25, -hr * 0.62, crx * 0.45, -hr * 0.5); x.quadraticCurveTo(crx * 0.6, -hr * 0.62, crx * 0.8, -hr * 0.42); } x.closePath(); };
    hairPath(); x.fillStyle = hdGradX(x, -crx, crx, hc, 0.75, 1.25); x.fill(); x.strokeStyle = HD_INK; x.lineWidth = 1.7; x.stroke();
    x.save(); hairPath(); x.clip(); x.strokeStyle = hdCol(hc, 1.9); x.globalAlpha = 0.35; x.lineWidth = 2.2; x.beginPath(); x.arc(-crx * 0.05, hr * 0.15, hr * 0.95, -2.3, -1.6); x.stroke(); x.restore();
    if (fem) { x.strokeStyle = hdCol(hc, 0.5); x.lineWidth = 1.2; x.beginPath(); x.moveTo(crx * 0.12, -hr * 0.55); x.quadraticCurveTo(crx * 0.05, -hr * 0.85, -crx * 0.1, -hr * 1.0); x.stroke(); }
    if (!fem && h === 'spiky') tcPoly(x, [[-crx * 0.1, -hr * 0.98], [crx * 0.2, -hr * 1.25], [crx * 0.35, -hr * 0.92]], hc, 1.4);
  }
  if (h === 'bald' && old) { x.fillStyle = hc; tcEll(x, -crx * 0.55, -hr * 0.05, hr * 0.18, hr * 0.32, hc, 1.2); }
  // aankhein
  const eye = (cx, w, front) => {
    const ey = -hr * 0.04, eh = hr * (kid ? 0.15 : 0.12);
    if (st.sleep || st.laugh || open < 0.15) { x.strokeStyle = HD_INK; x.lineWidth = 2; x.beginPath(); x.moveTo(cx - w, ey); x.quadraticCurveTo(cx, ey + (st.laugh ? -eh : eh * 0.6), cx + w, ey); x.stroke(); return; }
    const shape = () => { x.beginPath(); x.moveTo(cx - w, ey + 1); x.quadraticCurveTo(cx, ey - eh * 1.4 * open, cx + w, ey); x.quadraticCurveTo(cx, ey + eh * 0.95 * open, cx - w, ey + 1); x.closePath(); };
    shape(); x.fillStyle = '#fffaf2'; x.fill();
    x.save(); shape(); x.clip(); const ir = hr * (kid ? 0.11 : 0.09), ix = cx + w * 0.18 + (st.look || 0) * w * 0.25; tcEll(x, ix, ey - 1, ir, ir, '#5a3a22'); tcEll(x, ix, ey - 1, ir * 0.55, ir * 0.55, '#120c0a'); tcEll(x, ix + ir * 0.35, ey - ir * 0.45, ir * 0.3, ir * 0.3, '#fff'); x.restore();
    x.strokeStyle = HD_INK; x.lineWidth = 2.2; x.beginPath(); x.moveTo(cx - w - 1, ey + 1); x.quadraticCurveTo(cx, ey - eh * 1.45 * open, cx + w + 1, ey - 1); x.stroke();
    if (fem && !kid) { x.lineWidth = 1.5; x.beginPath(); x.moveTo(cx + w, ey - 1); x.lineTo(cx + w + 4, ey - 4); x.stroke(); }
  };
  eye(crx * 0.5, hr * 0.18, true); eye(-crx * 0.08, hr * 0.14, false);
  // bhauhein
  const brow = (cx, w, inner) => { let a = 0; if (emo === 'angry') a = 0.3; if (emo === 'sad' || st.cry || emo === 'scared') a = -0.3; const lift = emo === 'surprised' || st.scared ? -4 : 0; x.save(); x.translate(cx, -hr * 0.3 + lift); x.rotate(a * inner); x.fillStyle = old ? '#9a9a9a' : hdCol(hc === '#c9c9c9' ? '#5d4037' : hc, 0.9); x.beginPath(); x.moveTo(-w, 2); x.quadraticCurveTo(0, -4, w, 1); x.quadraticCurveTo(0, -1, -w, 3.5); x.fill(); x.restore(); };
  brow(crx * 0.5, hr * 0.2, 1); brow(-crx * 0.08, hr * 0.15, -1);
  // naak
  x.strokeStyle = hdCol(skin, 0.55); x.lineWidth = 1.8; x.beginPath(); x.moveTo(crx * 0.28, -hr * 0.02); x.quadraticCurveTo(crx * 0.45, hr * 0.22, crx * 0.52, hr * 0.27); x.quadraticCurveTo(crx * 0.4, hr * 0.34, crx * 0.26, hr * 0.3); x.stroke();
  if (old) { x.strokeStyle = hdCol(skin, 0.65); x.lineWidth = 1; x.beginPath(); x.moveTo(crx * 0.15, hr * 0.42); x.quadraticCurveTo(crx * 0.05, hr * 0.55, crx * 0.12, hr * 0.68); x.stroke(); x.beginPath(); x.moveTo(crx * 0.75, -hr * 0.12); x.lineTo(crx * 0.85, -hr * 0.05); x.stroke(); }
  if (fem || kid) { x.globalAlpha = 0.25; tcEll(x, crx * 0.6, hr * 0.3, hr * 0.13, hr * 0.07, '#ff5a5a'); x.globalAlpha = 1; }
  if (fem && (sp.extras || []).includes('bindi') !== false && sp.region === 'indian' && !kid) tcEll(x, crx * 0.22, -hr * 0.36, 2.2, 2.2, '#c62828');
  // muh
  const mx = crx * 0.36, my = hr * 0.55, talk = st.mouth || 0;
  if (talk > 0.06) { x.beginPath(); x.moveTo(mx - hr * 0.16, my - 1); x.quadraticCurveTo(mx, my - 3, mx + hr * 0.15, my - 1); x.quadraticCurveTo(mx, my + hr * (0.08 + 0.2 * talk), mx - hr * 0.16, my - 1); x.closePath(); x.fillStyle = '#5a1620'; x.fill(); x.strokeStyle = HD_INK; x.lineWidth = 1.4; x.stroke(); x.fillStyle = '#fff'; x.fillRect(mx - hr * 0.1, my - 2, hr * 0.2, 2.2); if (talk > 0.4) tcEll(x, mx, my + hr * 0.1 * talk, hr * 0.07, hr * 0.04, '#d9666e'); }
  else if (emo === 'sad' || st.cry) { x.strokeStyle = HD_INK; x.lineWidth = 1.8; x.beginPath(); x.moveTo(mx - hr * 0.13, my + 3); x.quadraticCurveTo(mx, my - 3, mx + hr * 0.13, my + 3); x.stroke(); }
  else if (emo === 'surprised' || st.scared) tcEll(x, mx, my + 1, hr * 0.06, hr * 0.08, '#5a1620', 1.4);
  else if (emo === 'angry' || emo === 'neutral') { x.strokeStyle = HD_INK; x.lineWidth = 1.8; x.beginPath(); x.moveTo(mx - hr * 0.13, my + 1); x.lineTo(mx + hr * 0.12, my); x.stroke(); }
  else { x.strokeStyle = HD_INK; x.lineWidth = 1.8; x.beginPath(); x.moveTo(mx - hr * 0.15, my - 1); x.quadraticCurveTo(mx, my + hr * 0.12, mx + hr * 0.14, my - 2); x.stroke(); }
  if (fem && !kid && talk <= 0.06) { tcEll(x, mx, my + 1.5, hr * 0.1, hr * 0.04, '#c2414b'); }
  if ((sp.extras || []).includes('moustache') || (!fem && !kid && sp.age !== 'teen' && sp.region === 'indian' && sp.moustache !== false && tcHash(sp.name || '') % 3 !== 0)) {
    x.fillStyle = old ? '#d8d8d8' : hc; x.strokeStyle = HD_INK; x.lineWidth = 1;
    x.beginPath(); x.moveTo(mx, my - hr * 0.1); x.quadraticCurveTo(mx + hr * 0.16, my - hr * 0.22, mx + hr * 0.3, my - hr * 0.06); x.quadraticCurveTo(mx + hr * 0.2, my - hr * 0.08, mx, my - hr * 0.02); x.quadraticCurveTo(mx - hr * 0.2, my - hr * 0.08, mx - hr * 0.3, my - hr * 0.08); x.quadraticCurveTo(mx - hr * 0.16, my - hr * 0.22, mx, my - hr * 0.1); x.fill(); x.stroke();
  }
  if (st.cry) { x.fillStyle = '#6ec1ff'; const ty = hr * 0.1 + ((st.t * 1.3) % 1) * hr * 0.6; x.beginPath(); x.ellipse(crx * 0.5, ty, 2.2, 3.5, 0, 0, 7); x.fill(); }
  if ((sp.extras || []).includes('glasses')) { x.strokeStyle = '#3b2a20'; x.lineWidth = 1.8; tcEll(x, crx * 0.5, -hr * 0.04, hr * 0.24, hr * 0.18, null, 1.8); tcEll(x, -crx * 0.08, -hr * 0.04, hr * 0.18, hr * 0.17, null, 1.8); x.beginPath(); x.moveTo(crx * 0.25, -hr * 0.06); x.lineTo(crx * 0.11, -hr * 0.06); x.stroke(); }
  // pagdi / topi / hijab
  if (h === 'turban') { const tc = sp.turbanColor || (sp.age === 'old' ? '#f4f1ea' : '#e65100'); x.beginPath(); x.ellipse(-crx * 0.05, -hr * 0.55, crx * 1.1, hr * 0.62, -0.08, Math.PI * 0.92, Math.PI * 2.08); x.closePath(); x.fillStyle = hdGradX(x, -crx, crx, tc, 0.8, 1.05); x.fill(); x.strokeStyle = HD_INK; x.lineWidth = 1.7; x.stroke(); x.strokeStyle = hdCol(tc, 0.72); x.lineWidth = 1.4; for (let j = 0; j < 3; j++) { x.beginPath(); x.moveTo(-crx * 1.0, -hr * (0.45 + j * 0.16)); x.quadraticCurveTo(0, -hr * (0.2 + j * 0.2), crx * 1.0, -hr * (0.6 + j * 0.13)); x.stroke(); } }
  if (h === 'cap') { tcEll(x, 0, -hr * 0.62, crx * 1.0, hr * 0.45, sp.top, 1.6); tcEll(x, crx * 0.85, -hr * 0.42, crx * 0.5, hr * 0.1, hdCol(sp.top, 0.7), 1.4); }
  if (h === 'hijab') { x.save(); x.beginPath(); x.ellipse(0, hr * 0.12, crx * 1.25, hr * 1.25, 0, 0, 7); x.ellipse(crx * 0.15, hr * 0.12, crx * 0.82, hr * 0.92, 0, 0, 7); x.fillStyle = hdCol(sp.top, 0.8); x.fill('evenodd'); x.restore(); }
  if ((sp.extras || []).includes('headband')) { x.fillStyle = '#29b6f6'; x.save(); x.beginPath(); x.ellipse(0, -hr * 0.05, crx * 1.07, hr * 1.05, 0, 0, 7); x.clip(); x.fillRect(-crx * 1.2, -hr * 0.62, crx * 2.4, hr * 0.14); x.restore(); }
}
// charpai (khaat): baithne ki jagah
function hdCharpai(x, groundOff, seatH, B, sit) {
  x.save(); x.translate(0, groundOff); x.globalAlpha = Math.min(1, sit * 1.6);
  const w0 = -B.tw * 3.2, w1 = B.tw * 1.6, top = -seatH + 4, d = 16;
  for (const lx of [w0 + 6, w1 - 6]) { hdLimb(x, [[lx, top], [lx, -2]], [9, 7], '#3e2a22', 1.2); for (let j = 0; j < 3; j++) tcEll(x, lx, top + 14 + j * 16, 5.5, 2.4, '#2a1c16'); }
  hdPath(x, [[w0, top], [w1, top], [w1 + d, top - d * 0.6], [w0 + d, top - d * 0.6]]); x.fillStyle = '#c9a878'; x.fill();
  x.save(); x.clip(); x.strokeStyle = '#8d6a44'; x.lineWidth = 1.6; for (let X = w0 - 40; X < w1 + 40; X += 7) { x.beginPath(); x.moveTo(X, top); x.lineTo(X + 18, top - d); x.stroke(); x.beginPath(); x.moveTo(X + 18, top); x.lineTo(X, top - d); x.stroke(); } x.restore();
  x.strokeStyle = '#3e2a22'; x.lineWidth = 5; x.beginPath(); x.moveTo(w0, top); x.lineTo(w1, top); x.stroke(); x.lineWidth = 3; x.beginPath(); x.moveTo(w0 + d, top - d * 0.6); x.lineTo(w1 + d, top - d * 0.6); x.stroke();
  x.restore();
}
// jaanwar (HD): bhains / gaay / bail / bakri / kutta
const HD_ANIMAL = { buffalo: { c: '#4b4b52', horns: 'curve', s: 1.25 }, cow: { c: '#f2eee6', horns: 'small', s: 1.15, spots: '#6d4c41' }, bull: { c: '#d9d2c5', horns: 'up', s: 1.25 }, ox: { c: '#d9d2c5', horns: 'up', s: 1.25 },
  goat: { c: '#f5f1ea', horns: 'back', s: 0.7 }, dog: { c: '#b98b58', horns: '', s: 0.6 }, horse: { c: '#8d5a3b', horns: '', s: 1.3 } };
function hdDrawAnimal(x, sp, st, k) {
  const A = HD_ANIMAL[sp.animal]; if (!A) return tcDrawAnimal(x, sp, st, k);
  const c = sp.animalColor || A.c, t = st.t, walking = st.walk > 0, ph = st.ph || 0;
  x.save(); x.translate(st.x, st.y); x.scale(k * A.s * (st.f || 1), k * A.s);
  x.save(); x.globalAlpha = 0.25; tcEll(x, 0, 2, 78, 10, '#000'); x.restore();
  const bob = walking ? Math.abs(Math.sin(ph)) * 3 : Math.sin(t * 1.5 + st.seed) * 0.8; x.translate(0, -bob);
  const legs = [[-46, Math.PI], [40, 0], [-30, 0], [56, Math.PI]];
  legs.forEach(([lx, s2], i) => { const sw = walking ? Math.sin(ph + s2) * 14 : 0, back = i < 2; const kn = [lx + sw * 0.4 + (lx < 0 ? -4 : 4), -42], ft = [lx + sw, -4]; hdLimb(x, [[lx, -84], kn, ft], [24, 13, 11], hdCol(c, back ? 0.72 : 0.92)); tcEll(x, ft[0] + 2, ft[1], 7.5, 4.5, '#1d1717', 1.2); });
  const body = () => { x.beginPath(); x.moveTo(-74, -96); x.bezierCurveTo(-82, -128, -40, -136, 0, -128); x.bezierCurveTo(30, -134, 66, -136, 78, -112); x.bezierCurveTo(88, -92, 78, -70, 58, -66); x.bezierCurveTo(30, -58, -10, -58, -46, -64); x.bezierCurveTo(-70, -66, -80, -78, -74, -96); x.closePath(); };
  body(); x.fillStyle = hdGradY(x, -136, -58, hdCol(c, 1.12), hdCol(c, 0.72)); x.fill(); x.strokeStyle = HD_INK; x.lineWidth = 1.8; x.stroke();
  x.save(); body(); x.clip(); x.fillStyle = '#ffffff18'; x.beginPath(); x.ellipse(-10, -122, 60, 8, 0, 0, 7); x.fill(); if (A.spots) for (const [sx, sy, r] of [[-30, -102, 17], [22, -112, 13], [44, -84, 11]]) tcEll(x, sx, sy, r, r * 0.8, A.spots); x.restore();
  x.strokeStyle = hdCol(c, 0.6); x.lineWidth = 1.4; x.beginPath(); x.moveTo(-40, -108); x.quadraticCurveTo(-30, -84, -44, -70); x.stroke(); x.beginPath(); x.moveTo(40, -110); x.quadraticCurveTo(48, -92, 40, -74); x.stroke();
  const tw = Math.sin(t * 3 + st.seed) * 6; hdLimb(x, [[-74, -108], [-86, -84 + tw * 0.3], [-84 + tw, -60]], [5, 4, 3], hdCol(c, 0.85), 1.2); tcEll(x, -84 + tw, -56, 5, 8, hdCol(c, 0.45), 1);
  const nod = st.walk ? Math.sin(ph * 2) * 2 : Math.sin(t * 0.9 + st.seed) * 2;
  x.save(); x.translate(76, -108 + nod);
  hdLimb(x, [[-16, 2], [8, 14]], [46, 36], hdCol(c, 0.95));
  if (A.horns === 'curve') { for (const [dx, sc2] of [[-3, 0.85], [3, 1]]) { x.strokeStyle = HD_INK; x.lineWidth = 9 * sc2; x.lineCap = 'round'; x.beginPath(); x.moveTo(6 + dx, -8); x.bezierCurveTo(-8 + dx, -30, -38 + dx, -26, -30 + dx, -2); x.stroke(); x.strokeStyle = sc2 < 1 ? '#b8ae98' : '#ddd4bd'; x.lineWidth = 6 * sc2; x.stroke(); } }
  if (A.horns === 'up' || A.horns === 'small') { x.strokeStyle = HD_INK; x.lineWidth = A.horns === 'up' ? 8 : 6; x.lineCap = 'round'; x.beginPath(); x.moveTo(6, -6); x.quadraticCurveTo(0, -24, 12, A.horns === 'up' ? -34 : -20); x.stroke(); x.strokeStyle = '#e8dfc8'; x.lineWidth -= 3; x.stroke(); }
  if (A.horns === 'back') { x.strokeStyle = '#9e9e9e'; x.lineWidth = 4; x.beginPath(); x.moveTo(4, -6); x.quadraticCurveTo(-10, -24, -20, -12); x.stroke(); }
  tcEll(x, -8, 2, 14, 7, hdCol(c, 0.78), 1.5, -0.5); // kaan
  const head = () => { x.beginPath(); x.moveTo(-6, -14); x.bezierCurveTo(14, -20, 30, -10, 38, 10); x.bezierCurveTo(46, 24, 44, 36, 30, 38); x.bezierCurveTo(18, 40, 8, 34, 2, 22); x.bezierCurveTo(-6, 10, -12, -4, -6, -14); x.closePath(); };
  head(); x.fillStyle = hdGradX(x, -8, 44, c, 0.8, 1.12); x.fill(); x.strokeStyle = HD_INK; x.lineWidth = 1.8; x.stroke();
  tcEll(x, 34, 28, 12, 9, hdCol(c, 0.5), 1.4); tcEll(x, 39, 27, 2.4, 1.8, '#0c0808'); tcEll(x, 31, 31, 2, 1.5, '#0c0808');
  const op = st.blink; tcEll(x, 18, 2, 5, 4 * Math.max(0.15, op), '#fff', 1.3); if (op > 0.3) tcEll(x, 19, 2, 2.6, 2.6, '#160f0c');
  if ((st.mouth || 0) > 0.06) tcEll(x, 30, 32, 6, 2 + st.mouth * 4, '#5a1620', 1);
  x.restore();
  x.restore();
}

// ---------- HD backgrounds: parat-dar-parat ----------
function hdLeafBlob(x, cx, cy, r, col, rnd) { const n = 16; x.beginPath(); for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2, rr = r * (i % 2 ? 0.72 + rnd() * 0.12 : 0.95 + rnd() * 0.12); const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr * 0.86; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); x.fillStyle = col; x.fill(); }
function hdTree(x, X, Y, s, rnd, dark = false) {
  const tr = dark ? '#5d4030' : '#8a5a34';
  x.beginPath(); x.moveTo(X - 30 * s, Y); x.quadraticCurveTo(X - 12 * s, Y - 60 * s, X - 14 * s, Y - 150 * s); x.quadraticCurveTo(X - 60 * s, Y - 190 * s, X - 95 * s, Y - 205 * s); x.lineTo(X - 88 * s, Y - 214 * s); x.quadraticCurveTo(X - 40 * s, Y - 200 * s, X - 4 * s, Y - 176 * s); x.lineTo(X + 2 * s, Y - 230 * s); x.lineTo(X + 14 * s, Y - 230 * s); x.lineTo(X + 14 * s, Y - 180 * s); x.quadraticCurveTo(X + 50 * s, Y - 200 * s, X + 92 * s, Y - 214 * s); x.lineTo(X + 96 * s, Y - 204 * s); x.quadraticCurveTo(X + 50 * s, Y - 180 * s, X + 22 * s, Y - 140 * s); x.quadraticCurveTo(X + 16 * s, Y - 60 * s, X + 34 * s, Y); x.closePath();
  x.fillStyle = hdGradX(x, X - 30 * s, X + 34 * s, tr, 0.7, 1.15); x.fill(); x.strokeStyle = '#3e2618'; x.lineWidth = 1.6 * s; x.stroke();
  x.strokeStyle = '#00000030'; x.lineWidth = 1.2 * s; for (let j = 0; j < 6; j++) { x.beginPath(); x.moveTo(X - 10 * s + j * 4 * s, Y - 10 * s); x.quadraticCurveTo(X - 4 * s + j * 3 * s, Y - 80 * s, X - 6 * s + j * 3 * s, Y - 140 * s); x.stroke(); }
  const greens = dark ? ['#1f4a2c', '#2b5e36', '#3a7343'] : ['#2f7d32', '#4caf50', '#7cc642', '#a5d65a'];
  for (let layer = 0; layer < greens.length; layer++) for (let i = 0; i < 26; i++) { const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()); const cx = X + Math.cos(a) * rr * 150 * s - layer * 6 * s, cy = Y - 285 * s + Math.sin(a) * rr * 95 * s - layer * 8 * s; hdLeafBlob(x, cx, cy, (34 - layer * 5) * s * (0.8 + rnd() * 0.5), greens[layer], rnd); }
}
function hdGrassStrip(x, y0, y1, W, s, rnd, cols = ['#1b7a2c', '#2e9e3a', '#55c24a']) {
  const g = hdGradY(x, y0, y1, cols[1], cols[0]); x.fillStyle = g; x.fillRect(0, y0 + (y1 - y0) * 0.45, W, (y1 - y0) * 0.55);
  for (let pass = 0; pass < 3; pass++) for (let X = -10; X < W + 10; X += 5 * s) { const h = (y1 - y0) * (0.5 + rnd() * 0.7), bx = X + rnd() * 4 * s; x.beginPath(); x.moveTo(bx - 3 * s, y1); x.quadraticCurveTo(bx, y1 - h * 0.5, bx + (rnd() - 0.5) * 6 * s, y1 - h); x.lineTo(bx + 3 * s, y1); x.closePath(); x.fillStyle = cols[pass]; x.fill(); }
}
function hdSky(x, W, gy, night, rnd) {
  x.fillStyle = hdGradY(x, 0, gy, night ? '#0e1440' : '#7ec8ee', night ? '#3a3c78' : '#d9f0fb'); x.fillRect(0, 0, W, gy);
  if (night) { for (let i = 0; i < 90; i++) tcEll(x, rnd() * W, rnd() * gy * 0.7, 1.2, 1.2, '#fffbe0'); tcEll(x, W * 0.8, gy * 0.18, 30, 30, '#fbf6d8'); }
}
function hdFarTrees(x, W, y, s, rnd, col = '#6aa36a') { for (let i = 0; i < 40; i++) { const X = rnd() * W, r = (18 + rnd() * 26) * s; hdLeafBlob(x, X, y - r * 0.4, r, col, rnd); } x.fillStyle = col; x.fillRect(0, y - 6 * s, W, 14 * s); for (let i = 0; i < 3; i++) { const X = rnd() * W; x.strokeStyle = '#5b7a4a'; x.lineWidth = 3 * s; x.beginPath(); x.moveTo(X, y); x.lineTo(X + 4 * s, y - 60 * s); x.stroke(); for (let j = 0; j < 6; j++) { const a = -Math.PI + j * 0.55; x.beginPath(); x.moveTo(X + 4 * s, y - 60 * s); x.quadraticCurveTo(X + 4 * s + Math.cos(a) * 14 * s, y - 70 * s, X + 4 * s + Math.cos(a) * 26 * s, y - 56 * s); x.stroke(); } } }
function hdTileRoof(x, pts, rnd, s) {
  hdPath(x, pts); x.fillStyle = hdGradY(x, Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[1])), '#e2643c', '#b8432a'); x.fill();
  x.save(); hdPath(x, pts); x.clip(); const y0 = Math.min(...pts.map((p) => p[1])), y1 = Math.max(...pts.map((p) => p[1])), x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0]));
  for (let Y = y0 + 14 * s, r = 0; Y < y1 + 10; Y += 20 * s, r++) { x.strokeStyle = '#8f2f1e'; x.lineWidth = 3 * s; x.beginPath(); x.moveTo(x0, Y); x.lineTo(x1, Y); x.stroke(); x.strokeStyle = '#f08a5d'; x.lineWidth = 1.5 * s; x.beginPath(); x.moveTo(x0, Y - 4 * s); x.lineTo(x1, Y - 4 * s); x.stroke(); x.strokeStyle = '#9c3522'; x.lineWidth = 1.2 * s; for (let X = x0 + (r % 2) * 14 * s; X < x1; X += 28 * s) { x.beginPath(); x.moveTo(X, Y - 20 * s); x.lineTo(X, Y); x.stroke(); } }
  x.restore(); hdPath(x, pts); x.strokeStyle = '#5a1e12'; x.lineWidth = 2 * s; x.stroke();
}
function hdMudWall(x, x0, y0, w, h, col, rnd, s) { x.fillStyle = hdGradY(x, y0, y0 + h, hdCol(col, 1.06), hdCol(col, 0.86)); x.fillRect(x0, y0, w, h); x.save(); x.beginPath(); x.rect(x0, y0, w, h); x.clip(); for (let i = 0; i < w * h / (900 * s * s); i++) { x.fillStyle = rnd() > 0.5 ? '#00000012' : '#ffffff14'; x.fillRect(x0 + rnd() * w, y0 + rnd() * h, (4 + rnd() * 10) * s, (1 + rnd() * 2) * s); } x.strokeStyle = '#00000030'; x.lineWidth = 1.4 * s; for (let i = 0; i < 6; i++) { let cx = x0 + rnd() * w, cy = y0 + rnd() * h * 0.4; x.beginPath(); x.moveTo(cx, cy); for (let j = 0; j < 5; j++) { cx += (rnd() - 0.5) * 10 * s; cy += 10 * s + rnd() * 10 * s; x.lineTo(cx, cy); } x.stroke(); } x.restore(); }
function hdDoor(x, X, Y, w, h, col, s, open = 0) { x.fillStyle = '#1d140f'; x.fillRect(X, Y, w, h); x.fillStyle = hdGradX(x, X, X + w, col, 0.75, 1.1); x.fillRect(X + w * open, Y, w * (1 - open), h); x.strokeStyle = hdCol(col, 0.55); x.lineWidth = 2 * s; for (let j = 1; j < 4; j++) { x.beginPath(); x.moveTo(X + w * open + (w * (1 - open)) * j / 4, Y); x.lineTo(X + w * open + (w * (1 - open)) * j / 4, Y + h); x.stroke(); } x.lineWidth = 5 * s; for (const yy of [0.25, 0.75]) { x.beginPath(); x.moveTo(X + w * open, Y + h * yy); x.lineTo(X + w, Y + h * yy); x.stroke(); } x.strokeStyle = '#3a241a'; x.lineWidth = 6 * s; x.strokeRect(X, Y, w, h); }
function hdWindowBars(x, X, Y, w, h, s) { x.fillStyle = '#4a2c2a'; x.fillRect(X - 8 * s, Y - 8 * s, w + 16 * s, h + 16 * s); x.fillStyle = '#2a2230'; x.fillRect(X, Y, w, h); x.fillStyle = '#3b5d3a55'; x.fillRect(X, Y + h * 0.5, w, h * 0.5); x.strokeStyle = '#8e3f62'; x.lineWidth = 4 * s; for (let X2 = X + 10 * s; X2 < X + w; X2 += 18 * s) { x.beginPath(); x.moveTo(X2, Y); x.lineTo(X2, Y + h); x.stroke(); } }
function hdThatch(x, pts, s, rnd) { hdPath(x, pts); x.fillStyle = hdGradY(x, Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[1])), '#d8b45a', '#a07a32'); x.fill(); x.save(); hdPath(x, pts); x.clip(); x.strokeStyle = '#7a5a22'; x.lineWidth = 1.2 * s; const y0 = Math.min(...pts.map((p) => p[1])), y1 = Math.max(...pts.map((p) => p[1])), x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0])); for (let i = 0; i < (x1 - x0) * (y1 - y0) / (60 * s * s); i++) { const X = x0 + rnd() * (x1 - x0), Y = y0 + rnd() * (y1 - y0); x.beginPath(); x.moveTo(X, Y); x.lineTo(X + 2 * s, Y + 12 * s); x.stroke(); } x.restore(); }

// kind: 'field' | 'courtyard' | 'hut' → { far, mid, fore } canvases (chaudai W*1.2 — pan ke liye)
function hdBuildBg(kind, night, W, H, gy) {
  const BW = Math.round(W * 1.2), s = H / 720, rnd = hdRnd(tcHash(kind) + (night ? 7 : 0));
  const mk = () => { const c = new OffscreenCanvas(BW, H); return [c, c.getContext('2d')]; };
  const [far, fx] = mk(), [mid, mx] = mk(), [fore, ox] = mk();
  if (kind === 'hut') { // mitti ke ghar ki deewar (andar / aangan)
    hdMudWall(mx, 0, 0, BW, gy, '#b88d52', rnd, s);
    hdThatch(mx, [[0, 0], [BW, 0], [BW, 70 * s], [0, 70 * s]], s, rnd);
    mx.fillStyle = '#6d2f2a'; for (let X = 30 * s; X < BW; X += 95 * s) { mx.fillRect(X, 40 * s, 12 * s, 110 * s); } mx.fillRect(0, 60 * s, BW, 16 * s);
    mx.strokeStyle = '#3a1d18'; mx.lineWidth = 2 * s; for (let X = 30 * s; X < BW; X += 95 * s) mx.strokeRect(X, 40 * s, 12 * s, 110 * s);
    hdDoor(mx, BW * 0.06, gy - 400 * s, 230 * s, 400 * s, '#8a3e4a', s, 0); mx.strokeStyle = '#5a2430'; mx.lineWidth = 16 * s; mx.strokeRect(BW * 0.06 - 8 * s, gy - 408 * s, 246 * s, 416 * s);
    hdWindowBars(mx, BW * 0.36, gy - 340 * s, 170 * s, 130 * s, s); hdWindowBars(mx, BW * 0.76, gy - 340 * s, 170 * s, 130 * s, s);
    mx.fillStyle = '#4a2018'; mx.beginPath(); mx.moveTo(BW * 0.6, gy - 250 * s); mx.lineTo(BW * 0.6, gy - 330 * s); mx.lineTo(BW * 0.6 + 32 * s, gy - 365 * s); mx.lineTo(BW * 0.6 + 64 * s, gy - 330 * s); mx.lineTo(BW * 0.6 + 64 * s, gy - 250 * s); mx.closePath(); mx.fill(); mx.strokeStyle = '#2a120c'; mx.lineWidth = 4 * s; mx.stroke();
    mx.fillStyle = hdGradY(mx, gy, H, '#5f4a3a', '#3e3028'); mx.fillRect(0, gy - 6 * s, BW, H - gy + 6 * s); mx.fillStyle = '#00000025'; mx.fillRect(0, gy - 6 * s, BW, 14 * s);
    for (let i = 0; i < 60; i++) { mx.fillStyle = '#ffffff10'; mx.fillRect(rnd() * BW, gy + rnd() * (H - gy), 20 * s, 2 * s); }
    if (night) { mx.fillStyle = '#0a0a3055'; mx.fillRect(0, 0, BW, H); }
    return { far, mid, fore, outdoor: false };
  }
  hdSky(fx, BW, gy, night, rnd);
  if (!night) { fx.save(); fx.shadowColor = '#ffffff'; fx.shadowBlur = 30 * s; for (let i = 0; i < 5; i++) { const X = rnd() * BW, Y = (40 + rnd() * 120) * s; for (let j = 0; j < 4; j++) tcEll(fx, X + j * 34 * s, Y + (j % 2) * 8 * s, (34 - j * 3) * s, 22 * s, '#ffffffd0'); } fx.restore(); }
  if (kind === 'field') {
    hdFarTrees(fx, BW, gy * 0.42, s, rnd, night ? '#22402e' : '#3f8f3f');
    const bands = [[0.42, 0.5, 'g'], [0.5, 0.66, 'f'], [0.66, 0.7, 'g'], [0.7, 0.92, 'f'], [0.92, 0.98, 'g'], [0.98, 1.2, 'f']];
    for (const [a, b, t] of bands) { const y0 = gy * a, y1 = Math.min(H, gy * b); if (t === 'f') { mx.fillStyle = hdGradY(mx, y0, y1, night ? '#4a3a30' : '#a0704a', night ? '#3a2c24' : '#8a5c3a'); mx.fillRect(0, y0, BW, y1 - y0); mx.strokeStyle = '#00000022'; mx.lineWidth = 2 * s; for (let Y = y0 + 8 * s; Y < y1; Y += 12 * s) { mx.beginPath(); mx.moveTo(0, Y); for (let X = 0; X <= BW; X += 40 * s) mx.lineTo(X, Y + Math.sin(X * 0.02) * 1.5 * s); mx.stroke(); } } else hdGrassStrip(mx, y0 - (y1 - y0) * 0.35, y1, BW, s, rnd, night ? ['#174028', '#1f5232', '#2d6a3e'] : undefined); }
    hdTree(mx, BW * 0.62, gy * 0.95, 1.25 * s, rnd, night);
    hdGrassStrip(ox, H - 34 * s, H, BW, s, rnd, night ? ['#123a22', '#1a4a2c', '#25603a'] : ['#0f6a22', '#1f8a2e', '#3fae3e']);
  } else { // courtyard: gaon ka aangan
    hdFarTrees(fx, BW, gy * 0.7, s, rnd, night ? '#22402e' : '#5f9e5a');
    hdThatch(fx, [[BW * 0.5, gy * 0.48], [BW * 0.68, gy * 0.48], [BW * 0.72, gy * 0.6], [BW * 0.46, gy * 0.6]], s, rnd); hdMudWall(fx, BW * 0.48, gy * 0.6, BW * 0.22, gy * 0.18, '#c9a46c', rnd, s); hdDoor(fx, BW * 0.55, gy * 0.64, 40 * s, gy * 0.14, '#3a2a22', s, 0);
    mx.fillStyle = hdGradY(mx, gy * 0.75, H, night ? '#24452f' : '#4f9e46', night ? '#1a3322' : '#3c7f36'); mx.fillRect(0, gy * 0.76, BW, H - gy * 0.76);
    mx.fillStyle = night ? '#3a2e24' : '#a37e52'; mx.beginPath(); mx.moveTo(0, H); mx.quadraticCurveTo(BW * 0.5, gy * 0.9, BW, gy * 0.95); mx.lineTo(BW, H); mx.closePath(); mx.fill();
    const hx0 = 0, hy1 = gy * 0.82; hdMudWall(mx, hx0, gy * 0.32, BW * 0.42, hy1 - gy * 0.32, night ? '#3f6a78' : '#6aaebd', rnd, s);
    mx.fillStyle = '#00000026'; mx.fillRect(hx0, gy * 0.32, BW * 0.42, 30 * s);
    hdDoor(mx, BW * 0.22, gy * 0.45, 90 * s, hy1 - gy * 0.45, '#5a4232', s, 0.45);
    mx.fillStyle = '#7a4a2a'; mx.fillRect(BW * 0.02, gy * 0.42, 56 * s, 120 * s); mx.fillStyle = '#5a3520'; mx.fillRect(BW * 0.02 + 6 * s, gy * 0.42 + 6 * s, 44 * s, 108 * s);
    hdTileRoof(mx, [[-10, gy * 0.05], [BW * 0.3, gy * 0.05], [BW * 0.46, gy * 0.36], [-10, gy * 0.36]], rnd, s);
    mx.fillStyle = '#9aa0a6'; mx.fillRect(hx0, hy1, BW * 0.42, 22 * s); mx.fillStyle = '#00000030'; mx.fillRect(hx0, hy1 + 22 * s, BW * 0.42, 8 * s);
    hdTree(mx, BW * 0.52, gy * 0.78, 1.0 * s, rnd, night); hdTree(mx, BW * 0.96, gy * 0.82, 0.8 * s, rnd, night);
    hdGrassStrip(ox, H - 26 * s, H, BW, s, rnd, night ? ['#123a22', '#1a4a2c', '#25603a'] : ['#2e7d32', '#43a047', '#66bb6a']);
  }
  if (night) { mx.fillStyle = '#0a0a3040'; mx.fillRect(0, 0, BW, H); }
  return { far, mid, fore, outdoor: true };
}
const HD_BG_CACHE = new Map();
function hdBgKind(s) { const k = tcBgKind(s); const t = `${s.place || ''} ${s.imageCore || s.image || ''}`; if (/\b(field|farm|khet|crop|plough|harvest)\b|खेत/i.test(t)) return 'field'; if (k === 'room' || k === 'classroom') return 'hut'; return 'courtyard'; }
function hdBg(kind, night, W, H, gy) { const key = `${kind}:${night}:${W}x${H}:${gy | 0}`; if (!HD_BG_CACHE.has(key)) { if (HD_BG_CACHE.size > 6) HD_BG_CACHE.clear(); HD_BG_CACHE.set(key, hdBuildBg(kind, night, W, H, gy)); } return HD_BG_CACHE.get(key); }

// ---------- zinda maahaul: chidiya, patte, baadal ----------
function hdAmbient(x, W, H, t, outdoor, seed) {
  if (!outdoor) return;
  const rnd = hdRnd(seed);
  for (let i = 0; i < 3; i++) { const sp = 30 + rnd() * 30, y0 = H * (0.1 + rnd() * 0.2), X = ((t * sp + rnd() * W) % (W + 200)) - 100, fl = Math.sin(t * 9 + i) * 5; x.strokeStyle = '#2b2b2b'; x.lineWidth = 2; x.beginPath(); x.moveTo(X - 9, y0 - fl); x.quadraticCurveTo(X - 4, y0 - 4, X, y0); x.quadraticCurveTo(X + 4, y0 - 4, X + 9, y0 - fl); x.stroke(); }
}

// ---------- HD frame (tcFrame isse bulata hai jab Look = HD) ----------
async function tcFrameHD(TC, i, tq, getBg) {
  const W = TC.W, H = TC.H;
  let c = TC.canv.get(i); if (!c) { c = new OffscreenCanvas(W, H); TC.canv.set(i, c); for (const key of TC.canv.keys()) if (key < i - 2) TC.canv.delete(key); }
  const x = c.getContext('2d'), s = TC.scenes[i], sc = TC.sc[i];
  let L = TC.bg.get(i);
  if (L === undefined) {
    let flow = null; if (TCS.tcBg !== 'builtin') { try { flow = await getBg(); } catch (e) { flow = null; } }
    L = flow ? { flow } : hdBg(hdBgKind(s), tcNight(s), W, H, TC.gy);
    TC.bg.set(i, L); for (const key of TC.bg.keys()) if (key < i - 2) TC.bg.delete(key);
  }
  const p = tcClamp((tq - sc.vs) / Math.max(0.01, sc.ve - sc.vs)), dir = i % 2 ? -1 : 1, pe = tcEase(p);
  const still = TCS.tcCam === 'still', pan = still ? 0 : (pe - 0.5) * dir, zoom = still ? 1 : 1 + 0.03 * pe;
  x.save(); x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
  x.translate(W / 2, H * 0.7); x.scale(zoom, zoom); x.translate(-W / 2, -H * 0.7);
  const slack = W * 0.2, offMid = -slack / 2 - pan * slack * 0.8;
  if (L.flow) { const bg = L.flow, cover = Math.max((W * 1.08) / bg.width, H / bg.height); x.drawImage(bg, (W - bg.width * cover) / 2 - pan * W * 0.04, (H - bg.height * cover) / 2, bg.width * cover, bg.height * cover); }
  else {
    x.drawImage(L.far, -slack / 2 - pan * slack * 0.3, 0);
    // baadal (dheere)
    x.drawImage(L.mid, offMid, 0);
  }
  hdAmbient(x, W, H, TC.T[i] + (tq - TC.T[i]), !L.flow ? L.outdoor : false, tcHash(String(s.n)));
  const lt = tq - TC.T[i], endL = sc.ve - TC.T[i], charOff = L.flow ? -pan * W * 0.04 : offMid + slack / 2;
  const sts = TC.plan[i].cast.map((pc) => ({ pc, st: tcStateOf(TC, i, pc, lt, endL, W) }));
  sts.sort((a, b) => (a.pc.speaker ? 1 : 0) - (b.pc.speaker ? 1 : 0));
  x.save(); x.translate(charOff, 0);
  for (const { pc, st } of sts) {
    const sp = TC.cast[pc.name];
    if (pc.act === 'sit') st.sit = 1; // HD: charpai par poore scene baitha
    if (pc.act === 'sit_floor') { st.sitFloor = 1; }
    if (pc.act === 'namaste' && lt > 0) st.namaste = 1;
    if (sp.prop) st.prop = sp.prop;
    try { tcDrawCharHD(x, sp, st, TC.k * 246 / 300 * 1.12 * (sp.scale || 1)); } catch (e) { if (!TC.warned) { TC.warned = 1; addLog('🧸 HD: ' + e.message, 'warn'); } }
  }
  x.restore();
  if (L.fore) x.drawImage(L.fore, offMid - pan * slack * 0.3, Math.sin(lt * 1.3) * 1.2);
  x.restore();
  return c;
}
