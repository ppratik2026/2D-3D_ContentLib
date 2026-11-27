// "Bean Night" extras: speech bubbles, battery meter, big text, red thought notes, dream cloud, red aura, flat dog.
// Everything is drawn on canvases (handwritten font) and shown on flat planes in front of the stage.
import * as THREE from 'three';

const FONT = '"AVKalam", "Kalam", "Comic Sans MS", cursive';
export async function loadFonts() { try { const f = new FontFace('AVKalam', 'url(av://app/app/fonts/Kalam-Bold.ttf)'); await f.load(); document.fonts.add(f); } catch (e) { console.warn('font', e.message); } }
const noOut = (m) => { m.userData.outlineParameters = { visible: false }; return m; };
function canvasPlane(cv) { const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), noOut(new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthTest: false, depthWrite: false, toneMapped: false }))); m.renderOrder = 50; m.userData.aspect = cv.width / cv.height; return m; }
const rr = (x, a, b, w, h, r) => { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); };
function wrap(x, text, maxW) { const words = String(text).split(/\s+/); const lines = []; let cur = ''; for (const w of words) { const t = cur ? cur + ' ' + w : w; if (x.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur); return lines.slice(0, 3); }

// speech bubble (dark rounded box, white handwritten text) — or red floating text for the inner voice
export function makeBubble(text, { red = false } = {}) {
  const cv = document.createElement('canvas'); const x = cv.getContext('2d'); const fs = 64; x.font = `700 ${fs}px ${FONT}`;
  const lines = wrap(x, text, 1100); const w = Math.max(...lines.map((l) => x.measureText(l).width)) + 80, h = lines.length * fs * 1.25 + 50; cv.width = Math.ceil(w); cv.height = Math.ceil(h);
  x.font = `700 ${fs}px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
  if (!red) { x.fillStyle = 'rgba(16,16,20,0.92)'; rr(x, 4, 4, cv.width - 8, cv.height - 8, 34); x.fill(); x.fillStyle = '#f4f4f0'; }
  else { x.shadowColor = 'rgba(255,60,40,0.8)'; x.shadowBlur = 18; x.fillStyle = '#ff6a4a'; }
  lines.forEach((l, i) => x.fillText(l, cv.width / 2, 25 + fs * 0.62 + i * fs * 1.25)); return canvasPlane(cv);
}
// battery meter: value 0..100, colour by value (or given)
export function makeBattery() { const cv = document.createElement('canvas'); cv.width = 720; cv.height = 200; const p = canvasPlane(cv); let last = null;
  p.userData.set = (v, color) => { const key = v + '|' + color; if (key === last) return; last = key; const x = cv.getContext('2d'); x.clearRect(0, 0, cv.width, cv.height);
    const c = color || (v <= 15 ? '#ff4a3a' : v >= 99 ? '#ffd23a' : '#f2f2f2'); x.lineWidth = 16; x.strokeStyle = c; x.shadowColor = c; x.shadowBlur = 14; rr(x, 14, 30, 320, 140, 30); x.stroke(); x.shadowBlur = 0;
    x.fillStyle = c; rr(x, 340, 75, 22, 50, 6); x.fill(); x.fillStyle = 'rgba(10,10,14,0.85)'; rr(x, 30, 46, 288, 108, 18); x.fill();
    const fw = Math.max(14, 270 * Math.max(0, Math.min(1, v / 100))); x.fillStyle = c; rr(x, 40, 56, fw, 88, 14); x.fill();
    x.font = `700 120px ${FONT}`; x.textBaseline = 'middle'; x.fillStyle = c; x.fillText(`${Math.round(v)}%`, 390, 104); p.material.map.needsUpdate = true; };
  p.userData.set(100); return p; }
// big text ("GO!") with a pop
export function makeBigText(text, color = '#e8e8e8') { const cv = document.createElement('canvas'); const x = cv.getContext('2d'); const fs = 220; x.font = `700 ${fs}px ${FONT}`; cv.width = Math.ceil(x.measureText(text).width + 120); cv.height = 320;
  x.font = `700 ${fs}px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 18; x.strokeStyle = '#111'; x.strokeText(text, cv.width / 2, 170); x.fillStyle = color; x.fillText(text, cv.width / 2, 170); return canvasPlane(cv); }
// red sticky note with a worried thought
export function makeNote(text, seed = 0) { const cv = document.createElement('canvas'); cv.width = 220; cv.height = 200; const x = cv.getContext('2d');
  x.fillStyle = '#ff6a4a'; x.shadowColor = 'rgba(255,80,50,0.7)'; x.shadowBlur = 14; rr(x, 14, 14, 192, 172, 18); x.fill(); x.shadowBlur = 0; x.fillStyle = '#3a0e08'; x.font = `700 ${String(text).length > 14 ? 38 : 46}px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
  const lines = wrap(x, text, 170); lines.forEach((l, i) => x.fillText(l, 110, 100 + (i - (lines.length - 1) / 2) * 44)); return canvasPlane(cv); }
// soft glow sprite (aura / lamp)
let glowTex = null; export function glowTexture() { if (glowTex) return glowTex; const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d'); const g = x.createRadialGradient(128, 128, 10, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); glowTex = new THREE.CanvasTexture(cv); return glowTex; }
export function makeAura(color = '#ff3a26') { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), noOut(new THREE.MeshBasicMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0.9 }))); return m; }
// dream / memory cloud: the chosen background (tinted dark red) inside a cloud with a glowing red edge
export function makeDreamCloud(img, figs = 0) { const W = 1600, Hh = 1000; const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh; const x = cv.getContext('2d');
  const bumps = [[330, 330, 200], [580, 250, 230], [880, 240, 225], [1170, 280, 215], [1330, 450, 190], [1240, 690, 190], [960, 770, 205], [650, 780, 215], [390, 700, 195], [260, 510, 190], [800, 510, 360]];
  x.save(); x.beginPath(); for (const [a, b, r] of bumps) { x.moveTo(a + r, b); x.arc(a, b, r, 0, Math.PI * 2); } x.clip();
  if (img) { const ia = img.width / img.height; const h = W / ia; x.drawImage(img, 0, (Hh - h) / 2, W, h); } x.fillStyle = 'rgba(80,6,4,0.72)'; x.fillRect(0, 0, W, Hh); x.restore();
  x.lineWidth = 12; x.strokeStyle = '#ff6a4a'; x.shadowColor = 'rgba(255,70,40,0.95)'; x.shadowBlur = 28; x.lineCap = 'round';
  for (const [a, b, r] of bumps) for (let k = 0; k < 120; k++) { const t0 = (k / 120) * Math.PI * 2, t1 = ((k + 1) / 120) * Math.PI * 2; const mx = a + Math.cos((t0 + t1) / 2) * r, my = b + Math.sin((t0 + t1) / 2) * r;
    if (bumps.some(([c, d, s2]) => (c !== a || d !== b) && Math.hypot(mx - c, my - d) < s2 - 1)) continue; x.beginPath(); x.arc(a, b, r, t0, t1); x.stroke(); }
  // the people in the dream: black bean silhouettes with a red glow, standing on the dream's ground
  for (let i = 0; i < figs; i++) { const fx = W / 2 + (i - (figs - 1) / 2) * 260, fy = 800, h = 380 - (i % 2) * 40, w = h * 0.44;
    x.save(); x.shadowColor = 'rgba(255,60,40,0.95)'; x.shadowBlur = 26; x.fillStyle = '#0a0a0c';
    rr(x, fx - w / 2, fy - h, w, h * 0.72, w / 2); x.fill(); x.fillRect(fx - w * 0.32, fy - h * 0.32, w * 0.22, h * 0.32); x.fillRect(fx + w * 0.1, fy - h * 0.32, w * 0.22, h * 0.32); x.restore(); }
  return canvasPlane(cv); }
// small thought dots between the dreamer's head and the cloud
export function makeDot() { const cv = document.createElement('canvas'); cv.width = cv.height = 120; const x = cv.getContext('2d'); x.fillStyle = 'rgba(60,8,6,0.85)'; x.strokeStyle = '#ff6a4a'; x.lineWidth = 9; x.shadowColor = 'rgba(255,70,40,0.95)'; x.shadowBlur = 18;
  x.beginPath(); x.arc(60, 60, 40, 0, Math.PI * 2); x.fill(); x.stroke(); return canvasPlane(cv); }

// flat dog (same doodle look): body, head, ear, four stick legs, wagging tail
export function makeFlatDog(color = '#e3b66a') { const g = new THREE.Group(); const M = (c) => noOut(new THREE.MeshBasicMaterial({ color: new THREE.Color(c) })); const dark = new THREE.Color(color).multiplyScalar(0.78);
  const pill = (w, h, c, z = 0) => { const s = new THREE.Shape(); const r = Math.min(w, h) / 2; s.absarc(-w / 2 + r, 0, r, Math.PI / 2, Math.PI * 1.5, false); s.lineTo(w / 2 - r, -h / 2); s.absarc(w / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2, false); s.closePath(); const m = new THREE.Mesh(new THREE.ShapeGeometry(s, 10), M(c)); m.position.z = z; return m; };
  const body = pill(0.46, 0.18, color, 0); body.position.set(0, 0.3, 0); g.add(body);
  const head = new THREE.Group(); head.position.set(0.27, 0.42, 0.01); g.add(head); head.add(pill(0.2, 0.16, color, 0)); const snout = pill(0.1, 0.08, color, 0.001); snout.position.set(0.1, -0.03, 0); head.add(snout);
  const ear = pill(0.06, 0.12, dark, 0.002); ear.position.set(-0.03, 0.02, 0); ear.rotation.z = 0.4; head.add(ear); const eye = new THREE.Mesh(new THREE.CircleGeometry(0.012, 10), M('#1a1a1a')); eye.position.set(0.04, 0.02, 0.003); head.add(eye);
  const nose = new THREE.Mesh(new THREE.CircleGeometry(0.016, 10), M('#2a1a14')); nose.position.set(0.15, -0.02, 0.003); head.add(nose);
  const collar = pill(0.04, 0.12, '#d84a3a', 0.004); collar.position.set(0.18, 0.37, 0.01); g.add(collar);
  const legs = []; for (const [x, z, c] of [[-0.16, -0.01, dark], [0.14, -0.01, dark], [-0.12, 0.01, color], [0.18, 0.01, color]]) { const L = new THREE.Group(); L.position.set(x, 0.26, z); const m = pill(0.05, 0.26, c, 0); m.rotation.z = Math.PI / 2; m.position.y = -0.12; L.add(m); g.add(L); legs.push(L); }
  const tail = new THREE.Group(); tail.position.set(-0.22, 0.34, -0.005); const tm = pill(0.04, 0.2, color, 0); tm.rotation.z = Math.PI / 2; tm.position.y = 0.09; tail.add(tm); tail.rotation.z = -0.6; g.add(tail);
  g.userData.collar = collar;
  return { group: g, type: 'dog', flat: true, set(t, { phase = 0, moving = 0, run = 0, act = null } = {}) { const sw = moving ? Math.sin(phase) * (run ? 0.6 : 0.4) : 0; legs.forEach((L, i) => (L.rotation.z = i % 2 ? sw : -sw));
    tail.rotation.z = -0.5 + Math.sin(t * 12) * 0.35; head.rotation.z = act === 'bark' ? Math.abs(Math.sin(t * 10)) * 0.2 : Math.sin(t * 2) * 0.03; body.position.y = 0.3 + (moving ? Math.abs(Math.sin(phase)) * 0.015 : 0); } };
}
