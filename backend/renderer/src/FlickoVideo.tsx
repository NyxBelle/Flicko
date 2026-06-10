import React from 'react';
import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  interpolate,
} from 'remotion';

export interface Clip {
  name: string;
  durationInFrames: number;
}

export interface Caption {
  text: string;
  startFrame: number;
  endFrame: number;
}

export interface FlickoVideoProps {
  clips: Clip[];
  captions: Caption[];
  captionStyle: string;
  transitionType: string;
  width: number;
  height: number;
}

const TRANSITION_FRAMES = 9; // 0.3s at 30fps

const CAPTION_STYLES: Record<
  string,
  {bottom: number | string; style: React.CSSProperties}
> = {
  bold_center: {
    bottom: '45%',
    style: {
      fontSize: 68,
      fontWeight: 900,
      color: 'white',
      textShadow: '3px 3px 8px rgba(0,0,0,0.95)',
    },
  },
  viral_highlight: {
    bottom: '40%',
    style: {
      fontSize: 72,
      fontWeight: 900,
      color: '#FFE066',
      textShadow: '0 0 20px rgba(255,180,0,0.7)',
    },
  },
  minimal_bottom: {
    bottom: 80,
    style: {
      fontSize: 44,
      fontWeight: 600,
      color: 'white',
      textShadow: '1px 1px 3px rgba(0,0,0,0.8)',
    },
  },
  professional: {
    bottom: 100,
    style: {
      fontSize: 40,
      fontWeight: 500,
      color: 'white',
      background: 'rgba(0,0,0,0.55)',
      padding: '8px 20px',
      borderRadius: 8,
    },
  },
};

export const FlickoVideo: React.FC<FlickoVideoProps> = ({
  clips,
  captions,
  captionStyle,
  transitionType,
}) => {
  const frame = useCurrentFrame();

  let cumulative = 0;
  const timings = clips.map((clip) => {
    const start = cumulative;
    cumulative += clip.durationInFrames;
    return {clip, start};
  });

  return (
    <AbsoluteFill style={{background: '#000'}}>
      {timings.map(({clip, start}, i) => {
        const relFrame = frame - start;
        const isFirst = i === 0;
        const isLast = i === clips.length - 1;

        let opacity = 1;
        let scale = 1;
        let translateX = 0;

        if (transitionType === 'fade') {
          if (!isFirst && relFrame < TRANSITION_FRAMES) {
            opacity = interpolate(relFrame, [0, TRANSITION_FRAMES], [0, 1]);
          }
          if (!isLast && relFrame > clip.durationInFrames - TRANSITION_FRAMES) {
            opacity = interpolate(
              relFrame,
              [clip.durationInFrames - TRANSITION_FRAMES, clip.durationInFrames],
              [1, 0],
            );
          }
        }

        if (transitionType === 'zoom' && !isFirst && relFrame < TRANSITION_FRAMES) {
          scale = interpolate(relFrame, [0, TRANSITION_FRAMES], [0.94, 1]);
        }

        if (transitionType === 'swipe' && !isFirst && relFrame < TRANSITION_FRAMES) {
          translateX = interpolate(relFrame, [0, TRANSITION_FRAMES], [100, 0]);
        }

        return (
          <Sequence key={i} from={start} durationInFrames={clip.durationInFrames}>
            <AbsoluteFill
              style={{
                opacity,
                transform: `translateX(${translateX}%) scale(${scale})`,
              }}
            >
              <OffthreadVideo
                src={staticFile(clip.name)}
                style={{width: '100%', height: '100%', objectFit: 'cover'}}
              />
            </AbsoluteFill>
          </Sequence>
        );
      })}

      {captionStyle !== 'none' &&
        captions.map((cap, i) => {
          if (frame < cap.startFrame || frame > cap.endFrame) return null;
          const cs = CAPTION_STYLES[captionStyle] ?? CAPTION_STYLES.minimal_bottom;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: cs.bottom,
                display: 'flex',
                justifyContent: 'center',
                padding: '0 6%',
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  fontFamily: '"Arial Black", Impact, sans-serif',
                  textAlign: 'center',
                  maxWidth: '88%',
                  ...cs.style,
                }}
              >
                {cap.text}
              </div>
            </div>
          );
        })}
    </AbsoluteFill>
  );
};
