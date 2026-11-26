// Step 3: turn the story + voice durations into an exact timeline (seconds):
// scenes, who enters/sits/gestures when, every spoken line, camera shots and sound cues.
import { FPS } from './config.mjs';

const DUR = { enter: 3.0, exit: 2.6, run_exit: 1.6, walk_to: 2.2, sit: 1.1, stand: 1.0,
  go_to: 2.4, faint: 1.2, lie: 1.4, drive_in: 3.4, drive_away: 3.0, get_in: 2.6, get_out: 2.0, car_chase: 8, foot_chase: 6, catch: 2.4, handcuff: 2.8 };
const GESTURE = ['wave', 'nod', 'laugh', 'point', 'think', 'shock', 'drink', 'phone', 'look_around',
  'hands_up', 'salute', 'namaste', 'cry', 'examine', 'test_tube', 'torch', 'read', 'file', 'write', 'gavel', 'clap', 'angry'];
const VEH = ['car', 'taxi', 'police_jeep', 'ambulance', 'auto', 'van'];
// the 3D sets have no vehicles / markers: map the new actions to the nearest simple one
const SIMPLE = { go_to: 'walk_to', faint: 'sit', lie: 'sit', drive_in: 'enter', drive_away: null, get_in: 'exit', get_out: 'enter', car_chase: 'run_exit', foot_chase: 'run_exit', catch: 'walk_to', handcuff: null };
const TITLE = 3.2, END = 3.0;

export function buildTimeline(story, opts) {
  const { style, look, subs } = opts; const stage = !!opts.stage;
  const vehicles = []; const vkey = (type, color) => { type = VEH.includes(type) ? type : 'car'; const c = /^#[0-9a-f]{6}$/i.test(color || '') ? color : ''; let v = vehicles.find((x) => x.type === type && (!c || x.color === c)); if (!v) { v = { key: type + (vehicles.filter((x) => x.type === type).length || ''), type, color: c || ({ car: '#c0392b', van: '#4a6fa5' })[type] || '' }; vehicles.push(v); } return v.key; };
  let t = TITLE; // title card first
  const scenes = [], lines = [], shots = [], cues = [];
  let lineId = 0;
  story.scenes.forEach((sc, si) => {
    const start = t; const events = []; const present = [...sc.present];
    const enterers = new Set(sc.beats.filter((b) => b.type === 'action' && b.action === 'enter').map((b) => b.char));
    const initial = present.filter((c) => !enterers.has(c));
    const all = [...new Set([...present, ...enterers, ...sc.beats.flatMap((b) => [b.char, ...(Array.isArray(b.with) ? b.with : []), ...(Array.isArray(b.chasers) ? b.chasers : [])])])].filter(Boolean).slice(0, 8);
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
        let act = b.action;
        if (!stage && act in SIMPLE) { act = SIMPLE[act]; if (!act) continue; }
        const d = act === 'car_chase' || act === 'foot_chase' ? Math.max(4, Math.min(20, Number(b.seconds) || DUR[act])) : DUR[act];
        const e = { kind: act, char: b.char, target: act === 'walk_to' && !b.target ? null : b.target, rel: true, d };
        if (stage) {
          if (b.place) e.place = b.place;
          if (['drive_in', 'drive_away', 'get_in', 'get_out', 'car_chase'].includes(act)) e.vehicle = vkey(b.vehicle, b.color);
          if (act === 'car_chase') e.chaser = vkey(b.chaser_vehicle || 'police_jeep');
          if (act === 'drive_in' && Array.isArray(b.with)) e.with = b.with;
          if (act === 'car_chase' || act === 'foot_chase') e.chasers = Array.isArray(b.chasers) ? b.chasers : b.target ? [b.target] : [];
        }
        events.push(e);
      } else if (GESTURE.includes(b.action)) {
        events.push({ kind: 'gesture', name: b.action, char: b.char, d: 1.6, overlap: true });
      }
    }
    scenes.push({ index: si, location: sc.location, background: sc.background || '', weather: sc.weather || 'none', time_of_day: sc.time_of_day, summary: sc.summary, initial, cast: all, start, _events: events });
  });
  return { story, style, look, subs, scenes, lines, shots, cues, vehicles, _tStart: t };
}

// sound cues + camera for the new actions
function actionCues(e, t, sc, cues, shots) {
  const T = t + e.d;
  if (e.kind === 'drive_in') { cues.push({ t, t1: T, kind: 'engine' }); cues.push({ t: T - 0.5, kind: 'brake' }); if (/police|ambulance/.test(e.vehicle)) cues.push({ t, t1: T, kind: 'siren', amb: /ambulance/.test(e.vehicle) }); }
  if (e.kind === 'drive_away') { cues.push({ t, t1: T + 1, kind: 'engine' }); if (/police|ambulance/.test(e.vehicle)) cues.push({ t, t1: T + 1, kind: 'siren', amb: /ambulance/.test(e.vehicle) }); }
  if (e.kind === 'get_in' || e.kind === 'get_out') { cues.push({ t: t + e.d * (e.kind === 'get_in' ? 0.5 : 0.02), kind: 'car_door' }); cues.push({ t: t + e.d * (e.kind === 'get_in' ? 0.9 : 0.65), kind: 'car_door_close' }); }
  if (e.kind === 'car_chase' || e.kind === 'foot_chase') chaseShots(e, t, T, shots, false);
  if (e.kind === 'catch') { cues.push({ t, t1: t + e.d * 0.55, kind: 'run' }); cues.push({ t: t + e.d * 0.5, kind: 'grab' }); shots.push({ t0: t, t1: t + e.d * 0.5, type: 'wide' }); shots.push({ t0: t + e.d * 0.5, t1: T, type: 'two', char: e.char }); }
  if (e.kind === 'handcuff') { cues.push({ t: t + e.d * 0.5, kind: 'cuff' }); shots.push({ t0: t, t1: t + e.d * 0.3, type: 'two', char: e.char }); shots.push({ t0: t + e.d * 0.3, t1: t + e.d * 0.85, type: 'hands', char: e.target }); shots.push({ t0: t + e.d * 0.85, t1: T, type: 'two', char: e.char }); }
  if (e.kind === 'faint') cues.push({ t: t + 0.6, kind: 'fall' });
  if (e.kind === 'go_to' && e.place === 'cell') cues.push({ t: T - 0.2, kind: 'clank' });
}
function chaseShots(e, t0, t1, shots, cont) {
  const seq = e.kind === 'car_chase' ? [{ type: 'wide' }, { type: 'vehicle', vehicle: e.vehicle }, { type: 'vehicle', vehicle: e.chaser }, { type: 'wide' }, { type: 'speaker', char: e.char }, { type: 'vehicle', vehicle: e.chaser }]
    : [{ type: 'wide' }, { type: 'speaker', char: e.char }, { type: 'wide' }, ...(e.chasers || []).slice(0, 2).map((c) => ({ type: 'speaker', char: c }))];
  if (cont) return; // lines during the chase use their own speaker shots
  let i = 0; for (let x = t0; x < t1 - 0.3; x += 1.6, i++) shots.push({ t0: x, t1: Math.min(t1, x + 1.6), ...seq[i % seq.length] });
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
        const { rel, d, ...rest } = e; sc.events.push({ ...rest, target: e.target || null, t0: t, t1: t + e.d });
        actionCues(e, t, sc, cues, shots);
        if (e.kind === 'enter' || e.kind === 'exit' || e.kind === 'run_exit') cues.push({ t: e.kind === 'enter' ? t : t + e.d - 0.4, kind: 'door', location: sc.location });
        if (['enter', 'exit', 'run_exit', 'walk_to', 'sit', 'stand', 'go_to'].includes(e.kind)) cues.push({ t, t1: t + e.d, kind: e.kind === 'run_exit' ? 'run' : e.kind === 'sit' ? 'sit' : e.kind === 'stand' ? 'stand' : 'walk' });
        if (!['car_chase', 'foot_chase', 'handcuff', 'catch'].includes(e.kind)) shots.push({ t0: t, t1: t + e.d, type: 'wide' }); t += e.d;
      }
    }
    t += 0.9; sc.end = t; shots.push({ t0: t - 0.9, t1: t, type: 'wide' });
    for (const e of sc.events) if (e.kind === 'car_chase' || e.kind === 'foot_chase') { const nx = sc.events.find((x) => x.t0 >= e.t1 - 0.01 && x !== e && x.kind !== 'gesture'); const until = Math.max(e.t1, nx ? nx.t0 : sc.end - 0.4);
      cues.push({ t: e.t0, t1: until, kind: e.kind === 'car_chase' ? 'chase_car' : 'chase_foot', police: e.kind === 'car_chase' && /police/.test(e.chaser || '') });
      if (e.kind === 'car_chase') { cues.push({ t: until - 0.3, kind: 'screech' }); }
      // keep the chase camera going through the lines spoken during the chase
      if (until > e.t1) chaseShots(e, e.t1, until, shots, true); }
    delete sc._events;
  }
  tl.end = t + END; tl.duration = tl.end;
  tl.durationInFrames = Math.ceil(tl.duration * FPS);
  // weather cues: thunder every 7–14 s in storm scenes (deterministic)
  for (const sc of tl.scenes) if (sc.weather === 'storm') { let k = sc.index * 7 + 3; for (let x = sc.start + 2.5; x < sc.end - 1; x += 7 + ((k = (k * 13 + 5) % 17) % 8)) cues.push({ t: x, kind: 'thunder' }); }
  tl.cues = cues;
  // merge / clean shots: later shot wins; drop very short speaker shots
  shots.sort((a, b) => a.t0 - b.t0);
  const clean = [];
  for (const s of shots) {
    if (s.type === 'vehicle' || s.type === 'hands') { const prev = clean[clean.length - 1]; if (prev && s.t0 < prev.t1) prev.t1 = Math.max(prev.t0 + 0.01, s.t0); clean.push({ ...s }); continue; }
    const prev = clean[clean.length - 1];
    if (prev && s.t0 < prev.t1) prev.t1 = Math.max(prev.t0 + 0.01, s.t0);
    if (prev && prev.type === s.type && prev.char === s.char && s.t0 - prev.t1 < 0.05) { prev.t1 = s.t1; continue; }
    clean.push({ ...s });
  }
  for (let i = 1; i < clean.length; i++) if (clean[i].t1 - clean[i].t0 < 1.2 && !['wide', 'vehicle', 'hands'].includes(clean[i].type)) clean[i].type = clean[i - 1].type, clean[i].char = clean[i - 1].char;
  tl.shots = clean.filter((s) => s.t1 > s.t0);
  for (const l of tl.lines) { delete l._beat; delete l._pending; delete l._shot; }
  return tl;
}
