"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import VideoUploadZone, { type UploadedFile } from "@/components/editor/VideoUploadZone";
import { Sparkles, Mic, Music, Upload, Lock } from "lucide-react";
import type { TargetPlatform, AudioTreatment } from "@/types";

const PLATFORMS: { value: TargetPlatform; label: string; ratio: string }[] = [
  { value: "tiktok",   label: "TikTok",   ratio: "9:16" },
  { value: "reels",    label: "Reels",    ratio: "9:16" },
  { value: "shorts",   label: "Shorts",   ratio: "9:16" },
  { value: "linkedin", label: "LinkedIn", ratio: "16:9" },
  { value: "youtube",  label: "YouTube",  ratio: "16:9" },
];

const OUTCOMES = [
  "Go viral on Reels",
  "Build watch-time",
  "Drive to my link",
  "Grow followers",
];

const AUDIO_OPTIONS: { value: AudioTreatment; label: string; desc: string; icon: React.ElementType; proOnly?: boolean }[] = [
  { value: "flicko_decides", label: "Let Flicko decide", desc: "Flicko picks the best audio for your content", icon: Sparkles },
  { value: "trending_sound", label: "Trending sound",    desc: "Overlay a viral audio track on your clip",   icon: Music   },
  { value: "voiceover",      label: "My voice",          desc: "Narrate with your cloned voice",             icon: Mic, proOnly: true },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="eyebrow" style={{ marginBottom: 10 }}>{children}</p>
  );
}

function FocusInput({ value, onChange, placeholder, rows }: {
  value: string; onChange: (v: string) => void;
  placeholder: string; rows?: number;
}) {
  const [focused, setFocused] = useState(false);
  const style = {
    width: "100%", background: "var(--card)",
    border: `1px solid ${focused ? "var(--ink)" : "var(--line-2)"}`,
    borderRadius: 10, padding: "13px 16px", fontSize: 14, lineHeight: 1.55,
    color: "var(--ink)", outline: "none", resize: "none" as const,
    transition: "border-color 0.15s", fontFamily: "var(--font-sans)",
  };
  return rows ? (
    <textarea
      rows={rows} value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      style={style}
    />
  ) : (
    <input
      type="text" value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      style={style}
    />
  );
}

export default function EditorPage() {
  const router = useRouter();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [title, setTitle] = useState("");
  const [contentContext, setContentContext] = useState("");
  const [desiredOutcome, setDesiredOutcome] = useState("");
  const [platform, setPlatform] = useState<TargetPlatform>("tiktok");
  const [audioPreference, setAudioPreference] = useState<AudioTreatment>("flicko_decides");
  const [outcome, setOutcome] = useState<string | null>(null);
  const [userTier] = useState<"free" | "starter" | "pro">("free");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = files.length > 0 && title.trim().length > 0 && contentContext.trim().length > 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("You must be signed in."); setSubmitting(false); return; }

    try {
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .insert({
          user_id: user.id,
          title: title.trim(),
          content_context: contentContext.trim(),
          desired_outcome: (outcome ?? desiredOutcome).trim(),
          target_platform: platform,
          audio_preference: audioPreference,
          status: "draft",
          video_urls: [],
        })
        .select().single();

      if (projectError || !project) throw new Error(projectError?.message ?? "Failed to create project");

      const uploadedUrls: string[] = [];
      for (const { file } of files) {
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${project.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("videos").upload(path, file, { contentType: file.type });
        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
        uploadedUrls.push(path);
      }

      await supabase.from("projects").update({ video_urls: uploadedUrls, status: "transcribing" }).eq("id", project.id);

      const res = await fetch("/api/projects/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to start processing");
      }

      toast.success("Edit started! Flicko is working on your video.");
      router.push(`/project/${project.id}`);
    } catch (err) {
      toast.error((err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "44px var(--gutter)" }}>
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <p className="eyebrow" style={{ marginBottom: 10 }}>New edit</p>
        <h1 className="display" style={{ fontSize: "clamp(30px,4vw,46px)", color: "var(--ink)" }}>
          Hand over your{" "}
          <em className="serif-i" style={{ color: "var(--accent)" }}>footage.</em>
        </h1>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 32 }}>

        {/* Upload */}
        <section>
          <SectionLabel>Your footage</SectionLabel>
          <VideoUploadZone files={files} onChange={setFiles} maxFiles={5} />
        </section>

        {/* Title */}
        <section>
          <SectionLabel>Project title</SectionLabel>
          <FocusInput
            value={title} onChange={setTitle}
            placeholder="e.g. Product launch — May 2026"
          />
        </section>

        {/* What's in it */}
        <section>
          <SectionLabel>What&apos;s in it?</SectionLabel>
          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>
            Describe the content — who&apos;s in it, what happens, the tone.
          </p>
          <FocusInput
            rows={4} value={contentContext} onChange={setContentContext}
            placeholder="e.g. Comedy skit where I pretend to be a customer complaining about slow Wi-Fi…"
          />
        </section>

        {/* What should it do — outcome pills */}
        <section>
          <SectionLabel>What should it do?</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {OUTCOMES.map((o) => {
              const active = outcome === o;
              return (
                <button
                  key={o} type="button" onClick={() => setOutcome(active ? null : o)}
                  style={{
                    padding: "9px 18px", borderRadius: 999,
                    border: `1px solid ${active ? "var(--ink)" : "var(--line-2)"}`,
                    background: active ? "var(--ink)" : "transparent",
                    color: active ? "var(--paper)" : "var(--muted)",
                    fontSize: 13.5, fontWeight: active ? 600 : 400,
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                >{o}</button>
              );
            })}
          </div>
          {!outcome && (
            <div style={{ marginTop: 10 }}>
              <FocusInput
                rows={2} value={desiredOutcome} onChange={setDesiredOutcome}
                placeholder="Or describe what you want in your own words…"
              />
            </div>
          )}
        </section>

        {/* Platform */}
        <section>
          <SectionLabel>Target platform</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {PLATFORMS.map(({ value, label, ratio }) => {
              const active = platform === value;
              return (
                <button
                  key={value} type="button" onClick={() => setPlatform(value)}
                  style={{
                    padding: "10px 18px", borderRadius: 999,
                    border: `1px solid ${active ? "var(--ink)" : "var(--line-2)"}`,
                    background: active ? "var(--ink)" : "transparent",
                    color: active ? "var(--paper)" : "var(--muted)",
                    fontSize: 13, cursor: "pointer", transition: "all 0.15s",
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  <span style={{ fontWeight: active ? 600 : 400 }}>{label}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, opacity: 0.65 }}>{ratio}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Audio */}
        <section>
          <SectionLabel>Audio treatment</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {AUDIO_OPTIONS.map(({ value, label, desc, icon: Icon, proOnly }) => {
              const locked = proOnly && userTier !== "pro";
              const active = audioPreference === value && !locked;
              return (
                <button
                  key={value} type="button"
                  disabled={locked}
                  onClick={() => !locked && setAudioPreference(value)}
                  style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
                    borderRadius: 12, textAlign: "left",
                    border: `1px solid ${active ? "var(--ink)" : "var(--line)"}`,
                    background: active ? "color-mix(in oklab,var(--ink),#fff 94%)" : "var(--card)",
                    cursor: locked ? "not-allowed" : "pointer",
                    opacity: locked ? 0.5 : 1,
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    background: active ? "var(--ink)" : "var(--paper-2)",
                    border: `1px solid ${active ? "transparent" : "var(--line)"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon size={16} color={active ? "var(--paper)" : "var(--muted)"} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{label}</span>
                      {locked && (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em",
                          textTransform: "uppercase", color: "var(--muted)",
                          border: "1px solid var(--line-2)", borderRadius: 999, padding: "3px 8px",
                        }}>
                          <Lock size={9} /> Pro
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{desc}</p>
                  </div>
                  {active && (
                    <div style={{
                      width: 18, height: 18, borderRadius: "50%", background: "var(--ink)",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--paper)" }} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Submit */}
        <div style={{ paddingTop: 4 }}>
          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="btn btn-accent btn-lg"
            style={{
              width: "100%", justifyContent: "center",
              opacity: !canSubmit || submitting ? 0.5 : 1,
              cursor: !canSubmit || submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? (
              <>
                <span className="spin" style={{
                  width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: "#fff", borderRadius: "50%", display: "inline-block",
                }} />
                Uploading and starting edit…
              </>
            ) : (
              <>
                <Upload size={16} />
                Make my edit
              </>
            )}
          </button>
          {!canSubmit && !submitting && (
            <p style={{ textAlign: "center", fontSize: 12, color: "var(--faint)", marginTop: 10 }}>
              {files.length === 0 ? "Add at least one video to continue" : "Fill in all fields to continue"}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
