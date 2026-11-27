// Step 4: background music (by category mood), ambience (by location), sound effects and dialogue,
// all generated/mixed in code into one track. Free: no samples needed. Music ducks under dialogue.
import { readWav, writeWav } from './wav.mjs';

const SR = 32000;
let seed = 12345; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const noise = () => rnd() * 2 - 1;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function add(buf, sig, at, gain = 1) { const i0 = Math.floor(at * SR); for (let i = 0; i < sig.length; i++) { const j = i0 + i; if (j >= 0 && j < buf.length) buf[j] += sig[i] * gain; } }
function lowpass(x, a) { let s = 0; for (let i = 0; i < x.length; i++) { s += a * (x[i] - s); x[i] = s; } return x; }
function tone(freq, dur, { type = 'sine', attack = 0.005, decay = 3, harm = 0.3, detune = 0 } = {}) {
  const n = Math.floor(dur * SR), o = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR; const env = Math.min(1, t / attack) * Math.exp(-t * decay);
    let v;
    if (type === 'sine') v = Math.sin(2 * Math.PI * freq * t) + harm * Math.sin(4 * Math.PI * freq * t) * Math.exp(-t * 6);
    else if (type === 'saw') { const a = (freq * t) % 1, b = (freq * (1 + detune) * t) % 1; v = (a * 2 - 1 + b * 2 - 1) * 0.5; }
    else if (type === 'bell') v = Math.sin(2 * Math.PI * freq * t) + 0.5 * Math.sin(2 * Math.PI * freq * 2.76 * t) * Math.exp(-t * 4) + 0.25 * Math.sin(2 * Math.PI * freq * 5.4 * t) * Math.exp(-t * 8);
    else if (type === 'pluck') v = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 9) + 0.4 * Math.sin(2 * Math.PI * freq * 2 * t) * Math.exp(-t * 14);
    o[i] = v * env; }
  return o;
}
function pad(freqs, dur, attack = 0.8) { const n = Math.floor(dur * SR), o = new Float32Array(n);
  for (const f of freqs) { const s = tone(f, dur, { type: 'saw', attack: 0.01, decay: 0, detune: 0.004 }); for (let i = 0; i < n; i++) o[i] += s[i] * 0.25; }
  lowpass(o, 0.04); for (let i = 0; i < n; i++) { const t = i / SR; o[i] *= Math.min(1, t / attack) * Math.min(1, (dur - t) / 0.6); } return o; }
function drum(kind) { const n = Math.floor((kind === 'kick' ? 0.35 : 0.12) * SR), o = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR; o[i] = kind === 'kick' ? Math.sin(2 * Math.PI * (50 + 90 * Math.exp(-t * 30)) * t) * Math.exp(-t * 9) : kind === 'snare' ? noise() * Math.exp(-t * 22) * 0.7 : noise() * Math.exp(-t * 60) * 0.35; }
  if (kind === 'hat') { let p = 0; for (let i = 0; i < n; i++) { const v = o[i]; o[i] = v - p; p = v; } } return o; }

const PROG = {
  major: [[0, 4, 7], [9, 0, 4], [5, 9, 0], [7, 11, 2]], minor: [[0, 3, 7], [8, 0, 3], [3, 7, 10], [10, 2, 5]],
  happy: [[0, 4, 7], [5, 9, 0], [7, 11, 2], [0, 4, 7]], tense: [[0, 3, 7], [0, 3, 7], [8, 0, 3], [7, 11, 2]], lift: [[0, 4, 7], [7, 11, 2], [9, 0, 4], [5, 9, 0]],
};
const MOODS = {
  romance:      { bpm: 72, key: 62, prog: 'major', inst: ['epiano', 'pad'], drums: false, gain: 0.5 },
  drama:        { bpm: 64, key: 57, prog: 'minor', inst: ['pad', 'piano'], drums: false, gain: 0.5 },
  comedy:       { bpm: 116, key: 65, prog: 'happy', inst: ['pluck', 'bass'], drums: 'light', gain: 0.45 },
  crime:        { bpm: 92, key: 52, prog: 'tense', inst: ['pulse', 'pad'], drums: 'tick', gain: 0.45 },
  thriller:     { bpm: 120, key: 50, prog: 'tense', inst: ['pulse16', 'pad'], drums: 'hits', gain: 0.45 },
  horror:       { bpm: 0, key: 45, prog: 'minor', inst: ['drone'], drums: false, gain: 0.55 },
  kids:         { bpm: 108, key: 67, prog: 'happy', inst: ['bell', 'bass'], drums: 'light', gain: 0.45 },
  motivational: { bpm: 96, key: 60, prog: 'lift', inst: ['arp', 'pad', 'bass'], drums: 'build', gain: 0.45 },
};

export function makeMusic(mood, dur) {
  const M = MOODS[mood] || MOODS.drama; const out = new Float32Array(Math.ceil(dur * SR)); seed = 777;
  if (M.bpm === 0) { // horror: drone + random bells + heartbeat
    for (let i = 0; i < out.length; i++) { const t = i / SR; out[i] = 0.25 * Math.sin(2 * Math.PI * 55 * t) + 0.2 * Math.sin(2 * Math.PI * 55.7 * t) + 0.12 * Math.sin(2 * Math.PI * 82.4 * t + Math.sin(t * 0.3) * 2); out[i] *= 0.6 + 0.4 * Math.sin(t * 0.21); }
    const wind = new Float32Array(out.length); for (let i = 0; i < wind.length; i++) wind[i] = noise(); lowpass(wind, 0.01); for (let i = 0; i < out.length; i++) out[i] += wind[i] * 1.5 * (0.5 + 0.5 * Math.sin(i / SR * 0.13));
    for (let t = 4; t < dur; t += 5 + rnd() * 7) add(out, tone(mtof(M.key + 24 + [0, 1, 6, 11][Math.floor(rnd() * 4)]), 4, { type: 'bell', decay: 0.9 }), t, 0.12);
    for (let t = 10; t < dur; t += 20 + rnd() * 15) for (let k = 0; k < 6; k++) { add(out, drum('kick'), t + k * 0.85, 0.35); add(out, drum('kick'), t + k * 0.85 + 0.22, 0.25); }
    return scale(out, M.gain);
  }
  const beat = 60 / M.bpm, bar = beat * 4, prog = PROG[M.prog];
  for (let b = 0, t = 0; t < dur; b++, t += bar) {
    const ch = prog[b % 4].map((x) => M.key + x); const build = Math.min(1, t / Math.max(20, dur * 0.6));
    for (const inst of M.inst) {
      if (inst === 'pad') add(out, pad(ch.map((m) => mtof(m - 12)), bar + 0.3), t, 0.35);
      if (inst === 'epiano') for (const h of [0, 2.5]) for (const m of ch) add(out, tone(mtof(m), beat * 3, { decay: 1.4 }), t + h * beat, 0.09);
      if (inst === 'piano') for (let k = 0; k < 4; k++) add(out, tone(mtof(ch[k % 3] + (k === 3 ? 12 : 0)), beat * 2, { decay: 2.2 }), t + k * beat, 0.08);
      if (inst === 'pluck') for (let k = 0; k < 8; k++) if (k % 3 !== 2) add(out, tone(mtof(ch[k % 3] + 12), 0.4, { type: 'pluck' }), t + k * beat / 2, 0.09);
      if (inst === 'bell') for (let k = 0; k < 8; k++) add(out, tone(mtof(ch[(k * 2) % 3] + 24), 0.8, { type: 'bell', decay: 4 }), t + k * beat / 2, 0.05);
      if (inst === 'bass') for (let k = 0; k < 4; k++) add(out, tone(mtof(ch[0] - 24 + (k % 2 ? 7 : 0)), beat * 0.9, { decay: 3, harm: 0.5 }), t + k * beat, 0.22);
      if (inst === 'pulse' || inst === 'pulse16') { const div = inst === 'pulse' ? 2 : 4; for (let k = 0; k < 4 * div; k++) add(out, tone(mtof(ch[0] - 24), beat / div, { type: 'pluck' }), t + k * beat / div, 0.2); }
      if (inst === 'arp') for (let k = 0; k < 8; k++) add(out, tone(mtof(ch[k % 3] + 12 * (k > 3 ? 1 : 0)), 0.5, { type: 'pluck' }), t + k * beat / 2, 0.07 + 0.05 * build);
      if (inst === 'drone') add(out, pad([mtof(ch[0] - 24)], bar + 0.3), t, 0.4);
    }
    if (M.drums === 'light') for (let k = 0; k < 4; k++) { add(out, drum(k % 2 ? 'snare' : 'kick'), t + k * beat, 0.18); add(out, drum('hat'), t + k * beat + beat / 2, 0.12); }
    if (M.drums === 'tick') for (let k = 0; k < 8; k++) add(out, drum('hat'), t + k * beat / 2, 0.1);
    if (M.drums === 'hits' && b % 2 === 0) { add(out, drum('kick'), t, 0.4); add(out, drum('kick'), t + beat * 2.5, 0.3); }
    if (M.drums === 'build' && build > 0.3) for (let k = 0; k < 4; k++) { add(out, drum('kick'), t + k * beat, 0.25 * build); if (k % 2) add(out, drum('snare'), t + k * beat, 0.15 * build); }
  }
  return scale(lowpass(out, 0.5), M.gain);
}
function scale(x, g) { let m = 1e-6; for (const v of x) m = Math.max(m, Math.abs(v)); for (let i = 0; i < x.length; i++) x[i] = (x[i] / m) * g; return x; }

// ambience per location (loops of filtered noise + details)
function ambience(loc, tod, dur) {
  const n = Math.ceil(dur * SR), o = new Float32Array(n);
  const w = new Float32Array(n); for (let i = 0; i < n; i++) w[i] = noise();
  if (loc === 'street') { lowpass(w, 0.02); for (let i = 0; i < n; i++) o[i] = w[i] * 3; for (let t = 1 + rnd() * 3; t < dur; t += 5 + rnd() * 6) { const car = new Float32Array(Math.floor(3 * SR)); for (let i = 0; i < car.length; i++) car[i] = noise() * Math.sin(Math.PI * i / car.length); lowpass(car, 0.05); add(o, car, t, 2.2); } }
  else if (loc === 'cafe' || loc === 'office' || loc === 'classroom' || loc === 'police') { const a = lowpass(Float32Array.from(w), 0.09), b = lowpass(Float32Array.from(w), 0.012); for (let i = 0; i < n; i++) o[i] = (a[i] - b[i]) * (loc === 'cafe' ? 2.2 : 1.2) * (0.7 + 0.3 * Math.sin(i / SR * 0.4)); if (loc === 'cafe') for (let t = 2 + rnd() * 4; t < dur; t += 4 + rnd() * 6) add(o, tone(2200 + rnd() * 900, 0.4, { type: 'bell', decay: 12 }), t, 0.05); }
  else if (loc === 'home') { lowpass(w, 0.01); for (let i = 0; i < n; i++) o[i] = w[i] * 0.8; for (let t = 0; t < dur; t += 1) add(o, tone(1800, 0.03, { decay: 80 }), t, 0.02); }
  else if (loc === 'park' || loc === 'forest') { lowpass(w, 0.03); for (let i = 0; i < n; i++) o[i] = w[i] * 1.6 * (0.6 + 0.4 * Math.sin(i / SR * 0.25));
    if (tod === 'night') { for (let t = 0; t < dur; t += 0.9 + rnd() * 0.5) for (let k = 0; k < 3; k++) add(o, tone(4300, 0.05, { decay: 40 }), t + k * 0.07, 0.02); }
    else for (let t = 1; t < dur; t += 2 + rnd() * 4) for (let k = 0; k < 3; k++) add(o, tone(2600 + rnd() * 1800, 0.12, { decay: 25 }), t + k * 0.13, 0.03); }
  else if (loc === 'alley') { lowpass(w, 0.008); for (let i = 0; i < n; i++) o[i] = w[i] * 2.5; for (let t = 3; t < dur; t += 6 + rnd() * 8) add(o, tone(900, 0.25, { decay: 15 }), t, 0.03); }
  return o;
}
// weather and creature sounds
function rainLoop(dur, heavy) { const n = Math.ceil(dur * SR), o = new Float32Array(n); let a = 0, b = 0; for (let i = 0; i < n; i++) { const w = noise(); a += 0.25 * (w - a); b += 0.02 * (w - b); o[i] = (w - a) * 0.5 + (a - b) * 0.8; if (rnd() < (heavy ? 0.004 : 0.002)) o[i] += noise() * 1.5; } for (let i = 0; i < n; i++) o[i] *= Math.min(1, i / SR / 0.8, (n - i) / SR / 0.8); return o; }
function thunder() { const n = Math.floor(4 * SR), o = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / SR; o[i] = noise() * (t < 0.08 ? 1.2 : Math.exp(-(t - 0.08) * 1.3) * (0.7 + 0.3 * Math.sin(t * 9))); } return lowpass(lowpass(o, 0.04), 0.08); }
function windLoop(dur) { const n = Math.ceil(dur * SR), o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = noise(); lowpass(o, 0.015); for (let i = 0; i < n; i++) { const t = i / SR; o[i] *= 3 * (0.5 + 0.5 * Math.sin(t * 0.7) * Math.sin(t * 0.23 + 1)); } return o; }
function bark() { const o = new Float32Array(Math.floor(0.5 * SR)); for (const s of [0, 0.22]) add(o, tone(420 + rnd() * 80, 0.16, { type: 'saw', attack: 0.005, decay: 14, detune: 0.03 }), s, 0.6); return lowpass(o, 0.25); }
function owl() { const o = new Float32Array(Math.floor(1.6 * SR)); for (const [s, d] of [[0, 0.35], [0.5, 0.25], [0.8, 0.6]]) add(o, tone(380, d, { attack: 0.05, decay: 2 }), s, 0.5); return o; }
function heartbeat() { const o = new Float32Array(Math.floor(1.6 * SR)); for (const s of [0, 0.28, 0.8, 1.08]) add(o, tone(55, 0.25, { attack: 0.005, decay: 18, harm: 0.8 }), s, 0.9); return o; }
function crickets(dur) { const o = new Float32Array(Math.ceil(dur * SR)); for (let t = 0; t < dur; t += 0.7 + rnd() * 0.5) for (let k = 0; k < 4; k++) add(o, tone(4300 + rnd() * 300, 0.04, { decay: 50 }), t + k * 0.06, 0.03); return o; }
function birds(dur) { const o = new Float32Array(Math.ceil(dur * SR)); for (let t = 1; t < dur; t += 2 + rnd() * 4) for (let k = 0; k < 3; k++) add(o, tone(2600 + rnd() * 1800, 0.12, { decay: 25 }), t + k * 0.13, 0.03); return o; }
const PLACE_AMB = { village_street: 'village', village_house_out: 'village', field: 'village', temple: 'village', river: 'village', forest: 'forest', haunted: 'haunted', graveyard: 'haunted', road_night: 'haunted',
  market: 'street', city_street: 'street', railway: 'street', house_inside: 'home', rich_house: 'home', police: 'office', office: 'office', school: 'office', hospital: 'office', cafe: 'cafe', palace: 'office',
  jail: 'haunted', court: 'office', lab: 'office', bank: 'office', restaurant: 'cafe', hotel: 'home', shop: 'street', highway: 'street', lane: 'street', bus_stand: 'street', college: 'office', village_inside: 'home' };
function stageAmbience(kind, night, dur) {
  const n = Math.ceil(dur * SR), o = new Float32Array(n); const w = new Float32Array(n); for (let i = 0; i < n; i++) w[i] = noise();
  if (kind === 'village' || kind === 'forest' || kind === 'haunted') { lowpass(w, 0.02); for (let i = 0; i < n; i++) o[i] = w[i] * (kind === 'haunted' ? 2.2 : 1.2);
    if (night) { add(o, crickets(dur), 0, 1); for (let t = 4 + rnd() * 6; t < dur; t += 9 + rnd() * 12) add(o, kind === 'village' ? bark() : owl(), t, kind === 'village' ? 0.35 : 0.4); } else add(o, birds(dur), 0, 1); return o; }
  return ambience(kind === 'cafe' ? 'cafe' : kind === 'office' ? 'office' : kind === 'home' ? 'home' : 'street', night ? 'night' : 'day', dur);
}

function step(g = 1) { const n = Math.floor(0.09 * SR), o = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / SR; o[i] = (noise() * Math.exp(-t * 60) * 0.6 + Math.sin(2 * Math.PI * 95 * t) * Math.exp(-t * 40)) * g; } return lowpass(o, 0.3); }
function door() { const n = Math.floor(0.7 * SR), o = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / SR; o[i] = Math.sin(2 * Math.PI * (300 + 200 * Math.sin(t * 9)) * t) * Math.exp(-t * 5) * 0.15 + (t > 0.5 ? noise() * Math.exp(-(t - 0.5) * 30) : 0); } return lowpass(o, 0.2); }
function whoosh() { const n = Math.floor(0.8 * SR), o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = noise() * Math.sin(Math.PI * i / n) ** 2; return lowpass(o, 0.06); }
// vehicles, police and court sounds
function siren(dur, amb) { const n = Math.ceil(dur * SR), o = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; const f = amb ? (Math.floor(t / 0.55) % 2 ? 960 : 770) : 720 + 520 * (0.5 - 0.5 * Math.cos(2 * Math.PI * t / 1.6)); ph += 2 * Math.PI * f / SR; o[i] = (Math.sin(ph) + 0.35 * Math.sin(2 * ph) + 0.15 * Math.sin(3 * ph)) * Math.min(1, t / 0.3, (dur - t) / 0.4); }
  return lowpass(o, 0.35); }
function engine(dur, rev = 1) { const n = Math.ceil(dur * SR), o = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; const f = 38 + 18 * rev * Math.min(1, t / 1.5) + 3 * Math.sin(t * 2.3); ph += f / SR; const saw = (ph % 1) * 2 - 1; o[i] = (saw * 0.7 + noise() * 0.35) * Math.min(1, t / 0.4, (dur - t) / 0.6); }
  return lowpass(lowpass(o, 0.06), 0.1); }
function screech() { const n = Math.floor(1.1 * SR), o = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += 2 * Math.PI * (2600 - 900 * t) / SR; o[i] = (Math.sin(ph) * 0.5 + noise() * 0.5 * Math.sin(ph * 0.5)) * Math.min(1, t / 0.05) * Math.exp(-t * 1.6); } return o; }
function brake() { const o = screech(); for (let i = 0; i < o.length; i++) o[i] *= 0.45 * Math.exp(-i / SR * 2); return o; }
function carDoor(close) { const n = Math.floor(0.5 * SR), o = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / SR; o[i] = close ? (Math.sin(2 * Math.PI * 70 * t) * Math.exp(-t * 18) + noise() * Math.exp(-t * 45) * 0.6) : (noise() * Math.exp(-t * 30) * 0.4 + Math.sin(2 * Math.PI * 1400 * t) * Math.exp(-t * 40) * 0.2); } return lowpass(o, close ? 0.2 : 0.5); }
function metalClick() { const o = new Float32Array(Math.floor(0.6 * SR)); for (const [s, f] of [[0, 3200], [0.09, 4100], [0.16, 2700]]) add(o, tone(f, 0.25, { type: 'bell', decay: 30 }), s, 0.35); for (let i = 0; i < 400; i++) o[i] += noise() * 0.3 * Math.exp(-i / 80); return o; }
function gavel() { const o = new Float32Array(Math.floor(1.2 * SR)); for (const s of [0, 0.33, 0.66]) { const k = new Float32Array(Math.floor(0.15 * SR)); for (let i = 0; i < k.length; i++) { const t = i / SR; k[i] = Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 40) + noise() * Math.exp(-t * 90) * 0.5; } add(o, k, s, 0.8); } return o; }
function clank() { const o = new Float32Array(Math.floor(1.6 * SR)); for (const f of [210, 317, 488, 911]) add(o, tone(f, 1.5, { type: 'bell', decay: 3 }), 0, 0.18); for (let i = 0; i < 1500; i++) o[i] += noise() * 0.5 * Math.exp(-i / 300); return o; }
function thud() { const n = Math.floor(0.5 * SR), o = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / SR; o[i] = Math.sin(2 * Math.PI * (60 + 40 * Math.exp(-t * 20)) * t) * Math.exp(-t * 9) + noise() * Math.exp(-t * 30) * 0.4; } return lowpass(o, 0.25); }
function sizzle(dur) { const n = Math.ceil(dur * SR), o = new Float32Array(n); let a = 0; for (let i = 0; i < n; i++) { const w = noise(); a += 0.5 * (w - a); o[i] = (w - a) * (0.6 + 0.4 * Math.sin(i / SR * 3)) * (rnd() < 0.003 ? 3 : 1) * Math.min(1, i / SR / 0.3, (n - i) / SR / 0.3); } return o; }
function chopSnd(dur) { const o = new Float32Array(Math.ceil(dur * SR)); for (let t = 0.05; t < dur; t += 0.39) { const k = new Float32Array(Math.floor(0.08 * SR)); for (let i = 0; i < k.length; i++) { const x = i / SR; k[i] = (Math.sin(2 * Math.PI * 320 * x) * 0.6 + noise() * 0.5) * Math.exp(-x * 60); } add(o, k, t, 0.8); } return o; }
function sweepSnd(dur) { const o = new Float32Array(Math.ceil(dur * SR)); for (let t = 0; t < dur; t += 0.9) { const k = new Float32Array(Math.floor(0.5 * SR)); for (let i = 0; i < k.length; i++) k[i] = noise() * Math.sin(Math.PI * i / k.length); let a = 0; for (let i = 0; i < k.length; i++) { a += 0.4 * (k[i] - a); k[i] -= a; } add(o, k, t, 0.6); } return o; }
function templeBell(dur) { const o = new Float32Array(Math.ceil(dur * SR) + SR * 2); for (let t = 0; t < dur; t += 0.55) add(o, tone(1180, 1.6, { type: 'bell', decay: 2.2 }), t, 0.2); return o; }
function knockSnd() { const o = new Float32Array(Math.floor(1.0 * SR)); for (const s of [0, 0.22, 0.44]) { const k = new Float32Array(Math.floor(0.09 * SR)); for (let i = 0; i < k.length; i++) { const x = i / SR; k[i] = Math.sin(2 * Math.PI * 140 * x) * Math.exp(-x * 45) + noise() * Math.exp(-x * 120) * 0.4; } add(o, k, s, 0.9); } return o; }
function dhol(dur) { const o = new Float32Array(Math.ceil(dur * SR)); const b = 0.25; for (let i = 0, t = 0; t < dur; i++, t += b) { add(o, drum('kick'), t, i % 4 === 0 ? 0.5 : 0.25); if (i % 2) add(o, drum('snare'), t, 0.25); add(o, drum('hat'), t + b / 2, 0.12); } return o; }
function typing(dur) { const o = new Float32Array(Math.ceil(dur * SR)); for (let t = 0; t < dur; t += 0.07 + rnd() * 0.12) { const k = new Float32Array(Math.floor(0.02 * SR)); for (let i = 0; i < k.length; i++) k[i] = noise() * Math.exp(-i / SR * 300); add(o, k, t, 0.5); } return o; }
function hitSnd() { const o = thud(); for (let i = 0; i < 600; i++) o[i] += noise() * 0.7 * Math.exp(-i / 150); return o; }
function slapSnd() { const n = Math.floor(0.25 * SR), o = new Float32Array(n); let a = 0; for (let i = 0; i < n; i++) { const w = noise(); a += 0.3 * (w - a); o[i] = (w - a) * Math.exp(-i / SR * 40) * 1.6; } return o; }
function snore(dur) { const o = new Float32Array(Math.ceil(dur * SR)); for (let t = 0; t < dur; t += 2.6) { const k = new Float32Array(Math.floor(1.2 * SR)); let ph = 0; for (let i = 0; i < k.length; i++) { const x = i / SR; ph += 2 * Math.PI * (70 + 15 * Math.sin(x * 40)) / SR; k[i] = (Math.sin(ph) * 0.6 + noise() * 0.3) * Math.sin(Math.PI * x / 1.2); } add(o, lowpass(k, 0.15), t, 0.7); } return o; }
function moo() { const n = Math.floor(1.6 * SR), o = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; const f = 120 + 40 * Math.sin(Math.min(1, t / 1.2) * Math.PI) - 25 * t; ph += 2 * Math.PI * f / SR; o[i] = (Math.sin(ph) + 0.6 * Math.sin(2 * ph) + 0.35 * Math.sin(3 * ph) + 0.2 * Math.sin(5 * ph)) * Math.sin(Math.PI * Math.min(1, t / 1.6)) * 0.6; } return lowpass(o, 0.2); }
function neigh() { const n = Math.floor(1.4 * SR), o = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; const f = 900 - 500 * t + 120 * Math.sin(t * 60) * Math.exp(-t * 1.5); ph += 2 * Math.PI * f / SR; o[i] = (Math.sin(ph) * 0.6 + Math.sin(2.01 * ph) * 0.3 + noise() * 0.15) * Math.exp(-t * 1.6) * Math.min(1, t / 0.05); } return lowpass(o, 0.4); }
function hooves(dur, run) { const o = new Float32Array(Math.ceil(dur * SR)); const gap = run ? 0.2 : 0.32; for (let t = 0, i = 0; t < dur; t += gap, i++) { const k = new Float32Array(Math.floor(0.06 * SR)); const f = i % 2 ? 420 : 520; for (let j = 0; j < k.length; j++) { const x = j / SR; k[j] = Math.sin(2 * Math.PI * f * x) * Math.exp(-x * 70) + noise() * Math.exp(-x * 150) * 0.4; } add(o, k, t, 0.8); add(o, k, t + 0.08, 0.5); } return o; }
function cycleBell() { const o = new Float32Array(Math.floor(1.2 * SR)); for (const s of [0, 0.18]) add(o, tone(2600, 0.9, { type: 'bell', decay: 4 }), s, 0.35); return o; }
function smallEngine(dur) { const n = Math.ceil(dur * SR), o = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += (28 + 10 * Math.min(1, t / 1.2)) / SR; const pulse = (ph % 1) < 0.25 ? 1 : -0.2; o[i] = (pulse * 0.6 + noise() * 0.25) * Math.min(1, t / 0.3, (dur - t) / 0.5); } return lowpass(lowpass(o, 0.12), 0.2); }
function cheer(dur) { const n = Math.ceil(dur * SR), o = new Float32Array(n); let a = 0, b = 0; for (let i = 0; i < n; i++) { const w = noise(); a += 0.08 * (w - a); b += 0.01 * (w - b); o[i] = (a - b) * 2.4 * (0.6 + 0.4 * Math.sin(i / SR * 1.3)); } for (let t = 0.5; t < dur; t += 0.8 + rnd()) add(o, tone(1400 + rnd() * 900, 0.25, { decay: 9 }), t, 0.05); return o; }
function shehnai(dur) { const o = new Float32Array(Math.ceil(dur * SR)); const scale = [0, 1, 4, 5, 7, 8, 11, 12]; const base = 62; let t = 0, k = 0;
  while (t < dur) { const step = [0, 2, 4, 5, 4, 2, 1, 0, 4, 5, 7, 5, 4, 2, 0, 0][k % 16]; const d = k % 4 === 3 ? 0.6 : 0.3; const f = mtof(base + scale[step % scale.length]); const n = Math.floor(d * SR); const s = new Float32Array(n); let ph = 0;
    for (let i = 0; i < n; i++) { const x = i / SR; ph += 2 * Math.PI * f * (1 + 0.012 * Math.sin(x * 34)) / SR; s[i] = (Math.sin(ph) + 0.5 * Math.sin(2 * ph) + 0.35 * Math.sin(3 * ph) + 0.25 * Math.sin(4 * ph)) * Math.min(1, x / 0.03, (d - x) / 0.04); }
    add(o, s, t, 0.18); t += d; k++; }
  return lowpass(o, 0.45); }
function crackle(dur) { const n = Math.ceil(dur * SR), o = new Float32Array(n); let a = 0; for (let i = 0; i < n; i++) { const w = noise(); a += 0.03 * (w - a); o[i] = a * 2.5 * (0.7 + 0.3 * Math.sin(i / SR * 2)); if (rnd() < 0.0009) for (let j = 0; j < 200 && i + j < n; j++) o[i + j] += noise() * Math.exp(-j / 40) * 0.8; } for (let i = 0; i < n; i++) o[i] *= Math.min(1, i / SR / 1.0, (n - i) / SR / 1.0); return o; }
function boom() { const n = Math.floor(3.5 * SR), o = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / SR; o[i] = Math.sin(2 * Math.PI * (40 + 60 * Math.exp(-t * 6)) * t) * Math.exp(-t * 1.6) * 1.2 + noise() * Math.exp(-t * 2.2) * (t < 0.05 ? 1.5 : 0.8); } return lowpass(lowpass(o, 0.15), 0.3); }
function trainSnd(dur, horn) { const n = Math.ceil(dur * SR), o = new Float32Array(n); for (let t = 0; t < dur; t += 0.42) { add(o, step(1.4), t, 0.7); add(o, step(1.2), t + 0.12, 0.6); } let a = 0; for (let i = 0; i < n; i++) { a += 0.02 * (noise() - a); o[i] += a * 3; }
  if (horn) { const h = new Float32Array(Math.floor(1.8 * SR)); for (let i = 0; i < h.length; i++) { const t = i / SR; h[i] = (Math.sin(2 * Math.PI * 311 * t) + Math.sin(2 * Math.PI * 370 * t) + 0.5 * Math.sin(2 * Math.PI * 466 * t)) * Math.min(1, t / 0.08, (1.8 - t) / 0.3) * 0.3; } add(o, h, 0.2, 1); }
  for (let i = 0; i < n; i++) o[i] *= Math.min(1, i / SR / 0.8, (n - i) / SR / 0.8); return o; }
function paddle(dur) { const o = new Float32Array(Math.ceil(dur * SR)); for (let t = 0.3; t < dur; t += 1.05) { const k = new Float32Array(Math.floor(0.4 * SR)); let a = 0; for (let i = 0; i < k.length; i++) { a += 0.15 * (noise() - a); k[i] = a * Math.sin(Math.PI * i / k.length) * 2; } add(o, k, t, 0.7); } return o; }
function swimSnd(dur) { const o = new Float32Array(Math.ceil(dur * SR)); for (let t = 0; t < dur; t += 0.42) { const k = new Float32Array(Math.floor(0.25 * SR)); let a = 0; for (let i = 0; i < k.length; i++) { a += 0.3 * (noise() - a); k[i] = (noise() - a) * Math.exp(-i / SR * 14); } add(o, k, t, 0.6); } return o; }
function batHit() { const o = new Float32Array(Math.floor(0.3 * SR)); for (let i = 0; i < o.length; i++) { const t = i / SR; o[i] = (Math.sin(2 * Math.PI * 900 * t) * 0.6 + Math.sin(2 * Math.PI * 1500 * t) * 0.3 + noise() * 0.3) * Math.exp(-t * 35); } return o; }
function bleat() { const n = Math.floor(0.9 * SR), o = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += 2 * Math.PI * (430 + 30 * Math.sin(t * 50)) / SR; o[i] = (Math.sin(ph) + 0.5 * Math.sin(2 * ph) + 0.3 * Math.sin(3 * ph)) * Math.sin(Math.PI * t / 0.9) * 0.5; } return lowpass(o, 0.4); }
function meow() { const n = Math.floor(0.7 * SR), o = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += 2 * Math.PI * (600 + 300 * Math.sin(Math.PI * t / 0.7)) / SR; o[i] = (Math.sin(ph) + 0.4 * Math.sin(2 * ph)) * Math.sin(Math.PI * t / 0.7) * 0.5; } return o; }
function trumpet() { const n = Math.floor(1.6 * SR), o = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += 2 * Math.PI * (520 + 80 * Math.sin(t * 7)) / SR; const saw = (ph / (2 * Math.PI)) % 1 * 2 - 1; o[i] = (saw * 0.6 + noise() * 0.2) * Math.min(1, t / 0.1, (1.6 - t) / 0.4); } return lowpass(o, 0.35); }
function heli(dur) { const n = Math.ceil(dur * SR), o = new Float32Array(n); let a = 0; for (let i = 0; i < n; i++) { const t = i / SR; a += 0.05 * (noise() - a); const wop = Math.pow(Math.max(0, Math.sin(2 * Math.PI * 11 * t)), 6); o[i] = a * 3 * (0.3 + wop) * Math.min(1, t / 0.6, (dur - t) / 0.8); } return lowpass(o, 0.3); }
function jet(dur) { const n = Math.ceil(dur * SR), o = new Float32Array(n); let a = 0, b = 0; for (let i = 0; i < n; i++) { const t = i / SR; const w = noise(); a += 0.08 * (w - a); b += 0.01 * (w - b); o[i] = (a - b) * 3 * Math.sin(Math.PI * t / dur) ** 2; } return o; }
function popWhistle() { const o = new Float32Array(Math.floor(1.6 * SR)); let ph = 0; for (let i = 0; i < 0.6 * SR; i++) { const t = i / SR; ph += 2 * Math.PI * (1800 + 1600 * t) / SR; o[i] = Math.sin(ph) * 0.15 * Math.min(1, t / 0.05); } const pop = boom(); for (let i = 0; i < Math.min(pop.length, o.length - 0.6 * SR); i++) o[Math.floor(0.6 * SR) + i] += pop[i] * 0.35; for (let i = Math.floor(0.7 * SR); i < o.length; i++) if (rnd() < 0.004) o[i] += noise() * 0.6; return o; }
function hiss(dur) { const n = Math.ceil(dur * SR), o = new Float32Array(n); let a = 0; for (let i = 0; i < n; i++) { const w = noise(); a += 0.6 * (w - a); o[i] = (w - a) * 0.8 * Math.min(1, i / SR / 0.2, (n - i) / SR / 0.4) + (rnd() < 0.002 ? noise() : 0); } return o; }
function bdaySong(dur) { const o = new Float32Array(Math.ceil(dur * SR)); const N = [[67, 0.75], [67, 0.25], [69, 1], [67, 1], [72, 1], [71, 2], [67, 0.75], [67, 0.25], [69, 1], [67, 1], [74, 1], [72, 2], [67, 0.75], [67, 0.25], [79, 1], [76, 1], [72, 1], [71, 1], [69, 2], [77, 0.75], [77, 0.25], [76, 1], [72, 1], [74, 1], [72, 2]];
  const beat = 0.42; let t = 0.3; while (t < dur - 1) { for (const [m, d] of N) { if (t > dur - 0.5) break; add(o, tone(mtof(m), d * beat + 0.2, { type: 'bell', decay: 2.5 }), t, 0.16); add(o, tone(mtof(m - 12), d * beat, { decay: 3 }), t, 0.05); t += d * beat; } t += 1.2; } return o; }
function chatter() { const o = new Float32Array(Math.floor(1.0 * SR)); for (let s = 0; s < 0.9; s += 0.11) add(o, tone(900 + rnd() * 700, 0.08, { type: 'saw', decay: 30, detune: 0.05 }), s, 0.25); return lowpass(o, 0.5); }
function roar() { const n = Math.floor(2.0 * SR), o = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += 2 * Math.PI * (90 + 40 * Math.sin(Math.PI * t / 2)) / SR; const saw = ((ph / (2 * Math.PI)) % 1) * 2 - 1; o[i] = (saw * 0.6 + noise() * 0.5) * Math.sin(Math.PI * Math.min(1, t / 2)) ; } return lowpass(lowpass(o, 0.12), 0.25); }
function garbaMusic(dur) { const o = new Float32Array(Math.ceil(dur * SR)); const b = 0.18; for (let i = 0, t = 0; t < dur; i++, t += b) { const pos = i % 6; if (pos === 0 || pos === 3) add(o, drum('kick'), t, 0.5); if (pos === 2 || pos === 5) add(o, drum('snare'), t, 0.25); add(o, drum('hat'), t, 0.1); if (pos === 0) add(o, tone(mtof(74 + [0, 2, 4, 2][Math.floor(i / 6) % 4]), 0.6, { type: 'bell', decay: 3 }), t, 0.08); if (pos === 3) add(o, tone(2400, 0.1, { decay: 30 }), t, 0.1); } return o; }
function jingle(dur) { const o = new Float32Array(Math.ceil(dur * SR)); const N = [[64, 1], [64, 1], [64, 2], [64, 1], [64, 1], [64, 2], [64, 1], [67, 1], [60, 1.5], [62, 0.5], [64, 4], [65, 1], [65, 1], [65, 1.5], [65, 0.5], [65, 1], [64, 1], [64, 1], [64, 0.5], [64, 0.5], [64, 1], [62, 1], [62, 1], [64, 1], [62, 2], [67, 2]]; const beat = 0.3; let t = 0.2;
  while (t < dur - 1) { for (const [m, d] of N) { if (t > dur - 0.5) break; add(o, tone(mtof(m + 12), d * beat + 0.3, { type: 'bell', decay: 2 }), t, 0.13); t += d * beat; } t += 0.8; } for (let x = 0; x < dur; x += 0.3) add(o, tone(5200, 0.12, { decay: 25 }), x, 0.03); return o; }
function hum(dur) { const n = Math.ceil(dur * SR), o = new Float32Array(n); let a = 0; for (let i = 0; i < n; i++) { a += 0.02 * (noise() - a); o[i] = (a * 3 + Math.sin(2 * Math.PI * 110 * i / SR) * 0.05) * Math.min(1, i / SR / 1, (n - i) / SR / 1); } return o; }
function bubbles(dur) { const o = new Float32Array(Math.ceil(dur * SR)); for (let t = 0; t < dur; t += 0.15 + rnd() * 0.4) { let ph = 0; const k = new Float32Array(Math.floor(0.06 * SR)); const f0 = 400 + rnd() * 700; for (let i = 0; i < k.length; i++) { ph += 2 * Math.PI * f0 * (1 + i / k.length) / SR; k[i] = Math.sin(ph) * Math.exp(-i / k.length * 4); } add(o, k, t, 0.25); } const lo = new Float32Array(o.length); let a = 0; for (let i = 0; i < lo.length; i++) { a += 0.005 * (noise() - a); lo[i] = a * 4; } for (let i = 0; i < o.length; i++) o[i] += lo[i]; return o; }
function sting() { const o = new Float32Array(Math.floor(3 * SR)); for (const m of [50, 57, 62, 66]) add(o, tone(mtof(m), 3, { type: 'bell', decay: 1.1 }), 0, 0.15); return o; }

export function mixAll(tl, mood, outFile) {
  const dur = tl.duration, n = Math.ceil(dur * SR), mix = new Float32Array(n);
  // dialogue + duck curve
  const duck = new Float32Array(n).fill(1);
  for (const l of tl.lines) {
    const w = readWav(l.file); const ratio = w.rate / SR; const s = new Float32Array(Math.floor(w.samples.length / ratio));
    for (let i = 0; i < s.length; i++) s[i] = w.samples[Math.floor(i * ratio)];
    add(mix, s, l.start, 0.95);
    const a = Math.floor((l.start - 0.25) * SR), b = Math.floor((l.end + 0.35) * SR);
    for (let i = Math.max(0, a); i < Math.min(n, b); i++) duck[i] = 0.32;
  }
  lowpass(duck, 0.0004);
  const music = makeMusic(mood, dur);
  for (let i = 0; i < n; i++) { const t = i / SR; const fade = Math.min(1, t / 1.5, (dur - t) / 2.5); mix[i] += music[i] * duck[i] * fade * 0.8; }
  // ambience per scene
  for (const sc of tl.scenes) {
    const d = sc.end - sc.start + 0.6; const fade = (x) => { for (let i = 0; i < x.length; i++) { const tt = i / SR; x[i] *= Math.min(1, tt / 0.6, (x.length / SR - tt) / 0.6); } return x; };
    if (sc.weather === 'rain' || sc.weather === 'storm') add(mix, fade(rainLoop(d, sc.weather === 'storm')), sc.start - 0.3, sc.weather === 'storm' ? 0.22 : 0.16);
    if (sc.weather === 'underwater') add(mix, fade(bubbles(d)), sc.start - 0.3, 0.3);
    if (['wind', 'storm', 'fog', 'snow'].includes(sc.weather)) add(mix, fade(windLoop(d)), sc.start - 0.3, sc.weather === 'fog' ? 0.08 : 0.12);
    for (const e of sc.events || []) if (e.kind === 'gesture' && e.name === 'shock' && /horror|thriller|crime|mystery/.test(mood)) add(mix, heartbeat(), e.t0, 0.5);
    for (const e of sc.events || []) if (e.kind === 'gesture' && e.name === 'gavel') add(mix, gavel(), e.t0 + 0.25, 0.7);
    for (const e of sc.events || []) { if (e.kind !== 'gesture') continue; const d = e.t1 - e.t0;
      if (e.name === 'cook') add(mix, sizzle(d), e.t0, 0.12); if (e.name === 'chop') add(mix, chopSnd(d), e.t0, 0.35); if (e.name === 'sweep') add(mix, sweepSnd(d), e.t0, 0.18);
      if (e.name === 'aarti') add(mix, templeBell(d), e.t0, 0.5); if (e.name === 'knock') add(mix, knockSnd(), e.t0 + 0.2, 0.7); if (e.name === 'dance') add(mix, dhol(d), e.t0, 0.5); if (e.name === 'type') add(mix, typing(d), e.t0, 0.25); }
    if (tl.backgrounds?.[sc.background]?.seats?.some((m) => m.type === 'cell')) add(mix, clank(), sc.start + 0.3, 0.4);
  }
  for (const c of tl.cues) if (c.kind === 'thunder') add(mix, thunder(), c.t, 0.55);
  for (const sc of tl.scenes) { const place = tl.backgrounds?.[sc.background]?.place; const a = place ? stageAmbience(PLACE_AMB[place] || 'street', sc.time_of_day === 'night', sc.end - sc.start + 0.6) : ambience(sc.location, sc.time_of_day, sc.end - sc.start + 0.6); for (let i = 0; i < a.length; i++) { const t = i / SR; a[i] *= 0.18 * Math.min(1, t / 0.6, (a.length / SR - t) / 0.6); } add(mix, a, sc.start - 0.3); }
  // effects
  add(mix, sting(), 0.2, 0.9);
  for (const c of tl.cues) {
    if (c.kind === 'scene' && c.t > 4) add(mix, whoosh(), c.t - 0.5, 0.25);
    if (c.kind === 'door' && c.location !== 'street' && c.location !== 'park' && c.location !== 'forest' && c.location !== 'alley') add(mix, door(), c.t, 0.6);
    if (c.kind === 'walk' || c.kind === 'run') { const gap = c.kind === 'run' ? 0.3 : 0.52; for (let t = c.t; t < c.t1; t += gap) add(mix, step(), t, c.kind === 'run' ? 0.45 : 0.32); }
    if (c.kind === 'siren') add(mix, siren(c.t1 - c.t, c.amb), c.t, 0.13);
    if (c.kind === 'engine') add(mix, engine(c.t1 - c.t), c.t, 0.3);
    if (c.kind === 'chase_car') { const d = c.t1 - c.t; add(mix, engine(d + 0.4, 1.6), c.t, 0.38); add(mix, engine(d + 0.4, 1.3), c.t + 0.2, 0.25); if (c.police) add(mix, siren(d + 0.3), c.t, 0.16); }
    if (c.kind === 'chase_foot') for (let t = c.t; t < c.t1; t += 0.16) add(mix, step(), t, 0.4);
    if (c.kind === 'screech') add(mix, screech(), c.t, 0.32);
    if (c.kind === 'brake') add(mix, brake(), c.t, 0.3);
    if (c.kind === 'car_door') add(mix, carDoor(false), c.t, 0.5);
    if (c.kind === 'car_door_close') add(mix, carDoor(true), c.t, 0.7);
    if (c.kind === 'cuff') add(mix, metalClick(), c.t, 0.8);
    if (c.kind === 'gavel') add(mix, gavel(), c.t, 0.7);
    if (c.kind === 'clank') add(mix, clank(), c.t, 0.5);
    if (c.kind === 'grab' || c.kind === 'fall') add(mix, thud(), c.t, 0.6);
    if (c.kind === 'hit') add(mix, hitSnd(), c.t, 0.55);
    if (c.kind === 'garba') add(mix, garbaMusic(c.t1 - c.t), c.t, 0.55); if (c.kind === 'jingle') add(mix, jingle(c.t1 - c.t), c.t, 0.8); if (c.kind === 'ride') add(mix, c.vkind === 'plane' ? hum(c.t1 - c.t) : trainSnd(c.t1 - c.t, false), c.t, c.vkind === 'plane' ? 0.3 : 0.2); if (c.kind === 'eidcheer') add(mix, cheer(c.t1 - c.t), c.t, 0.08);
    if (c.kind === 'heli') add(mix, heli(c.t1 - c.t), c.t, 0.45); if (c.kind === 'jet') add(mix, jet(c.t1 - c.t), c.t, 0.4);
    if (c.kind === 'holi') { const d = c.t1 - c.t; add(mix, dhol(d), c.t, 0.4); add(mix, cheer(d), c.t, 0.12); }
    if (c.kind === 'diwali') for (let x = c.t + 0.4; x < c.t1 - 1; x += 1.3) add(mix, popWhistle(), x, 0.3);
    if (c.kind === 'anaar') add(mix, hiss(c.t1 - c.t), c.t, 0.35); if (c.kind === 'bang') add(mix, boom(), c.t, 0.6); if (c.kind === 'bday') { add(mix, bdaySong(c.t1 - c.t), c.t, 1.0); add(mix, cheer(c.t1 - c.t), c.t, 0.06); }
    if (c.kind === 'kick') add(mix, thud(), c.t, 0.5); if (c.kind === 'chatter') add(mix, chatter(), c.t, 0.5); if (c.kind === 'roar') add(mix, roar(), c.t, 0.7);
    if (c.kind === 'fire') add(mix, crackle((c.t1 || c.t + 5) - c.t), c.t, 0.3); if (c.kind === 'boom') add(mix, boom(), c.t, 1.0);
    if (c.kind === 'train') add(mix, trainSnd(c.t1 - c.t, c.horn), c.t, 0.45); if (c.kind === 'paddle') add(mix, paddle(c.t1 - c.t), c.t, 0.35); if (c.kind === 'swim') add(mix, swimSnd(c.t1 - c.t), c.t, 0.35);
    if (c.kind === 'bat') add(mix, batHit(), c.t, 0.7); if (c.kind === 'kids') add(mix, cheer(c.t1 - c.t), c.t, 0.08); if (c.kind === 'chirps') add(mix, birds(c.t1 - c.t), c.t, 1.4);
    if (c.kind === 'bleat') add(mix, bleat(), c.t, 0.5); if (c.kind === 'meow') add(mix, meow(), c.t, 0.4); if (c.kind === 'trumpet') add(mix, trumpet(), c.t, 0.5);
    if (c.kind === 'moo') add(mix, moo(), c.t, 0.6); if (c.kind === 'neigh') add(mix, neigh(), c.t, 0.5); if (c.kind === 'bark') add(mix, bark(), c.t, 0.55);
    if (c.kind === 'hooves') add(mix, hooves(c.t1 - c.t, c.run), c.t, 0.3); if (c.kind === 'bell') add(mix, cycleBell(), c.t + 0.2, 0.6); if (c.kind === 'engine_small') add(mix, smallEngine(c.t1 - c.t), c.t, 0.3);
    if (c.kind === 'baraat') { const d = c.t1 - c.t; add(mix, dhol(d), c.t, 0.55); add(mix, shehnai(d), c.t, 0.5); add(mix, cheer(d), c.t, 0.12); }
    if (c.kind === 'slap') add(mix, slapSnd(), c.t, 0.8);
    if (c.kind === 'heartbeat') for (let x = c.t; x < c.t1; x += 0.85) { add(mix, thud(), x, 0.45); add(mix, thud(), x + 0.22, 0.3); }
    if (c.kind === 'dreamhum') { const d = c.t1 - c.t, n = Math.floor(d * SR), o = new Float32Array(n); for (let i = 0; i < n; i++) { const tt = i / SR; o[i] = (Math.sin(2 * Math.PI * 110 * tt) * 0.5 + Math.sin(2 * Math.PI * 164.8 * tt) * 0.3 + Math.sin(2 * Math.PI * 220.5 * tt) * 0.2) * Math.min(1, tt / 0.8, (d - tt) / 0.8) * 0.35; } add(mix, o, c.t, 0.5); }
    if (c.kind === 'whoosh2') add(mix, whoosh(), c.t, 0.5);
    if (c.kind === 'swish') { const o = new Float32Array(Math.floor(0.35 * SR)); let f = 0; for (let i = 0; i < o.length; i++) { f += 0.3 * (noise() - f); o[i] = f * Math.sin(Math.PI * i / o.length) ** 2; } add(mix, o, c.t, 0.5); }
    if (c.kind === 'cheer' && c.angry) add(mix, cheer(c.t1 - c.t), c.t, 0.22);
    if (c.kind === 'snore') add(mix, snore(c.t1 - c.t), c.t, 0.35);
    if (c.kind === 'sit' || c.kind === 'stand') { const s = new Float32Array(Math.floor(0.3 * SR)); for (let i = 0; i < s.length; i++) s[i] = noise() * Math.sin(Math.PI * i / s.length); add(mix, lowpass(s, 0.1), c.t + 0.3, 0.25); }
  }
  let m = 1e-6; for (const v of mix) m = Math.max(m, Math.abs(v)); const g = Math.min(1, 0.9 / m); for (let i = 0; i < n; i++) mix[i] *= g;
  writeWav(outFile, [mix], SR);
}
