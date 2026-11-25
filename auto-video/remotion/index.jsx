import React from 'react';
import { registerRoot, Composition } from 'remotion';
import { Story } from './Story.jsx';

const Root = () => (
  <Composition id="Story" component={Story} fps={30} width={1280} height={720} durationInFrames={300}
    defaultProps={{ tl: null, mix: null }}
    calculateMetadata={({ props }) => ({ durationInFrames: props.tl ? props.tl.durationInFrames : 300 })} />
);
registerRoot(Root);
