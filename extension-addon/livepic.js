// ================= v4.19: 🪄 Living pictures — Flow ki photo hi zinda: bolna, palak, saans, aag, paani, patte, gaadi =================
// Pipeline wahi rehta hai (Gemini story → Flow images → voice → video). Video banate waqt har picture ko Gemini "padhta" hai
// (kaun kahan hai, kaun bol raha hai, muh / aankhein kahan, aag / dhuaan / paani / patte / gaadi / pahiye kahan) — 1 request = 4 pictures,
// project mein save (re-render free). Phir har frame mein: bolne wale ka muh awaaz ke saath, palak, saans, sar ka halka hilna,
// aag / dhuaan / paani / patte / jhanda / diya lehrana, gaadi ke pahiye ghoomna + thartharana + dhool, chalne wale ka bob — sab Canvas par, bina GPU.
// Aapka zoom / pan (Ken Burns) aur transitions upar se waise hi lagte hain. Default OFF. Video tab → 🪄 Living pictures.

const lpz = (id) => document.getElementById(id);
const LP_DEF = { lpMode: 'off', lpTalk: true, lpBlink: true, lpBreath: true, lpNature: true, lpVehicle: true, lpWalk: true, lpStrength: '100' };
let LPS = { ...LP_DEF };
const lpClamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lpBell = (v, c, r) => { const q = (v - c) / r; return q * q >= 1 ? 0 : (1 - q * q) ** 2; };
function lpOn() { return LPS.lpMode === 'on' && !(typeof tcOn === 'function' && tcOn()); }

// ---------- 👁 Gemini: picture padho ----------
function lpBox(b) { if (!Array.isArray(b) || b.length < 4) return null; const [y0, x0, y1, x1] = b.map((v) => lpClamp(Number(v) / 1000)); if (!(x1 > x0 && y1 > y0)) return null; return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; }
function lpPt(p) { if (!Array.isArray(p) || p.length < 2) return null; return { x: lpClamp(Number(p[1]) / 1000), y: lpClamp(Number(p[0]) / 1000) }; }
async function lpImgB64(blob, max, crop) { // crop = {x,y,w,h} 0-1 (chehra bada karke)
  const bm = await createImageBitmap(blob); const sx = crop ? crop.x * bm.width : 0, sy = crop ? crop.y * bm.height : 0, sw = crop ? crop.w * bm.width : bm.width, sh = crop ? crop.h * bm.height : bm.height;
  const k = max / Math.max(sw, sh), c = new OffscreenCanvas(Math.max(1, Math.round(sw * k)), Math.max(1, Math.round(sh * k)));
  c.getContext('2d').drawImage(bm, sx, sy, sw, sh, 0, 0, c.width, c.height); bm.close();
  const b = await c.convertToBlob({ type: 'image/jpeg', quality: 0.88 }), u8 = new Uint8Array(await b.arrayBuffer()); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s);
}
function lpSpeaker(s) { if (typeof kvSpeaker === 'function') { try { return kvSpeaker(s); } catch (e) {} } return s.speaker && !/^narrator$/i.test(s.speaker) ? s.speaker : ''; }
async function lpAnalyze(scenes, status = () => {}, force = false) {
  const todo = scenes.filter((s) => force || !s.lp);
  if (!todo.length) return 0;
  if (!(lpz('gKey') && lpz('gKey').value.trim())) { addLog('🪄 Living pictures: no Gemini key — pictures move with the normal zoom only', 'warn'); return 0; }
  const looks = ((news && news.bible && news.bible.characters) || []).map((c) => `${c.name}: ${oneLine(c.look || '').slice(0, 110)}`).join('\n');
  let req = 0, got = 0;
  for (let i = 0; i < todo.length; i += 4) {
    const part = todo.slice(i, i + 4);
    status(`🪄 Gemini reads pictures ${i + 1}-${i + part.length}/${todo.length}...`);
    const parts = [{ text: `We will animate each numbered picture (2D animation from a still picture). Find everything that can move.
Coordinates: box_2d = [ymin, xmin, ymax, xmax] and points = [y, x], all 0-1000 of THAT picture. Be precise.
"people": people and animals with a visible face (max 6, biggest first): "name" (from the character list if you can tell, else ""), "speaking" (true ONLY for the named SPEAKER of that picture), "face" box_2d, "mouth" point (centre between the lips), "mouth_w" (mouth width, 0-1000 of picture width), "eyes" (points of the visible eyes, max 2), "eye_w" (one eye's width, 0-1000), "body" box_2d (whole body visible), "facing" (left/right/front), "walking" (true if walking or running).
"fx": EVERYTHING in the picture, foreground and background, that would move in real life — each {"type", "box": box_2d}, max 14, biggest / most visible first. Use these types:
  fire, smoke, steam, flame (candle / diya / lamp / torch), lamp (lantern, bulb, street light, TV / screen glow),
  water (river / lake / pond / puddle), sea (waves), waterfall (also fountain),
  leaves (tree crowns), grass (grass, crops, field), bush, flowers,
  clouds, sky (open sky with no clouds), stars (night sky), mist (fog),
  light (sun rays, light beams, glowing window light), flag (also banner, kite), cloth (curtain, hanging clothes / saree, clothesline),
  swing (jhoola, hanging lantern, bell, chandelier — things hanging from the top), fan (ceiling fan, table fan, windmill, any spinning wheel),
  boat (boat or anything floating), bird (birds sitting or flying), rain, snow.
"vehicles": car, bus, truck, auto, bike, cycle, cart, tractor, train, boat, plane — {"type", "box": box_2d, "dir": "left"|"right", "moving": true|false, "wheels": [[y, x, r]] (r = radius 0-1000 of picture width)}.
Character list:
${looks || '(none)'}
Return ONLY JSON: {"pictures": [{"n": 1, "people": [], "fx": [], "vehicles": []}]}` }];
    let has = 0;
    for (const s of part) {
      const b = await idbImg.get(sceneImgKey(s.n)).catch(() => null); if (!b) continue;
      parts.push({ text: `PICTURE ${s.n}: speaker = ${lpSpeaker(s) || 'nobody (narration)'} · line: ${oneLine(s.dialogue || '').slice(0, 160)}` }, { inline_data: { mime_type: 'image/jpeg', data: await lpImgB64(b, 1024) } });
      has++;
    }
    if (!has) continue;
    try {
      req++;
      const j = await geminiRetry(scriptModel(), { contents: [{ role: 'user', parts }], generationConfig: { temperature: 0.1, responseMimeType: 'application/json' } }, 'Living pictures', 'gScriptModel');
      for (const x of (parseJSON(textOf(j)) || {}).pictures || []) {
        const s = part.find((q) => q.n === Number(x.n)); if (!s) continue;
        s.lp = {
          people: (x.people || []).map((p) => ({ name: oneLine(p.name || ''), speaking: !!p.speaking, face: lpBox(p.face), mouth: lpPt(p.mouth), mw: lpClamp(Number(p.mouth_w) / 1000 || 0.02, 0.004, 0.2), eyes: (p.eyes || []).map(lpPt).filter(Boolean).slice(0, 2), ew: lpClamp(Number(p.eye_w) / 1000 || 0.012, 0.002, 0.08), body: lpBox(p.body), facing: String(p.facing || 'front'), walking: !!p.walking })).filter((p) => p.face),
          fx: (x.fx || []).map((f) => ({ type: String(f.type || '').toLowerCase(), box: lpBox(f.box) })).filter((f) => f.box).slice(0, 14),
          veh: (x.vehicles || []).map((v) => ({ type: String(v.type || ''), box: lpBox(v.box), dir: v.dir === 'left' ? -1 : 1, moving: v.moving !== false, wheels: (v.wheels || []).map((w) => (Array.isArray(w) && w.length >= 3 ? { x: lpClamp(w[1] / 1000), y: lpClamp(w[0] / 1000), r: lpClamp(w[2] / 1000, 0.003, 0.2) } : null)).filter(Boolean) })).filter((v) => v.box),
        };
        got++;
      }
    } catch (e) { addLog('🪄 Living pictures: ' + e.message, 'warn'); break; }
  }
  const ref = await lpRefine(todo, status).catch((e) => { addLog('🪄 Mouth close-up: ' + e.message, 'warn'); return 0; });
  if (typeof projectSave === 'function') projectSave();
  addLog(`🪄 Living pictures: read ${got} picture(s)${ref ? `, ${ref} speaker close-up(s)` : ''} (${req + (ref ? Math.ceil(ref / 8) : 0)} Gemini request${req === 1 ? '' : 's'}) — saved in the project`, got ? 'info' : 'warn');
  return got;
}
// bolne wale ka chehra bada karke: hothon ke kone + aankhein ekdum sahi
async function lpRefine(scenes, status) {
  const items = [];
  for (const s of scenes) { const p = s.lp && s.lp.people.find((q) => q.speaking && !q.fixed); if (p) items.push({ s, p }); }
  let done = 0;
  for (let i = 0; i < items.length; i += 8) {
    const part = items.slice(i, i + 8); status(`🪄 Gemini finds the speakers' lips ${i + 1}-${i + part.length}/${items.length}...`);
    const parts = [{ text: `Each numbered picture is a close-up of one face. Coordinates are [y, x] 0-1000 of THAT close-up.
Return "mouth": {"left": [y,x], "right": [y,x], "top": [y,x], "bottom": [y,x]} = the two lip corners, the middle of the upper lip edge and of the lower lip edge (where the lips meet if closed); "eyes": [{"c": [y,x], "w": width, "h": open height}] for each visible eye; "beard": true if a beard covers the chin.
Return ONLY JSON: {"faces": [{"n": 1, "mouth": {}, "eyes": [], "beard": false}]}` }];
    const crops = [];
    for (let k = 0; k < part.length; k++) {
      const { s, p } = part[k], f = p.face, pad = 0.35, c = { x: lpClamp(f.x - f.w * pad), y: lpClamp(f.y - f.h * pad) }; c.w = Math.min(1 - c.x, f.w * (1 + 2 * pad)); c.h = Math.min(1 - c.y, f.h * (1 + 2 * pad)); crops.push(c);
      const b = await idbImg.get(sceneImgKey(s.n)).catch(() => null); if (!b) continue;
      parts.push({ text: `FACE ${k + 1}` }, { inline_data: { mime_type: 'image/jpeg', data: await lpImgB64(b, 512, c) } });
    }
    const j = await geminiRetry(scriptModel(), { contents: [{ role: 'user', parts }], generationConfig: { temperature: 0.1, responseMimeType: 'application/json' } }, 'Living pictures (lips)', 'gScriptModel');
    for (const x of (parseJSON(textOf(j)) || {}).faces || []) {
      const k = Number(x.n) - 1, it = part[k], c = crops[k]; if (!it || !c) continue;
      const P = (q) => (Array.isArray(q) ? { x: c.x + (q[1] / 1000) * c.w, y: c.y + (q[0] / 1000) * c.h } : null), m = x.mouth || {};
      const L = P(m.left), R = P(m.right), U = P(m.top), D = P(m.bottom);
      if (L && R) { it.p.mouth = { x: (L.x + R.x) / 2, y: U && D ? (U.y + D.y) / 2 : (L.y + R.y) / 2 }; it.p.mw = Math.hypot(R.x - L.x, (R.y - L.y)); it.p.mang = Math.atan2(R.y - L.y, R.x - L.x); }
      const E = (x.eyes || []).map((e) => (e && Array.isArray(e.c) ? { ...P(e.c), w: (Number(e.w) / 1000) * c.w, h: (Number(e.h) / 1000) * c.h } : null)).filter((e) => e && e.x);
      if (E.length) { it.p.eyes = E.map((e) => ({ x: e.x, y: e.y })); it.p.ew = E[0].w || it.p.ew; it.p.eh = E[0].h; }
      it.p.beard = !!x.beard; done++;
    }
  }
  return done;
}

// ---------- 🎬 tayyari (video.js se) ----------
function lpEnvelope(c) {
  if (!c || !c.f) return { env: new Float32Array(1), hz: 50 };
  const hz = 50, step = Math.max(1, Math.round(c.rate / hz)), n = Math.ceil(c.f.length / step), env = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; const a = i * step, b = Math.min(c.f.length, a + step); for (let j = a; j < b; j++) s += c.f[j] * c.f[j]; env[i] = Math.sqrt(s / Math.max(1, b - a)); }
  const ref = Math.max(1e-4, Array.from(env).sort((p, q) => p - q)[Math.floor(n * 0.9)] || 0);
  for (let i = 0; i < n; i++) env[i] = lpClamp(env[i] / ref - 0.08); const sm = new Float32Array(n); for (let i = 0; i < n; i++) sm[i] = (env[Math.max(0, i - 1)] + 2 * env[i] + env[Math.min(n - 1, i + 1)]) / 4; return { env: sm, hz };
}
async function lpPrepare(scenes, T, clips, sc, o = {}) {
  if (!lpOn() || !scenes || !scenes.length) return null;
  if (!o.inner && !o.preview && scenes.some((s) => !s.lp)) await lpAnalyze(scenes, (t) => (typeof vProgress === 'function' ? vProgress(0, 1, t) : 0)).catch((e) => addLog('🪄 ' + e.message, 'warn'));
  const n = scenes.filter((s) => s.lp).length; if (!n) return null;
  if (!o.inner) { const c = (k) => scenes.reduce((a, s) => a + ((s.lp && s.lp[k]) || []).length, 0); addLog(`🪄 Living pictures: ${n}/${scenes.length} picture(s) · ${scenes.filter((s) => s.lp && s.lp.people.some((p) => p.speaking)).length} with a talking speaker · ${c('fx')} moving element(s) · ${c('veh')} vehicle(s)`, 'info'); }
  const K = lpClamp((Number(LPS.lpStrength) || 100) / 100, 0.3, 1.6);
  const sig = JSON.stringify([LPS, scenes.map((s) => s.lp || 0)]).length + ':' + scenes.map((s) => (s.lp ? JSON.stringify(s.lp).length : 0)).join(',');
  return { scenes, T, clips, sc, K, envs: clips.map(lpEnvelope), canv: new Map(), cols: new Map(), sig, on: (i) => !!scenes[i].lp, mo: (i, m) => lpMotion(scenes[i], m) };
}
function lpMotion(s, m) { // gaadi / chalne wala: camera usi taraf
  if (!s.lp) return m;
  const v = LPS.lpVehicle && s.lp.veh.find((q) => q.moving); if (v) return v.dir > 0 ? 'panLR' : 'panRL';
  const p = LPS.lpWalk && s.lp.people.find((q) => q.walking); if (p) return p.facing === 'left' ? 'panRL' : p.facing === 'right' ? 'panLR' : m;
  return m;
}
const lpTmp = new Map();
function lpCanvas(key, w, h) { let c = lpTmp.get(key); if (!c || c.width !== w || c.height !== h) { c = new OffscreenCanvas(Math.max(1, w), Math.max(1, h)); lpTmp.set(key, c); } return c; }
// muh ke andar / palak ke liye rang (picture se, ek baar)
function lpColors(LP, i, bmp, s) {
  if (LP.cols.has(i)) return LP.cols.get(i);
  const W = bmp.width, H = bmp.height, c = new OffscreenCanvas(W, H), x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bmp, 0, 0);
  const px = (u, v) => { const d = x.getImageData(lpClamp(Math.round(u * W), 0, W - 1), lpClamp(Math.round(v * H), 0, H - 1), 1, 1).data; return `rgb(${d[0]},${d[1]},${d[2]})`; };
  const out = s.lp.people.map((p) => ({ lid: (p.eyes || []).map((e) => px(e.x, e.y - (p.eh || p.ew * 0.6) * 1.3 - 0.004)), chin: p.mouth ? px(p.mouth.x, p.mouth.y + 0.012) : '#a0705a' }));
  LP.cols.set(i, out); return out;
}

// ---------- har frame ----------
function lpFrame(LP, i, tq, bmp) {
  const s = LP.scenes[i], A = s.lp, W = bmp.width, H = bmp.height, K = LP.K;
  let c = LP.canv.get(i); if (!c || c.width !== W || c.height !== H) { c = new OffscreenCanvas(W, H); LP.canv.set(i, c); for (const k of LP.canv.keys()) if (k < i - 2) LP.canv.delete(k); }
  for (const k of ['_focus', '_rf', '_depth']) if (bmp[k] !== undefined) c[k] = bmp[k];
  const x = c.getContext('2d'); x.clearRect(0, 0, W, H); x.drawImage(bmp, 0, 0);
  const t = tq, lt = tq - LP.T[i], cl = LP.clips[i], E = LP.envs[i];
  const talk = lt >= 0 && lt < cl.dur ? E.env[Math.min(E.env.length - 1, Math.floor(lt * E.hz))] || 0 : 0;
  const cols = lpColors(LP, i, bmp, s), seed = (s.n * 0.37) % 1;
  // 1) maahaul: aag, dhuaan, paani, patte, baadal, jhanda, diya
  if (LPS.lpNature) { const ord = A.fx.map((f, k) => [f, k]).sort((p, q) => (q[0].box.w * q[0].box.h) - (p[0].box.w * p[0].box.h)); for (const [f, k] of ord) if (!/light|ray|beam|mist|fog/.test(f.type)) lpFx(x, bmp, f, W, H, t, K, k); }
  // 2) gaadi
  if (LPS.lpVehicle) for (const v of A.veh) if (v.moving) lpVehicle(x, bmp, v, W, H, t, K);
  // 3) log: saans / chalna / sar / muh / palak (roshni / kohra baad mein, sabke upar)
  A.people.forEach((p, k) => {
    const ph = seed * 7 + k * 1.9;
    if (p.body && ((LPS.lpWalk && p.walking) || (LPS.lpBreath && !p.speaking))) lpBody(x, bmp, p, W, H, t, K, ph); // bolne wale ka chehra jabde ke saath hi hilta hai
    if (p.speaking && LPS.lpTalk && p.mouth && talk > 0.04) lpJaw(x, bmp, p, W, H, talk * K, cols[k].chin);
    else if (LPS.lpBreath && p.face && !p.walking) lpNod(x, bmp, p.face, W, H, Math.sin(t * 1.1 + ph) * 0.6);
    if (LPS.lpBlink && p.eyes && p.eyes.length) { const per = 3.1 + ((k * 0.73 + seed) % 1.4), q = (t + k * 1.3 + seed * 3) % per, b = q < 0.16 ? 1 - Math.abs(q - 0.08) / 0.08 : 0; if (b > 0) p.eyes.forEach((e, j) => lpLid(x, e, p, W, H, b, cols[k].lid[j])); }
  });
  if (LPS.lpNature) A.fx.forEach((f, k) => { if (/light|ray|beam|mist|fog/.test(f.type)) lpFx(x, bmp, f, W, H, t, K, k); });
  return c;
}
// patle tukdon se lehar (canvas par sasta "warp") — naram kinaaron wala tukda banao, phir jahan chahiye wahan rakho
function lpPiece(bmp, b, W, H, fn, key, feather = 0.25) {
  const bx = Math.round(b.x * W), by = Math.round(b.y * H), bw = Math.round(b.w * W), bh = Math.round(b.h * H); if (bw < 4 || bh < 4) return null;
  const tc = lpCanvas(key, bw, bh), tx = tc.getContext('2d'); tx.globalCompositeOperation = 'source-over'; tx.clearRect(0, 0, bw, bh);
  const st = Math.max(2, Math.round(bh / 160));
  for (let y = 0; y < bh; y += st) { const off = fn ? fn(y / bh) : 0; tx.drawImage(bmp, bx, by + y, bw, st, off, y, bw, st); }
  tx.globalCompositeOperation = 'destination-in'; tx.save(); tx.translate(bw / 2, bh / 2); tx.scale(bw / 2, bh / 2);
  const g = tx.createRadialGradient(0, 0, Math.max(0.05, 1 - feather * 2), 0, 0, 1); g.addColorStop(0, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)'); tx.fillStyle = g; tx.fillRect(-1, -1, 2, 2); tx.restore();
  tx.globalCompositeOperation = 'source-over';
  return { c: tc, x: bx, y: by };
}
function lpWave(x, bmp, b, W, H, fn, key, feather) { const p = lpPiece(bmp, b, W, H, fn, key, feather); if (p) x.drawImage(p.c, p.x, p.y); }
function lpGlow(x, cx, cy, r, col, a) { if (a <= 0.003) return; const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`); x.save(); x.globalCompositeOperation = 'lighter'; x.fillStyle = g; x.fillRect(cx - r, cy - r, 2 * r, 2 * r); x.restore(); }
function lpRotPiece(x, bmp, b, W, H, ang, px, py, key, feather = 0.12) { // tukda kisi bindu ke aas-paas ghumao (jhoola, pankha, naav)
  const pc = lpPiece(bmp, b, W, H, null, key, feather); if (!pc) return; x.save(); x.translate(px, py); x.rotate(ang); x.translate(-px, -py); x.drawImage(pc.c, pc.x, pc.y); x.restore();
}
function lpFx(x, bmp, f, W, H, t, K, k) {
  const b = f.box, bw = b.w * W, bh = b.h * H, bx = b.x * W, by = b.y * H, ty = f.type, cx = bx + bw / 2, cy = by + bh / 2, ph = k * 1.7;
  const rnd = (j, q) => { const v = Math.sin(j * 127.1 + q * 311.7 + k * 74.7) * 43758.5453; return v - Math.floor(v); };
  if (/fire|torch/.test(ty)) {
    lpWave(x, bmp, b, W, H, (v) => Math.sin(v * 18 + t * 15 + ph) * bw * 0.035 * K * (1 - v), 'fx' + k, 0.2);
    lpGlow(x, cx, by + bh * 0.6, Math.max(bw, bh) * 2.2, '255,160,60', 0.13 * K * (0.6 + 0.4 * Math.sin(t * 17 + ph) * Math.sin(t * 7.3)));
  } else if (/flame|diya|candle/.test(ty)) {
    lpWave(x, bmp, b, W, H, (v) => Math.sin(v * 14 + t * 13 + ph) * bw * 0.06 * K * (1 - v), 'fx' + k, 0.2);
    lpGlow(x, cx, cy, Math.max(bw, bh) * 3, '255,190,90', 0.16 * K * (0.65 + 0.35 * Math.sin(t * 11 + ph)));
  } else if (/lamp|lantern|bulb|light ?bulb|screen|tv|neon|street/.test(ty)) lpGlow(x, cx, cy, Math.max(bw, bh) * 1.6, '255,220,150', 0.1 * K * (0.7 + 0.3 * Math.sin(t * 5 + ph) + (Math.sin(t * 37 + ph) > 0.97 ? -0.4 : 0)));
  else if (/smoke|steam/.test(ty)) lpWave(x, bmp, b, W, H, (v) => Math.sin(v * 7 - t * 2.2 + ph) * bw * 0.06 * K * (1 - v), 'fx' + k, 0.15);
  else if (/waterfall|fountain/.test(ty)) {
    lpWave(x, bmp, b, W, H, (v) => Math.sin(v * 40 - t * 9 + ph) * bw * 0.008 * K, 'fx' + k, 0.25);
    x.save(); x.globalCompositeOperation = 'lighter'; for (let j = 0; j < 26; j++) { const u = rnd(j, 1), v = (rnd(j, 2) + t * (0.8 + rnd(j, 3))) % 1; x.fillStyle = `rgba(255,255,255,${0.16 * K})`; x.fillRect(bx + u * bw, by + v * bh, 1.5, bh * 0.08); } x.restore();
  } else if (/sea|wave|ocean/.test(ty)) {
    lpWave(x, bmp, b, W, H, (v) => Math.sin(v * 30 + t * 2 + ph) * bw * 0.01 * K, 'fx' + k, 0.25);
    x.save(); x.globalCompositeOperation = 'lighter'; for (let j = 0; j < 18; j++) { const u = rnd(j, 1), v = rnd(j, 2), a = Math.max(0, Math.sin(t * 2.5 + j)); x.fillStyle = `rgba(255,255,255,${0.12 * a * K})`; x.fillRect(bx + ((u + t * 0.02) % 1) * bw, by + v * bh, bw * 0.05, 2); } x.restore();
  } else if (/water|river|pond|lake|puddle/.test(ty)) {
    lpWave(x, bmp, b, W, H, (v) => Math.sin(v * 60 + t * 3 + ph) * bw * 0.006 * K, 'fx' + k, 0.3);
    x.save(); x.globalCompositeOperation = 'lighter'; for (let j = 0; j < 14; j++) { const a = 0.5 + 0.5 * Math.sin(t * 3 + j); x.fillStyle = `rgba(255,255,255,${0.08 * a * K})`; x.fillRect(bx + rnd(j, 1) * bw, by + rnd(j, 2) * bh, bw * 0.06, 2); } x.restore();
  } else if (/leaves|leaf|tree/.test(ty)) lpWave(x, bmp, b, W, H, (v) => Math.sin(v * 5 + t * 1.6 + ph) * bw * 0.008 * K * (1 - v * 0.7), 'fx' + k, 0.3);
  else if (/grass|crop|field|bush|flower|plant/.test(ty)) lpWave(x, bmp, b, W, H, (v) => Math.sin(v * 4 + t * 2.1 + ph + bx * 0.01) * bw * (/flower|bush/.test(ty) ? 0.01 : 0.006) * K * (1 - v), 'fx' + k, 0.3); // jad tiki, upar hilta
  else if (/flag|banner|kite|cloth|curtain|saree|cloth/.test(ty)) lpWave(x, bmp, b, W, H, (v) => Math.sin(v * 9 + t * 4 + ph) * bw * 0.03 * K, 'fx' + k, 0.25);
  else if (/cloud/.test(ty)) lpWave(x, bmp, b, W, H, () => Math.sin(t * 0.25 + ph) * bw * 0.04 * K, 'fx' + k, 0.35);
  else if (/mist|fog/.test(ty)) { x.save(); for (let j = 0; j < 5; j++) { const u = (rnd(j, 1) + t * 0.015 * (1 + j * 0.3)) % 1.3 - 0.15; const g = x.createRadialGradient(bx + u * bw, by + rnd(j, 2) * bh, 0, bx + u * bw, by + rnd(j, 2) * bh, bh * 0.6); g.addColorStop(0, `rgba(255,255,255,${0.12 * K})`); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(bx, by, bw, bh); } x.restore(); }
  else if (/light|ray|beam|sunbeam|god ?ray/.test(ty)) {
    const pul = 0.5 + 0.5 * Math.sin(t * 0.9 + ph); x.save(); x.globalCompositeOperation = 'lighter'; const g = x.createLinearGradient(bx, by, bx, by + bh); g.addColorStop(0, `rgba(255,235,180,${0.09 * pul * K})`); g.addColorStop(1, 'rgba(255,235,180,0)'); x.fillStyle = g; x.fillRect(bx, by, bw, bh);
    for (let j = 0; j < 40; j++) { const u = (rnd(j, 1) + Math.sin(t * 0.3 + j) * 0.02) % 1, v = (rnd(j, 2) - t * 0.02 * (0.3 + rnd(j, 3)) + 2) % 1, a = 0.5 + 0.5 * Math.sin(t * 2 + j); x.fillStyle = `rgba(255,235,170,${0.5 * a * K})`; x.beginPath(); x.arc(bx + u * bw, by + v * bh, 1.2 + rnd(j, 4) * 1.6, 0, 7); x.fill(); } x.restore();
  } else if (/stars|night sky/.test(ty)) { x.save(); x.globalCompositeOperation = 'lighter'; for (let j = 0; j < 50; j++) { const a = Math.max(0, Math.sin(t * (1 + rnd(j, 3) * 3) + j)); x.fillStyle = `rgba(255,255,230,${0.7 * a * K})`; x.beginPath(); x.arc(bx + rnd(j, 1) * bw, by + rnd(j, 2) * bh, 0.8 + rnd(j, 4) * 1.2, 0, 7); x.fill(); } x.restore(); }
  else if (/sky/.test(ty)) { // khule aasmaan mein udti chidiya
    x.save(); x.strokeStyle = 'rgba(30,30,30,0.75)'; x.lineWidth = Math.max(1.2, W / 900);
    for (let j = 0; j < 3; j++) { const sp = 0.04 + rnd(j, 1) * 0.04, u = ((rnd(j, 2) + t * sp) % 1.3) - 0.15, v = 0.2 + rnd(j, 3) * 0.5, s2 = W / 160 * (0.7 + rnd(j, 4) * 0.6), fl = Math.sin(t * 9 + j) * s2 * 0.5, px = bx + u * bw, py = by + v * bh + Math.sin(t * 0.8 + j) * 6; x.beginPath(); x.moveTo(px - s2, py - fl); x.quadraticCurveTo(px - s2 * 0.4, py - s2 * 0.4, px, py); x.quadraticCurveTo(px + s2 * 0.4, py - s2 * 0.4, px + s2, py - fl); x.stroke(); }
    x.restore();
  } else if (/swing|jhoola|hanging|lantern|bell|chandelier|pendulum/.test(ty)) lpRotPiece(x, bmp, b, W, H, Math.sin(t * 2.2 + ph) * 0.06 * K, cx, by, 'fx' + k);
  else if (/fan|windmill|spinning|wheel/.test(ty)) { const r = Math.min(bw, bh) / 2; x.save(); x.beginPath(); x.arc(cx, cy, r, 0, 7); x.clip(); x.translate(cx, cy); x.rotate(t * 6 * K); x.translate(-cx, -cy); x.drawImage(bmp, cx - r, cy - r, 2 * r, 2 * r, cx - r, cy - r, 2 * r, 2 * r); x.restore(); }
  else if (/boat|float/.test(ty)) lpRotPiece(x, bmp, b, W, H, Math.sin(t * 1.4 + ph) * 0.025 * K, cx, by + bh, 'fx' + k, 0.08);
  else if (/bird/.test(ty)) { const pc = lpPiece(bmp, b, W, H, null, 'fx' + k, 0.15); if (pc) x.drawImage(pc.c, pc.x, pc.y - Math.abs(Math.sin(t * 3 + ph)) * bh * 0.04 * K); }
  else if (/rain|snow/.test(ty)) { x.save(); x.strokeStyle = /snow/.test(ty) ? 'rgba(255,255,255,0.8)' : 'rgba(200,220,255,0.45)'; x.lineWidth = /snow/.test(ty) ? 3 : 1.4; for (let j = 0; j < 90; j++) { const u = (j * 0.618) % 1, sp = /snow/.test(ty) ? 0.08 : 0.9, v = ((j * 0.37) + t * sp) % 1, px = (b.x + u * b.w) * W, py = (b.y + v * b.h) * H; x.beginPath(); x.moveTo(px, py); x.lineTo(px - 2, py + (/snow/.test(ty) ? 1 : 14)); x.stroke(); } x.restore(); }
}
function lpVehicle(x, bmp, v, W, H, t, K) {
  const b = v.box, bx = b.x * W, by = b.y * H, bw = b.w * W, bh = b.h * H, dir = v.dir;
  // pahiye ghoomna
  for (const w of v.wheels) { const cx = w.x * W, cy = w.y * H, r = w.r * W; x.save(); x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.clip(); x.translate(cx, cy); x.rotate(t * 9 * dir * K); x.translate(-cx, -cy); x.drawImage(bmp, cx - r, cy - r, 2 * r, 2 * r, cx - r, cy - r, 2 * r, 2 * r); x.restore(); }
  // thartharana (body)
  const shake = Math.sin(t * 31) * 0.8 * K, pc = lpPiece(bmp, { x: b.x, y: b.y, w: b.w, h: b.h * 0.7 }, W, H, null, 'veh', 0.12); if (pc) x.drawImage(pc.c, pc.x, pc.y + shake);
  // peeche dhool + speed ki lakeeren
  x.save(); const back = dir > 0 ? bx : bx + bw;
  for (let j = 0; j < 10; j++) { const q = ((t * 1.6 + j / 10) % 1), px = back - dir * q * bw * 0.6, py = by + bh * (0.85 - 0.1 * Math.sin(j)), r = bh * (0.05 + q * 0.12); x.fillStyle = `rgba(200,180,150,${0.25 * (1 - q) * K})`; x.beginPath(); x.arc(px, py - q * bh * 0.1, r, 0, 7); x.fill(); }
  x.strokeStyle = `rgba(255,255,255,${0.35 * K})`; x.lineWidth = 2; for (let j = 0; j < 5; j++) { const q = (t * 2.3 + j * 0.27) % 1, py = by + bh * (0.25 + j * 0.12), len = bw * 0.25, px = back - dir * (bw * 0.05 + q * bw * 0.3); x.globalAlpha = 1 - q; x.beginPath(); x.moveTo(px, py); x.lineTo(px - dir * len, py); x.stroke(); }
  x.restore();
}
function lpBody(x, bmp, p, W, H, t, K, ph) { // saans (upar-neeche) ya chalne ka bob
  const b = p.body; const walk = LPS.lpWalk && p.walking;
  const dy = walk ? -Math.abs(Math.sin(t * 2 * Math.PI * 0.9 + ph)) * b.h * H * 0.012 * K : -(0.5 + 0.5 * Math.sin(t * 2 * Math.PI / 3.6 + ph)) * b.h * H * 0.004 * K;
  const sway = walk ? Math.sin(t * 2 * Math.PI * 0.45 + ph) * b.w * W * 0.01 * K : 0;
  const bx = b.x * W, by = b.y * H, bw = b.w * W, bh = b.h * H;
  const tc = lpCanvas('body', Math.round(bw), Math.round(bh)), tx = tc.getContext('2d'); tx.globalCompositeOperation = 'source-over'; tx.clearRect(0, 0, tc.width, tc.height);
  // upar zyada, pairon par zero (pair zameen par tike rahein)
  const st = Math.max(2, Math.round(bh / 120));
  for (let y = 0; y < bh; y += st) { const f = Math.max(0, 1 - y / (bh * 0.85)); tx.drawImage(bmp, bx, by + y, bw, st, sway * f, y + dy * f, bw, st + 1); }
  tx.globalCompositeOperation = 'destination-in'; const g = tx.createLinearGradient(0, 0, tc.width, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.18, '#000'); g.addColorStop(0.82, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)'); tx.fillStyle = g; tx.fillRect(0, 0, tc.width, tc.height); tx.globalCompositeOperation = 'source-over';
  x.drawImage(tc, bx, by);
}
function lpNod(x, bmp, f, W, H, amt) { const pc = lpPiece(bmp, { x: f.x - f.w * 0.2, y: f.y - f.h * 0.25, w: f.w * 1.4, h: f.h * 1.6 }, W, H, null, 'nod', 0.3); if (pc) x.drawImage(pc.c, pc.x, pc.y + amt * f.h * H * 0.02); }
// muh: hothon ke neeche se jabda neeche (daadhi / thodi saath), beech mein muh ka andar
function lpJaw(x, bmp, p, W, H, talk, chin) {
  const m = p.mouth, mw = Math.max(6, p.mw * W), mx = m.x * W, my = m.y * H, ang = p.mang || 0, slope = Math.tan(ang);
  const D = mw * 0.42 * lpClamp(talk, 0, 1.3), jawH = Math.max(mw * (p.beard ? 4 : 2.4), 10), half = mw * 1.4;
  for (let sx = Math.floor(mx - half); sx < mx + half; sx += 2) {
    const fx = lpBell(sx + 1, mx, half), d = D * fx; if (d < 0.3) continue; const y0 = my + (sx - mx) * slope;
    x.drawImage(bmp, sx, y0, 2, jawH, sx, y0 + d, 2, jawH - d);
  }
  if (D > 1) {
    x.save(); x.filter = `blur(${Math.max(0.6, mw * 0.04)}px)`; x.translate(mx, my); x.rotate(ang);
    x.fillStyle = 'rgba(60,24,20,0.93)'; x.beginPath(); x.moveTo(-mw / 2, 0); x.quadraticCurveTo(0, -D * 0.15, mw / 2, 0); x.quadraticCurveTo(mw * 0.45, D, 0, D * 1.05); x.quadraticCurveTo(-mw * 0.45, D, -mw / 2, 0); x.fill();
    if (talk > 0.3) { x.fillStyle = 'rgba(232,224,212,0.85)'; x.beginPath(); x.moveTo(-mw * 0.34, D * 0.05); x.quadraticCurveTo(0, -D * 0.05, mw * 0.34, D * 0.05); x.lineTo(mw * 0.3, D * 0.22); x.quadraticCurveTo(0, D * 0.16, -mw * 0.3, D * 0.22); x.fill(); }
    if (talk > 0.55) { x.fillStyle = 'rgba(200,90,100,0.8)'; x.beginPath(); x.ellipse(0, D * 0.8, mw * 0.22, D * 0.18, 0, 0, Math.PI * 2); x.fill(); }
    x.restore();
  }
}
function lpLid(x, e, p, W, H, b, col) {
  const rx = Math.max(2, p.ew * W * 0.6), ry = Math.max(1.5, (p.eh || p.ew * 0.55) * H * 0.75 + 1), ex = e.x * W, ey = e.y * H;
  x.save(); x.fillStyle = col || '#b07a5a'; x.beginPath(); x.ellipse(ex, ey - ry * (1 - b), rx * 1.15, ry * b + 0.5, 0, 0, Math.PI * 2); x.fill();
  if (b > 0.75) { x.strokeStyle = 'rgba(40,24,20,0.8)'; x.lineWidth = Math.max(1, ry * 0.35); x.beginPath(); x.ellipse(ex, ey, rx, ry * 0.6, 0, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke(); }
  x.restore();
}

// ---------- UI ----------
let LP_PREV_RAF = 0, LP_PREV = null;
function lpPaint() {
  const el = lpz('lpInfo'); if (!el) return;
  const on = LPS.lpMode === 'on', tc = typeof tcOn === 'function' && tcOn();
  lpz('lpOpts').hidden = !on;
  const n = news && news.scenes ? news.scenes.filter((s) => s.lp).length : 0;
  el.textContent = !on ? 'Off: pictures only zoom / pan as before.' : tc ? '⚠ 🧸 Cartoon 2D is on — it replaces the pictures, so Living pictures is not used.' : `On: ${n}/${news && news.scenes ? news.scenes.length : 0} picture(s) read. Pictures not read yet are read by Gemini when you make the video (1 request = 4 pictures, + 1 for every 8 speakers' lips), then saved in the project.`;
  const sel = lpz('lpScene'); if (sel && news && news.scenes) { const v = sel.value; sel.innerHTML = news.scenes.map((s) => `<option value="${s.n}">#${s.n}${s.lp ? ' ✓' : ''} ${oneLine(s.dialogue || '').slice(0, 40).replace(/</g, '&lt;')}</option>`).join(''); if (v) sel.value = v; }
}
async function lpPreview() {
  cancelAnimationFrame(LP_PREV_RAF);
  const n = Number(lpz('lpScene').value), i = news.scenes.findIndex((s) => s.n === n), s = news.scenes[i]; if (!s) return;
  const b = await idbImg.get(sceneImgKey(n)); if (!b) return (lpz('lpInfo').textContent = 'This scene has no picture yet.');
  if (!s.lp) { await lpAnalyze([s], (t) => (lpz('lpInfo').textContent = t)); lpPaint(); if (!s.lp) return; }
  const bmp = await createImageBitmap(b), cv = lpz('lpPrev'), x = cv.getContext('2d'), fake = { rate: 16000, f: new Float32Array(16000 * 3).map((_, j) => Math.sin(j / 7) * (Math.sin(j / 1300) > -0.2 ? 0.6 : 0.02)), dur: 3 };
  const LP = { scenes: [s], T: [0], clips: [fake], sc: [{ vs: 0, ve: 3 }], K: lpClamp((Number(LPS.lpStrength) || 100) / 100, 0.3, 1.6), envs: [lpEnvelope(fake)], canv: new Map(), cols: new Map() };
  LP_PREV = { s, bmp }; const t0 = performance.now();
  const loop = () => { if (!lpz('lpBox').open) return; const t = ((performance.now() - t0) / 1000) % 3; const c = lpFrame(LP, 0, t, bmp); x.drawImage(c, 0, 0, cv.width, cv.height); if (lpz('lpMarks').checked) lpMarks(x, s, cv.width, cv.height); LP_PREV_RAF = requestAnimationFrame(loop); };
  loop();
}
function lpMarks(x, s, W, H) {
  x.save(); x.lineWidth = 1.5;
  for (const p of s.lp.people) { x.strokeStyle = p.speaking ? '#ffeb3b' : '#80deea'; if (p.face) x.strokeRect(p.face.x * W, p.face.y * H, p.face.w * W, p.face.h * H); if (p.mouth) { x.fillStyle = '#ff5252'; x.beginPath(); x.arc(p.mouth.x * W, p.mouth.y * H, 3, 0, 7); x.fill(); } for (const e of p.eyes || []) { x.fillStyle = '#69f0ae'; x.beginPath(); x.arc(e.x * W, e.y * H, 2.5, 0, 7); x.fill(); } }
  x.strokeStyle = '#ffab40'; for (const f of s.lp.fx) x.strokeRect(f.box.x * W, f.box.y * H, f.box.w * W, f.box.h * H);
  x.strokeStyle = '#b388ff'; for (const v of s.lp.veh) x.strokeRect(v.box.x * W, v.box.y * H, v.box.w * W, v.box.h * H);
  x.restore();
}
// galat jagah? click = bolne wale ka muh yahan · Shift + click = aankh yahan
function lpClickFix(ev) {
  if (!LP_PREV) return; const s = LP_PREV.s, r = ev.target.getBoundingClientRect(), u = (ev.clientX - r.left) / r.width, v = (ev.clientY - r.top) / r.height;
  let p = s.lp.people.find((q) => q.speaking) || s.lp.people[0];
  if (!p) { p = { name: '', speaking: true, face: { x: u - 0.05, y: v - 0.08, w: 0.1, h: 0.12 }, mw: 0.02, eyes: [], ew: 0.012, body: null, facing: 'front' }; s.lp.people.push(p); }
  if (ev.shiftKey) { p.eyes = (p.eyes || []).slice(-1).concat([{ x: u, y: v }]); } else { p.mouth = { x: u, y: v }; p.speaking = true; }
  p.fixed = true; projectSave(); lpz('lpInfo').textContent = ev.shiftKey ? '👁 Eye position saved for this scene.' : '👄 Mouth position saved for this scene (the speaker talks from here).';
}
async function lpInit() {
  if (!lpz('lpBox')) return;
  const { lpSettings } = await chrome.storage.local.get('lpSettings'); LPS = { ...LP_DEF, ...(lpSettings || {}) };
  for (const id of Object.keys(LP_DEF)) { const el = lpz(id); if (!el) continue; if (el.type === 'checkbox') el.checked = !!LPS[id]; else el.value = LPS[id]; el.addEventListener('change', () => { LPS[id] = el.type === 'checkbox' ? el.checked : el.value; chrome.storage.local.set({ lpSettings: LPS }); lpPaint(); }); }
  lpz('lpReadBtn').onclick = async () => { if (!news || !news.scenes) return; await lpAnalyze(news.scenes, (t) => (lpz('lpInfo').textContent = t), true).catch((e) => addLog('🪄 ' + e.message, 'warn')); lpPaint(); };
  lpz('lpPrevBtn').onclick = () => lpPreview().catch((e) => (lpz('lpInfo').textContent = '⚠ ' + e.message));
  lpz('lpPrev').addEventListener('click', lpClickFix);
  lpz('lpBox').addEventListener('toggle', () => { if (lpz('lpBox').open) lpPaint(); else cancelAnimationFrame(LP_PREV_RAF); });
  const _rs = window.renderScenes; if (_rs) window.renderScenes = (...a) => { const r = _rs(...a); try { if (lpz('lpBox').open) lpPaint(); } catch (e) {} return r; };
  lpPaint();
}
if (typeof document !== 'undefined' && document.getElementById) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(lpInit, 540)); else setTimeout(lpInit, 540); }
