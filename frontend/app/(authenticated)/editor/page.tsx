"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import VideoUploadZone, { type UploadedFile } from "@/components/editor/VideoUploadZone";
import { Sparkles, Mic, Music, Upload, Lock, Video, Zap, Film, BookOpen, TrendingUp } from "lucide-react";
import type { TargetPlatform, AudioTreatment, StylePreset } from "@/types";

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

const STYLE_PRESETS: { value: StylePreset; label: string; desc: string; icon: React.ElementType }[] = [
  { value: "raw_real",    label: "Raw & Real",   desc: "Minimal cuts, authentic feel, let moments breathe",           icon: Video       },
  { value: "high_energy", label: "High Energy",  desc: "Fast cuts, kinetic captions, maximum punch",                  icon: Zap         },
  { value: "cinematic",   label: "Cinematic",    desc: "Slower pacing, music-driven, emotional arc",                  icon: Film        },
  { value: "educational", label: "Educational",  desc: "Clear structure, clean captions, easy to follow",             icon: BookOpen    },
  { value: "viral_hook",  label: "Viral Hook",   desc: "Entire edit optimised for the first 3 seconds",              icon: TrendingUp  },
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
  const [stylePreset, setStylePreset] = useState<StylePreset>("high_energy");
  const [outcome, setOutcome] = useState<string | null>(null);
  const [userTier] = useState<"free" | "starter" | "pro">("free");
  const [submitting, setSubmitting] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<"idle" | "uploading" | "processing">("idle");
  const [uploadProgress, setUploadProgress] = useState(0);

  const canSubmit = files.length > 0 && title.trim().length > 0 && contentContext.trim().length > 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setUploadPhase("uploading");
    setUploadProgress(0);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("You must be signed in."); setSubmitting(false); setUploadPhase("idle"); return; }

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
          style_preset: stylePreset,
          status: "draft",
          video_urls: [],
        })
        .select().single();

      if (projectError || !project) throw new Error(projectError?.message ?? "Failed to create project");

      // Use XHR for upload so we get real onprogress events
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

      const totalBytes = files.reduce((sum, { file }) => sum + file.size, 0);
      const loadedByIndex = files.map(() => 0);

      const uploadFile = (file: File, path: string, idx: number): Promise<void> =>
        new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", `${supabaseUrl}/storage/v1/object/videos/${encodeURIComponent(path)}`);
          xhr.setRequestHeader("Authorization", `Bearer ${token}`);
          xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
          xhr.setRequestHeader("x-upsert", "false");
          xhr.upload.onprogress = (ev) => {
            if (!ev.lengthComputable) return;
            loadedByIndex[idx] = ev.loaded;
            const totalLoaded = loadedByIndex.reduce((a, b) => a + b, 0);
            setUploadProgress(Math.min(99, Math.round((totalLoaded / totalBytes) * 100)));
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) { resolve(); }
            else { reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText.slice(0, 200)}`)); }
          };
          xhr.onerror = () => reject(new Error("Upload failed — check your connection and try again"));
          xhr.send(file);
        });

      const uploadedUrls = await Promise.all(
        files.map(({ file }, idx) => {
          const ext = file.name.split(".").pop();
          const path = `${user.id}/${project.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
          return uploadFile(file, path, idx).then(() => path);
        })
      );

      setUploadProgress(100);
      setUploadPhase("processing");

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
      setUploadPhase("idle");
      setUploadProgress(0);
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
          <VideoUploadZone files={files} onChange={setFiles} maxFiles={25} />
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
          <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8, lineHeight: 1.55 }}>
            This is what Flicko reads to make every creative decision — what to cut, how to pace it, what audio fits, where to hook the viewer. The more specific you are about tone, context, and what makes this footage unique, the better the edit.
          </p>
          <FocusInput
            rows={4} value={contentContext} onChange={setContentContext}
            placeholder="e.g. Comedy skit where I pretend to be a customer complaining about slow Wi-Fi. Filmed in a café, casual tone, lots of exaggerated reactions. The punchline is at the end when the waiter reveals he's the CEO of the ISP."
          />
          {contentContext.length > 0 && contentContext.length < 40 && (
            <p style={{ fontSize: 12, color: "var(--accent-ink)", marginTop: 6 }}>
              A bit more detail helps Flicko make sharper decisions.
            </p>
          )}
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

        {/* Style preset */}
        <section>
          <SectionLabel>Edit style</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {STYLE_PRESETS.map(({ value, label, desc, icon: Icon }) => {
              const active = stylePreset === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStylePreset(value)}
                  style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
                    borderRadius: 12, textAlign: "left",
                    border: `1px solid ${active ? "var(--ink)" : "var(--line)"}`,
                    background: active ? "color-mix(in oklab,var(--ink),#fff 94%)" : "var(--card)",
                    cursor: "pointer", transition: "all 0.15s",
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
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", display: "block" }}>{label}</span>
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
              width: "100%", justifyContent: "center", position: "relative", overflow: "hidden",
              opacity: !canSubmit || submitting ? 0.85 : 1,
              cursor: !canSubmit || submitting ? "not-allowed" : "pointer",
            }}
          >
            {/* Upload progress fill */}
            {uploadPhase === "uploading" && (
              <span style={{
                position: "absolute", inset: 0, left: 0,
                width: `${uploadProgress}%`,
                background: "rgba(255,255,255,0.15)",
                transition: "width 0.3s ease",
                pointerEvents: "none",
              }} />
            )}

            {uploadPhase === "uploading" ? (
              <>
                <span style={{
                  width: 14, height: 14, border: "2px solid rgba(255,255,255,0.35)",
                  borderTopColor: "#fff", borderRadius: "50%", display: "inline-block",
                  animation: "spin 0.8s linear infinite",
                }} />
                Uploading{files.length > 1 ? ` ${files.length} videos` : ""}… {uploadProgress}%
              </>
            ) : uploadPhase === "processing" ? (
              <>
                <span style={{
                  width: 14, height: 14, border: "2px solid rgba(255,255,255,0.35)",
                  borderTopColor: "#fff", borderRadius: "50%", display: "inline-block",
                  animation: "spin 0.8s linear infinite",
                }} />
                Starting edit…
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
