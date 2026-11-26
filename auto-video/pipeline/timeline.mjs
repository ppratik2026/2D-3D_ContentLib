// Step 3: turn the story + voice durations into an exact timeline (seconds):
// scenes, who enters/sits/gestures when, every spoken line, camera shots and sound cues.
import { FPS } from './config.mjs';

const DUR = { enter: 3.0, exit: 2.6, run_exit: 1.6, walk_to: 2.2, sit: 1.1, stand: 1.0,
  go_to: 2.4, faint: 1.2, lie: 1.4, drive_in: 3.4, drive_away: 3.0, get_in: 2.6, get_out: 2.0, car_chase: 8, foot_chase: 6, catch: 2.4, handcuff: 2.8, baraat: 12, explosion: 2.4, game: 10, swim: 6, birthday: 10, garba: 12, rakhi: 9, climb: 3.4, climb_down: 2.6, hug: 2.8, fight: 4.0, hold_hands: 0, let_go: 0, escort: 0.8, pickpocket: 3.8, beat: 6, push: 1.9, slap: 1.7, give: 2.6, sleep: 1.4 };
const GESTURE = ['wave', 'nod', 'laugh', 'point', 'think', 'shock', 'drink', 'phone', 'look_around',
  'hands_up', 'salute', 'namaste', 'cry', 'examine', 'test_tube', 'torch', 'read', 'file', 'write', 'gavel', 'clap', 'angry',
  'cook', 'chop', 'eat', 'serve', 'sweep', 'aarti', 'pray', 'dance', 'knock', 'shiver', 'type', 'umbrella', 'pichkari', 'sparkler', 'diya', 'gulal', 'salaam', 'hold_cup', 'cower', 'sip', 'put_down'];
const LONG = { sip: 3.4, drink: 3.4, hold_cup: 3, cower: 3, put_down: 1.2, cook: 5, chop: 4, eat: 4, sweep: 4, aarti: 4, dance: 5, type: 4, pray: 3, umbrella: 8, pichkari: 5, sparkler: 6, diya: 5, gulal: 4 };
const VEH = ['car', 'taxi', 'police_jeep', 'ambulance', 'auto', 'van', 'bike', 'scooter', 'cycle', 'horse', 'boat', 'train', 'helicopter', 'plane'];
const ANIMALS = ['dog', 'cow', 'horse', 'goat', 'cat', 'elephant', 'birds', 'monkey', 'tiger'];
const ANIM_DUR = { enter: 3.2, exit: 3.0, run: 2.2, bark: 1.6, moo: 2.0, neigh: 1.8, graze: 4, sit: 1.2, follow: 3.0, fly: 6, bleat: 1.6, meow: 1.2, trumpet: 2.2, jump: 2.4, chatter: 1.6, roar: 2.2 };
// the 3D sets have no vehicles / markers: map the new actions to the nearest simple one
const SIMPLE = { go_to: 'walk_to', faint: 'sit', lie: 'sit', drive_in: 'enter', drive_away: null, get_in: 'exit', get_out: 'enter', car_chase: 'run_exit', foot_chase: 'run_exit', catch: 'walk_to', handcuff: null, baraat: null, explosion: null, game: null, swim: null, birthday: null, garba: null, rakhi: 'walk_to', climb: null, climb_down: null, hug: 'walk_to', fight: 'walk_to', push: 'walk_to', slap: 'walk_to', give: 'walk_to', sleep: 'sit', hold_hands: null, let_go: null, escort: null, pickpocket: 'walk_to', beat: 'walk_to' };
const TITLE = 3.2, END = 3.0;

export function buildTimeline(story, opts) {
  const { style, look, subs } = opts; const stage = !!opts.stage;
  const animals = []; let crowdMax = 0;
  const vehicles = []; const vkey = (type, color) => { type = VEH.includes(type) ? type : 'car'; const c = /^#[0-9a-f]{6}$/i.test(color || '') ? color : type === 'horse' ? '#f3f1ec' : ''; let v = vehicles.find((x) => x.type === type && (!c || x.color === c)); if (!v) { v = { key: type + (vehicles.filter((x) => x.type === type).length || ''), type, color: c || ({ car: '#c0392b', van: '#4a6fa5' })[type] || '' }; vehicles.push(v); } return v.key; };
  let t = TITLE; // title card first
  const scenes = [], lines = [], shots = [], cues = [];
  let lineId = 0;
  story.scenes.forEach((sc, si) => {
    const start = t; const events = []; const present = [...sc.present];
    const enterers = new Set(); { const seen = new Set(); for (const b of sc.beats) { if (b.type === 'action' && ['hold_hands', 'escort', 'let_go', 'moving_view'].includes(b.action)) continue; const ids = [b.char, ...(Array.isArray(b.with) ? b.with : []), ...(Array.isArray(b.chasers) ? b.chasers : [])].filter(Boolean); for (const id of ids) { if (seen.has(id)) continue; seen.add(id); if (b.type === 'action' && b.action === 'enter' && b.char === id) enterers.add(id); } } } // only people whose FIRST beat is enter come in later
    // people led by the hand (or by the arm) come in with the one who enters
    for (const b of sc.beats) if (b.type === 'action' && (b.action === 'hold_hands' || b.action === 'escort') && enterers.has(b.char) && b.target) enterers.add(b.target);
    const present0 = present.filter((c) => c !== 'narrator'); present.length = 0; present.push(...present0);
    const initial = present.filter((c) => !enterers.has(c));
    const all = [...new Set([...present, ...enterers, ...sc.beats.flatMap((b) => [b.char === 'narrator' ? null : b.char, ...(Array.isArray(b.with) ? b.with : []), ...(Array.isArray(b.chasers) ? b.chasers : [])])])].filter(Boolean).slice(0, 8);
    cues.push({ t: start, kind: 'scene', location: sc.location });
    t += si === 0 ? 1.8 : 1.4; // establishing shot
    shots.push({ t0: start, t1: t, type: 'wide' });
    let lineInScene = 0;
    for (const b of sc.beats) {
      if (b.type === 'line') {
        const l = { id: lineId++, scene: si, char: b.char, emotion: b.emotion, hindi: b.hindi, hinglish: b.hinglish, english: b.english, start: t };
        lines.push(l); l._beat = b;
        // camera: first line of a scene = two-shot, then mostly the speaker, a wide every 5th line
        const type = b.char === 'narrator' ? 'wide' : lineInScene === 0 ? 'two' : lineInScene % 5 === 4 ? 'wide' : 'speaker';
        l._shot = { type, char: b.char }; lineInScene++;
        t += 0.0; l._pending = true; // duration filled after TTS (see finalize)
        events.push({ kind: 'line', ref: l });
      } else if (b.type === 'action' && b.action === 'animal') {
        if (!stage) continue; const type = ANIMALS.includes(b.animal) ? b.animal : 'dog'; if (!animals.some((a) => a.key === type)) animals.push({ key: type, type, seed: animals.length + 3 });
        const act = ANIM_DUR[b.act] ? b.act : 'enter'; events.push({ kind: 'animal', animal: type, act, target: b.target || null, d: ANIM_DUR[act] });
      } else if (b.type === 'action' && (b.action === 'fire' || b.action === 'fire_out')) {
        if (!stage) continue; events.push({ kind: b.action, target: b.target || null, x: { left: 0.25, center: 0.5, right: 0.75 }[b.where] ?? (b.target ? undefined : 0.72), size: Math.max(0.5, Math.min(2.5, Number(b.size) || 1)), d: b.action === 'fire_out' ? 2 : 0 });
      } else if (b.type === 'action' && ['eid', 'christmas', 'moving_view'].includes(b.action)) {
        if (!stage) continue; events.push({ kind: b.action, vkind: ['train', 'plane', 'bus', 'car'].includes(b.vehicle) ? b.vehicle : 'train', caps: b.caps !== false, d: 0 });
      } else if (b.type === 'action' && ['holi', 'diwali', 'cracker', 'fly_by'].includes(b.action)) {
        if (!stage) continue; const e = { kind: b.action, d: b.action === 'cracker' ? (b.kind === 'bomb' || b.type2 === 'bomb' ? 2.6 : 5) : b.action === 'fly_by' ? 7 : 0 };
        if (b.action === 'cracker') { e.type = (b.cracker || b.kind || 'anaar') === 'bomb' ? 'bomb' : 'anaar'; e.where = b.where; }
        if (b.action === 'diwali') { e.lights = b.lights !== false; e.fireworks = b.fireworks !== false; e.diyas = b.diyas !== false; }
        if (b.action === 'fly_by') e.vehicle = vkey(['plane', 'helicopter'].includes(b.vehicle) ? b.vehicle : 'plane', b.color);
        events.push(e);
      } else if (b.type === 'action' && b.action === 'crowd') {
        if (!stage) continue; const count = Math.max(3, Math.min(14, Number(b.count) || 8)); crowdMax = Math.max(crowdMax, count); events.push({ kind: 'crowd', mood: b.mood || 'watch', count, d: 0 });
      } else if (b.type === 'card') {
        events.push({ kind: 'card', text: b.text, d: 2.6 });
      } else if (b.action in DUR) {
        let act = b.action;
        if (!stage && act in SIMPLE) { act = SIMPLE[act]; if (!act) continue; }
        const trainV = /^train/.test(b.vehicle || '') && (act === 'drive_in' || act === 'drive_away');
        const d = ['car_chase', 'foot_chase', 'game', 'swim', 'beat'].includes(act) ? Math.max(4, Math.min(30, Number(b.seconds) || DUR[act])) : trainV ? (act === 'drive_in' ? 6.5 : 7) : DUR[act];
        const e = { kind: act, char: b.char, target: act === 'walk_to' && !b.target ? null : b.target, rel: true, d };
        if (stage) {
          if (b.place) e.place = b.place; if (b.item) e.item = b.item;
          if (['drive_in', 'drive_away', 'get_in', 'get_out', 'car_chase'].includes(act)) e.vehicle = vkey(b.vehicle, b.color);
          if (act === 'car_chase') e.chaser = vkey(b.chaser_vehicle || 'police_jeep');
          if (act === 'drive_in' && Array.isArray(b.with)) e.with = b.with;
          if (act === 'garba' || act === 'beat') e.with = Array.isArray(b.with) ? b.with : [];
          if (act === 'game') { e.game = ['cricket', 'ball', 'skip', 'kite', 'tag', 'football', 'kabaddi'].includes(b.game) ? b.game : 'ball'; e.with = Array.isArray(b.with) ? b.with : []; }
          if (act === 'explosion') { e.x = { left: 0.25, center: 0.5, right: 0.75 }[b.where]; e.small = !!b.small; }
          if (act === 'baraat') { e.vehicle = vkey('horse', b.color); e.with = Array.isArray(b.with) ? b.with : []; crowdMax = Math.max(crowdMax, 10); }
          if (act === 'car_chase' || act === 'foot_chase') e.chasers = Array.isArray(b.chasers) ? b.chasers : b.target ? [b.target] : [];
        }
        events.push(e);
      } else if (GESTURE.includes(b.action)) {
        events.push({ kind: 'gesture', name: b.action, char: b.char, d: Math.max(1.2, Math.min(12, Number(b.seconds) || LONG[b.action] || 1.6)), overlap: true });
      }
    }
    scenes.push({ index: si, location: sc.location, background: sc.background || '', weather: sc.weather || 'none', time_of_day: sc.time_of_day, summary: sc.summary, initial, cast: all, start, _events: events });
  });
  return { story, style, look, subs, scenes, lines, shots, cues, vehicles, animals, crowdMax, _tStart: t };
}

// sound cues + camera for the new actions
function actionCues(e, t, sc, cues, shots) {
  const T = t + e.d;
  const two = /^(bike|scooter)/.test(e.vehicle || ''), cyc = /^cycle/.test(e.vehicle || ''), hor = /^horse/.test(e.vehicle || '');
  if (e.kind === 'rakhi') { shots.push({ t0: t, t1: t + e.d * 0.38, type: 'wide' }, { t0: t + e.d * 0.38, t1: t + e.d * 0.42, type: 'two', char: e.char }, { t0: t + e.d * 0.42, t1: t + e.d * 0.64, type: 'hands', char: e.target }, { t0: t + e.d * 0.64, t1: T, type: 'two', char: e.char }); cues.push({ t: t + e.d * 0.25, t1: t + e.d * 0.4, kind: 'bell' }); }
  if (e.kind === 'birthday') shots.push({ t0: t, t1: T, type: 'wide' }); // detailed plan once the end is known (see finalize)
  if ((e.kind === 'drive_in' || e.kind === 'drive_away') && /^heli/.test(e.vehicle || '')) { cues.push({ t, t1: T + 1, kind: 'heli' }); return; }
  if (e.kind === 'explosion') { cues.push({ t, kind: 'boom' }); shots.push({ t0: t, t1: T, type: 'wide' }); }
  if (e.kind === 'game') { const kids = [e.char, ...(e.with || [])]; const wideOnly = ['kite', 'football', 'kabaddi', 'tag', 'cricket'].includes(e.game); let i = 0; for (let x = t; x < T - 0.3; x += 2.4, i++) shots.push({ t0: x, t1: Math.min(T, x + 2.4), ...(wideOnly || i % 2 === 0 ? { type: 'wide' } : { type: 'speaker', char: kids[(i >> 1) % kids.length] }) }); }
  if ((e.kind === 'drive_in' || e.kind === 'drive_away') && /^train/.test(e.vehicle || '')) { cues.push({ t, t1: T + 1, kind: 'train', horn: true }); return; }
  if ((e.kind === 'drive_in' || e.kind === 'drive_away') && /^boat/.test(e.vehicle || '')) { cues.push({ t, t1: T, kind: 'paddle' }); return; }
  if (e.kind === 'baraat') { let i = 0; for (let x = t; x < T - 0.3; x += 2.2, i++) shots.push({ t0: x, t1: Math.min(T, x + 2.2), ...[{ type: 'wide' }, { type: 'speaker', char: e.char }, { type: 'wide' }, ...(e.with || []).slice(0, 2).map((c) => ({ type: 'speaker', char: c }))][i % (3 + Math.min(2, (e.with || []).length))] }); }
  if ((e.kind === 'drive_in' || e.kind === 'drive_away') && (cyc || hor)) { cues.push({ t, t1: T, kind: hor ? 'hooves' : 'bell' }); return; }
  if ((e.kind === 'drive_in' || e.kind === 'drive_away') && two) { cues.push({ t, t1: T + (e.kind === 'drive_away' ? 1 : 0), kind: 'engine_small' }); return; }
  if (e.kind === 'drive_in') { cues.push({ t, t1: T, kind: 'engine' }); cues.push({ t: T - 0.5, kind: 'brake' }); if (/police|ambulance/.test(e.vehicle)) cues.push({ t, t1: T, kind: 'siren', amb: /ambulance/.test(e.vehicle) }); }
  if (e.kind === 'drive_away') { cues.push({ t, t1: T + 1, kind: 'engine' }); if (/police|ambulance/.test(e.vehicle)) cues.push({ t, t1: T + 1, kind: 'siren', amb: /ambulance/.test(e.vehicle) }); }
  if (e.kind === 'get_in' || e.kind === 'get_out') { cues.push({ t: t + e.d * (e.kind === 'get_in' ? 0.5 : 0.02), kind: 'car_door' }); cues.push({ t: t + e.d * (e.kind === 'get_in' ? 0.9 : 0.65), kind: 'car_door_close' }); }
  if (e.kind === 'car_chase' || e.kind === 'foot_chase') chaseShots(e, t, T, shots, false);
  if (e.kind === 'catch') { cues.push({ t, t1: t + e.d * 0.55, kind: 'run' }); cues.push({ t: t + e.d * 0.5, kind: 'grab' }); shots.push({ t0: t, t1: t + e.d * 0.5, type: 'wide' }); shots.push({ t0: t + e.d * 0.5, t1: T, type: 'two', char: e.char }); }
  if (e.kind === 'handcuff') { cues.push({ t: t + e.d * 0.5, kind: 'cuff' }); shots.push({ t0: t, t1: t + e.d * 0.3, type: 'two', char: e.char }); shots.push({ t0: t + e.d * 0.3, t1: t + e.d * 0.85, type: 'hands', char: e.target }); shots.push({ t0: t + e.d * 0.85, t1: T, type: 'two', char: e.char }); }
  if (e.kind === 'faint') cues.push({ t: t + 0.6, kind: 'fall' });
  if (e.kind === 'pickpocket') { shots.push({ t0: t, t1: t + e.d * 0.4, type: 'wide' }, { t0: t + e.d * 0.4, t1: t + e.d * 0.78, type: 'hands', char: e.char }, { t0: t + e.d * 0.78, t1: T, type: 'cu', char: e.char }); cues.push({ t: t + e.d * 0.6, kind: 'swish' }); }
  if (e.kind === 'escort') shots.push({ t0: t, t1: T, type: 'two', char: e.char });
  if (e.kind === 'fight') { for (let x = t + e.d * 0.4; x < T - 0.3; x += 0.34) cues.push({ t: x, kind: 'hit' }); shots.push({ t0: t, t1: T, type: 'two', char: e.char }); }
  if (e.kind === 'slap') cues.push({ t: t + e.d * 0.62, kind: 'slap' });
  if (e.kind === 'push') cues.push({ t: t + e.d * 0.55, kind: 'grab' });
  if (e.kind === 'hug' || e.kind === 'give') shots.push({ t0: t + e.d * 0.35, t1: T, type: 'two', char: e.char });
  if (e.kind === 'sleep') cues.push({ t: T, t1: T + 6, kind: 'snore' });
  if (e.kind === 'go_to' && e.place === 'cell') cues.push({ t: T - 0.2, kind: 'clank' });
}
function chaseShots(e, t0, t1, shots, cont) {
  const seq = e.kind === 'car_chase' ? [{ type: 'wide' }, { type: 'drone' }, { type: 'front', vehicle: e.vehicle }, { type: 'wheels', vehicle: e.vehicle }, { type: 'vehicle', vehicle: e.chaser }, { type: 'front', vehicle: e.chaser }, { type: 'drone' }, { type: 'speaker', char: e.char }]
    : [{ type: 'wide' }, { type: 'speaker', char: e.char }, { type: 'wide' }, ...(e.chasers || []).slice(0, 2).map((c) => ({ type: 'speaker', char: c }))];
  if (cont) return; // lines during the chase use their own speaker shots
  let i = 0; for (let x = t0; x < t1 - 0.3; x += 1.8, i++) shots.push({ t0: x, t1: Math.min(t1, x + 1.8), ...seq[i % seq.length] });
}

// who is listening and which shot to use for a line (court: shoot over the judge's shoulder, the judge over the others')
function director(sc, l, n, prev, story) {
  if (l.char === 'narrator') return { type: 'wide' };
  const role = (id) => (story.characters.find((c) => c.id === id)?.role || '').toLowerCase();
  const judge = sc.cast.find((id) => /judge|magistrate|jaj/.test(role(id)));
  let listener = prev && prev !== l.char && sc.cast.includes(prev) ? prev : sc.cast.find((id) => id !== l.char) || null;
  if (judge && l.char !== judge) listener = judge;
  if (n === 0) return { type: 'two', listener };
  const pat = ['ots', 'cu', 'ots', 'two', 'cu', 'ots'][n % 6];
  return { type: listener || pat === 'cu' ? pat : 'speaker', listener, react: pat === 'cu' && !!listener && n % 4 === 1 };
}

// Second pass once every line has a duration: lay out the real times.
export function finalize(tl) {
  tl.cards = [];
  let t = TITLE; const shots = []; const cues = [];
  for (const sc of tl.scenes) {
    sc.start = t; cues.push({ t, kind: 'scene', location: sc.location });
    const est = sc.index === 0 ? 1.8 : 1.4; shots.push({ t0: t, t1: t + est, type: 'wide' }); t += est;
    sc.events = []; const busy = {}; let lineN = 0, prevSpeaker = null; // a character finishes one gesture before the next action / gesture
    for (const e of sc._events) {
      if (e.kind === 'line') {
        const l = e.ref; l.start = t; l.end = t + l.duration; t = l.end + 0.32;
        // director: establishing two-shot, then over-the-shoulder / close-up / stage two-shot; reaction shots on long lines
        const dir = director(sc, l, lineN++, prevSpeaker, tl.story);
        if (dir.react && l.duration > 3.6) { const cut = l.start + l.duration * 0.62; shots.push({ t0: l.start - 0.15, t1: cut, type: dir.type, char: l.char, listener: dir.listener }); shots.push({ t0: cut, t1: t, type: 'react', char: dir.listener, listener: l.char }); }
        else shots.push({ t0: l.start - 0.15, t1: t, type: dir.type, char: l.char, listener: dir.listener });
        if (l.char !== 'narrator') prevSpeaker = l.char;
      } else if (['eid', 'christmas', 'moving_view'].includes(e.kind)) {
        const { d, ...rest } = e; sc.events.push({ ...rest, t0: t, t1: t + 0.1 }); cues.push({ t, t1: null, kind: e.kind === 'christmas' ? 'jingle' : e.kind === 'eid' ? 'eidcheer' : 'ride', vkind: e.vkind, scene: sc.index });
      } else if (['holi', 'diwali', 'cracker', 'fly_by'].includes(e.kind)) {
        const { d, ...rest } = e; sc.events.push({ ...rest, t0: t, t1: t + (e.d || 0.1) });
        if (e.kind === 'holi' || e.kind === 'diwali') cues.push({ t, t1: null, kind: e.kind, scene: sc.index });
        if (e.kind === 'cracker') cues.push(e.type === 'bomb' ? { t: t + 1, kind: 'bang' } : { t, t1: t + e.d, kind: 'anaar' });
        if (e.kind === 'fly_by') cues.push({ t, t1: t + e.d, kind: /^heli/.test(e.vehicle) ? 'heli' : 'jet' });
      } else if (e.kind === 'fire' || e.kind === 'fire_out') {
        const { d, ...rest } = e; sc.events.push({ ...rest, t0: t, t1: t + (e.d || 0.1) }); if (e.kind === 'fire') cues.push({ t, t1: null, kind: 'fire', scene: sc.index }); else cues.push({ t, kind: 'fire_out', scene: sc.index });
      } else if (e.kind === 'animal' || e.kind === 'crowd') {
        const bk = 'animal:' + (e.animal || 'crowd'); const g0 = Math.max(t, busy[bk] || 0); const { d, ...rest } = e; sc.events.push({ ...rest, t0: g0, t1: g0 + e.d }); busy[bk] = g0 + e.d;
        if (e.kind === 'animal') { if (e.act === 'bark') { cues.push({ t: g0 + 0.15, kind: 'bark' }); cues.push({ t: g0 + 0.85, kind: 'bark' }); } if (e.act === 'moo') cues.push({ t: g0 + 0.2, kind: 'moo' }); if (e.act === 'neigh') cues.push({ t: g0 + 0.2, kind: 'neigh' });
          if (e.animal === 'horse' && ['enter', 'exit', 'run', 'follow'].includes(e.act)) cues.push({ t: g0, t1: g0 + e.d, kind: 'hooves', run: e.act === 'run' }); if (e.animal === 'dog' && e.act === 'run') cues.push({ t: g0 + 0.3, kind: 'bark' }); if (['bleat', 'meow', 'trumpet', 'roar', 'chatter'].includes(e.act)) cues.push({ t: g0 + 0.2, kind: e.act }); if (e.animal === 'monkey' && e.act === 'jump') cues.push({ t: g0 + 0.2, kind: 'chatter' }); if (e.act === 'fly') cues.push({ t: g0, t1: g0 + e.d, kind: 'chirps' }); }
        t = Math.max(t, g0) + (e.kind === 'crowd' ? 0 : 0.25);
      } else if (e.kind === 'card') {
        (tl.cards ||= []).push({ text: e.text, t0: t, t1: t + e.d }); shots.push({ t0: t, t1: t + e.d, type: 'wide' }); t += e.d;
      } else if (e.kind === 'gesture') {
        const g0 = Math.max(t, busy[e.char] || 0); sc.events.push({ kind: 'gesture', name: e.name, char: e.char, t0: g0, t1: g0 + e.d }); busy[e.char] = g0 + e.d; t = Math.max(t + 0.25, g0 + 0.25);
      } else {
        t = Math.max(t, busy[e.char] || 0, e.target ? busy[e.target] || 0 : 0);
        const { rel, d, ...rest } = e; sc.events.push({ ...rest, target: e.target || null, t0: t, t1: t + e.d });
        actionCues(e, t, sc, cues, shots);
        if (e.kind === 'enter' || e.kind === 'exit' || e.kind === 'run_exit') cues.push({ t: e.kind === 'enter' ? t : t + e.d - 0.4, kind: 'door', location: sc.location });
        if (['enter', 'exit', 'run_exit', 'walk_to', 'sit', 'stand', 'go_to'].includes(e.kind)) cues.push({ t, t1: t + e.d, kind: e.kind === 'run_exit' ? 'run' : e.kind === 'sit' ? 'sit' : e.kind === 'stand' ? 'stand' : 'walk' });
        if (!['car_chase', 'foot_chase', 'handcuff', 'catch', 'baraat', 'explosion', 'game', 'birthday', 'rakhi', 'garba', 'pickpocket', 'beat', 'escort', 'hold_hands', 'let_go'].includes(e.kind)) shots.push({ t0: t, t1: t + e.d, type: 'wide' }); t += e.d;
      }
    }
    t = Math.max(t, ...Object.values(busy)); t += 0.9; sc.end = t; shots.push({ t0: t - 0.9, t1: t, type: 'wide' });
    for (const c of cues) if (['holi', 'diwali', 'jingle', 'eidcheer', 'ride'].includes(c.kind) && c.scene === sc.index && c.t1 == null) c.t1 = sc.end;
    for (const c of cues) if (c.kind === 'fire' && c.scene === sc.index && c.t1 == null) { const out = cues.find((x) => x.kind === 'fire_out' && x.scene === sc.index && x.t > c.t); c.t1 = out ? out.t + 2 : sc.end; }
    for (const e of sc.events) if (e.kind === 'garba') { const nx = sc.events.find((x) => x.t0 >= e.t1 - 0.01 && x !== e && !['gesture', 'animal', 'crowd', 'fire', 'fire_out', 'holi', 'diwali', 'cracker', 'fly_by', 'eid', 'christmas', 'moving_view'].includes(x.kind)); const until = Math.max(e.t1, nx ? nx.t0 : sc.end - 0.4); cues.push({ t: e.t0, t1: until, kind: 'garba' }); shots.push({ t0: e.t0, t1: until, type: 'wide' }); }
    for (const e of sc.events) if (e.kind === 'birthday') { const nx = sc.events.find((x) => x.t0 >= e.t1 - 0.01 && x !== e && !['gesture', 'animal', 'crowd', 'fire', 'fire_out', 'holi', 'diwali', 'cracker', 'fly_by'].includes(x.kind)); const until = Math.max(e.t1, nx ? nx.t0 : sc.end - 0.4); cues.push({ t: e.t0, t1: until, kind: 'bday' }); const D = until - e.t0; const at = (q) => e.t0 + D * q;
      shots.push({ t0: at(0), t1: at(0.2), type: 'wide' }, { t0: at(0.2), t1: at(0.32), type: 'cu', char: e.char }, { t0: at(0.32), t1: at(0.42), type: 'wide' }, { t0: at(0.42), t1: at(0.55), type: 'cu', char: e.char }, { t0: at(0.55), t1: at(0.76), type: 'cake' }, { t0: at(0.76), t1: at(0.92), type: 'two', char: e.char }, { t0: at(0.92), t1: until, type: 'wide' }); }
    for (const e of sc.events) if (e.kind === 'game' || e.kind === 'swim') { const nx = sc.events.find((x) => x.t0 >= e.t1 - 0.01 && x !== e && !['gesture', 'animal', 'crowd', 'fire', 'fire_out'].includes(x.kind)); const until = Math.max(e.t1, nx ? nx.t0 : sc.end - 0.4);
      if (e.kind === 'swim') cues.push({ t: e.t0, t1: until, kind: 'swim' });
      else { if (e.game === 'cricket') for (let x = e.t0 + 3.2 * 0.6; x < until; x += 3.2) cues.push({ t: x, kind: 'bat' }); if (e.game === 'football') for (let x = e.t0 + 0.3; x < until; x += 2.4) cues.push({ t: x, kind: 'kick' }); cues.push({ t: e.t0, t1: until, kind: 'kids', game: e.game });
      } }
    for (const e of sc.events) if (e.kind === 'beat') { const nx = sc.events.find((x) => x.t0 >= e.t1 - 0.01 && x !== e && !['gesture', 'animal', 'crowd', 'fire', 'fire_out', 'moving_view'].includes(x.kind)); const until = Math.max(e.t1, nx ? nx.t0 : sc.end - 0.4);
      let k = 0; for (let x = e.t0 + 1.0; x < until - 0.2; x += 0.27 + ((k = (k * 7 + 3) % 11) % 4) * 0.06) cues.push({ t: x, kind: k % 3 ? 'hit' : 'slap' }); cues.push({ t: e.t0 + 0.8, t1: until, kind: 'cheer', angry: true });
      for (let j = shots.length - 1; j >= 0; j--) if (shots[j].t0 >= e.t0 - 0.2 && shots[j].t0 < until) shots.splice(j, 1); // the beating owns the camera (lines spoken during it too)
      const ws = [e.char, ...(e.with || [])]; let i = 0; for (let x = e.t0; x < until - 0.3; x += 1.6, i++) shots.push({ t0: x, t1: Math.min(until, x + 1.6), ...[{ type: 'wide' }, { type: 'two', char: ws[1] || e.char }, { type: 'cu', char: e.char }, { type: 'wide' }, { type: 'two', char: ws[2] || ws[1] || e.char }, { type: 'speaker', char: e.char }][i % 6] }); }
    for (const e of sc.events) if (e.kind === 'baraat') { const nx = sc.events.find((x) => x.t0 >= e.t1 - 0.01 && x !== e && !['gesture', 'animal', 'crowd'].includes(x.kind)); const until = Math.max(e.t1, nx ? nx.t0 : sc.end - 0.4); cues.push({ t: e.t0, t1: until + 0.5, kind: 'baraat' }); cues.push({ t: e.t0, t1: until, kind: 'hooves' }); }
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
    if (['vehicle', 'hands', 'drone', 'front', 'wheels', 'cake', 'react'].includes(s.type)) { const prev = clean[clean.length - 1]; if (prev && s.t0 < prev.t1) prev.t1 = Math.max(prev.t0 + 0.01, s.t0); clean.push({ ...s }); continue; }
    const prev = clean[clean.length - 1];
    if (prev && s.t0 < prev.t1) prev.t1 = Math.max(prev.t0 + 0.01, s.t0);
    if (prev && prev.type === s.type && prev.char === s.char && s.t0 - prev.t1 < 0.05) { prev.t1 = s.t1; continue; }
    clean.push({ ...s });
  }
  for (let i = 1; i < clean.length; i++) if (clean[i].t1 - clean[i].t0 < 1.0 && !['wide', 'vehicle', 'hands', 'drone', 'front', 'wheels', 'react', 'cake'].includes(clean[i].type)) clean[i].type = clean[i - 1].type, clean[i].char = clean[i - 1].char;
  tl.shots = clean.filter((s) => s.t1 > s.t0);
  for (const l of tl.lines) { delete l._beat; delete l._pending; delete l._shot; }
  return tl;
}
