const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
const api = window.api; let O, cat = 'romance', S;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (s) => { s = Math.round(s || 0); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}h ${m}m` : m ? `${m}m ${x}s` : `${x}s`; };
const clock = (iso) => iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';

// ---------- tabs ----------
$('#tabs').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; $$('#tabs button').forEach((x) => x.classList.toggle('on', x === b)); $$('.tab').forEach((t) => t.classList.toggle('on', t.id === 'tab-' + b.dataset.tab));
  if (b.dataset.tab === 'library') loadLibrary(); if (b.dataset.tab === 'chars') loadChars(); if (b.dataset.tab === 'settings') loadSettings(); };

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
  const names = { story: 'Story (Gemini)', voice: 'Hindi voices (Piper)', sound: 'Music + effects', prepare: 'Preparing', render: '3D render' };
  $('#estParts').innerHTML = Object.entries(e.partsText).map(([k, v]) => `<tr><td>${names[k]}</td><td>${v}</td></tr>`).join('');
  $('#estNote').textContent = e.measured ? 'Based on the real speed of this PC.' : 'Rough estimate — it becomes exact after the first video on this PC.';
  $('#estSum').textContent = n > 1 ? `${n} videos ≈ ${fmt(e.total * n)} (one after another)` : '';
}
async function add(start) {
  const o = { category: cat, idea: $('#idea').value, minutes: $('#min').value, count: $('#count').value, style: $('#style').value, look: $('#look').value, subs: $('#subs').value, demo: $('#demo').checked, start };
  if (!o.demo && !S?.hasKey) { $('#keyWarn').hidden = false; return; }
  renderQueue(await api.call('queue:add', o)); $('[data-tab=queue]').click();
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
async function pick(id) { sel = id; const c = chars.find((x) => x.id === id); $$('.ch').forEach((x) => x.classList.toggle('on', x.dataset.id === id)); if (!c) return;
  const f = $('#chForm'); f.name.value = c.name; f.gender.value = c.gender; f.age.value = c.age; f.tags.value = (c.tags || []).join(', ');
  for (const s of ['toon', 'anime', 'realistic']) f['st_' + s].checked = (c.styles || []).includes(s);
  [...f.elements].forEach((el) => (el.disabled = !!c.builtin)); $('#chDelete').hidden = !!c.builtin;
  $('#chInfo').textContent = 'Loading…';
  const r = await window.AVPreview.show($('#chCanvas'), c);
  $('#chInfo').innerHTML = r.ok ? `✓ Works · ${r.rig || ''} · lip-sync: ${r.lipSync ? 'yes' : 'no (head moves only)'}${c.builtin ? ' · built-in (read-only)' : ''}` : `<span class="warn">✗ ${esc(r.error)}</span>`; }
$('#chList').onclick = (e) => { const d = e.target.closest('.ch'); if (d) pick(d.dataset.id); };
$('#chForm').onsubmit = async (e) => { e.preventDefault(); const f = e.target; const styles = ['toon', 'anime', 'realistic'].filter((s) => f['st_' + s].checked);
  await api.call('chars:update', { id: sel, patch: { name: f.name.value, gender: f.gender.value, age: f.age.value, tags: f.tags.value.split(',').map((x) => x.trim()).filter(Boolean), styles } }); loadChars(); };
$('#chDelete').onclick = async () => { if (confirm('Delete this character?')) { await api.call('chars:delete', sel); sel = null; loadChars(); } };
$('#chImport').onclick = async () => { const r = await api.call('chars:import', {}); if (r.length) { sel = r[0].id; loadChars(); } };
$('#chFolder').onclick = () => api.call('chars:openFolder');
const dz = $('#tab-chars'); dz.ondragover = (e) => { e.preventDefault(); dz.classList.add('drop'); }; dz.ondragleave = () => dz.classList.remove('drop');
dz.ondrop = async (e) => { e.preventDefault(); dz.classList.remove('drop'); const paths = [...e.dataTransfer.files].map((f) => api.pathOf(f)).filter((p) => /\.(vrm|glb|gltf|fbx)$/i.test(p));
  if (paths.length) { const r = await api.call('chars:importPaths', paths); sel = r[0]?.id; loadChars(); } };

// ---------- settings ----------
async function loadSettings() { S = await api.call('settings:get'); $('#model').value = S.model; $('#conc').value = S.concurrency; $('#dataDir').textContent = S.dataDir;
  $$('input[name=renderer]').forEach((r) => (r.checked = r.value === S.renderer)); $('#key').placeholder = S.hasKey ? `Saved: ${S.keyHint}` : 'AIza...'; $('#keyWarn').hidden = S.hasKey; }
$('#keySave').onclick = async () => { S = await api.call('settings:set', { key: $('#key').value }); $('#key').value = ''; $('#keyMsg').textContent = S.hasKey ? 'Saved ✓' : 'Key removed'; loadSettings(); };
$('#keyTest').onclick = async () => { $('#keyMsg').textContent = 'Checking…'; const r = await api.call('settings:testKey'); $('#keyMsg').textContent = r.msg; $('#keyMsg').className = 'small ' + (r.ok ? '' : 'warn'); };
$('#model').onchange = () => api.call('settings:set', { model: $('#model').value.trim() || 'gemini-2.5-flash' });
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

(async () => { renderUpd(await api.call('update:get')); await loadSettings(); await initNew(); renderQueue(await api.call('queue:get')); checkSetup(false); })();
