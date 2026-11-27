// Prompt Studio tab: story bible → scenes → shots (image / video prompts) with NEXT, REDO, tone, exports
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const errMsg = (e) => String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
let CUR = null, busy = false;
const log = (m, warn) => { $('#stLog').className = warn ? 'small warn' : 'small muted'; $('#stLog').textContent = m; };
api.on('studio:log', (m) => { log(m); const v = $('#stBusy'); if (v) v.textContent = m; });

async function init() {
  let O; try { O = await api.call('studio:options'); } catch { return; } // not signed in yet
  const opt = (arr, lab = (x) => x) => arr.map((x) => `<option value="${esc(x)}">${esc(lab(x))}</option>`).join('');
  const nice = (g) => g.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  $('#stGenre').innerHTML = opt(O.genres, nice); $('#stGenre2').innerHTML = '<option value="">— none —</option>' + opt(O.genres, nice);
  $('#stDur').innerHTML = opt(O.durations, (d) => `${d} min`); $('#stDur').value = '3';
  $('#stStyle').innerHTML = Object.entries(O.styles).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join(''); $('#stStyle').value = '3D_Stylized';
  $('#stLang').innerHTML = opt(O.langs); $('#stAud').innerHTML = opt(O.audiences);
  fillAI(); loadCast();
  renderList();
}
function fillAI() { const cur = $('#stAI').value; const src = $('#storySrc'); $('#stAI').innerHTML = (src ? [...src.options].filter((o) => !['paste', 'demo'].includes(o.value)).map((o) => o.outerHTML).join('') : '') + '<option value="paste">Paste from Gemini app (no API)</option>'; if (!$('#stAI').querySelector('option:not([value=paste])')) $('#stAI').insertAdjacentHTML('afterbegin', '<option value="auto">Auto (my Story AI settings)</option>'); if (cur && [...$('#stAI').options].some((o) => o.value === cur)) $('#stAI').value = cur; }
// ---- topics, characters (same as New Video) ----
let TOP = [], CASTS = [], stSel = new Set();
async function loadCast() { CASTS = await api.call('cast:list'); const lv = $('#stLead').value;
  $('#stLead').innerHTML = '<option value="">AI creates one</option>' + CASTS.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}${c.role ? ' — ' + esc(c.role) : ''}</option>`).join(''); $('#stLead').value = CASTS.some((c) => c.id === lv) ? lv : '';
  $('#stCast').innerHTML = CASTS.length ? CASTS.map((c) => `<span class="chip${stSel.has(c.id) ? ' on' : ''}" data-id="${esc(c.id)}"><span class="dot" style="background:${esc(c.top_color || '#888')}"></span>${esc(c.name)}<small class="muted">${esc(c.role || '')}</small></span>`).join('') : '<span class="small muted">No saved characters yet.</span>'; }
$('#stCast').onclick = (e) => { const c = e.target.closest('.chip'); if (!c?.dataset.id) return; if (stSel.has(c.dataset.id)) stSel.delete(c.dataset.id); else stSel.add(c.dataset.id); c.classList.toggle('on'); };
$('#stFind').onclick = async () => { const b = $('#stFind'); b.disabled = true; $('#stTopicMsg').className = 'small muted'; $('#stTopicMsg').textContent = 'Finding topics…';
  try { const ai = $('#stAI').value; const r = await api.call('topics:find', { category: $('#stGenre').value, mode: $('#stTopicMode').value, language: /english/i.test($('#stLang').value) ? 'english' : /devanagari/i.test($('#stLang').value) ? 'hindi' : 'hinglish', extra: $('#stTopicExtra').value, storyAI: ai === 'paste' ? 'auto' : ai });
    if (!r.ok) { $('#stTopicMsg').className = 'small warn'; $('#stTopicMsg').textContent = r.msg; return; } TOP = r.topics; $('#stTopicMsg').textContent = `${TOP.length} topics · click one to use it`;
    $('#stTopics').innerHTML = TOP.map((t, i) => `<div class="topic" data-i="${i}"><div><b>${esc(t.title)}</b><div class="small">${esc(t.summary)}</div><div class="src">${esc([t.place, t.date, t.source].filter(Boolean).join(' · '))}</div></div></div>`).join(''); } finally { b.disabled = false; } };
$('#stTopics').onclick = (e) => { const d = e.target.closest('.topic'); if (!d) return; const t = TOP[+d.dataset.i]; document.querySelectorAll('#stTopics .topic').forEach((x) => x.classList.toggle('on', x === d));
  $('#stTopic').value = t.real ? `Based on a real incident (${[t.place, t.date].filter(Boolean).join(', ')}): ${t.title}. ${t.summary} Keep the real facts; change private people's names; no gore.` : `${t.title}. ${t.summary}`; };
const castInput = () => ({ castIds: [...new Set([...($('#stLead').value ? [$('#stLead').value] : []), ...stSel])], lead: $('#stLead').value || null, mains: +$('#stMains').value || 0, total: +$('#stTotal').value || 0, series: $('#stSeries').checked });
// ---- Paste from Gemini app ----
let pm = null;
api.on('studio:paste', (q) => { pm = q; $('#pmAnswer').value = ''; $('#pmInfo').textContent = `Prompt: ${Math.round(q.prompt.length / 1000)}k characters`; $('#pasteModal').hidden = false; });
$('#pmCopy').onclick = async () => { try { await navigator.clipboard.writeText(pm.prompt); $('#pmInfo').textContent = 'Copied ✓ — now paste it in the Gemini app'; } catch { $('#pmAnswer').value = pm.prompt; $('#pmInfo').textContent = 'Copy the prompt from the box, then replace it with the answer'; } };
$('#pmOk').onclick = () => { const t = $('#pmAnswer').value.trim(); if (!t) return; $('#pasteModal').hidden = true; api.call('studio:pasteAnswer', { id: pm.id, text: t }); };
$('#pmCancel').onclick = () => { $('#pasteModal').hidden = true; api.call('studio:pasteAnswer', { id: pm.id, text: null }); };
async function renderList() { const L = await api.call('studio:list');
  $('#stList').innerHTML = L.length ? L.map((p) => `<div class="it${CUR?.id === p.id ? ' on' : ''}" data-id="${esc(p.id)}"><b>${esc(p.title || p.id)}</b><span>${esc(p.genre)} · ${p.duration} min · ${['bible…', 'bible ✓', 'shots ' + p.status.scenesWithShots + '/' + p.status.scenes, 'complete ✓'][p.status.phase]}</span></div>`).join('') : '<div class="muted small">No stories yet.</div>';
  $('#stList').querySelectorAll('.it').forEach((el) => (el.onclick = () => openP(el.dataset.id))); }
async function openP(id) { CUR = await api.call('studio:get', id); render(); renderList(); }

async function run(label, ch, arg) { if (busy) return; busy = true; $('#stView').querySelectorAll('button').forEach((b) => (b.disabled = true)); const b = $('#stBusy'); if (b) { b.hidden = false; b.textContent = label; } log(label);
  try { CUR = await api.call(ch, arg); render(); renderList(); log('Done ✓'); } catch (e) { log(errMsg(e), true); render(); } finally { busy = false; $('#stView').querySelectorAll('button').forEach((x) => (x.disabled = false)); } }

$('#stCreate').onclick = async () => { if (busy) return; busy = true; $('#stCreate').disabled = true; log('Writing the story… (1–3 min for short videos, the Story Bible first for long ones)');
  $('#stView').innerHTML = '<div class="muted">Writing… <span id="stBusy"></span></div>';
  try { CUR = await api.call('studio:create', { genre: $('#stGenre').value, genre2: $('#stGenre2').value || null, duration: Number($('#stDur').value), style: $('#stStyle').value, language: $('#stLang').value, aspect: $('#stAspect').value, audience: $('#stAud').value, topic: $('#stTopic').value, ai: $('#stAI').value || 'auto', ...castInput() });
    render(); renderList(); log('Story ready ✓'); } catch (e) { log(errMsg(e), true); $('#stView').innerHTML = `<div class="warn">${esc(errMsg(e))}</div>`; } finally { busy = false; $('#stCreate').disabled = false; } };
$('#stLib').onclick = () => api.call('studio:library');

const copy = (t, btn) => { navigator.clipboard.writeText(t); if (btn) { const o = btn.textContent; btn.textContent = 'Copied ✓'; setTimeout(() => (btn.textContent = o), 1200); } };
function render() {
  const P = CUR; if (!P) return; const B = P.story_bible || {}; const st = P.status; const name = (id) => B.characters?.find((c) => c.char_id === id)?.name || id;
  const pills = [['1. Story Bible', st.phase >= 1], ['2. Scenes ' + (st.scenes ? `${st.scenes}/${st.scenesTotal}` : ''), st.scenes >= st.scenesTotal && st.scenes > 0], [`3. Shots ${st.scenesWithShots}/${st.scenes || st.scenesTotal}`, st.phase === 3]];
  const nb = st.nextBatch;
  $('#stView').innerHTML = `
    <div class="qhead"><div><h2 style="margin:0">${esc(P.project.title)}</h2><div class="small muted">${esc(P.project.project_id)} · ${esc([P.project.genre_primary, P.project.genre_secondary].filter(Boolean).join(' + '))} · ${P.project.duration_min} min · ${esc(P.project.style_preset)} · ${esc(P.project.aspect_ratio)} · ${esc(P.project.language)} · ${esc(P.project.audience)}</div></div></div>
    <div class="stphase">${pills.map(([t, d]) => `<span class="${d ? 'done' : ''}">${esc(t)}</span>`).join('')}</div>
    <div class="btns">
      ${st.phase === 1 ? '<button class="primary" id="stScenes">Phase 2: make the scenes</button>' : ''}
      ${st.phase >= 1 && nb ? `<button class="primary" id="stNext">NEXT ▶ shots for scenes ${nb.from}–${nb.to}</button>` : ''}
      <button class="ghost" id="stEp">▶ Next episode${P.series ? ' (' + (P.series.episode + 1) + ')' : ''}</button>
      <button class="ghost" data-tone="scary">More scary</button><button class="ghost" data-tone="emotional">More emotional</button><button class="ghost" data-tone="fast">Faster pace</button>
    </div>
    <div class="btns"><button class="ghost" data-ex="prompts">Only prompts</button><button class="ghost" data-ex="voiceover">Voiceover script</button><button class="ghost" data-ex="characters">Character sheet</button><button class="ghost" id="stThumb">Thumbnail</button><button class="ghost" id="stFolder">Open folder</button><button class="danger" id="stDel">Delete</button></div>
    <div class="stsec"><h3>🎬 Make the video in this app</h3>
      <div class="small muted">Sends this story (every scene, action and dialogue line) to New Video. The video maker picks backgrounds, actions and camera, adds the voices, music and subtitles, and renders the MP4. ${st.phase < 3 ? '<span class="warn">Shots are not finished yet — scenes without shots go in as their summary. Press NEXT until "complete" for the full detail.</span>' : ''}</div>
      <div class="row"><label>Video style<select id="stVStyle">${[...($('#style')?.options || [])].map((o) => `<option value="${esc(o.value)}"${o.value === 'flat2d' ? ' selected' : ''}>${esc(o.textContent)}</option>`).join('')}</select></label><label>Subtitles<select id="stVSubs">${[...($('#subs')?.options || [])].map((o) => o.outerHTML).join('')}</select></label></div>
      <div class="btns"><button class="primary" id="stVideo">Make video ▶</button></div></div>
    <div id="stBusy" class="small muted" hidden></div>
    ${P.tone?.length ? `<div class="small muted">Tone for the next batches: ${esc(P.tone.join(' · '))}</div>` : ''}
    <div id="stEx" hidden class="stsec"><div class="qhead"><b id="stExT"></b><div class="btns"><button class="ghost" id="stExCopy">Copy all</button><button class="ghost" id="stExClose">Close</button></div></div><textarea id="stExTxt" rows="16" readonly></textarea></div>
    <div class="stsec"><h3>Story Bible</h3>
      <div><b>Logline:</b> ${esc(B.logline)}</div><div class="small" style="margin-top:6px">${esc(B.synopsis)}</div><div class="small muted" style="margin-top:6px">Theme: ${esc(B.theme)} · Seed: ${esc(Object.values(P.project.variety_seed || {}).join(' · '))}</div>
      <h3>Characters</h3>${(B.characters || []).map((c) => `<div class="stchar"><b>${esc(c.char_id)} ${esc(c.name)}</b> · ${esc(c.role)} · ${esc(c.age)} · ${esc(c.voice)}<div class="small muted">${esc((c.personality || []).join(', '))} — goal: ${esc(c.goal)} — arc: ${esc(c.arc)}</div><code>${esc(c.consistency_tag)}</code><button class="ghost" data-copy="${esc(c.consistency_tag)}">Copy tag</button></div>`).join('')}
      <h3>Locations</h3>${(B.locations || []).map((l) => `<div class="stchar"><b>${esc(l.loc_id)}</b> · ${esc(l.library_ref)} · ${esc((l.time_of_day_used || []).join(', '))} · ${esc(l.weather)}<code>${esc(l.location_tag)}</code></div>`).join('')}
      ${B.props_master?.length ? `<h3>Key props</h3>${B.props_master.map((x) => `<div class="small">${esc(x.prop_id)} <b>${esc(x.name)}</b> — ${esc(x.description)} <span class="muted">(${esc(x.story_importance)})</span></div>`).join('')}` : ''}
      <h3>Acts</h3>${(B.act_outline || []).map((a) => `<div class="small"><b>Act ${esc(a.act)} ${esc(a.name)}</b> ${esc(a.time_range)} · scenes ${esc(a.scenes)} — ${esc(a.summary)}</div>`).join('')}
      <div class="small muted" style="margin-top:6px">Style: ${esc(B.visual_style_guide?.style_prompt)}<br>Palette: ${esc((B.visual_style_guide?.color_palette || []).join(', '))} · Lighting: ${esc(B.visual_style_guide?.lighting_rule)}</div>
    </div>
    <div class="stsec"><h3>Scenes ${P.total_sec ? `<span class="small muted">(${Math.round(P.total_sec / 6) / 10} min of shots so far)</span>` : ''}</h3>
      ${(P.scenes || []).map((s) => `<details class="stscene"${s.shots?.length && s.scene_no === (P.batches?.at(-1)?.from) ? ' open' : ''}><summary><b>${s.scene_no}. ${esc(s.title)}</b> <span class="small muted">· ${esc(s.loc_id)} ${esc(s.sub_area || '')} · ${esc(s.time_of_day)} · ${esc(s.mood)} · ${s.shots?.length ? `${s.shots.length} shots · ${esc(s.start_time)}–${esc(s.end_time)}` : 'no shots yet'}</span></summary><div class="body">
        <div class="small">${esc(s.summary)}</div><div class="small muted">Characters: ${esc((s.characters_present || []).map(name).join(', '))} · Props: ${esc((s.props_in_scene || []).join(', '))} · Music: ${esc(s.music_cue)}</div>
        ${s.shots?.length ? `<div class="btns"><input id="note${s.scene_no}" placeholder="REDO note (optional): what should be different?" style="flex:1"><button class="ghost" data-redo="${s.scene_no}">REDO scene ${s.scene_no}</button></div>` : ''}
        ${(s.shots || []).map((sh) => `<div class="stshot"><div class="h"><b>${esc(sh.shot_id)}</b><span>${esc(sh.duration_sec)}s · ${esc(sh.shot_type)} · ${esc(sh.camera_angle)} · ${esc(sh.camera_movement)}</span></div>
          <div class="stline">${esc(sh.action)}</div>
          <div class="stline"><i>Image prompt</i> <button class="ghost" data-copy="${esc(sh.image_prompt)}">Copy</button><code>${esc(sh.image_prompt)}</code></div>
          <div class="stline"><i>Video prompt</i> <button class="ghost" data-copy="${esc(sh.video_prompt)}">Copy</button><code>${esc(sh.video_prompt)}</code></div>
          ${(sh.dialogue || []).map((d) => `<div class="stline">🗨 <b>${esc(name(d.char_id))}</b> <i>(${esc([d.emotion, d.delivery].filter(Boolean).join(', '))})</i>: ${esc(d.line)}</div>`).join('')}
          ${sh.voiceover ? `<div class="stline">🎙 <i>Narrator:</i> ${esc(sh.voiceover)}</div>` : ''}
          <div class="stline small muted">SFX: ${esc((sh.sfx || []).join(', '))} · Music: ${esc(sh.music)} · → ${esc(sh.transition_out)}${sh.continuity_note ? ' · ' + esc(sh.continuity_note) : ''}</div></div>`).join('')}
      </div></details>`).join('') || '<div class="muted small">Scenes appear after Phase 2.</div>'}
    </div>
    ${P.checkpoints?.length ? `<div class="stsec"><h3>Continuity checkpoint (last batch)</h3><code class="small" style="white-space:pre-wrap;display:block">${esc(JSON.stringify(P.checkpoints.at(-1), null, 1))}</code></div>` : ''}`;
  const V = $('#stView'); const on = (sel, fn) => V.querySelectorAll(sel).forEach((el) => (el.onclick = () => fn(el)));
  on('[data-copy]', (el) => copy(el.dataset.copy, el));
  on('#stScenes', () => run('Phase 2: making the scenes…', 'studio:scenes', { id: P.id, ai: $('#stAI').value }));
  on('#stNext', () => run(`Phase 3: shots for scenes ${nb.from}–${nb.to}…`, 'studio:next', { id: P.id, ai: $('#stAI').value }));
  on('[data-redo]', (el) => { const note = $('#note' + el.dataset.redo)?.value || ''; run(`Rewriting scene ${el.dataset.redo}…`, 'studio:redo', { id: P.id, scene: Number(el.dataset.redo), note, ai: $('#stAI').value }); });
  on('[data-tone]', (el) => run('Saving tone…', 'studio:tone', { id: P.id, tone: el.dataset.tone }));
  on('#stEp', () => run('Writing the next episode (same characters and places)…', 'studio:create', { ...P.input, continueFrom: P.id, topic: $('#stTopic').value || '', ai: $('#stAI').value, castIds: [], lead: null }));
  on('#stThumb', () => run('Writing thumbnails and titles…', 'studio:thumbs', { id: P.id, ai: $('#stAI').value }).then(() => showEx('thumbnails', 'Thumbnails & titles')));
  on('[data-ex]', (el) => showEx(el.dataset.ex, el.textContent));
  on('#stFolder', () => api.call('studio:open', P.id));
  on('#stVideo', async (el) => { el.disabled = true; try { await api.call('studio:toVideo', { id: P.id, style: $('#stVStyle').value, subs: $('#stVSubs').value, ai: $('#stAI').value }); log('Sent to the video maker ✓ — see the Queue tab'); document.querySelector('[data-tab=queue]').click(); } catch (e) { log(errMsg(e), true); } finally { el.disabled = false; } });
  on('#stDel', async () => { if (!confirm(`Delete "${P.project.title}"?`)) return; await api.call('studio:delete', P.id); CUR = null; $('#stView').innerHTML = '<div class="muted">Deleted.</div>'; renderList(); });
}
async function showEx(kind, title) { const E = await api.call('studio:exports', CUR.id); $('#stEx').hidden = false; $('#stExT').textContent = title; $('#stExTxt').value = E[kind] || '(nothing yet)';
  $('#stExCopy').onclick = (e) => copy($('#stExTxt').value, e.target); $('#stExClose').onclick = () => ($('#stEx').hidden = true); $('#stEx').scrollIntoView({ behavior: 'smooth' }); }

document.querySelector('[data-tab=studio]').addEventListener('click', () => { if (!$('#stGenre').options.length) init(); else { fillAI(); renderList(); } });
init();
