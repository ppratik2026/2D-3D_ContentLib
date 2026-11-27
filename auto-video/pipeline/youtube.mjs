// YouTube kit: titles / description / tags (AI), chapters from the scenes, thumbnail frames, and upload + schedule
// through the YouTube Data API with YOUR OAuth client (Settings → YouTube). Tokens are stored encrypted by the app.
import fs from 'fs';
import path from 'path';
import http from 'http';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { askJSON } from './ai.mjs';

const mmss = (s) => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`; };
const read = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };

// chapters: YouTube needs the first at 0:00, at least 3, each ≥ 10 s
export function chapters(folder) {
  const tl = read(path.join(folder, 'timeline.json'), null); if (!tl) return [];
  let out = [{ t: 0, title: 'Intro' }]; for (const sc of tl.scenes || []) { if (sc.start < 8) continue; const title = String(sc.summary || '').split(/[.!?;]/)[0].slice(0, 60).trim(); if (title) out.push({ t: sc.start, title }); }
  const merged = []; for (const c of out) { if (merged.length && c.t - merged.at(-1).t < 10) continue; merged.push(c); }
  if (merged.length > 40) { const step = merged.length / 40; out = Array.from({ length: 40 }, (_, i) => merged[Math.floor(i * step)]); out[0] = merged[0]; } else out = merged;
  const extra = fs.existsSync(path.join(folder, 'brand.json')) ? read(path.join(folder, 'brand.json'), {}) : {}; const shift = extra.intro ? extra.introSec || 3 : 0; /* branded intro moves everything */
  return out.length >= 3 ? out.map((c, i) => ({ t: i ? c.t + shift : 0, title: c.title, label: mmss(i ? c.t + shift : 0) })) : [];
}

export async function writeTexts({ folder, chain, language = 'hinglish', onLog = () => {} }) {
  const st = read(path.join(folder, 'story.json'), {}); const lang = language === 'english' ? 'English' : language === 'hindi' ? 'Hindi (Devanagari) with an English line' : 'Hinglish (Roman Hindi) with some English';
  const { value } = await askJSON(chain, { onLog, temperature: 0.8, validate: (j) => { if (!Array.isArray(j.titles) || !j.titles.length || !j.description) throw new Error('incomplete'); return j; },
    user: `You are a YouTube growth expert for Indian animated story channels. Write upload texts for this video in ${lang}.
Title: ${st.title || ''}. Logline: ${st.logline || ''}. Category: ${st.category || ''}. Moral: ${st.moral || ''}.
Scenes: ${(st.scenes || []).slice(0, 40).map((s) => s.summary).join(' | ')}
Rules: titles max 70 characters, curiosity + emotion, no clickbait lies, 1–2 emojis max; description: 3 short paragraphs (hook, what happens without spoilers of the twist, call to like / subscribe / comment a question), then 5 hashtags; tags: 15–25 search phrases (Hindi + English mix), no '#'.
Reply with ONLY JSON: {"titles":["5 options"],"description":"…","tags":["…"],"hashtags":["#…"],"thumbnail_text":["3 options, 2–4 BIG words each"]}` });
  const ch = chapters(folder); const desc = value.description + (ch.length ? `\n\nChapters:\n${ch.map((c) => `${c.label} ${c.title}`).join('\n')}` : '') + (value.hashtags?.length ? `\n\n${value.hashtags.join(' ')}` : '');
  const out = { titles: value.titles.slice(0, 6), description: desc, tags: (value.tags || []).slice(0, 30), thumbnailText: value.thumbnail_text || [], chapters: ch };
  fs.writeFileSync(path.join(folder, 'youtube.json'), JSON.stringify(out, null, 2));
  fs.writeFileSync(path.join(folder, 'youtube.txt'), `TITLES\n${out.titles.join('\n')}\n\nDESCRIPTION\n${out.description}\n\nTAGS\n${out.tags.join(', ')}\n`);
  return out;
}
export const loadTexts = (folder) => read(path.join(folder, 'youtube.json'), null);
export function saveTexts(folder, t) { fs.writeFileSync(path.join(folder, 'youtube.json'), JSON.stringify(t, null, 2)); return t; }

// a frame from the video for the thumbnail (JPEG next to the video)
export function grabFrame(ffmpegPath, folder, t, name = 'thumb_frame.jpg') { const src = fs.existsSync(path.join(folder, 'video_clean.mp4')) ? path.join(folder, 'video_clean.mp4') : path.join(folder, 'final.mp4'); const out = path.join(folder, name);
  return new Promise((ok, fail) => { const p = spawn(ffmpegPath, ['-y', '-ss', String(Math.max(0, t)), '-i', src, '-frames:v', '1', '-q:v', '2', out]); p.on('error', fail); p.on('close', (c) => (c === 0 ? ok(out) : fail(new Error('Could not take a frame')))); }); }
// good moments for a thumbnail: lines with strong emotions
export function thumbMoments(folder) { const s = read(path.join(folder, 'subtitles.json'), { lines: [] }); const pick = s.lines.filter((l) => /surprised|scared|angry|happy|shock/.test(l.emotion || '') || /[!?]/.test(l.hinglish || ''));
  const src = (pick.length >= 6 ? pick : s.lines); const step = Math.max(1, Math.floor(src.length / 6)); return src.filter((_, i) => i % step === 0).slice(0, 6).map((l) => +((l.start + l.end) / 2).toFixed(1)); }

// ---------- OAuth (installed-app flow with a loopback redirect + PKCE) ----------
const SCOPE = 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly';
export function connect({ clientId, clientSecret, openUrl }) {
  return new Promise((ok, fail) => {
    const verifier = crypto.randomBytes(48).toString('base64url'); const challenge = crypto.createHash('sha256').update(verifier).digest('base64url'); const state = crypto.randomBytes(12).toString('hex');
    const srv = http.createServer(async (req, res) => { const u = new URL(req.url, 'http://127.0.0.1'); if (u.pathname !== '/') { res.end(); return; }
      const code = u.searchParams.get('code'); const err = u.searchParams.get('error');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(`<h2 style="font-family:sans-serif">${code ? '✓ YouTube connected — you can close this tab and go back to Auto Video Studio.' : '✗ Not connected: ' + (err || 'no code')}</h2>`); srv.close();
      if (!code || u.searchParams.get('state') !== state) return fail(new Error('YouTube sign-in was cancelled'));
      try { const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirect, grant_type: 'authorization_code', code_verifier: verifier }) });
        const j = await r.json(); if (!j.refresh_token) throw new Error(j.error_description || j.error || 'no refresh token'); ok({ refreshToken: j.refresh_token, accessToken: j.access_token, expires: Date.now() + (j.expires_in - 60) * 1000 }); } catch (e) { fail(e); } });
    let redirect = '';
    srv.listen(0, '127.0.0.1', () => { redirect = `http://127.0.0.1:${srv.address().port}`;
      const url = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({ client_id: clientId, redirect_uri: redirect, response_type: 'code', scope: SCOPE, access_type: 'offline', prompt: 'consent', code_challenge: challenge, code_challenge_method: 'S256', state })}`;
      openUrl(url); });
    setTimeout(() => { try { srv.close(); } catch {} fail(new Error('YouTube sign-in timed out (5 min)')); }, 5 * 60e3);
  });
}
export async function accessToken({ clientId, clientSecret, refreshToken }) {
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }) });
  const j = await r.json(); if (!j.access_token) throw new Error('YouTube: ' + (j.error_description || j.error || 'could not refresh the sign-in') + ' — connect again in Settings → YouTube'); return j.access_token;
}
export async function channelName(token) { const r = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', { headers: { Authorization: `Bearer ${token}` } }); const j = await r.json(); return j.items?.[0]?.snippet?.title || '(channel)'; }

// resumable upload in 8 MB pieces; meta: {title, description, tags, privacy, publishAt, categoryId, kids}
export async function upload({ token, file, meta, onProgress = () => {} }) {
  const size = fs.statSync(file).size; const status = { privacyStatus: meta.publishAt ? 'private' : meta.privacy || 'private', selfDeclaredMadeForKids: !!meta.kids, ...(meta.publishAt ? { publishAt: new Date(meta.publishAt).toISOString() } : {}) };
  const body = { snippet: { title: String(meta.title || 'Video').slice(0, 100), description: String(meta.description || '').slice(0, 5000), tags: (meta.tags || []).slice(0, 30), categoryId: String(meta.categoryId || '1'), defaultLanguage: meta.lang || 'hi' }, status };
  const r0 = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'video/mp4', 'X-Upload-Content-Length': String(size) }, body: JSON.stringify(body) });
  if (!r0.ok) throw new Error('YouTube refused the upload: ' + (await r0.text()).slice(0, 300)); const loc = r0.headers.get('location');
  const CH = 8 * 1024 * 1024; const fd = fs.openSync(file, 'r'); let pos = 0, res = null;
  try { while (pos < size) { const n = Math.min(CH, size - pos); const buf = Buffer.alloc(n); fs.readSync(fd, buf, 0, n, pos);
      let r; for (let k = 0; k < 5; k++) { try { r = await fetch(loc, { method: 'PUT', headers: { 'Content-Length': String(n), 'Content-Range': `bytes ${pos}-${pos + n - 1}/${size}` }, body: buf }); if (r.status < 500) break; } catch (e) { if (k === 4) throw e; } await new Promise((ok) => setTimeout(ok, 2000 * (k + 1))); }
      if (r.status === 308) { const rg = r.headers.get('range'); pos = rg ? Number(rg.split('-')[1]) + 1 : pos + n; onProgress(pos / size); continue; }
      if (!r.ok) throw new Error('Upload failed: ' + (await r.text()).slice(0, 300)); res = await r.json(); pos = size; onProgress(1); } }
  finally { fs.closeSync(fd); }
  return res; // { id, ... }
}
export async function setThumbnail({ token, videoId, jpg }) {
  const r = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/jpeg' }, body: fs.readFileSync(jpg) });
  if (!r.ok) throw new Error('Thumbnail not set (custom thumbnails need a verified YouTube account): ' + (await r.text()).slice(0, 200)); return true;
}
