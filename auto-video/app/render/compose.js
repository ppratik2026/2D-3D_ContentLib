// Canvas-2D compositor for the Chrome renderer: 3D frame + look (filters, grain, vignette, bars) + subtitles + title/end cards.
// Same looks and subtitle styles as the Remotion version (remotion/Story.jsx).
const FONT = '"Poppins","Noto Sans","Noto Sans Devanagari","Nirmala UI","Mangal","Segoe UI","DejaVu Sans",Arial,sans-serif';
const LOOK_FILTER = {
  none: 'none', vivid: 'saturate(1.35) contrast(1.06)', film: 'contrast(1.07) saturate(0.92) sepia(0.1)',
  oldfilm: 'sepia(0.85) contrast(1.18) saturate(0.9)', noir: 'grayscale(1) contrast(1.35) brightness(0.95)',
  dreamy: 'brightness(1.03) saturate(0.95) contrast(0.97)', horror: 'saturate(0.45) contrast(1.22) brightness(0.78)',
};
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerpk = (t, a, b) => clamp((t - a) / (b - a));

export function makeComposer(W, H) {
  const grains = Array.from({ length: 6 }, (_, k) => { const c = document.createElement('canvas'); c.width = W / 2; c.height = H / 2; const x = c.getContext('2d'); const d = x.createImageData(c.width, c.height);
    let s = 1234 + k * 777; for (let i = 0; i < d.data.length; i += 4) { s = (s * 16807) % 2147483647; const v = (s / 2147483647) * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } x.putImageData(d, 0, 0); return c; });
  const vignette = (ctx, a) => { const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); };
  const grain = (ctx, frame, a) => { ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = 'overlay'; ctx.drawImage(grains[frame % grains.length], 0, 0, W, H); ctx.restore(); };

  function wrap(ctx, text, maxW) { const words = String(text).split(/\s+/); const lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur); return lines; }
  function box(ctx, x, y, w, h, r, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); }

  function subtitle(ctx, tl, t) {
    const style = tl.subs; if (style === 'none') return;
    const l = tl.lines.find((x) => t >= x.start - 0.05 && t < x.end + 0.25); if (!l) return;
    const who = tl.story.characters.find((c) => c.id === l.char); const nar = l.char === 'narrator'; const name = who ? who.name : l.char;
    const a = Math.min(lerpk(t, l.start - 0.05, l.start + 0.1), 1 - lerpk(t, l.end + 0.1, l.end + 0.25));
    const text = style === 'hindi' ? l.hindi : l.hinglish; const bottom = H * (tl.look === 'film' ? 0.9 : 0.93);
    ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    if (nar && style !== 'none') { ctx.font = `italic 600 36px ${FONT}`; const lines = wrap(ctx, text, W * 0.82); const lh = 46; const bw = Math.max(...lines.map((x) => ctx.measureText(x).width)) + 40;
      box(ctx, W / 2 - bw / 2, bottom - 38 - (lines.length - 1) * lh, bw, lines.length * lh + 16, 8, 'rgba(20,14,0,0.62)'); ctx.fillStyle = '#ffe9a8'; lines.forEach((ln, i) => ctx.fillText(ln, W / 2, bottom - (lines.length - 1 - i) * lh)); }
    else if (style === 'youtube') { ctx.font = `900 46px ${FONT}`; const lines = wrap(ctx, `${name}: ${text}`, W * 0.86); lines.forEach((ln, i) => { const y = bottom - (lines.length - 1 - i) * 54;
        ctx.lineWidth = 8; ctx.strokeStyle = '#000'; ctx.lineJoin = 'round'; ctx.strokeText(ln, W / 2, y); ctx.fillStyle = i === 0 ? '#fff' : '#fff'; ctx.fillText(ln, W / 2, y); });
      // name in yellow on the first line
      const first = lines[0]; if (first.startsWith(name + ':')) { const full = ctx.measureText(first).width, nw = ctx.measureText(name + ': ').width; const y = bottom - (lines.length - 1) * 54; ctx.textAlign = 'left'; ctx.lineWidth = 8; ctx.strokeText(name + ':', W / 2 - full / 2, y); ctx.fillStyle = '#ffd400'; ctx.fillText(name + ':', W / 2 - full / 2, y); void nw; } }
    else if (style === 'cinematic') { ctx.font = `italic 30px ${FONT}`; const lines = wrap(ctx, text, W * 0.8); ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 8; ctx.fillStyle = '#f3efe6'; lines.forEach((ln, i) => ctx.fillText(ln, W / 2, bottom - (lines.length - 1 - i) * 38)); }
    else if (style === 'karaoke') { ctx.font = `800 40px ${FONT}`; const words = text.split(/\s+/); const pre = name + ': '; const tw = ctx.measureText(pre + text).width; const total = words.reduce((s, w) => s + w.length + 1, 0);
      const p = clamp((t - l.start) / Math.max(0.3, l.end - l.start)) * total; box(ctx, W / 2 - tw / 2 - 18, bottom - 46, tw + 36, 62, 12, 'rgba(0,0,0,0.55)');
      ctx.textAlign = 'left'; let x = W / 2 - tw / 2; ctx.fillStyle = '#7fd3ff'; ctx.fillText(pre, x, bottom); x += ctx.measureText(pre).width; let acc = 0;
      for (const w of words) { ctx.fillStyle = acc <= p ? '#ffd400' : '#ffffff'; acc += w.length + 1; ctx.fillText(w + ' ', x, bottom); x += ctx.measureText(w + ' ').width; } }
    else if (style === 'dual') { ctx.font = `800 36px ${FONT}`; const top = `${name}: ${l.hinglish}`; const w1 = ctx.measureText(top).width; ctx.font = `26px ${FONT}`; const w2 = ctx.measureText(l.english).width; const bw = Math.min(W * 0.92, Math.max(w1, w2) + 36);
      box(ctx, W / 2 - bw / 2, bottom - 82, bw, 100, 10, 'rgba(0,0,0,0.55)'); ctx.font = `800 36px ${FONT}`; ctx.fillStyle = '#fff'; ctx.fillText(top, W / 2, bottom - 38, W * 0.9); ctx.font = `26px ${FONT}`; ctx.fillStyle = '#cfe8ff'; ctx.fillText(l.english, W / 2, bottom + 2, W * 0.9); }
    else { ctx.font = `700 36px ${FONT}`; const lines = wrap(ctx, `${name}: ${text}`, W * 0.84); const lh = 46; const bw = Math.max(...lines.map((x) => ctx.measureText(x).width)) + 36;
      box(ctx, W / 2 - bw / 2, bottom - 38 - (lines.length - 1) * lh, bw, lines.length * lh + 16, 8, 'rgba(0,0,0,0.6)');
      lines.forEach((ln, i) => { const y = bottom - (lines.length - 1 - i) * lh; ctx.fillStyle = '#fff'; ctx.fillText(ln, W / 2, y); });
      const first = lines[0]; if (first.startsWith(name + ':')) { const full = ctx.measureText(first).width; ctx.textAlign = 'left'; ctx.fillStyle = '#ffd166'; ctx.fillText(name + ':', W / 2 - full / 2, bottom - (lines.length - 1) * lh); } }
    ctx.restore();
  }
  function sceneCard(ctx, tl, t) { // "Agle din…" cards inside the story
    for (const c of tl.cards || []) { if (t < c.t0 || t >= c.t1) continue; const o = Math.min(lerpk(t, c.t0, c.t0 + 0.35), 1 - lerpk(t, c.t1 - 0.35, c.t1));
      ctx.save(); ctx.globalAlpha = o; ctx.fillStyle = 'rgba(5,6,10,0.82)'; ctx.fillRect(0, 0, W, H); ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = `800 60px ${FONT}`; ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 16;
      const lines = wrap(ctx, c.text, W * 0.8); lines.forEach((ln, i) => ctx.fillText(ln, W / 2, H / 2 + 20 - (lines.length - 1) * 36 + i * 72)); ctx.restore(); }
  }
  function titleCard(ctx, tl, t) {
    const o = 1 - lerpk(t, 2.7, 3.2); if (o <= 0) return; const s = tl.story; const sc = 1 + 0.06 * clamp(t / 3.2);
    ctx.save(); ctx.globalAlpha = o; ctx.fillStyle = 'rgba(5,6,10,0.78)'; ctx.fillRect(0, 0, W, H);
    ctx.translate(W / 2, H / 2); ctx.scale(sc, sc); ctx.textAlign = 'center'; ctx.fillStyle = '#ffd166'; ctx.font = `26px ${FONT}`; ctx.fillText((String(tl.categoryLabel || '') + (tl.episodeLabel ? ' · ' + tl.episodeLabel : '')).toUpperCase().split('').join(' '), 0, -70);
    ctx.fillStyle = '#fff'; ctx.font = `900 76px ${FONT}`; ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 20; ctx.fillText(s.title, 0, 10, W * 0.9);
    if (s.title_hindi && s.title_hindi.trim().toLowerCase() !== String(s.title).trim().toLowerCase()) { ctx.shadowBlur = 0; ctx.font = `40px ${FONT}`; ctx.globalAlpha = o * 0.9; ctx.fillText(s.title_hindi, 0, 70, W * 0.9); }
    ctx.restore();
  }
  function endCard(ctx, tl, t) {
    const o = lerpk(t, tl.duration - 3.0, tl.duration - 2.4); if (o <= 0) return;
    ctx.save(); ctx.globalAlpha = o; ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, W, H); ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    let y = H / 2; if (tl.story.moral) { ctx.font = `700 40px ${FONT}`; const lines = wrap(ctx, tl.story.moral, W * 0.8); y = H / 2 - (lines.length - 1) * 28; lines.forEach((ln, i) => ctx.fillText(ln, W / 2, y + i * 56)); y += lines.length * 56; }
    ctx.fillStyle = '#ffd166'; ctx.font = `30px ${FONT}`; ctx.fillText('T H E   E N D', W / 2, y + 30); ctx.restore();
  }

  // ---------- weather & horror effects ----------
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const sceneAt = (tl, t) => { let s = tl.scenes[0]; for (const sc of tl.scenes) if (t >= sc.start - 0.001) s = sc; return s; };
  function flashAt(tl, t) { let f = 0; for (const c of tl.cues || []) if (c.kind === 'thunder') { const d = t - c.t; if (d >= 0 && d < 0.12) f = Math.max(f, 0.9); else if (d >= 0.2 && d < 0.3) f = Math.max(f, 0.5); } return f; }
  function shakeAt(tl, sc, t, frame) { let k = 0; for (const e of sc.events || []) if (e.kind === 'gesture' && e.name === 'shock' && t >= e.t0 && t < e.t0 + 0.6) k = 1; for (const c of tl.cues || []) if (c.kind === 'thunder' && t >= c.t && t < c.t + 0.5) k = Math.max(k, 0.7);
    return k ? [(hash(frame, 1) - 0.5) * 12 * k, (hash(frame, 2) - 0.5) * 8 * k] : [0, 0]; }
  function rain(ctx, frame, n, a) { ctx.save(); ctx.strokeStyle = `rgba(200,212,255,${a})`; ctx.lineWidth = 1.4; ctx.beginPath();
    for (let i = 0; i < n; i++) { const x = hash(i, 7) * (W + 200) - 100, sp = 0.6 + hash(i, 9) * 0.8, y = ((hash(i, 3) * H + frame * 38 * sp) % (H + 60)) - 30; ctx.moveTo(x + (y / H) * 40, y); ctx.lineTo(x + (y / H) * 40 + 7, y + 22 * sp); } ctx.stroke(); ctx.restore(); }
  function fog(ctx, t) { ctx.save(); for (let i = 0; i < 4; i++) { const x = ((t * (12 + i * 6) + i * 400) % (W + 800)) - 400, y = H * (0.55 + 0.12 * Math.sin(i * 2 + t * 0.2)); const g = ctx.createRadialGradient(x, y, 20, x, y, 460);
      g.addColorStop(0, 'rgba(210,218,228,0.32)'); g.addColorStop(1, 'rgba(210,218,228,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); } ctx.restore(); }
  function wind(ctx, frame) { ctx.save(); for (let i = 0; i < 40; i++) { const sp = 0.5 + hash(i, 4); const x = ((hash(i, 5) * W + frame * 14 * sp) % (W + 40)) - 20, y = hash(i, 6) * H * 0.9 + Math.sin(frame * 0.1 + i) * 12;
      ctx.fillStyle = i % 3 ? 'rgba(120,90,50,0.7)' : 'rgba(80,110,40,0.7)'; ctx.beginPath(); ctx.ellipse(x, y, 4, 2, frame * 0.2 + i, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }

  return function compose(ctx, src, tl, t, frame) {
    const look = tl.look || 'none'; const sc = sceneAt(tl, t) || {}; const [dx, dy] = shakeAt(tl, sc, t, frame); const zoomPad = dx || dy ? 1.02 : 1;
    ctx.save(); let f = LOOK_FILTER[look] || 'none'; if (look === 'oldfilm') f += ` brightness(${1 + 0.06 * Math.sin(frame * 1.3)})`; ctx.filter = f; ctx.drawImage(src, dx - (W * (zoomPad - 1)) / 2, dy - (H * (zoomPad - 1)) / 2, W * zoomPad, H * zoomPad); ctx.restore();
    const wx = sc.weather || 'none';
    if (wx === 'rain' || wx === 'storm') { ctx.fillStyle = 'rgba(20,30,60,0.18)'; ctx.fillRect(0, 0, W, H); rain(ctx, frame, wx === 'storm' ? 320 : 200, wx === 'storm' ? 0.45 : 0.32); }
    if (wx === 'underwater') { ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(40,140,190,0.55)'; ctx.fillRect(0, 0, W, H); ctx.restore(); ctx.save(); ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 6; i++) { const x0 = ((i * 260 + Math.sin(t * 0.4 + i) * 60) % (W + 200)) - 100; const g = ctx.createLinearGradient(x0, 0, x0 + 120, H); g.addColorStop(0, 'rgba(200,240,255,0.18)'); g.addColorStop(1, 'rgba(200,240,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + 90, 0); ctx.lineTo(x0 + 260, H); ctx.lineTo(x0 + 120, H); ctx.fill(); } ctx.restore();
      ctx.save(); ctx.strokeStyle = 'rgba(230,248,255,0.75)'; ctx.lineWidth = 1.5; for (let i = 0; i < 50; i++) { const sp = 0.5 + hash(i, 3); const x = hash(i, 4) * W + Math.sin(frame * 0.05 + i) * 8; const y = H - ((hash(i, 5) * H + frame * 2.2 * sp) % (H + 20)); ctx.beginPath(); ctx.arc(x, y, 2 + sp * 4, 0, Math.PI * 2); ctx.stroke(); } ctx.restore(); }
    if (wx === 'snow') { ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.9)'; for (let i = 0; i < 160; i++) { const sp = 0.4 + hash(i, 2) * 0.6; const x = ((hash(i, 8) * W + Math.sin(frame * 0.03 + i) * 30) % W + W) % W, y = ((hash(i, 1) * H + frame * 3 * sp) % (H + 20)) - 10; ctx.beginPath(); ctx.arc(x, y, 1.5 + sp * 2.5, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }
    if (wx === 'fog') fog(ctx, t); if (wx === 'wind') wind(ctx, frame);
    const fl = flashAt(tl, t); if (fl) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = `rgba(225,232,255,${fl * 0.7})`; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    if (look === 'film') { vignette(ctx, 0.35); grain(ctx, frame, 0.18); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H * 0.08); ctx.fillRect(0, H * 0.92, W, H * 0.08); }
    if (look === 'oldfilm') { vignette(ctx, 0.6); grain(ctx, frame, 0.45); const fl = 0.08 * Math.sin(frame * 1.7) + 0.05 * Math.sin(frame * 4.1); if (fl > 0) { ctx.fillStyle = `rgba(255,240,200,${fl})`; ctx.fillRect(0, 0, W, H); }
      if (frame % 11 < 3) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect((frame * 397) % W, 0, 2, H); } }
    if (look === 'noir') { vignette(ctx, 0.55); grain(ctx, frame, 0.22); }
    if (look === 'dreamy') { const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H); g.addColorStop(0, 'rgba(255,230,240,0)'); g.addColorStop(1, 'rgba(255,225,235,0.28)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    if (look === 'horror') { vignette(ctx, 0.75); ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(20,60,90,0.25)'; ctx.fillRect(0, 0, W, H); ctx.restore(); grain(ctx, frame, 0.3); }
    if (look === 'vivid') vignette(ctx, 0.2);
    subtitle(ctx, tl, t); sceneCard(ctx, tl, t); titleCard(ctx, tl, t); endCard(ctx, tl, t);
  };
}
