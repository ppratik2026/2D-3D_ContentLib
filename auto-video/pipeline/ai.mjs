// Story AI providers: Gemini (native API) + any OpenAI-compatible API (Groq, OpenRouter, Mistral, Cerebras, custom).
// askJSON() walks a chain of {provider, model, key}: retries busy/rate-limited calls, skips models that are gone,
// stops at once on a dead key or an exhausted daily quota, and reports what every provider answered.

export const PROVIDERS = {
  gemini:     { label: 'Google Gemini', base: process.env.AV_GEMINI_BASE || 'https://generativelanguage.googleapis.com/v1beta', keyUrl: 'https://aistudio.google.com/apikey', free: 'Free: Flash-Lite ~500/day, Flash ~20/day per project (see AI Studio → Rate limit)', native: true },
  groq:       { label: 'Groq', base: 'https://api.groq.com/openai/v1', keyUrl: 'https://console.groq.com/keys', free: 'Free: ~1,000 requests/day, no card needed', prefer: ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'qwen'] },
  openrouter: { label: 'OpenRouter', base: 'https://openrouter.ai/api/v1', keyUrl: 'https://openrouter.ai/keys', free: 'Free: models ending in ":free", 50/day (1,000/day after a one-time $10 top-up)', freeOnly: true },
  mistral:    { label: 'Mistral', base: 'https://api.mistral.ai/v1', keyUrl: 'https://console.mistral.ai/api-keys', free: 'Free "Experiment" plan (your data may be used for training)', prefer: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'] },
  cerebras:   { label: 'Cerebras', base: 'https://api.cerebras.ai/v1', keyUrl: 'https://cloud.cerebras.ai', free: 'Free trial limits (may change)' },
  custom:     { label: 'Custom (OpenAI-compatible)', base: '', keyUrl: '', free: 'Any OpenAI-compatible server, e.g. a local LM Studio / Ollama URL' },
};
const SKIP = /(tts|whisper|guard|image|audio|live|embed|vision|aqa|native-audio|computer|robotics|veo|imagen|learnlm|moderation|rerank|transcribe|ocr|banana|thinking-exp)/i;
const baseOf = (p) => (p.provider === 'custom' ? String(p.baseUrl || '').replace(/\/+$/, '') : PROVIDERS[p.provider].base);
const sleep = (s) => new Promise((ok) => setTimeout(ok, s * 1000));
const WAITS = (process.env.AV_GEMINI_WAITS || '5,10,20,40').split(',').map(Number);

function apiError(status, txt, headers) {
  let msg = txt, delay = 0; try { const j = JSON.parse(txt); const er = j.error || j; msg = er.message || er.error || txt; const ri = (er.details || []).find((d) => /RetryInfo/.test(d['@type'] || '')); if (ri) delay = parseFloat(ri.retryDelay) || 0; } catch {}
  const ra = headers?.get?.('retry-after'); if (ra && !delay) delay = parseFloat(ra) || 0;
  const e = new Error(`HTTP ${status}: ${String(typeof msg === 'string' ? msg : JSON.stringify(msg)).slice(0, 240)}`); e.status = status; e.retryDelay = delay; return e;
}
export function parseJSON(s) {
  s = String(s).trim().replace(/^```(json)?/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(s); } catch { const a = s.indexOf('{'), b = s.lastIndexOf('}'); if (a < 0 || b <= a) throw new Error('No JSON in the reply'); return JSON.parse(s.slice(a, b + 1)); }
}

// ---------- model lists ----------
const cache = new Map();
export async function listModels(p) {
  const ck = p.provider + '|' + (p.baseUrl || '') + '|' + p.key; const c = cache.get(ck); if (c && Date.now() - c.at < 10 * 60e3) return c.ids;
  let ids = [];
  if (p.provider === 'gemini') {
    let page = '';
    for (let k = 0; k < 5; k++) { const r = await fetch(`${baseOf(p)}/models?pageSize=200${page ? '&pageToken=' + page : ''}`, { headers: { 'x-goog-api-key': p.key } }); const t = await r.text(); if (!r.ok) throw apiError(r.status, t, r.headers);
      const j = JSON.parse(t); for (const m of j.models || []) if ((m.supportedGenerationMethods || []).includes('generateContent')) ids.push(String(m.name).replace(/^models\//, '')); if (!j.nextPageToken) break; page = j.nextPageToken; }
  } else {
    const r = await fetch(`${baseOf(p)}/models`, { headers: { Authorization: `Bearer ${p.key}` } }); const t = await r.text(); if (!r.ok) throw apiError(r.status, t, r.headers);
    const j = JSON.parse(t); ids = (j.data || j.models || []).map((m) => String(m.id || m.name));
    if (p.provider === 'openrouter') ids = ids.filter((id) => id.endsWith(':free'));
  }
  ids = ids.filter((id) => !SKIP.test(id));
  cache.set(ck, { at: Date.now(), ids }); return ids;
}
const gver = (id) => { const m = id.match(/gemini-(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : 0; };
// sensible order for a dropdown / fallback: best free-quota models first
export function rankModels(provider, ids) {
  if (provider === 'gemini') {
    const score = (id) => (/^gemini-/.test(id) ? 100 : 0) + gver(id) * 10 + (/flash-lite/.test(id) ? 4 : /flash/.test(id) ? 3 : /pro/.test(id) ? 1 : 0) - (/preview|exp/.test(id) ? 3 : 0);
    return [...ids].sort((a, b) => score(b) - score(a));
  }
  const pref = PROVIDERS[provider]?.prefer || [];
  const score = (id) => { const i = pref.findIndex((x) => id.includes(x)); return (i < 0 ? 0 : 100 - i * 10) + (/70b|120b|large|405b|235b/i.test(id) ? 5 : 0); };
  return [...ids].sort((a, b) => score(b) - score(a));
}
export const defaultModel = (provider, ids) => rankModels(provider, ids)[0] || '';

// ---------- one call ----------
export async function chat(p, { system, user, temperature = 0.9, json = true, maxTokens = 32000, search = false, images = [] }) {
  if (p.provider === 'gemini') {
    const parts = [...images.map((im) => ({ inlineData: { mimeType: im.mime || 'image/jpeg', data: im.b64 } })), { text: user }];
    const body = { contents: [{ role: 'user', parts }], generationConfig: { temperature, maxOutputTokens: maxTokens, ...(json && !search ? { responseMimeType: 'application/json' } : {}) } };
    if (search) body.tools = [{ google_search: {} }]; /* real, recent facts from Google Search (JSON mode cannot be combined with it) */
    if (system) body.systemInstruction = { parts: [{ text: system }] };
    const r = await fetch(`${baseOf(p)}/models/${encodeURIComponent(p.model)}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': p.key }, body: JSON.stringify(body) });
    const t = await r.text(); if (!r.ok) throw apiError(r.status, t, r.headers);
    const j = JSON.parse(t); const c = j.candidates?.[0]; const text = (c?.content?.parts || []).filter((x) => !x.thought).map((x) => x.text || '').join('');
    if (!text) { const e = new Error(`empty reply (${c?.finishReason || j.promptFeedback?.blockReason || 'no candidates'})`); e.status = 'empty'; throw e; }
    if (c?.finishReason === 'MAX_TOKENS') { const e = new Error('reply was cut off (too long)'); e.status = 'cut'; throw e; }
    return text;
  }
  const body = { model: p.model, messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: user }], temperature, max_tokens: Math.min(maxTokens, p.provider === 'groq' ? 32000 : maxTokens) };
  if (json) body.response_format = { type: 'json_object' };
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${p.key}` }; if (p.provider === 'openrouter') { headers['HTTP-Referer'] = 'https://github.com/ppratik2026/2D-3D_ContentLib'; headers['X-Title'] = 'Auto Video Studio'; }
  const r = await fetch(`${baseOf(p)}/chat/completions`, { method: 'POST', headers, body: JSON.stringify(body) });
  const t = await r.text(); if (!r.ok) throw apiError(r.status, t, r.headers);
  const j = JSON.parse(t); const ch = j.choices?.[0]; const text = ch?.message?.content || '';
  if (!text) { const e = new Error('empty reply'); e.status = 'empty'; throw e; }
  if (ch?.finish_reason === 'length') { const e = new Error('reply was cut off (too long)'); e.status = 'cut'; throw e; }
  return text;
}

const short = (e) => (e.quota ? 'no quota left (429)' : e.status === 503 ? 'busy (503)' : e.status === 429 ? 'rate limit (429)' : e.status === 404 ? 'model not available (404)' : e.status === 401 || e.status === 403 ? 'key rejected' : e.status === 400 ? 'rejected (400)' : e.status === 'cut' ? 'reply too long' : e.status === 'empty' ? e.message : e.status >= 500 ? `server error (${e.status})` : e.status ? `HTTP ${e.status}` : /JSON/i.test(e.message) ? 'bad JSON reply' : 'network error');
const isQuota = (e) => e.status === 429 && /quota|billing|credits|insufficient|daily|per day|limit: 0/i.test(e.message) && !/per minute|tokens per minute|rpm|tpm/i.test(e.message);

// chain: [{provider, model, key, baseUrl}] → parsed JSON from the first that works
export async function askJSON(chain, { system, user, temperature = 0.9, onLog = () => {}, validate = (x) => x, search = false, images = [] }) {
  if (search || images.length) chain = chain.filter((p) => p.provider === 'gemini'); /* Google Search and pictures: Gemini only */
  const tried = []; if (!chain.length) throw Object.assign(new Error('No story AI configured. Add a key in Settings → Story AI, or use "Paste from Gemini app".'), { retryable: false });
  for (const [ci, p] of chain.entries()) {
    const name = `${PROVIDERS[p.provider]?.label || p.provider} ${p.model}`; let last = null, fails = 0, jsonMode = true;
    for (let i = 0; i <= WAITS.length; i++) {
      try {
        const text = await chat(p, { system, user, temperature, json: jsonMode, search, images });
        const val = validate(parseJSON(text));
        if (ci > 0) onLog(`Story written by ${name}`);
        return { value: val, used: p };
      } catch (e) {
        last = e; fails++;
        if (isQuota(e)) { e.quota = true; break; }
        if (e.status === 401 || e.status === 403) break;
        if (e.status === 400 && jsonMode && /response_format|json|mime/i.test(e.message)) { jsonMode = false; i--; continue; }
        if (e.status === 404 || e.status === 400 || e.status === 'cut') break;
        if (i < WAITS.length) { const w = Math.min(60, Math.max(WAITS[i], e.retryDelay || 0)); onLog(`${name}: ${short(e)}, retrying in ${Math.round(w)}s (${i + 1}/${WAITS.length})…`); await sleep(w); }
      }
    }
    tried.push(`${name}: ${short(last)}${fails > 1 ? ` ×${fails}` : ''}`);
    if (ci < chain.length - 1) onLog(`${name} failed (${short(last)}) → trying ${PROVIDERS[chain[ci + 1].provider]?.label} ${chain[ci + 1].model}…`);
  }
  const all = (re) => tried.every((t) => re.test(t));
  const err = new Error(
    all(/no quota/) ? `No quota left on any story AI. Tried: ${tried.join(' · ')}. Wait for the daily reset, add another provider key in Settings, or use "Paste from Gemini app".`
    : all(/busy|rate limit|network|server error/) ? `Story AI is busy right now. Tried: ${tried.join(' · ')}`
    : `Story AI could not write the story. Tried: ${tried.join(' · ')}`);
  err.retryable = all(/busy|rate limit|network|server error/); err.quota = all(/no quota/); err.cut = tried.some((t) => /too long/.test(t)); throw err;
}

// ---------- pictures: Gemini image models (new backgrounds) ----------
const IMAGE_MODELS = ['gemini-2.5-flash-image', 'gemini-2.5-flash-image-preview', 'gemini-2.0-flash-preview-image-generation'];
export async function makeImage(key, prompt, { onLog = () => {} } = {}) {
  let all = []; try { const r = await fetch(`${PROVIDERS.gemini.base}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } }); const j = await r.json(); all = (j.models || []).map((m) => String(m.name).replace(/^models\//, '')); } catch {}
  const models = [...IMAGE_MODELS.filter((m) => !all.length || all.includes(m)), ...all.filter((m) => /image/.test(m) && /gemini/.test(m) && !IMAGE_MODELS.includes(m))];
  let last = null;
  for (const model of models) {
    for (let i = 0; i < 3; i++) {
      try {
        const body = { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE', 'TEXT'], ...(/2\.5/.test(model) ? { imageConfig: { aspectRatio: '16:9' } } : {}) } };
        const r = await fetch(`${PROVIDERS.gemini.base}/models/${encodeURIComponent(model)}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body) });
        const t = await r.text(); if (!r.ok) throw apiError(r.status, t, r.headers);
        const part = (JSON.parse(t).candidates?.[0]?.content?.parts || []).find((x) => x.inlineData?.data);
        if (!part) throw Object.assign(new Error('no picture in the reply'), { status: 'empty' });
        return { b64: part.inlineData.data, mime: part.inlineData.mimeType || 'image/png', model };
      } catch (e) { last = e; if (e.status === 429 && !isQuota(e) && i < 2) { onLog(`Picture AI busy, retrying in ${10 * (i + 1)}s…`); await sleep(10 * (i + 1)); continue; } break; }
    }
  }
  const why = !last ? 'no Gemini picture model is available for this key' : last.status === 429 ? 'no free picture quota on this key (Gemini picture models usually need billing turned on in Google AI Studio)' : last.status === 400 || last.status === 403 ? 'this key may not use Gemini picture models (turn on billing in Google AI Studio)' : last.message;
  throw new Error(why);
}
