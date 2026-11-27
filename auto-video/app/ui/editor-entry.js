// Timeline editor preview: the same stage engine + overlays as the renderer, drawn live into a canvas in the app window.
import { createEngine } from '../../remotion/engine/index.js';
import { makeComposer } from '../render/compose.js';

const W = 1280, H = 720;
const url = (rel) => 'av://data/' + rel.split('/').map(encodeURIComponent).join('/');
let E = null;
window.AVEditor = {
  async load(gl, out, tl) { E = null; tl.subs = 'none'; /* subtitles are added after the render */ const eng = await createEngine({ canvas: gl, width: W, height: H, tl, url }); E = { eng, tl, gl, ctx: out.getContext('2d'), compose: makeComposer(W, H) }; return true; },
  frame(t) { if (!E) return; E.eng.renderAt(t); E.compose(E.ctx, E.gl, E.tl, t, Math.round(t * 30)); },
  pick: (nx, ny) => E?.eng.pick?.(nx, ny) || null,
  toStage: (nx, ny, t) => E?.eng.toStage?.(nx, ny, t) || null,
  info: (t) => E?.eng.editorInfo?.(t) || null,
  invalidate: () => E?.eng.invalidate?.(),
  ready: () => !!E,
};
