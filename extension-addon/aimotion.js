// ================= v4.3: 🎞 AI motion — har scene ki picture se ASLI chalta clip (image-to-video), free GPU par =================
// Pipeline wahi: Gemini story → Flow pictures → voice → video. Yeh box har picture + motion prompt (+ voice, lip-sync ke liye)
// "AI motion server" ko bhejta hai (aapke PC ka NVIDIA GPU, ya Kaggle / Colab ka free GPU — local-motion-server/),
// clip waapas aati hai aur us scene ki "key-shot clip" ban jaati hai: video mein picture ki jagah wahi chalti hai.
// Clips project mein save — video dobara banane par dobara nahi banti. Default: kuch nahi hota jab tak aap 🎞 Make clips na dabayein.

const aivz = (id) => document.getElementById(id);
const AIV_DEF = { aivUrl: 'http://127.0.0.1:7871', aivToken: '', aivLip: true, aivTalk: true, aivRedo: false };
let AIVS = { ...AIV_DEF };
const AIV = { running: false, stop: false, health: null };
const aivKey = (n) => `${news.id}:kclip:${n}`;
const aivBase = () => String(AIVS.aivUrl || '').trim().replace(/\/+$/, '');

async function aivFetch(path, opts = {}, ms = 30000) {
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(aivBase() + path, { ...opts, signal: ctl.signal, headers: { ...(opts.headers || {}), ...(AIVS.aivToken ? { 'x-token': AIVS.aivToken.trim() } : {}) } });
    if (r.status === 401) throw new Error('wrong token — copy it again from the notebook');
    return r;
  } catch (e) { if (e.name === 'AbortError') throw new Error('the server did not answer in time'); if (/Failed to fetch|NetworkError/i.test(e.message)) throw new Error(`cannot reach ${aivBase()} — is the server / notebook running?`); throw e; }
  finally { clearTimeout(tm); }
}
async function aivTest() {
  const el = aivz('aivInfo'); el.textContent = '🔌 Checking the server...';
  try {
    const h = await (await aivFetch('/health', {}, 15000)).json(); AIV.health = h;
    el.textContent = h.ready ? `✅ Connected: model ${h.model} on ${h.device}${h.vram_gb ? ` (${h.vram_gb} GB)` : ''} · lip-sync ${h.lipsync ? 'ready' : 'not installed'}${h.queue ? ` · ${h.queue} clip(s) waiting` : ''}`
      : h.error ? `⚠ Server is running but the model failed to load: ${h.error}` : `⏳ Server is running, the model is still loading (first time it downloads — wait a few minutes, then test again).`;
    return h;
  } catch (e) { el.textContent = '⚠ ' + e.message; AIV.health = null; return null; }
}

// ---------- ✨ Gemini: har scene ka motion prompt (1 request / 40 scenes, project mein save) ----------
function aivSpeaker(s) { if (typeof kvSpeaker === 'function') { try { return kvSpeaker(s); } catch (e) {} } return s.speaker && !/^narrator$/i.test(s.speaker) ? s.speaker : ''; }
async function aivPrompts(force = false) {
  if (!news || !news.scenes || !news.scenes.length) return addLog('🎞 Open a project first', 'warn');
  const todo = news.scenes.filter((s) => force || !s.aivPrompt);
  if (!todo.length) { aivPaint(); return; }
  const looks = ((news.bible && news.bible.characters) || []).map((c) => `${c.name}: ${oneLine(c.look || '').slice(0, 100)}`).join('\n');
  for (let i = 0; i < todo.length; i += 40) {
    const part = todo.slice(i, i + 40);
    aivz('aivInfo').textContent = `✨ Gemini writes motion prompts ${i + 1}-${i + part.length}/${todo.length}...`;
    const lines = part.map((s) => `${s.n}. PICTURE: ${oneLine(s.imageCore || s.image || '').split(/ Characters \(keep| Style: /)[0].slice(0, 260)} | SPEAKER: ${aivSpeaker(s) || 'narrator'} | LINE: ${oneLine(s.dialogue || '').slice(0, 200)}`).join('\n');
    const j = await llm('AI motion prompts', `You direct short AI video shots. Each numbered shot starts from the given PICTURE and lasts a few seconds.
For each shot write ONE motion prompt (25-45 words, English) for an image-to-video model:
- what moves and how, matching the line: who walks / turns / looks / gestures, vehicles driving, rain, fire, leaves, water, crowds;
- if a character (not the narrator) is the SPEAKER, that character is talking: "talks with natural mouth movement, small head nods and hand gestures";
- one simple camera move (slow push-in, slow pan, gentle tracking, or static);
- keep the same characters, faces, clothes, place and art style; no new people, no text; smooth, natural, not too fast.
Characters:\n${looks || '(none)'}
SHOTS:
${lines}
Return ONLY JSON: {"shots": [{"n": 1, "motion": "..."}]}`, { json: true, temperature: 0.5 });
    for (const x of (parseJSON(j.text) || {}).shots || []) { const s = part.find((q) => q.n === Number(x.n)); if (s && x.motion) s.aivPrompt = oneLine(x.motion).slice(0, 600); }
    projectSave();
  }
  aivz('aivInfo').textContent = `✨ Motion prompts ready for ${news.scenes.filter((s) => s.aivPrompt).length}/${news.scenes.length} scene(s) — edit any of them below.`;
  aivPaint();
}

// ---------- 🎞 clips banao (ek-ek karke; server ek waqt mein ek banata hai) ----------
async function aivB64(blob) { const u = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
async function aivPicture(blob) { const bm = await createImageBitmap(blob), k = Math.min(1, 1280 / Math.max(bm.width, bm.height)), c = new OffscreenCanvas(Math.round(bm.width * k), Math.round(bm.height * k)); c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height); bm.close(); return aivB64(await c.convertToBlob({ type: 'image/jpeg', quality: 0.93 })); }
async function aivVoiceLen(blob) { try { const w = parseWav(new Uint8Array(await blob.arrayBuffer())); return w.samples.length / w.rate; } catch (e) { return 0; } }
function aivStatus(n, txt, cls = '') { const el = document.querySelector(`#aivList [data-n="${n}"] .aivSt`); if (el) { el.textContent = txt; el.className = 'aivSt small ' + cls; } }
async function aivOne(s) {
  const img = await idbImg.get(sceneImgKey(s.n)).catch(() => null); if (!img) { aivStatus(s.n, 'no picture yet', 'muted'); return false; }
  const voice = await idb.get(audioKey(s.n)).catch(() => null), vlen = voice ? await aivVoiceLen(voice) : 0;
  const gap = Number((aivz('vGap') || {}).value) || 1, seconds = Math.min(60, Math.max(3, (vlen || 4) + gap + 0.8));
  const talk = AIVS.aivTalk && !!aivSpeaker(s), prompt = s.aivPrompt || oneLine(s.imageCore || s.image || '').slice(0, 300);
  const body = { image: await aivPicture(img), prompt, seconds, seed: (s.n * 7919) % 100000, lipsync: !!(AIVS.aivLip && talk && voice), audio: AIVS.aivLip && talk && voice ? await aivB64(voice) : undefined };
  aivStatus(s.n, '⬆ sending…');
  let job = null;
  // pichhli baar ka adhoora job (panel band hua tha) → wahi aage
  if (s.aivJob) { try { const r = await (await aivFetch('/job?id=' + s.aivJob, {}, 15000)).json(); if (r && r.state && r.state !== 'error') job = s.aivJob; } catch (e) {} }
  if (!job) { const r = await aivFetch('/animate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }, 120000); const j = await r.json(); if (!r.ok || !j.job) throw new Error(j.error || 'server refused the clip'); job = j.job; s.aivJob = job; projectSave(); }
  const t0 = Date.now();
  for (;;) {
    if (AIV.stop) { aivStatus(s.n, '⏸ stopped (the server finishes it; press Make clips to pick it up)', 'muted'); return false; }
    await new Promise((ok) => setTimeout(ok, 3000));
    let st; try { st = await (await aivFetch('/job?id=' + job, {}, 20000)).json(); } catch (e) { aivStatus(s.n, '⚠ ' + e.message + ' — retrying…', 'warn'); continue; }
    if (st.state === 'error') { delete s.aivJob; projectSave(); throw new Error(st.error || 'the server could not make this clip'); }
    const min = ((Date.now() - t0) / 60000).toFixed(1);
    if (st.state === 'queued') aivStatus(s.n, `⏳ waiting in the server queue${st.queue_position ? ' (#' + st.queue_position + ')' : ''} · ${min} min`);
    if (st.state === 'running') aivStatus(s.n, `🎞 ${Math.round((st.progress || 0) * 100)}% · ${st.message || ''} · ${min} min`);
    if (st.state === 'done') {
      const v = await (await aivFetch('/result?id=' + job, {}, 180000)).blob();
      await idbVid.put(aivKey(s.n), new File([v], `ai-motion-${s.n}.mp4`, { type: 'video/mp4' }));
      s.kclip = { name: '🎞 AI motion', size: v.size, ai: true, lip: !!st.lipsynced }; delete s.aivJob; projectSave();
      aivStatus(s.n, `✅ clip ready${st.lipsynced ? ' · lip-synced' : body.lipsync ? ' · ' + (st.warning || 'no lip-sync') : ''} (${min} min)`, 'ok');
      return true;
    }
  }
}
async function aivRun(only = null) {
  if (AIV.running) return; if (!news || !news.scenes) return addLog('🎞 Open a project first', 'warn');
  const h = await aivTest(); if (!h || !h.ready) return;
  if (news.scenes.some((s) => !s.aivPrompt)) await aivPrompts().catch((e) => addLog('🎞 Motion prompts: ' + e.message + ' — the picture prompt is used instead', 'warn'));
  const list = only ? news.scenes.filter((s) => s.n === only) : news.scenes.filter((s) => AIVS.aivRedo || !(s.kclip && s.kclip.ai));
  if (!list.length) return (aivz('aivInfo').textContent = '✅ Every scene already has its AI clip. Tick "make again" to redo them, or 🔄 one scene.');
  AIV.running = true; AIV.stop = false; aivz('aivRunBtn').disabled = true; aivz('aivStopBtn').disabled = false;
  let ok = 0, bad = 0; const t0 = Date.now();
  try {
    for (const [k, s] of list.entries()) {
      if (AIV.stop) break;
      aivz('aivInfo').textContent = `🎞 Clip ${k + 1}/${list.length} (scene #${s.n})${ok ? ` · about ${Math.round(((Date.now() - t0) / 60000 / ok) * (list.length - k))} min left` : ''} — keep this panel${/127\.0\.0\.1|localhost/.test(aivBase()) ? '' : ' and the notebook'} open`;
      try { if (await aivOne(s)) ok++; } catch (e) { bad++; aivStatus(s.n, '⚠ ' + e.message, 'warn'); addLog(`🎞 Scene #${s.n}: ${e.message}`, 'warn'); }
    }
  } finally { AIV.running = false; aivz('aivRunBtn').disabled = false; aivz('aivStopBtn').disabled = true; }
  const msg = `🎞 AI motion: ${ok} clip(s) made${bad ? `, ${bad} failed` : ''}. 🎬 Make video uses them in place of the pictures.`;
  aivz('aivInfo').textContent = msg; addLog(msg, ok ? 'success' : 'warn'); aivPaint();
}

// ---------- UI ----------
function aivPaint() {
  const box = aivz('aivList'); if (!box) return;
  if (!news || !news.scenes || !news.scenes.length) { box.innerHTML = '<p class="muted small">Open a project with pictures first.</p>'; return; }
  const esc = (t) => String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  box.innerHTML = news.scenes.map((s) => `<div class="aivRow" data-n="${s.n}" style="display:flex;gap:6px;align-items:flex-start;border-top:1px solid #8883;padding:5px 0">
    <img class="aivImg" style="width:84px;height:48px;object-fit:cover;border-radius:4px;background:#222" />
    <div style="flex:1;min-width:0"><div class="small"><b>#${s.n}</b> ${aivSpeaker(s) ? '🗣 ' + esc(aivSpeaker(s)) : '🎙 narrator'} · <span class="aivSt small ${s.kclip && s.kclip.ai ? 'ok' : 'muted'}">${s.kclip && s.kclip.ai ? '✅ clip ready' + (s.kclip.lip ? ' · lip-synced' : '') : s.aivJob ? '⏳ being made on the server' : 'no clip yet'}</span></div>
    <textarea class="aivP" rows="2" style="width:100%" placeholder="Motion prompt (✨ Gemini writes it)">${esc(s.aivPrompt || '')}</textarea>
    <div class="row wrap"><button class="ghost small-btn aivPlay" ${s.kclip && s.kclip.ai ? '' : 'disabled'}>▶ Play</button><button class="ghost small-btn aivRedo">🔄 Make this one</button><button class="ghost small-btn aivDel" ${s.kclip && s.kclip.ai ? '' : 'disabled'}>✕ Use the picture</button></div><div class="aivVid"></div></div></div>`).join('');
  box.querySelectorAll('.aivRow').forEach(async (row) => {
    const n = Number(row.dataset.n), s = news.scenes.find((q) => q.n === n);
    idbImg.get(sceneImgKey(n)).then((b) => { if (b) row.querySelector('.aivImg').src = URL.createObjectURL(b); }).catch(() => {});
    row.querySelector('.aivP').onchange = (e) => { s.aivPrompt = oneLine(e.target.value); projectSave(); };
    row.querySelector('.aivRedo').onclick = () => aivRun(n);
    row.querySelector('.aivDel').onclick = async () => { await idbVid.del(aivKey(n)).catch(() => {}); delete s.kclip; projectSave(); aivPaint(); };
    row.querySelector('.aivPlay').onclick = async () => { const b = await idbVid.get(aivKey(n)).catch(() => null); if (!b) return; const v = document.createElement('video'); v.src = URL.createObjectURL(b); v.controls = true; v.autoplay = true; v.style.width = '100%'; const d = row.querySelector('.aivVid'); d.innerHTML = ''; d.appendChild(v); };
  });
}
async function aivInit() {
  if (!aivz('aivBox')) return;
  const { aivSettings } = await chrome.storage.local.get('aivSettings'); AIVS = { ...AIV_DEF, ...(aivSettings || {}) };
  for (const id of Object.keys(AIV_DEF)) { const el = aivz(id); if (!el) continue; if (el.type === 'checkbox') el.checked = !!AIVS[id]; else el.value = AIVS[id]; el.addEventListener('change', () => { AIVS[id] = el.type === 'checkbox' ? el.checked : el.value.trim(); chrome.storage.local.set({ aivSettings: AIVS }); }); }
  aivz('aivTestBtn').onclick = aivTest;
  aivz('aivPromptBtn').onclick = () => aivPrompts(true).catch((e) => (aivz('aivInfo').textContent = '⚠ ' + e.message));
  aivz('aivRunBtn').onclick = () => aivRun().catch((e) => { AIV.running = false; aivz('aivInfo').textContent = '⚠ ' + e.message; });
  aivz('aivStopBtn').onclick = () => { AIV.stop = true; aivz('aivInfo').textContent = '⏸ Stopping after the current check…'; };
  aivz('aivBox').addEventListener('toggle', () => { if (aivz('aivBox').open) aivPaint(); });
  const _rs = window.renderScenes; if (_rs) window.renderScenes = (...a) => { const r = _rs(...a); try { if (aivz('aivBox').open) aivPaint(); } catch (e) {} return r; };
}
if (typeof document !== 'undefined' && document.getElementById) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(aivInit, 560)); else setTimeout(aivInit, 560); }
