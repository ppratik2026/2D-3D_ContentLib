// Shared settings: categories, styles, looks, subtitle styles, voices, locations and actions.
// Everything here is free and runs on the CPU.

export const FPS = 30;
export const WIDTH = 1280;
export const HEIGHT = 720;

// Category → mood (music), default look, default subtitle style, story guidance for Gemini.
export const CATEGORIES = {
  romance:      { label: 'Romance / Love',      mood: 'romance',      look: 'dreamy',  subs: 'classic',   hint: 'a warm, sweet love story with gentle humour' },
  drama:        { label: 'Family Drama',        mood: 'drama',        look: 'film',    subs: 'classic',   hint: 'an emotional family or friendship drama with a clear conflict and resolution' },
  comedy:       { label: 'Comedy',              mood: 'comedy',       look: 'vivid',   subs: 'youtube',   hint: 'a light, funny situation comedy with misunderstandings and punchlines' },
  crime:        { label: 'Crime / Detective',   mood: 'crime',        look: 'noir',    subs: 'cinematic', hint: 'a crime mystery: an incident, clues, an investigation and a reveal' },
  horror:       { label: 'Horror',              mood: 'horror',       look: 'horror',  subs: 'cinematic', hint: 'a spooky story built on suspense, strange sounds and a twist, not gore' },
  thriller:     { label: 'Thriller / Suspense', mood: 'thriller',     look: 'noir',    subs: 'cinematic', hint: 'a tense thriller with a secret, a chase or a deadline and a twist' },
  kids:         { label: 'Kids / Moral Story',  mood: 'kids',         look: 'vivid',   subs: 'youtube',   hint: 'a simple children\'s story with a clear moral at the end' },
  motivational: { label: 'Motivational',        mood: 'motivational', look: 'film',    subs: 'youtube',   hint: 'an inspiring story of struggle, effort and success with a strong message' },
  mystery:      { label: 'Mystery',             mood: 'crime',        look: 'film',    subs: 'cinematic', hint: 'a puzzling mystery where the characters discover a hidden truth' },
};

// Visual styles. `secPerFrame` = measured render time per frame on a 4-core CPU with no GPU (software WebGL).
// `npm run bench` re-measures these on your PC and stores them in bench.json.
export const STYLES = {
  cartoon2d: { label: '2D Cartoon Stage (painted backgrounds)', chars: 'any', world: 'stage', secPerFrame: 0.12 },
  flat2d:    { label: 'Flat 2D Explainer (big heads, flat vector)', chars: 'any', world: 'stage', secPerFrame: 0.08 },
  toon:      { label: 'Toon 3D (fastest)',          chars: 'vrm', world: 'toon',      secPerFrame: 0.40 },
  anime:     { label: 'Anime 3D',                   chars: 'vrm', world: 'anime',     secPerFrame: 0.60 },
  realistic: { label: 'Realistic 3D',               chars: 'glb', world: 'realistic', secPerFrame: 0.53 },
};

// Type 8 "looks" (applied as CSS filters + overlays, almost free to render).
export const LOOKS = {
  none:    { label: 'Normal' },
  film:    { label: 'Cinematic film (grain + bars)' },
  oldfilm: { label: 'Old film (sepia, flicker, scratches)' },
  noir:    { label: 'Noir (black & white)' },
  dreamy:  { label: 'Dreamy (soft glow)' },
  horror:  { label: 'Horror (cold, dark, grain)' },
  vivid:   { label: 'Vivid (bright colours)' },
};

export const SUBTITLE_STYLES = {
  classic:   { label: 'Classic (white text, dark box)' },
  youtube:   { label: 'YouTube bold (yellow/white, outline)' },
  karaoke:   { label: 'Karaoke (word-by-word highlight)' },
  cinematic: { label: 'Cinematic (small, elegant)' },
  dual:      { label: 'Dual (Hinglish + English)' },
  hindi:     { label: 'Hindi (Devanagari)' },
  kids:      { label: 'Kids (handwritten, colourful)' },
  none:      { label: 'No subtitles' },
};

// Free offline Piper voices (Hindi). Downloaded by `npm run setup`.
export const VOICES = {
  male:   ['hi_IN-pratham-medium', 'hi_IN-rohan-medium'],
  female: ['hi_IN-priyamvada-medium'],
};
// pitch/speed variation so several characters with the same base voice still sound different
export const VOICE_VARIANTS = [{ speed: 1.0, pitch: 1.0 }, { speed: 0.92, pitch: 0.94 }, { speed: 1.07, pitch: 1.06 }, { speed: 0.97, pitch: 1.1 }];

// Locations the 3D engine can build. Gemini must pick from these.
export const LOCATIONS = {
  street:  'city street at the front of a small café/shop, road and footpath',
  cafe:    'inside a cosy café: round table with two chairs, counter',
  home:    'living room of a house: sofa, TV, rug, window, lamp',
  office:  'office: desks with computers, chairs, whiteboard',
  park:    'public park: grass, trees, a bench, a path, lamp posts',
  police:  'police station room: desk, chairs, evidence board, cabinets',
  alley:   'narrow back alley: brick walls, one street lamp, bins (good for night / horror / crime)',
  forest:  'forest clearing with trees and a path (good for horror / kids / adventure)',
  classroom: 'school classroom: desks, blackboard, teacher table',
};

// Actions the engine can animate. Gemini must use only these.
export const ACTIONS = ['hold_hands', 'let_go', 'escort', 'pickpocket', 'beat', 'sip', 'hold_cup', 'cower', 'put_down', 'enter', 'exit', 'walk_to', 'sit', 'stand', 'wave', 'nod', 'laugh', 'point', 'think', 'shock', 'drink', 'phone', 'run_exit', 'look_around',
  'go_to', 'faint', 'lie', 'drive_in', 'drive_away', 'get_in', 'get_out', 'car_chase', 'foot_chase', 'catch', 'handcuff',
  'hands_up', 'salute', 'namaste', 'cry', 'examine', 'test_tube', 'torch', 'read', 'file', 'write', 'gavel', 'clap', 'angry',
  'cook', 'chop', 'eat', 'serve', 'sweep', 'aarti', 'pray', 'dance', 'knock', 'shiver', 'type', 'sleep', 'hug', 'fight', 'push', 'slap', 'give', 'animal', 'crowd', 'baraat', 'fire', 'fire_out', 'explosion', 'game', 'swim', 'climb', 'climb_down', 'umbrella', 'holi', 'diwali', 'cracker', 'fly_by', 'birthday', 'pichkari', 'sparkler', 'diya', 'gulal', 'garba', 'rakhi', 'eid', 'christmas', 'moving_view', 'salaam'];
export const VEHICLES = ['car', 'taxi', 'police_jeep', 'ambulance', 'auto', 'van', 'bike', 'scooter', 'cycle', 'horse', 'boat', 'train', 'helicopter', 'plane'];
export const MARKS = { door: 'a door people walk in / out of (go_to door, then exit = goes inside)', seat: 'chair / sofa / charpai / bench to sit on', desk: 'sits behind a table (inspector, doctor, officer, teacher)', judge: "judge's high bench (court)", witness: 'witness box / kathghara (court)', counter: 'stands behind a counter / lab table / shop counter', bed: 'bed (patient lies down)', cell: 'jail cell behind bars', board: 'blackboard (teacher stands)', climb: 'top of a tree / wall / roof to climb to', window: 'window of a train / plane / bus (moving view outside)' };

export const TIMES_OF_DAY = ['morning', 'day', 'evening', 'night'];
