// New backgrounds made by Gemini for a story: same art theme as the chosen style, saved into the Backgrounds library
// (so later videos and series episodes reuse them). Gemini then looks at the picture once to mark the floor line and seats.
import fs from 'fs';
import path from 'path';
import { BG_DIR, PLACES } from './backgrounds.mjs';
import { makeImage, makeImageFree, askJSON } from './ai.mjs';

export const THEMES = {
  bean2d: { tag: 'bean', look: 'dark night 2D doodle cartoon background: very dark grey-blue walls and floor, flat simple shapes with thin light-grey outlines, a few warm glowing lamps, muted colours, side view like a stage, clean vector look, no gradients except soft lamp glow', height: 0.4, near: 0.91, far: 0.874 },
  flat2d: { tag: 'flat', look: 'flat 2D vector explainer-video background: simple flat shapes, bright pastel colours, thin dark outlines, no gradients, side view like a stage, clean and tidy', height: 0.6, near: 0.95, far: 0.82 },
  cartoon2d: { tag: null, look: 'Indian 2D cartoon animation background, hand-painted digital art, soft cel shading, warm colours, side view like a stage', height: 0.62, near: 0.93, far: 0.74 },
};
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 28) || 'place';

export function bgPrompt(desc, style, time = 'day') {
  const th = THEMES[style] || THEMES.cartoon2d;
  return `Create a 16:9 background image for an animated video. Place: ${desc}. Time: ${time}.
Art style: ${th.look}.
Rules: an EMPTY scene with NO people, NO animals, NO text, NO letters, NO watermark. The camera looks straight at the scene from the side (like a theatre stage). The floor / ground is a clear horizontal strip across the lower 15–20% of the picture where characters will stand; nothing big stands in front of it. Furniture (chairs, tables, beds, counters) stands on the floor line, seen from the side.`;
}

// Gemini looks at the new picture and says where feet stand, how tall people are, and where the seats are
async function markPicture(chain, b64, mime, style, onLog) {
  const th = THEMES[style] || THEMES.cartoon2d;
  try {
    const { value } = await askJSON(chain, { images: [{ b64, mime }], temperature: 0.2, onLog,
      user: `This 16:9 picture is an empty background for a 2D cartoon (characters are added later, seen from the side). Measure, as fractions of the picture (0 = left / top, 1 = right / bottom):
- "floorNear": the y where the feet of a person standing at the front of the floor would be.
- "floorFar": the y where the feet of a person standing at the back of the floor would be (a bit higher).
- "personHeight": how tall a standing adult at the front should be (fraction of the picture height) so the room looks right.
- "seats": every chair / stool / bench / sofa / bed where a person could sit: {"type":"seat|bed|counter|desk","x":centre x,"y":y of the floor under it,"face":1 if the seated person faces right or -1 if left,"tableY":y of the table top next to it or null}. A counter = where a shopkeeper / barista stands behind.
Reply with ONLY JSON: {"floorNear":0.9,"floorFar":0.85,"personHeight":0.45,"time":"day|night|evening|morning","indoor":true,"place":"one of: ${Object.keys(PLACES).join(', ')}","seats":[]}`,
      validate: (j) => j });
    const c = (v, a, b, d) => (Number.isFinite(+v) ? Math.min(b, Math.max(a, +v)) : d);
    const near = c(value.floorNear, 0.7, 0.98, th.near), far = c(value.floorFar, 0.55, near - 0.005, Math.min(near - 0.01, th.far));
    const seats = (Array.isArray(value.seats) ? value.seats : []).slice(0, 8).map((m) => ({ type: ['seat', 'bed', 'counter', 'desk'].includes(m.type) ? m.type : 'seat', x: c(m.x, 0.04, 0.96, 0.5), y: c(m.y, 0.5, 0.99, near), ...(m.type === 'seat' || !m.type ? { face: m.face < 0 ? -1 : 1 } : {}), ...(m.tableY != null && Number.isFinite(+m.tableY) ? { tableY: c(m.tableY, 0.3, 0.98, null), cup: true } : {}), ...(m.type === 'counter' ? { w: 0.25, cover: c(+m.y - 0.15, 0.3, 0.95, 0.7) } : {}), ...(m.type === 'bed' ? { w: 0.35 } : {}) }));
    return { groundNear: near, groundFar: far, heightNear: c(value.personHeight, 0.25, 0.75, th.height), seats, time: value.time, indoor: !!value.indoor, place: PLACES[value.place] ? value.place : null };
  } catch (e) { onLog('Could not measure the new background automatically (' + e.message.slice(0, 80) + '), using standard floor lines'); return null; }
}

// desc → saved background (reuses an earlier AI background made for the same description)
// painters: 'gemini' (Gemini picture models, needs billing on the key) and/or 'free' (Pollinations FLUX, no key)
export async function makeStoryBackground({ desc, style, time = 'day', key, chain = [], painters = ['gemini', 'free'], onLog = () => {} }) {
  const th = THEMES[style] || THEMES.cartoon2d; const want = String(desc).trim().toLowerCase();
  for (const id of fs.readdirSync(BG_DIR)) { try { const b = JSON.parse(fs.readFileSync(path.join(BG_DIR, id, 'background.json'), 'utf8')); if (b.ai && b.ai.desc === want && b.ai.style === style && (b.time || 'day') === time) return { bg: b, reused: true }; } catch {} }
  let img = null, err = null;
  for (const pt of painters) { try { if (pt === 'gemini') { if (!key) continue; img = await makeImage(key, bgPrompt(desc, style, time), { onLog }); } else img = await makeImageFree(bgPrompt(desc, style, time), { onLog }); break; } catch (e) { err = e; onLog(`${pt === 'gemini' ? 'Gemini' : 'Free painter'}: ${e.message}`); } }
  if (!img) throw err || new Error('no painter available');
  let id = 'bg_ai_' + slug(desc), k = 1; while (fs.existsSync(path.join(BG_DIR, id))) id = `bg_ai_${slug(desc)}_${++k}`;
  const ext = /png/.test(img.mime) ? '.png' : '.jpg'; fs.mkdirSync(path.join(BG_DIR, id), { recursive: true }); fs.writeFileSync(path.join(BG_DIR, id, 'image' + ext), Buffer.from(img.b64, 'base64'));
  const m = await markPicture(chain, img.b64, img.mime, style, onLog);
  const words = want.split(/[^a-z]+/).filter((w) => w.length > 3).slice(0, 6);
  const b = { id, name: 'AI: ' + String(desc).slice(0, 60), file: `backgrounds/${id}/image${ext}`, place: m?.place || 'other', time: m?.time && /day|night|evening|morning/.test(m.time) ? m.time : time, indoor: !!m?.indoor,
    tags: [...(th.tag ? [th.tag] : []), 'ai', ...words], groundNear: m?.groundNear ?? th.near, groundFar: m?.groundFar ?? th.far, heightNear: m?.heightNear ?? th.height, seats: m?.seats || [], ai: { desc: want, style, model: img.model, made: new Date().toISOString() } };
  fs.writeFileSync(path.join(BG_DIR, id, 'background.json'), JSON.stringify(b, null, 2));
  return { bg: b, reused: false };
}
