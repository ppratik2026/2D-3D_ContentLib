// Minimal WAV (PCM 16-bit) read/write helpers.
import fs from 'fs';

export function readWav(file) {
  const b = fs.readFileSync(file);
  let p = 12, fmt = null, data = null;
  while (p + 8 <= b.length) {
    const id = b.toString('ascii', p, p + 4), size = b.readUInt32LE(p + 4);
    if (id === 'fmt ') fmt = { channels: b.readUInt16LE(p + 10), rate: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
    if (id === 'data') { data = b.subarray(p + 8, p + 8 + size); break; }
    p += 8 + size + (size % 2);
  }
  if (!fmt || !data || fmt.bits !== 16) throw new Error('Unsupported WAV: ' + file);
  const n = Math.floor(data.length / 2 / fmt.channels), out = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let c = 0; c < fmt.channels; c++) s += data.readInt16LE((i * fmt.channels + c) * 2); out[i] = s / fmt.channels / 32768; }
  return { rate: fmt.rate, samples: out, duration: n / fmt.rate };
}

export function writeWav(file, channels, rate) {
  // channels: array of Float32Array (1 = mono, 2 = stereo)
  const n = channels[0].length, ch = channels.length, buf = Buffer.alloc(44 + n * ch * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * ch * 2, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(ch, 22); buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * ch * 2, 28); buf.writeUInt16LE(ch * 2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * ch * 2, 40);
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, channels[c][i])); buf.writeInt16LE(Math.round(v * 32767), o); o += 2; }
  fs.writeFileSync(file, buf);
}

// RMS envelope per video frame, normalised to 0..1 (used for lip-sync)
export function envelope(samples, rate, fps) {
  const hop = rate / fps, n = Math.ceil(samples.length / hop), env = new Array(n);
  let max = 1e-6;
  for (let f = 0; f < n; f++) { const a = Math.floor(f * hop), b = Math.min(samples.length, Math.floor((f + 1) * hop)); let s = 0; for (let i = a; i < b; i++) s += samples[i] * samples[i]; env[f] = Math.sqrt(s / Math.max(1, b - a)); max = Math.max(max, env[f]); }
  return env.map((v) => Math.round(Math.min(1, Math.pow(v / max, 0.7) * 1.15) * 100) / 100);
}
