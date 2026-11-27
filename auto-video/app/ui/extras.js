// Shorts (9:16), YouTube kit (thumbnail, texts, upload), Branding + YouTube settings, Help book.
const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const err = (e) => String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---------------- Shorts ----------------
let SH = null;
window.AVShorts = async (dir, title) => { SH = { dir, mode: 'crop' }; $('#shTitleV').textContent = title; $('#shVideo').src = `av://videos/${encodeURIComponent(dir)}/final.mp4`; $('#shModal').hidden = false; $('#shTitle').value = '';
  const sug = await api.call('shorts:suggest', { dir, len: +$('#shLen').value }); $('#shSug').innerHTML = sug.length ? sug.map((x) => `<span class="chip" data-s="${x.start}" title="${esc(x.text)}">${mmss(x.start)} · ${esc(x.text.slice(0, 34))}…</span>`).join('') : '<span class="small muted">No dialogue found — pick a start yourself.</span>';
  if (sug[0]) setStart(sug[0].start); drawList(); box(); };
function setStart(t) { $('#shStart').value = Math.round(t); $('#shVideo').currentTime = t; }
function box() { const v = $('#shVideo'); const b = $('#shBox'); if (SH?.mode !== 'crop') { b.hidden = true; return; } b.hidden = false; const w = v.clientWidth, h = (w * 9) / 16; const bw = (h * 9) / 16; const f = +$('#shFocus').value; b.style.width = bw + 'px'; b.style.height = h + 'px'; b.style.left = (w - bw) * f + 'px'; }
async function drawList() { const L = await api.call('shorts:list', SH.dir); $('#shList').innerHTML = L.length ? L.map((x) => `<div class="it"><span class="small">${esc(x.name)}</span><button class="ghost small-btn" data-play="${esc(x.url)}">▶ Play</button></div>`).join('') : '<div class="small muted">None yet.</div>'; }
$('#shSug').onclick = (e) => { const c = e.target.closest('[data-s]'); if (c) setStart(+c.dataset.s); };
$('#shNow').onclick = () => { $('#shStart').value = Math.round($('#shVideo').currentTime); };
$('#shStart').oninput = (e) => { $('#shVideo').currentTime = +e.target.value || 0; };
$('#shMode').onclick = (e) => { const c = e.target.closest('.chip'); if (!c) return; SH.mode = c.dataset.m; $$('#shMode .chip').forEach((x) => x.classList.toggle('on', x === c)); $('#shFocusL').hidden = SH.mode !== 'crop'; box(); };
$('#shFocus').oninput = box; window.addEventListener('resize', () => SH && box()); $('#shVideo').onloadedmetadata = box;
$('#shList').onclick = (e) => { const u = e.target.dataset.play; if (u) { $('#playerVideo').src = u; $('#player').hidden = false; $('#playerVideo').play(); } };
$('#shMake').onclick = async () => { const b = $('#shMake'); b.disabled = true; try { await api.call('shorts:make', { dir: SH.dir, start: +$('#shStart').value, dur: +$('#shLen').value, mode: SH.mode, focus: +$('#shFocus').value, title: $('#shTitle').value, subs: $('#shSubs').checked }); await drawList(); } catch (e) { alert(err(e)); } finally { b.disabled = false; } };
$('#shFolder').onclick = () => api.call('shorts:open', SH.dir); $('#shClose').onclick = () => { $('#shVideo').pause(); $('#shModal').hidden = true; };

// ---------------- YouTube kit ----------------
let YT = null; const img = new Image();
window.AVYouTube = async (dir, title) => { YT = { dir, title, texts: null }; $('#ytTitleV').textContent = title; $('#ytModal').hidden = false; tab('thumb');
  $('#ytL1').value = title.toUpperCase().slice(0, 18); $('#ytL2').value = '';
  const ms = await api.call('yt:moments', dir);
  $('#ytMoments').innerHTML = ms.map((t) => `<button class="ghost small-btn" data-t="${t}" title="an emotional moment">⭐ ${mmss(t)}</button>`).join('');
  await grab(ms[0] ?? 5); loadTexts(); upStatus(); };
async function grab(t) { $('#ytT').value = Math.round(t); const u = await api.call('yt:frame', { dir: YT.dir, t }); img.onload = drawThumb; img.src = u; }
function drawThumb() { const c = $('#ytCanvas'), x = c.getContext('2d'); x.clearRect(0, 0, 1280, 720); if (img.complete && img.naturalWidth) x.drawImage(img, 0, 0, 1280, 720);
  const pos = $('#ytPos').value, sz = +$('#ytSz').value; if ($('#ytDark').checked) { const g = pos === 'left' ? x.createLinearGradient(0, 0, 900, 0) : pos === 'right' ? x.createLinearGradient(1280, 0, 380, 0) : pos === 'top' ? x.createLinearGradient(0, 0, 0, 500) : x.createLinearGradient(0, 720, 0, 220); g.addColorStop(0, 'rgba(0,0,0,.75)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 1280, 720); }
  const lines = [[$('#ytL1').value, $('#ytC1').value, sz], [$('#ytL2').value, $('#ytC2').value, sz * 0.8]].filter((l) => l[0].trim());
  x.textBaseline = 'top'; x.lineJoin = 'round'; const tot = lines.reduce((a, l) => a + l[2] * 1.05, 0); let y = pos === 'top' ? 40 : pos === 'bottom' ? 700 - tot : (720 - tot) / 2;
  for (const [t, col, s] of lines) { x.font = `900 ${s}px Poppins, 'Arial Black', sans-serif`; let w = x.measureText(t.toUpperCase()).width; let s2 = s; while (w > 1180 && s2 > 30) { s2 -= 4; x.font = `900 ${s2}px Poppins, 'Arial Black', sans-serif`; w = x.measureText(t.toUpperCase()).width; }
    const tx = pos === 'right' ? 1240 - w : pos === 'left' ? 40 : (1280 - w) / 2; x.lineWidth = Math.max(8, s2 * 0.12); x.strokeStyle = '#000'; x.strokeText(t.toUpperCase(), tx, y); x.fillStyle = col; x.fillText(t.toUpperCase(), tx, y); y += s2 * 1.05; }
  const bd = $('#ytBadge').value.trim(); if (bd) { x.font = '900 54px Poppins, sans-serif'; const w = x.measureText(bd).width + 40; const bx = pos === 'right' ? 30 : 1250 - w; x.fillStyle = '#e53935'; x.beginPath(); x.roundRect(bx, 30, w, 80, 16); x.fill(); x.fillStyle = '#fff'; x.fillText(bd, bx + 20, 42); } }
['ytL1', 'ytL2', 'ytC1', 'ytC2', 'ytSz', 'ytPos', 'ytBadge', 'ytDark'].forEach((id) => { $('#' + id).addEventListener('input', drawThumb); });
$('#ytMoments').onclick = (e) => { const t = e.target.dataset.t; if (t != null) grab(+t); };
$('#ytGrab').onclick = () => grab(+$('#ytT').value || 0);
$('#ytSaveThumb').onclick = async () => { drawThumb(); const d = $('#ytCanvas').toDataURL('image/jpeg', 0.9); await api.call('yt:saveThumb', { dir: YT.dir, dataUrl: d }); $('#ytThumbMsg').textContent = 'Saved ✓ thumbnail.jpg'; };
function tab(t) { $$('#ytTabs .chip').forEach((c) => c.classList.toggle('on', c.dataset.t === t)); $('#ytThumb').hidden = t !== 'thumb'; $('#ytTexts').hidden = t !== 'texts'; $('#ytUp').hidden = t !== 'up'; if (t === 'up') { fillUp(); upStatus(); } }
$('#ytTabs').onclick = (e) => { const c = e.target.closest('.chip'); if (c) tab(c.dataset.t); };
function showTexts(T) { YT.texts = T; const titles = T?.titles?.length ? T.titles : [YT.title]; YT.pick ??= 0;
  $('#ytTitles').innerHTML = titles.map((t, i) => `<label><input type="radio" name="ytPick" value="${i}"${i === YT.pick ? ' checked' : ''}><input type="text" value="${esc(t)}" data-i="${i}" maxlength="100"><span class="small muted">${t.length}/100</span></label>`).join('');
  $('#ytDesc').value = T?.description || ''; $('#ytTags').value = (T?.tags || []).join(', '); }
async function loadTexts() { const T = await api.call('yt:texts', YT.dir); if (T) showTexts(T); else { const ch = await api.call('yt:chapters', YT.dir); showTexts({ titles: [YT.title], description: ch.length ? `Chapters:\n${ch.map((c) => `${c.label} ${c.title}`).join('\n')}` : '', tags: [] }); } }
const readTexts = () => ({ ...(YT.texts || {}), titles: $$('#ytTitles input[type=text]').map((i) => i.value), description: $('#ytDesc').value, tags: $('#ytTags').value.split(',').map((x) => x.trim()).filter(Boolean) });
$('#ytTitles').onchange = (e) => { if (e.target.name === 'ytPick') YT.pick = +e.target.value; };
$('#ytWrite').onclick = async () => { const b = $('#ytWrite'); b.disabled = true; try { showTexts(await api.call('yt:write', { dir: YT.dir, ai: $('#storySrc')?.value === 'paste' ? 'auto' : $('#storySrc')?.value || 'auto' })); const tt = YT.texts.thumbnailText?.[0]; if (tt && !$('#ytL2').value) { const w = tt.split(' '); $('#ytL1').value = w.slice(0, 2).join(' '); $('#ytL2').value = w.slice(2).join(' '); drawThumb(); } } catch (e) { alert(err(e)); } finally { b.disabled = false; } };
$('#ytSaveTexts').onclick = async () => { YT.texts = await api.call('yt:saveTexts', { dir: YT.dir, texts: readTexts() }); };
$('#ytTexts').onclick = (e) => { const id = e.target.dataset.copy; if (id) { navigator.clipboard.writeText($('#' + id).value); e.target.textContent = 'Copied ✓'; setTimeout(() => (e.target.textContent = 'Copy'), 1200); } };
function fillUp() { const T = readTexts(); $('#ytUpTitle').value = T.titles[YT.pick || 0] || YT.title; if (!$('#ytWhen').value) { const d = new Date(Date.now() + 24 * 3600e3); d.setMinutes(0, 0, 0); $('#ytWhen').value = new Date(d - d.getTimezoneOffset() * 60e3).toISOString().slice(0, 16); } }
async function upStatus() { const s = await api.call('yt:status'); $('#ytUpStat').innerHTML = s.connected ? `Connected to <b>${esc(s.channel || 'your channel')}</b>` : '<span class="warn">Not connected — open Settings → YouTube (one-time setup, see Help → YouTube upload).</span>'; $('#ytUpload').disabled = !s.connected; }
$('#ytUpload').onclick = async () => { const b = $('#ytUpload'); b.disabled = true; $('#ytUpMsg').textContent = '';
  const T = readTexts(); const sched = $('#ytPriv').value === 'schedule'; const meta = { title: $('#ytUpTitle').value, description: T.description, tags: T.tags, privacy: sched ? 'private' : $('#ytPriv').value, publishAt: sched ? new Date($('#ytWhen').value).toISOString() : null, categoryId: $('#ytCat').value, kids: $('#ytKids').checked };
  try { const r = await api.call('yt:upload', { dir: YT.dir, meta, thumb: $('#ytUseThumb').checked }); $('#ytUpMsg').innerHTML = `✓ Uploaded: <a href="#" data-url="${esc(r.url)}">${esc(r.url)}</a>${r.publishAt ? ` · goes public ${new Date(r.publishAt).toLocaleString()}` : ''}${r.thumb && r.thumb !== 'set' ? `<div class="warn">${esc(r.thumb)}</div>` : ''}`; }
  catch (e) { $('#ytUpMsg').innerHTML = `<span class="warn">✗ ${esc(err(e))}</span>`; } finally { b.disabled = false; } };
$('#ytUpMsg').onclick = (e) => { const u = e.target.dataset.url; if (u) { e.preventDefault(); api.call('yt:open', u); } };
$('#ytClose').onclick = () => { $('#ytModal').hidden = true; };

// ---------------- Settings: Branding + YouTube ----------------
const base = (f) => (f ? String(f).split(/[\\/]/).pop() : 'none');
async function loadBrand() { const b = await api.call('brand:get'); $('#brLogo').textContent = base(b.logo); $('#brIntro').textContent = base(b.intro); $('#brOutro').textContent = base(b.outro);
  $('#brPos').value = b.pos || 'top-right'; $('#brSize').value = b.size || 12; $('#brOp').value = b.opacity ?? 0.85; $('#brIntroSec').value = b.introSec || 3; $('#brOutroSec').value = b.outroSec || 4; $('#brOn').checked = b.on !== false;
  $('#brandRow').hidden = !b.active; }
const setB = async (p) => { await api.call('brand:set', p); loadBrand(); };
$('#brPos').onchange = (e) => setB({ pos: e.target.value }); $('#brSize').onchange = (e) => setB({ size: +e.target.value }); $('#brOp').onchange = (e) => setB({ opacity: +e.target.value });
$('#brIntroSec').onchange = (e) => setB({ introSec: +e.target.value }); $('#brOutroSec').onchange = (e) => setB({ outroSec: +e.target.value }); $('#brOn').onchange = (e) => setB({ on: e.target.checked });
for (const k of ['Logo', 'Intro', 'Outro']) { $(`#br${k}Pick`).onclick = async () => { await api.call('brand:file', k.toLowerCase()); loadBrand(); }; $(`#br${k}X`).onclick = async () => { await api.call('brand:clear', k.toLowerCase()); loadBrand(); }; }
async function loadYT() { const s = await api.call('yt:status'); $('#ytId').value = s.clientId; $('#ytSecret').placeholder = s.hasClient ? '(saved — type to replace)' : 'GOCSPX-…'; $('#ytStat').innerHTML = s.connected ? `✓ Connected: <b>${esc(s.channel || 'your channel')}</b>` : s.hasClient ? 'Keys saved — press Connect my channel.' : 'Not set up yet.'; }
$('#ytSave').onclick = async () => { await api.call('yt:setClient', { clientId: $('#ytId').value, clientSecret: $('#ytSecret').value }); $('#ytSecret').value = ''; loadYT(); };
$('#ytConnect').onclick = async () => { $('#ytStat').textContent = 'A browser window opens: choose your channel and allow… (waiting)'; try { await api.call('yt:connect'); } catch (e) { $('#ytStat').innerHTML = `<span class="warn">✗ ${esc(err(e))}</span>`; return; } loadYT(); };
$('#ytDisc').onclick = async () => { await api.call('yt:disconnect'); loadYT(); };
document.querySelector('#tabs').addEventListener('click', (e) => { const t = e.target.closest('button')?.dataset.tab; if (t === 'settings') { loadBrand(); loadYT(); } if (t === 'new') loadBrand(); if (t === 'help') loadHelp(); });
setTimeout(() => { loadBrand().catch(() => {}); }, 1500);

// ---------------- Help book ----------------
let helpDone = false;
async function loadHelp() { if (helpDone) return; const html = await (await fetch('help.html')).text(); $('#helpBody').innerHTML = html; helpDone = true;
  $('#helpNav').innerHTML = $$('#helpBody h2').map((h, i) => { h.id = 'h' + i; return `<a href="#h${i}" data-h="h${i}">${esc(h.textContent)}</a>`; }).join('');
  $('#helpNav').onclick = (e) => { const a = e.target.closest('a'); if (!a) return; e.preventDefault(); document.getElementById(a.dataset.h).scrollIntoView({ behavior: 'smooth' }); $$('#helpNav a').forEach((x) => x.classList.toggle('on', x === a)); }; }
