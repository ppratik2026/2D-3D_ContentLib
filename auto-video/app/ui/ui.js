const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
const api = window.api; let O, cat = 'romance', S;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (s) => { s = Math.round(s || 0); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}h ${m}m` : m ? `${m}m ${x}s` : `${x}s`; };
const clock = (iso) => iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';

// ---------- tabs ----------
$('#tabs').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; $$('#tabs button').forEach((x) => x.classList.toggle('on', x === b)); $$('.tab').forEach((t) => t.classList.toggle('on', t.id === 'tab-' + b.dataset.tab));
  if (b.dataset.tab === 'new') { loadCastPick(); loadSeriesList(); } if (b.dataset.tab === 'library') loadLibrary(); if (b.dataset.tab === 'chars') loadChars(); else window.AVPreview?.stop(); if (b.dataset.tab === 'bgs') loadBgs(); if (b.dataset.tab === 'settings') loadSettings(); };

// ---------- new video ----------
const fill = (sel, obj, auto) => { sel.innerHTML = (auto ? '<option value="auto">Auto (based on category)</option>' : '') + Object.entries(obj).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join(''); };
async function initNew() {
  O = await api.call('options');
  $('#cats').innerHTML = Object.entries(O.categories).map(([k, v]) => `<span class="chip${k === cat ? ' on' : ''}" data-k="${k}">${esc(v.label)}</span>`).join('');
  $('#cats').onclick = (e) => { const k = e.target.dataset.k; if (!k) return; cat = k; $$('#cats .chip').forEach((c) => c.classList.toggle('on', c.dataset.k === k)); };
  fill($('#style'), O.styles); fill($('#look'), O.looks, true); fill($('#subs'), O.subs, true); ensureMine(); loadSeriesList(); loadCastPick(); langNote();
  for (const id of ['#min', '#style', '#count']) $(id).oninput = est; est();
}
async function est() {
  const m = $('#min').value, n = Math.max(1, +$('#count').value || 1); $('#minv').textContent = m + ' min';
  const e = await api.call('estimate', { style: $('#style').value, minutes: m });
  $('#estTotal').textContent = e.totalText;
  const names = { story: 'Story (AI)', voice: 'Hindi voices (Piper)', sound: 'Music + effects', prepare: 'Preparing', render: '3D render' };
  $('#estParts').innerHTML = Object.entries(e.partsText).map(([k, v]) => `<tr><td>${names[k]}</td><td>${v}</td></tr>`).join('');
  $('#estNote').textContent = e.measured ? 'Based on the real speed of this PC.' : 'Rough estimate — it becomes exact after the first video on this PC.';
  $('#estSum').textContent = n > 1 ? `${n} videos ≈ ${fmt(e.total * n)} (one after another)` : '';
}
let mode2 = 'idea';
$('#storyMode').onclick = (e) => { const c = e.target.closest('.chip'); if (!c) return; mode2 = c.dataset.m; $$('#storyMode .chip').forEach((x) => x.classList.toggle('on', x === c)); $('#ideaBox').hidden = mode2 !== 'idea'; $('#mineBox').hidden = mode2 !== 'mine'; $('#findBox').hidden = mode2 !== 'find'; $('#count').disabled = mode2 === 'mine'; if (mode2 === 'mine') $('#count').value = 1; storyInfo(); };
function storyInfo() { const t = $('#myStory').value.trim(); if (!t) { $('#storyInfo').textContent = ''; return; }
  const words = t.split(/\s+/).length; const min = Math.max(0.5, Math.min(30, Math.round((words / 95) * 2) / 2)); // ~95 spoken words a minute with acting
  $('#storyInfo').className = 'small muted'; $('#storyInfo').textContent = `${words} words · about ${min} min of video`; $('#min').max = Math.max(20, min); $('#min').value = min; est(); }
$('#myStory').oninput = storyInfo;
$('#loadStory').onclick = () => $('#storyFile').click();
$('#storyFile').onchange = () => { const f = $('#storyFile').files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { $('#myStory').value = String(r.result || ''); storyInfo(); }; r.readAsText(f, 'utf-8'); $('#storyFile').value = ''; };
const src = () => { const v = $('#storySrc').value || 'auto'; return v === 'paste' || v === 'demo' ? v : 'api'; };
$('#storySrc').onchange = () => { $('#pasteBox').hidden = src() !== 'paste'; $('#demo').checked = src() === 'demo'; $('#keyWarn').hidden = src() !== 'api' || S?.hasKey; };
$('#copyPrompt').onclick = async () => { const p = await api.call('story:prompt', { format: FMT, seriesId: FMT === 'series' ? $('#seriesSel').value || null : null, seriesTitle: $('#seriesTitle').value.trim(), language: LANG, bgMode: BGM, castIds: [...castSel], leadId: $('#leadSel').value || null, mains: +$('#mainsSel').value || 0, topics: mode2 === 'find' ? TOPICS.filter((_, i) => topicSel.has(i)) : [], category: cat, minutes: $('#min').value, idea: $('#idea').value, style: $('#style').value, chars: $('#chars').value, myStory: mode2 === 'mine' ? $('#myStory').value : '' });
  try { await navigator.clipboard.writeText(p); $('#copyMsg').textContent = 'Copied ✓ — now paste it in the Gemini app'; } catch { $('#pasted').value = p; $('#copyMsg').textContent = 'Prompt placed in the box below — copy it from there'; } };
let pasteOk = false;
$('#pasted').oninput = async () => { const t = $('#pasted').value.trim(); if (!t) { $('#pasteMsg').textContent = ''; pasteOk = false; return; }
  const r = await api.call('story:parse', { text: t, minutes: $('#min').value }); pasteOk = r.ok;
  $('#pasteMsg').className = 'small ' + (r.ok ? '' : 'warn'); $('#pasteMsg').textContent = r.ok ? `✓ Story read: "${r.title}" · ${r.scenes} scenes · ${r.lines} lines · ${r.chars}` : r.msg; };
async function add(start) {
  const mode = src();
  const picked = TOPICS.filter((_, i) => topicSel.has(i));
  if (mode2 === 'find' && !picked.length) { $('#topicMsg').className = 'small warn'; $('#topicMsg').textContent = 'Find topics and click one (or more) first.'; return; }
  const o = { format: FMT, seriesId: FMT === 'series' ? $('#seriesSel').value || null : null, seriesTitle: $('#seriesTitle').value.trim(), language: LANG, bgMode: BGM, subsOn: SUBSON, castIds: [...castSel].filter((x) => x !== $('#leadSel').value), leadId: $('#leadSel').value || null, mains: +$('#mainsSel').value || 0, topics: mode2 === 'find' ? picked : [],
    category: cat, idea: mode2 === 'find' ? '' : $('#idea').value, minutes: $('#min').value, count: FMT === 'series' ? $('#epCount').value : $('#count').value, style: $('#style').value, look: $('#look').value, subs: $('#subs').value, chars: $('#chars').value, demo: mode === 'demo', storyAI: mode === 'api' ? $('#storySrc').value : null, start };
  if (mode2 === 'mine') { o.myStory = $('#myStory').value.trim(); o.idea = ''; o.count = 1; if (!o.myStory && mode !== 'paste' && mode !== 'demo') { $('#storyInfo').className = 'small warn'; $('#storyInfo').textContent = 'Paste your story first.'; return; } }
  if (mode === 'paste') { if (!pasteOk) { $('#pasteMsg').className = 'small warn'; $('#pasteMsg').textContent = 'Paste Gemini\'s answer first.'; return; } o.pasted = $('#pasted').value; }
  if (mode === 'api' && !S?.hasKey) { $('#keyWarn').hidden = false; return; }
  if ($('#reviewCast').checked && mode === 'api' && mode2 !== 'mine') { // AI plans the characters → the user checks them → then the script
    const many = FMT === 'series' ? +o.count > 1 : (mode2 === 'find' ? o.topics.length : +o.count) > 1;
    if (many) { if (!confirm('Checking characters works for one video at a time. Make just the first one now?')) return; o.count = 1; if (FMT !== 'series') o.topics = o.topics.slice(0, 1); }
    const plan = await castReview(o); if (!plan) return; Object.assign(o, plan); }
  renderQueue(await api.call('queue:add', o)); if (mode === 'paste') { $('#pasted').value = ''; $('#pasteMsg').textContent = ''; pasteOk = false; } $('[data-tab=queue]').click();
}
$('#addQ').onclick = () => add(false); $('#addStart').onclick = () => add(true);
// ---------- character check before the script ----------
let cmRows = [], cmDone = null;
function cmDraw() { const opt = (sel) => '<option value="">New character</option>' + CAST.map((c) => `<option value="${esc(c.id)}"${c.id === sel ? ' selected' : ''}>Saved: ${esc(c.name)}${c.role ? ' — ' + esc(c.role) : ''}</option>`).join('');
  $('#cmRows').innerHTML = `<div class="cmrow small muted"><span>Main</span><span>Name</span><span>Role in the story</span><span>Gender · age</span><span>Played by</span><span></span></div>` + cmRows.map((c, i) => `<div class="cmrow" data-i="${i}"><input type="checkbox" data-k="main"${c.main ? ' checked' : ''} title="main character"><input data-k="name" value="${esc(c.name)}"><input data-k="role" value="${esc(c.role)}">
    <select data-k="ga"><option value="male|young"${c.gender === 'male' && c.age === 'young' ? ' selected' : ''}>Man · young</option><option value="male|adult"${c.gender === 'male' && c.age === 'adult' ? ' selected' : ''}>Man · adult</option><option value="male|old"${c.gender === 'male' && c.age === 'old' ? ' selected' : ''}>Man · old</option><option value="male|child"${c.gender === 'male' && c.age === 'child' ? ' selected' : ''}>Boy</option><option value="female|young"${c.gender === 'female' && c.age === 'young' ? ' selected' : ''}>Woman · young</option><option value="female|adult"${c.gender === 'female' && c.age === 'adult' ? ' selected' : ''}>Woman · adult</option><option value="female|old"${c.gender === 'female' && c.age === 'old' ? ' selected' : ''}>Woman · old</option><option value="female|child"${c.gender === 'female' && c.age === 'child' ? ' selected' : ''}>Girl</option></select>
    <select data-k="castId">${opt(c.castId)}</select><button class="ghost x" data-k="del" title="remove">✕</button></div>`).join(''); }
$('#cmRows').oninput = (e) => { const r = e.target.closest('.cmrow'); if (!r?.dataset.i) return; const c = cmRows[+r.dataset.i]; const k = e.target.dataset.k;
  if (k === 'main') c.main = e.target.checked; else if (k === 'ga') [c.gender, c.age] = e.target.value.split('|'); else if (k === 'castId') { c.castId = e.target.value || null; const sv = CAST.find((x) => x.id === c.castId); if (sv) { c.name = sv.name; c.gender = sv.gender || c.gender; c.age = sv.age || c.age; cmDraw(); } } else if (k) c[k] = e.target.value; };
$('#cmRows').onclick = (e) => { if (e.target.dataset.k !== 'del') return; cmRows.splice(+e.target.closest('.cmrow').dataset.i, 1); cmDraw(); };
$('#cmAdd').onclick = () => { cmRows.push({ id: 'new' + Date.now().toString(36).slice(-4), name: '', role: '', gender: 'male', age: 'adult', main: false }); cmDraw(); };
$('#cmCancel').onclick = () => { $('#castModal').hidden = true; cmDone?.(null); };
$('#cmOk').onclick = () => { const rows = cmRows.filter((c) => c.name.trim()); if (!rows.length) { $('#cmLog').className = 'small warn'; $('#cmLog').textContent = 'Keep at least one character.'; return; }
  $('#castModal').hidden = true; cmDone?.({ castPlan: rows.map((c) => ({ ...c, name: c.name.trim(), role: c.role.trim() })) }); };
window.AVCastPreview = async (rows, title) => { CAST = await api.call('cast:list'); cmRows = rows; $('#cmTitle').textContent = title; cmDraw(); $('#castModal').hidden = false; }; // dev screenshots
async function castReview(o) {
  $('#cmTitle').textContent = 'AI is planning the story and its characters…'; $('#cmLog').className = 'small muted'; $('#cmLog').textContent = ''; $('#cmRows').innerHTML = '<div class="spin"></div>'; $('#castModal').hidden = false; $('#cmOk').disabled = true;
  CAST = await api.call('cast:list'); const r = await api.call('story:cast', o); $('#cmOk').disabled = false;
  if (!r.ok) { $('#cmTitle').textContent = 'Could not plan the characters'; $('#cmLog').className = 'small warn'; $('#cmLog').textContent = r.msg; $('#cmRows').innerHTML = ''; $('#cmOk').disabled = true; return new Promise((ok) => (cmDone = ok)); }
  $('#cmTitle').textContent = r.title || 'Characters of this story'; $('#cmLog').textContent = r.logline || ''; cmRows = r.characters.map((c) => ({ ...c, castId: c.castId || null })); cmDraw();
  const res = await new Promise((ok) => (cmDone = ok)); return res && { ...res, planTitle: r.title, planLogline: r.logline }; }
// ---------- format, series, topics, language, backgrounds, characters, subtitles ----------
let FMT = 'single', LANG = 'hinglish', BGM = 'existing', SUBSON = true, TOPICS = [], topicSel = new Set(), CAST = [], castSel = new Set(), SERIES = [];
const chipGroup = (sel, key, set) => { $(sel).onclick = (e) => { const c = e.target.closest('.chip'); if (!c) return; $$(sel + ' .chip').forEach((x) => x.classList.toggle('on', x === c)); set(c.dataset[key]); }; };
const toggleIn = (set, v) => { if (set.has(v)) set.delete(v); else set.add(v); };
chipGroup('#fmt', 'f', (v) => { FMT = v; $('#seriesBox').hidden = v !== 'series'; $('#count').closest('div').hidden = v === 'series'; topicSel = new Set(); drawTopics(); seriesInfo(); });
chipGroup('#lang', 'l', (v) => { LANG = v; langNote(); });
chipGroup('#bgMode', 'b', (v) => { BGM = v; $('#bgNote').textContent = v === 'new' ? 'A new picture for every place, in the same art theme, saved to your Backgrounds. Painter: Gemini if Gemini is your story AI (needs billing), otherwise the free painter (Pollinations, no key). If painting fails, the closest existing background is used.' : 'Your library backgrounds of this style, picked for the genre and each scene.'; });
chipGroup('#subsOn', 's', (v) => { SUBSON = v === 'on'; $('#subs').disabled = !SUBSON; });
function langNote() { $('#langNote').textContent = LANG === 'english' ? (O?.englishReady ? 'English voices, English story, bubbles and subtitles.' : 'English voices download once (~130 MB) with the first English video.') : LANG === 'hindi' ? 'Hindi voices; on-screen text in Devanagari.' : 'Hindi voices; on-screen text in Roman Hinglish.'; }
async function loadSeriesList() { SERIES = await api.call('series:list'); const v = $('#seriesSel').value; $('#seriesSel').innerHTML = '<option value="">＋ New series</option>' + SERIES.map((x) => `<option value="${esc(x.id)}">${esc(x.title)} (${x.episodes} ep · ${x.characters} characters)</option>`).join(''); $('#seriesSel').value = v; seriesInfo(); }
async function seriesInfo() { const id = $('#seriesSel').value; $('#serTitleL').hidden = !!id; if (!id) { $('#seriesInfo').textContent = 'A new series: episode 1 introduces the characters. Everything (story, characters with names, looks and voices, backgrounds) is saved so the next episode continues it.'; return; }
  const s = await api.call('series:get', id); $('#seriesInfo').innerHTML = `Next: <b>episode ${s.episodes.length + 1}</b> · ${esc(O?.categories[s.category]?.label || s.category)} · ${esc(s.language)} · characters: ${esc(s.castFull.map((c) => c.name).join(', ') || '—')}${s.episodes.length ? '<br>Last: ' + esc(s.episodes.at(-1).title) : ''}`;
  if (s.category && O.categories[s.category]) { cat = s.category; $$('#cats .chip').forEach((c) => c.classList.toggle('on', c.dataset.k === cat)); } if (s.style) $('#style').value = s.style; if (s.language) { LANG = s.language; $$('#lang .chip').forEach((c) => c.classList.toggle('on', c.dataset.l === LANG)); langNote(); } if (s.bgMode) { BGM = s.bgMode; $$('#bgMode .chip').forEach((c) => c.classList.toggle('on', c.dataset.b === BGM)); } }
$('#seriesSel').onchange = seriesInfo;
function drawTopics() { $('#topicList').innerHTML = TOPICS.map((t, i) => `<div class="topic${topicSel.has(i) ? ' on' : ''}" data-i="${i}"><input type="checkbox"${topicSel.has(i) ? ' checked' : ''}><div><b>${esc(t.title)}</b><div class="small">${esc(t.summary)}</div><div class="src">${esc([t.place, t.date, t.source].filter(Boolean).join(' · '))}${t.real ? ' · real' : ''}</div></div></div>`).join('');
  $('#topicMsg').className = 'small muted'; if (TOPICS.length) $('#topicMsg').textContent = FMT === 'series' ? `${TOPICS.length} topics · pick ONE for the series` : `${TOPICS.length} topics · ${topicSel.size} picked (each picked topic = one video)`; }
$('#topicList').onclick = (e) => { const d = e.target.closest('.topic'); if (!d) return; const i = +d.dataset.i; if (FMT === 'series') topicSel = new Set(topicSel.has(i) ? [] : [i]); else toggleIn(topicSel, i); drawTopics(); };
$('#findTopics').onclick = async () => { const b = $('#findTopics'); b.disabled = true; $('#topicMsg').className = 'small muted'; $('#topicMsg').textContent = $('#topicMode').value === 'real' ? 'Searching recent real stories with Gemini + Google Search…' : 'Gemini is inventing ideas…';
  try { const r = await api.call('topics:find', { category: cat, mode: $('#topicMode').value, language: LANG, series: FMT === 'series', extra: $('#topicExtra').value, storyAI: $('#storySrc').value });
    if (!r.ok) { $('#topicMsg').className = 'small warn'; $('#topicMsg').textContent = r.msg; return; } TOPICS = r.topics; topicSel = new Set(); drawTopics(); } finally { b.disabled = false; } };
api.on('topics:log', (m) => { $('#topicMsg').textContent = m; });
async function loadCastPick() { CAST = await api.call('cast:list'); castSel = new Set([...castSel].filter((id) => CAST.some((c) => c.id === id)));
  const lv = $('#leadSel').value; $('#leadSel').innerHTML = '<option value="">AI creates one for this genre</option>' + CAST.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}${c.role ? ' — ' + esc(c.role) : ''}</option>`).join(''); $('#leadSel').value = CAST.some((c) => c.id === lv) ? lv : '';
  $('#castPick').innerHTML = CAST.length ? CAST.map((c) => `<span class="chip${castSel.has(c.id) ? ' on' : ''}" data-id="${esc(c.id)}" title="${esc([c.role, c.age, c.gender, (c.styles || []).join('/')].join(' · '))}"><span class="dot" style="background:${esc(c.top_color || c.skin_color || '#888')}"></span>${esc(c.name)}<small class="muted">${esc(c.role || '')}</small></span>`).join('') : '<span class="small muted">No saved characters yet — every video you make adds its characters here (and to the Characters tab).</span>'; }
$('#castPick').onclick = (e) => { const c = e.target.closest('.chip'); if (!c?.dataset.id) return; toggleIn(castSel, c.dataset.id); c.classList.toggle('on'); };

// ---------- queue ----------
const STATUS = { queued: 'Queued', running: 'Rendering', done: 'Ready ✓', error: 'Error', cancelled: 'Cancelled' };
const STAGE_NAMES = { story: 'Story', voice: 'Voices', sound: 'Music & sound', render: '3D render', save: 'Save MP4' };
const WEIGHT = { story: 0.06, voice: 0.04, sound: 0.02, render: 0.85, save: 0.03 };
function overall(j) { if (j.status === 'done') return 1; if (!j.stages) return 0; let p = 0;
  for (const [k, w] of Object.entries(WEIGHT)) { const st = j.stages[k]; if (!st) continue; p += w * (st.state === 'done' ? 1 : st.state === 'active' && st.total ? Math.min(1, st.done / st.total) : 0); } return p; }
function stepper(j) {
  if (!j.stages) return '';
  return `<div class="steps">${Object.keys(STAGE_NAMES).map((k, i) => { const st = j.stages[k] || {}; const icon = st.state === 'done' ? '✓' : st.state === 'active' ? '●' : st.state === 'failed' ? '✕' : '○';
    const count = st.total > 1 ? ` ${st.done}/${st.total}` : '';
    return `<div class="step ${st.state || 'todo'}"><span class="ic">${icon}</span><span><b>${i + 1}. ${STAGE_NAMES[k]}</b>${count}<br><small>${esc(st.state === 'active' ? st.label : st.state === 'done' ? 'done' : st.state === 'failed' ? 'failed' : 'waiting')}</small></span></div>`; }).join('')}</div>`;
}
function renderQueue(q) {
  const c = q.counts || {}; const left = q.jobs.filter((j) => j.status === 'queued' || j.status === 'running').length;
  $('#qbadge').hidden = !left; $('#qbadge').textContent = left;
  $('#qRemain').textContent = left ? fmt(q.remainSec) + ' left' : 'Empty';
  $('#qInfo').textContent = left ? `${c.current ? `Video ${c.current} of ${c.total}` : `${c.total} video(s)`} · ${c.done || 0} done${c.failed ? ` · ${c.failed} failed` : ''} · ${c.waiting} waiting · finishes around ${clock(q.finishAt)}${q.autoRun ? '' : ' (press Start)'}` : (c.total ? `All done · ${c.done} ready${c.failed ? ` · ${c.failed} failed` : ''}` : 'Add videos from the New Video tab');
  $('#qStart').disabled = q.autoRun; $('#qPause').disabled = !q.autoRun;
  $('#qList').innerHTML = q.jobs.slice().reverse().map((j) => { const o = j.opts || {}; const p = Math.round(overall(j) * 100);
    return `<div class="card job"><div><span class="t">${esc(j.title || (O?.categories[o.category]?.label || o.category))}</span><span class="pill ${j.status}">${STATUS[j.status] || j.status}${j.status === 'running' ? ' ' + p + '%' : ''}</span>
      <div class="meta">${esc(O?.categories[o.category]?.label || '')} · ${o.minutes} min · ${esc(o.style)}${o.myStory ? ' · my story (' + o.myStory.split(/\s+/).length + ' words)' : o.idea ? ' · ' + esc(o.idea.slice(0, 60)) : ''}${o.demo ? ' · demo' : ''}</div>
      ${j.status === 'running' ? `<div class="bar"><div style="width:${p}%"></div></div>${stepper(j)}<div class="meta">${esc(j.msg || '')}</div><div class="meta">Elapsed ${fmt(j.elapsed)}${j.eta ? ' · about ' + fmt(j.eta) + ' left' : ''}</div>` : ''}
      ${j.status === 'queued' ? `<div class="meta">${j.retryAt ? esc(j.msg) : 'Estimate: ' + fmt(j.estimate?.total)}</div>${j.retryAt && j.error ? `<div class="meta warn">${esc(j.error)}</div>` : ''}` : ''}
      ${j.status === 'done' ? `<div class="meta">Made in ${fmt(j.elapsed)}${j.duration ? ' · video ' + fmt(j.duration) : ''}</div>` : ''}
      ${j.status === 'error' ? `${stepper(j)}<div class="meta warn">${esc(j.error)}</div>` : ''}</div>
      <div class="acts">${j.status === 'queued' ? `<button data-a="up" data-id="${j.id}">↑</button><button data-a="down" data-id="${j.id}">↓</button>` : ''}
        ${j.status === 'queued' && j.retryAt ? `<button data-a="retryNow" data-id="${j.id}">Retry now</button>` : ''}
        ${j.status === 'running' || j.status === 'queued' ? `<button data-a="cancel" data-id="${j.id}">Cancel</button>` : ''}
        ${j.status === 'error' || j.status === 'cancelled' ? `<button data-a="retry" data-id="${j.id}">Retry</button>` : ''}
        ${j.status === 'done' ? `<button data-a="open" data-id="${esc(j.folder)}">Open folder</button>` : ''}
        ${j.status !== 'running' ? `<button data-a="remove" data-id="${j.id}">✕</button>` : ''}</div></div>`; }).join('');
}
$('#qList').onclick = async (e) => { const b = e.target.closest('button'); if (!b) return; const id = b.dataset.id, a = b.dataset.a;
  if (a === 'open') return api.call('library:open', id.split(/[\\/]/).pop());
  const map = { up: ['queue:move', { id, dir: 1 }], down: ['queue:move', { id, dir: -1 }], cancel: ['queue:cancel', id], retry: ['queue:retry', id], retryNow: ['queue:retryNow', id], remove: ['queue:remove', id] };
  renderQueue(await api.call(...map[a])); };
$('#qStart').onclick = async () => renderQueue(await api.call('queue:start'));
$('#qPause').onclick = async () => renderQueue(await api.call('queue:pause'));
$('#qClear').onclick = async () => renderQueue(await api.call('queue:clearDone'));
api.on('queue', renderQueue);

// ---------- library ----------
async function loadLibrary() {
  const list = await api.call('library:list'); $('#libPath').textContent = (S?.dataDir || '') + '\\Videos';
  $('#libList').innerHTML = list.length ? list.map((v) => `<div class="card lib"><video src="${v.video}#t=4" preload="metadata" data-play="${v.video}"></video><div class="t">${esc(v.title)}</div>
    <div class="muted small">${new Date(v.created).toLocaleString('en-IN')} · ${v.sizeMB} MB</div><div class="btns"><button class="ghost" data-subs="${esc(v.dir)}">Subtitles</button><button class="ghost" data-open="${esc(v.dir)}">Folder</button><button class="danger" data-del="${esc(v.dir)}">Delete</button></div></div>`).join('') : '<div class="muted">No videos yet.</div>';
}
$('#libList').onclick = async (e) => { const t = e.target;
  if (t.dataset.play) { $('#playerVideo').src = t.dataset.play; $('#player').hidden = false; $('#playerVideo').play(); }
  if (t.dataset.open) api.call('library:open', t.dataset.open);
  if (t.dataset.subs) openSubEd(t.dataset.subs, t.closest('.lib')?.querySelector('.t')?.textContent || '');
  if (t.dataset.del && confirm('Delete this video?')) { await api.call('library:delete', t.dataset.del); loadLibrary(); } };
$('#playerClose').onclick = () => { $('#playerVideo').pause(); $('#player').hidden = true; };
$('#libOpen').onclick = () => api.call('library:open'); $('#libRefresh').onclick = loadLibrary;

// ---------- characters ----------
let chars = [], sel = null;
async function loadCastList() { const list = await api.call('cast:list'); VOICES ||= await api.call('voice:list');
  $('#castList').innerHTML = list.length ? list.map((c) => `<div class="castc" data-id="${esc(c.id)}"><b>${esc(c.name)}</b><div class="small muted">${esc([c.role, c.gender, c.age].filter(Boolean).join(' · '))}${(c.series || []).length ? ' · series' : ''} · used ${c.used || 0}×</div>
    <div class="sw">${['skin_color', 'top_color', 'bottom_color', 'hair_color', 'hat_color'].filter((k) => c[k]).map((k) => `<i title="${k}" style="background:${esc(c[k])}"></i>`).join('')}${c.hat && c.hat !== 'none' ? `<small>${esc(c.hat)}</small>` : ''}</div>
    <select data-voice="${esc(c.id)}"><option value="">Voice: auto</option>${VOICES.map((v) => `<option value="${v.id}"${v.id === c.voice ? ' selected' : ''}>${esc(v.label)}</option>`).join('')}</select>
    <div class="btns"><button class="danger" data-castdel="${esc(c.id)}">Delete</button></div></div>`).join('') : '<div class="small muted">None yet — make a video and its characters appear here.</div>'; }
$('#castList').onchange = async (e) => { const id = e.target.dataset.voice; if (id) await api.call('cast:update', { id, patch: { voice: e.target.value } }); };
$('#castList').onclick = async (e) => { const id = e.target.dataset.castdel; if (id && confirm('Delete this saved character?')) { await api.call('cast:delete', id); loadCastList(); loadCastPick(); } };
async function loadChars() { loadCastList(); chars = await api.call('chars:list');
  $('#chList').innerHTML = chars.map((c) => `<div class="ch${sel === c.id ? ' on' : ''}" data-id="${c.id}"><div class="t">${esc(c.name)}</div><div class="tags">${c.gender === 'female' ? 'Female' : 'Male'} · ${esc(c.age)} · ${esc((c.styles || []).join('/'))}</div>
    <div class="tags">${esc((c.tags || []).join(', '))}${c.builtin ? ' · built-in' : ''}</div></div>`).join('');
  if (!sel && chars[0]) pick(chars[0].id); }
let VOICES = null; const audio = new Audio();
async function fillVoices(c) { VOICES ||= await api.call('voice:list'); const v = document.querySelector('#chForm [name=voice]');
  v.innerHTML = '<option value="">Auto (by gender / age)</option>' + VOICES.map((x) => `<option value="${x.id}">${esc(x.label)}</option>`).join(''); v.value = c.voice || ''; }
$('#chPlay').onclick = async () => { const c = chars.find((y) => y.id === sel); const v = document.querySelector('#chForm [name=voice]').value || (VOICES || []).find((x) => c && x.gender === c.gender && x.age === c.age)?.id || (VOICES || []).find((x) => c && x.gender === c.gender)?.id;
  if (!v) return; $('#chPlay').textContent = '…'; try { audio.src = await api.call('voice:sample', v); await audio.play(); } finally { $('#chPlay').textContent = '▶ Play'; } };
async function pick(id) { sel = id; const c = chars.find((x) => x.id === id); $$('.ch').forEach((x) => x.classList.toggle('on', x.dataset.id === id)); if (!c) return;
  const f = $('#chForm'); f.name.value = c.name; f.gender.value = c.gender; f.age.value = c.age; f.tags.value = (c.tags || []).join(', ');
  for (const s of ['toon', 'anime', 'realistic']) f['st_' + s].checked = (c.styles || []).includes(s);
  await fillVoices(c);
  [...f.elements].forEach((el) => (el.disabled = !!c.builtin && el.name !== 'voice' && el.type !== 'submit')); $('#chDelete').hidden = !!c.builtin;
  $('#chInfo').textContent = 'Loading…';
  const r = await window.AVPreview.show($('#chCanvas'), c);
  $('#chInfo').innerHTML = r.ok ? `✓ Works · ${r.rig || ''} · lip-sync: ${r.lipSync ? 'yes' : 'no (head moves only)'}${c.builtin ? ' · built-in (read-only)' : ''}` : `<span class="warn">✗ ${esc(r.error)}</span>${/FBX version not supported|FileVersion: [0-6]\d{3}/i.test(r.error || '') && !c.builtin ? ' <button type="button" class="primary" id="chConvert">Convert to the new format</button><div class="small muted">This FBX is the old 6.x format. The app converts it to GLB (one time, downloads a free 4 MB converter).</div>' : ''}`;
  const cb = $('#chConvert'); if (cb) cb.onclick = async () => { cb.disabled = true; cb.textContent = 'Converting…'; try { await api.call('chars:convert', c.id); await loadChars(); pick(c.id); } catch (err) { $('#chInfo').innerHTML = `<span class="warn">✗ ${esc(String(err.message || err).replace(/^Error invoking remote method[^:]*: (Error: )?/, ''))}</span>`; } }; }
$('#chList').onclick = (e) => { const d = e.target.closest('.ch'); if (d) pick(d.dataset.id); };
$('#chForm').onsubmit = async (e) => { e.preventDefault(); const f = e.target; const styles = ['toon', 'anime', 'realistic'].filter((s) => f['st_' + s].checked);
  const c = chars.find((x) => x.id === sel); await api.call('chars:update', { id: sel, patch: c.builtin ? { voice: f.voice.value } : { name: f.name.value, gender: f.gender.value, age: f.age.value, tags: f.tags.value.split(',').map((x) => x.trim()).filter(Boolean), styles, voice: f.voice.value } }); loadChars(); };
$('#chDelete').onclick = async () => { if (confirm('Delete this character?')) { await api.call('chars:delete', sel); sel = null; loadChars(); } };
$('#chImport').onclick = async () => { const r = await api.call('chars:import', {}); if (r.length) { sel = r[0].id; loadChars(); } };
$('#chFolder').onclick = () => api.call('chars:openFolder');
const dz = $('#tab-chars'); dz.ondragover = (e) => { e.preventDefault(); dz.classList.add('drop'); }; dz.ondragleave = () => dz.classList.remove('drop');
dz.ondrop = async (e) => { e.preventDefault(); dz.classList.remove('drop'); const paths = [...e.dataTransfer.files].map((f) => api.pathOf(f)).filter((p) => /\.(vrm|glb|gltf|fbx)$/i.test(p));
  if (paths.length) { const r = await api.call('chars:importPaths', paths); sel = r[0]?.id; loadChars(); } };

// ---------- backgrounds ----------
let BG = { list: [], places: {} }, bsel = null, seatMode = false, pend = null, msel = -1;
const MK = { seat: ['Seat', '#ff6b6b'], desk: ['Behind desk (sits)', '#ffb547'], judge: ['Judge bench', '#c792ea'], witness: ['Witness box', '#6ab0ff'], counter: ['Behind counter (stands)', '#4cd486'], bed: ['Bed (lies down)', '#ff9ad5'], cell: ['Jail cell (bars)', '#a0a8b8'], board: ['Blackboard spot', '#ffe66b'], climb: ['Climb to (tree / wall top)', '#9be15d'], window: ['Window (moving view)', '#8fd3ff'], door: ['Door', '#d0a060'] };
const COVER = new Set(['desk', 'judge', 'witness', 'counter', 'cell', 'window']); const WDEF = { judge: 0.26, desk: 0.22, bed: 0.3, witness: 0.12, counter: 0.22, cell: 0.24, window: 0.3 };
async function loadBgs() {
  BG = await api.call('bg:list');
  $('#bgList').innerHTML = BG.list.length ? BG.list.map((b) => `<div class="bgc${bsel === b.id ? ' on' : ''}" data-id="${b.id}"><img src="${b.url}" loading="lazy"><div class="t">${esc(b.name)}</div><div class="tags">${esc((BG.places[b.place] || b.place || '').split(' (')[0])} · ${esc(b.time)}${b.tags?.length ? ' · ' + esc(b.tags.join(', ')) : ''}</div></div>`).join('')
    : '<div class="muted">No backgrounds yet. Import empty painted scenes (see the prompts file).</div>';
  $('#bgForm').place.innerHTML = Object.entries(BG.places).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
  $('#bgPanel').hidden = !BG.list.length; if (BG.list.length) bpick(BG.list.find((b) => b.id === bsel) ? bsel : BG.list[0].id);
}
const curBg = () => BG.list.find((b) => b.id === bsel);
function drawBg() {
  const b = curBg(); if (!b) return; $('#bgNear').style.top = b.groundNear * 100 + '%'; $('#bgFar').style.top = b.groundFar * 100 + '%'; $('#bgH').value = b.heightNear;
  const farScale = Math.max(0.45, 1 - (b.groundNear - b.groundFar) * 1.9); const ih = $('#bgImg').clientHeight || 300;
  $('#bgFigs').innerHTML = [[0.3, b.groundNear, 1], [0.7, b.groundFar, farScale]].map(([x, y, k]) => `<div class="fig" style="left:${x * 100}%;top:${y * 100}%"><div style="height:${b.heightNear * k * ih}px;width:${b.heightNear * k * ih * 0.32}px"></div></div>`).join('');
  const ms = b.seats || [];
  $('#bgSeats').innerHTML = ms.map((p, i) => { const [lab, c] = MK[p.type || 'seat'] || MK.seat; const w = p.w || WDEF[p.type] || 0;
    const rect = (p.cover != null || p.type === 'cell' || p.type === 'bed') && w ? `<div class="mrect${i === msel ? ' on' : ''}" style="left:${(p.x - w / 2) * 100}%;width:${w * 100}%;top:${(p.type === 'bed' ? p.y - 0.06 : p.cover ?? p.y - b.heightNear * 1.3) * 100}%;height:${(p.type === 'bed' ? 0.06 : p.y - (p.cover ?? p.y - b.heightNear * 1.3)) * 100}%;border-color:${c}"></div>` : '';
    return `${rect}<div class="seat${i === msel ? ' on' : ''}" data-i="${i}" title="${lab}" style="left:${p.x * 100}%;top:${p.y * 100}%;background:${c}"><span>${esc(lab.split(' (')[0])}</span></div>`; }).join('');
  $('#bgMarks').innerHTML = ms.map((p, i) => `<span class="mchip${i === msel ? ' on' : ''}" data-i="${i}" style="border-color:${(MK[p.type || 'seat'] || MK.seat)[1]}">${esc((MK[p.type || 'seat'] || MK.seat)[0])} <b data-del="${i}">×</b></span>`).join('') || '<span class="muted small">No places marked yet.</span>';
  const m = ms[msel]; $('#bgWWrap').hidden = !(m && (COVER.has(m.type) || m.type === 'bed')); if (m) $('#bgW').value = m.w || WDEF[m.type] || 0.2;
}
function bpick(id) {
  bsel = id; const b = curBg(); $$('.bgc').forEach((x) => x.classList.toggle('on', x.dataset.id === id)); $('#bgImg').src = b.url; $('#bgImg').onload = drawBg;
  const f = $('#bgForm'); f.name.value = b.name; f.place.value = b.place || 'other'; f.time.value = b.time || 'day'; f.tags.value = (b.tags || []).join(', '); f.indoor.checked = !!b.indoor; drawBg();
}
$('#bgList').onclick = (e) => { const d = e.target.closest('.bgc'); if (d) bpick(d.dataset.id); };
const bgSave = (patch) => { const b = curBg(); Object.assign(b, patch); drawBg(); return api.call('bg:update', { id: b.id, patch }); };
for (const [el, key] of [['#bgNear', 'groundNear'], ['#bgFar', 'groundFar']]) $(el).onpointerdown = (e) => {
  e.preventDefault(); const box = $('#bgEdit').getBoundingClientRect();
  const mv = (ev) => { const y = Math.min(0.99, Math.max(0.3, (ev.clientY - box.top) / box.height)); const b = curBg(); b[key] = +y.toFixed(3); if (b.groundFar > b.groundNear - 0.02) b.groundFar = +(b.groundNear - 0.02).toFixed(3); drawBg(); };
  const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); const b = curBg(); bgSave({ groundNear: b.groundNear, groundFar: b.groundFar }); };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
};
$('#bgH').oninput = () => { curBg().heightNear = +$('#bgH').value; drawBg(); }; $('#bgH').onchange = () => bgSave({ heightNear: +$('#bgH').value });
$('#bgSeat').onclick = () => { seatMode = true; pend = null; $('#bgHint').textContent = 'Click where the feet go' + ($('#bgMType').value === 'bed' ? ' (on the mattress, middle of the bed)' : '') + '…'; };
$('#bgClearSeats').onclick = () => { msel = -1; bgSave({ seats: [] }); };
$('#bgMarks').onclick = (e) => { const d = e.target.closest('[data-del]'); if (d) { const b = curBg(); const ms = [...(b.seats || [])]; ms.splice(+d.dataset.del, 1); msel = -1; bgSave({ seats: ms }); return; } const c = e.target.closest('.mchip'); if (c) { msel = +c.dataset.i; drawBg(); } };
$('#bgW').oninput = () => { const b = curBg(); const m = b.seats?.[msel]; if (m) { m.w = +$('#bgW').value; drawBg(); } }; $('#bgW').onchange = () => bgSave({ seats: curBg().seats });
$('#bgEdit').onclick = (e) => {
  const dot = e.target.closest('.seat'); if (!seatMode && dot) { msel = +dot.dataset.i; drawBg(); return; }
  if (!seatMode || e.target.closest('.gline')) return; const box = $('#bgImg').getBoundingClientRect(); const b = curBg();
  const x = +((e.clientX - box.left) / box.width).toFixed(3), y = +((e.clientY - box.top) / box.height).toFixed(3); const type = $('#bgMType').value;
  if (!pend) { pend = { type, x, y }; if (COVER.has(type)) { $('#bgHint').textContent = type === 'cell' ? 'Now click where the top of the bars should be…' : type === 'bed' ? 'Now click the top edge of the blanket / bed side (the body is hidden below it)…' : 'Now click the TOP EDGE of the ' + (type === 'witness' ? 'witness box' : type === 'judge' ? "judge's bench" : type) + ' (everything below it hides the person)…'; return; } }
  else pend.cover = Math.min(y, pend.y - 0.01);
  if (COVER.has(pend.type) || pend.type === 'bed') pend.w = WDEF[pend.type];
  const ms = [...(b.seats || []), pend]; msel = ms.length - 1; pend = null; seatMode = false; $('#bgHint').textContent = ''; bgSave({ seats: ms });
};
$('#bgForm').onsubmit = async (e) => { e.preventDefault(); const f = e.target; await bgSave({ name: f.name.value, place: f.place.value, time: f.time.value, indoor: f.indoor.checked, tags: f.tags.value.split(',').map((x) => x.trim()).filter(Boolean) }); loadBgs(); };
$('#bgDelete').onclick = async () => { if (confirm('Delete this background?')) { await api.call('bg:delete', bsel); bsel = null; loadBgs(); } };
$('#bgImport').onclick = async () => { const r = await api.call('bg:import'); if (r.length) { bsel = r[0].id; loadBgs(); } };
$('#bgFolder').onclick = () => api.call('bg:openFolder');
const bz = $('#tab-bgs'); bz.ondragover = (e) => { e.preventDefault(); bz.classList.add('drop'); }; bz.ondragleave = () => bz.classList.remove('drop');
bz.ondrop = async (e) => { e.preventDefault(); bz.classList.remove('drop'); const paths = [...e.dataTransfer.files].map((f) => api.pathOf(f)).filter((p) => /\.(jpe?g|png|webp)$/i.test(p)); if (paths.length) { const r = await api.call('bg:importPaths', paths); bsel = r[0]?.id; loadBgs(); } };

// ---------- settings ----------
function ensureMine(force) { if ((force || S?.hasSubStyle) && !$('#subs option[value=mine]')) $('#subs').insertAdjacentHTML('beforeend', '<option value="mine">My style (saved in the subtitle editor)</option>'); }
async function loadSettings() { S = await api.call('settings:get'); ensureMine(); $('#conc').value = S.concurrency; $('#dataDir').textContent = S.dataDir;
  $$('input[name=renderer]').forEach((r) => (r.checked = r.value === S.renderer)); $('#keyWarn').hidden = S.hasKey || src() !== 'api'; }
$('#conc').onchange = () => api.call('settings:set', { concurrency: Math.max(1, Math.min(8, +$('#conc').value || 2)) });
$$('input[name=renderer]').forEach((r) => (r.onchange = async () => { await api.call('settings:set', { renderer: r.value }); est(); }));
$('#openData').onclick = () => api.call('open:data'); $('#reSetup').onclick = () => checkSetup(true);

// ---------- first run ----------
async function checkSetup(force) {
  const st = await api.call('setup:status'); if (st.done && !force) return;
  $('#boot').hidden = true; $('#setup').hidden = false; $('#setupRetry').hidden = true; $('#setupMsg').textContent = 'Preparing voices and models (first time only)…';
  try { const r = await api.call('setup:run'); if (r.done) { $('#setupMsg').textContent = 'All ready ✓'; setTimeout(() => ($('#setup').hidden = true), 800); } else throw new Error('Still missing: ' + r.missing.join(', ')); }
  catch (e) { $('#boot').hidden = true; $('#setupMsg').innerHTML = `<span class="warn">Download stopped: ${esc(e.message)}. Check the internet and try again.</span>`; $('#setupRetry').hidden = false; }
}
api.on('setup:progress', (p) => { const pct = ((p.index + (p.total ? p.got / p.total : 0)) / p.count) * 100; $('#setupBar').style.width = pct.toFixed(1) + '%';
  $('#setupMsg').textContent = `${p.label} ${p.total > 1 ? Math.round((p.got / p.total) * 100) + '%' : ''} (${Math.min(p.index + 1, p.count)}/${p.count})`; });
$('#setupRetry').onclick = () => checkSetup(true);

// ---------- Story AI ----------
let AI = null;
function fillStorySrc() { const cur = $('#storySrc').value || 'auto'; const P = AI.providers; const withKey = Object.entries(P).filter(([, p]) => p.hasKey);
  const order = [AI.primary, ...Object.keys(P).filter((n) => n !== AI.primary)].filter((n) => P[n]?.hasKey).map((n) => P[n].label).join(' → ');
  $('#storySrc').innerHTML = (withKey.length ? `<option value="auto">Auto: ${esc(order)}</option>` : '') + withKey.map(([n, p]) => `<option value="${n}">${esc(p.label)}${p.model ? ' · ' + esc(p.model) : ''}</option>`).join('') +
    '<option value="paste">Paste from Gemini app (no API)</option><option value="demo">Demo story (test)</option>';
  $('#storySrc').value = [...$('#storySrc').options].some((o) => o.value === cur) ? cur : withKey.length ? 'auto' : 'paste'; $('#storySrc').onchange(); }
function showProv() { const n = $('#aiProv').value, p = AI.providers[n];
  $('#aiFree').textContent = p.free; $('#aiKeyLink').innerHTML = p.keyUrl ? `· get a key: ${esc(p.keyUrl)}` : ''; $('#aiBaseWrap').hidden = n !== 'custom'; $('#aiBase').value = p.baseUrl || '';
  $('#aiKey').value = ''; $('#aiKey').placeholder = p.hasKey ? `Saved: ${p.keyHint}` : 'Paste key';
  $('#aiModel').innerHTML = `<option value="">Auto (best free model)</option>${p.model ? `<option value="${esc(p.model)}">${esc(p.model)}</option>` : ''}`; $('#aiModel').value = p.model || '';
  $('#aiPrimary').checked = AI.primary === n; $('#aiFallback').checked = AI.fallback; $('#aiMsg').textContent = '';
  const order = [AI.primary, ...Object.keys(AI.providers).filter((x) => x !== AI.primary)].filter((x) => AI.providers[x].hasKey);
  $('#aiOrder').textContent = order.length ? 'Order used for videos: ' + (AI.fallback ? order : order.slice(0, 1)).map((x) => AI.providers[x].label + (AI.providers[x].model ? ` (${AI.providers[x].model})` : '')).join(' → ') : 'No AI key saved yet.';
  if (p.hasKey) loadModels(); }
async function loadAI() { AI = await api.call('ai:get'); const cur = $('#aiProv').value || AI.primary;
  $('#aiProv').innerHTML = Object.entries(AI.providers).map(([n, p]) => `<option value="${n}">${esc(p.label)}${p.hasKey ? ' ✓' : ''}</option>`).join(''); $('#aiProv').value = cur; showProv(); fillStorySrc(); }
async function loadModels() { const n = $('#aiProv').value; $('#aiMsg').textContent = 'Loading models…'; const r = await api.call('ai:models', n); if (n !== $('#aiProv').value) return;
  if (!r.ok) { $('#aiMsg').className = 'small warn'; $('#aiMsg').textContent = r.msg; return; }
  const sel = AI.providers[n].model; $('#aiModel').innerHTML = '<option value="">Auto (best free model)</option>' + r.ids.map((id) => `<option value="${esc(id)}">${esc(id)}</option>`).join(''); $('#aiModel').value = sel && r.ids.includes(sel) ? sel : '';
  $('#aiMsg').className = 'small muted'; $('#aiMsg').textContent = `${r.ids.length} models available on this key.`; }
$('#aiProv').onchange = showProv; $('#aiRefresh').onclick = loadModels;
$('#aiSave').onclick = async () => { const n = $('#aiProv').value; const o = { provider: n }; if ($('#aiKey').value.trim()) o.key = $('#aiKey').value.trim(); if (n === 'custom') o.baseUrl = $('#aiBase').value.trim();
  if (!AI.providers[AI.primary]?.hasKey) o.primary = true; AI = await api.call('ai:set', o); S = await api.call('settings:get'); await loadAI(); $('#aiMsg').className = 'small'; $('#aiMsg').textContent = 'Saved ✓'; };
$('#aiModel').onchange = async () => { AI = await api.call('ai:set', { provider: $('#aiProv').value, model: $('#aiModel').value }); fillStorySrc(); showProv(); };
$('#aiPrimary').onchange = async () => { if ($('#aiPrimary').checked) { AI = await api.call('ai:set', { provider: $('#aiProv').value, primary: true }); await loadAI(); } };
$('#aiFallback').onchange = async () => { AI = await api.call('ai:set', { provider: $('#aiProv').value, fallback: $('#aiFallback').checked }); await loadAI(); };
$('#aiTest').onclick = async () => { $('#aiMsg').className = 'small'; $('#aiMsg').textContent = 'Testing…'; const r = await api.call('ai:test', $('#aiProv').value); $('#aiMsg').className = 'small ' + (r.ok ? '' : 'warn'); $('#aiMsg').textContent = r.msg; };

// ---------- updates ----------
let queueBusy = false;
function renderUpd(u) {
  $('#ver').textContent = 'v' + (u.current || '');
  const map = { idle: '', checking: 'Checking for updates…', latest: `You have the latest version (v${u.current}) ✓`, available: `New version v${u.version} is available.`, downloading: `Downloading v${u.version || ''}… ${u.percent || 0}%`,
    ready: `v${u.version} downloaded. Restart to install.`, error: `Update: ${u.msg || 'error'}`, dev: 'Updates work in the installed app.' };
  $('#updStatus').textContent = map[u.state] ?? ''; $('#updStatus').className = 'small ' + (u.state === 'error' ? 'warn' : '');
  $('#updDownload').hidden = u.state !== 'available'; $('#updInstall').hidden = u.state !== 'ready';
  $('#updBarWrap').hidden = u.state !== 'downloading'; $('#updBar').style.width = (u.percent || 0) + '%';
  $('#updBtn').hidden = !['available', 'downloading', 'ready'].includes(u.state);
  $('#updBtn').textContent = u.state === 'ready' ? 'Restart & install' : u.state === 'downloading' ? `Updating ${u.percent || 0}%` : `Update to v${u.version}`;
}
api.on('update', renderUpd);
$('#updCheck').onclick = async () => renderUpd(await api.call('update:check'));
$('#updDownload').onclick = async () => renderUpd(await api.call('update:download'));
async function install() { if (queueBusy && !confirm('A video is rendering. Restart now and continue it after the update?')) return; await api.call('update:install'); }
$('#updInstall').onclick = install;
$('#updBtn').onclick = async () => { const u = await api.call('update:get'); if (u.state === 'available') renderUpd(await api.call('update:download')); else if (u.state === 'ready') install(); else $('[data-tab=settings]').click(); };
api.on('queue', (q) => (queueBusy = q.running));

(async () => { const setup = checkSetup(false).catch(() => {}); // first-run setup starts at once (also before sign-in)
  try { renderUpd(await api.call('update:get')); await loadSettings(); await loadAI(); await initNew(); renderQueue(await api.call('queue:get')); } catch {} finally { $('#boot').hidden = true; } await setup; })();
// background work started by the app itself (team data update after sign-in…): a small box with a progress bar
api.on('busy', (b) => { $('#busy').hidden = !b || b.done; if (!b || b.done) return; $('#busyTitle').textContent = b.title || 'Working…'; $('#busyBar').style.width = (b.n ? Math.round((b.i / b.n) * 100) : 0) + '%'; $('#busyMsg').textContent = b.label ? `${b.label}${b.n ? ` (${b.i}/${b.n})` : ''}` : ''; });

// ---------- subtitle editor ----------
let SE = null; const seF = (id) => document.getElementById(id);
const SE_MAP = { font: 'seFont', lang: 'seLang', position: 'sePos', size: 'seSize', margin: 'seMargin', outlineW: 'seOutW', color: 'seColor', nameColor: 'seNameColor', outline: 'seOutline', boxColor: 'seBoxColor', boxOpacity: 'seBoxOp', karaokeColor: 'seKColor', box: 'seBox', showName: 'seName', karaoke: 'seKara', italic: 'seItalic', upper: 'seUpper' };
const PRESET_LABEL = { classic: 'Classic (box)', youtube: 'YouTube bold', karaoke: 'Karaoke', cinematic: 'Cinematic', dual: 'Hinglish + English', hindi: 'Hindi', kids: 'Kids (handwritten)', none: 'No subtitles' };
async function openSubEd(dir, title) {
  const d = await api.call('subs:load', dir); SE = { dir, ...d, cur: -1 };
  seF('seTitle').textContent = 'Edit subtitles — ' + title; seF('seWarn').hidden = d.canBurn; seF('seSave').textContent = d.canBurn ? 'Save & burn subtitles' : 'Save (.srt only)';
  seF('sePreset').innerHTML = '<option value="">— keep my settings —</option>' + Object.keys(d.presets).map((k) => `<option value="${k}">${PRESET_LABEL[k] || k}</option>`).join('');
  seF('seFont').innerHTML = d.fonts.map((f) => `<option>${f}</option>`).join('');
  seFill(); seLines(); seF('seVideo').src = d.video; seF('seMsg').textContent = ''; seF('subEd').hidden = false;
}
function seFill() { for (const [k, id] of Object.entries(SE_MAP)) { const el = seF(id); if (el.type === 'checkbox') el.checked = !!SE.style[k]; else el.value = SE.style[k]; } seDraw(); }
function seRead() { for (const [k, id] of Object.entries(SE_MAP)) { const el = seF(id); SE.style[k] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value; } SE.style.off = false; }
const fieldOf = () => (SE.style.lang === 'hindi' ? 'hindi' : SE.style.lang === 'english' ? 'english' : 'hinglish');
function seLines() { const f = fieldOf();
  seF('seLines').innerHTML = SE.lines.map((l, i) => `<div class="seline${i === SE.cur ? ' on' : ''}" data-i="${i}"><div class="h"><b>${esc(l.char === 'narrator' ? 'Narrator' : l.name)}</b><input type="number" step="0.1" data-k="start" value="${l.start}"> – <input type="number" step="0.1" data-k="end" value="${l.end}"></div>
    <textarea rows="2" data-k="${f}">${esc(l[f] || '')}</textarea>${SE.style.lang === 'dual' ? `<textarea rows="1" data-k="english">${esc(l.english || '')}</textarea>` : ''}</div>`).join(''); }
seF('seLines').oninput = (e) => { const row = e.target.closest('.seline'); if (!row) return; const l = SE.lines[+row.dataset.i]; const k = e.target.dataset.k; l[k] = k === 'start' || k === 'end' ? +e.target.value : e.target.value; seDraw(); };
seF('seLines').onclick = (e) => { const row = e.target.closest('.seline'); if (!row || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return; const l = SE.lines[+row.dataset.i]; seF('seVideo').currentTime = l.start + 0.05; };
for (const id of Object.values(SE_MAP)) seF(id).addEventListener('input', () => { const langBefore = SE.style.lang; seRead(); if (SE.style.lang !== langBefore) seLines(); seDraw(); });
seF('sePreset').onchange = () => { const k = seF('sePreset').value; if (!k) return; SE.style = { ...SE.presets[k] }; seFill(); seLines(); };
seF('seVideo').ontimeupdate = seDraw;
function seDraw() { if (!SE) return; const st = SE.style, v = seF('seVideo'), ov = seF('seOv'); const t = v.currentTime || 0; const i = SE.lines.findIndex((l) => t >= l.start && t < l.end + 0.15);
  if (i !== SE.cur) { SE.cur = i; document.querySelectorAll('.seline').forEach((r) => r.classList.toggle('on', +r.dataset.i === i)); }
  const l = SE.lines[i]; if (!l || st.off) { ov.innerHTML = ''; return; }
  const H = v.clientHeight || 360; const fs = (st.size / 100) * H * 1.4 * 0.72; const nar = l.char === 'narrator';
  let text = st.lang === 'hindi' ? l.hindi : st.lang === 'english' ? l.english : l.hinglish; if (st.upper) text = String(text).toUpperCase();
  if (st.karaoke && !nar) { const w = String(text).split(/\s+/); const k = Math.floor(((t - l.start) / Math.max(0.3, l.end - l.start)) * w.length); text = w.map((x, j) => `<span style="color:${j <= k ? st.karaokeColor : st.color}">${esc(x)}</span>`).join(' '); } else text = esc(text);
  const font = { Poppins: "'Poppins'", Mukta: "'Mukta'", Hind: "'Hind SemiBold'", Kalam: "'Kalam'" }[st.font] || 'sans-serif';
  const outline = st.box ? 'none' : [...Array(8)].map((_, j) => `${Math.cos(j * Math.PI / 4) * st.outlineW * 0.6}px ${Math.sin(j * Math.PI / 4) * st.outlineW * 0.6}px 0 ${st.outline}`).join(',');
  const bg = st.box ? `background:${st.boxColor}${Math.round(st.boxOpacity * 255).toString(16).padStart(2, '0')};` : '';
  const name = st.showName && !nar ? `<span style="color:${st.nameColor}">${esc(l.name)}:</span> ` : '';
  const second = st.lang === 'dual' && l.english ? `<br><span class="t" style="${bg}font-size:.72em;color:${st.secondColor || '#cfe8ff'}">${esc(l.english)}</span>` : '';
  ov.style.cssText = `font-family:${font};font-weight:700;font-size:${fs}px;color:${nar ? '#ffe9a8' : st.color};font-style:${st.italic || nar ? 'italic' : 'normal'};text-shadow:${outline};${st.position === 'top' ? `top:${st.margin}%` : st.position === 'middle' ? 'top:45%' : `bottom:${st.margin}%`}`;
  ov.innerHTML = `<span class="t" style="${bg}">${name}${text}</span>${second}`;
}
seF('seClose').onclick = () => { seF('seVideo').pause(); seF('subEd').hidden = true; SE = null; };
seF('seDefault').onclick = async () => { await api.call('subs:default', SE.style); ensureMine(true); seF('seMsg').textContent = 'Saved as your default style ✓ (New Video → Subtitles → "My style")'; };
seF('seSave').onclick = async () => { seRead(); seF('seSave').disabled = true; seF('seMsg').className = 'small'; seF('seMsg').textContent = SE.canBurn ? 'Burning subtitles… (a few minutes for a long video)' : 'Saving…';
  try { const r = await api.call('subs:save', { dir: SE.dir, lines: SE.lines, style: SE.style }); seF('seMsg').textContent = r.burned ? 'Done ✓ final.mp4 has the new subtitles.' : 'Saved ✓ subtitles.srt updated.'; loadLibrary(); }
  catch (e) { seF('seMsg').className = 'small warn'; seF('seMsg').textContent = String(e.message || e); } finally { seF('seSave').disabled = false; } };
api.on('subs:progress', (p) => { if (SE) seF('seMsg').textContent = `Burning subtitles… ${Math.round(p * 100)}%`; });

// ---------- team: licence login, data updates, admin ----------
let TM = null;
function renderTeam(v) { TM = v; if (!v) return;
  $('#login').hidden = v.ok; if (!v.ok) { $('#lgMsg').className = 'small warn'; $('#lgMsg').textContent = v.msg || ''; $('#lgDevice').textContent = 'This PC: ' + v.device; $('#lgCodeWrap').hidden = v.hasServer && !!v.code; }
  $('#teamName').textContent = v.ok ? `👤 ${v.name || ''}${v.offline ? ' (offline)' : ''}` : ''; $('#teamLogout').hidden = !v.ok || v.dev;
  $('#teamData').hidden = !(v.ok && v.serverPack > v.localPack);
  $('#tmStatus').textContent = !v.hasServer ? 'No team server set.' : `Team data on this PC: v${v.localPack}` + (v.serverPack ? ` · on the server: v${v.serverPack}` : '') + (v.serverPack > v.localPack ? ' → update available' : ' ✓');
  $('#tmAdminOpen').hidden = !v.admin; $('#tmCode').value = v.code || ''; if (v.adminUrl) $('#tmUrl').value = v.adminUrl; }
api.on('team', renderTeam); api.call('team:status').then(renderTeam);
$('#lgGo').onclick = async () => { $('#lgGo').disabled = true; $('#lgMsg').className = 'small'; $('#lgMsg').textContent = 'Checking…';
  const r = await api.call('team:login', { key: $('#lgKey').value, code: $('#lgCode').value.trim() || undefined }); $('#lgGo').disabled = false;
  if (!r.ok) { $('#lgMsg').className = 'small warn'; $('#lgMsg').textContent = r.msg; return; } renderTeam(r.view); $('#lgKey').value = ''; location.reload(); };
$('#lgKey').onkeydown = (e) => { if (e.key === 'Enter') $('#lgGo').click(); };
$('#lgAdmin').onclick = () => { $('#lgAdminBox').hidden = !$('#lgAdminBox').hidden; };
$('#lgAdminSave').onclick = async () => { try { renderTeam(await api.call('team:admin:set', { url: $('#lgUrl').value, pub: $('#lgPub').value, adm: $('#lgAdm').value })); $('#lgAdm').value = ''; openAdmin(); } catch (e) { $('#lgMsg').className = 'small warn'; $('#lgMsg').textContent = String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''); } };
$('#teamLogout').onclick = async () => { if (confirm('Log out from this PC? You need your licence key to sign in again.')) renderTeam(await api.call('team:logout')); };
const tmProgress = (bar, wrap, msg) => (p) => { $(wrap).hidden = false; $(bar).style.width = ((p.i / Math.max(1, p.n)) * 100).toFixed(0) + '%'; $(msg).textContent = `${p.label} (${p.i}/${p.n})`; };
let tmProg = null; api.on('team:progress', (p) => tmProg && tmProg(p));
async function tmSync() { tmProg = tmProgress('#tmBar', '#tmBarWrap', '#tmMsg'); $('#tmSync').disabled = true; $('#teamData').disabled = true;
  try { const r = await api.call('team:sync'); $('#tmMsg').textContent = `Team data v${r.version} ✓ (${r.changed} new / changed, ${r.removed || 0} removed)${r.note ? ' — ' + r.note : ''}`; renderTeam(await api.call('team:status')); }
  catch (e) { $('#tmMsg').textContent = String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''); } finally { $('#tmSync').disabled = false; $('#teamData').disabled = false; $('#tmBarWrap').hidden = true; } }
$('#tmSync').onclick = tmSync; $('#teamData').onclick = () => { $('[data-tab=settings]').click(); tmSync(); };
$('#tmAdminSave').onclick = async () => { try { renderTeam(await api.call('team:admin:set', { url: $('#tmUrl').value, pub: $('#tmPub').value, adm: $('#tmAdm').value })); $('#tmAdm').value = ''; $('#tmAdminMsg').className = 'small'; $('#tmAdminMsg').textContent = 'Saved ✓'; }
  catch (e) { $('#tmAdminMsg').className = 'small warn'; $('#tmAdminMsg').textContent = String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''); } };
$('#tmAdminClear').onclick = async () => renderTeam(await api.call('team:admin:clear'));
$('#tmCodeCopy').onclick = () => navigator.clipboard.writeText($('#tmCode').value).catch(() => {});
$('#tmAdminOpen').onclick = openAdmin;
// admin panel
const ago = (t) => { if (!t) return '–'; const m = (Date.now() - new Date(t)) / 60000; return m < 2 ? 'now' : m < 60 ? Math.round(m) + ' min ago' : m < 2880 ? Math.round(m / 60) + ' h ago' : new Date(t).toLocaleDateString('en-IN'); };
async function openAdmin() { $('#admin').hidden = false; await loadAdmin(); }
async function loadAdmin() { $('#adRows').innerHTML = '<tr><td colspan="7" class="muted">Loading…</td></tr>';
  try { const rows = await api.call('team:admin:list');
    $('#adRows').innerHTML = rows.length ? rows.map((r) => `<tr><td>${esc(r.name || '–')}</td><td>${r.key ? `<span class="keycode">${esc(r.key)}</span> <button class="ghost" data-copy="${esc(r.key)}">Copy</button>` : `<span class="muted">…${esc(r.key_hint)}</span>`}</td>
      <td class="st-${r.status}">${r.status}</td><td>${esc(r.device_name || '— not used yet')}</td><td>${ago(r.last_seen)}</td><td>${esc(r.app_version || '')}</td>
      <td><div class="btns">${r.status === 'active' ? `<button class="ghost" data-act="block" data-id="${r.id}">Block</button>` : `<button class="ghost" data-act="unblock" data-id="${r.id}">Unblock</button>`}
      <button class="ghost" data-act="logout" data-id="${r.id}">Log out now</button><button class="ghost" data-act="reset" data-id="${r.id}">Reset PC</button><button class="danger" data-del="${r.id}">Delete</button></div></td></tr>`).join('') : '<tr><td colspan="7" class="muted">No keys yet. Add one above.</td></tr>'; }
  catch (e) { $('#adRows').innerHTML = `<tr><td colspan="7" class="warn">${esc(String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))}</td></tr>`; } }
$('#adRows').onclick = async (e) => { const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.copy) { navigator.clipboard.writeText(b.dataset.copy).catch(() => {}); b.textContent = 'Copied'; return; }
  if (b.dataset.del) { if (!confirm('Delete this key? The PC using it is logged out at its next check.')) return; await api.call('team:admin:delete', +b.dataset.del); return loadAdmin(); }
  if (b.dataset.act) { const msg = { block: 'Block this key? The PC stops working within 10 minutes.', logout: 'Log this PC out now (within 10 minutes)?', reset: 'Free this key so it can be used on another PC?' }[b.dataset.act];
    if (msg && !confirm(msg)) return; await api.call('team:admin:patch', { id: +b.dataset.id, action: b.dataset.act }); loadAdmin(); } };
$('#adNew').onclick = async () => { $('#adNewKey').className = 'small'; $('#adNewKey').textContent = 'Creating…'; try { const k = await api.call('team:admin:create', { name: $('#adName').value }); $('#adNewKey').innerHTML = `New key: <span class="keycode">${esc(k)}</span> — give it to the worker together with the team server code (Settings → Team).`; $('#adName').value = ''; loadAdmin(); }
  catch (e) { $('#adNewKey').className = 'small warn'; $('#adNewKey').textContent = '⚠ ' + String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''); } };
$('#adRefresh').onclick = loadAdmin; $('#adClose').onclick = () => { $('#admin').hidden = true; };
$('#adPublish').onclick = async () => { tmProg = tmProgress('#adBar', '#adBarWrap', '#adMsg'); $('#adPublish').disabled = true;
  try { const r = await api.call('team:admin:publish', { note: $('#adNote').value }); $('#adMsg').textContent = `Published team data v${r.version} ✓ — ${r.files} files, ${r.uploaded} uploaded (${(r.bytes / 1e6).toFixed(1)} MB).`; $('#adNote').value = ''; renderTeam(await api.call('team:status')); }
  catch (e) { $('#adMsg').textContent = String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''); } finally { $('#adPublish').disabled = false; $('#adBarWrap').hidden = true; } };
