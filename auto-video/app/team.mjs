// Team server (Supabase): licence keys (1 key = 1 PC), remote log-out, and shared data packs
// (backgrounds, custom characters, shared files) that the admin publishes and every PC downloads.
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

export const BUCKET = 'avs-data';
export const GRACE_H = 72; // hours the app keeps working offline after the last successful check

// ---------- server code: "AVS1:" + base64(url|publicKey) — the admin shares it with the team ----------
export function encodeServer(url, key) { return 'AVS1:' + Buffer.from(`${String(url).trim().replace(/\/+$/, '')}|${String(key).trim()}`).toString('base64'); }
export function decodeServer(code) {
  const s = String(code || '').trim(); if (!s.startsWith('AVS1:')) throw new Error('This is not a team server code (it starts with AVS1:).');
  const [url, key] = Buffer.from(s.slice(5), 'base64').toString('utf8').split('|');
  if (!/^https?:\/\//.test(url || '') || !key) throw new Error('The team server code is damaged. Copy it again.'); return { url, key };
}

// ---------- this PC ----------
export function deviceInfo() {
  const nets = Object.values(os.networkInterfaces()).flat().filter((n) => n && !n.internal && n.mac && n.mac !== '00:00:00:00:00:00').map((n) => n.mac).sort();
  const raw = [os.hostname(), os.cpus()[0]?.model || '', os.totalmem(), os.platform(), nets[0] || ''].join('|');
  return { id: crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32), name: `${os.hostname()} (${os.userInfo().username})` };
}
export const hashKey = (k) => crypto.createHash('sha256').update(String(k).trim().toUpperCase()).digest('hex');
export function newKey() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const part = () => Array.from(crypto.randomBytes(4), (b) => A[b % A.length]).join(''); return `AVS-${part()}-${part()}-${part()}`; }

// ---------- HTTP ----------
function headers(key, extra = {}) { const h = { apikey: key, ...extra }; if (!String(key).startsWith('sb_')) h.Authorization = `Bearer ${key}`; return h; }
async function req(url, opt = {}, timeout = 20000) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), timeout);
  try { const r = await fetch(url, { ...opt, signal: ac.signal }); const txt = await r.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch {}
    if (!r.ok) { const e = new Error((j && (j.message || j.error || j.msg)) || txt.slice(0, 200) || `HTTP ${r.status}`); e.status = r.status; throw e; } return j; }
  catch (e) { if (e.name === 'AbortError') { const x = new Error('The team server did not answer (internet?).'); x.offline = true; throw x; } if (e.status) throw e; const x = new Error('Cannot reach the team server (internet?): ' + e.message); x.offline = true; throw x; }
  finally { clearTimeout(t); }
}
export const rpc = (srv, fn, args) => req(`${srv.url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: headers(srv.key, { 'Content-Type': 'application/json' }), body: JSON.stringify(args) });

// ---------- licence ----------
export const REASONS = { invalid: 'This licence key is not valid.', blocked: 'This licence key has been blocked by the admin.', other_device: 'This key is already used on another PC', no_device: 'Could not identify this PC.', not_allowed: 'Not allowed.' };
export async function checkLicense(srv, key, version) {
  const d = deviceInfo(); const r = await rpc(srv, 'avs_check', { p_key: key, p_device: d.id, p_device_name: d.name, p_version: version });
  if (!r || !r.ok) { const e = new Error((REASONS[r?.reason] || 'Licence check failed.') + (r?.device_name ? ` (${r.device_name}). Ask the admin to reset it.` : '')); e.reason = r?.reason || 'error'; throw e; }
  return r;
}

// ---------- admin (secret / service_role key, admin PC only) ----------
const adm = (srv, admKey) => ({ url: srv.url, key: admKey });
export async function adminList(srv, admKey) { const a = adm(srv, admKey); return req(`${a.url}/rest/v1/avs_licenses?select=*&order=id.asc`, { headers: headers(a.key) }); }
export async function adminCreate(srv, admKey, name) { const a = adm(srv, admKey); const key = newKey();
  await req(`${a.url}/rest/v1/avs_licenses`, { method: 'POST', headers: headers(a.key, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify({ key_hash: hashKey(key), key_hint: key.slice(-4), name: String(name || '').slice(0, 60) }) }); return key; }
export async function adminPatch(srv, admKey, id, patch) { const a = adm(srv, admKey); return req(`${a.url}/rest/v1/avs_licenses?id=eq.${Number(id)}`, { method: 'PATCH', headers: headers(a.key, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify(patch) }); }
export async function adminDelete(srv, admKey, id) { const a = adm(srv, admKey); return req(`${a.url}/rest/v1/avs_licenses?id=eq.${Number(id)}`, { method: 'DELETE', headers: headers(a.key) }); }
export async function adminPacks(srv, admKey) { const a = adm(srv, admKey); return req(`${a.url}/rest/v1/avs_packs?select=version,folder,note,created_at,manifest&order=version.desc&limit=1`, { headers: headers(a.key) }); }

// ---------- data packs ----------
// synced folders inside the data dir: backgrounds/*, characters/my_* (custom), shared/*
export function scanData(PUBLIC) {
  const out = []; const walk = (rel) => { const abs = path.join(PUBLIC, rel); if (!fs.existsSync(abs)) return;
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) { const r = path.posix.join(rel, e.name); if (e.isDirectory()) walk(r); else if (!e.name.startsWith('.')) out.push(r); } };
  walk('backgrounds'); walk('shared');
  const ch = path.join(PUBLIC, 'characters'); if (fs.existsSync(ch)) for (const d of fs.readdirSync(ch)) if (d.startsWith('my_')) walk(path.posix.join('characters', d));
  return out;
}
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
export async function publish({ srv, admKey, PUBLIC, note = '', onProgress = () => {} }) {
  const a = adm(srv, admKey); const prev = (await adminPacks(srv, admKey))[0];
  const folder = prev?.folder || crypto.randomBytes(16).toString('hex'); const have = new Set(Object.values(prev?.manifest?.files || {}).map((f) => f.sha));
  const files = {}; const list = scanData(PUBLIC); let up = 0, bytes = 0;
  for (let i = 0; i < list.length; i++) { const rel = list[i]; const abs = path.join(PUBLIC, rel); const h = sha(abs); const size = fs.statSync(abs).size; files[rel] = { sha: h, size };
    if (!have.has(h)) { onProgress(i, list.length, `Uploading ${rel}`);
      await req(`${a.url}/storage/v1/object/${BUCKET}/${folder}/blobs/${h}`, { method: 'POST', headers: headers(a.key, { 'Content-Type': 'application/octet-stream', 'x-upsert': 'true' }), body: fs.readFileSync(abs) }, 600000); have.add(h); up++; bytes += size; }
    else onProgress(i, list.length, `Unchanged ${rel}`); }
  const version = (prev?.version || 0) + 1;
  await req(`${a.url}/rest/v1/avs_packs`, { method: 'POST', headers: headers(a.key, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }), body: JSON.stringify({ version, folder, manifest: { files }, note: String(note).slice(0, 200) }) });
  onProgress(list.length, list.length, 'Published'); return { version, files: list.length, uploaded: up, bytes };
}
// download what changed; delete files that came from an older pack and are gone now (never touches the user's own files)
export async function syncPack({ srv, licenseKey, PUBLIC, STATE, onProgress = () => {} }) {
  const d = deviceInfo(); const p = await rpc(srv, 'avs_pack', { p_key: licenseKey, p_device: d.id });
  if (!p?.ok) throw new Error('Not allowed to download the team data.');
  const stFile = path.join(STATE, 'team-pack.json'); let st = { version: 0, files: {} }; try { st = JSON.parse(fs.readFileSync(stFile, 'utf8')); } catch {}
  if (!p.version) return { version: 0, changed: 0 };
  const files = p.manifest?.files || {}; const list = Object.entries(files); let changed = 0, removed = 0;
  for (let i = 0; i < list.length; i++) { const [rel, f] = list[i]; if (rel.includes('..')) continue; const abs = path.join(PUBLIC, rel);
    const same = fs.existsSync(abs) && (st.files[rel] === f.sha ? fs.statSync(abs).size === f.size : sha(abs) === f.sha);
    if (same) { onProgress(i, list.length, `Up to date ${rel}`); continue; }
    onProgress(i, list.length, `Downloading ${rel}`);
    const r = await fetch(`${srv.url}/storage/v1/object/public/${BUCKET}/${p.folder}/blobs/${f.sha}`); if (!r.ok) throw new Error(`Download failed (${r.status}) for ${rel}`);
    const buf = Buffer.from(await r.arrayBuffer()); if (crypto.createHash('sha256').update(buf).digest('hex') !== f.sha) throw new Error('Downloaded file is damaged: ' + rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs + '.part', buf); fs.renameSync(abs + '.part', abs); changed++; }
  for (const rel of Object.keys(st.files || {})) if (!files[rel] && !rel.includes('..')) { try { fs.rmSync(path.join(PUBLIC, rel), { force: true }); removed++; } catch {} }
  fs.writeFileSync(stFile, JSON.stringify({ version: p.version, files: Object.fromEntries(list.map(([k, f]) => [k, f.sha])), at: Date.now() }, null, 2));
  onProgress(list.length, list.length, 'Team data up to date'); return { version: p.version, changed, removed, note: p.note };
}
export function localPackVersion(STATE) { try { return JSON.parse(fs.readFileSync(path.join(STATE, 'team-pack.json'), 'utf8')).version || 0; } catch { return 0; } }
