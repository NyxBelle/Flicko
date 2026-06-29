import React from 'react';
import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  interpolate,
} from 'remotion';

export interface CaptionWord {
  word: string;
  startFrame: number;
}

export interface Clip {
  name: string;
  durationInFrames: number;
  zoomIn?: boolean;
}

export interface Caption {
  text: string;
  startFrame: number;
  endFrame: number;
  words?: CaptionWord[];
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

interface CaptionPosition {
  bottom: number | string;
  fontSize: number;
  fontWeight: number;
  pill?: boolean; // dark background backing for professional style
}

function getCaptionPosition(style: string): CaptionPosition {
  switch (style) {
    case 'viral_highlight':
      return {bottom: '38%', fontSize: 72, fontWeight: 900};
    case 'minimal_bottom':
      return {bottom: 80, fontSize: 44, fontWeight: 600};
    case 'professional':
      return {bottom: 100, fontSize: 40, fontWeight: 500, pill: true};
    case 'bold_center':
    default:
      return {bottom: '42%', fontSize: 68, fontWeight: 900};
  }
}

function KaraokeCaption({
  cap,
  frame,
  captionStyle,
  captionColor,
}: {
  cap: Caption;
  frame: number;
  captionStyle: string;
  captionColor: string;
}) {
  if (frame < cap.startFrame || frame > cap.endFrame) return null;

  const {bottom, fontSize, fontWeight, pill} = getCaptionPosition(captionStyle);
  const capAge = frame - cap.startFrame;
  const phraseOpacity = interpolate(capAge, [0, 5], [0, 1], {extrapolateRight: 'clamp'});
  const shadow = '3px 3px 10px rgba(0,0,0,0.95)';
  const pillStyle = pill
    ? {background: 'rgba(0,0,0,0.6)', padding: '8px 20px', borderRadius: 8}
    : {};

  // No word-level data — fall back to plain phrase render
  if (!cap.words || cap.words.length === 0) {
    const popScale = interpolate(capAge, [0, 6, 10], [0.82, 1.04, 1], {extrapolateRight: 'clamp'});
    return (
      <div
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
            fontSize,
            fontWeight,
            color: captionColor,
            textShadow: shadow,
            textAlign: 'center',
            maxWidth: '88%',
            opacity: phraseOpacity,
            transform: `scale(${popScale})`,
            ...pillStyle,
          }}
        >
          {cap.text}
        </div>
      </div>
    );
  }

  // Karaoke mode — highlight active word
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom,
        display: 'flex',
        justifyContent: 'center',
        padding: '0 6%',
        opacity: phraseOpacity,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          fontFamily: '"Arial Black", Impact, sans-serif',
          fontSize,
          fontWeight,
          textAlign: 'center',
          maxWidth: '90%',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '0 10px',
          lineHeight: 1.2,
          ...pillStyle,
        }}
      >
        {cap.words.map((w, j) => {
          const nextFrame = cap.words![j + 1]?.startFrame ?? cap.endFrame + 1;
          const isActive = frame >= w.startFrame && frame < nextFrame;
          const isPast = frame >= nextFrame;

          const wordScale = isActive
            ? interpolate(frame - w.startFrame, [0, 4], [0.88, 1.05], {extrapolateRight: 'clamp'})
            : 1;

          return (
            <span
              key={j}
              style={{
                display: 'inline-block',
                color: isActive ? captionColor : isPast ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.35)',
                textShadow: isActive ? `0 0 18px ${captionColor}55, ${shadow}` : shadow,
                transform: `scale(${wordScale})`,
                transformOrigin: 'center bottom',
                transition: 'color 0.08s',
              }}
            >
              {w.word}
            </span>
          );
        })}
      </div>
    </div>
  );
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

  const totalFrames = cumulative;
  const progressPct = totalFrames > 0 ? (frame / totalFrames) * 100 : 0;

  // Hook: slides up from slightly below + scales in, then fades out
  const hookVisible = Boolean(hookText) && frame < HOOK_DURATION;
  const hookOpacity = hookVisible
    ? interpolate(frame, [0, 8, HOOK_DURATION - HOOK_FADE_OUT, HOOK_DURATION], [0, 1, 1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0;
  const hookScale = hookVisible
    ? interpolate(frame, [0, 12], [0.84, 1], {extrapolateRight: 'clamp'})
    : 1;
  const hookTranslateY = hookVisible
    ? interpolate(frame, [0, 12], [24, 0], {extrapolateRight: 'clamp'})
    : 0;

  return (
    <AbsoluteFill style={{background: '#000'}}>
      {timings.map(({clip, start}, i) => {
        const relFrame = frame - start;
        const isFirst = i === 0;
        const isLast = i === clips.length - 1;

        let opacity = 1;
        let scale = 1;
        let translateX = 0;

        // Transitions
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

        // Ken Burns zoom-in for marked clips
        const zoomScale = clip.zoomIn
          ? interpolate(relFrame, [0, clip.durationInFrames], [1.0, 1.18], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
          : 1;

        return (
          <Sequence key={i} from={start} durationInFrames={clip.durationInFrames}>
            <AbsoluteFill
              style={{
                opacity,
                transform: `translateX(${translateX}%) scale(${scale * zoomScale})`,
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

      {/* Karaoke captions */}
      {captionStyle !== 'none' &&
        captions.map((cap, i) => (
          <KaraokeCaption
            key={i}
            cap={cap}
            frame={frame}
            captionStyle={captionStyle}
            captionColor={captionColor}
          />
        ))}

      {/* Hook overlay — slides up + scales in */}
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
              textShadow: `0 0 22px ${captionColor}44, 3px 3px 14px rgba(0,0,0,0.95)`,
              textAlign: 'center',
              maxWidth: '90%',
              opacity: hookOpacity,
              transform: `scale(${hookScale}) translateY(${hookTranslateY}px)`,
            }}
          >
            {hookText}
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: `${progressPct}%`,
          height: 4,
          background: captionColor,
          opacity: 0.75,
        }}
      />
    </AbsoluteFill>
  );
};
