"use client";

import Link from "next/link";
import { Suspense, useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Play } from "lucide-react";
import type { Project, Profile } from "@/types";
import { formatRelativeTime } from "@/lib/utils";
import { TIER_LIMITS } from "@/types";
import PaymentSuccessToast from "@/components/dashboard/PaymentSuccessToast";

/* ── Status config ──────────────────────────────────────────── */
const STATUS_STYLE: Record<string, { label: string; bg: string; color: string; border: string; blink?: boolean }> = {
  draft:        { label: "Draft",     bg: "var(--paper-2)", color: "var(--muted)",   border: "var(--line)" },
  transcribing: { label: "Rendering", bg: "#fbf2d6",        color: "#8a6d10",        border: "#e8d88a", blink: true },
  analyzing:    { label: "Rendering", bg: "#fbf2d6",        color: "#8a6d10",        border: "#e8d88a", blink: true },
  deciding:     { label: "Rendering", bg: "#fbf2d6",        color: "#8a6d10",        border: "#e8d88a", blink: true },
  editing:      { label: "Rendering", bg: "#fbf2d6",        color: "#8a6d10",        border: "#e8d88a", blink: true },
  rendering:    { label: "Rendering", bg: "#fbf2d6",        color: "#8a6d10",        border: "#e8d88a", blink: true },
  done:         { label: "Ready",     bg: "var(--accent-soft)", color: "var(--accent-ink)", border: "color-mix(in oklab,var(--accent),#fff 60%)" },
  failed:       { label: "Failed",    bg: "#fce8e8",        color: "#c0392b",        border: "#f5c6c6" },
};

type FilterTab = "All" | "Ready" | "Rendering" | "Drafts";

function EditCard({ project }: { project: Project }) {
  const cfg = STATUS_STYLE[project.status] ?? STATUS_STYLE.draft;
  const isRendering = cfg.blink;
  const isDone = project.status === "done";

  return (
    <Link
      href={`/project/${project.id}`}
      style={{
        display: "block", textDecoration: "none",
        background: "var(--card)", border: "1px solid var(--line)",
        borderRadius: 16, overflow: "hidden",
        transition: "transform 0.18s cubic-bezier(.2,.7,.2,1), box-shadow 0.18s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 32px -12px rgba(20,19,15,0.14)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "";
        (e.currentTarget as HTMLElement).style.boxShadow = "";
      }}
    >
      {/* Thumbnail */}
      <div style={{ aspectRatio: "16/10", background: "var(--noir)", position: "relative" }}>
        <div className="ph-dark" style={{ position: "absolute", inset: 0 }}>
          9:16 CUT
        </div>
        {/* Status badge */}
        <span style={{
          position: "absolute", top: 10, left: 10,
          background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
          borderRadius: 999, padding: "4px 10px",
          fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em",
          textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 5,
        }}>
          {isRendering && <span className="live-dot" style={{ width: 5, height: 5, borderRadius: "50%", background: "#8a6d10", flexShrink: 0 }} />}
          {cfg.label}
        </span>
        {/* Play button (done) */}
        {isDone && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              background: "rgba(247,245,239,0.9)", backdropFilter: "blur(6px)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Play size={18} fill="var(--ink)" color="var(--ink)" />
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "14px 16px" }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {project.title}
        </p>
        <p style={{ fontSize: 12.5, color: "var(--muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
          {project.target_platform} · {formatRelativeTime(project.created_at)}
        </p>
      </div>
    </Link>
  );
}

function StatsStrip({ editsThisMonth, editsLeft, tier }: { editsThisMonth: number; editsLeft: number; tier: string }) {
  const stats = [
    { value: String(editsThisMonth), label: "Edits this month" },
    { value: "—",      label: "Total views"        },
    { value: "—",      label: "Avg footage→post"   },
    { value: `${editsLeft} left · ${tier}`, label: "Remaining" },
  ];

  return (
    <div style={{
      border: "1px solid var(--line)", borderRadius: 16,
      display: "grid", gridTemplateColumns: "repeat(4,1fr)",
      overflow: "hidden", marginBottom: 20,
    }}>
      {stats.map((s, i) => (
        <div key={s.label} style={{
          padding: "22px 24px",
          borderLeft: i > 0 ? "1px solid var(--line)" : undefined,
        }}>
          <p style={{ fontFamily: "var(--font-serif)", fontSize: 38, color: "var(--ink)", lineHeight: 1, marginBottom: 6 }}>
            {s.value}
          </p>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)" }}>
            {s.label}
          </p>
        </div>
      ))}
      <style>{`@media(max-width:700px){.stats-strip{grid-template-columns:1fr 1fr!important}}`}</style>
    </div>
  );
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editsUsed, setEditsUsed] = useState(0);
  const [filter, setFilter] = useState<FilterTab>("All");
  const [greeting, setGreeting] = useState("Good day");

  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");

    const load = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: proj }, { data: prof }] = await Promise.all([
        supabase.from("projects").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
        supabase.from("profiles").select("*").eq("id", user.id).single(),
      ]);

      setProjects(proj as Project[] | null);
      setProfile(prof as Profile | null);

      const tier = (prof as Profile | null)?.tier ?? "free";
      const limits = TIER_LIMITS[tier];
      const period = limits.period === "lifetime" ? "lifetime" : new Date().toISOString().slice(0, 7);
      const { data: usage } = await supabase
        .from("usage_counters").select("edits_used")
        .eq("user_id", user.id).eq("period", period).maybeSingle();
      setEditsUsed((usage as { edits_used: number } | null)?.edits_used ?? 0);
    };
    load();
  }, []);

  const tier = profile?.tier ?? "free";
  const limits = TIER_LIMITS[tier];
  const editsLeft = Math.max(0, limits.edits - editsUsed);

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";
  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" });

  const FILTER_TABS: FilterTab[] = ["All", "Ready", "Rendering", "Drafts"];
  const filtered = (projects ?? []).filter((p) => {
    if (filter === "All") return true;
    if (filter === "Ready") return p.status === "done";
    if (filter === "Rendering") return ["transcribing","analyzing","deciding","editing","rendering"].includes(p.status);
    if (filter === "Drafts") return p.status === "draft";
    return true;
  });

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px var(--gutter)" }}>
      <Suspense fallback={null}>
        <PaymentSuccessToast />
      </Suspense>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32, gap: 16, flexWrap: "wrap" }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 10 }}>{dateStr}</p>
          <h1 className="display" style={{ fontSize: "clamp(32px,5vw,54px)", color: "var(--ink)" }}>
            {greeting},{" "}
            <em className="serif-i" style={{ color: "var(--accent)" }}>{firstName}.</em>
          </h1>
        </div>
        <Link
          href="/editor"
          className="btn btn-accent"
          style={{ flexShrink: 0, marginTop: 8 }}
        >
          <Plus size={15} />
          New edit
        </Link>
      </div>

      {/* Stats strip */}
      <StatsStrip editsThisMonth={editsUsed} editsLeft={editsLeft} tier={tier} />

      {/* New-edit noir banner */}
      <Link
        href="/editor"
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "var(--noir)", borderRadius: 18, padding: "28px 32px",
          marginBottom: 40, textDecoration: "none", position: "relative", overflow: "hidden",
          cursor: "pointer",
        }}
      >
        <div className="grain" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
        <p style={{
          fontFamily: "var(--font-serif)", fontSize: "clamp(18px,2.5vw,26px)",
          color: "var(--noir-text)", position: "relative", zIndex: 1,
          letterSpacing: "-0.01em",
        }}>
          Got footage? <em style={{ color: "var(--accent)" }}>Hand it over.</em>
        </p>
        <div style={{
          width: 54, height: 54, borderRadius: "50%",
          background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, position: "relative", zIndex: 1,
        }}>
          <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </div>
      </Link>

      {/* Edits library */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <h2 className="serif" style={{ fontSize: 22, color: "var(--ink)" }}>Your edits</h2>

        {/* Filter pills */}
        <div style={{ display: "flex", gap: 6 }}>
          {FILTER_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              style={{
                padding: "7px 15px", borderRadius: 999,
                border: "1px solid",
                borderColor: filter === tab ? "var(--ink)" : "var(--line-2)",
                background: filter === tab ? "var(--ink)" : "transparent",
                color: filter === tab ? "var(--paper)" : "var(--muted)",
                fontSize: 13, fontWeight: filter === tab ? 600 : 400,
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {projects === null ? (
        /* Loading skeleton */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 20 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ borderRadius: 16, overflow: "hidden", border: "1px solid var(--line)" }}>
              <div className="skeleton" style={{ aspectRatio: "16/10" }} />
              <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="skeleton" style={{ height: 16, width: "70%" }} />
                <div className="skeleton" style={{ height: 12, width: "45%" }} />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "64px 24px",
          border: "1px dashed var(--line-2)", borderRadius: 20,
        }}>
          <p style={{ fontSize: 16, color: "var(--muted)", marginBottom: 8 }}>
            {filter === "All" ? "No projects yet." : `No ${filter.toLowerCase()} projects.`}
          </p>
          {filter === "All" && (
            <Link href="/editor" className="btn btn-accent btn-sm" style={{ marginTop: 16, display: "inline-flex" }}>
              <Plus size={14} /> Create your first edit
            </Link>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 20 }}>
          {filtered.map((project) => (
            <EditCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
