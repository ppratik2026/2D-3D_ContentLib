import React, { useEffect, useRef, useState } from 'react';
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig, delayRender, continueRender, interpolate } from 'remotion';
import { createEngine } from './engine/index.js';

const asset = (f) => staticFile('assets/' + f);
const FONT = '"Poppins","Noto Sans","Noto Sans Devanagari","Nirmala UI","Mangal","DejaVu Sans",Arial,sans-serif';

function Stage({ tl }) {
  const ref = useRef(null); const eng = useRef(null); const frame = useCurrentFrame(); const { fps, width, height } = useVideoConfig();
  const [handle] = useState(() => delayRender('Loading 3D scene', { timeoutInMilliseconds: 600000 }));
  const [ready, setReady] = useState(false);
  useEffect(() => { let dead = false;
    createEngine({ canvas: ref.current, width, height, tl, url: asset }).then((e) => { if (dead) return; eng.current = e; setReady(true); continueRender(handle); })
      .catch((err) => { console.error(err); throw err; });
    return () => { dead = true; }; }, []);
  if (ready && eng.current && !(tl.perf && tl.perf.blank)) eng.current.renderAt(frame / fps);
  return <canvas ref={ref} width={width} height={height} style={{ width: '100%', height: '100%', display: 'block' }} />;
}

// ---------- looks (type 8) ----------
const LOOK_CSS = {
  none: '', vivid: 'saturate(1.35) contrast(1.06)', film: 'contrast(1.07) saturate(0.92) sepia(0.1)',
  oldfilm: 'sepia(0.85) contrast(1.18) saturate(0.9)', noir: 'grayscale(1) contrast(1.35) brightness(0.95)',
  dreamy: 'brightness(1.03) saturate(0.95) contrast(0.97)', horror: 'saturate(0.45) contrast(1.22) brightness(0.78)',
};
function Grain({ frame, opacity }) {
  return <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity, mixBlendMode: 'overlay' }}>
    <filter id={'g' + frame}><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={frame % 97} /><feColorMatrix type="saturate" values="0" /></filter>
    <rect width="100%" height="100%" filter={`url(#g${frame})`} /></svg>;
}
function LookOverlay({ look, frame }) {
  const v = (a) => <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,${a}) 100%)` }} />;
  if (look === 'film') return <>{v(0.35)}<Grain frame={frame} opacity={0.18} /><div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '8%', background: '#000' }} /><div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '8%', background: '#000' }} /></>;
  if (look === 'oldfilm') { const fl = 0.08 * Math.sin(frame * 1.7) + 0.05 * Math.sin(frame * 4.1); const x = (frame * 397) % 1280;
    return <>{v(0.6)}<Grain frame={frame} opacity={0.45} /><div style={{ position: 'absolute', inset: 0, background: `rgba(255,240,200,${Math.max(0, fl)})` }} />
      {frame % 11 < 3 && <div style={{ position: 'absolute', top: 0, bottom: 0, left: x / 12.8 + '%', width: 2, background: 'rgba(255,255,255,0.35)' }} />}</>; }
  if (look === 'noir') return <>{v(0.55)}<Grain frame={frame} opacity={0.22} /></>;
  if (look === 'dreamy') return <><div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(255,230,240,0) 60%, rgba(255,225,235,0.28) 100%)' }} /><div style={{ position: 'absolute', inset: 0, background: 'rgba(255,190,160,0.05)', mixBlendMode: 'screen' }} /></>;
  if (look === 'horror') return <>{v(0.75)}<div style={{ position: 'absolute', inset: 0, background: 'rgba(20,60,90,0.25)', mixBlendMode: 'multiply' }} /><Grain frame={frame} opacity={0.3} /></>;
  if (look === 'vivid') return v(0.2);
  return null;
}

// ---------- subtitles ----------
function Subtitle({ tl, t, frame }) {
  const style = tl.subs; if (style === 'none') return null;
  const l = tl.lines.find((x) => t >= x.start - 0.05 && t < x.end + 0.25); if (!l) return null;
  const who = tl.story.characters.find((c) => c.id === l.char); const name = who ? who.name : l.char;
  const text = style === 'hindi' ? l.hindi : l.hinglish;
  const fade = interpolate(t, [l.start - 0.05, l.start + 0.1, l.end + 0.1, l.end + 0.25], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const base = { position: 'absolute', left: '6%', right: '6%', bottom: tl.look === 'film' ? '10%' : '7%', textAlign: 'center', fontFamily: FONT, opacity: fade };
  if (style === 'youtube') return <div style={base}><span style={{ fontSize: 46, fontWeight: 900, color: '#fff', WebkitTextStroke: '2px #000', textShadow: '0 4px 0 #000, 0 0 12px rgba(0,0,0,0.7)' }}><span style={{ color: '#ffd400' }}>{name}: </span>{text}</span></div>;
  if (style === 'cinematic') return <div style={{ ...base, bottom: tl.look === 'film' ? '9.5%' : '6%' }}><div style={{ fontSize: 30, color: '#f3efe6', letterSpacing: 0.5, textShadow: '0 2px 6px rgba(0,0,0,0.9)', fontStyle: 'italic' }}>{text}</div></div>;
  if (style === 'karaoke') { const words = text.split(/\s+/); const total = words.reduce((a, w) => a + w.length + 1, 0); const p = Math.max(0, Math.min(1, (t - l.start) / Math.max(0.3, l.end - l.start))) * total; let acc = 0;
    return <div style={base}><span style={{ background: 'rgba(0,0,0,0.55)', padding: '8px 18px', borderRadius: 12, fontSize: 40, fontWeight: 800 }}><span style={{ color: '#7fd3ff' }}>{name}: </span>
      {words.map((w, i) => { const on = acc <= p; acc += w.length + 1; return <span key={i} style={{ color: on ? '#ffd400' : '#ffffff', transition: 'none' }}>{w} </span>; })}</span></div>; }
  if (style === 'dual') return <div style={base}><div style={{ display: 'inline-block', background: 'rgba(0,0,0,0.55)', padding: '8px 18px', borderRadius: 10 }}>
    <div style={{ fontSize: 36, fontWeight: 800, color: '#fff' }}><span style={{ color: '#ffd166' }}>{name}: </span>{l.hinglish}</div><div style={{ fontSize: 26, color: '#cfe8ff', marginTop: 4 }}>{l.english}</div></div></div>;
  // classic / hindi
  return <div style={base}><span style={{ display: 'inline-block', background: 'rgba(0,0,0,0.6)', padding: '8px 18px', borderRadius: 8, fontSize: 36, fontWeight: 700, color: '#fff' }}><span style={{ color: '#ffd166' }}>{name}: </span>{text}</span></div>;
}

function TitleCard({ tl, t }) {
  const o = interpolate(t, [0, 0.4, 2.7, 3.2], [1, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }); if (o <= 0) return null;
  const s = tl.story; const sc = interpolate(t, [0, 3.2], [1.0, 1.06]);
  return <AbsoluteFill style={{ background: `rgba(5,6,10,${0.78 * o})`, justifyContent: 'center', alignItems: 'center', opacity: o, fontFamily: FONT }}>
    <div style={{ transform: `scale(${sc})`, textAlign: 'center', color: '#fff' }}>
      <div style={{ fontSize: 26, letterSpacing: 6, color: '#ffd166', textTransform: 'uppercase' }}>{tl.categoryLabel}</div>
      <div style={{ fontSize: 76, fontWeight: 900, margin: '10px 0', textShadow: '0 4px 20px rgba(0,0,0,0.8)' }}>{s.title}</div>
      {s.title_hindi && <div style={{ fontSize: 40, opacity: 0.9 }}>{s.title_hindi}</div>}
    </div></AbsoluteFill>;
}
function EndCard({ tl, t }) {
  const o = interpolate(t, [tl.duration - 3.0, tl.duration - 2.4], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }); if (o <= 0) return null;
  return <AbsoluteFill style={{ background: `rgba(0,0,0,${0.85 * o})`, justifyContent: 'center', alignItems: 'center', opacity: o, fontFamily: FONT, color: '#fff', textAlign: 'center', padding: 80 }}>
    {tl.story.moral ? <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.4 }}>{tl.story.moral}</div> : null}
    <div style={{ fontSize: 30, marginTop: 24, color: '#ffd166', letterSpacing: 4 }}>THE END</div></AbsoluteFill>;
}

export const Story = ({ tl, mix }) => {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const t = frame / fps;
  let fl = ''; if (tl.look === 'oldfilm') fl = ` brightness(${1 + 0.06 * Math.sin(frame * 1.3)})`;
  return <AbsoluteFill style={{ background: '#000' }}>
    <AbsoluteFill style={{ filter: (LOOK_CSS[tl.look] || '') + fl }}><Stage tl={tl} /></AbsoluteFill>
    <LookOverlay look={tl.look} frame={frame} />
    <Subtitle tl={tl} t={t} frame={frame} />
    <TitleCard tl={tl} t={t} />
    <EndCard tl={tl} t={t} />
    {mix && <Audio src={staticFile(mix)} />}
  </AbsoluteFill>;
};
