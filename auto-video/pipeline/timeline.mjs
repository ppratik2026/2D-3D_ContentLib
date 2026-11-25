// Step 3: turn the story + voice durations into an exact timeline (seconds):
// scenes, who enters/sits/gestures when, every spoken line, camera shots and sound cues.
import { FPS } from './config.mjs';

const DUR = { enter: 3.0, exit: 2.6, run_exit: 1.6, walk_to: 2.2, sit: 1.1, stand: 1.0 };
const GESTURE = ['wave', 'nod', 'laugh', 'point', 'think', 'shock', 'drink', 'phone', 'look_around'];
const TITLE = 3.2, END = 3.0;

export function buildTimeline(story, opts) {
  const { style, look, subs } = opts;
  let t = TITLE; // title card first
  const scenes = [], lines = [], shots = [], cues = [];
  let lineId = 0;
  story.scenes.forEach((sc, si) => {
    const start = t; const events = []; const present = [...sc.present];
    const enterers = new Set(sc.beats.filter((b) => b.type === 'action' && b.action === 'enter').map((b) => b.char));
    const initial = present.filter((c) => !enterers.has(c));
    const all = [...new Set([...present, ...enterers, ...sc.beats.map((b) => b.char)])].slice(0, 4);
    cues.push({ t: start, kind: 'scene', location: sc.location });
    t += si === 0 ? 1.8 : 1.4; // establishing shot
    shots.push({ t0: start, t1: t, type: 'wide' });
    let lineInScene = 0;
    for (const b of sc.beats) {
      if (b.type === 'line') {
        const l = { id: lineId++, scene: si, char: b.char, emotion: b.emotion, hindi: b.hindi, hinglish: b.hinglish, english: b.english, start: t };
        lines.push(l); l._beat = b;
        // camera: first line of a scene = two-shot, then mostly the speaker, a wide every 5th line
        const type = lineInScene === 0 ? 'two' : lineInScene % 5 === 4 ? 'wide' : 'speaker';
        l._shot = { type, char: b.char }; lineInScene++;
        t += 0.0; l._pending = true; // duration filled after TTS (see finalize)
        events.push({ kind: 'line', ref: l });
      } else if (b.action in DUR) {
        const d = DUR[b.action];
        events.push({ kind: b.action, char: b.char, target: b.target, rel: true, d });
      } else if (GESTURE.includes(b.action)) {
        events.push({ kind: 'gesture', name: b.action, char: b.char, d: 1.6, overlap: true });
      }
    }
    scenes.push({ index: si, location: sc.location, time_of_day: sc.time_of_day, summary: sc.summary, initial, cast: all, start, _events: events });
  });
  return { story, style, look, subs, scenes, lines, shots, cues, _tStart: t };
}

// Second pass once every line has a duration: lay out the real times.
export function finalize(tl) {
  let t = TITLE; const shots = []; const cues = [];
  for (const sc of tl.scenes) {
    sc.start = t; cues.push({ t, kind: 'scene', location: sc.location });
    const est = sc.index === 0 ? 1.8 : 1.4; shots.push({ t0: t, t1: t + est, type: 'wide' }); t += est;
    sc.events = [];
    for (const e of sc._events) {
      if (e.kind === 'line') {
        const l = e.ref; l.start = t; l.end = t + l.duration; t = l.end + 0.32;
        shots.push({ t0: l.start - 0.15, t1: t, type: l._shot.type, char: l.char });
      } else if (e.kind === 'gesture') {
        sc.events.push({ kind: 'gesture', name: e.name, char: e.char, t0: t, t1: t + e.d }); t += 0.25;
      } else {
        sc.events.push({ kind: e.kind, char: e.char, target: e.target || null, t0: t, t1: t + e.d });
        if (e.kind === 'enter' || e.kind === 'exit' || e.kind === 'run_exit') cues.push({ t: e.kind === 'enter' ? t : t + e.d - 0.4, kind: 'door', location: sc.location });
        cues.push({ t, t1: t + e.d, kind: e.kind === 'run_exit' ? 'run' : e.kind === 'sit' ? 'sit' : e.kind === 'stand' ? 'stand' : 'walk' });
        shots.push({ t0: t, t1: t + e.d, type: 'wide' }); t += e.d;
      }
    }
    t += 0.9; sc.end = t; shots.push({ t0: t - 0.9, t1: t, type: 'wide' });
    delete sc._events;
  }
  tl.end = t + END; tl.duration = tl.end;
  tl.durationInFrames = Math.ceil(tl.duration * FPS);
  tl.cues = cues;
  // merge / clean shots: later shot wins; drop very short speaker shots
  shots.sort((a, b) => a.t0 - b.t0);
  const clean = [];
  for (const s of shots) {
    const prev = clean[clean.length - 1];
    if (prev && s.t0 < prev.t1) prev.t1 = Math.max(prev.t0 + 0.01, s.t0);
    if (prev && prev.type === s.type && prev.char === s.char && s.t0 - prev.t1 < 0.05) { prev.t1 = s.t1; continue; }
    clean.push({ ...s });
  }
  for (let i = 1; i < clean.length; i++) if (clean[i].t1 - clean[i].t0 < 1.2 && clean[i].type !== 'wide') clean[i].type = clean[i - 1].type, clean[i].char = clean[i - 1].char;
  tl.shots = clean.filter((s) => s.t1 > s.t0);
  for (const l of tl.lines) { delete l._beat; delete l._pending; delete l._shot; }
  return tl;
}
