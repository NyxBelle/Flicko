import React from 'react';
import {Composition} from 'remotion';
import {FlickoVideo, type FlickoVideoProps} from './FlickoVideo';

const defaultProps: FlickoVideoProps = {
  clips: [],
  captions: [],
  captionStyle: 'bold_center',
  transitionType: 'cut',
  hookText: '',
  width: 1080,
  height: 1920,
};

export const Root: React.FC = () => {
  return (
    <Composition
      id="FlickoVideo"
      component={FlickoVideo}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={defaultProps}
      calculateMetadata={({props}) => ({
        durationInFrames: Math.max(
          1,
          props.clips.reduce((sum, c) => sum + c.durationInFrames, 0),
        ),
        width: props.width,
        height: props.height,
      })}
    />
  );
};
