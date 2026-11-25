const $ = (s) => document.querySelector(s); const $$ = (s) => [...document.querySelectorAll(s)];
const api = window.api; let O, cat = 'romance', S;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (s) => { s = Math.round(s || 0); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}h ${m}m` : m ? `${m}m ${x}s` : `${x}s`; };
const clock = (iso) => iso ? new Date(iso).toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' }) : '';

// ---------- tabs ----------
$('#tabs').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; $$('#tabs button').forEach((x) => x.classList.toggle('on', x === b)); $$('.tab').forEach((t) => t.classList.toggle('on', t.id === 'tab-' + b.dataset.tab));
  if (b.dataset.tab === 'library') loadLibrary(); if (b.dataset.tab === 'chars') loadChars(); if (b.dataset.tab === 'settings') loadSettings(); };

// ---------- new video ----------
const fill = (sel, obj, auto) => { sel.innerHTML = (auto ? '<option value="auto">Auto (category ke hisaab se)</option>' : '') + Object.entries(obj).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join(''); };
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
  const names = { story: 'Story (Gemini)', voice: 'Hindi awaaz (Piper)', sound: 'Music + effects', prepare: 'Taiyaari', render: '3D render' };
  $('#estParts').innerHTML = Object.entries(e.partsText).map(([k, v]) => `<tr><td>${names[k]}</td><td>${v}</td></tr>`).join('');
  $('#estNote').textContent = e.measured ? 'Is PC ki pichhli video ki asli speed se.' : 'Andaaz hai — pehli video ke baad is PC ki asli speed se sahi hoga.';
  $('#estSum').textContent = n > 1 ? `${n} video ≈ ${fmt(e.total * n)} (ek ke baad ek)` : '';
}
async function add(start) {
  const o = { category: cat, idea: $('#idea').value, minutes: $('#min').value, count: $('#count').value, style: $('#style').value, look: $('#look').value, subs: $('#subs').value, demo: $('#demo').checked, start };
  if (!o.demo && !S?.hasKey) { $('#keyWarn').hidden = false; return; }
  renderQueue(await api.call('queue:add', o)); $('[data-tab=queue]').click();
}
$('#addQ').onclick = () => add(false); $('#addStart').onclick = () => add(true);

// ---------- queue ----------
const STATUS = { queued: 'Queue me', running: 'Ban raha hai', done: 'Ready ✓', error: 'Error', cancelled: 'Cancel' };
function renderQueue(q) {
  const left = q.jobs.filter((j) => j.status === 'queued' || j.status === 'running').length;
  $('#qbadge').hidden = !left; $('#qbadge').textContent = left;
  $('#qRemain').textContent = left ? fmt(q.remainSec) : 'Khaali';
  $('#qInfo').textContent = left ? `${left} video baaki · khatam lagbhag ${clock(q.finishAt)}${q.autoRun ? '' : ' (Start dabao)'}` : 'Naya Video tab se videos daalo';
  $('#qStart').disabled = q.autoRun; $('#qPause').disabled = !q.autoRun;
  $('#qList').innerHTML = q.jobs.slice().reverse().map((j) => { const o = j.opts || {}; const p = Math.round((j.status === 'done' ? 1 : j.step === 'render' ? 0.15 + 0.85 * (j.progress || 0) : { plan: 0.01, story: 0.05, voice: 0.1, sound: 0.14 }[j.step] || 0) * 100);
    return `<div class="card job"><div><span class="t">${esc(j.title || (O?.categories[o.category]?.label || o.category))}</span><span class="pill ${j.status}">${STATUS[j.status] || j.status}</span>
      <div class="meta">${esc(O?.categories[o.category]?.label || '')} · ${o.minutes} min · ${esc(o.style)}${o.idea ? ' · ' + esc(o.idea.slice(0, 60)) : ''}${o.demo ? ' · demo' : ''}</div>
      ${j.status === 'running' ? `<div class="bar"><div style="width:${p}%"></div></div><div class="meta">${esc(j.msg || '')}${j.eta ? ' · baaki ' + fmt(j.eta) : ''}</div>` : ''}
      ${j.status === 'queued' ? `<div class="meta">Andaaz: ${fmt(j.estimate?.total)}</div>` : ''}
      ${j.status === 'error' ? `<div class="meta warn">${esc(j.error)}</div>` : ''}</div>
      <div class="acts">${j.status === 'queued' ? `<button data-a="up" data-id="${j.id}">↑</button><button data-a="down" data-id="${j.id}">↓</button>` : ''}
        ${j.status === 'running' || j.status === 'queued' ? `<button data-a="cancel" data-id="${j.id}">Cancel</button>` : ''}
        ${j.status === 'error' || j.status === 'cancelled' ? `<button data-a="retry" data-id="${j.id}">Retry</button>` : ''}
        ${j.status === 'done' ? `<button data-a="open" data-id="${esc(j.folder)}">Folder</button>` : ''}
        ${j.status !== 'running' ? `<button data-a="remove" data-id="${j.id}">✕</button>` : ''}</div></div>`; }).join('');
}
$('#qList').onclick = async (e) => { const b = e.target.closest('button'); if (!b) return; const id = b.dataset.id, a = b.dataset.a;
  if (a === 'open') return api.call('library:open', id.split(/[\\/]/).pop());
  const map = { up: ['queue:move', { id, dir: 1 }], down: ['queue:move', { id, dir: -1 }], cancel: ['queue:cancel', id], retry: ['queue:retry', id], remove: ['queue:remove', id] };
  renderQueue(await api.call(...map[a])); };
$('#qStart').onclick = async () => renderQueue(await api.call('queue:start'));
$('#qPause').onclick = async () => renderQueue(await api.call('queue:pause'));
$('#qClear').onclick = async () => renderQueue(await api.call('queue:clearDone'));
api.on('queue', renderQueue);

// ---------- library ----------
async function loadLibrary() {
  const list = await api.call('library:list'); $('#libPath').textContent = (S?.dataDir || '') + '\\Videos';
  $('#libList').innerHTML = list.length ? list.map((v) => `<div class="card lib"><video src="${v.video}#t=4" preload="metadata" data-play="${v.video}"></video><div class="t">${esc(v.title)}</div>
    <div class="muted small">${new Date(v.created).toLocaleString('hi-IN')} · ${v.sizeMB} MB</div><div class="btns"><button class="ghost" data-open="${esc(v.dir)}">Folder</button><button class="danger" data-del="${esc(v.dir)}">Delete</button></div></div>`).join('') : '<div class="muted">Abhi koi video nahi.</div>';
}
$('#libList').onclick = async (e) => { const t = e.target;
  if (t.dataset.play) { $('#playerVideo').src = t.dataset.play; $('#player').hidden = false; $('#playerVideo').play(); }
  if (t.dataset.open) api.call('library:open', t.dataset.open);
  if (t.dataset.del && confirm('Ye video delete karein?')) { await api.call('library:delete', t.dataset.del); loadLibrary(); } };
$('#playerClose').onclick = () => { $('#playerVideo').pause(); $('#player').hidden = true; };
$('#libOpen').onclick = () => api.call('library:open'); $('#libRefresh').onclick = loadLibrary;

// ---------- characters ----------
let chars = [], sel = null;
async function loadChars() { chars = await api.call('chars:list');
  $('#chList').innerHTML = chars.map((c) => `<div class="ch${sel === c.id ? ' on' : ''}" data-id="${c.id}"><div class="t">${esc(c.name)}</div><div class="tags">${c.gender === 'female' ? 'Ladki' : 'Ladka'} · ${esc(c.age)} · ${esc((c.styles || []).join('/'))}</div>
    <div class="tags">${esc((c.tags || []).join(', '))}${c.builtin ? ' · built-in' : ''}</div></div>`).join('');
  if (!sel && chars[0]) pick(chars[0].id); }
async function pick(id) { sel = id; const c = chars.find((x) => x.id === id); $$('.ch').forEach((x) => x.classList.toggle('on', x.dataset.id === id)); if (!c) return;
  const f = $('#chForm'); f.name.value = c.name; f.gender.value = c.gender; f.age.value = c.age; f.tags.value = (c.tags || []).join(', ');
  for (const s of ['toon', 'anime', 'realistic']) f['st_' + s].checked = (c.styles || []).includes(s);
  [...f.elements].forEach((el) => (el.disabled = !!c.builtin)); $('#chDelete').hidden = !!c.builtin;
  $('#chInfo').textContent = 'Load ho raha hai…';
  const r = await window.AVPreview.show($('#chCanvas'), c);
  $('#chInfo').innerHTML = r.ok ? `✓ Chal raha hai · ${r.rig || ''} · lip-sync: ${r.lipSync ? 'haan' : 'nahi (sirf sir hilega)'}${c.builtin ? ' · built-in (edit nahi hota)' : ''}` : `<span class="warn">✗ ${esc(r.error)}</span>`; }
$('#chList').onclick = (e) => { const d = e.target.closest('.ch'); if (d) pick(d.dataset.id); };
$('#chForm').onsubmit = async (e) => { e.preventDefault(); const f = e.target; const styles = ['toon', 'anime', 'realistic'].filter((s) => f['st_' + s].checked);
  await api.call('chars:update', { id: sel, patch: { name: f.name.value, gender: f.gender.value, age: f.age.value, tags: f.tags.value.split(',').map((x) => x.trim()).filter(Boolean), styles } }); loadChars(); };
$('#chDelete').onclick = async () => { if (confirm('Ye character delete karein?')) { await api.call('chars:delete', sel); sel = null; loadChars(); } };
$('#chImport').onclick = async () => { const r = await api.call('chars:import', {}); if (r.length) { sel = r[0].id; loadChars(); } };
$('#chFolder').onclick = () => api.call('chars:openFolder');
const dz = $('#tab-chars'); dz.ondragover = (e) => { e.preventDefault(); dz.classList.add('drop'); }; dz.ondragleave = () => dz.classList.remove('drop');
dz.ondrop = async (e) => { e.preventDefault(); dz.classList.remove('drop'); const paths = [...e.dataTransfer.files].map((f) => api.pathOf(f)).filter((p) => /\.(vrm|glb|gltf|fbx)$/i.test(p));
  if (paths.length) { const r = await api.call('chars:importPaths', paths); sel = r[0]?.id; loadChars(); } };

// ---------- settings ----------
async function loadSettings() { S = await api.call('settings:get'); $('#model').value = S.model; $('#conc').value = S.concurrency; $('#dataDir').textContent = S.dataDir;
  $$('input[name=renderer]').forEach((r) => (r.checked = r.value === S.renderer)); $('#key').placeholder = S.hasKey ? `Saved: ${S.keyHint}` : 'AIza...'; $('#keyWarn').hidden = S.hasKey; }
$('#keySave').onclick = async () => { S = await api.call('settings:set', { key: $('#key').value }); $('#key').value = ''; $('#keyMsg').textContent = S.hasKey ? 'Save ho gayi ✓' : 'Key hata di'; loadSettings(); };
$('#keyTest').onclick = async () => { $('#keyMsg').textContent = 'Check ho raha hai…'; const r = await api.call('settings:testKey'); $('#keyMsg').textContent = r.msg; $('#keyMsg').className = 'small ' + (r.ok ? '' : 'warn'); };
$('#model').onchange = () => api.call('settings:set', { model: $('#model').value.trim() || 'gemini-2.5-flash' });
$('#conc').onchange = () => api.call('settings:set', { concurrency: Math.max(1, Math.min(8, +$('#conc').value || 2)) });
$$('input[name=renderer]').forEach((r) => (r.onchange = async () => { await api.call('settings:set', { renderer: r.value }); est(); }));
$('#openData').onclick = () => api.call('open:data'); $('#reSetup').onclick = () => checkSetup(true);

// ---------- first run ----------
async function checkSetup(force) {
  const st = await api.call('setup:status'); if (st.done && !force) return;
  $('#setup').hidden = false; $('#setupRetry').hidden = true; $('#setupMsg').textContent = 'Shuru ho raha hai…';
  try { const r = await api.call('setup:run'); if (r.done) { $('#setupMsg').textContent = 'Sab ready ✓'; setTimeout(() => ($('#setup').hidden = true), 800); } else throw new Error('Baaki: ' + r.missing.join(', ')); }
  catch (e) { $('#setupMsg').innerHTML = `<span class="warn">Download ruk gaya: ${esc(e.message)}. Internet check karke dobara try karo.</span>`; $('#setupRetry').hidden = false; }
}
api.on('setup:progress', (p) => { const pct = ((p.index + (p.total ? p.got / p.total : 0)) / p.count) * 100; $('#setupBar').style.width = pct.toFixed(1) + '%';
  $('#setupMsg').textContent = `${p.label} ${p.total > 1 ? Math.round((p.got / p.total) * 100) + '%' : ''} (${Math.min(p.index + 1, p.count)}/${p.count})`; });
$('#setupRetry').onclick = () => checkSetup(true);

(async () => { await loadSettings(); await initNew(); renderQueue(await api.call('queue:get')); checkSetup(false); })();
