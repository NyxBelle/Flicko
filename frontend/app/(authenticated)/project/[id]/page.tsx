"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { EditingView } from "@/components/editor/EditingView";
import { ResultView, type AdjustPayload } from "@/components/editor/ResultView";
import type { EditDecision, Project } from "@/types";
import { toast } from "sonner";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

const PROCESSING_STATUSES = new Set([
  "transcribing",
  "analyzing",
  "deciding",
  "editing",
  "rendering",
]);

// ── Back arrow ────────────────────────────────────────────────────────────────

function BackArrow() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M10 7l-5 5 5 5" />
    </svg>
  );
}

// ── Error state ───────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry, retrying }: { message: string; onRetry: () => void; retrying: boolean }) {
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "48px 24px" }}>
      <div
        style={{
          background: "color-mix(in oklab, #ef4444, var(--paper) 88%)",
          border: "1px solid color-mix(in oklab, #ef4444, var(--paper) 70%)",
          borderRadius: 16,
          padding: 24,
          display: "flex",
          gap: 16,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
          <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
        </svg>
        <div>
          <div style={{ fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>Edit failed</div>
          <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.5, margin: 0 }}>
            {message || "Something went wrong processing your video."}
          </p>
        </div>
      </div>
      <button
        onClick={onRetry}
        disabled={retrying}
        style={{
          marginTop: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          width: "100%",
          padding: "13px 22px",
          borderRadius: 999,
          border: "1px solid var(--line-2)",
          background: "transparent",
          color: "var(--ink)",
          fontFamily: "var(--font-sans), system-ui, sans-serif",
          fontWeight: 600,
          fontSize: 14,
          cursor: retrying ? "default" : "pointer",
          opacity: retrying ? 0.5 : 1,
          transition: "all .18s",
        }}
      >
        {retrying ? (
          <>
            <span className="spin" style={{ width: 14, height: 14, border: "2px solid var(--line-2)", borderTopColor: "var(--ink)", borderRadius: 99, display: "inline-block" }} />
            Retrying…
          </>
        ) : (
          "Retry this edit"
        )}
      </button>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "48px 24px" }}>
      <div className="skeleton" style={{ height: 36, width: 240, borderRadius: 8, marginBottom: 16 }} />
      <div className="skeleton" style={{ height: 20, width: 180, borderRadius: 8, marginBottom: 32 }} />
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 56 }}>
        <div className="skeleton" style={{ aspectRatio: "9/16", borderRadius: 20 }} />
        <div style={{ display: "grid", gap: 16 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton" style={{ height: 24, borderRadius: 8 }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProjectPage({ params }: ProjectPageProps) {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [project, setProject]     = useState<Project | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [retrying, setRetrying]   = useState(false);
  const [hasBeenDone, setHasBeenDone] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Resolve async params
  useEffect(() => {
    params.then((p) => setProjectId(p.id));
  }, [params]);

  const fetchSignedUrl = async (renderPath: string) => {
    const supabase = createClient();
    const { data: signed } = await supabase.storage
      .from("renders")
      .createSignedUrl(renderPath, 3600);
    if (signed?.signedUrl) setSignedUrl(signed.signedUrl);
  };

  const fetchProject = async (id: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .single();

    if (!data) return;
    setProject(data as Project);

    if (data.status === "done") {
      setHasBeenDone(true);
      if (data.render_url) {
        await fetchSignedUrl(data.render_url);
      }
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    if (data.status === "failed") {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  };

  useEffect(() => {
    if (!projectId) return;
    fetchProject(projectId);
    intervalRef.current = setInterval(() => fetchProject(projectId), 4000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Resume polling when project goes back to "rendering" (after an adjust)
  useEffect(() => {
    if (!projectId || !project) return;
    if (project.status === "rendering" && !intervalRef.current) {
      intervalRef.current = setInterval(() => fetchProject(projectId), 4000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.status]);

  const handleRetry = async () => {
    if (!projectId) return;
    setRetrying(true);
    try {
      const res = await fetch("/api/projects/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) throw new Error("Retry failed");
      toast.success("Retry started");
      setProject(p => p ? { ...p, status: "transcribing" } : p);
      setSignedUrl(null);
      intervalRef.current = setInterval(() => fetchProject(projectId!), 4000);
    } catch {
      toast.error("Retry failed. Please try again.");
    } finally {
      setRetrying(false);
    }
  };

  const handleAdjust = async (changes: AdjustPayload) => {
    if (!projectId) return;
    try {
      const res = await fetch("/api/projects/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, changes }),
      });
      if (!res.ok) throw new Error("Adjust failed");

      // Clear signed URL while re-rendering; resume polling
      setSignedUrl(null);
      setProject(p => p ? { ...p, status: "rendering" } : p);
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => fetchProject(projectId), 4000);
    } catch {
      toast.error("Could not apply change. Please try again.");
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!project) return <LoadingSkeleton />;

  const isProcessing = PROCESSING_STATUSES.has(project.status);
  const isDone       = project.status === "done";
  const isFailed     = project.status === "failed";
  const isRerendering = hasBeenDone && project.status === "rendering";

  const pageStyle: React.CSSProperties = {
    padding: "36px clamp(18px, 5vw, 48px) 80px",
    minHeight: "100%",
  };

  return (
    <div style={pageStyle}>
      {/* Back link */}
      <Link
        href="/dashboard"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13.5,
          color: "var(--muted)",
          textDecoration: "none",
          marginBottom: 32,
          fontWeight: 500,
          transition: "color .15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}
      >
        <BackArrow />
        Back to projects
      </Link>

      {/* ── First-time processing: show the reasoning stream ─── */}
      {isProcessing && !hasBeenDone && (
        <EditingView project={project} />
      )}

      {/* ── Done (or re-rendering an adjustment): show result ── */}
      {(isDone || isRerendering) && project.edit_decisions && (
        <ResultView
          project={{
            id: project.id,
            desired_outcome: project.desired_outcome ?? "",
            target_platform: project.target_platform,
            edit_decisions: project.edit_decisions as EditDecision,
          }}
          videoSrc={signedUrl}
          recutting={isRerendering}
          onAdjust={handleAdjust}
        />
      )}

      {/* ── Failed ─────────────────────────────────────────────── */}
      {isFailed && !hasBeenDone && (
        <ErrorState
          message={project.error_message ?? ""}
          onRetry={handleRetry}
          retrying={retrying}
        />
      )}
    </div>
  );
}
