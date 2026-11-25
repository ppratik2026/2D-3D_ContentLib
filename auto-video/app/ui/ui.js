const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
const api = window.api; let O, cat = 'romance', S;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (s) => { s = Math.round(s || 0); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}h ${m}m` : m ? `${m}m ${x}s` : `${x}s`; };
const clock = (iso) => iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';

// ---------- tabs ----------
$('#tabs').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; $$('#tabs button').forEach((x) => x.classList.toggle('on', x === b)); $$('.tab').forEach((t) => t.classList.toggle('on', t.id === 'tab-' + b.dataset.tab));
  if (b.dataset.tab === 'library') loadLibrary(); if (b.dataset.tab === 'chars') loadChars(); else window.AVPreview?.stop(); if (b.dataset.tab === 'bgs') loadBgs(); if (b.dataset.tab === 'settings') loadSettings(); };

// ---------- new video ----------
const fill = (sel, obj, auto) => { sel.innerHTML = (auto ? '<option value="auto">Auto (based on category)</option>' : '') + Object.entries(obj).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join(''); };
async function initNew() {
  O = await api.call('options');
  $('#cats').innerHTML = Object.entries(O.categories).map(([k, v]) => `<span class="chip${k === cat ? ' on' : ''}" data-k="${k}">${esc(v.label)}</span>`).join('');
  $('#cats').onclick = (e) => { const k = e.target.dataset.k; if (!k) return; cat = k; $$('#cats .chip').forEach((c) => c.classList.toggle('on', c.dataset.k === k)); };
  fill($('#style'), O.styles); fill($('#look'), O.looks, true); fill($('#subs'), O.subs, true);
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
const src = () => { const v = $('#storySrc').value || 'auto'; return v === 'paste' || v === 'demo' ? v : 'api'; };
$('#storySrc').onchange = () => { $('#pasteBox').hidden = src() !== 'paste'; $('#demo').checked = src() === 'demo'; $('#keyWarn').hidden = src() !== 'api' || S?.hasKey; };
$('#copyPrompt').onclick = async () => { const p = await api.call('story:prompt', { category: cat, minutes: $('#min').value, idea: $('#idea').value, style: $('#style').value, chars: $('#chars').value });
  try { await navigator.clipboard.writeText(p); $('#copyMsg').textContent = 'Copied ✓ — now paste it in the Gemini app'; } catch { $('#pasted').value = p; $('#copyMsg').textContent = 'Prompt placed in the box below — copy it from there'; } };
let pasteOk = false;
$('#pasted').oninput = async () => { const t = $('#pasted').value.trim(); if (!t) { $('#pasteMsg').textContent = ''; pasteOk = false; return; }
  const r = await api.call('story:parse', { text: t, minutes: $('#min').value }); pasteOk = r.ok;
  $('#pasteMsg').className = 'small ' + (r.ok ? '' : 'warn'); $('#pasteMsg').textContent = r.ok ? `✓ Story read: "${r.title}" · ${r.scenes} scenes · ${r.lines} lines · ${r.chars}` : r.msg; };
async function add(start) {
  const mode = src();
  const o = { category: cat, idea: $('#idea').value, minutes: $('#min').value, count: $('#count').value, style: $('#style').value, look: $('#look').value, subs: $('#subs').value, chars: $('#chars').value, demo: mode === 'demo', storyAI: mode === 'api' ? $('#storySrc').value : null, start };
  if (mode === 'paste') { if (!pasteOk) { $('#pasteMsg').className = 'small warn'; $('#pasteMsg').textContent = 'Paste Gemini\'s answer first.'; return; } o.pasted = $('#pasted').value; }
  if (mode === 'api' && !S?.hasKey) { $('#keyWarn').hidden = false; return; }
  renderQueue(await api.call('queue:add', o)); if (mode === 'paste') { $('#pasted').value = ''; $('#pasteMsg').textContent = ''; pasteOk = false; } $('[data-tab=queue]').click();
}
$('#addQ').onclick = () => add(false); $('#addStart').onclick = () => add(true);

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
      <div class="meta">${esc(O?.categories[o.category]?.label || '')} · ${o.minutes} min · ${esc(o.style)}${o.idea ? ' · ' + esc(o.idea.slice(0, 60)) : ''}${o.demo ? ' · demo' : ''}</div>
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
    <div class="muted small">${new Date(v.created).toLocaleString('en-IN')} · ${v.sizeMB} MB</div><div class="btns"><button class="ghost" data-open="${esc(v.dir)}">Folder</button><button class="danger" data-del="${esc(v.dir)}">Delete</button></div></div>`).join('') : '<div class="muted">No videos yet.</div>';
}
$('#libList').onclick = async (e) => { const t = e.target;
  if (t.dataset.play) { $('#playerVideo').src = t.dataset.play; $('#player').hidden = false; $('#playerVideo').play(); }
  if (t.dataset.open) api.call('library:open', t.dataset.open);
  if (t.dataset.del && confirm('Delete this video?')) { await api.call('library:delete', t.dataset.del); loadLibrary(); } };
$('#playerClose').onclick = () => { $('#playerVideo').pause(); $('#player').hidden = true; };
$('#libOpen').onclick = () => api.call('library:open'); $('#libRefresh').onclick = loadLibrary;

// ---------- characters ----------
let chars = [], sel = null;
async function loadChars() { chars = await api.call('chars:list');
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
  $('#chInfo').innerHTML = r.ok ? `✓ Works · ${r.rig || ''} · lip-sync: ${r.lipSync ? 'yes' : 'no (head moves only)'}${c.builtin ? ' · built-in (read-only)' : ''}` : `<span class="warn">✗ ${esc(r.error)}</span>`; }
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
let BG = { list: [], places: {} }, bsel = null, seatMode = false;
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
  $('#bgSeats').innerHTML = (b.seats || []).map((p) => `<div class="seat" style="left:${p.x * 100}%;top:${p.y * 100}%"></div>`).join('');
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
$('#bgSeat').onclick = () => { seatMode = true; $('#bgSeat').textContent = 'Click on the image…'; };
$('#bgClearSeats').onclick = () => bgSave({ seats: [] });
$('#bgEdit').onclick = (e) => {
  if (!seatMode || e.target.closest('.gline')) return; const box = $('#bgImg').getBoundingClientRect(); const b = curBg();
  bgSave({ seats: [...(b.seats || []), { x: +((e.clientX - box.left) / box.width).toFixed(3), y: +((e.clientY - box.top) / box.height).toFixed(3) }] }); seatMode = false; $('#bgSeat').textContent = 'Add seat';
};
$('#bgForm').onsubmit = async (e) => { e.preventDefault(); const f = e.target; await bgSave({ name: f.name.value, place: f.place.value, time: f.time.value, indoor: f.indoor.checked, tags: f.tags.value.split(',').map((x) => x.trim()).filter(Boolean) }); loadBgs(); };
$('#bgDelete').onclick = async () => { if (confirm('Delete this background?')) { await api.call('bg:delete', bsel); bsel = null; loadBgs(); } };
$('#bgImport').onclick = async () => { const r = await api.call('bg:import'); if (r.length) { bsel = r[0].id; loadBgs(); } };
$('#bgFolder').onclick = () => api.call('bg:openFolder');
const bz = $('#tab-bgs'); bz.ondragover = (e) => { e.preventDefault(); bz.classList.add('drop'); }; bz.ondragleave = () => bz.classList.remove('drop');
bz.ondrop = async (e) => { e.preventDefault(); bz.classList.remove('drop'); const paths = [...e.dataTransfer.files].map((f) => api.pathOf(f)).filter((p) => /\.(jpe?g|png|webp)$/i.test(p)); if (paths.length) { const r = await api.call('bg:importPaths', paths); bsel = r[0]?.id; loadBgs(); } };

// ---------- settings ----------
async function loadSettings() { S = await api.call('settings:get'); $('#conc').value = S.concurrency; $('#dataDir').textContent = S.dataDir;
  $$('input[name=renderer]').forEach((r) => (r.checked = r.value === S.renderer)); $('#keyWarn').hidden = S.hasKey || src() !== 'api'; }
$('#conc').onchange = () => api.call('settings:set', { concurrency: Math.max(1, Math.min(8, +$('#conc').value || 2)) });
$$('input[name=renderer]').forEach((r) => (r.onchange = async () => { await api.call('settings:set', { renderer: r.value }); est(); }));
$('#openData').onclick = () => api.call('open:data'); $('#reSetup').onclick = () => checkSetup(true);

// ---------- first run ----------
async function checkSetup(force) {
  const st = await api.call('setup:status'); if (st.done && !force) return;
  $('#setup').hidden = false; $('#setupRetry').hidden = true; $('#setupMsg').textContent = 'Starting…';
  try { const r = await api.call('setup:run'); if (r.done) { $('#setupMsg').textContent = 'All ready ✓'; setTimeout(() => ($('#setup').hidden = true), 800); } else throw new Error('Still missing: ' + r.missing.join(', ')); }
  catch (e) { $('#setupMsg').innerHTML = `<span class="warn">Download stopped: ${esc(e.message)}. Check the internet and try again.</span>`; $('#setupRetry').hidden = false; }
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

(async () => { renderUpd(await api.call('update:get')); await loadSettings(); await loadAI(); await initNew(); renderQueue(await api.call('queue:get')); checkSetup(false); })();
