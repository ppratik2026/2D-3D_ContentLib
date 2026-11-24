// ================= v4.17: 🧸 Cartoon 2D — asli chalte-firte cartoon characters (Canvas par, koi GPU / Flow credit nahi) =================
// Picture ki jagah har scene mein: background (Flow ki cartoon-style KHAALI jagah, ya built-in drawn background)
// + visual bible ke characters jo code se bante hain: chalna, daudna, haath hilana, koodna, naachna, baithna, sochna, rona, hansna,
// aur jo bol raha hai uska muh uski awaaz ke saath hilta hai (lip-sync). Awaaz, subtitles, music — sab pehle jaisa.
// Character ka look: desh / umar / ladka-ladki / rang / baal / kapde — visual bible se apne aap, Cast box mein badal sakte hain, series mein lock.
// Default OFF. Video tab → 🧸 Cartoon 2D.

const tcz = (id) => document.getElementById(id);
const TC_DEF = { tcMode: 'off', tcStyle: 'hd', tcBg: 'flow', tcRegion: 'indian', tcSize: 'm', tcGround: '88', tcCam: 'gentle', tcAuto: 'on' };
let TCS = { ...TC_DEF };
const TC_INK = '#1e1828';

// ---------- desh / ilaaka: sirf default rang + kapde (aankh-chehra sabka ek jaisa cartoon style) ----------
const TC_REGIONS = {
  indian: { label: '🇮🇳 Indian', skin: ['#c68642', '#d39b62', '#b97a4a', '#e0ac69', '#9c6436'], hair: ['#1b1410', '#24170f', '#2e1d12'],
    m: { adult: ['kurta', 'shirt'], old: ['kurta', 'dhoti'], child: ['shirt', 'shorts'], teen: ['tshirt', 'shirt'], toddler: ['shorts'] },
    f: { adult: ['saree', 'salwar'], old: ['saree'], child: ['frock', 'salwar'], teen: ['salwar', 'kurta'], toddler: ['frock'] },
    tops: ['#e65100', '#c2185b', '#1565c0', '#2e7d32', '#f9a825', '#6a1b9a', '#00838f', '#d84315'], bottoms: ['#fafafa', '#37474f', '#5d4037', '#283593', '#f5f0e1'] },
  korean: { label: '🇰🇷 Korean', skin: ['#f3d2b3', '#eec6a2', '#f6dcc2'], hair: ['#151313', '#2a1f1a', '#3a2a20'],
    m: { adult: ['shirt', 'sweater', 'suit'], old: ['sweater', 'coat'], child: ['tshirt', 'hoodie'], teen: ['uniform', 'hoodie'], toddler: ['shorts'] },
    f: { adult: ['dress', 'sweater'], old: ['coat', 'sweater'], child: ['frock', 'tshirt'], teen: ['uniform_girl', 'skirt'], toddler: ['frock'] },
    tops: ['#90caf9', '#f8bbd0', '#ffffff', '#b39ddb', '#80cbc4', '#ffe082', '#37474f'], bottoms: ['#263238', '#455a64', '#e0e0e0', '#1a237e'] },
  japanese: { label: '🇯🇵 Japanese', skin: ['#f3d2b3', '#f1cdae', '#f7dfc8'], hair: ['#141212', '#2b201b'],
    m: { adult: ['suit', 'shirt'], old: ['sweater', 'kimono'], child: ['tshirt', 'shorts'], teen: ['uniform'], toddler: ['shorts'] },
    f: { adult: ['dress', 'sweater'], old: ['kimono', 'coat'], child: ['frock'], teen: ['uniform_girl'], toddler: ['frock'] },
    tops: ['#ef9a9a', '#ffffff', '#9fa8da', '#a5d6a7', '#ffcc80', '#424242'], bottoms: ['#212121', '#3949ab', '#795548'] },
  chinese: { label: '🇨🇳 Chinese', skin: ['#f0cfae', '#eac39f', '#f5d7bb'], hair: ['#121010', '#241a15'],
    m: { adult: ['shirt', 'sweater'], old: ['coat'], child: ['tshirt'], teen: ['tshirt', 'uniform'], toddler: ['shorts'] },
    f: { adult: ['dress', 'sweater'], old: ['coat'], child: ['frock'], teen: ['skirt'], toddler: ['frock'] },
    tops: ['#e53935', '#ffd54f', '#4fc3f7', '#81c784', '#ffffff', '#5e35b1'], bottoms: ['#263238', '#3e2723', '#1565c0'] },
  sea: { label: '🌏 South-East Asian', skin: ['#d9a877', '#c99566', '#e3b88c'], hair: ['#141010', '#251a12'],
    m: { adult: ['shirt', 'tshirt'], old: ['shirt'], child: ['tshirt', 'shorts'], teen: ['tshirt'], toddler: ['shorts'] },
    f: { adult: ['dress', 'skirt'], old: ['dress'], child: ['frock'], teen: ['skirt'], toddler: ['frock'] },
    tops: ['#26a69a', '#ffca28', '#ef5350', '#7e57c2', '#ffffff'], bottoms: ['#37474f', '#5d4037', '#1e88e5'] },
  russian: { label: '🇷🇺 Russian / East European', skin: ['#f7dccb', '#f2cfb8', '#fbe5d6'], hair: ['#6d4c33', '#c8a165', '#3b2a1e', '#e0c08a', '#8d5a3b'],
    m: { adult: ['sweater', 'coat'], old: ['coat', 'sweater'], child: ['hoodie', 'sweater'], teen: ['hoodie'], toddler: ['sweater'] },
    f: { adult: ['dress', 'coat'], old: ['coat', 'dress'], child: ['frock', 'sweater'], teen: ['skirt', 'hoodie'], toddler: ['frock'] },
    tops: ['#c62828', '#1565c0', '#5d4037', '#2e7d32', '#eceff1', '#6a1b9a'], bottoms: ['#263238', '#424242', '#3e2723'] },
  european: { label: '🇪🇺 European', skin: ['#f7dccb', '#f0c9ae', '#e8bc9a', '#fbe5d6'], hair: ['#5b3a26', '#c8a165', '#2b1d14', '#a0522d', '#e0c08a'],
    m: { adult: ['shirt', 'sweater', 'suit'], old: ['coat', 'sweater'], child: ['tshirt', 'shorts'], teen: ['hoodie', 'tshirt'], toddler: ['shorts'] },
    f: { adult: ['dress', 'sweater'], old: ['coat', 'dress'], child: ['frock'], teen: ['skirt', 'tshirt'], toddler: ['frock'] },
    tops: ['#1e88e5', '#ef5350', '#66bb6a', '#ffffff', '#ffb300', '#8e24aa'], bottoms: ['#1a237e', '#37474f', '#6d4c41'] },
  american: { label: '🇺🇸 American', skin: ['#f6d5c0', '#e8b896', '#c68642', '#8d5524', '#d9a877', '#6b3e26'], hair: ['#5b3a26', '#d8b26e', '#1b1410', '#a0522d', '#2b1d14'],
    m: { adult: ['shirt', 'tshirt', 'hoodie'], old: ['sweater', 'shirt'], child: ['tshirt', 'shorts'], teen: ['hoodie', 'tshirt'], toddler: ['shorts'] },
    f: { adult: ['tshirt', 'dress'], old: ['sweater', 'dress'], child: ['tshirt', 'frock'], teen: ['hoodie', 'skirt'], toddler: ['frock'] },
    tops: ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#ffffff', '#8e24aa', '#fb8c00'], bottoms: ['#1565c0', '#263238', '#5d4037', '#90a4ae'] },
  african: { label: '🌍 African', skin: ['#8d5524', '#6b3e26', '#5a3825', '#7a4a2c'], hair: ['#0f0b09', '#1b1410'],
    m: { adult: ['shirt', 'tshirt'], old: ['robe', 'shirt'], child: ['tshirt', 'shorts'], teen: ['tshirt'], toddler: ['shorts'] },
    f: { adult: ['dress'], old: ['dress'], child: ['frock'], teen: ['dress', 'skirt'], toddler: ['frock'] },
    tops: ['#ff8f00', '#43a047', '#e53935', '#fdd835', '#1e88e5', '#8e24aa'], bottoms: ['#3e2723', '#263238', '#f5f5f5'] },
  middle_eastern: { label: '🕌 Middle Eastern', skin: ['#d8a878', '#c99a6d', '#e3b98f'], hair: ['#151010', '#2b1d14'],
    m: { adult: ['robe', 'shirt'], old: ['robe'], child: ['tshirt', 'robe'], teen: ['shirt'], toddler: ['shorts'] },
    f: { adult: ['robe', 'dress'], old: ['robe'], child: ['frock'], teen: ['dress'], toddler: ['frock'] },
    tops: ['#fafafa', '#37474f', '#795548', '#5c6bc0', '#26a69a'], bottoms: ['#fafafa', '#263238', '#6d4c41'] },
  latin: { label: '🌎 Latin American', skin: ['#d9a877', '#c68642', '#e8b896', '#a8714a'], hair: ['#1b1410', '#3b2a1e', '#5b3a26'],
    m: { adult: ['shirt', 'tshirt'], old: ['shirt', 'sweater'], child: ['tshirt', 'shorts'], teen: ['tshirt'], toddler: ['shorts'] },
    f: { adult: ['dress', 'tshirt'], old: ['dress'], child: ['frock'], teen: ['skirt'], toddler: ['frock'] },
    tops: ['#fb8c00', '#e53935', '#43a047', '#ffffff', '#1e88e5', '#ec407a'], bottoms: ['#1565c0', '#3e2723', '#263238'] },
};
TC_REGIONS.mixed = { label: '🎲 Mixed', skin: [...new Set(Object.values(TC_REGIONS).flatMap((r) => r.skin))], hair: ['#1b1410', '#5b3a26', '#c8a165', '#2b1d14', '#a0522d'],
  m: TC_REGIONS.american.m, f: TC_REGIONS.american.f, tops: TC_REGIONS.american.tops, bottoms: TC_REGIONS.american.bottoms };
const TC_REGION_WORDS = [
  ['indian', /\b(indian|desi|hindu|sikh|punjabi|gujarati|bengali|tamil|telugu|marathi|kannada|malayali|rajasthani|bihari|south asian|bharat\w*)\b|भारत|ભારત/i],
  ['korean', /\bkorean\b/i], ['japanese', /\bjapanese\b/i], ['chinese', /\b(chinese|han)\b/i],
  ['sea', /\b(vietnamese|thai|filipino|filipina|indonesian|malay(sian)?|burmese|cambodian|south[- ]east asian)\b/i],
  ['russian', /\b(russian|ukrainian|belarus\w*|polish|slavic|east(ern)? european)\b/i],
  ['middle_eastern', /\b(arab|arabian|middle[- ]eastern|persian|iranian|turkish|egyptian|emirati|saudi)\b/i],
  ['african', /\b(african|nigerian|kenyan|ghanaian|ethiopian|black (man|woman|boy|girl|skin))\b/i],
  ['latin', /\b(latino|latina|hispanic|mexican|brazilian|colombian|peruvian|argentin\w*)\b/i],
  ['american', /\b(american|canadian|texan|new yorker)\b/i],
  ['european', /\b(european|british|english|french|german|italian|spanish|irish|scottish|dutch|swedish|norwegian|greek)\b/i],
];
const TC_OUTFITS = {
  shirt: { lab: 'Shirt + pants', len: 'hip', legs: 'pants', d: ['collar', 'buttons'] },
  tshirt: { lab: 'T-shirt + jeans', len: 'hip', legs: 'pants' },
  shorts: { lab: 'T-shirt + shorts', len: 'hip', legs: 'shorts' },
  hoodie: { lab: 'Hoodie', len: 'hip', legs: 'pants', d: ['hood', 'pocket'] },
  sweater: { lab: 'Sweater', len: 'hip', legs: 'pants', d: ['ribs'] },
  coat: { lab: 'Long coat', len: 'knee', legs: 'pants', d: ['buttons', 'collar'] },
  suit: { lab: 'Suit + tie', len: 'hip', legs: 'pants', d: ['lapels', 'tie'] },
  uniform: { lab: 'School uniform (pants)', len: 'hip', legs: 'pants', d: ['collar', 'tie'], shirt: '#ffffff' },
  uniform_girl: { lab: 'School uniform (skirt)', len: 'hip', skirt: 'knee', legs: 'bare', d: ['collar', 'tie'], shirt: '#ffffff' },
  kurta: { lab: 'Kurta pajama', len: 'thigh', legs: 'pants', d: ['placket'] },
  sherwani: { lab: 'Sherwani', len: 'knee', legs: 'pants', d: ['buttons', 'band'] },
  dhoti: { lab: 'Kurta + dhoti', len: 'thigh', legs: 'baggy', d: ['placket'] },
  saree: { lab: 'Saree', len: 'hip', skirt: 'ankle', d: ['pallu'] },
  salwar: { lab: 'Salwar kameez', len: 'knee', legs: 'pants', d: ['dupatta'] },
  lehenga: { lab: 'Lehenga', len: 'hip', skirt: 'wide', d: ['dupatta'] },
  frock: { lab: 'Frock', len: 'hip', skirt: 'frock', legs: 'bare' },
  dress: { lab: 'Dress', len: 'hip', skirt: 'knee', legs: 'bare' },
  skirt: { lab: 'Top + skirt', len: 'hip', skirt: 'knee', legs: 'bare', d: ['band'] },
  hanbok: { lab: 'Hanbok', len: 'chest', skirt: 'bell', d: ['bow'] },
  kimono: { lab: 'Kimono', len: 'ankle', d: ['obi', 'cross'] },
  robe: { lab: 'Long robe (thobe / abaya)', len: 'ankle', d: [] },
};
const TC_HAIR = { short: 'Short', turban: 'Pagdi / turban', side: 'Side part', spiky: 'Spiky', curly: 'Curly', afro: 'Afro', long: 'Long', ponytail: 'Ponytail', pigtails: 'Two pigtails', braid: 'Braid', bun: 'Bun', bob: 'Bob cut', bald: 'Bald', hijab: 'Hijab', turban: 'Turban', cap: 'Cap' };
const TC_EXTRAS = { glasses: '👓 Glasses', beard: '🧔 Beard', moustache: 'Moustache', headband: 'Headband', bindi: 'Bindi', earrings: 'Earrings', scarf: 'Scarf', stick: 'Walking stick', bag: 'School bag' };
const TC_AGES = { toddler: '🍼 Toddler (2-5)', child: '🧒 Child (6-10)', teen: '🧑 Teen (11-17)', adult: '🧑‍🦱 Adult', old: '🧓 Old' };
// lambai / naap (unit = adult ~260 lamba)
const TC_BODY = {
  toddler: { hip: 40, sh: 86, head: 122, hr: 33, tw: 21, lw: 9, aw: 8, arm: 38, h: 158 },
  child: { hip: 64, sh: 122, head: 158, hr: 32, tw: 24, lw: 10, aw: 9, arm: 52, h: 192 },
  teen: { hip: 88, sh: 162, head: 197, hr: 31, tw: 27, lw: 11, aw: 10, arm: 68, h: 230 },
  adult: { hip: 98, sh: 178, head: 213, hr: 31, tw: 30, lw: 12, aw: 11, arm: 74, h: 246 },
  old: { hip: 92, sh: 168, head: 202, hr: 31, tw: 30, lw: 12, aw: 11, arm: 70, h: 234, hunch: 7 },
};

// ---------- chhote helpers ----------
const tcHash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const tcPick = (arr, seed) => arr[seed % arr.length];
const tcClamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const tcEase = (p) => { p = tcClamp(p); return p * p * (3 - 2 * p); };
function tcShade(hex, f) { const h = String(hex).replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; const m = (v) => Math.max(0, Math.min(255, Math.round(f >= 1 ? v + (255 - v) * (f - 1) : v * f))); return `rgb(${m(r)},${m(g)},${m(b)})`; }
const TC_COLORS = { red: '#d32f2f', maroon: '#7b1f2a', crimson: '#b71c1c', pink: '#ec407a', rose: '#e57399', orange: '#ef6c00', saffron: '#f57c00', yellow: '#fbc02d', golden: '#d4a017', gold: '#d4a017', mustard: '#c9a227', green: '#2e7d32', 'dark green': '#1b5e20', olive: '#6b7a2a', mint: '#80cbc4', teal: '#00897b', blue: '#1e88e5', 'sky blue': '#64b5f6', 'light blue': '#90caf9', navy: '#1a237e', 'dark blue': '#1a237e', indigo: '#3949ab', purple: '#7b1fa2', violet: '#8e24aa', lavender: '#b39ddb', brown: '#6d4c41', beige: '#d7c4a3', cream: '#f5ecd7', khaki: '#bfae7a', white: '#fafafa', 'off-white': '#f1ede4', black: '#263238', grey: '#78909c', gray: '#78909c', silver: '#b0bec5', peach: '#ffccbc', turquoise: '#26c6da', magenta: '#c2185b' };
const TC_COLOR_RE = new RegExp(`\\b(${Object.keys(TC_COLORS).sort((a, b) => b.length - a.length).join('|')})\\b`, 'i');
function tcColorNear(text, words) { // "red saree" → #d32f2f
  const t = String(text || '').toLowerCase();
  const names = Object.keys(TC_COLORS).sort((a, b) => b.length - a.length).join('|');
  for (const w of words) { const i = t.search(new RegExp(`\\b${w}`)); if (i < 0) continue; const before = t.slice(Math.max(0, i - 40), i).split(/[,;.]| and | with /).pop(), all = [...before.matchAll(new RegExp(`\\b(${names})\\b`, 'g'))]; if (all.length) return TC_COLORS[all[all.length - 1][1]]; } // shabd ke sabse paas wala rang
  return null;
}

// ---------- visual bible → character ka look (koi Gemini request nahi) ----------
function tcAnimalOf(c) { const t = `${c.look || ''} ${c.name || ''}`.toLowerCase(); const m = t.match(/\b(buffalo|bull|ox|dog|puppy|cat|kitten|rabbit|bunny|lion|tiger|elephant|monkey|crow|parrot|bird|fox|bear|cow|goat|horse|mouse|owl|tortoise|turtle|frog|deer|wolf|squirrel|duck|hen|peacock)\b/); return m && !/\b(man|woman|boy|girl|person|child|kid|human)\b/.test(t) ? m[1] : null; }
function tcAutoSpec(c, idx = 0) {
  const t = `${c.look || ''} ${c.outfit || ''} ${c.name || ''}`, tl = t.toLowerCase(), v = String(c.voice || '').toLowerCase(), seed = tcHash(c.name || idx);
  let region = TCS.tcRegion || 'indian';
  for (const [k, re] of TC_REGION_WORDS) if (re.test(t)) { region = k; break; }
  const R = TC_REGIONS[region] || TC_REGIONS.indian;
  const female = /female/.test(v) || (!/\bmale\b/.test(v) && /\b(woman|girl|lady|mother|mom|mummy|maa|wife|daughter|sister|queen|princess|grandmother|granny|dadi|nani|aunt|beti|ladki|she|her)\b|लड़की|माँ|औरत|દીકરી|છોકરી/i.test(t));
  const kv = typeof kvDetect === 'function' ? (() => { try { return kvDetect(c); } catch (e) { return null; } })() : null;
  const yrs = (tl.match(/\b(\d{1,2})[- ]?(?:year|yr|saal)s?\b/) || [])[1];
  let age = 'adult';
  if (/\bold\b/.test(v) || /\b(old|elderly|grandfather|grandmother|grandpa|granny|dada|dadi|nana|nani|aged|senior)\b|बूढ़|दादा|दादी/i.test(t)) age = 'old';
  if (/child/.test(v) || kv) age = kv && (kv.age === 'tiny' || kv.age === 'small') ? 'toddler' : kv && kv.age === 'teen' ? 'teen' : 'child';
  if (yrs) { const y = Number(yrs); age = y <= 5 ? 'toddler' : y <= 10 ? 'child' : y <= 17 ? 'teen' : y >= 60 ? 'old' : 'adult'; }
  if (/\b(teen|teenager|teenage|college student)\b/i.test(t)) age = 'teen';
  const g = female ? 'f' : 'm';
  // kapde
  const outfitWords = [['saree', /\bsar(ee|i)\b|साड़ी/], ['salwar', /\b(salwar|kameez|churidar|anarkali)\b/], ['lehenga', /\blehenga\b/], ['sherwani', /\bsherwani\b/], ['dhoti', /\bdhoti\b/], ['kurta', /\bkurta\b|कुर्ता/],
    ['hanbok', /\bhanbok\b/], ['kimono', /\b(kimono|yukata)\b/], ['robe', /\b(thobe|abaya|robe|kaftan|gown)\b/], ['uniform', /\b(school uniform|uniform)\b/], ['suit', /\b(suit|blazer|tuxedo)\b/],
    ['coat', /\b(coat|overcoat|trench)\b/], ['hoodie', /\bhoodie\b/], ['sweater', /\b(sweater|jumper|cardigan|pullover)\b/], ['frock', /\bfrock\b/], ['dress', /\bdress\b/], ['skirt', /\bskirt\b/],
    ['shorts', /\bshorts\b|\bhalf pant/], ['tshirt', /\bt-?shirt|\btee\b/], ['shirt', /\bshirt\b/]];
  let outfit = null; for (const [k, re] of outfitWords) if (re.test(tl)) { outfit = k; break; }
  if (outfit === 'uniform' && female) outfit = 'uniform_girl';
  if (outfit === 'hanbok' || outfit === 'kimono' || outfit === 'robe' || outfit === 'saree' || outfit === 'lehenga') { /* ok */ }
  if (!outfit) outfit = tcPick(R[g][age] || R[g].adult, seed >>> 3);
  const O = TC_OUTFITS[outfit] || TC_OUTFITS.shirt;
  const top = tcColorNear(tl, [...(outfit === 'saree' ? ['sar'] : []), 'kurta', 't-shirt', 'tshirt', 'shirt', 'top', 'dress', 'frock', 'sweater', 'coat', 'hoodie', 'jacket', 'kameez', 'suit', 'robe', 'kimono', 'hanbok', 'vest', 'banyan', 'blouse', 'choli']) || tcPick(R.tops, seed >>> 5);
  const bottom = tcColorNear(tl, ['lungi', 'ghagra', 'lehenga', 'pant', 'trouser', 'jeans', 'pajama', 'shorts', 'skirt', 'salwar', 'dhoti', 'leggings', 'blouse']) || (outfit === 'dhoti' ? '#f5f0e1' : outfit === 'kurta' ? '#f5f0e1' : outfit === 'saree' ? tcShade(top, 0.7) : tcPick(R.bottoms, seed >>> 7));
  // baal
  let hair = null;
  const hairWords = [['hijab', /\b(hijab|headscarf|head scarf)\b/], ['turban', /\b(turban|pagdi|pagri|safa)\b/], ['bald', /\bbald\b/], ['afro', /\bafro\b/], ['pigtails', /\b(pigtails|two ponytails|two plaits|two braids)\b/],
    ['braid', /\b(braid|plait|choti)\b/], ['ponytail', /\bponytail\b/], ['bun', /\b(bun|juda)\b/], ['bob', /\bbob\b/], ['curly', /\b(curly|curls|wavy)\b/], ['spiky', /\b(spiky|messy|tousled)\b/], ['long', /\blong (black |brown |blonde |red |grey )?hair\b/], ['cap', /\b(cap|baseball cap)\b/]];
  for (const [k, re] of hairWords) if (re.test(tl)) { hair = k; break; }
  if (!hair) hair = female ? (age === 'old' ? 'bun' : age === 'toddler' ? 'pigtails' : tcPick(['long', 'ponytail', 'braid', 'bob'], seed >>> 9)) : (age === 'old' ? tcPick(['short', 'bald'], seed >>> 9) : tcPick(['short', 'side', 'spiky'], seed >>> 9));
  let hairColor = /\b(grey|gray|white|silver)\b[^,.;]*\bhair|\bhair\b[^,.;]*\b(grey|gray|white|silver)\b/.test(tl) || age === 'old' ? '#c9c9c9' : /\bblonde?\b|golden hair/.test(tl) ? '#e0c08a' : /\b(red|ginger|auburn)\b[^,.;]*hair/.test(tl) ? '#b5502c' : /\bbrown\b[^,.;]*hair|hair[^,.;]*\bbrown\b/.test(tl) ? '#5b3a26' : tcPick(R.hair, seed >>> 11);
  const skinW = /\b(very fair|pale|porcelain)\b/.test(tl) ? '#f9e0cf' : /\bfair\b/.test(tl) ? '#f1c9a5' : /\bwheatish\b/.test(tl) ? '#d9a877' : /\b(dusky|dark brown|dark-skinned|dark skin)\b/.test(tl) ? '#7a4a2c' : /\b(brown skin|brown-skinned|tan|tanned|olive)\b/.test(tl) ? '#c68642' : null;
  const extras = [];
  if (/\b(glasses|spectacles|specs|chashma)\b/.test(tl)) extras.push('glasses');
  if (/\bbeard\b/.test(tl) && !/\bno beard\b/.test(tl)) extras.push('beard');
  if (/\b(moustache|mustache|mooch)\b/.test(tl)) extras.push('moustache');
  if (/\bbindi\b/.test(tl)) extras.push('bindi');
  if (/\b(earring|jhumka)/.test(tl)) extras.push('earrings');
  if (/\b(scarf|dupatta|muffler)\b/.test(tl) && outfit !== 'salwar') extras.push('scarf');
  if (/\b(walking stick|cane|lathi)\b/.test(tl)) extras.push('stick');
  if (/\b(school ?bag|backpack|bag)\b/.test(tl) && (age === 'child' || age === 'teen')) extras.push('bag');
  // 🏡 HD look ke gaon wale kapde (shabd se)
  const hdOutfit = /\blungi\b/.test(tl) ? (/\b(vest|banyan|baniyan|sando)\b/.test(tl) ? 'vest_lungi' : 'kurta_lungi') : /\bdhoti\b/.test(tl) ? (/\b(t-?shirt|shirt)\b/.test(tl) ? 'shirt_dhoti' : 'kurta_dhoti') : /\b(ghagra|lehenga|ghaghra|choli)\b/.test(tl) ? 'lehenga_choli' : /\b(vest|banyan|baniyan)\b/.test(tl) ? 'vest_lungi' : '';
  const pattern = /\b(check|checked|checkered|plaid)\b/.test(tl) ? 'checks' : /\b(polka|dotted|dots|printed)\b/.test(tl) ? 'dots' : /\bstripe/.test(tl) ? 'stripes' : '';
  const border = tcColorNear(tl, ['border']) || '';
  if (/\bheadband\b/.test(tl)) extras.push('headband');
  return { hdOutfit, pattern, border, region, gender: female ? 'f' : 'm', age, skin: skinW || tcPick(R.skin, seed >>> 1), hair, hairColor, outfit, top, bottom: O.shirt ? bottom : bottom, extras, animal: tcAnimalOf(c) };
}
function tcSeries() { return news && news.series && typeof SERIES !== 'undefined' ? SERIES[news.series.id] || null : null; }
// final cast: project mein badla hua > series lock > visual bible se apne aap
function tcCast() {
  const B = news && news.bible, out = {};
  const chars = (B && B.characters) || [];
  const S = tcSeries(), lock = (S && S.tcCast) || {}, mine = (news && news.tcCast) || {};
  chars.forEach((c, i) => { out[c.name] = { ...tcAutoSpec(c, i), ...(lock[c.name] || {}), ...(mine[c.name] || {}), name: c.name }; });
  for (const [n, sp] of Object.entries(mine)) if (!out[n]) out[n] = { ...tcAutoSpec({ name: n }, 0), ...sp, name: n };
  return out;
}
function tcSaveSpec(name, spec) {
  news.tcCast = news.tcCast || {}; news.tcCast[name] = spec; if (typeof projectSave === 'function') projectSave();
  const S = tcSeries(); if (S) { S.tcCast = S.tcCast || {}; S.tcCast[name] = spec; if (typeof srSaveAll === 'function') srSaveAll(); } // 🔒 series mein har episode same
}

// ---------- character draw (feet = x, y; k = scale; facing f = 1 daayein, -1 baayein) ----------
function tcLimb(x, pts, w, color, ow) {
  x.lineCap = 'round'; x.lineJoin = 'round';
  x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]);
  x.strokeStyle = TC_INK; x.lineWidth = w + ow * 2; x.stroke(); x.strokeStyle = color; x.lineWidth = w; x.stroke();
}
function tcEll(x, cx, cy, rx, ry, fill, ow, rot = 0) { x.beginPath(); x.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); if (fill) { x.fillStyle = fill; x.fill(); } if (ow) { x.strokeStyle = TC_INK; x.lineWidth = ow; x.stroke(); } }
function tcPoly(x, pts, fill, ow) { x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]); x.closePath(); if (fill) { x.fillStyle = fill; x.fill(); } if (ow) { x.strokeStyle = TC_INK; x.lineJoin = 'round'; x.lineWidth = ow; x.stroke(); } }
function tcRRect(x, x0, y0, w, h, r, fill, ow) { x.beginPath(); x.roundRect(x0, y0, w, h, r); if (fill) { x.fillStyle = fill; x.fill(); } if (ow) { x.strokeStyle = TC_INK; x.lineWidth = ow; x.stroke(); } }

function tcDrawChar(x, sp, st, k) {
  if (sp.animal) return tcDrawAnimal(x, sp, st, k);
  const B = { ...TC_BODY[sp.age] || TC_BODY.adult }, fem = sp.gender === 'f';
  if (fem && sp.age !== 'toddler') B.tw *= 0.9;
  const O = TC_OUTFITS[sp.outfit] || TC_OUTFITS.shirt, f = st.f || 1, ow = 3.2, t = st.t;
  const skin = sp.skin, bottom = sp.bottom;
  const topC = sp.outfit.startsWith('uniform') ? '#ffffff' : sp.top;
  x.save(); x.translate(st.x, st.y); x.scale(k, k);
  // parchhai (koodne par chhoti)
  const lift = st.jump || 0;
  x.save(); x.globalAlpha = 0.22; tcEll(x, 0, 0, 38 * (1 - Math.min(0.5, lift / 300)) * (B.h / 246), 8, '#000'); x.restore();
  const sit = st.sit || 0, ph = st.ph || 0, walking = st.walk > 0, amp = st.walk || 0;
  let bob = walking ? Math.abs(Math.sin(ph)) * 5 * amp : Math.sin(t * 2.1 + st.seed) * 1.2;
  if (st.dance) bob = Math.abs(Math.sin(st.dph)) * 12;
  if (st.laugh) bob += Math.abs(Math.sin(t * 16)) * 3;
  if (st.scared) bob += Math.sin(t * 40) * 1.2;
  const yOff = -lift - bob + sit * (B.hip * 0.45);
  x.translate(0, yOff);
  if (sit > 0.01) { // chhota stool (zameen se, kooliha uske upar)
    const sx = -f * 6, top = -B.hip * 0.55;
    x.save(); x.translate(0, -yOff); x.globalAlpha = Math.min(1, sit * 2);
    tcLimb(x, [[sx - 18, top + 6], [sx - 20, 0]], 6, '#8b5a33', 2); tcLimb(x, [[sx + 18, top + 6], [sx + 20, 0]], 6, '#8b5a33', 2); tcRRect(x, sx - 26, top - 2, 52, 10, 4, '#a1673d', ow);
    x.restore();
  }
  const hunch = B.hunch || 0;
  // ---- taangein ----
  const legC = O.legs === 'bare' ? skin : O.legs === 'shorts' ? bottom : O.legs === 'baggy' ? bottom : bottom;
  const legW = O.legs === 'baggy' ? B.lw * 1.9 : B.lw * 1.35;
  const legPose = (side) => {
    const hipX = side * B.tw * 0.42, hipY = -B.hip;
    if (sit > 0.01) { const kx = hipX + f * B.hip * 0.5 * sit, ky = hipY + B.hip * 0.05; return [[hipX, hipY], [kx, ky], [kx + f * 2, ky + B.hip * 0.52]]; }
    const s2 = side === f ? 0 : Math.PI;
    let sw = walking ? Math.sin(ph + s2) * amp : 0; if (st.dance) sw = 0.35 * Math.sin(st.dph + s2);
    const footX = hipX * 0.6 + f * sw * B.hip * 0.34, lft = walking ? Math.max(0, Math.cos(ph + s2)) * B.hip * 0.13 * amp : 0;
    const tuck = lift > 4 ? B.hip * 0.12 : 0;
    const kneeX = (hipX + footX) / 2 + f * (Math.abs(sw) * 6 + tuck * 0.6), kneeY = hipY + B.hip * 0.5 - tuck * 0.3;
    return [[hipX, hipY], [kneeX, kneeY], [footX, -6 - lft - tuck]];
  };
  const legs = [legPose(-f), legPose(f)];
  const longSkirt = O.skirt === 'ankle' || O.skirt === 'bell' || O.skirt === 'wide' || O.len === 'ankle';
  for (const L of legs) {
    if (!longSkirt || sit > 0.2) {
      if (O.legs === 'shorts') { const mid = [(L[0][0] + L[1][0]) / 2, (L[0][1] + L[1][1]) / 2]; tcLimb(x, [L[0], L[1], L[2]], B.lw * 1.1, skin, ow); tcLimb(x, [L[0], [L[0][0] * 0.4 + L[1][0] * 0.6, L[0][1] * 0.4 + L[1][1] * 0.6]], legW * 1.15, bottom, ow); }
      else tcLimb(x, L, legW, legC, ow);
    }
    tcEll(x, L[2][0] + f * 7, L[2][1] + 1, B.lw * 1.4, B.lw * 0.75, sp.age === 'old' && fem ? '#6d4c41' : '#3b3036', ow); // joota
  }
  // ---- neeche ka kapda (lamba skirt / saree / robe) ----
  const waist = -B.hip + 4;
  const skirtTo = (yEnd, wTop, wBot, col) => { tcPoly(x, [[-wTop, waist - 6], [wTop, waist - 6], [wBot + Math.sin(t * 3 + st.seed) * 1.5, yEnd], [-wBot + Math.sin(t * 3 + st.seed) * 1.5, yEnd]], col, ow); };
  const swing = walking ? Math.sin(ph) * 4 * amp : 0;
  if (sit < 0.2) {
    if (O.skirt === 'ankle') skirtTo(-8, B.tw * 0.95, B.tw * 1.25 + swing, sp.outfit === 'saree' ? sp.top : bottom);
    else if (O.skirt === 'wide') skirtTo(-6, B.tw * 0.95, B.tw * 1.8 + swing, bottom);
    else if (O.skirt === 'bell') { tcPoly(x, [[-B.tw * 0.9, -B.sh + 22], [B.tw * 0.9, -B.sh + 22], [B.tw * 1.75 + swing, -6], [-B.tw * 1.75 + swing, -6]], bottom, ow); }
    else if (O.skirt === 'knee') skirtTo(-B.hip * 0.42, B.tw * 0.95, B.tw * 1.3 + swing * 0.6, sp.outfit === 'skirt' || sp.outfit.startsWith('uniform') ? bottom : sp.top);
    else if (O.skirt === 'frock') skirtTo(-B.hip * 0.5, B.tw * 0.95, B.tw * 1.6 + swing * 0.6, sp.top);
  } else if (O.skirt) { // baithe hue: ghutno tak kapda
    const col = O.skirt === 'ankle' && sp.outfit === 'saree' ? sp.top : O.skirt === 'knee' && sp.outfit === 'dress' ? sp.top : O.skirt === 'frock' ? sp.top : bottom;
    tcPoly(x, [[-B.tw, waist - 6], [B.tw, waist - 6], [f * B.hip * 0.6 + B.tw * 0.5 * f, -B.hip * 0.95], [f * B.hip * 0.55, -B.hip * 0.6], [-f * B.tw, -B.hip * 0.75]], col, ow);
  }
  // ---- baahein (pose) ----
  const armAngles = (front) => {
    let a1 = front ? 0.08 : -0.06, a2 = 0.18;
    if (walking) { const s2 = front ? 0 : Math.PI; a1 = Math.sin(ph + s2 + Math.PI) * (st.run ? 0.85 : 0.5) * amp; a2 = st.run ? 1.3 : 0.3; }
    if (st.talkG > 0.01 && front) { a1 = a1 * (1 - st.talkG) + (0.45 + 0.35 * st.talkA) * st.talkG; a2 = a2 * (1 - st.talkG) + (1.1 + 0.3 * Math.sin(t * 5)) * st.talkG; }
    if (st.wave > 0.01 && front) { a1 = a1 * (1 - st.wave) + 2.65 * st.wave; a2 = a2 * (1 - st.wave) + (0.35 * Math.sin(t * 10)) * st.wave; }
    if (st.dance) { const s2 = front ? 0 : Math.PI; a1 = (front ? 1 : -1) * (2.3 + 0.5 * Math.sin(st.dph + s2)); a2 = (front ? 1 : -1) * 0.4; }
    if (st.think && front) { a1 = 0.95; a2 = 2.25; }
    if (st.point && front) { a1 = 1.5; a2 = 0.05; }
    if (st.cry && front) { a1 = 1.0; a2 = 2.1; }
    if (st.laugh) { a1 = front ? 0.45 : -0.45; a2 = front ? 1.5 : -1.5; }
    if (st.scared) { a1 = front ? 1.2 : -1.2; a2 = front ? 1.7 : -1.7; }
    if (st.sleep) { a1 = front ? 0.15 : -0.1; a2 = 0.6; }
    if (sit > 0.2 && !st.wave && !st.think && !st.point && !st.cry && !st.talkG) { a1 = front ? 0.7 : 0.5; a2 = 0.9; }
    return [a1, a2];
  };
  const shoulder = (front) => [(front ? f : -f) * B.tw * 0.72 + f * hunch, -B.sh + 9 + hunch * 0.4];
  const armPts = (front) => {
    const [a1, a2] = armAngles(front), [sx, sy] = shoulder(front), L1 = B.arm * 0.5, L2 = B.arm * 0.5;
    const ex = sx + Math.sin(a1) * f * L1, ey = sy + Math.cos(a1) * L1, hx = ex + Math.sin(a1 + a2) * f * L2, hy = ey + Math.cos(a1 + a2) * L2;
    return [[sx, sy], [ex, ey], [hx, hy]];
  };
  const sleeve = sp.outfit === 'saree' ? skin : topC;
  const drawArm = (front) => {
    const P = armPts(front);
    if (sp.outfit === 'saree' || sp.outfit === 'tshirt' || sp.outfit === 'shorts' || sp.outfit === 'frock' || sp.outfit === 'dress') { // aadhi baanh
      const m = [P[0][0] * 0.45 + P[1][0] * 0.55, P[0][1] * 0.45 + P[1][1] * 0.55];
      tcLimb(x, P, B.aw * 1.05, skin, ow); tcLimb(x, [P[0], m], B.aw * 1.45, sp.outfit === 'saree' ? sp.bottom : topC, ow);
    } else { tcLimb(x, [P[0], P[1], [P[1][0] * 0.15 + P[2][0] * 0.85, P[1][1] * 0.15 + P[2][1] * 0.85]], B.aw * 1.35, sleeve, ow); }
    tcEll(x, P[2][0], P[2][1], B.aw * 0.85, B.aw * 0.85, skin, ow * 0.8);
    if (front && sp.extras && sp.extras.includes('stick') && !st.wave && !st.dance) { tcLimb(x, [[P[2][0], P[2][1] - 6], [P[2][0] + f * 6, -yOff - 2]], 5, '#7a5230', 2); }
  };
  if (sp.extras && sp.extras.includes('bag')) tcRRect(x, -f * B.tw - (f > 0 ? 16 : 0), -B.sh + 10, 18, B.sh - B.hip - 6, 6, '#e53935', ow); // basta peeth par
  // sar ki jagah pehle se (lambe baal / choti dhad ke PEECHE)
  const hr = B.hr, hx = f * hunch * 0.9, nodT = st.talkA ? Math.sin(t * 6) * 2 * st.talkA : 0;
  const tilt = (st.sleep ? 0.25 * f : 0) + (st.laugh ? Math.sin(t * 16) * 0.06 : 0) + (st.cry ? 0.08 : 0) + (st.think ? -0.08 * f : 0);
  const hy = -B.head + nodT * 0.5;
  if (sp.hair !== 'hijab') { x.save(); x.translate(hx, hy); x.rotate(tilt); drawHairBack(x, sp, hr, f, t, ow); x.restore(); }
  drawArm(false);
  // ---- dhad (kapde ke saath) ----
  const tLen = { chest: -B.sh + 26, hip: waist + 2, thigh: -B.hip * 0.55, knee: -B.hip * 0.32, ankle: -10 }[O.len] || waist;
  const tB = sit > 0.2 && (O.len === 'knee' || O.len === 'ankle' || O.len === 'thigh') ? -B.hip * 0.7 : tLen;
  const flare = O.len === 'ankle' ? 1.25 : O.len === 'knee' || O.len === 'thigh' ? 1.12 : 1.0;
  x.save(); x.translate(f * hunch * 0.5, 0);
  const torsoCol = sp.outfit === 'saree' ? sp.bottom : topC;
  tcPoly(x, [[-B.tw, -B.sh + 6], [B.tw, -B.sh + 6], [B.tw * flare, tB], [-B.tw * flare, tB]], torsoCol, 0);
  x.beginPath(); x.moveTo(-B.tw + 8, -B.sh); x.lineTo(B.tw - 8, -B.sh); x.quadraticCurveTo(B.tw, -B.sh, B.tw, -B.sh + 10); x.lineTo(B.tw * flare, tB); x.lineTo(-B.tw * flare, tB); x.lineTo(-B.tw, -B.sh + 10); x.quadraticCurveTo(-B.tw, -B.sh, -B.tw + 8, -B.sh); x.closePath();
  x.fillStyle = torsoCol; x.fill(); x.strokeStyle = TC_INK; x.lineWidth = ow; x.stroke();
  const D = O.d || [];
  x.lineWidth = 2; x.strokeStyle = TC_INK;
  if (D.includes('placket')) { x.beginPath(); x.moveTo(f * 4, -B.sh + 2); x.lineTo(f * 4, -B.sh + 34); x.stroke(); for (let i = 0; i < 3; i++) tcEll(x, f * 4, -B.sh + 10 + i * 9, 1.8, 1.8, '#f5f0e1'); }
  if (D.includes('buttons')) for (let i = 0; i < 4; i++) tcEll(x, f * 3, -B.sh + 16 + i * ((tB + B.sh - 24) / 4), 2, 2, tcShade(topC, 0.6));
  if (D.includes('collar')) { tcPoly(x, [[f * 3 - 12, -B.sh + 1], [f * 3, -B.sh + 12], [f * 3 - 3, -B.sh + 1]], '#ffffff', 1.5); tcPoly(x, [[f * 3 + 12, -B.sh + 1], [f * 3, -B.sh + 12], [f * 3 + 3, -B.sh + 1]], '#ffffff', 1.5); }
  if (D.includes('lapels')) { tcPoly(x, [[f * 2 - 10, -B.sh + 1], [f * 2, -B.sh + 30], [f * 2 + 10, -B.sh + 1]], '#ffffff', 1.5); tcPoly(x, [[f * 2 - 12, -B.sh + 2], [f * 2 - 4, -B.sh + 30], [f * 2 - 16, -B.sh + 14]], tcShade(topC, 0.75), 1.5); tcPoly(x, [[f * 2 + 12, -B.sh + 2], [f * 2 + 4, -B.sh + 30], [f * 2 + 16, -B.sh + 14]], tcShade(topC, 0.75), 1.5); }
  if (D.includes('tie')) tcPoly(x, [[f * 2 - 3, -B.sh + 8], [f * 2 + 3, -B.sh + 8], [f * 2 + 5, -B.sh + 34], [f * 2, -B.sh + 40], [f * 2 - 5, -B.sh + 34]], sp.outfit.startsWith('uniform') ? sp.bottom : '#c62828', 1.5);
  if (D.includes('ribs')) { x.lineWidth = 1.5; for (const yy of [tB - 6]) { x.beginPath(); x.moveTo(-B.tw * flare + 2, yy); x.lineTo(B.tw * flare - 2, yy); x.stroke(); } }
  if (D.includes('pocket')) tcRRect(x, -12, tB - 22, 24, 12, 4, tcShade(topC, 0.85), 1.5);
  if (D.includes('band') && sp.outfit === 'sherwani') { x.lineWidth = 2; x.beginPath(); x.moveTo(-8, -B.sh + 4); x.lineTo(8, -B.sh + 4); x.stroke(); }
  if (D.includes('obi')) tcRRect(x, -B.tw * 1.02, -B.hip - 8, B.tw * 2.04, 14, 2, sp.bottom, 1.5);
  if (D.includes('cross')) { x.lineWidth = 2; x.beginPath(); x.moveTo(-10, -B.sh + 2); x.lineTo(8, -B.hip - 8); x.stroke(); }
  if (D.includes('bow')) { tcEll(x, f * 6, -B.sh + 18, 6, 3, sp.bottom, 1.2, 0.5); x.lineWidth = 2; x.strokeStyle = sp.bottom; x.beginPath(); x.moveTo(f * 6, -B.sh + 18); x.lineTo(f * 2, -B.sh + 40); x.stroke(); }
  if (D.includes('pallu') && sit < 0.5) { tcPoly(x, [[-f * B.tw, -B.sh + 4], [-f * (B.tw - 12), -B.sh + 2], [f * B.tw * 1.0, waist + 2], [f * B.tw * 0.55, waist + 8]], sp.top, 2); x.strokeStyle = '#f9d55b'; x.lineWidth = 2; x.beginPath(); x.moveTo(-f * (B.tw - 12), -B.sh + 4); x.lineTo(f * B.tw, waist + 2); x.stroke(); }
  if (D.includes('dupatta')) { const dc = tcShade(sp.top, 1.35); x.strokeStyle = dc; x.lineWidth = 7; x.lineCap = 'round'; x.beginPath(); x.moveTo(-B.tw * 0.9, -B.sh + 4); x.quadraticCurveTo(0, -B.sh + 30, B.tw * 0.9, -B.sh + 4); x.stroke(); }
  if (D.includes('hood')) { tcEll(x, -f * 6, -B.sh + 2, B.tw * 0.75, 7, tcShade(topC, 0.85), 1.5); }
  if (sp.extras && sp.extras.includes('scarf')) { x.strokeStyle = '#d84315'; x.lineWidth = 8; x.lineCap = 'round'; x.beginPath(); x.moveTo(-B.tw * 0.7, -B.sh + 3); x.lineTo(B.tw * 0.7, -B.sh + 3); x.stroke(); tcLimb(x, [[f * 6, -B.sh + 4], [f * 9, -B.sh + 30]], 6, '#d84315', 1.5); }
  x.restore();
  // ---- sar ----
  tcLimb(x, [[hx * 0.6, -B.sh + 4], [hx, hy + hr * 0.6]], hr * 0.42, skin, ow);
  x.save(); x.translate(hx, hy); x.rotate(tilt);
  if (sp.hair === 'hijab') drawHairBack(x, sp, hr, f, t, ow);
  else if (['bun', 'pigtails', 'curly', 'afro', 'bob'].includes(sp.hair)) drawHairBack(x, sp, hr, f, t, ow); // sar ke saath wale baal: chehre ke peeche, dhad ke aage
  // kaan
  tcEll(x, -f * hr * 0.86, 4, hr * 0.17, hr * 0.24, skin, ow * 0.8);
  if (sp.extras && sp.extras.includes('earrings') && sp.hair !== 'hijab') tcEll(x, -f * hr * 0.88, hr * 0.33, 3, 3, '#f9d55b', 1);
  // chehra
  tcEll(x, 0, 0, hr, hr * 0.96, skin, ow);
  drawHairFront(x, sp, hr, f, ow);
  drawFace(x, sp, st, hr, f, ow);
  drawHeadwear(x, sp, hr, f, ow);
  x.restore();
  if (st.sleep) { x.fillStyle = TC_INK; x.font = `bold ${hr * 0.6}px sans-serif`; const z = (t * 0.8) % 1; x.globalAlpha = 1 - z; x.fillText('Z', hx + f * hr * 1.1, hy - hr - z * 30); x.globalAlpha = 1; }
  if (st.think) { x.fillStyle = '#ffffff'; x.strokeStyle = TC_INK; x.lineWidth = 2; for (const [dx, dy, r] of [[hr * 0.9, -hr * 1.1, 4], [hr * 1.2, -hr * 1.5, 6]]) { x.beginPath(); x.arc(hx + f * dx, hy + dy, r, 0, 7); x.fill(); x.stroke(); } x.font = `bold ${hr * 0.7}px sans-serif`; x.fillStyle = TC_INK; x.fillText('?', hx + f * hr * 1.45 - hr * 0.2, hy - hr * 1.75); }
  drawArm(true);
  x.restore();
}
function drawHairBack(x, sp, hr, f, t, ow) {
  const c = sp.hairColor, h = sp.hair;
  if (h === 'hijab') { tcEll(x, 0, hr * 0.15, hr * 1.22, hr * 1.25, sp.top === '#fafafa' ? '#37474f' : tcShade(sp.top, 0.8), ow); return; }
  if (h === 'long') tcRRect(x, -hr * 1.05, -hr * 0.6, hr * 2.1, hr * 2.2, hr * 0.7, c, ow);
  if (h === 'bob') tcRRect(x, -hr * 1.1, -hr * 0.8, hr * 2.2, hr * 1.75, hr * 0.8, c, ow);
  if (h === 'ponytail') { const sw = Math.sin(t * 3) * 3; tcEll(x, -f * hr * 1.0 + sw, hr * 0.5, hr * 0.32, hr * 0.75, c, ow, -0.4 * f); }
  if (h === 'braid') for (let i = 0; i < 5; i++) tcEll(x, -f * hr * 0.7, hr * 0.35 + i * hr * 0.3, hr * 0.2 - i * 0.6, hr * 0.18, c, ow * 0.8);
  if (h === 'pigtails') for (const s of [-1, 1]) tcEll(x, s * hr * 1.05, -hr * 0.1, hr * 0.25, hr * 0.38, c, ow, s * 0.4);
  if (h === 'curly' || h === 'afro') { const R = h === 'afro' ? 1.32 : 1.12; for (let i = 0; i < 9; i++) { const a = Math.PI * (0.95 + i * 0.125); tcEll(x, Math.cos(a) * hr * R * 0.85, Math.sin(a) * hr * R * 0.85 - hr * 0.05, hr * 0.36 * R, hr * 0.36 * R, c, 0); } tcEll(x, 0, -hr * 0.2, hr * R, hr * R * 0.92, c, ow); }
  if (h === 'bun') tcEll(x, -f * hr * 0.35, -hr * 0.95, hr * 0.38, hr * 0.32, c, ow);
}
function drawHairFront(x, sp, hr, f, ow) {
  const c = sp.hairColor, h = sp.hair;
  if (h === 'hijab' || h === 'turban' || h === 'cap') { if (h !== 'hijab') { x.save(); x.beginPath(); x.ellipse(0, 0, hr, hr * 0.96, 0, 0, 7); x.clip(); x.fillStyle = c; x.fillRect(-hr, -hr, hr * 2, hr * 0.55); x.restore(); } return; }
  if (h === 'bald') { if (sp.age === 'old') for (const s of [-1, 1]) tcEll(x, s * hr * 0.88, -hr * 0.05, hr * 0.15, hr * 0.3, c, 0); return; }
  x.save(); x.beginPath(); x.ellipse(0, 0, hr, hr * 0.96, 0, 0, 7); x.clip(); x.scale(f, 1); f = 1;
  x.fillStyle = c; x.beginPath();
  if (h === 'spiky') { x.moveTo(-hr, -hr * 0.2); for (let i = 0; i <= 8; i++) x.lineTo(-hr + i * hr * 0.25, i % 2 ? -hr * 0.55 : -hr * 0.2); x.lineTo(hr, -hr * 1.2); x.lineTo(-hr, -hr * 1.2); }
  else if (h === 'side') { x.moveTo(-hr, -hr * 0.1); x.quadraticCurveTo(-f * hr * 0.2, -hr * 0.75, f * hr, -hr * 0.25); x.lineTo(f * hr, -hr * 1.2); x.lineTo(-f * hr, -hr * 1.2); }
  else if (h === 'long' || h === 'ponytail' || h === 'braid' || h === 'bun' || h === 'pigtails' || h === 'bob') { x.moveTo(-hr, hr * 0.15); x.quadraticCurveTo(-hr * 0.5, -hr * 0.75, f * hr * 0.15, -hr * 0.55); x.quadraticCurveTo(hr * 0.6 * f, -hr * 0.62, hr * f, hr * 0.15); x.lineTo(hr * f, -hr * 1.2); x.lineTo(-hr * f, -hr * 1.2); }
  else { x.moveTo(-hr, -hr * 0.12); x.quadraticCurveTo(0, -hr * 0.62, hr, -hr * 0.12); x.lineTo(hr, -hr * 1.2); x.lineTo(-hr, -hr * 1.2); }
  x.closePath(); x.fill();
  x.restore();
  x.beginPath(); x.ellipse(0, 0, hr, hr * 0.96, 0, Math.PI * 1.05, Math.PI * 1.95); x.strokeStyle = TC_INK; x.lineWidth = ow; x.stroke();
  if (h === 'spiky' || h === 'curly') { tcPoly(x, [[-hr * 0.2, -hr * 0.9], [hr * 0.05, -hr * 1.25], [hr * 0.25, -hr * 0.88]], c, ow * 0.8); }
}
function drawHeadwear(x, sp, hr, f, ow) {
  const h = sp.hair;
  if (h === 'turban') { const tc = sp.top === '#fafafa' ? '#ef6c00' : tcShade(sp.top, 1.1); tcEll(x, 0, -hr * 0.62, hr * 1.08, hr * 0.62, tc, ow); x.strokeStyle = tcShade(tc, 0.7); x.lineWidth = 2; for (let i = 0; i < 3; i++) { x.beginPath(); x.ellipse(0, -hr * 0.55 - i * 8, hr * (0.95 - i * 0.12), hr * 0.25, -0.15 * f, Math.PI, Math.PI * 2); x.stroke(); } }
  if (h === 'cap') { tcEll(x, 0, -hr * 0.55, hr * 1.0, hr * 0.55, sp.top, ow); tcEll(x, f * hr * 0.75, -hr * 0.42, hr * 0.6, hr * 0.14, tcShade(sp.top, 0.75), ow); }
  if (h === 'hijab') { x.save(); x.beginPath(); x.ellipse(0, 0, hr * 1.22, hr * 1.25, 0, 0, 7); x.ellipse(f * hr * 0.06, hr * 0.06, hr * 0.84, hr * 0.86, 0, 0, 7); x.fillStyle = sp.top === '#fafafa' ? '#37474f' : tcShade(sp.top, 0.8); x.fill('evenodd'); x.restore(); x.beginPath(); x.ellipse(f * hr * 0.06, hr * 0.06, hr * 0.84, hr * 0.86, 0, 0, 7); x.strokeStyle = TC_INK; x.lineWidth = ow * 0.7; x.stroke(); }
}
function drawFace(x, sp, st, hr, f, ow) {
  const cx = f * hr * 0.2, ey = -hr * 0.02, open = st.blink, emo = st.emo || 'happy', look = (st.look || 0) * hr * 0.05;
  const old = sp.age === 'old', kid = sp.age === 'toddler' || sp.age === 'child';
  const er = hr * (kid ? 0.2 : 0.17), eh = hr * (kid ? 0.25 : 0.21);
  for (const s of [-1, 1]) {
    const ex = cx + s * hr * 0.36;
    if (st.sleep || emo === 'laugh' || st.laugh) { x.beginPath(); x.arc(ex, ey + 2, er * 0.9, Math.PI * 1.1, Math.PI * 1.9); x.strokeStyle = TC_INK; x.lineWidth = 2.6; x.stroke(); }
    else {
      tcEll(x, ex, ey, er, eh * Math.max(0.1, open), '#ffffff', 2.2);
      if (open > 0.3) { tcEll(x, ex + f * er * 0.3 + look, ey + eh * 0.1, er * 0.55, eh * 0.6 * open, TC_INK); tcEll(x, ex + f * er * 0.45 + look, ey - eh * 0.2, er * 0.2, er * 0.2, '#ffffff'); }
    }
    // bhauhein (emotion)
    const by = ey - eh - 5, inner = s === f ? -1 : 1;
    let dy0 = 0, dy1 = 0;
    if (emo === 'angry') { dy0 = inner > 0 ? 5 : -2; dy1 = inner > 0 ? -2 : 5; }
    if (emo === 'sad' || st.cry || emo === 'scared') { dy0 = inner > 0 ? -4 : 2; dy1 = inner > 0 ? 2 : -4; }
    if (emo === 'surprised' || st.scared) { dy0 -= 4; dy1 -= 4; }
    x.beginPath(); x.moveTo(ex - er, by + (s < 0 ? dy1 : dy0)); x.lineTo(ex + er, by + (s < 0 ? dy0 : dy1));
    x.strokeStyle = old ? '#9e9e9e' : (sp.hair === 'bald' ? '#5d4037' : sp.hairColor); x.lineWidth = 3; x.lineCap = 'round'; x.stroke();
    if (old) { x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(ex + s * er * 1.2, ey + 1); x.lineTo(ex + s * er * 1.7, ey + 4); x.stroke(); }
  }
  // naak
  x.beginPath(); x.moveTo(cx + f * hr * 0.06, hr * 0.1); x.quadraticCurveTo(cx + f * hr * 0.2, hr * 0.24, cx + f * hr * 0.03, hr * 0.27); x.strokeStyle = tcShade(sp.skin, 0.6); x.lineWidth = 2.2; x.stroke();
  // gaal
  x.globalAlpha = 0.35; for (const s of [-1, 1]) tcEll(x, cx + s * hr * 0.52, hr * 0.32, hr * 0.14, hr * 0.08, '#ff6b6b'); x.globalAlpha = 1;
  if (sp.extras && sp.extras.includes('bindi') && sp.hair !== 'hijab') tcEll(x, cx, ey - eh - 9, 2.6, 2.6, '#c62828');
  // muh
  const mx = cx, my = hr * 0.52, talk = st.mouth || 0;
  if (sp.extras && sp.extras.includes('beard')) { x.beginPath(); x.moveTo(-hr * 0.82, hr * 0.05); x.quadraticCurveTo(-hr * 0.7, hr * 1.15, cx, hr * 1.12); x.quadraticCurveTo(hr * 0.7, hr * 1.15, hr * 0.82, hr * 0.05); x.quadraticCurveTo(cx, hr * 0.55, -hr * 0.82, hr * 0.05); x.fillStyle = sp.hairColor; x.fill(); x.strokeStyle = TC_INK; x.lineWidth = ow * 0.7; x.stroke(); }
  if (talk > 0.06) { tcEll(x, mx, my, hr * 0.2, hr * (0.05 + 0.2 * talk), '#8e2436', 2); if (talk > 0.35) tcEll(x, mx, my + hr * 0.08 * talk, hr * 0.1, hr * 0.05 * talk, '#e57373'); }
  else if (emo === 'sad' || st.cry) { x.beginPath(); x.arc(mx, my + hr * 0.14, hr * 0.15, Math.PI * 1.15, Math.PI * 1.85); x.strokeStyle = TC_INK; x.lineWidth = 2.6; x.stroke(); }
  else if (emo === 'surprised' || st.scared) tcEll(x, mx, my + 2, hr * 0.09, hr * 0.12, '#8e2436', 2);
  else if (emo === 'angry') { x.beginPath(); x.moveTo(mx - hr * 0.16, my + 3); x.lineTo(mx + hr * 0.16, my + 1); x.strokeStyle = TC_INK; x.lineWidth = 2.6; x.stroke(); }
  else if (st.laugh || emo === 'laugh') { x.beginPath(); x.moveTo(mx - hr * 0.22, my - 3); x.quadraticCurveTo(mx, my + hr * 0.42, mx + hr * 0.22, my - 3); x.closePath(); x.fillStyle = '#8e2436'; x.fill(); x.strokeStyle = TC_INK; x.lineWidth = 2; x.stroke(); }
  else if (emo === 'neutral') { x.beginPath(); x.moveTo(mx - hr * 0.12, my + 1); x.quadraticCurveTo(mx, my + 4, mx + hr * 0.12, my + 1); x.strokeStyle = TC_INK; x.lineWidth = 2.4; x.stroke(); }
  else { x.beginPath(); x.arc(mx, my - hr * 0.06, hr * 0.17, Math.PI * 0.15, Math.PI * 0.85); x.strokeStyle = TC_INK; x.lineWidth = 2.6; x.lineCap = 'round'; x.stroke(); }
  if (sp.extras && sp.extras.includes('moustache')) { x.fillStyle = sp.hairColor; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(mx + s * hr * 0.13, my - hr * 0.13, hr * 0.15, hr * 0.06, s * 0.25, 0, 7); x.fill(); } }
  if (st.cry) { x.fillStyle = '#64b5f6'; for (const s of [-1, 1]) { const ty = ey + eh + ((st.t * 1.4 + (s > 0 ? 0.5 : 0)) % 1) * hr * 0.6; x.beginPath(); x.ellipse(cx + s * hr * 0.36, ty, 2.6, 4, 0, 0, 7); x.fill(); } }
  if (sp.extras && sp.extras.includes('glasses')) { x.strokeStyle = TC_INK; x.lineWidth = 2.4; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(cx + s * hr * 0.36, ey, er * 1.35, eh * 1.05, 0, 0, 7); x.stroke(); } x.beginPath(); x.moveTo(cx - hr * 0.36 + er * 1.35, ey); x.lineTo(cx + hr * 0.36 - er * 1.35, ey); x.stroke(); }
  if (st.scared) { x.fillStyle = '#90caf9'; x.beginPath(); x.ellipse(cx - f * hr * 0.72, -hr * 0.45, 3, 5, 0, 0, 7); x.fill(); }
}
// jaanwar: saada cartoon (kutta, billi, khargosh, sher, bhalu …) — chalna, koodna, bolna
const TC_ANIMAL = { dog: ['#c69c6d', 'flop'], puppy: ['#d7b48a', 'flop'], cat: ['#f4a259', 'tri'], kitten: ['#f6b26b', 'tri'], rabbit: ['#eeeeee', 'long'], bunny: ['#f5f5f5', 'long'], lion: ['#e0a040', 'mane'], tiger: ['#f08c2a', 'tri'], bear: ['#8d6e63', 'round'], monkey: ['#8d6e63', 'round'], fox: ['#e8722c', 'tri'], wolf: ['#90a4ae', 'tri'], mouse: ['#b0bec5', 'round'], cow: ['#fafafa', 'flop'], goat: ['#eeeeee', 'flop'], horse: ['#a1887f', 'tri'], deer: ['#c8955c', 'tri'], squirrel: ['#bf7a3a', 'tri'], elephant: ['#9e9e9e', 'big'], frog: ['#66bb6a', 'none'], tortoise: ['#8bc34a', 'none'], turtle: ['#8bc34a', 'none'] };
function tcDrawAnimal(x, sp, st, k) {
  const kind = sp.animal, bird = /crow|parrot|bird|owl|duck|hen|peacock/.test(kind);
  const [col0, ear] = TC_ANIMAL[kind] || (bird ? [kind === 'crow' ? '#37474f' : kind === 'parrot' ? '#43a047' : kind === 'owl' ? '#8d6e63' : '#fdd835', 'none'] : ['#bcaaa4', 'round']);
  const col = sp.top && sp.animalColor ? sp.animalColor : col0, f = st.f || 1, t = st.t, ow = 3.2;
  x.save(); x.translate(st.x, st.y); x.scale(k * 0.9, k * 0.9);
  x.save(); x.globalAlpha = 0.22; tcEll(x, 0, 0, 48, 8, '#000'); x.restore();
  const walking = st.walk > 0, ph = st.ph || 0, bob = walking ? Math.abs(Math.sin(ph)) * 5 : Math.sin(t * 2 + st.seed) * 1.2;
  x.translate(0, -(st.jump || 0) - bob);
  if (bird) {
    tcEll(x, 0, -60, 34, 40, col, ow); tcEll(x, -f * 12, -58, 20, 26, tcShade(col, 0.8), ow, 0.3 * f);
    tcLimb(x, [[-8, -22], [-8, -2]], 4, '#f9a825', 1.5); tcLimb(x, [[8, -22], [8, -2]], 4, '#f9a825', 1.5);
    tcEll(x, f * 4, -112, 26, 25, col, ow);
    tcPoly(x, [[f * 24, -114], [f * 46, -108 + (st.mouth || 0) * 6], [f * 24, -102]], '#f9a825', 2);
    tcEll(x, f * 12, -118, 7, 8, '#fff', 2); tcEll(x, f * 14, -117, 3.5, 4.5 * st.blink, TC_INK);
  } else {
    const legsY = -8;
    for (const [lx, s2] of [[-24, 0], [22, Math.PI], [-12, Math.PI], [30, 0]]) { const sw = walking ? Math.sin(ph + s2) * 9 : 0; tcLimb(x, [[lx * f, -36], [lx * f + sw * f, legsY]], 11, tcShade(col, 0.92), ow); }
    tcEll(x, 0, -52, 46, 28, col, ow);
    const tw = Math.sin(t * 6) * 0.3; tcLimb(x, [[-f * 42, -60], [-f * 58, -78 + tw * 20]], 7, col, ow);
    const hx = f * 40, hy = -88;
    if (ear === 'mane') tcEll(x, hx, hy, 36, 36, '#b06d1e', ow);
    if (ear === 'big') { tcEll(x, hx - f * 22, hy, 24, 30, tcShade(col, 0.9), ow); tcLimb(x, [[hx + f * 22, hy + 6], [hx + f * 30, hy + 36]], 12, col, ow); }
    if (ear === 'tri') for (const s of [-1, 1]) tcPoly(x, [[hx + s * 16 - 8, hy - 14], [hx + s * 18, hy - 40], [hx + s * 16 + 8, hy - 14]], col, ow);
    if (ear === 'long') for (const s of [-1, 1]) tcEll(x, hx + s * 10, hy - 38, 7, 22, col, ow, s * 0.15);
    if (ear === 'flop') for (const s of [-1, 1]) tcEll(x, hx + s * 22, hy - 4, 8, 16, tcShade(col, 0.75), ow, s * 0.4);
    if (ear === 'round') for (const s of [-1, 1]) tcEll(x, hx + s * 20, hy - 20, 10, 10, col, ow);
    tcEll(x, hx, hy, 28, 26, col, ow);
    tcEll(x, hx + f * 10, hy + 9, 13, 9, tcShade(col, 1.3), 2);
    tcEll(x, hx + f * 18, hy + 4, 4, 3, TC_INK);
    if ((st.mouth || 0) > 0.06) tcEll(x, hx + f * 10, hy + 15, 6, 2 + st.mouth * 6, '#8e2436', 1.5);
    for (const s of [-1, 1]) { tcEll(x, hx + f * 4 + s * 10, hy - 6, 5, 6 * Math.max(0.15, st.blink), '#fff', 1.6); if (st.blink > 0.3) tcEll(x, hx + f * 6 + s * 10, hy - 5, 2.6, 3.4, TC_INK); }
  }
  x.restore();
}

// ---------- built-in backgrounds (Flow ke bina, free) ----------
const TC_BG_KEYS = [['classroom', /\b(class ?room|school|teacher|exam|lesson)\b|स्कूल|कक्षा/i], ['room', /\b(home|house|room|kitchen|bedroom|living room|ghar|indoor|inside)\b|घर|કમરો|ઘર/i],
  ['market', /\b(market|bazaar|bazar|shop|store|mandi|stall)\b|बाज़ार|दुकान/i], ['village', /\b(village|gaon|farm|field|well|hut|cottage)\b|गाँव|खेत|ગામ/i], ['forest', /\b(forest|jungle|woods|tree|river|lake)\b|जंगल/i],
  ['beach', /\b(beach|sea|ocean|shore|coast)\b|समुद्र/i], ['city', /\b(city|street|road|town|traffic|building|office)\b|शहर|सड़क/i], ['park', /\b(park|garden|playground|ground)\b|बगीचा|पार्क/i]];
function tcBgKind(s) { // pehle jagah (place), phir picture ka text, aakhir mein line
  const pl = `${s.place || ''} ${(news && news.bible && news.bible.places && (news.bible.places.find((p) => p.name === s.place) || {}).look) || ''}`;
  for (const t of [pl, oneLine(s.imageCore || s.image || '').split(/ Characters \(keep| Style: /)[0], s.dialogue || '']) for (const [k, re] of TC_BG_KEYS) if (re.test(t)) return k;
  return 'park';
}
const tcNight = (s) => /\b(night|midnight|dark|moon|stars|raat)\b|रात|રાત/i.test(`${s.imageCore || s.image || ''} ${s.dialogue || ''}`);
function tcSky(x, W, H, top, bot, gy) { const g = x.createLinearGradient(0, 0, 0, gy); g.addColorStop(0, top); g.addColorStop(1, bot); x.fillStyle = g; x.fillRect(0, 0, W, gy); }
function tcTree(x, X, Y, s, leaf = '#4caf50') { tcRRect(x, X - 9 * s, Y - 70 * s, 18 * s, 70 * s, 4 * s, '#79553d', 3); for (const [dx, dy, r] of [[0, -112, 46], [-32, -84, 34], [32, -84, 34]]) tcEll(x, X + dx * s, Y + dy * s, r * s, r * s, leaf, 3); tcEll(x, X - 14 * s, Y - 128 * s, 14 * s, 9 * s, tcShade(leaf, 1.25)); }
function tcHouse(x, X, Y, s, wall = '#f0c896', roof = '#c8463c') { tcRRect(x, X, Y - 130 * s, 170 * s, 130 * s, 2, wall, 3.5); tcPoly(x, [[X - 18 * s, Y - 126 * s], [X + 85 * s, Y - 200 * s], [X + 188 * s, Y - 126 * s]], roof, 3.5); tcRRect(x, X + 66 * s, Y - 70 * s, 38 * s, 70 * s, 3, '#82502f', 3); for (const dx of [18, 120]) tcRRect(x, X + dx * s, Y - 104 * s, 34 * s, 32 * s, 3, '#aadcff', 3); }
function tcCloud(x, X, Y, s, c = '#fff') { for (const [dx, dy, r] of [[0, 0, 32], [34, -14, 38], [70, 0, 30], [35, 10, 30]]) tcEll(x, X + dx * s, Y + dy * s, r * s, r * s * 0.85, c); }
function tcDrawBuiltinBg(x, W, H, kind, night, gy) {
  const s = H / 720, rnd = (() => { let a = tcHash(kind) || 1; return () => ((a = Math.imul(a ^ (a >>> 15), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909)) >>> 0) / 4294967296; })();
  const skyT = night ? '#141a46' : '#79c4ff', skyB = night ? '#3a3c7a' : '#cdeeff';
  if (kind === 'room' || kind === 'classroom') {
    x.fillStyle = kind === 'room' ? '#f6dcb8' : '#e7efd9'; x.fillRect(0, 0, W, gy);
    x.fillStyle = kind === 'room' ? '#f0d0a6' : '#dbe6c9'; for (let X = 0; X < W; X += 80 * s) x.fillRect(X, 0, 40 * s, gy);
    x.fillStyle = kind === 'room' ? '#a8714a' : '#b98a5e'; x.fillRect(0, gy, W, H - gy); x.strokeStyle = 'rgba(0,0,0,0.12)'; x.lineWidth = 3 * s; for (let Y = gy + 30 * s; Y < H; Y += 34 * s) { x.beginPath(); x.moveTo(0, Y); x.lineTo(W, Y); x.stroke(); }
    x.fillStyle = 'rgba(0,0,0,0.08)'; x.fillRect(0, gy - 14 * s, W, 14 * s);
    if (kind === 'classroom') { tcRRect(x, W * 0.22, gy * 0.18, W * 0.56, gy * 0.42, 6, '#2f5d3a', 8 * s); x.fillStyle = '#ffffffcc'; x.font = `bold ${36 * s}px sans-serif`; x.textAlign = 'center'; x.fillText('A B C   1 2 3', W * 0.5, gy * 0.42); x.textAlign = 'left'; tcEll(x, W * 0.88, gy * 0.25, 34 * s, 34 * s, '#fff', 4 * s); x.strokeStyle = TC_INK; x.lineWidth = 3 * s; x.beginPath(); x.moveTo(W * 0.88, gy * 0.25); x.lineTo(W * 0.88, gy * 0.25 - 22 * s); x.moveTo(W * 0.88, gy * 0.25); x.lineTo(W * 0.88 + 16 * s, gy * 0.25); x.stroke(); }
    else {
      const wx = W * 0.66, wy = gy * 0.16, ww = W * 0.22, wh = gy * 0.42; tcSky(x, W, H, skyT, skyB, 0); x.save(); x.beginPath(); x.rect(wx, wy, ww, wh); x.clip(); const g = x.createLinearGradient(0, wy, 0, wy + wh); g.addColorStop(0, skyT); g.addColorStop(1, skyB); x.fillStyle = g; x.fillRect(wx, wy, ww, wh); if (night) tcEll(x, wx + ww * 0.7, wy + wh * 0.3, 18 * s, 18 * s, '#faf5d2'); else tcCloud(x, wx + 20 * s, wy + wh * 0.4, 0.6 * s); x.restore();
      tcRRect(x, wx, wy, ww, wh, 3, null, 8 * s); x.strokeStyle = TC_INK; x.lineWidth = 6 * s; x.beginPath(); x.moveTo(wx + ww / 2, wy); x.lineTo(wx + ww / 2, wy + wh); x.moveTo(wx, wy + wh / 2); x.lineTo(wx + ww, wy + wh / 2); x.stroke();
      tcRRect(x, W * 0.08, gy * 0.24, W * 0.14, gy * 0.3, 4, '#fff', 5 * s); tcEll(x, W * 0.15, gy * 0.39, 26 * s, 26 * s, '#ff9a50');
      tcRRect(x, W * 0.04, gy - 120 * s, W * 0.2, 24 * s, 6, '#9c6b45', 3); tcRRect(x, W * 0.06, gy - 96 * s, 12 * s, 96 * s, 3, '#875a39', 3); tcRRect(x, W * 0.22 - 12 * s, gy - 96 * s, 12 * s, 96 * s, 3, '#875a39', 3); tcEll(x, W * 0.14, gy - 136 * s, 22 * s, 16 * s, '#e57373', 3);
    }
    if (night) { x.fillStyle = 'rgba(20,20,60,0.25)'; x.fillRect(0, 0, W, H); }
    return;
  }
  tcSky(x, W, H, kind === 'beach' && !night ? '#56c3ff' : skyT, skyB, gy);
  if (night) { for (let i = 0; i < 70; i++) tcEll(x, rnd() * W, rnd() * gy * 0.7, 1.5 * s, 1.5 * s, '#fffde0'); tcEll(x, W * 0.82, H * 0.16, 40 * s, 40 * s, '#faf5d2'); tcEll(x, W * 0.82 + 14 * s, H * 0.16 - 10 * s, 36 * s, 36 * s, skyT); }
  else tcEll(x, W * 0.86, H * 0.15, 48 * s, 48 * s, '#ffdc57');
  const hill = (base, amp, col, seed) => { x.beginPath(); x.moveTo(0, H); for (let X = 0; X <= W + 20; X += 20) x.lineTo(X, base + amp * (0.6 * Math.sin(X / (210 * s) + seed) + 0.3 * Math.sin(X / (97 * s) + seed * 2))); x.lineTo(W, H); x.closePath(); x.fillStyle = col; x.fill(); };
  const gcol = night ? '#2f5246' : kind === 'beach' ? '#f3d9a0' : kind === 'city' || kind === 'market' ? '#b0a89a' : '#7cc85a';
  if (kind === 'beach') { x.fillStyle = night ? '#1d3f6e' : '#2aa3dc'; x.fillRect(0, gy * 0.72, W, gy * 0.28); x.strokeStyle = 'rgba(255,255,255,0.7)'; x.lineWidth = 3 * s; for (let i = 0; i < 18; i++) { x.beginPath(); x.arc(rnd() * W, gy * (0.76 + rnd() * 0.2), 22 * s, Math.PI * 1.15, Math.PI * 1.85); x.stroke(); } }
  else if (kind === 'city' || kind === 'market') { for (let i = 0; i < 9; i++) { const bw = (90 + rnd() * 70) * s, bh = (140 + rnd() * 220) * s, bx = i * W / 8 - 20 * s; const bc = night ? '#2c3156' : ['#90a4ae', '#b0bec5', '#a1887f', '#9fa8da'][i % 4]; tcRRect(x, bx, gy - bh, bw, bh, 2, bc, 3); x.fillStyle = night ? '#ffe082' : '#e3f2fd'; for (let wy = gy - bh + 14 * s; wy < gy - 30 * s; wy += 32 * s) for (let wx = bx + 12 * s; wx < bx + bw - 20 * s; wx += 28 * s) if (rnd() > 0.25) x.fillRect(wx, wy, 14 * s, 18 * s); } }
  else { hill(gy * 0.78, 34 * s, night ? '#2b3a62' : '#9fd68a', 1); hill(gy * 0.9, 24 * s, night ? '#284a45' : '#71c15f', 2); }
  x.fillStyle = gcol; x.fillRect(0, gy, W, H - gy);
  if (kind === 'city' || kind === 'market') { x.fillStyle = night ? '#3c3f4a' : '#8d8d8d'; x.fillRect(0, gy + 10 * s, W, 14 * s); }
  if (kind === 'market') { const cols = ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#fb8c00']; for (let i = 0; i < 4; i++) { const bx = W * (0.04 + i * 0.25), by = gy - 10 * s; tcRRect(x, bx, by - 70 * s, W * 0.18, 70 * s, 3, '#a1673d', 3); for (let j = 0; j < 6; j++) tcPoly(x, [[bx + j * W * 0.03, by - 110 * s], [bx + (j + 1) * W * 0.03, by - 110 * s], [bx + (j + 0.5) * W * 0.03, by - 80 * s]], cols[(i + j) % cols.length], 2); x.fillStyle = cols[i]; for (let j = 0; j < 6; j++) tcEll(x, bx + 16 * s + j * 22 * s, by - 76 * s, 9 * s, 9 * s, cols[(i * 2 + j) % cols.length], 2); } }
  if (kind === 'village') { tcHouse(x, W * 0.62, gy, 1.0 * s, '#e8c39e', '#a0522d'); tcPoly(x, [[W * 0.1, gy], [W * 0.18, gy - 120 * s], [W * 0.26, gy]], '#c8a165', 3); tcRRect(x, W * 0.15, gy - 55 * s, 26 * s, 55 * s, 3, '#7a5230', 3); for (const X of [W * 0.04, W * 0.9]) tcTree(x, X, gy, 1.1 * s, night ? '#2e6b4f' : '#4caf50'); }
  if (kind === 'park') { tcHouse(x, W * 0.62, gy - 4 * s, 0.9 * s); for (const [X, sc] of [[W * 0.08, 1], [W * 0.24, 0.75], [W * 0.92, 0.95]]) tcTree(x, X, gy, sc * s, night ? '#2e6b4f' : '#4caf50'); for (let i = 0; i < 40; i++) tcEll(x, rnd() * W, gy + 20 * s + rnd() * (H - gy - 26 * s), 3.5 * s, 3.5 * s, ['#ff7896', '#ffe65a', '#ffffff'][i % 3]); }
  if (kind === 'forest') { for (let i = 0; i < 9; i++) tcTree(x, (i + 0.3 * rnd()) * W / 8, gy + (rnd() * 10) * s, (1.1 + rnd() * 0.6) * s, night ? ['#1f5e47', '#2e6b4f'][i % 2] : ['#388e3c', '#43a047', '#2e7d32'][i % 3]); }
  if (kind === 'beach') { tcLimb(x, [[W * 0.88, gy + 10 * s], [W * 0.87, gy - 90 * s], [W * 0.89, gy - 200 * s]], 22 * s, '#96693c', 3); for (const a of [-150, -110, -60, -20, 20]) { const r = a * Math.PI / 180, px = W * 0.89, py = gy - 200 * s; tcLimb(x, [[px, py], [px + 60 * s * Math.cos(r), py + 45 * s * Math.sin(r) + 10 * s], [px + 120 * s * Math.cos(r), py + 70 * s * Math.sin(r) + 40 * s]], 14 * s, '#3caa50', 3); } }
  if (!night && kind !== 'forest') for (let i = 0; i < 3; i++) tcCloud(x, W * (0.1 + i * 0.3), H * (0.1 + 0.05 * i), (0.7 + 0.3 * rnd()) * s);
}
const TC_BG_CACHE = new Map();
function tcBuiltinBg(kind, night, W, H, gy) {
  const key = `${kind}:${night}:${W}x${H}:${gy | 0}`;
  if (!TC_BG_CACHE.has(key)) { if (TC_BG_CACHE.size > 12) TC_BG_CACHE.clear(); const c = new OffscreenCanvas(W, H); tcDrawBuiltinBg(c.getContext('2d'), W, H, kind, night, gy); TC_BG_CACHE.set(key, c); }
  return TC_BG_CACHE.get(key);
}

// ---------- line se apne aap action / emotion (koi Gemini request nahi) ----------
const TC_ACT_WORDS = [['namaste', /\b(namaste|namaskar|pranam|ram ram)\b|नमस्ते|प्रणाम|નમસ્તે/i], ['dance', /\b(danc\w*|naach\w*|naach)\b|नाच|નાચ/i], ['run_across', /\b(run|ran|running|daud\w*|bhaag\w*|chase|rush\w*)\b|दौड़|भाग|દોડ/i], ['jump', /\b(jump\w*|kood\w*|hop\w*|leap\w*)\b|कूद|ઉછળ/i],
  ['wave', /\b(hello|hi|namaste|bye|goodbye|wave\w*|alvida|salaam)\b|नमस्ते|अलविदा|નમસ્તે/i], ['cry', /\b(cry|cried|crying|tears|weep\w*|ro (pad|rah)\w*|rone)\b|रो(ने|या|ई| पड़)|આંસુ/i], ['laugh', /\b(laugh\w*|giggl\w*|haha|hans\w*|has pad\w*)\b|हँस|हंस|હસ/i],
  ['sleep', /\b(sleep\w*|slept|asleep|so ga\w*|neend)\b|सो (गया|गई)|नींद/i], ['think', /\b(think\w*|wonder\w*|idea|soch\w*|plan\w*)\b|सोच|વિચાર/i], ['point', /\b(look there|see that|over there|dekho|wahan)\b|देखो|वहाँ/i],
  ['scared', /\b(scared|afraid|fear|frighten\w*|dar (gay|lag)\w*|ghost|bhoot)\b|डर|ડર/i], ['sit', /\b(sit|sat|sitting|baith\w*)\b|बैठ|બેઠ/i], ['walk_across', /\b(walk\w*|went|going|chal\w*|ja rah\w*|stroll\w*)\b|चल|जा रह|ચાલ/i]];
const TC_EMO_WORDS = [['angry', /\b(angry|anger|furious|shout\w*|gussa|scold\w*|yell\w*)\b|गुस्स|ગુસ્સ/i], ['sad', /\b(sad|sorrow|unhappy|lonely|dukh\w*|udaas|upset|miss\w*)\b|दुख|उदास|દુઃખ/i],
  ['surprised', /\b(wow|surprise\w*|shock\w*|suddenly|arre|achanak|what\?!)\b|अचानक|अरे|અરે/i], ['scared', /\b(scared|afraid|fear|dar)\b|डर/i]];
function tcAutoAct(s) {
  const t = `${s.dialogue || ''} ${s.imageCore || ''}`;
  let act = 'none', emo = 'happy';
  for (const [k, re] of TC_ACT_WORDS) if (re.test(t)) { act = k; break; }
  for (const [k, re] of TC_EMO_WORDS) if (re.test(s.dialogue || '')) { emo = k; break; }
  if (act === 'cry') emo = 'sad'; if (act === 'scared') emo = 'scared';
  return { act, emo };
}
function tcSpeakerOf(s) { if (typeof kvSpeaker === 'function') { try { return kvSpeaker(s); } catch (e) {} } return s.speaker && !/^narrator$/i.test(s.speaker) ? s.speaker : ''; }
function tcSame(a, b) { if (!a || !b) return false; if (String(a).toLowerCase() === String(b).toLowerCase()) return true; try { return typeof klSame === 'function' && news.bible && klSame(a, news.bible.characters.find((x) => x.name === b)); } catch (e) { return false; } }

// ---------- plan: har scene mein kaun, kahan, kya ----------
function tcPlan(scenes, cast) {
  const names = Object.keys(cast), order = new Map();
  scenes.forEach((s) => (s.chars || []).forEach((n) => { const k = names.find((x) => tcSame(n, x)); if (k && !order.has(k)) order.set(k, order.size); }));
  names.forEach((n) => { if (!order.has(n)) order.set(n, order.size); });
  const G = (news && news.tcPlan) || {}; let prev = [];
  return scenes.map((s, i) => {
    const sp = tcSpeakerOf(s), spk = sp ? names.find((n) => tcSame(sp, n)) : null;
    let who = [...new Set((s.chars || []).map((n) => names.find((x) => tcSame(n, x))).filter(Boolean))];
    if (spk && !who.includes(spk)) who.push(spk);
    who.sort((a, b) => order.get(a) - order.get(b)); who = who.slice(0, 5);
    const g = G[s.n] || {}, auto = TCS.tcAuto !== 'off' ? tcAutoAct(s) : { act: 'none', emo: 'happy' };
    const out = who.map((n, k) => {
      const gc = (g.cast || []).find((c) => tcSame(c.name, n)) || {};
      const isSp = n === spk, act = gc.do || (isSp || who.length === 1 ? auto.act : (auto.act === 'dance' || auto.act === 'scared' || auto.act === 'laugh' ? auto.act : 'none'));
      return { name: n, slot: (k + 0.5) / who.length, speaker: isSp, enter: gc.enter || (prev.includes(n) || i === 0 && k > 0 ? 'none' : 'auto'), exit: gc.exit || 'none', act, emo: gc.emotion || (isSp ? auto.emo : (auto.emo === 'scared' || auto.emo === 'sad' ? auto.emo : 'happy')) };
    });
    prev = who;
    return { n: s.n, cast: out, spk };
  });
}

// ---------- voice se lip-sync (50 baar / second) ----------
function tcEnvelope(c) {
  if (!c || !c.f) return { env: new Float32Array(1), hz: 50 };
  const hz = 50, step = Math.max(1, Math.round(c.rate / hz)), n = Math.ceil(c.f.length / step), env = new Float32Array(n); let mx = 1e-4;
  for (let i = 0; i < n; i++) { let s = 0; const a = i * step, b = Math.min(c.f.length, a + step); for (let j = a; j < b; j++) s += c.f[j] * c.f[j]; env[i] = Math.sqrt(s / Math.max(1, b - a)); if (env[i] > mx) mx = env[i]; }
  const sorted = Array.from(env).sort((p, q) => p - q), ref = Math.max(1e-4, sorted[Math.floor(n * 0.92)] || mx);
  for (let i = 0; i < n; i++) env[i] = tcClamp((env[i] / ref - 0.12) * 1.25);
  return { env, hz };
}

// ---------- video.js se: tayaari + har frame ----------
function tcOn() { return TCS.tcMode === '2d'; }
function tcNoImgOk() { return tcOn(); } // Flow picture na ho toh built-in drawing (video kabhi na ruke)
function tcPrepare(scenes, T, clips, sc, o = {}) {
  if (!tcOn() || !scenes || !scenes.length) return null;
  const cast = tcCast(), plan = tcPlan(scenes, cast);
  const envs = clips.map((c) => tcEnvelope(c));
  const W = o.W, H = o.H, gy = H * (Number(TCS.tcGround) || 88) / 100, size = { s: 0.4, m: 0.48, l: 0.58 }[TCS.tcSize] || 0.48;
  const k = (H * size) / 246;
  const animals = Object.values(cast).filter((c) => c.animal).map((c) => c.name);
  if (!o.inner) addLog(`🧸 Cartoon 2D: ${Object.keys(cast).length} character(s)${animals.length ? ` (animals: ${animals.join(', ')})` : ''} · background: ${TCS.tcBg === 'builtin' ? 'built-in drawings (free)' : 'Flow pictures'} · lip-sync from the voice`, 'info');
  const sig = tcHash(JSON.stringify([TCS, cast, plan.map((p) => p.cast), W, H]));
  return { scenes, T, clips, sc, plan, cast, envs, W, H, gy, k, canv: new Map(), bg: new Map(), sig, inner: !!o.inner, on: (i) => !!plan[i] };
}
function tcStateOf(TC, i, pc, lt, endL, W) {
  const sp = TC.cast[pc.name], t = TC.T[i] + lt, seed = (tcHash(pc.name) % 997) / 997;
  const k = TC.k * (sp.animal ? 0.9 : 1), Hc = 246 * k, n = TC.plan[i].cast.length;
  const spread = Math.min(0.78, 0.22 * n + 0.14), x0 = W * (0.5 + (pc.slot - 0.5) * spread);
  const st = { x: x0, y: TC.gy, f: 1, t, seed, blink: 1, walk: 0, ph: 0, emo: pc.emo, look: 0, mouth: 0, talkA: 0, talkG: 0 };
  // kis taraf dekhe: bolne wale ki taraf / bolne wala sabse paas wale ki taraf
  const others = TC.plan[i].cast.filter((c) => c.name !== pc.name);
  const spk = TC.plan[i].cast.find((c) => c.speaker && c.name !== pc.name);
  const target = pc.speaker ? others.reduce((b, c) => (!b || Math.abs(c.slot - pc.slot) < Math.abs(b.slot - pc.slot) ? c : b), null) : spk || null;
  st.f = target ? (target.slot > pc.slot ? 1 : -1) : pc.slot <= 0.5 ? 1 : -1;
  if (n === 1 && !target) st.f = pc.slot < 0.5 ? 1 : -1;
  const speed = Hc * (pc.act === 'run_across' ? 2.6 : 1.15), stride = Hc * (pc.act === 'run_across' ? 0.62 : 0.42);
  const moveSeg = (xa, xb, t0, t1, run) => { if (lt < t0) return false; const p = tcClamp((lt - t0) / Math.max(0.01, t1 - t0)); st.x = xa + (xb - xa) * p; if (lt < t1) { st.walk = 1; st.run = run; st.ph = ((lt - t0) * Math.abs(xb - xa) / Math.max(0.01, t1 - t0)) / stride * Math.PI; st.f = xb > xa ? 1 : -1; } return true; };
  // andar aana
  let enterEnd = 0;
  if (pc.enter !== 'none' && !/^(sit|sit_floor|sleep)$/.test(pc.act)) { // baitha / soya hua character pehle se wahan hota hai
    const side = pc.enter === 'left' ? -1 : pc.enter === 'right' ? 1 : x0 < W / 2 ? -1 : 1, xs = side < 0 ? -Hc * 0.6 : W + Hc * 0.6;
    const d = Math.min(2.4, Math.max(0.8, Math.abs(x0 - xs) / speed)); enterEnd = d;
    if (lt < d) { st.x = xs; moveSeg(xs, x0, 0, d, false); if (lt < 0) { st.x = xs; st.walk = 0; } }
  }
  // poori line ka action
  const a = pc.act, mid = Math.max(enterEnd, 0);
  if (a === 'walk_across' || a === 'run_across') {
    const d = Math.min(endL - mid - 0.2, a === 'run_across' ? W * 0.5 / speed : W * 0.35 / speed);
    if (d > 0.5 && lt >= mid) { const dir = st.f, xb = Math.max(Hc * 0.5, Math.min(W - Hc * 0.5, x0 + dir * speed * d)); moveSeg(x0, xb, mid, mid + d, a === 'run_across'); if (lt >= mid + d) st.x = xb; }
  }
  if (a === 'jump' && lt > mid) { const p = ((lt - mid) % 0.7) / 0.7, cnt = Math.floor((lt - mid) / 0.7); if (cnt < 3) st.jump = Math.sin(p * Math.PI) * Hc * 0.28; }
  if (a === 'namaste' && lt > mid) { if (TCS.tcStyle === 'hd') st.namaste = 1; else st.wave = tcClamp(Math.min((lt - mid) * 4, (mid + 2.2 - lt) * 4)); }
  if (a === 'wave' && lt > mid) st.wave = tcClamp(Math.min((lt - mid) * 4, (mid + 2.2 - lt) * 4));
  if (a === 'dance' && lt > mid) { st.dance = 1; st.dph = (lt - mid) * Math.PI * 2 * 1.9; }
  if (a === 'sit') st.sit = lt > mid ? tcClamp((lt - mid) * 3) : 0;
  if (a === 'think' && lt > mid) st.think = 1;
  if (a === 'point' && lt > mid && lt < mid + 2.5) st.point = 1;
  if (a === 'cry' && lt > mid) st.cry = 1;
  if (a === 'laugh' && lt > mid) st.laugh = 1;
  if (a === 'sleep' && lt > mid) st.sleep = 1;
  if (a === 'scared' && lt > mid) st.scared = 1;
  // bahar jaana
  if (pc.exit !== 'none') { const side = pc.exit === 'left' ? -1 : 1, xe = side < 0 ? -Hc * 0.7 : W + Hc * 0.7, d = Math.min(2.2, Math.max(0.8, Math.abs(xe - st.x) / speed)), t0 = endL - d; if (lt > t0) { const xs = st.x; moveSeg(xs, xe, t0, endL, false); } }
  // chalna khatam → jisse baat ho rahi hai uski taraf mudo (asli jagah ke hisaab se)
  if (!st.walk && target) { const tx = W * (0.5 + (target.slot - 0.5) * spread); if (Math.abs(tx - st.x) > Hc * 0.15) st.f = tx > st.x ? 1 : -1; }
  // bolna + palak
  st.blink = st.sleep ? 0 : S_blink(t, seed);
  if (pc.speaker && lt >= 0 && lt < TC.clips[i].dur) { const E = TC.envs[i], j = Math.floor(lt * E.hz); const v = E.env[Math.min(E.env.length - 1, j)] || 0, v2 = E.env[Math.min(E.env.length - 1, j + 1)] || 0; st.mouth = tcClamp((v + v2) / 2 * 1.1); st.talkA = st.mouth; st.talkG = st.walk || st.wave || st.dance || st.think || st.cry ? 0 : tcClamp(Math.min(lt * 2, (TC.clips[i].dur - lt) * 2)) * 0.8; }
  else if (!pc.speaker && spk) st.look = 1;
  return st;
}
function S_blink(t, seed) { const period = 3.1 + seed, p = (t + seed * 1.7) % period; return p < 0.12 ? Math.abs(p - 0.06) / 0.06 : 1; }
async function tcFrame(TC, i, tq, getBg) {
  if (TCS.tcStyle === 'hd' && typeof tcFrameHD === 'function') return tcFrameHD(TC, i, tq, getBg); // 🏡 HD village look
  const W = TC.W, H = TC.H;
  let c = TC.canv.get(i); if (!c) { c = new OffscreenCanvas(W, H); TC.canv.set(i, c); for (const key of TC.canv.keys()) if (key < i - 2) TC.canv.delete(key); }
  const x = c.getContext('2d'), s = TC.scenes[i], sc = TC.sc[i];
  // background
  let bg = TC.bg.get(i);
  if (bg === undefined) {
    bg = null;
    if (TCS.tcBg !== 'builtin') { try { bg = await getBg(); } catch (e) { bg = null; } }
    if (!bg) { bg = tcBuiltinBg(tcBgKind(s), tcNight(s), W, H, TC.gy); if (TCS.tcBg !== 'builtin' && !TC.inner) { TC.noPic = (TC.noPic || 0) + 1; addLog(`🧸 Scene #${s.n}: no Flow picture — using a built-in ${tcBgKind(s)} drawing`, 'info'); } }
    TC.bg.set(i, bg); for (const key of TC.bg.keys()) if (key < i - 2) TC.bg.delete(key);
  }
  const p = tcClamp((tq - sc.vs) / Math.max(0.01, sc.ve - sc.vs)), zoom = TCS.tcCam === 'still' ? 1 : 1 + 0.035 * tcEase(p);
  x.save(); x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
  x.translate(W / 2, H * 0.62); x.scale(zoom, zoom); x.translate(-W / 2, -H * 0.62);
  const cover = Math.max(W / bg.width, H / bg.height); x.imageSmoothingQuality = 'high';
  x.drawImage(bg, (W - bg.width * cover) / 2, (H - bg.height * cover) / 2, bg.width * cover, bg.height * cover);
  const lt = tq - TC.T[i], endL = sc.ve - TC.T[i];
  const sts = TC.plan[i].cast.map((pc) => ({ pc, st: tcStateOf(TC, i, pc, lt, endL, W) }));
  sts.sort((a, b) => (a.pc.speaker ? 1 : 0) - (b.pc.speaker ? 1 : 0));
  for (const { pc, st } of sts) { try { tcDrawChar(x, TC.cast[pc.name], st, TC.k * (TC.cast[pc.name].scale || 1)); } catch (e) { if (!TC.warned) { TC.warned = 1; addLog('🧸 Cartoon: ' + e.message, 'warn'); } } }
  x.restore();
  return c;
}

// ---------- Flow prompt: sirf KHAALI background, cartoon style ----------
function tcBgPrompt(s, B) {
  const core = oneLine(s.imageCore || s.image || '').split(/ Characters \(keep exactly this look\):| Setting: | Style: /)[0];
  const pl = B && B.places && (B.places.find((p) => p.name.toLowerCase() === String(s.place || '').toLowerCase()) || (!s.place ? B.places.find((p) => new RegExp(`\\b${reEsc(p.name)}\\b`, 'i').test(core)) : null));
  const when = (`${core} ${s.dialogue || ''}`.match(/\b(night|midnight|evening|sunset|sunrise|morning|rain\w*|snow\w*|storm\w*)\b/i) || [])[1];
  const names = ((B && B.characters) || []).map((c) => c.name).filter(Boolean);
  let place = pl ? `${pl.name} — ${pl.look}` : core;
  for (const n of names) place = place.replace(new RegExp(`\\b${reEsc(n)}\\b`, 'gi'), 'someone');
  return oneLine(`Empty background for an animated 2D cartoon (the characters are added later, so leave them out). The place: ${place}. Draw ONLY the place: no people, no characters, no animals, no faces, no hands, no text, no letters. ${when ? `Time / weather: ${when}. ` : ''}Wide shot at eye level, straight-on camera, open flat ground across the bottom quarter of the picture where characters can stand, nothing blocking the bottom middle. ${TCS.tcStyle === 'hd' ? 'Style: rich, detailed 2D cartoon background illustration like Indian animated story videos — clean vector art with soft gradient shading, textured mud / brick walls, clay tile or thatched roofs, big leafy trees made of many layered leaf clusters, grass strips with blades, warm natural colours, a clear foreground, middle ground and far background for depth, 16:9.' : "Style: 2D cartoon background art, flat colours, clean bold dark outlines, simple soft cel shading, bright cheerful palette, children's animated TV show look, 16:9."}`);
}
(function tcPromptHook() {
  const _bc = window.bibleCompose;
  if (typeof _bc === 'function') window.bibleCompose = (s, B, ...a) => (tcOn() && TCS.tcBg === 'flow' ? tcBgPrompt(s, B) : _bc(s, B, ...a));
})();
// 💬 comic mode bubbles Flow picture ke chehron par lagte hain — cartoon mein chehre chalte hain, isliye us waqt comic band (subtitles waise hi)
(function tcComicHook() {
  const _cp = window.cmPrepare;
  if (typeof _cp === 'function') window.cmPrepare = async (...a) => { if (tcOn()) { const o = a[4] || {}; if (!o.inner) addLog('🧸 Cartoon 2D is on: 💬 Comic mode bubbles are skipped (subtitles stay)', 'info'); return null; } return _cp(...a); };
})();
async function tcRewritePrompts() {
  if (!news || !news.scenes) return addLog('🧸 Open a project first', 'warn');
  if (!tcOn() || TCS.tcBg !== 'flow') return addLog('🧸 Turn on Cartoon 2D with "Flow background" first', 'warn');
  if (news.bible && typeof bibleApplyAll === 'function') bibleApplyAll(news.scenes, news.bible);
  else for (const s of news.scenes) { if (!s.imageCore && s.image) s.imageCore = s.image; s.image = tcBgPrompt(s, null); }
  projectSave(); if (typeof renderScenes === 'function') renderScenes();
  addLog(`🧸 ${news.scenes.length} picture prompt(s) now ask Flow for EMPTY 2D cartoon backgrounds (no people). Make the pictures again in the Images tab. Tip: turn off "Flow reference" (character sheets) for these backgrounds.`, 'success');
}

// ---------- ✨ Gemini se actions (1 request, project mein save) ----------
async function tcPlanGemini() {
  if (!news || !news.scenes || !news.scenes.length) return addLog('🧸 Open a project first', 'warn');
  const cast = tcCast(), names = Object.keys(cast);
  if (!names.length) return addLog('🧸 No characters in the visual bible yet — "Write script" makes it', 'warn');
  const lines = news.scenes.map((s) => `${s.n}. [visible: ${(s.chars || []).join(', ') || '-'}] [speaker: ${tcSpeakerOf(s) || 'narrator'}] ${oneLine(s.dialogue || '').slice(0, 220)}`).join('\n').slice(0, 14000);
  tcz('tcInfo').textContent = '✨ Asking Gemini (1 request)...';
  const j = await llm('Cartoon actions', `You are the animation director of a 2D cartoon. Each numbered line is one shot. For every VISIBLE character decide simple, natural actions.
Characters: ${names.join(', ')}.
Allowed "do": none, walk_across, run_across, wave, jump, dance, sit, cry, laugh, think, point, sleep, scared.
Allowed "enter" / "exit": left, right, none. Allowed "emotion": happy, neutral, sad, angry, surprised, scared.
Rules: most shots are "none" (just standing and talking). Enter only when a character first arrives at a place; exit only when they leave. Match the words of the line (greeting → wave, running → run_across, crying → cry …). Keep the same character's emotion steady unless the story changes it.
LINES:
${lines}
Return ONLY JSON: {"scenes": [{"n": 1, "cast": [{"name": "", "enter": "none", "do": "none", "emotion": "happy", "exit": "none"}]}]}`, { json: true, temperature: 0.4 });
  const p = parseJSON(j.text) || {}, out = {};
  for (const s of p.scenes || []) if (s && s.n != null) out[s.n] = { cast: (s.cast || []).filter((c) => c && c.name).map((c) => ({ name: oneLine(c.name), enter: /^(left|right|none)$/.test(c.enter) ? c.enter : 'none', exit: /^(left|right|none)$/.test(c.exit) ? c.exit : 'none', do: String(c.do || 'none'), emotion: String(c.emotion || 'happy') })) };
  news.tcPlan = out; projectSave();
  tcz('tcInfo').textContent = `✨ Actions planned for ${Object.keys(out).length} shot(s) — saved in the project (re-renders are free).`;
  addLog(`🧸 Cartoon actions: ${Object.keys(out).length} shot(s) planned by Gemini (1 request)`, 'success');
}

// ---------- UI: settings + 🎭 Cast box (desh, umar, baal, kapde — badlo) ----------
let TC_PREV_RAF = 0;
function tcOpts(obj, cur) { return Object.entries(obj).map(([k, v]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${typeof v === 'string' ? v : v.label || v.lab}</option>`).join(''); }
function tcCastPaint() {
  const box = tcz('tcCast'); if (!box) return;
  const cast = tcCast(), names = Object.keys(cast);
  if (!names.length) { box.innerHTML = '<p class="muted small">Characters come from the visual bible after "Write script". You can also add one by hand below.</p>'; tcPreviewLoop(); return; }
  box.innerHTML = names.map((n, i) => { const c = cast[n]; return `<div class="tcRow" data-n="${encodeURIComponent(n)}" style="border:1px solid #8883;border-radius:8px;padding:6px;margin:4px 0">
    <div class="row wrap"><b style="min-width:90px">${n.replace(/</g, '&lt;')}</b>
    <select data-k="region">${tcOpts(TC_REGIONS, c.region)}</select>
    <select data-k="gender"><option value="m"${c.gender === 'm' ? ' selected' : ''}>♂ Male</option><option value="f"${c.gender === 'f' ? ' selected' : ''}>♀ Female</option></select>
    <select data-k="age">${tcOpts(TC_AGES, c.age)}</select>
    <select data-k="animal"><option value="">🧍 Human</option>${Object.keys(TC_ANIMAL).concat(['crow', 'parrot', 'owl', 'duck', 'hen'], typeof HD_ANIMAL !== 'undefined' ? Object.keys(HD_ANIMAL).filter((a) => !TC_ANIMAL[a]) : []).map((a) => `<option value="${a}"${a === c.animal ? ' selected' : ''}>🐾 ${a}</option>`).join('')}</select></div>
    <div class="row wrap small">Skin <input data-k="skin" type="color" value="${c.skin}"> Hair <select data-k="hair">${tcOpts(TC_HAIR, c.hair)}</select><input data-k="hairColor" type="color" value="${c.hairColor}">
    Clothes <select data-k="outfit">${tcOpts(TC_OUTFITS, c.outfit)}</select><input data-k="top" type="color" value="${/^#/.test(c.top) ? c.top : '#1e88e5'}" title="Top / saree / dress colour"><input data-k="bottom" type="color" value="${/^#/.test(c.bottom) ? c.bottom : '#37474f'}" title="Pants / skirt / blouse colour"></div>
    ${typeof HD_OUTFITS !== 'undefined' ? `<div class="row wrap small">🏡 HD clothes <select data-k="hdOutfit"><option value="">Auto</option>${Object.entries(HD_OUTFITS).map(([k, v]) => `<option value="${k}"${k === c.hdOutfit ? ' selected' : ''}>${v.lab}</option>`).join('')}</select> Print <select data-k="pattern"><option value="">Auto</option>${['plain', 'checks', 'dots', 'stripes'].map((v) => `<option${v === c.pattern ? ' selected' : ''}>${v}</option>`).join('')}</select> Saree / lehenga border <input data-k="border" type="color" value="${/^#/.test(c.border || '') ? c.border : '#b71c1c'}"> In hand <select data-k="prop"><option value="">Nothing</option><option value="glass"${c.prop === 'glass' ? ' selected' : ''}>🥛 Glass</option><option value="stick"${c.prop === 'stick' ? ' selected' : ''}>🦯 Lathi</option></select></div>` : ''}
    <div class="row wrap small">${Object.entries(TC_EXTRAS).map(([k, v]) => `<label class="check small"><input type="checkbox" data-x="${k}"${(c.extras || []).includes(k) ? ' checked' : ''}> ${v}</label>`).join('')}<button class="ghost small-btn" data-reset="1" title="Back to the look found in the visual bible">↺ Auto</button></div></div>`; }).join('');
  box.querySelectorAll('.tcRow').forEach((row) => {
    const n = decodeURIComponent(row.dataset.n);
    const save = () => { const cur = tcCast()[n], spec = { ...cur }; delete spec.name; row.querySelectorAll('[data-k]').forEach((el) => { spec[el.dataset.k] = el.value; }); spec.animal = spec.animal || null; spec.extras = [...row.querySelectorAll('[data-x]')].filter((e) => e.checked).map((e) => e.dataset.x); tcSaveSpec(n, spec); };
    row.querySelectorAll('[data-k],[data-x]').forEach((el) => el.addEventListener('change', () => { if (el.dataset.k === 'region' || el.dataset.k === 'gender' || el.dataset.k === 'age') { const auto = tcAutoSpec({ name: n, look: `${TC_REGIONS[row.querySelector('[data-k=region]').value].label} ${row.querySelector('[data-k=gender]').value === 'f' ? 'female' : 'male'}`, voice: '' }); const R = TC_REGIONS[row.querySelector('[data-k=region]').value]; const g = row.querySelector('[data-k=gender]').value, ag = row.querySelector('[data-k=age]').value; row.querySelector('[data-k=skin]').value = tcPick(R.skin, tcHash(n)); row.querySelector('[data-k=hairColor]').value = ag === 'old' ? '#c9c9c9' : tcPick(R.hair, tcHash(n) >>> 3); row.querySelector('[data-k=outfit]').value = tcPick((R[g] && R[g][ag]) || R[g].adult, tcHash(n) >>> 5); row.querySelector('[data-k=hair]').value = g === 'f' ? (ag === 'old' ? 'bun' : ag === 'toddler' ? 'pigtails' : 'long') : (ag === 'old' ? 'bald' : 'short'); void auto; } save(); tcPreviewLoop(); }));
    row.querySelector('[data-reset]').onclick = () => { if (news.tcCast) delete news.tcCast[n]; const S = tcSeries(); if (S && S.tcCast) { delete S.tcCast[n]; if (typeof srSaveAll === 'function') srSaveAll(); } projectSave(); tcCastPaint(); };
  });
  tcPreviewLoop();
}
function tcPreviewLoop() {
  const cv = tcz('tcPrev'); if (!cv) return; cancelAnimationFrame(TC_PREV_RAF);
  const cast = tcCast(), names = Object.keys(cast).slice(0, 6), x = cv.getContext('2d'), W = cv.width, H = cv.height, gy = H * 0.9;
  const bg = tcBuiltinBg('park', false, W, H, gy), t0 = performance.now();
  const loop = () => {
    if (!tcz('tcBox') || !tcz('tcBox').open) return;
    const t = (performance.now() - t0) / 1000; x.drawImage(bg, 0, 0);
    names.forEach((n, i) => { const sp = cast[n], cyc = (t + i * 0.7) % 6, st = { x: W * (i + 0.5) / Math.max(1, names.length), y: gy, f: i % 2 ? -1 : 1, t, seed: i * 0.3, blink: S_blink(t, i * 0.3), walk: 0, ph: 0, emo: 'happy', look: 0, mouth: 0, talkA: 0, talkG: 0 };
      if (cyc < 1.5) { st.walk = 1; st.ph = t * 7; } else if (cyc < 3) { st.mouth = Math.abs(Math.sin(t * 13)) * 0.8; st.talkA = st.mouth; st.talkG = 0.8; } else if (cyc < 4.2) st.wave = 1; else if (cyc < 5) st.jump = Math.sin(((cyc - 4.2) / 0.8) * Math.PI) * 30; else { st.dance = 1; st.dph = t * 12; }
      tcDrawChar(x, sp, st, (H * 0.62) / 246); x.fillStyle = '#fff'; x.strokeStyle = TC_INK; x.lineWidth = 3; x.font = 'bold 11px sans-serif'; x.textAlign = 'center'; x.strokeText(n, st.x, H - 4); x.fillText(n, st.x, H - 4); x.textAlign = 'left'; });
    TC_PREV_RAF = requestAnimationFrame(loop);
  };
  loop();
}
async function tcTestFrame() {
  if (!news || !news.scenes || !news.scenes.length) return addLog('🧸 Open a project first', 'warn');
  const n = Number(tcz('tcTestScene').value) || news.scenes[0].n, i = Math.max(0, news.scenes.findIndex((s) => s.n === n)), cv = tcz('tcPrev');
  const fake = news.scenes.map(() => ({ rate: 48000, f: new Float32Array(48000 * 3).map((_, j) => Math.sin(j / 30) * (Math.sin(j / 4000) > 0 ? 0.5 : 0.05)), dur: 3 }));
  const T = fake.map((_, j) => j * 3.4), sc = fake.map((_, j) => ({ vs: T[j], ve: T[j] + 3.4 }));
  const TC = tcPrepare(news.scenes, T, fake, sc, { W: 1280, H: 720, inner: true });
  const getBg = async () => createImageBitmap(await idbImg.get(sceneImgKey(news.scenes[i].n)));
  cancelAnimationFrame(TC_PREV_RAF);
  const t0 = performance.now(), x = cv.getContext('2d');
  const loop = async () => { if (!tcz('tcBox').open) return; const t = ((performance.now() - t0) / 1000) % 3.4; const c = await tcFrame(TC, i, T[i] + t, getBg); x.drawImage(c, 0, 0, cv.width, cv.height); TC_PREV_RAF = requestAnimationFrame(loop); };
  loop();
}
function tcPaint() {
  const on = tcOn(), el = tcz('tcInfo'); if (!el) return;
  tcz('tcOpts').hidden = !on;
  el.textContent = on ? `On: every scene is drawn as a 2D cartoon — ${TCS.tcBg === 'builtin' ? 'built-in backgrounds (free, no Flow needed)' : 'Flow background picture (cartoon style, no people) + the characters on top'}. Voice, subtitles and music stay the same.` : 'Off: the video uses your Flow pictures as before.';
  const sel = tcz('tcTestScene'); if (sel && news && news.scenes) sel.innerHTML = news.scenes.map((s) => `<option value="${s.n}">#${s.n} ${oneLine(s.dialogue || '').slice(0, 40).replace(/</g, '&lt;')}</option>`).join('');
}
async function tcInit() {
  if (!tcz('tcBox')) return;
  const css = document.createElement('style'); css.textContent = '#tcBox .row select, #tcBox .row input[type=color] { width: auto; flex: 0 0 auto; min-width: 0; } #tcBox .row input[type=color] { width: 34px; padding: 0; height: 24px; } #tcCast .row { gap: 4px; align-items: center; }'; document.head.appendChild(css);
  const { tcSettings } = await chrome.storage.local.get('tcSettings');
  TCS = { ...TC_DEF, ...(tcSettings || {}) };
  for (const id of Object.keys(TC_DEF)) { const el = tcz(id); if (!el) continue; el.value = TCS[id]; el.addEventListener('change', () => { TCS[id] = el.value; chrome.storage.local.set({ tcSettings: TCS }); tcPaint(); if (id === 'tcRegion') tcCastPaint(); }); }
  tcz('tcRewrite').onclick = tcRewritePrompts;
  tcz('tcPlanBtn').onclick = () => tcPlanGemini().catch((e) => { tcz('tcInfo').textContent = '⚠ ' + e.message; });
  tcz('tcPlanClear').onclick = () => { if (news) { delete news.tcPlan; projectSave(); tcz('tcInfo').textContent = 'Gemini actions removed — automatic actions from the words of each line are used.'; } };
  tcz('tcTestBtn').onclick = () => tcTestFrame().catch((e) => addLog('🧸 ' + e.message, 'warn'));
  tcz('tcAddBtn').onclick = () => { const n = oneLine(tcz('tcAddName').value); if (!n || !news) return; tcSaveSpec(n, tcAutoSpec({ name: n, look: tcz('tcAddLook').value }, 0)); tcz('tcAddName').value = ''; tcCastPaint(); };
  tcz('tcBox').addEventListener('toggle', () => { if (tcz('tcBox').open) { tcPaint(); tcCastPaint(); } else cancelAnimationFrame(TC_PREV_RAF); });
  const _rs = window.renderScenes; if (_rs) window.renderScenes = (...a) => { const r = _rs(...a); try { if (tcz('tcBox').open) { tcPaint(); tcCastPaint(); } } catch (e) {} return r; };
  tcPaint();
}
if (typeof document !== 'undefined' && document.getElementById) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(tcInit, 520)); else setTimeout(tcInit, 520); }
