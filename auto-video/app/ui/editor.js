// Timeline editor (before the render): live preview, drag people, walks, seats, background zoom / swap,
// camera per moment, dialogue text + mute, music / effects / voice levels, your own music. Then "Render video".
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmt = (s) => { s = Math.max(0, s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return `${h ? h + ':' + String(m).padStart(2, '0') : m}:${String(Math.floor(s % 60)).padStart(2, '0')}.${Math.floor((s % 1) * 10)}`; };
const parseT = (v) => { const p = String(v).trim().split(':').map(Number); if (p.some(isNaN)) return null; return p.reduce((a, x) => a * 60 + x, 0); };
let PX = 44; // timeline pixels per second (zoom)
const SHOTS = { wide: 'Wide (whole place)', two: 'Two-shot (2 people)', speaker: 'Speaker (medium)', ots: 'Over the shoulder', cu: 'Close-up', react: 'Reaction close-up', hands: 'Hands', vehicle: 'Vehicle' };
let ED = null; // { id, tl, bgs, moods, audio, t, playing, sel, dirty }

const audio = new Audio();
const T = () => ED.t;
const sceneAt = (t) => { let s = ED.tl.scenes[0]; for (const sc of ED.tl.scenes) if (t >= sc.start - 0.001) s = sc; return s; };
const ed = () => (ED.tl.edits ||= {});
const chName = (id) => ED.tl.story.characters.find((c) => c.id === id)?.name || id;
const visChars = (sc) => (sc.cast || []).filter((id) => id !== 'narrator' && ED.tl.story.characters.some((c) => c.id === id && !c.hidden));

export async function openEditor(id) {
  $('#edModal').hidden = false; $('#edMsg').textContent = 'Loading…';
  const d = await api.call('editor:get', id); ED = { id, ...d, t: 0, playing: false, sel: null, loop: null }; audio.src = d.audio;
  $('#edScene').innerHTML = ED.tl.scenes.map((sc) => `<option value="${sc.index}">Scene ${sc.index + 1} · ${fmt(sc.start).replace(/\.\d$/, '')} · ${esc((sc.summary || '').slice(0, 40))}</option>`).join('');
  await reload(); drawAll(); $('#edMsg').textContent = '';
}
async function reload() { $('#edMsg').textContent = 'Building the preview…'; await window.AVEditor.load($('#edGl'), $('#edOut'), ED.tl); $('#edMsg').textContent = ''; frame(); }
function frame() { if (!ED || !window.AVEditor.ready()) return; ED.tl._forceWide = $('#edWide').checked; window.AVEditor.frame(ED.t); $('#edTime').textContent = `${fmt(ED.t)} / ${fmt(ED.tl.duration)}`; $('#edScrub').value = ED.t; const si = sceneAt(ED.t).index; if (+$('#edScene').value !== si) $('#edScene').value = si; drawHead(); drawMarks(); }
const changed = (rebuild) => { ED.dirty = true; window.AVEditor.invalidate(); if (rebuild) reload(); else frame(); };

// ---------- transport ----------
function seek(t) { ED.t = Math.max(0, Math.min(ED.tl.duration - 0.01, t)); if (!ED.playing) audio.currentTime = ED.t; frame(); if (!ED.playing) drawSide(); }
function loop() { if (!ED?.playing) return; ED.t = audio.currentTime; if (ED.loop && ED.t >= ED.loop[1]) { audio.pause(); ED.playing = false; $('#edPlay').textContent = '▶ Play'; seek(ED.loop[0]); return; } frame(); requestAnimationFrame(loop); }
function play(from, to) { if (ED.playing) { audio.pause(); ED.playing = false; $('#edPlay').textContent = '▶ Play'; drawSide(); return; } ED.loop = to ? [from, to] : null; audio.currentTime = from ?? ED.t; audio.play(); ED.playing = true; $('#edPlay').textContent = '⏸ Pause'; requestAnimationFrame(loop); }
audio.onended = () => { ED.playing = false; $('#edPlay').textContent = '▶ Play'; };

// ---------- timeline tracks ----------
function drawAll() { drawTracks(); drawSide(); }
// only the part of the timeline on screen is drawn (a 2-hour film has thousands of blocks)
function drawTracks() { const tl = ED.tl; $('#edScrub').max = tl.duration; const W = Math.ceil(tl.duration * PX); const tr = $('#edTracks');
  const a = Math.max(0, (tr.scrollLeft - 400) / PX), b = (tr.scrollLeft + (tr.clientWidth || 900) + 400) / PX; const vis = (t0, t1) => t1 >= a && t0 <= b;
  const cams = [...tl.shots.map((s, i) => ({ ...s, i })), ...(ed().cams || []).map((s, i) => ({ ...s, i, mine: true }))].filter((s) => vis(s.t0, s.t1));
  const walks = (ed().walks || []).map((w, i) => ({ w, i, t0: tl.scenes[w.scene].start + w.at })).filter((x) => vis(x.t0, x.t0 + (x.w.dur || 2)));
  const step = PX >= 30 ? 1 : PX >= 12 ? 5 : 10, lab = PX >= 60 ? 1 : PX >= 30 ? 5 : PX >= 12 ? 10 : 30; let ticks = '';
  for (let t = Math.floor(a / step) * step; t <= Math.min(b, tl.duration); t += step) ticks += `<i class="tk${t % lab === 0 ? ' big' : ''}" style="left:${t * PX}px">${t % lab === 0 ? fmt(t).replace(/\.\d$/, '') : ''}</i>`;
  const muted = ed().mix?.mutedLines || tl.mix?.mutedLines || [];
  tr.innerHTML = `<div class="edtrk ruler" style="width:${W}px">${ticks}</div>
    <div class="edtrk" style="width:${W}px"><span class="lab">Scenes</span>${tl.scenes.filter((sc) => vis(sc.start, sc.end)).map((sc) => `<div class="blk scene${sceneAt(ED.t) === sc ? ' on' : ''}" data-sel="scene:${sc.index}" style="left:${sc.start * PX}px;width:${(sc.end - sc.start) * PX}px">${sc.index + 1}. ${esc(sc.summary || '')}</div>`).join('')}</div>
    <div class="edtrk" style="width:${W}px"><span class="lab">Camera</span>${cams.map((s) => `<div class="blk cam${s.mine ? ' mine' : ''}${ED.sel === (s.mine ? 'mycam:' : 'cam:') + s.i ? ' sel' : ''}" data-sel="${s.mine ? 'mycam' : 'cam'}:${s.i}" style="left:${s.t0 * PX}px;width:${Math.max(4, (s.t1 - s.t0) * PX)}px" title="${esc(SHOTS[s.type] || s.type)}">${esc(s.type)}${s.char ? ' ' + esc(chName(s.char)) : ''}</div>`).join('')}</div>
    <div class="edtrk" style="width:${W}px"><span class="lab">Dialogue</span>${tl.lines.map((l, i) => [l, i]).filter(([l]) => vis(l.start, l.end)).map(([l, i]) => `<div class="blk line${muted.includes(l.id) ? ' muted' : ''}${ED.sel === 'line:' + i ? ' sel' : ''}" data-sel="line:${i}" style="left:${l.start * PX}px;width:${Math.max(4, (l.end - l.start) * PX)}px" title="${esc(l.hinglish)}">${esc(chName(l.char))}: ${esc(l.hinglish)}</div>`).join('')}</div>
    <div class="edtrk" style="width:${W}px"><span class="lab">Walks</span>${walks.map(({ w, i, t0 }) => `<div class="blk walk${ED.sel === 'walk:' + i ? ' sel' : ''}" data-sel="walk:${i}" style="left:${t0 * PX}px;width:${Math.max(4, (w.dur || 2) * PX)}px">${esc(chName(w.char))} →</div>`).join('')}</div>
    <div id="edHead" class="edhead"></div>`;
  ED.drawnA = a; ED.drawnB = b; drawHead(); }
function drawHead() { const h = $('#edHead'); if (!h) return; const x = ED.t * PX; h.style.left = x + 'px'; const tr = $('#edTracks'); if (x < tr.scrollLeft + 60 || x > tr.scrollLeft + tr.clientWidth - 60) tr.scrollLeft = Math.max(0, x - tr.clientWidth / 3); /* keep the playhead in view */ }
let scrollT = 0; $('#edTracks').onscroll = () => { if (!ED) return; cancelAnimationFrame(scrollT); scrollT = requestAnimationFrame(() => { const tr = $('#edTracks'); const a = tr.scrollLeft / PX, b = (tr.scrollLeft + tr.clientWidth) / PX; if (a < ED.drawnA + 1 || b > ED.drawnB - 1) drawTracks(); }); };
const snap = (t) => ($('#edSnap')?.checked ? Math.round(t) : t);
$('#edTracks').onclick = (e) => { const b = e.target.closest('[data-sel]'); const box = $('#edTracks').getBoundingClientRect(); const t = snap((e.clientX - box.left + $('#edTracks').scrollLeft) / PX);
  if (b) { ED.sel = b.dataset.sel; if (!ED.sel.startsWith('scene')) seek(Math.max(t, 0)); else { const sc = ED.tl.scenes[+ED.sel.split(':')[1]]; seek(Math.max(sc.start, t)); ED.sel = null; } drawAll(); } else seek(t); };

// ---------- side panel ----------
function drawSide() { if (!ED) return; const sc = sceneAt(ED.t); const [kind, idx] = (ED.sel || '').split(':'); let h = '';
  if (kind === 'cam' || kind === 'mycam') { const s = kind === 'cam' ? ED.tl.shots[+idx] : ed().cams[+idx]; const people = visChars(sceneAt(s.t0));
    h = `<h3>Camera ${fmt(s.t0)}–${fmt(s.t1)}${kind === 'mycam' ? ' (your change)' : ''}</h3>
      <label>Angle<select id="cType">${Object.entries(SHOTS).map(([k, v]) => `<option value="${k}"${k === s.type ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      <label>On<select id="cChar"><option value="">—</option>${people.map((id) => `<option value="${esc(id)}"${id === s.char ? ' selected' : ''}>${esc(chName(id))}</option>`).join('')}</select></label>
      <label>Listener (over-the-shoulder)<select id="cList"><option value="">—</option>${people.map((id) => `<option value="${esc(id)}"${id === s.listener ? ' selected' : ''}>${esc(chName(id))}</option>`).join('')}</select></label>
      ${kind === 'mycam' ? `<div class="row"><label>From (s)<input type="number" id="cT0" step="1" value="${Math.round(s.t0 * 10) / 10}"></label><label>To (s)<input type="number" id="cT1" step="1" value="${Math.round(s.t1 * 10) / 10}"></label></div>` : ''}
      <div class="btns"><button id="cApply" class="primary">Use this angle</button><button id="cSplit" class="ghost">Change only from the playhead</button>${kind === 'mycam' ? '<button id="cDel" class="danger">Remove my change</button>' : ''}</div>
      <div class="small muted">Tip: untick "Wide view" to see the camera while playing.</div>`; }
  else if (kind === 'line') { const l = ED.tl.lines[+idx]; const mx = (ED.tl.mix ||= {}); const muted = (mx.mutedLines || []).includes(l.id);
    h = `<h3>Dialogue — ${esc(chName(l.char))} (${fmt(l.start)})</h3>
      <label>Hinglish<textarea id="lHg" rows="2">${esc(l.hinglish)}</textarea></label><label>Hindi<textarea id="lHi" rows="2">${esc(l.hindi)}</textarea></label><label>English<textarea id="lEn" rows="2">${esc(l.english)}</textarea></label>
      <label>Emotion<select id="lEmo">${['neutral', 'happy', 'sad', 'angry', 'surprised', 'scared', 'tired', 'worried'].map((x) => `<option${x === l.emotion ? ' selected' : ''}>${x}</option>`).join('')}</select></label>
      <label class="check"><input type="checkbox" id="lMute"${muted ? ' checked' : ''}> Mute this line</label><label>Volume<input type="range" id="lVol" min="0" max="1.5" step="0.05" value="${mx.lineVol?.[l.id] ?? 1}"></label>
      <div class="btns"><button id="lRevoice" class="primary">Save text &amp; make new voices</button><button id="lPlay" class="ghost">▶ Play line</button></div><div class="small muted">New voices change the timing a little; your camera changes made by time may need a check after it.</div>`; }
  else if (kind === 'walk') { const w = ed().walks[+idx];
    h = `<h3>Walk — ${esc(chName(w.char))}</h3><label>Starts (s after the scene start)<input type="number" id="wAt" step="1" value="${w.at}"></label><label>Takes (seconds)<input type="number" id="wDur" step="1" value="${w.dur}"></label><label class="check"><input type="checkbox" id="wRun"${w.run ? ' checked' : ''}> Run</label>
      <div class="btns"><button id="wDel" class="danger">Delete walk</button><button id="wPlay" class="ghost">▶ Play it</button></div>`; }
  else { const people = visChars(sc); const b = window.AVEditor.info?.(ED.t); const marks = (b?.marks || []).map((m, i) => ({ ...m, i })).filter((m) => m.type !== 'door' && m.type !== 'window'); const pos = ed().pos?.[sc.index] || {}; const be = ed().bg?.[sc.index] || {};
    h = `<h3>Scene ${sc.index + 1} <span class="small muted">${fmt(sc.start)}–${fmt(sc.end)}</span></h3><div class="small">${esc(sc.summary || '')}</div>
      <label>Background<select id="sBg">${ED.backgrounds.map((x) => `<option value="${esc(x.id)}"${x.id === sc.background ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
      <div class="row"><label>Zoom<input type="range" id="sZoom" min="1" max="1.8" step="0.01" value="${be.zoom || 1}"></label><label>Left / right<input type="range" id="sDx" min="-0.4" max="0.4" step="0.005" value="${be.dx || 0}"></label><label>Up / down<input type="range" id="sDy" min="-0.3" max="0.3" step="0.005" value="${be.dy || 0}"></label></div>
      <div class="btns"><button id="sPlay" class="ghost">▶ Play this scene</button></div>
      <h3>People at the start of this scene</h3><div class="small muted">Drag a person in the preview (Wide view) or use the sliders. "Add walk" then click where they should walk to.</div>
      ${people.map((id) => { const p = pos[id] || {}; const ch = ED.tl.story.characters.find((c) => c.id === id) || {}; return `<div class="edch" data-id="${esc(id)}"><b>${esc(chName(id))}</b>
        <label>Place<select data-k="seat"><option value="">auto</option><option value="-1"${p.seat === -1 ? ' selected' : ''}>standing (free)</option>${marks.map((m) => `<option value="${m.i}"${p.seat === m.i ? ' selected' : ''}>${m.type} ${m.i + 1}</option>`).join('')}</select></label>
        <label>Faces<select data-k="face"><option value="">auto</option><option value="1"${p.face === 1 ? ' selected' : ''}>right</option><option value="-1"${p.face === -1 ? ' selected' : ''}>left</option></select></label>
        <label class="check"><input type="checkbox" data-k="hidden"${p.hidden ? ' checked' : ''}> hidden</label>
        <label>Height<input type="range" data-k="size" min="0.7" max="1.3" step="0.02" value="${ch.size || 1}"></label><label>Width<input type="range" data-k="width" min="0.75" max="1.3" step="0.02" value="${ch.width || 1}"></label>
        <button class="ghost" data-walk="${esc(id)}">Add walk ➜</button></div>`; }).join('')}`; }
  $('#edSide').innerHTML = h; bindSide(kind, +idx); }

function bindSide(kind, idx) { const on = (sel, ev, fn) => { const el = $(sel); if (el) el[ev] = fn; };
  if (kind === 'cam' || kind === 'mycam') { const src = kind === 'cam' ? ED.tl.shots[idx] : ed().cams[idx];
    const val = () => ({ type: $('#cType').value, char: $('#cChar').value || undefined, listener: $('#cList').value || undefined });
    on('#cApply', 'onclick', () => { if (kind === 'mycam') Object.assign(src, val()); else (ed().cams ||= []).push({ t0: src.t0, t1: src.t1, ...val() }); changed(); drawAll(); });
    on('#cT0', 'onchange', (e) => { src.t0 = Math.max(0, Math.min(src.t1 - 0.5, +e.target.value)); changed(); drawAll(); }); on('#cT1', 'onchange', (e) => { src.t1 = Math.min(ED.tl.duration, Math.max(src.t0 + 0.5, +e.target.value)); changed(); drawAll(); });
    on('#cSplit', 'onclick', () => { const t0 = Math.max(src.t0, snap(ED.t)); (ed().cams ||= []).push({ t0, t1: src.t1, ...val() }); changed(); drawAll(); });
    on('#cDel', 'onclick', () => { ed().cams.splice(idx, 1); ED.sel = null; changed(); drawAll(); }); }
  if (kind === 'line') { const l = ED.tl.lines[idx]; const mx = (ED.tl.mix ||= {});
    on('#lMute', 'onchange', (e) => { mx.mutedLines = (mx.mutedLines || []).filter((x) => x !== l.id); if (e.target.checked) mx.mutedLines.push(l.id); ED.audioDirty = true; drawAll(); });
    on('#lVol', 'oninput', (e) => { (mx.lineVol ||= {})[l.id] = +e.target.value; ED.audioDirty = true; });
    on('#lPlay', 'onclick', () => play(l.start - 0.2, l.end + 0.3));
    on('#lRevoice', 'onclick', async () => { l.hinglish = $('#lHg').value; l.hindi = $('#lHi').value; l.english = $('#lEn').value; l.emotion = $('#lEmo').value; $('#edMsg').textContent = 'Making new voices…';
      const r = await api.call('editor:revoice', { id: ED.id, tl: strip() }); ED.tl = r.tl; audio.src = r.audio; await reload(); drawAll(); $('#edMsg').textContent = 'New voices ready ✓'; }); }
  if (kind === 'walk') { const w = ed().walks[idx];
    on('#wAt', 'oninput', (e) => { w.at = Math.max(0, +e.target.value); changed(); drawAll(); }); on('#wDur', 'oninput', (e) => { w.dur = Math.max(0.4, +e.target.value); changed(); drawAll(); });
    on('#wRun', 'onchange', (e) => { w.run = e.target.checked; changed(); }); on('#wDel', 'onclick', () => { ed().walks.splice(idx, 1); ED.sel = null; changed(); drawAll(); });
    on('#wPlay', 'onclick', () => { const sc = ED.tl.scenes[w.scene]; play(sc.start + w.at - 0.3, sc.start + w.at + w.dur + 0.5); }); }
  if (!kind) { const sc = sceneAt(ED.t); const be = () => ((ed().bg ||= {})[sc.index] ||= {});
    on('#sBg', 'onchange', async (e) => { const b = ED.backgrounds.find((x) => x.id === e.target.value); if (!b) return; const { url, tag, ...meta } = b; ED.tl.backgrounds[b.id] = meta; sc.background = b.id; ED.dirty = true; await reload(); drawAll(); });
    for (const [id, k] of [['#sZoom', 'zoom'], ['#sDx', 'dx'], ['#sDy', 'dy']]) on(id, 'oninput', (e) => { be()[k] = +e.target.value; changed(); });
    on('#sPlay', 'onclick', () => play(sc.start, sc.end));
    $('#edSide').querySelectorAll('.edch').forEach((row) => { const id = row.dataset.id; const P = () => (((ed().pos ||= {})[sc.index] ||= {})[id] ||= {}); const ch = ED.tl.story.characters.find((c) => c.id === id);
      row.oninput = (e) => { const k = e.target.dataset.k; if (!k) return;
        if (k === 'seat') { const v = e.target.value; if (v === '') delete P().seat; else P().seat = +v; changed(); }
        else if (k === 'face') { const v = e.target.value; if (v === '') delete P().face; else P().face = +v; changed(); }
        else if (k === 'hidden') { P().hidden = e.target.checked; changed(); }
        else if (k === 'size' || k === 'width') { ch[k] = +e.target.value; clearTimeout(ED.rt); ED.rt = setTimeout(() => changed(true), 350); } };
      row.querySelector('[data-walk]').onclick = () => { ED.walkFor = id; $('#edMsg').textContent = `Click in the preview where ${chName(id)} should walk to (starts at ${fmt(ED.t)}).`; $('#edWide').checked = true; frame(); }; }); } }
const strip = () => { const t = { ...ED.tl }; delete t._forceWide; return t; };

// ---------- preview: drag people, pick walk targets ----------
function drawMarks() { const c = $('#edOv'); const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); if (!$('#edWide').checked) return; const info = window.AVEditor.info(ED.t); if (!info) return;
  const W = c.width, H = c.height; const toPx = (sx, sy) => [((sx * info.AR - info.cam.l) / (info.cam.r - info.cam.l)) * W, ((info.cam.t - (1 - sy)) / (info.cam.t - info.cam.b)) * H];
  x.strokeStyle = 'rgba(80,220,140,.7)'; x.setLineDash([6, 6]); const [, gn] = toPx(0, info.b.groundNear); const [, gf] = toPx(0, info.b.groundFar); x.beginPath(); x.moveTo(0, gn); x.lineTo(W, gn); x.stroke(); x.strokeStyle = 'rgba(100,170,255,.6)'; x.beginPath(); x.moveTo(0, gf); x.lineTo(W, gf); x.stroke(); x.setLineDash([]);
  info.marks.forEach((m, i) => { const [px, py] = toPx(m.x, m.y); x.fillStyle = 'rgba(255,200,60,.9)'; x.beginPath(); x.arc(px, py, 5, 0, 7); x.fill(); x.font = '11px sans-serif'; x.fillText(`${m.type} ${i + 1}`, px + 7, py - 4); }); }
const ovXY = (e) => { const r = $('#edOv').getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
$('#edOv').onmousedown = (e) => { if (!ED) return; const [nx, ny] = ovXY(e); const sc = sceneAt(ED.t);
  if (ED.walkFor) { const p = window.AVEditor.toStage(nx, ny, ED.t); if (p) { const from = (ed().pos?.[sc.index]?.[ED.walkFor]?.x ?? 0.5); (ed().walks ||= []).push({ scene: sc.index, char: ED.walkFor, toX: +p.x.toFixed(3), toRow: +p.row.toFixed(3), at: +snap(ED.t - sc.start).toFixed(2), dur: +Math.max(1, Math.abs(p.x - from) * 6).toFixed(1) }); ED.sel = 'walk:' + (ed().walks.length - 1); } ED.walkFor = null; $('#edMsg').textContent = ''; changed(); drawAll(); return; }
  if (!$('#edWide').checked) return; const id = window.AVEditor.pick(nx, ny); if (!id) return; ED.drag = id;
  const move = (ev) => { const [mx, my] = ovXY(ev); const p = window.AVEditor.toStage(mx, my, ED.t); if (!p) return; const P = (((ed().pos ||= {})[sc.index] ||= {})[id] ||= {}); P.x = +p.x.toFixed(3); P.row = +p.row.toFixed(3); P.seat = -1; changed(); };
  const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); ED.drag = null; drawSide(); }; window.addEventListener('mousemove', move); window.addEventListener('mouseup', up); };

// ---------- audio panel ----------
function drawAudio() { const mx = (ED.tl.mix ||= {}); $('#edAudio').innerHTML = `<h3>Sound</h3>
  <div class="row"><label>Voices<input type="range" id="aV" min="0" max="1.5" step="0.05" value="${mx.voice ?? 1}"></label><label>Music<input type="range" id="aM" min="0" max="1.5" step="0.05" value="${mx.music ?? 1}"></label><label>Effects &amp; ambience<input type="range" id="aX" min="0" max="1.5" step="0.05" value="${mx.sfx ?? 1}"></label></div>
  <div class="row"><label>Music style<select id="aMood"><option value="">Genre default (${esc(ED.mood)})</option>${ED.moods.map((m) => `<option${m === mx.mood ? ' selected' : ''}>${m}</option>`).join('')}</select></label><div><div class="small muted">${mx.musicName ? 'Your music: ' + esc(mx.musicName) : 'Your own music file (mp3 / wav)'}</div><div class="btns"><button id="aFile" class="ghost">Choose music…</button>${mx.musicWav ? '<button id="aFileX" class="ghost">Use generated music</button>' : ''}</div></div></div>
  <div class="btns"><button id="aApply" class="primary">Update sound</button><span class="small muted">Mute a single line: click it in the Dialogue track.</span></div>`;
  const set = (k) => (e) => { mx[k] = +e.target.value; ED.audioDirty = true; }; $('#aV').oninput = set('voice'); $('#aM').oninput = set('music'); $('#aX').oninput = set('sfx');
  $('#aMood').onchange = (e) => { mx.mood = e.target.value || undefined; ED.audioDirty = true; };
  $('#aFile').onclick = async () => { const r = await api.call('editor:music', { id: ED.id }); if (r) { mx.musicWav = r.file; mx.musicName = r.name; ED.audioDirty = true; drawAudio(); } };
  const x = $('#aFileX'); if (x) x.onclick = () => { delete mx.musicWav; delete mx.musicName; ED.audioDirty = true; drawAudio(); };
  $('#aApply').onclick = remix; }
async function remix() { $('#edMsg').textContent = 'Mixing the sound…'; const t = ED.t; audio.src = await api.call('editor:remix', { id: ED.id, tl: strip() }); audio.currentTime = t; ED.audioDirty = false; $('#edMsg').textContent = 'Sound updated ✓'; }

// ---------- buttons ----------
$('#edPlay').onclick = () => play(); $('#edScrub').oninput = (e) => seek(+e.target.value); $('#edWide').onchange = frame;
$('#edBack').onclick = () => seek(Math.round(ED.t) - 1); $('#edFwd').onclick = () => seek(Math.round(ED.t) + 1);
$('#edZoom').oninput = (e) => { const t = ED.t; PX = +e.target.value; drawTracks(); const tr = $('#edTracks'); tr.scrollLeft = Math.max(0, t * PX - tr.clientWidth / 3); drawTracks(); };
$('#edGo').onchange = (e) => { const t = parseT(e.target.value); if (t != null) seek(t); e.target.value = ''; };
$('#edScene').onchange = (e) => { const sc = ED.tl.scenes[+e.target.value]; if (sc) seek(sc.start); };
window.addEventListener('keydown', (e) => { if (!ED || $('#edModal').hidden || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
  if (e.key === 'ArrowRight') { seek(Math.round(ED.t) + (e.shiftKey ? 10 : 1)); e.preventDefault(); } else if (e.key === 'ArrowLeft') { seek(Math.round(ED.t) - (e.shiftKey ? 10 : 1)); e.preventDefault(); } else if (e.key === ' ') { play(); e.preventDefault(); } }); /* ← → = 1 second, Shift = 10 s, Space = play */
$('#edSave').onclick = async () => { await api.call('editor:save', { id: ED.id, tl: strip() }); ED.dirty = false; $('#edMsg').textContent = 'Saved ✓'; };
$('#edClose').onclick = async () => { if (ED?.playing) play(); if (ED) await api.call('editor:save', { id: ED.id, tl: strip() }); $('#edModal').hidden = true; };
$('#edRender').onclick = async () => { if (ED.playing) play(); if (ED.audioDirty) await remix(); const q = await api.call('editor:render', { id: ED.id, tl: strip() }); $('#edModal').hidden = true; window.AVRenderQueue?.(q); };
window.AVOpenEditor = async (id) => { await openEditor(id); drawAudio(); };

// ---------- draft preview: a real MP4 (with sound) of one part, made in a minute or two ----------
async function previewMp4(from, to) { if (ED.playing) play(); if (ED.audioDirty) await remix(); $('#edMsg').textContent = 'Making the preview MP4…';
  try { const u = await api.call('editor:preview', { id: ED.id, tl: strip(), from, to }); $('#playerVideo').src = u; $('#player').hidden = false; $('#playerVideo').play(); $('#edMsg').textContent = 'Preview ready ✓ (the final video looks the same, with subtitles added)'; }
  catch (e) { $('#edMsg').textContent = '✗ ' + String(e.message || e).replace(/^Error invoking remote method[^:]*: (Error: )?/, ''); } }
$('#edPrevScene').onclick = () => { const sc = sceneAt(ED.t); previewMp4(sc.start, sc.end); };
$('#edPrev30').onclick = () => previewMp4(ED.t, Math.min(ED.tl.duration, ED.t + 30));
