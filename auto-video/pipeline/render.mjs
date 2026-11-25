// Step 5: render the Remotion composition (Three.js inside) to MP4 with the mixed audio.
import path from 'path';
import os from 'os';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { ROOT, PUBLIC } from './paths.mjs';

export async function renderVideo({ tl, mix, out, onProgress = () => {}, concurrency }) {
  const serveUrl = await bundle({ entryPoint: path.join(ROOT, 'remotion', 'index.jsx'), publicDir: PUBLIC, onProgress: () => {} });
  const gl = process.env.REMOTION_GL || (process.platform === 'linux' && !process.env.DISPLAY ? 'swiftshader' : 'angle');
  const browserExecutable = process.env.BROWSER_EXECUTABLE || null;
  const inputProps = { tl, mix };
  const composition = await selectComposition({ serveUrl, id: 'Story', inputProps, browserExecutable, chromiumOptions: { gl }, timeoutInMilliseconds: 600000 });
  const conc = concurrency || Number(process.env.CONCURRENCY) || Math.max(1, Math.min(4, Math.floor(os.cpus().length / 2)));
  const t0 = Date.now();
  await renderMedia({ composition, serveUrl, codec: 'h264', crf: 20, outputLocation: out, inputProps, browserExecutable, chromiumOptions: { gl }, concurrency: conc,
    timeoutInMilliseconds: 600000, onProgress: ({ progress, renderedFrames }) => onProgress(progress, renderedFrames, (Date.now() - t0) / 1000) });
  return { seconds: (Date.now() - t0) / 1000, frames: composition.durationInFrames };
}
