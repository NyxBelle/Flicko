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
  hookText?: string;
  captionColor?: string;
  width: number;
  height: number;
}

const TRANSITION_FRAMES = 9; // 0.3s at 30fps
const HOOK_DURATION = 75;    // 2.5s
const HOOK_FADE_OUT = 15;    // 0.5s

function getCaptionStyle(
  style: string,
  color: string,
): {bottom: number | string; textStyle: React.CSSProperties} {
  const shadow = `3px 3px 10px rgba(0,0,0,0.95)`;
  switch (style) {
    case 'viral_highlight':
      return {
        bottom: '38%',
        textStyle: {
          fontSize: 72,
          fontWeight: 900,
          color,
          textShadow: `0 0 22px rgba(0,0,0,0.6), ${shadow}`,
        },
      };
    case 'minimal_bottom':
      return {
        bottom: 80,
        textStyle: {fontSize: 44, fontWeight: 600, color, textShadow: shadow},
      };
    case 'professional':
      return {
        bottom: 100,
        textStyle: {
          fontSize: 40,
          fontWeight: 500,
          color: '#FFFFFF',
          background: 'rgba(0,0,0,0.6)',
          padding: '8px 20px',
          borderRadius: 8,
        },
      };
    case 'bold_center':
    default:
      return {
        bottom: '42%',
        textStyle: {fontSize: 68, fontWeight: 900, color, textShadow: shadow},
      };
  }
}

export const FlickoVideo: React.FC<FlickoVideoProps> = ({
  clips,
  captions,
  captionStyle,
  transitionType,
  hookText,
  captionColor = '#FFFFFF',
}) => {
  const frame = useCurrentFrame();

  let cumulative = 0;
  const timings = clips.map((clip) => {
    const start = cumulative;
    cumulative += clip.durationInFrames;
    return {clip, start};
  });

  const hookOpacity =
    hookText && frame < HOOK_DURATION
      ? interpolate(
          frame,
          [0, 10, HOOK_DURATION - HOOK_FADE_OUT, HOOK_DURATION],
          [0, 1, 1, 0],
          {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
        )
      : 0;

  const hookScale =
    hookText && frame < HOOK_DURATION
      ? interpolate(frame, [0, 12], [0.88, 1], {extrapolateRight: 'clamp'})
      : 1;

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
              style={{opacity, transform: `translateX(${translateX}%) scale(${scale})`}}
            >
              <OffthreadVideo
                src={staticFile(clip.name)}
                style={{width: '100%', height: '100%', objectFit: 'cover'}}
              />
            </AbsoluteFill>
          </Sequence>
        );
      })}

      {/* Captions with pop-in animation */}
      {captionStyle !== 'none' &&
        captions.map((cap, i) => {
          if (frame < cap.startFrame || frame > cap.endFrame) return null;
          const {bottom, textStyle} = getCaptionStyle(captionStyle, captionColor);
          const capAge = frame - cap.startFrame;
          const popScale = interpolate(capAge, [0, 6, 10], [0.8, 1.04, 1], {
            extrapolateRight: 'clamp',
          });
          const capOpacity = interpolate(capAge, [0, 5], [0, 1], {extrapolateRight: 'clamp'});
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom,
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
                  opacity: capOpacity,
                  transform: `scale(${popScale})`,
                  ...textStyle,
                }}
              >
                {cap.text}
              </div>
            </div>
          );
        })}

      {/* Hook overlay — first 2.5s */}
      {hookText && hookOpacity > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '14%',
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            padding: '0 6%',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              fontFamily: '"Arial Black", Impact, sans-serif',
              fontSize: 58,
              fontWeight: 900,
              color: captionColor,
              textShadow: `3px 3px 14px rgba(0,0,0,0.95)`,
              textAlign: 'center',
              maxWidth: '90%',
              opacity: hookOpacity,
              transform: `scale(${hookScale})`,
            }}
          >
            {hookText}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
