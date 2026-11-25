// Local web app: open http://localhost:3000, choose category/style/minutes → see estimate → make the video.
import http from 'http';
import fs from 'fs';
import path from 'path';
import { ROOT, OUTPUT } from '../pipeline/paths.mjs';
import { CATEGORIES, STYLES, LOOKS, SUBTITLE_STYLES } from '../pipeline/config.mjs';
import { estimate, fmt } from '../pipeline/estimate.mjs';
import { makeVideo, loadEnv } from '../pipeline/run.mjs';

loadEnv();
const PORT = Number(process.env.PORT) || 3000;
const jobs = {}; let running = null; const queue = [];

function send(res, code, body, type = 'application/json') { res.writeHead(code, { 'Content-Type': type }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); }
const readBody = (req) => new Promise((ok) => { let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => { try { ok(JSON.parse(b || '{}')); } catch { ok({}); } }); });

async function next() {
  if (running || !queue.length) return; const job = queue.shift(); running = job; job.status = 'running';
  try { const r = await makeVideo({ ...job.opts, id: job.id }, (e) => { job.log.push(`[${fmt(e.elapsed)}] ${e.msg}`); if (job.log.length > 400) job.log.shift(); Object.assign(job, { step: e.step, msg: e.msg, elapsed: e.elapsed, progress: e.progress ?? job.progress, eta: e.eta ?? job.eta }); if (e.estimate) job.estimate = e.estimate; });
    Object.assign(job, { status: 'done', file: `/output/${job.id}/final.mp4`, srt: `/output/${job.id}/subtitles.srt`, title: r.story.title }); }
  catch (e) { Object.assign(job, { status: 'error', error: e.message }); console.error(e); }
  running = null; next();
}

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/') return send(res, 200, fs.readFileSync(path.join(ROOT, 'server', 'index.html')), 'text/html; charset=utf-8');
  if (u.pathname === '/api/options') return send(res, 200, { categories: CATEGORIES, styles: STYLES, looks: LOOKS, subs: SUBTITLE_STYLES, hasKey: !!process.env.GEMINI_API_KEY });
  if (u.pathname === '/api/estimate') { const e = estimate({ style: u.searchParams.get('style'), minutes: Number(u.searchParams.get('minutes')) || 1 }); return send(res, 200, { ...e, totalText: fmt(e.total), partsText: Object.fromEntries(Object.entries(e.parts).map(([k, v]) => [k, fmt(v)])) }); }
  if (u.pathname === '/api/make' && req.method === 'POST') { const opts = await readBody(req); const id = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '_' + (opts.category || 'video');
    jobs[id] = { id, opts, status: 'queued', log: [], progress: 0 }; queue.push(jobs[id]); next(); return send(res, 200, { id }); }
  if (u.pathname.startsWith('/api/job/')) { const j = jobs[u.pathname.split('/').pop()]; return j ? send(res, 200, { ...j, opts: undefined, log: j.log.slice(-30) }) : send(res, 404, { error: 'no job' }); }
  if (u.pathname === '/api/jobs') return send(res, 200, Object.values(jobs).map((j) => ({ id: j.id, status: j.status, title: j.title, file: j.file })));
  if (u.pathname.startsWith('/output/')) { const f = path.join(OUTPUT, decodeURIComponent(u.pathname.slice(8))); if (!f.startsWith(OUTPUT) || !fs.existsSync(f)) return send(res, 404, 'not found', 'text/plain');
    const type = f.endsWith('.mp4') ? 'video/mp4' : f.endsWith('.srt') ? 'text/plain; charset=utf-8' : 'application/json'; res.writeHead(200, { 'Content-Type': type, 'Content-Length': fs.statSync(f).size }); return fs.createReadStream(f).pipe(res); }
  send(res, 404, 'not found', 'text/plain');
}).listen(PORT, () => console.log(`\n  Auto Video is running →  http://localhost:${PORT}\n`));
