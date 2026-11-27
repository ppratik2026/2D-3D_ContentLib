// Plan board: after the script is written (by the AI or from the user's own story) and before voices / render,
// the user sees every character, the background of every scene and every prop, and can swap them.
import { VEHICLES } from './config.mjs';
import { getCast, LOOK_FIELDS } from './cast.mjs';

export const ANIMALS = ['dog', 'cat', 'cow', 'horse', 'goat', 'elephant', 'monkey', 'tiger', 'birds'];
export const ITEMS = ['coffee', 'money', 'laddu', 'give'];
// hand props shown by gestures (what the viewer sees) → the gesture that shows them
export const HAND_PROPS = { cup: ['drink', 'sip', 'hold_cup'], phone: ['phone', 'scroll_phone'], file: ['file', 'read'], notebook: ['write'], 'magnifying glass': ['examine'], 'test tube': ['test_tube'], gavel: ['gavel'], torch: ['torch'], umbrella: ['umbrella'], pan: ['cook'], knife: ['chop'], plate: ['eat'], tray: ['serve'], broom: ['sweep'], 'aarti thali': ['aarti'], laptop: ['type'], diya: ['diya'], sparkler: ['sparkler'], pichkari: ['pichkari'], gulal: ['gulal'] };
const propOfGesture = Object.fromEntries(Object.entries(HAND_PROPS).flatMap(([p, gs]) => gs.map((g) => [g, p])));

export function buildPlan(story, { backgrounds = {}, style = '' } = {}) {
  const lines = {}; for (const sc of story.scenes) for (const b of sc.beats || []) if (b.type === 'line') lines[b.char] = (lines[b.char] || 0) + 1;
  const characters = story.characters.filter((c) => !c.hidden && c.id !== 'narrator').map((c) => ({ id: c.id, name: c.name, role: c.role, gender: c.gender, age: c.age, castId: c.castId || null, size: c.size || 1, lines: lines[c.id] || 0,
    scenes: story.scenes.map((sc, i) => ((sc.present || []).includes(c.id) || (sc.beats || []).some((b) => b.char === c.id || (b.with || []).includes(c.id) || b.target === c.id) ? i + 1 : 0)).filter(Boolean) }));
  const ranked = [...characters].sort((a, b) => b.lines - a.lines); ranked.forEach((c, i) => (c.main = i < Math.min(3, Math.max(1, Math.ceil(ranked.length / 3))) && c.lines > 0));
  const scenes = story.scenes.map((sc, i) => ({ n: i + 1, summary: sc.summary || '', time: sc.time_of_day || 'day', weather: sc.weather || 'none', background: sc.background || '', backgroundName: backgrounds[sc.background]?.name || sc.background || '' }));
  const props = new Map(); const add = (kind, value, n) => { if (!value) return; const k = kind + ':' + value; const p = props.get(k) || { kind, value, scenes: [] }; if (!p.scenes.includes(n)) p.scenes.push(n); props.set(k, p); };
  story.scenes.forEach((sc, i) => { for (const b of sc.beats || []) { if (b.type !== 'action') continue; const n = i + 1;
    if (b.vehicle) add('vehicle', b.vehicle, n); if (b.chaser_vehicle) add('vehicle', b.chaser_vehicle, n);
    if (b.action === 'animal') add('animal', b.animal, n);
    if (b.item) add('item', b.item, n);
    if (propOfGesture[b.action]) add('hand', propOfGesture[b.action], n); } });
  return { title: story.title, style, characters, scenes, props: [...props.values()], options: { vehicles: VEHICLES, animals: ANIMALS, items: ITEMS, hand: Object.keys(HAND_PROPS) } };
}

const swapWord = (txt, from, to) => { if (!from || !to || from === to || typeof txt !== 'string') return txt; if (/^[A-Za-z][A-Za-z .'-]*$/.test(from)) return txt.replace(new RegExp(`\\b${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), to); return txt.split(from).join(to); }; /* whole words for Roman names */
// edits: { characters: [{id, name, role, castId, size, remove}], scenes: [{n, background}], props: [{kind, value, to}] }
export function applyPlan(story, edits = {}) {
  const s = JSON.parse(JSON.stringify(story)); const texts = (fn) => { for (const sc of s.scenes) { sc.summary = fn(sc.summary); for (const b of sc.beats || []) for (const k of ['hindi', 'hinglish', 'english', 'text']) if (b[k]) b[k] = fn(b[k]); } s.logline = fn(s.logline); };
  for (const e of edits.characters || []) { const c = s.characters.find((x) => x.id === e.id); if (!c) continue;
    if (e.castId) { const sv = getCast([e.castId])[0]; if (sv) { for (const k of LOOK_FIELDS) if (k !== 'name' && k !== 'role' && sv[k] != null && sv[k] !== '') c[k] = sv[k]; if (sv.voice) c.voice = sv.voice; c.castId = sv.id; } }
    else if (e.castId === '') { delete c.castId; }
    if (e.name && e.name.trim() && e.name.trim() !== c.name) { const old = c.name; c.name = e.name.trim(); texts((t) => swapWord(t, old, c.name)); const oldFirst = old.split(' ').pop(), newFirst = c.name.split(' ').pop(); if (oldFirst.length > 2) texts((t) => swapWord(t, oldFirst, newFirst)); }
    if (e.role) c.role = e.role; if (e.size) c.size = Math.max(0.6, Math.min(1.4, Number(e.size) || 1)); }
  for (const e of edits.scenes || []) { const sc = s.scenes[e.n - 1]; if (sc && e.background) sc.background = e.background; }
  for (const p of edits.props || []) { if (!p.to || p.to === p.value) continue;
    for (const sc of s.scenes) for (const b of sc.beats || []) { if (b.type !== 'action') continue;
      if (p.kind === 'vehicle') { if (b.vehicle === p.value) b.vehicle = p.to; if (b.chaser_vehicle === p.value) b.chaser_vehicle = p.to; }
      if (p.kind === 'animal' && b.action === 'animal' && b.animal === p.value) b.animal = p.to;
      if (p.kind === 'item' && b.item === p.value) b.item = p.to;
      if (p.kind === 'hand' && propOfGesture[b.action] === p.value) b.action = HAND_PROPS[p.to]?.[0] || b.action; } }
  return s;
}
