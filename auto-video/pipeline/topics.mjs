// Topic finder: 15–20 story topics for a genre.
// "real" = Gemini looks up recent real incidents with Google Search (India first); "ai" = fresh invented ideas.
import { CATEGORIES } from './config.mjs';
import { askJSON } from './ai.mjs';

const LANG = { hindi: 'Hindi (Devanagari)', hinglish: 'Roman Hinglish', english: 'English' };

export async function findTopics({ category, mode = 'ai', chain = [], language = 'hinglish', count = 20, series = false, extra = '', onLog = () => {} }) {
  const cat = CATEGORIES[category] || CATEGORIES.drama; const n = Math.max(5, Math.min(25, count));
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
  const { value } = await askJSON(chain, { user, search: mode === 'real', temperature: mode === 'real' ? 0.4 : 1.0, onLog,
    validate: (j) => { const t = (Array.isArray(j) ? j : j.topics || []).filter((x) => x && x.title).slice(0, 25); if (t.length < 3) throw new Error('too few topics'); return t; } });
  return value.map((t) => ({ title: String(t.title).slice(0, 120), summary: String(t.summary || '').slice(0, 400), place: String(t.place || ''), date: String(t.date || ''), source: String(t.source || ''), real: mode === 'real' }));
}

// the idea text the story writer gets for a chosen topic
export function topicIdea(t) {
  if (!t) return '';
  return t.real ? `Based on a real incident (${[t.place, t.date].filter(Boolean).join(', ')}): ${t.title}. ${t.summary} Keep the real facts and the order of events; change the names of private people; no gore.`
    : `${t.title}. ${t.summary}`;
}
