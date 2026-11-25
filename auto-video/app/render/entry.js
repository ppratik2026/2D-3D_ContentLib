// Chrome renderer page (runs in a hidden Electron window): Three.js engine → Canvas 2D overlays → WebCodecs H.264 → MP4 chunks to disk.
import { Muxer, StreamTarget } from 'mp4-muxer';
import { createEngine } from '../../remotion/engine/index.js';
import { makeComposer } from './compose.js';

const W = 1280, H = 720, FPS = 30;
const url = (rel) => 'av://data/' + rel.split('/').map(encodeURIComponent).join('/');

async function run(job) {
  const { tl } = job; const t0 = performance.now();
  const gl = document.getElementById('gl'), out = document.getElementById('out'); const ctx = out.getContext('2d');
  const eng = await createEngine({ canvas: gl, width: W, height: H, tl, url });
  const compose = makeComposer(W, H);
  const codec = ['avc1.640028', 'avc1.4d0028', 'avc1.42002a'];
  let cfg = null; for (const c of codec) { const test = { codec: c, width: W, height: H, bitrate: 6_000_000, framerate: FPS, latencyMode: 'quality', avc: { format: 'avc' } }; if ((await VideoEncoder.isConfigSupported(test)).supported) { cfg = test; break; } }
  if (!cfg) throw new Error('This PC cannot encode H.264 with WebCodecs. Use the Remotion renderer in Settings.');
  let pending = Promise.resolve();
  const muxer = new Muxer({ target: new StreamTarget({ onData: (data, position) => { const copy = data.slice(); pending = pending.then(() => window.av.chunk(position, copy)); } }), video: { codec: 'avc', width: W, height: H, frameRate: FPS }, fastStart: false, firstTimestampBehavior: 'offset' });
  let encErr = null;
  const enc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => (encErr = e) });
  enc.configure(cfg);
  const N = tl.durationInFrames;
  for (let f = 0; f < N; f++) {
    if (encErr) throw encErr;
    const t = f / FPS; eng.renderAt(t); compose(ctx, gl, tl, t, f);
    const vf = new VideoFrame(out, { timestamp: Math.round((f * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
    enc.encode(vf, { keyFrame: f % (FPS * 2) === 0 }); vf.close();
    while (enc.encodeQueueSize > 4) await new Promise((ok) => enc.addEventListener('dequeue', ok, { once: true }));
    if (f % 15 === 0) { window.av.progress(f, N, (performance.now() - t0) / 1000); await new Promise((ok) => setTimeout(ok, 0)); }
  }
  await enc.flush(); muxer.finalize(); await pending;
  window.av.done({ frames: N, seconds: (performance.now() - t0) / 1000 });
}
window.av.onJob((job) => run(job).catch((e) => window.av.fail(String(e && e.stack || e))));
window.av.ready();
