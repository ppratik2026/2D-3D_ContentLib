// Kokoro-82M (Apache-2.0) Hindi voices on the CPU with onnxruntime-node.
// Hindi phonemes come from Piper's bundled eSpeak (Piper --debug logs the IPA for every sentence), so no extra program is needed.
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import ort from 'onnxruntime-node';

export const KOKORO_FILES = ['model_quantized.onnx', 'tokenizer.json', 'hf_alpha.bin', 'hf_beta.bin', 'hm_omega.bin', 'hm_psi.bin'];
let K = null;
export async function loadKokoro(dir) {
  if (K && K.dir === dir) return K;
  const session = await ort.InferenceSession.create(path.join(dir, 'model_quantized.onnx'), { intraOpNumThreads: Math.max(1, Math.min(4, os.cpus().length - 1)) });
  const vocab = JSON.parse(fs.readFileSync(path.join(dir, 'tokenizer.json'), 'utf8')).model.vocab;
  const voices = {};
  for (const v of ['hf_alpha', 'hf_beta', 'hm_omega', 'hm_psi']) { const b = fs.readFileSync(path.join(dir, v + '.bin')); voices[v] = new Float32Array(b.buffer, b.byteOffset, b.length / 4); }
  K = { dir, session, vocab, voices }; return K;
}

// texts → IPA strings, using Piper's eSpeak (one Piper run for all lines)
export function phonemesViaPiper(piperBin, piperModel, texts) {
  return new Promise((ok, fail) => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'avk-'));
    const p = spawn(piperBin, ['-m', piperModel, '--json-input', '--debug'], { cwd: path.dirname(piperBin) });
    const out = texts.map(() => []); let cur = -1, buf = '';
    const onLine = (ln) => {
      let m = ln.match(/Phonemizing text: (.*)$/); if (m) { cur++; return; }
      m = ln.match(/Converting \d+ phoneme\(s\) to ids: (.*)$/); if (m && cur >= 0 && cur < out.length) out[cur].push(m[1]);
    };
    p.stderr.on('data', (d) => { buf += d; const lines = buf.split(/\r?\n/); buf = lines.pop(); lines.forEach(onLine); });
    p.stdout.on('data', (d) => { buf += d; const lines = buf.split(/\r?\n/); buf = lines.pop(); lines.forEach(onLine); });
    p.on('error', fail);
    p.on('close', () => { if (buf) onLine(buf); fs.rmSync(tmp, { recursive: true, force: true }); ok(out.map((a) => a.join(' '))); });
    texts.forEach((t, i) => p.stdin.write(JSON.stringify({ text: t, output_file: path.join(tmp, `p${i}.wav`) }) + '\n'));
    p.stdin.end();
  });
}

// IPA → 24 kHz float samples
export async function synthKokoro(k, ipa, voice, speed = 1) {
  const ids = [...ipa].map((c) => k.vocab[c]).filter((n) => n !== undefined);
  const vv = k.voices[voice] || k.voices.hm_omega; const out = [];
  // split into chunks of ≤ 500 tokens at spaces
  const chunks = []; let s = 0; while (s < ids.length) { let e = Math.min(ids.length, s + 500); if (e < ids.length) { const sp = ids.lastIndexOf(k.vocab[' '], e); if (sp > s + 50) e = sp; } chunks.push(ids.slice(s, e)); s = e; }
  for (const ch of chunks) {
    const n = Math.min(ch.length, 509); const style = vv.slice(n * 256, n * 256 + 256);
    const input = new BigInt64Array(n + 2); for (let i = 0; i < n; i++) input[i + 1] = BigInt(ch[i]);
    const r = await k.session.run({ input_ids: new ort.Tensor('int64', input, [1, n + 2]), style: new ort.Tensor('float32', style, [1, 256]), speed: new ort.Tensor('float32', new Float32Array([speed]), [1]) });
    out.push(r.waveform.data);
  }
  const len = out.reduce((a, b) => a + b.length, 0); const all = new Float32Array(len); let o = 0; for (const a of out) { all.set(a, o); o += a.length; }
  return all;
}
