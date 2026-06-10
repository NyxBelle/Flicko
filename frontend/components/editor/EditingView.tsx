"use client";

import { useEffect, useState } from "react";
import type { Project, ProjectStatus } from "@/types";
import { VPreview } from "./VPreview";

// ── Stage data ────────────────────────────────────────────────────────────────

const STATUS_ORDER: ProjectStatus[] = [
  "transcribing",
  "analyzing",
  "deciding",
  "editing",
  "rendering",
];

const STATUS_TO_PROGRESS: Record<string, number> = {
  transcribing: 12,
  analyzing:    32,
  deciding:     54,
  editing:      74,
  rendering:    90,
};

interface Stage {
  key: ProjectStatus;
  label: string;
  subs: (p: Project) => string[];
}

const STAGES: Stage[] = [
  {
    key: "transcribing",
    label: "Watching your footage",
    subs: (p) => [
      `Scanning your ${p.title || "footage"}`,
      "Reading audio levels & silences",
      "Finding scene cuts",
    ],
  },
  {
    key: "analyzing",
    label: "Understanding what you've got",
    subs: (p) => [
      `Platform target — ${p.target_platform}`,
      p.desired_outcome
        ? `Goal — ${p.desired_outcome.slice(0, 55)}`
        : "Identifying the core message",
      "Spotting the high-energy moments",
    ],
  },
  {
    key: "deciding",
    label: "Deciding how to cut it",
    subs: (p) => [
      "Finding the hook moment",
      `Reframing to ${["tiktok","reels","shorts"].includes(p.target_platform) ? "9:16 vertical" : "16:9"}`,
      p.audio_preference === "voiceover"
        ? "Planning cloned-voice lines"
        : "Bold kinetic captions for mute viewing",
    ],
  },
  {
    key: "editing",
    label: "Making the cuts",
    subs: () => [
      "Trimming dead air between takes",
      "Ordering segments by impact",
      "Beat-matching to the track",
    ],
  },
  {
    key: "rendering",
    label: "Mastering the export",
    subs: () => [
      "Encoding 1080 × 1920",
      "Applying transitions & captions",
      "Finalizing output",
    ],
  },
];

// ── Stage row ─────────────────────────────────────────────────────────────────

interface StageRowProps {
  stage: Stage;
  project: Project;
  status: "done" | "active" | "pending";
  visibleSubs: number;
  isLast: boolean;
}

function StageRow({ stage, project, status, visibleSubs, isLast }: StageRowProps) {
  const subs = stage.subs(project);
  const shown = status === "done" ? subs : subs.slice(0, visibleSubs);

  return (
    <div
      style={{
        display: "flex",
        gap: 15,
        opacity: status === "pending" ? 0.45 : 1,
        transition: "opacity .5s",
      }}
    >
      {/* Rail */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div
          style={{
            width: 25,
            height: 25,
            borderRadius: 999,
            display: "grid",
            placeItems: "center",
            border: `1.5px solid ${status === "pending" ? "var(--line-2)" : "var(--accent)"}`,
            background: status === "done" ? "var(--accent)" : "var(--card)",
            color: status === "done" ? "#fff" : "var(--accent)",
            transition: "all .4s",
            flexShrink: 0,
            boxShadow: status === "active" ? "0 0 0 4px color-mix(in srgb, var(--accent) 16%, transparent)" : "none",
          }}
        >
          {status === "done" ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12.5l5 5L20 6.5" />
            </svg>
          ) : status === "active" ? (
            <span className="live-dot" style={{ width: 7, height: 7, borderRadius: 99, background: "var(--accent)", display: "inline-block" }} />
          ) : (
            <span style={{ width: 5, height: 5, borderRadius: 99, background: "var(--line-2)", display: "inline-block" }} />
          )}
        </div>
        {!isLast && (
          <div
            style={{
              flex: 1,
              width: 1.5,
              marginTop: 4,
              minHeight: 20,
              background: status === "done" ? "var(--accent)" : "var(--line)",
              transition: "background .4s",
            }}
          />
        )}
      </div>

      {/* Body */}
      <div style={{ paddingBottom: isLast ? 0 : 22, flex: 1, marginTop: 1 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.01em" }}>
          {stage.label}
        </div>
        {shown.length > 0 && (
          <div style={{ display: "grid", gap: 5, marginTop: 9 }}>
            {shown.map((s, i) => (
              <div
                key={i}
                className="rise"
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: 12,
                  color: "var(--muted)",
                  letterSpacing: "0.005em",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  animationDelay: `${i * 0.08}s`,
                }}
              >
                <span style={{ color: "var(--accent)", lineHeight: 1.4, flexShrink: 0 }}>→</span>
                <span style={{ lineHeight: 1.4 }}>{s}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── EditingView ───────────────────────────────────────────────────────────────

interface EditingViewProps {
  project: Project;
}

export function EditingView({ project }: EditingViewProps) {
  const currentIdx = Math.max(0, STATUS_ORDER.indexOf(project.status as ProjectStatus));
  const [visibleSubs, setVisibleSubs] = useState(0);

  // Auto-reveal sub-steps when the active stage changes
  useEffect(() => {
    setVisibleSubs(0);
    const total = STAGES[currentIdx].subs(project).length;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < total; i++) {
      timers.push(setTimeout(() => setVisibleSubs(i + 1), 700 * (i + 1)));
    }
    return () => timers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx]);

  const progress = STATUS_TO_PROGRESS[project.status] ?? 5;
  const stageLabel = STAGES[Math.min(currentIdx, STAGES.length - 1)].label;

  const header = (
    <div>
      {/* Eyebrow */}
      <div
        style={{
          fontFamily: "var(--font-mono), monospace",
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--accent-ink)",
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
        }}
      >
        <span className="live-dot" style={{ width: 8, height: 8, borderRadius: 99, background: "var(--accent)", display: "inline-block" }} />
        Flicko is editing
      </div>

      {/* Heading */}
      <h1
        className="serif"
        style={{ fontSize: "clamp(28px, 5vw, 40px)", lineHeight: 1.0, letterSpacing: "-0.02em", margin: 0 }}
      >
        Cutting your reel —{" "}
        <span className="serif-i">thinking it through.</span>
      </h1>

      {/* Meta */}
      <div
        style={{
          fontFamily: "var(--font-mono), monospace",
          fontSize: 11.5,
          color: "var(--faint)",
          marginTop: 12,
          letterSpacing: "0.04em",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <span style={{ color: "var(--muted)" }}>{project.title}</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <span>{project.target_platform}</span>
      </div>

      {/* Progress bar */}
      <div style={{ marginTop: 16 }}>
        <div style={{ height: 5, borderRadius: 99, background: "var(--line)", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              background: "var(--accent)",
              borderRadius: 99,
              transition: "width .35s linear",
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7 }}>
          <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, color: "var(--accent-ink)", letterSpacing: "0.02em" }}>
            {stageLabel}…
          </span>
          <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: 11, color: "var(--faint)" }}>
            {Math.round(progress)}%
          </span>
        </div>
      </div>
    </div>
  );

  const stream = (
    <div>
      {STAGES.slice(0, currentIdx + 1).map((st, i) => {
        const isCurrent = i === currentIdx;
        const stStatus = isCurrent ? "active" : "done";
        return (
          <StageRow
            key={st.key}
            stage={st}
            project={project}
            status={stStatus}
            visibleSubs={isCurrent ? visibleSubs : st.subs(project).length}
            isLast={i === currentIdx}
          />
        );
      })}
    </div>
  );

  return (
    <>
      {/* ── Desktop: two-column ────────────────────────────────── */}
      <div className="editing-desktop" style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ marginBottom: 26 }}>{header}</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "300px 1fr",
            gap: 56,
            alignItems: "start",
          }}
        >
          {/* Left: sticky preview */}
          <div style={{ position: "sticky", top: 24 }}>
            <VPreview phase="editing" pipelineProgress={progress} width={300} />
            <p
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 11,
                color: "var(--faint)",
                textAlign: "center",
                marginTop: 14,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Live preview · assembling
            </p>
          </div>

          {/* Right: reasoning stream */}
          <div>
            <div
              style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: 11,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--muted)",
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 20,
              }}
            >
              <span className="live-dot" style={{ width: 8, height: 8, borderRadius: 99, background: "var(--accent)", display: "inline-block" }} />
              Thinking out loud
            </div>
            {stream}
          </div>
        </div>
      </div>

      {/* ── Mobile: stacked ────────────────────────────────────── */}
      <div className="editing-mobile" style={{ display: "none" }}>
        <div style={{ marginBottom: 18 }}>{header}</div>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 26 }}>
          <VPreview phase="editing" pipelineProgress={progress} width={172} />
        </div>
        {stream}
      </div>

      <style>{`
        @media (max-width: 780px) {
          .editing-desktop { display: none !important; }
          .editing-mobile   { display: block !important; }
        }
      `}</style>
    </>
  );
}
