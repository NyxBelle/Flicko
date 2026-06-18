"use client";

import { useEffect, useRef, useState } from "react";
import type { EditDecision, CaptionStyle, MusicMood, MusicEnergy, ColorGrade } from "@/types";
import { VPreview } from "./VPreview";

// ── Inline SVG icons (match design spec: 24×24, 1.7 stroke, round caps) ──────

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "scissors":  return <svg {...p}><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8 8l12 10M8 16 20 6"/></svg>;
    case "frame":     return <svg {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M8 5v14"/></svg>;
    case "clock":     return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case "wave":      return <svg {...p}><path d="M3 12h2l2-6 3 14 3-11 2 7 2-4h4"/></svg>;
    case "captions":  return <svg {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 11h4M7 14h7M14 11h3"/></svg>;
    case "mic":       return <svg {...p}><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>;
    case "sliders":   return <svg {...p}><path d="M4 8h10M18 8h2M4 16h2M10 16h10"/><circle cx="16" cy="8" r="2.2"/><circle cx="8" cy="16" r="2.2"/></svg>;
    case "x":         return <svg {...p}><path d="M6 6l12 12M18 6 6 18"/></svg>;
    case "check":     return <svg {...p}><path d="M4 12.5l5 5L20 6.5"/></svg>;
    case "spark":     return <svg {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/></svg>;
    case "download":  return <svg {...p}><path d="M12 4v12M7 11l5 5 5-5M5 20h14"/></svg>;
    case "share":     return <svg {...p}><path d="M12 16V4M8 8l4-4 4 4M5 14v4a2 2 0 002 2h10a2 2 0 002-2v-4"/></svg>;
    case "replay":    return <svg {...p}><path d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4"/></svg>;
    case "wand":      return <svg {...p}><path d="M5 19l9-9M14 6l1.5-1.5M18 8l1.5-1.5M16 12l2 .5M12 4l.5 2"/><path d="M13 9l2 2"/></svg>;
    case "clock-sm":  return <svg {...p} width={12} height={12}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case "frame-sm":  return <svg {...p} width={12} height={12}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M8 5v14"/></svg>;
    case "sparkles":  return <svg {...p}><path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6z"/><path d="M18 15l.7 1.9 1.9.7-1.9.7L18 21l-.7-1.9-1.9-.7 1.9-.7z"/></svg>;
    case "trend":     return <svg {...p}><path d="M3 17l6-6 4 4 8-8M15 7h6v6"/></svg>;
    case "music":     return <svg {...p}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>;
    case "palette":   return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 3a4.5 4.5 0 0 0 0 9h.5a2 2 0 0 1 2 2 2 2 0 0 0 2 2 2 2 0 0 0 2-2c0-4.97-4.03-9-9-9z"/></svg>;
    default: return null;
  }
}

// ── Decision data ─────────────────────────────────────────────────────────────

interface DecisionOption {
  label: string;
  title: string;
  body: string;
  /** Which EditDecision field value this option corresponds to */
  fieldValue?: string;
}

interface DecisionDef {
  id: string;
  icon: string;
  tag: string;
  control: "chips" | "slider";
  options?: DecisionOption[];
  slider?: { min: number; max: number; step: number; defaultValue: number };
  renderSlider?: (v: number) => { title: string; body: string };
  /** Which field in EditDecision this maps to */
  field?: keyof EditDecision;
}

const DECISIONS: DecisionDef[] = [
  {
    id: "open",
    icon: "scissors",
    tag: "Cold open",
    control: "chips",
    options: [
      { label: "Open cold on the line",   title: "Killed the setup. Started on the hook.",          body: "Your most gripping line was buried. I cut everything before it — the edit opens cold, right on the moment that makes people stop scrolling." },
      { label: "Keep a 2s setup",         title: "Left a 2-second runway before the hook.",         body: "A breath of establishing context first, then the hook. Slightly slower in, but it orients viewers who like knowing where they are." },
      { label: "Open on the reaction",    title: "Opened on the reaction, then the line.",          body: "We lead with the face — the expression, the moment — then land the hook line one beat later. More emotional, less immediate." },
    ],
  },
  {
    id: "reframe",
    icon: "frame",
    tag: "Reframe",
    control: "chips",
    options: [
      { label: "Track the subject",       title: "Recut to 9:16 and tracked the subject.",          body: "You shot wide and landscape. I reframed vertical and kept the subject centered through every pan so nobody drifts out of frame." },
      { label: "Static center crop",      title: "Locked a static 9:16 center crop.",               body: "No motion tracking — a clean, steady centered frame. Calmer and more predictable, though the subject drifts toward the edges on wide pans." },
      { label: "Split-screen angles",     title: "Stacked both angles in a 9:16 split.",            body: "Wide on top, close-up below. Keeps two perspectives on screen at once — busier, but great when both angles matter." },
    ],
  },
  {
    id: "pacing",
    icon: "clock",
    tag: "Pacing",
    control: "slider",
    slider: { min: 0.8, max: 2.4, step: 0.1, defaultValue: 1.4 },
    field: "pacing",
    renderSlider: (v) => {
      const tone =
        v <= 1.2 ? "fast enough to stop a thumb mid-scroll"
        : v <= 1.7 ? "fast enough to survive a feed, calm enough to never feel frantic"
        : "relaxed and breathable — leaning into the storytelling";
      return {
        title: `Set the pace to ${v.toFixed(1)}s a beat.`,
        body:  `I tightened the dead air and landed each beat at about ${v.toFixed(1)} seconds — ${tone}.`,
      };
    },
  },
  {
    id: "sound",
    icon: "wave",
    tag: "Sound",
    control: "chips",
    field: "audio_treatment",
    options: [
      { label: "Trending sound",     title: "Dropped a trending sound under the b-roll.",    body: "Currently peaking on Reels. I ducked it −9dB under your voice so dialogue still carries but the energy builds.", fieldValue: "trending_sound" },
      { label: "Mellow lo-fi bed",   title: "Laid a soft lo-fi bed underneath.",             body: "Understated and warm. Won't chase the trend, but ages well and keeps the focus fully on what you're saying.", fieldValue: "flicko_decides" },
      { label: "No music",           title: "Left it on ambient sound only.",                body: "Just your voice and natural audio. Riskier on a feed, but raw and real — strong for a direct, documentary tone.", fieldValue: "flicko_decides" },
    ],
  },
  {
    id: "captions",
    icon: "captions",
    tag: "Captions",
    control: "chips",
    field: "caption_style",
    options: [
      { label: "Bold kinetic",        title: "Bold kinetic captions, one line at a time.",   body: "Synced to your speech, punch-words in the accent colour. Readability holds on mute — which is how 85% of this gets watched.", fieldValue: "bold_center" },
      { label: "Minimal lower-third", title: "Quiet captions on a lower third.",             body: "Smaller, single line at the bottom. Less shouty — better when the footage is doing most of the talking.", fieldValue: "minimal_bottom" },
      { label: "Word-by-word",        title: "Word-by-word pop, karaoke style.",             body: "Each word lands as it's spoken. Maximum energy and very sticky — can feel intense over a long cut.", fieldValue: "viral_highlight" },
    ],
  },
  {
    id: "voice",
    icon: "mic",
    tag: "Voice",
    control: "chips",
    field: "audio_treatment",
    options: [
      { label: "3-word cloned outro",  title: "Added a 3-word outro in your cloned voice.",   body: "A short CTA lands over the last frame — without you having to re-record a single thing.", fieldValue: "voiceover" },
      { label: "No voiceover",         title: "Kept it to your live audio only.",             body: "No added voiceover — what you captured is all there is. Cleanest and most authentic, no synthetic anything.", fieldValue: "flicko_decides" },
      { label: "Full narrated intro",  title: "A cloned-voice line sets up the premise.",     body: "A one-line narrated intro before the footage starts — useful when the raw open needs a bit more context.", fieldValue: "voiceover" },
    ],
  },
  {
    id: "music_vibe",
    icon: "music",
    tag: "Music",
    control: "chips",
    field: "music_mood",
    options: [
      { label: "High energy",   title: "High-energy track — drives the pace forward.",     body: "An upbeat, driving instrumental sits under the edit. Synced to the energy arc — it lifts on the peak and drops on the out.", fieldValue: "energetic" },
      { label: "Chill & warm",  title: "A warm, low-key instrumental bed.",               body: "Understated and smooth. Keeps the focus on what you're saying — the music supports without competing.", fieldValue: "chill" },
      { label: "Emotional",     title: "A softer, more emotional track underneath.",       body: "Works well when the content has weight — a personal story, a reveal, something the viewer should feel.", fieldValue: "melancholic" },
      { label: "Epic / cinematic", title: "Big, cinematic sound — makes the stakes feel real.", body: "Reserved for content that earns it: a transformation, a pitch, a big moment. Overuse kills the effect.", fieldValue: "epic" },
    ],
  },
  {
    id: "color_grade",
    icon: "palette",
    tag: "Color",
    control: "chips",
    field: "color_grade",
    options: [
      { label: "Normalize",     title: "Balanced and clean — exposure matched across clips.",  body: "White balance and exposure normalized so all your clips feel like they were shot together. The safest, most professional starting point.", fieldValue: "normalize" },
      { label: "Warm & golden", title: "Golden, amber tones — lifestyle and personal brand.",  body: "Adds warmth across the grade. Great for food, travel, or any content where you want the viewer to feel something cozy.", fieldValue: "warm" },
      { label: "Moody",         title: "Desaturated, high contrast — cinematic weight.",       body: "Darker, richer shadows and pulled-back saturation. Used in documentary and storytelling — creates emotional gravity.", fieldValue: "moody" },
      { label: "Bright & clean", title: "Lifted, airy — crisp and professional.",             body: "Open highlights and clean midtones. Best for tutorials, product content, and LinkedIn where clarity reads as credibility.", fieldValue: "bright_clean" },
    ],
  },
];

// ── Derive initial selections from Claude's EditDecision ──────────────────────

const PACING_TO_SLIDER: Record<string, number> = {
  very_fast: 0.9,
  fast:      1.2,
  medium:    1.6,
  slow:      2.2,
};

const SLIDER_TO_PACING = (v: number): EditDecision["pacing"] => {
  if (v <= 1.0) return "very_fast";
  if (v <= 1.4) return "fast";
  if (v <= 1.9) return "medium";
  return "slow";
};

const CAPTION_TO_OPTION: Record<string, number> = {
  bold_center:     0,
  viral_highlight: 2,
  minimal_bottom:  1,
  professional:    1,
  none:            1,
};

const MUSIC_MOOD_TO_OPTION: Record<string, number> = {
  energetic: 0, happy: 0,
  chill: 1, neutral: 1, romantic: 1,
  melancholic: 2, aggressive: 2,
  epic: 3,
};

const COLOR_GRADE_TO_OPTION: Record<string, number> = {
  normalize: 0, none: 0,
  warm: 1,
  moody: 2, cinematic: 2,
  bright_clean: 3,
};

function deriveSelections(ed: EditDecision): Record<string, number> {
  return {
    open:        0,
    reframe:     0,
    sound:       ed.audio_treatment === "trending_sound" ? 0 : 1,
    captions:    CAPTION_TO_OPTION[ed.caption_style] ?? 0,
    voice:       ed.audio_treatment === "voiceover" ? 0 : 1,
    music_vibe:  MUSIC_MOOD_TO_OPTION[ed.music_mood ?? "neutral"] ?? 0,
    color_grade: COLOR_GRADE_TO_OPTION[ed.color_grade ?? "normalize"] ?? 0,
  };
}

// ── DecisionCard ──────────────────────────────────────────────────────────────

interface DecisionCardProps {
  dec: DecisionDef;
  applied: number;
  pacing: number;
  open: boolean;
  recutting: boolean;
  onToggle: () => void;
  onApplyChip: (idx: number) => void;
  onApplyPace: (v: number) => void;
}

function DecisionCard({ dec, applied, pacing, open, recutting, onToggle, onApplyChip, onApplyPace }: DecisionCardProps) {
  const isSlider = dec.control === "slider";
  const [pendingPace, setPendingPace] = useState(pacing);
  useEffect(() => { setPendingPace(pacing); }, [pacing]);

  const currentTitle = isSlider
    ? dec.renderSlider!(pacing).title
    : dec.options![applied].title;
  const currentBody = isSlider
    ? dec.renderSlider!(pacing).body
    : dec.options![applied].body;
  const liveSliderPreview = isSlider ? dec.renderSlider!(pendingPace) : null;

  return (
    <div
      style={{
        borderBottom: "1px solid var(--line)",
        background: open ? "var(--paper)" : "transparent",
        transition: "background .2s",
        position: "relative",
      }}
    >
      {/* Recut sweep shimmer */}
      {recutting && (
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 2 }}>
          <div
            className="recut-sweep"
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              width: "40%",
              background: "linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent) 14%, transparent), transparent)",
            }}
          />
        </div>
      )}

      <div style={{ padding: "18px 22px", display: "flex", gap: 15, alignItems: "flex-start" }}>
        {/* Icon tile */}
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            flexShrink: 0,
            marginTop: 1,
            background: open ? "var(--accent)" : "var(--paper-2)",
            color: open ? "#fff" : "var(--ink-soft)",
            display: "grid",
            placeItems: "center",
            transition: "all .2s",
          }}
        >
          <Icon name={dec.icon} size={17} />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--accent-ink)" }}>
              {dec.tag}
            </span>
          </div>

          <div style={{ fontSize: 15.5, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.01em", transition: "opacity .2s", opacity: recutting ? 0.4 : 1 }}>
            {currentTitle}
          </div>
          <p style={{ margin: "5px 0 0", fontSize: 14, color: "var(--muted)", lineHeight: 1.55, textWrap: "pretty" as React.CSSProperties["textWrap"], transition: "opacity .2s", opacity: recutting ? 0.4 : 1 }}>
            {currentBody}
          </p>

          {/* Adjust toggle */}
          <button
            onClick={onToggle}
            style={{
              marginTop: 12,
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              fontFamily: "var(--font-sans), system-ui, sans-serif",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              color: open ? "var(--accent-ink)" : "var(--ink-soft)",
              background: open ? "transparent" : "var(--card)",
              border: `1px solid ${open ? "transparent" : "var(--line-2)"}`,
              borderRadius: 999,
              padding: "6px 13px",
              transition: "all .15s",
            }}
          >
            <Icon name={open ? "x" : "sliders"} size={13} />
            {open ? "Close" : "Adjust this"}
          </button>

          {/* Expanded controls — smooth accordion */}
          <div className={`card-accordion-body${open ? " open" : ""}`}>
            <div className="card-accordion-inner">
            <div style={{ marginTop: 14, paddingBottom: 4 }}>
              {isSlider ? (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 9 }}>
                    <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, color: "var(--muted)", letterSpacing: "0.04em" }}>PUNCHY</span>
                    <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 12, fontWeight: 600, color: "var(--accent-ink)" }}>{pendingPace.toFixed(1)}s / beat</span>
                    <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, color: "var(--muted)", letterSpacing: "0.04em" }}>RELAXED</span>
                  </div>
                  <input
                    type="range"
                    className="f-range"
                    min={dec.slider!.min}
                    max={dec.slider!.max}
                    step={dec.slider!.step}
                    value={pendingPace}
                    onChange={(e) => setPendingPace(parseFloat(e.target.value))}
                  />
                  <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
                    {liveSliderPreview?.body}
                  </p>
                  <button
                    onClick={() => onApplyPace(pendingPace)}
                    disabled={Math.abs(pendingPace - pacing) < 0.001}
                    style={{
                      marginTop: 13,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      fontFamily: "var(--font-sans), system-ui, sans-serif",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: Math.abs(pendingPace - pacing) < 0.001 ? "default" : "pointer",
                      background: Math.abs(pendingPace - pacing) < 0.001 ? "var(--paper-2)" : "var(--accent)",
                      color: Math.abs(pendingPace - pacing) < 0.001 ? "var(--faint)" : "#fff",
                      border: "none",
                      borderRadius: 999,
                      padding: "9px 16px",
                      transition: "all .15s",
                    }}
                  >
                    <Icon name="wand" size={14} />
                    Apply this pace
                  </button>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {dec.options!.map((o, i) => {
                    const isApplied = i === applied;
                    return (
                      <button
                        key={i}
                        onClick={() => !isApplied && onApplyChip(i)}
                        disabled={isApplied}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 11,
                          textAlign: "left",
                          fontFamily: "var(--font-sans), system-ui, sans-serif",
                          cursor: isApplied ? "default" : "pointer",
                          background: isApplied ? "var(--accent-soft)" : "var(--card)",
                          border: `1px solid ${isApplied ? "var(--accent)" : "var(--line-2)"}`,
                          borderRadius: 11,
                          padding: "11px 13px",
                          transition: "all .15s",
                          width: "100%",
                        }}
                        onMouseEnter={(e) => { if (!isApplied) (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--ink)"; }}
                        onMouseLeave={(e) => { if (!isApplied) (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--line-2)"; }}
                      >
                        {/* Radio indicator */}
                        <span
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 99,
                            flexShrink: 0,
                            border: `1.5px solid ${isApplied ? "var(--accent)" : "var(--line-2)"}`,
                            background: isApplied ? "var(--accent)" : "transparent",
                            color: "#fff",
                            display: "grid",
                            placeItems: "center",
                          }}
                        >
                          {isApplied && <Icon name="check" size={11} />}
                        </span>

                        <span style={{ fontSize: 13.5, fontWeight: isApplied ? 600 : 500, color: "var(--ink)" }}>
                          {o.label}
                        </span>

                        {isApplied && (
                          <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono), monospace", fontSize: 9.5, letterSpacing: "0.1em", color: "var(--accent-ink)", textTransform: "uppercase" }}>
                            In the cut
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ResultView ────────────────────────────────────────────────────────────────

export interface AdjustPayload {
  caption_style?: CaptionStyle;
  audio_treatment?: EditDecision["audio_treatment"];
  pacing?: EditDecision["pacing"];
  color_grade?: ColorGrade;
  music_mood?: MusicMood;
  music_energy?: MusicEnergy;
}

// ── Performance tracker ───────────────────────────────────────────────────────

type PerfState = "idle" | "open" | "submitting" | "done" | "dismissed";

function PerformanceTracker({ projectId, defaultPlatform }: { projectId: string; defaultPlatform: string }) {
  const [state, setState] = useState<PerfState>("idle");
  const [views, setViews]       = useState("");
  const [likes, setLikes]       = useState("");
  const [shares, setShares]     = useState("");
  const [comments, setComments] = useState("");
  const [platform, setPlatform] = useState(defaultPlatform);

  if (state === "dismissed") return null;

  if (state === "done") {
    return (
      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "var(--accent-soft)", border: "1px solid color-mix(in oklab,var(--accent),#fff 60%)", borderRadius: 12 }}>
        <Icon name="check" size={14} />
        <span style={{ fontSize: 13, color: "var(--accent-ink)", fontWeight: 500 }}>Performance logged — Flicko is learning from this.</span>
      </div>
    );
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%", padding: "8px 10px", borderRadius: 8,
    border: "1px solid var(--line-2)", background: "var(--paper)",
    fontFamily: "var(--font-sans), system-ui, sans-serif",
    fontSize: 13, color: "var(--ink)", outline: "none",
  };

  const handleSubmit = async () => {
    setState("submitting");
    try {
      await fetch("/api/projects/performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, views, likes, shares, comments, platform }),
      });
      setState("done");
    } catch {
      setState("open");
    }
  };

  return (
    <div style={{ marginTop: 16, border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden" }}>
      <div
        style={{
          padding: "13px 18px",
          background: "var(--paper-2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: state === "idle" ? "pointer" : "default",
        }}
        onClick={() => state === "idle" && setState("open")}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Icon name="trend" size={15} />
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>How did this clip perform?</span>
          <span style={{ fontSize: 12, color: "var(--faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.04em" }}>optional</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {state === "idle" && (
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Tap to log →</span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setState("dismissed"); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--faint)", padding: 2, display: "grid", placeItems: "center" }}
            aria-label="Dismiss"
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      </div>

      {(state === "open" || state === "submitting") && (
        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
            After posting, come back and log the numbers. Flicko uses this to make better decisions for you over time.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { label: "Views", value: views, set: setViews },
              { label: "Likes", value: likes, set: setLikes },
              { label: "Shares", value: shares, set: setShares },
              { label: "Comments", value: comments, set: setComments },
            ].map(({ label, value, set }) => (
              <div key={label}>
                <label style={{ display: "block", fontSize: 11, color: "var(--faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>{label}</label>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  style={fieldStyle}
                />
              </div>
            ))}
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, color: "var(--faint)", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Platform posted on</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={{ ...fieldStyle, cursor: "pointer" }}>
              {["tiktok", "reels", "shorts", "linkedin", "youtube"].map((p) => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleSubmit}
            disabled={state === "submitting"}
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "10px 18px", borderRadius: 999,
              background: state === "submitting" ? "var(--paper-2)" : "var(--accent)",
              color: state === "submitting" ? "var(--faint)" : "#fff",
              border: "none", cursor: state === "submitting" ? "default" : "pointer",
              fontSize: 13, fontWeight: 600,
              fontFamily: "var(--font-sans), system-ui, sans-serif",
              transition: "all .15s",
            }}
          >
            {state === "submitting" ? (
              <><span className="spin" style={{ width: 13, height: 13, border: "2px solid var(--line-2)", borderTopColor: "var(--accent)", borderRadius: 99, display: "inline-block" }} /> Saving…</>
            ) : (
              <><Icon name="trend" size={13} /> Log performance</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

interface ResultViewProps {
  project: { id: string; desired_outcome: string; target_platform: string; edit_decisions: EditDecision };
  videoSrc: string | null;
  recutting?: boolean;
  onAdjust: (changes: AdjustPayload) => Promise<void>;
  onRetry?: () => void;
  onDownload?: () => void;
}

export function ResultView({ project, videoSrc, recutting = false, onAdjust, onDownload }: ResultViewProps) {
  const ed = project.edit_decisions;

  const [selections, setSelections] = useState<Record<string, number>>(() => deriveSelections(ed));
  const [pacing, setPacing]         = useState<number>(() => PACING_TO_SLIDER[ed.pacing] ?? 1.4);
  const [openId, setOpenId]         = useState<string | null>(null);
  const [recutId, setRecutId]       = useState<string | null>(null);
  const [playing, setPlaying]       = useState(false);

  const triggerRecut = (id: string, commit: () => void) => {
    setRecutId(id);
    setTimeout(() => { commit(); }, 350);
    setTimeout(() => { setRecutId(null); setOpenId(null); }, 1250);
  };

  const applyChip = async (decId: string, idx: number, dec: DecisionDef) => {
    triggerRecut(decId, () => setSelections(s => ({ ...s, [decId]: idx })));

    // Build the backend change
    const option = dec.options![idx];
    if (!option.fieldValue || !dec.field) return; // no mapping — UI only
    const changes: AdjustPayload = {};
    if (dec.field === "caption_style")   changes.caption_style   = option.fieldValue as CaptionStyle;
    else if (dec.field === "audio_treatment") changes.audio_treatment = option.fieldValue as EditDecision["audio_treatment"];
    else if (dec.field === "color_grade")  changes.color_grade   = option.fieldValue as ColorGrade;
    else if (dec.field === "music_mood")   changes.music_mood    = option.fieldValue as MusicMood;
    await onAdjust(changes);
  };

  const applyPace = async (v: number) => {
    triggerRecut("pacing", () => setPacing(v));
    await onAdjust({ pacing: SLIDER_TO_PACING(v) });
  };

  // Caption style for the preview derives from current selection
  const captionOpt = DECISIONS.find(d => d.id === "captions")!.options![selections.captions];
  const previewCaptionStyle = captionOpt.fieldValue ?? "bold_center";

  const heading = (
    <div>
      <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--accent-ink)", fontWeight: 500, display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Icon name="check" size={13} /> Edit complete
      </div>
      <h1 className="serif" style={{ fontSize: "clamp(28px, 4vw, 44px)", lineHeight: 0.98, letterSpacing: "-0.02em", margin: 0 }}>
        Your cut is ready —{" "}
        <span className="serif-i">here&rsquo;s every call I made.</span>
      </h1>
      <p style={{ margin: "12px 0 0", fontSize: "clamp(14px, 2vw, 16px)", color: "var(--muted)", maxWidth: 480, lineHeight: 1.55 }}>
        Six decisions, all in service of one goal:{" "}
        <strong style={{ color: "var(--ink)" }}>{(project.desired_outcome || "your goal").toLowerCase()}</strong>.
        Don&rsquo;t like one? Adjust it and I&rsquo;ll re-cut.
      </p>
    </div>
  );

  const currentMusicMood  = ed.music_mood   ?? "neutral";
  const currentColorGrade = ed.color_grade  ?? "normalize";

  const summaryChips = (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
      {[
        { icon: "clock",    label: "0:38 runtime" },
        { icon: "frame",    label: "9:16 vertical" },
        { icon: "sparkles", label: "8 decisions" },
        { icon: "trend",    label: `${pacing.toFixed(1)}s pace` },
        { icon: "music",    label: currentMusicMood },
        { icon: "palette",  label: currentColorGrade.replace("_", " ") },
      ].map(({ icon, label }) => (
        <span key={label} className="chip" style={{ gap: 7 }}>
          <Icon name={icon} size={12} /> {label}
        </span>
      ))}
    </div>
  );

  // Editorial note above the decisions if Claude provided one
  const editorialNote = (ed as EditDecision & { editorial_note?: string }).editorial_note;

  const rationaleCard = (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 60px -40px rgba(0,0,0,.4)" }}>
      {/* Card header */}
      <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10, background: "var(--paper)" }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--accent)", display: "grid", placeItems: "center", color: "#fff", flexShrink: 0 }}>
          <Icon name="spark" size={17} />
        </div>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--ink)" }}>Creative rationale</div>
          <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10.5, color: "var(--faint)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Tap any decision to change it
          </div>
        </div>
      </div>

      {/* Claude's editorial note */}
      {editorialNote && (
        <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--line)", background: "var(--paper-2)" }}>
          <p style={{ margin: 0, fontFamily: "var(--font-serif), Georgia, serif", fontStyle: "italic", fontSize: 15, color: "var(--ink-soft)", lineHeight: 1.55 }}>
            &ldquo;{editorialNote}&rdquo;
          </p>
        </div>
      )}

      {/* Claude's rationale summary */}
      {ed.rationale && (
        <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--line)" }}>
          <div style={{ fontFamily: "var(--font-mono), monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 8 }}>Director's note</div>
          <p style={{ margin: 0, fontSize: 14, color: "var(--muted)", lineHeight: 1.6 }}>{ed.rationale}</p>
        </div>
      )}

      {/* 6 Decision rows — staggered entrance */}
      {DECISIONS.map((dec, idx) => (
        <div key={dec.id} className="rise" style={{ animationDelay: `${idx * 0.065}s` }}>
          <DecisionCard
            dec={dec}
            applied={selections[dec.id] ?? 0}
            pacing={pacing}
            open={openId === dec.id}
            recutting={recutId === dec.id}
            onToggle={() => setOpenId(o => o === dec.id ? null : dec.id)}
            onApplyChip={(idx) => applyChip(dec.id, idx, dec)}
            onApplyPace={applyPace}
          />
        </div>
      ))}

      {/* Card footer */}
      <div style={{ padding: "16px 22px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", background: "var(--paper)" }}>
        {videoSrc ? (
          <a href={videoSrc} download className="btn btn-accent btn-sm" style={{ textDecoration: "none" }}>
            <Icon name="download" size={15} /> Download cut
          </a>
        ) : (
          <button className="btn btn-accent btn-sm" disabled onClick={onDownload}>
            <Icon name="download" size={15} /> Download cut
          </button>
        )}
        <button className="btn btn-ink btn-sm">
          <Icon name="share" size={15} /> Post to Reels
        </button>
      </div>
    </div>
  );

  const player = (w: number) => (
    <div key={videoSrc ?? "loading"} className={videoSrc ? "fade-in" : undefined}>
      <VPreview
        phase="done"
        videoSrc={videoSrc}
        playing={playing}
        onTogglePlay={() => setPlaying(p => !p)}
        captionStyle={previewCaptionStyle}
        recutting={recutting}
        width={w}
      />
    </div>
  );

  return (
    <>
      {/* ── Desktop ────────────────────────────────────────────── */}
      <div className="result-desktop rise" style={{ maxWidth: 1060, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>{heading}</div>
        <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 48, alignItems: "start" }}>
          {/* Left: sticky player */}
          <div style={{ position: "sticky", top: 24 }}>
            {player(300)}
            {summaryChips}
          </div>
          {/* Right: rationale + performance tracker */}
          <div>
            {rationaleCard}
            {!recutting && (
              <PerformanceTracker projectId={project.id} defaultPlatform={project.target_platform} />
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile ─────────────────────────────────────────────── */}
      <div className="result-mobile" style={{ display: "none" }}>
        <div style={{ marginBottom: 20 }}>{heading}</div>
        <div style={{ display: "flex", justifyContent: "center", margin: "0 0 4px" }}>{player(196)}</div>
        <div style={{ display: "flex", justifyContent: "center" }}>{summaryChips}</div>
        <div style={{ marginTop: 22 }}>
          {rationaleCard}
          {!recutting && (
            <PerformanceTracker projectId={project.id} defaultPlatform={project.target_platform} />
          )}
        </div>

        {/* Pinned bottom action bar */}
        <div style={{ position: "sticky", bottom: 0, zIndex: 30, marginInline: -18, marginTop: 18, padding: "12px 18px 26px", background: "rgba(247,245,239,0.94)", backdropFilter: "saturate(140%) blur(14px)", borderTop: "1px solid var(--line)", display: "flex", gap: 10 }}>
          {videoSrc ? (
            <a href={videoSrc} download className="btn btn-accent" style={{ flex: 1, justifyContent: "center", textDecoration: "none" }}>
              <Icon name="download" size={16} /> Download
            </a>
          ) : (
            <button className="btn btn-accent" style={{ flex: 1, justifyContent: "center" }} disabled>
              <Icon name="download" size={16} /> Download
            </button>
          )}
          <button className="btn btn-ink" style={{ flex: 1, justifyContent: "center" }}>
            <Icon name="share" size={16} /> Post
          </button>
        </div>
      </div>

    </>
  );
}
