// Topic finder: 15–20 story topics for a genre.
// "real" = Gemini looks up recent real incidents with Google Search (India first); "ai" = fresh invented ideas.
import { CATEGORIES } from './config.mjs';
import { askJSON } from './ai.mjs';

const LANG = { hindi: 'Hindi (Devanagari)', hinglish: 'Roman Hinglish', english: 'English' };

export async function findTopics({ category, mode = 'ai', chain = [], language = 'hinglish', count = 20, series = false, extra = '', onLog = () => {} }) {
  const cat = CATEGORIES[category] || (category ? { label: String(category).replace(/_/g, ' '), hint: `a ${String(category).replace(/_/g, ' ')} story` } : CATEGORIES.drama); /* Prompt Studio genres too */ const n = Math.max(5, Math.min(25, count));
  const lang = LANG[language] || LANG.hinglish;
  const what = series ? 'a SERIES (many episodes with the same main characters)' : 'one short animated video (1–3 minutes)';
  const shape = `Reply with ONLY this JSON: {"topics":[{"title":"short catchy title in ${lang}","summary":"2 short sentences: what happens, who, the hook","place":"city / state or setting","date":"month year or empty","source":"news site name or empty"}]}`;
  const user = mode === 'real'
    ? `Use Google Search to find ${n} REAL, recent (last 12 months, newest first) news stories from India (a few from elsewhere are fine) for the genre "${cat.label}" that would make a strong story for ${what}.
${extra ? `Focus: ${extra}\n` : ''}Prefer incidents with a clear twist, a smart investigation, an emotional or a surprising ending. Avoid gore, sexual crimes, crimes against children and stories that blame a religion or caste.
For each: the real facts in short. Do not invent facts. Write in ${lang}.
${shape}`
    : `Invent ${n} fresh, different story ideas for the genre "${cat.label}" (${cat.hint}) for ${what}, for an Indian YouTube audience.
${extra ? `Focus: ${extra}\n` : ''}Mix settings (village, city, school, office, family, travel) and give each a strong hook and twist. Write in ${lang}.
${shape}`;
  const validate = (j) => { const t = (Array.isArray(j) ? j : j.topics || []).filter((x) => x && x.title).slice(0, 25); if (t.length < 3) throw new Error('too few topics'); return t; };
  let value;
  if (mode !== 'real') value = (await askJSON(chain, { user, temperature: 1.0, onLog, validate })).value;
  else {
    let first = null;
    if (chain[0]?.provider === 'gemini') { try { /* Google Search only when Gemini is the chosen story AI */ value = (await askJSON(chain, { user, search: true, temperature: 0.4, onLog, validate })).value; } catch (e) { first = e; onLog('Gemini + Google Search not available right now (' + (e.quota ? 'no quota left' : 'error') + ') — reading Google News instead…'); } }
    else onLog('Reading recent Google News headlines…');
    if (!value) { // free fallback: Google News headlines (no key) → any story AI turns them into topics
      const news = await newsHeadlines(category, extra, onLog);
      if (!news.length) throw first || new Error('Could not read Google News right now.');
      try { value = (await askJSON(chain, { temperature: 0.3, onLog, validate, user: `These are real, recent news headlines (India) for the genre "${cat.label}":
${news.map((n, i) => `${i + 1}. ${n.title} (${n.source}, ${n.date})`).join('\n')}
Pick up to ${n} that would make a strong story for ${what} (skip gore, sexual crimes, crimes against children, religion or caste blame). For each, write what happened using ONLY the facts in the headline (do not invent details). Write in ${lang}.
${shape}` })).value; }
      catch (e) { onLog('No story AI quota left — showing the plain headlines'); value = news.slice(0, n).map((x) => ({ title: x.title, summary: '', place: '', date: x.date, source: x.source })); }
    }
  }
  return value.map((t) => ({ title: String(t.title).slice(0, 120), summary: String(t.summary || '').slice(0, 400), place: String(t.place || ''), date: String(t.date || ''), source: String(t.source || ''), real: mode === 'real' }));
}

// Google News RSS (free, no key): recent Indian headlines for the genre
const NEWS_Q = { crime: 'police arrested crime', thriller: 'police chase arrested', mystery: 'mysterious case police', horror: 'mysterious haunted', drama: 'family emotional story', romance: 'love story couple', comedy: 'funny viral', kids: 'children inspiring', motivational: 'inspiring success story' };
export async function newsHeadlines(category, extra = '', onLog = () => {}) {
  const q = `${extra || ''} ${NEWS_Q[category] || category} India`.trim();
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q + ' when:60d')}&hl=en-IN&gl=IN&ceid=IN:en`;
  try { const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }); if (!r.ok) throw new Error('HTTP ' + r.status); return parseRss(await r.text()); }
  catch (e) { onLog('Google News: ' + e.message); return []; }
}
const unx = (s) => String(s || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<[^>]+>/g, '').trim();
export function parseRss(xml) {
  const out = []; for (const m of String(xml).matchAll(/<item>([\s\S]*?)<\/item>/g)) { const it = m[1]; const g = (t) => unx((it.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)) || [])[1]);
    const source = g('source'); let title = g('title'); if (source && title.endsWith(' - ' + source)) title = title.slice(0, -(source.length + 3));
    const d = new Date(g('pubDate')); out.push({ title, source, date: isNaN(d) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) }); }
  return out.filter((x) => x.title).slice(0, 40);
}

// the idea text the story writer gets for a chosen topic
export function topicIdea(t) {
  if (!t) return '';
  return t.real ? `Based on a real incident (${[t.place, t.date].filter(Boolean).join(', ')}): ${t.title}. ${t.summary} Keep the real facts and the order of events; change the names of private people; no gore.`
    : `${t.title}. ${t.summary}`;
}
