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
    const who = tl.story.characters.find((c) => c.id === l.char); const name = who ? who.name : l.char;
    const a = Math.min(lerpk(t, l.start - 0.05, l.start + 0.1), 1 - lerpk(t, l.end + 0.1, l.end + 0.25));
    const text = style === 'hindi' ? l.hindi : l.hinglish; const bottom = H * (tl.look === 'film' ? 0.9 : 0.93);
    ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    if (style === 'youtube') { ctx.font = `900 46px ${FONT}`; const lines = wrap(ctx, `${name}: ${text}`, W * 0.86); lines.forEach((ln, i) => { const y = bottom - (lines.length - 1 - i) * 54;
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
  function titleCard(ctx, tl, t) {
    const o = 1 - lerpk(t, 2.7, 3.2); if (o <= 0) return; const s = tl.story; const sc = 1 + 0.06 * clamp(t / 3.2);
    ctx.save(); ctx.globalAlpha = o; ctx.fillStyle = 'rgba(5,6,10,0.78)'; ctx.fillRect(0, 0, W, H);
    ctx.translate(W / 2, H / 2); ctx.scale(sc, sc); ctx.textAlign = 'center'; ctx.fillStyle = '#ffd166'; ctx.font = `26px ${FONT}`; ctx.fillText(String(tl.categoryLabel || '').toUpperCase().split('').join(' '), 0, -70);
    ctx.fillStyle = '#fff'; ctx.font = `900 76px ${FONT}`; ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 20; ctx.fillText(s.title, 0, 10, W * 0.9);
    if (s.title_hindi) { ctx.shadowBlur = 0; ctx.font = `40px ${FONT}`; ctx.globalAlpha = o * 0.9; ctx.fillText(s.title_hindi, 0, 70, W * 0.9); }
    ctx.restore();
  }
  function endCard(ctx, tl, t) {
    const o = lerpk(t, tl.duration - 3.0, tl.duration - 2.4); if (o <= 0) return;
    ctx.save(); ctx.globalAlpha = o; ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, W, H); ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    let y = H / 2; if (tl.story.moral) { ctx.font = `700 40px ${FONT}`; const lines = wrap(ctx, tl.story.moral, W * 0.8); y = H / 2 - (lines.length - 1) * 28; lines.forEach((ln, i) => ctx.fillText(ln, W / 2, y + i * 56)); y += lines.length * 56; }
    ctx.fillStyle = '#ffd166'; ctx.font = `30px ${FONT}`; ctx.fillText('T H E   E N D', W / 2, y + 30); ctx.restore();
  }

  return function compose(ctx, src, tl, t, frame) {
    const look = tl.look || 'none';
    ctx.save(); let f = LOOK_FILTER[look] || 'none'; if (look === 'oldfilm') f += ` brightness(${1 + 0.06 * Math.sin(frame * 1.3)})`; ctx.filter = f; ctx.drawImage(src, 0, 0, W, H); ctx.restore();
    if (look === 'film') { vignette(ctx, 0.35); grain(ctx, frame, 0.18); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H * 0.08); ctx.fillRect(0, H * 0.92, W, H * 0.08); }
    if (look === 'oldfilm') { vignette(ctx, 0.6); grain(ctx, frame, 0.45); const fl = 0.08 * Math.sin(frame * 1.7) + 0.05 * Math.sin(frame * 4.1); if (fl > 0) { ctx.fillStyle = `rgba(255,240,200,${fl})`; ctx.fillRect(0, 0, W, H); }
      if (frame % 11 < 3) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect((frame * 397) % W, 0, 2, H); } }
    if (look === 'noir') { vignette(ctx, 0.55); grain(ctx, frame, 0.22); }
    if (look === 'dreamy') { const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H); g.addColorStop(0, 'rgba(255,230,240,0)'); g.addColorStop(1, 'rgba(255,225,235,0.28)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    if (look === 'horror') { vignette(ctx, 0.75); ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(20,60,90,0.25)'; ctx.fillRect(0, 0, W, H); ctx.restore(); grain(ctx, frame, 0.3); }
    if (look === 'vivid') vignette(ctx, 0.2);
    subtitle(ctx, tl, t); titleCard(ctx, tl, t); endCard(ctx, tl, t);
  };
}
