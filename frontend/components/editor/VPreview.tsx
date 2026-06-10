"use client";

import { useEffect, useRef, useState } from "react";

// ── Caption overlay (inside the noir canvas) ─────────────────────────────────

const CAPTION_MAP: Record<string, {
  bg: string; color: string; fontSize: number; weight: number; two: boolean; single?: boolean;
}> = {
  bold_center:      { bg: "#fff",              color: "#111", fontSize: 1.0,  weight: 800, two: true },
  viral_highlight:  { bg: "var(--accent)",     color: "#fff", fontSize: 1.12, weight: 800, two: false, single: true },
  minimal_bottom:   { bg: "rgba(0,0,0,.55)",   color: "#fff", fontSize: 0.62, weight: 600, two: false },
  professional:     { bg: "rgba(0,0,0,.55)",   color: "#fff", fontSize: 0.62, weight: 600, two: false },
};

function CaptionOverlay({ styleName, width }: { styleName: string; width: number }) {
  const c = CAPTION_MAP[styleName] ?? CAPTION_MAP.bold_center;
  const base = Math.max(14, width * 0.085);
  const fs = base * c.fontSize;

  const boxStyle: React.CSSProperties = {
    display: "inline-block",
    background: c.bg,
    color: c.color,
    fontFamily: "var(--font-sans), system-ui, sans-serif",
    fontWeight: c.weight,
    fontSize: fs,
    letterSpacing: "-0.02em",
    borderRadius: 6,
    lineHeight: 1.12,
    boxShadow: "0 6px 20px rgba(0,0,0,.4)",
  };

  if (c.single) {
    return (
      <div style={{ ...boxStyle, padding: "5px 12px", lineHeight: 1.1 }}>
        like<span style={{ opacity: 0.35 }}> this</span>
      </div>
    );
  }

  return (
    <div style={{ ...boxStyle, padding: "5px 11px" }}>
      never had suya{c.two ? <br /> : " "}
      <span style={{ color: c.color === "#111" ? "var(--accent)" : "#fff" }}>like this</span>
    </div>
  );
}

// ── VPreview ──────────────────────────────────────────────────────────────────

interface VPreviewProps {
  phase: "editing" | "done";
  /** 0–100 pipeline progress (editing) */
  pipelineProgress?: number;
  /** null while waiting for signed URL */
  videoSrc?: string | null;
  playing?: boolean;
  onTogglePlay?: () => void;
  /** "bold_center" | "minimal_bottom" | "viral_highlight" | "professional" */
  captionStyle?: string;
  recutting?: boolean;
  width?: number;
}

export function VPreview({
  phase,
  pipelineProgress = 0,
  videoSrc,
  playing = false,
  onTogglePlay,
  captionStyle = "bold_center",
  recutting = false,
  width = 300,
}: VPreviewProps) {
  const [scanCell, setScanCell] = useState(0);
  const [videoProgress, setVideoProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Filmstrip cell scanner
  useEffect(() => {
    if (phase !== "editing") return;
    const id = setInterval(() => setScanCell(c => (c + 1) % 9), 240);
    return () => clearInterval(id);
  }, [phase]);

  // Drive actual video element
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (playing) vid.play().catch(() => {});
    else vid.pause();
  }, [playing]);

  // Track video progress for the progress bar
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const onTime = () => setVideoProgress((vid.currentTime / (vid.duration || 1)) * 100);
    const onEnd  = () => { vid.currentTime = 0; setVideoProgress(0); };
    vid.addEventListener("timeupdate", onTime);
    vid.addEventListener("ended", onEnd);
    return () => { vid.removeEventListener("timeupdate", onTime); vid.removeEventListener("ended", onEnd); };
  }, [videoSrc]);

  const progress = phase === "editing" ? pipelineProgress : videoProgress;

  return (
    <div
      style={{
        position: "relative",
        aspectRatio: "9 / 16",
        width,
        maxWidth: "100%",
        borderRadius: 20,
        overflow: "hidden",
        background: "var(--noir)",
        boxShadow: "0 40px 80px -34px rgba(0,0,0,.6), 0 0 0 1px var(--noir-line)",
        flexShrink: 0,
      }}
    >
      {/* Dark striped placeholder (always beneath video) */}
      <div className="ph ph-dark" style={{ position: "absolute", inset: 0 }} />

      {/* ── EDITING phase ────────────────────────────────────── */}
      {phase === "editing" && (
        <>
          {/* Filmstrip grid */}
          <div style={{ position: "absolute", left: 12, right: 12, top: "50%", transform: "translateY(-50%)", display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: 3, opacity: 0.55 }}>
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                style={{
                  aspectRatio: "9/16",
                  borderRadius: 2,
                  background: "repeating-linear-gradient(135deg, rgba(255,255,255,.10) 0 2px, transparent 2px 6px), rgba(255,255,255,.05)",
                  outline: scanCell === i ? "1.5px solid var(--accent)" : "none",
                  transition: "outline .2s",
                }}
              />
            ))}
          </div>

          {/* Scan sweep gradient */}
          <div style={{ position: "absolute", left: 0, right: 0, height: 70, top: `calc(${pipelineProgress}% - 35px)`, background: "linear-gradient(to bottom, transparent, color-mix(in srgb, var(--accent) 45%, transparent), transparent)", transition: "top .35s linear", pointerEvents: "none" }} />
          {/* Scan line */}
          <div style={{ position: "absolute", left: 0, right: 0, top: `${pipelineProgress}%`, height: 1.5, background: "var(--accent)", boxShadow: "0 0 12px var(--accent)", transition: "top .35s linear" }} />

          {/* Status chips */}
          <div style={{ position: "absolute", top: 12, left: 12, right: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 9.5, letterSpacing: "0.14em", color: "#fff", background: "rgba(0,0,0,.45)", padding: "4px 8px", borderRadius: 99, backdropFilter: "blur(6px)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 5 }}>
              <span className="live-dot" style={{ width: 6, height: 6, borderRadius: 99, background: "var(--accent)", display: "inline-block", flexShrink: 0 }} />
              REC · RAW
            </span>
            <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 9.5, letterSpacing: "0.1em", color: "#fff", background: "rgba(0,0,0,.45)", padding: "4px 8px", borderRadius: 99, backdropFilter: "blur(6px)" }}>
              {Math.round(pipelineProgress)}%
            </span>
          </div>
        </>
      )}

      {/* ── DONE phase ───────────────────────────────────────── */}
      {phase === "done" && (
        <>
          {/* Real video */}
          {videoSrc && (
            <video
              ref={videoRef}
              src={videoSrc}
              playsInline
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 1 }}
            />
          )}

          {/* Re-cutting overlay */}
          {recutting && (
            <div style={{ position: "absolute", inset: 0, zIndex: 6, background: "rgba(16,15,12,.55)", backdropFilter: "blur(2px)", display: "grid", placeItems: "center" }}>
              <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10, letterSpacing: "0.16em", color: "#fff", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
                <span className="live-dot" style={{ width: 7, height: 7, borderRadius: 99, background: "var(--accent)", display: "inline-block" }} />
                Re-cutting
              </span>
            </div>
          )}

          {/* Top chips */}
          <div style={{ position: "absolute", top: 13, left: 13, right: 13, display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 4 }}>
            <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 9.5, letterSpacing: "0.06em", color: "#fff", background: "rgba(0,0,0,.45)", padding: "5px 9px", borderRadius: 99, backdropFilter: "blur(6px)", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: "var(--accent)", display: "inline-block" }} />
              0:38
            </span>
            <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 9.5, letterSpacing: "0.06em", color: "#fff", background: "var(--accent)", padding: "5px 9px", borderRadius: 99 }}>9:16</span>
          </div>

          {/* Caption overlay */}
          <div style={{ position: "absolute", left: 16, right: 16, bottom: 64, textAlign: "center", zIndex: 3 }}>
            <CaptionOverlay styleName={captionStyle} width={width} />
          </div>

          {/* Play button */}
          <button
            onClick={onTogglePlay}
            style={{ position: "absolute", inset: 0, margin: "auto", width: 56, height: 56, borderRadius: 999, border: "none", background: "rgba(255,255,255,.92)", color: "#111", display: "grid", placeItems: "center", cursor: "pointer", zIndex: 5, opacity: playing ? 0 : 1, transition: "opacity .3s", boxShadow: "0 10px 30px rgba(0,0,0,.35)" }}
            aria-label="Play"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>
          </button>

          {/* Invisible tap target to pause while playing */}
          {playing && (
            <button onClick={onTogglePlay} style={{ position: "absolute", inset: 0, border: "none", background: "transparent", cursor: "pointer", zIndex: 4 }} aria-label="Pause" />
          )}

          {/* Video progress bar */}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 4, background: "rgba(255,255,255,.2)", zIndex: 4 }}>
            <div style={{ height: "100%", width: `${progress}%`, background: "var(--accent)", transition: playing ? "width .1s linear" : "width .3s" }} />
          </div>
        </>
      )}
    </div>
  );
}
