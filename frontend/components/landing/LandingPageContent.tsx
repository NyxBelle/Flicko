"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/* ── Design tokens (hardcoded so they never rely on CSS-var resolution) ── */
const C = {
  paper:       "#eef2ee",
  paper2:      "#efece2",
  card:        "#fffefb",
  ink:         "#14130f",
  inkSoft:     "#2a2823",
  muted:       "#6c6657",
  faint:       "#9a9484",
  line:        "#e2ddd0",
  line2:       "#d3ccba",
  noir:        "#100f0c",
  noir2:       "#1a1814",
  noirLine:    "#2c2a24",
  noirText:    "#f3f0e7",
  noirMuted:   "#97917f",
  accent:      "#1fb87a",
  accentInk:   "#178f5e",
  accentSoft:  "#cdeade",
} as const;

/* ── SVG Icons ─────────────────────────────────────────────── */
function IconArrow({ size = 18, sw = 1.6 }: { size?: number; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
function IconSpark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
    </svg>
  );
}
function IconCheck({ size = 16, sw = 2.4 }: { size?: number; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  );
}
function IconScissors({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" />
      <path d="M8 8l12 10M8 16 20 6" />
    </svg>
  );
}
function IconUpload({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
    </svg>
  );
}
function IconDownload({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4v12M7 11l5 5 5-5M5 20h14" />
    </svg>
  );
}
function IconFrame({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 9h18M8 5v14" />
    </svg>
  );
}
function IconMic({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
function IconCaptions({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 11h4M7 14h7M14 11h3" />
    </svg>
  );
}
function IconWave({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h2l2-6 3 14 3-11 2 7 2-4h4" />
    </svg>
  );
}
function IconEye({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="2.8" />
    </svg>
  );
}
function IconPlayFill() {
  return <svg width={10} height={10} viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>;
}

/* ── Scroll reveal ──────────────────────────────────────────── */
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } });
      },
      { threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(18px)",
        transition: `opacity 0.8s cubic-bezier(0.2,0.7,0.2,1) ${delay}s, transform 0.8s cubic-bezier(0.2,0.7,0.2,1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

/* ── Nav ────────────────────────────────────────────────────── */
function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll);
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: scrolled ? "rgba(247,245,239,0.85)" : "transparent",
        backdropFilter: scrolled ? "saturate(140%) blur(14px)" : "none",
        WebkitBackdropFilter: scrolled ? "saturate(140%) blur(14px)" : "none",
        borderBottom: scrolled ? `1px solid ${C.line}` : "1px solid transparent",
        transition: "all 0.25s ease",
      }}
    >
      <div style={{
        maxWidth: 1280,
        margin: "0 auto",
        paddingInline: "clamp(20px, 5vw, 72px)",
        height: 72,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 24,
      }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/flick-mark-ink.svg" alt="" width={26} height={26} style={{ display: "block" }} />
          <span style={{ fontWeight: 800, fontSize: 20, letterSpacing: "-0.04em", color: C.ink }}>Flicko</span>
        </Link>

        <nav className="l-nav-links" style={{ display: "flex", alignItems: "center", gap: 30 }}>
          {[
            { label: "How it works", href: "#how" },
            { label: "Pricing", href: "/pricing" },
          ].map((l) => (
            <Link key={l.label} href={l.href}
              style={{ fontSize: 15, fontWeight: 500, color: C.inkSoft, textDecoration: "none" }}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/login" className="l-btn l-btn-ghost l-btn-sm">Log in</Link>
          <Link href="/signup" className="l-btn l-btn-accent l-btn-sm">
            Start free <IconArrow size={15} />
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ── Hero preview card (animated AI thinking) ───────────────── */
function HeroPreview() {
  const lines = [
    "Your hook lands late, at 0:06",
    "3 high-energy moments found",
    "Reframing 9:16 across pans",
  ];
  const [n, setN] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setN((x) => (x % lines.length) + 1), 1400);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.line}`,
      borderRadius: 18,
      overflow: "hidden",
      boxShadow: "0 40px 80px -40px rgba(20,19,15,0.4)",
      width: "100%",
    }}>
      {/* Window chrome */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 18px", borderBottom: `1px solid ${C.line}` }}>
        <span style={{ display: "flex", gap: 6 }}>
          {[C.line, C.line, C.accent].map((bg, i) => (
            <span key={i} style={{ width: 9, height: 9, borderRadius: 99, background: bg, display: "block" }} />
          ))}
        </span>
        <span style={{ fontFamily: "var(--font-mono-l)", fontSize: 11.5, color: C.faint, letterSpacing: "0.06em", marginLeft: 4 }}>
          flicko · editing
        </span>
        <span style={{
          marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6,
          fontFamily: "var(--font-mono-l)", fontSize: 11.5, letterSpacing: "0.08em",
          textTransform: "uppercase", color: C.muted,
          border: `1px solid ${C.line2}`, borderRadius: 999, padding: "4px 10px", background: C.card,
        }}>
          <span className="l-live-dot" style={{ width: 7, height: 7, borderRadius: 50, background: C.accent, display: "inline-block" }} />
          live
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 132px" }}>
        {/* AI thinking panel */}
        <div style={{ padding: "18px" }}>
          <div style={{ fontFamily: "var(--font-mono-l)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: C.muted, marginBottom: 12 }}>
            Making creative decisions
          </div>
          <div style={{ display: "grid", gap: 9 }}>
            {lines.map((line, i) => {
              const done = i < n - 1;
              const active = i === n - 1;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, opacity: i < n ? 1 : 0.35, transition: "opacity 0.4s" }}>
                  <span style={{
                    width: 17, height: 17, borderRadius: 99, flexShrink: 0,
                    display: "grid", placeItems: "center",
                    border: `1.4px solid ${i < n ? C.accent : C.line2}`,
                    background: done ? C.accent : "transparent", color: "#fff",
                  }}>
                    {done && <IconCheck size={10} sw={3} />}
                    {active && <span className="l-live-dot" style={{ width: 5, height: 5, borderRadius: 99, background: C.accent, display: "block" }} />}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono-l)", fontSize: 12, color: C.inkSoft }}>{line}</span>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: C.accent, color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <IconScissors size={14} />
              </div>
              <p style={{ margin: 0, fontSize: 12.5, color: C.muted, lineHeight: 1.45 }}>
                <strong style={{ color: C.ink, fontWeight: 700 }}>I killed the first 4 seconds.</strong>{" "}
                Your hook was buried — it opens cold on it now.
              </p>
            </div>
          </div>
        </div>

        {/* 9:16 video preview */}
        <div style={{ position: "relative", background: C.noir, borderLeft: `1px solid ${C.line}` }}>
          <div style={{
            position: "absolute", inset: 0,
            background: `repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0 2px, transparent 2px 9px), ${C.noir2}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-mono-l)", fontSize: 9, letterSpacing: "0.1em",
            textTransform: "uppercase", color: C.noirMuted,
          }}>9:16</div>
          <div style={{
            position: "absolute", left: 0, right: 0, height: 34, top: "42%",
            background: "linear-gradient(to bottom, transparent, rgba(255,77,35,0.38), transparent)",
          }} />
          <div style={{ position: "absolute", left: 8, right: 8, bottom: 14, textAlign: "center" }}>
            <span style={{ background: "#fff", color: "#111", fontWeight: 800, fontSize: 10, padding: "2px 5px", borderRadius: 4 }}>
              like <span style={{ color: C.accent }}>this</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Hero ───────────────────────────────────────────────────── */
function Hero() {
  return (
    <section style={{ paddingTop: 56, paddingBottom: 80 }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", paddingInline: "clamp(20px, 5vw, 72px)" }}>
        <div className="l-hero-grid" style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 56, alignItems: "center" }}>
          <div className="l-rise">
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              fontFamily: "var(--font-mono-l)", fontSize: 11.5, letterSpacing: "0.08em",
              textTransform: "uppercase", color: C.muted,
              border: `1px solid ${C.line2}`, borderRadius: 999, padding: "6px 12px",
              background: C.card, marginBottom: 24,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: 50, background: C.accent, display: "inline-block" }} />
              AI video editor · with judgment
            </span>

            <h1 className="l-display" style={{ fontSize: "clamp(46px, 6.4vw, 92px)", marginTop: 0, color: C.ink }}>
              Your footage,<br />
              edited the way a<br />
              <em style={{ fontStyle: "italic" }}>great human</em> would.
            </h1>

            <p style={{ fontSize: "clamp(17px, 1.4vw, 20px)", color: C.muted, maxWidth: 480, marginTop: 26, marginBottom: 0, lineHeight: 1.5 }}>
              Not clips. Not a template. A real edit — every cut, caption and beat decided by an
              AI that reads <strong style={{ color: C.ink, fontWeight: 600 }}>your</strong> video,
              then tells you exactly why.
            </p>

            <div style={{ display: "flex", gap: 14, marginTop: 32, flexWrap: "wrap" }}>
              <Link href="/signup" className="l-btn l-btn-accent l-btn-lg">
                <IconSpark size={18} /> Edit your first video free
              </Link>
              <Link href="#how" className="l-btn l-btn-ghost l-btn-lg">See how it works</Link>
            </div>

            <p style={{ fontFamily: "var(--font-mono-l)", fontSize: 12, color: C.faint, marginTop: 18, letterSpacing: "0.04em" }}>
              2 FREE EDITS · NO CARD · POST-READY IN MINUTES
            </p>
          </div>

          <div className="l-rise" style={{ animationDelay: "0.12s" }}>
            <HeroPreview />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Platform strip ─────────────────────────────────────────── */
function PlatformStrip() {
  const platforms = ["Instagram Reels", "TikTok", "YouTube Shorts", "X", "LinkedIn"];
  return (
    <div style={{ borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}`, background: C.paper }}>
      <div style={{
        maxWidth: 1280, margin: "0 auto",
        padding: "20px clamp(20px, 5vw, 72px)",
        display: "flex", alignItems: "center", gap: 32,
        flexWrap: "wrap", justifyContent: "center",
      }}>
        <span style={{ fontFamily: "var(--font-mono-l)", fontSize: 11.5, color: C.faint, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Post-ready for
        </span>
        {platforms.map((p) => (
          <span key={p} style={{ fontWeight: 600, fontSize: 16, color: C.inkSoft, opacity: 0.75 }}>{p}</span>
        ))}
      </div>
    </div>
  );
}

/* ── How it works ───────────────────────────────────────────── */
const HOW_STEPS = [
  { n: "01", title: "Upload", body: "Drop your raw footage — phone clips, long takes, B-roll, whatever you shot. Up to 4K.", Icon: IconUpload },
  { n: "02", title: "Describe", body: "Tell Flicko what it is and what you want it to do. A sentence is enough.", Icon: IconSpark },
  { n: "03", title: "Receive", body: "Get back a finished, post-ready cut — with a written rationale for every decision.", Icon: IconDownload },
];

function HowItWorks() {
  return (
    <section id="how" style={{ paddingTop: 100, paddingBottom: 90, scrollMarginTop: 80 }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", paddingInline: "clamp(20px, 5vw, 72px)" }}>
        <Reveal>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 20, marginBottom: 54 }}>
            <div>
              <div className="l-eyebrow" style={{ marginBottom: 14 }}>How it works</div>
              <h2 className="l-display" style={{ fontSize: "clamp(34px, 4.4vw, 60px)", maxWidth: 620, color: C.ink }}>
                Three steps. <em style={{ fontStyle: "italic" }}>No timeline,</em> no tutorials.
              </h2>
            </div>
          </div>
        </Reveal>

        <div className="l-how-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0, borderTop: `1px solid ${C.ink}` }}>
          {HOW_STEPS.map(({ n, title, body, Icon }, i) => (
            <Reveal key={n} delay={i * 0.08}>
              <div style={{ padding: "34px 30px 40px", borderRight: i < 2 ? `1px solid ${C.line}` : "none", height: "100%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 }}>
                  <span style={{ fontFamily: "var(--font-mono-l)", fontSize: 13, color: C.accentInk, letterSpacing: "0.1em" }}>{n}</span>
                  <span style={{ color: C.inkSoft }}><Icon size={22} /></span>
                </div>
                <h3 style={{ fontFamily: "var(--font-serif-l)", fontWeight: 400, fontSize: 36, margin: "0 0 12px", color: C.ink }}>{title}</h3>
                <p style={{ fontSize: 16, color: C.muted, lineHeight: 1.55, maxWidth: 300, margin: 0 }}>{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Differentiator (dark section) ─────────────────────────── */
const DIFF_COLS = [
  {
    heading: "A template tool", muted: true,
    items: [
      "Applies the same formula to every clip",
      "Cuts on a fixed interval, ignores your hook",
      "Generic captions, generic sounds",
      "You still fix it all in CapCut",
    ],
  },
  {
    heading: "Flicko", muted: false,
    items: [
      "Reads the context of this specific video",
      "Finds your hook and builds the edit around it",
      "Chooses captions & sound that fit the energy",
      "Hands back a finished cut — and its reasoning",
    ],
  },
];

function Differentiator() {
  return (
    <section className="l-grain" style={{ position: "relative", background: C.noir, color: C.noirText, overflow: "hidden" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", paddingInline: "clamp(20px, 5vw, 72px)", paddingTop: 110, paddingBottom: 110 }}>
        <Reveal>
          <div className="l-eyebrow" style={{ color: C.noirMuted, marginBottom: 26 }}>The difference</div>
          <h2 className="l-display" style={{ fontSize: "clamp(38px, 6vw, 92px)", color: C.noirText, maxWidth: 1000 }}>
            Every other tool applies{" "}
            <em style={{ fontStyle: "italic", color: C.noirMuted }}>rules.</em>
            <br />
            Flicko applies{" "}
            <em style={{ fontStyle: "italic", color: C.accent }}>judgment.</em>
          </h2>
        </Reveal>

        <div className="l-diff-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, marginTop: 70, borderTop: `1px solid ${C.noirLine}` }}>
          {DIFF_COLS.map((col, ci) => (
            <Reveal key={col.heading} delay={ci * 0.1}>
              <div style={{ padding: "34px 36px", borderRight: ci === 0 ? `1px solid ${C.noirLine}` : "none", height: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 26 }}>
                  {!col.muted && (
                    <span style={{ width: 26, height: 26, borderRadius: 7, background: C.accent, display: "grid", placeItems: "center", color: "#fff" }}>
                      <IconSpark size={15} />
                    </span>
                  )}
                  <h3 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em", margin: 0, color: col.muted ? C.noirMuted : C.noirText }}>
                    {col.heading}
                  </h3>
                </div>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 16 }}>
                  {col.items.map((item) => (
                    <li key={item} style={{ display: "flex", gap: 12, fontSize: 16.5, color: col.muted ? C.noirMuted : C.noirText, lineHeight: 1.45 }}>
                      <span style={{ flexShrink: 0, marginTop: 3, color: col.muted ? C.noirLine : C.accent }}>
                        {col.muted ? <IconArrow size={16} sw={2.2} /> : <IconCheck size={16} sw={2.2} />}
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Features ────────────────────────────────────────────────── */
const FEATURES = [
  { Icon: IconScissors, title: "Decisive cutting", body: "Finds the moments that matter and paces them to hold a feed scroll." },
  { Icon: IconFrame, title: "Smart reframing", body: "Reframes to 9:16, 1:1 or 16:9 and tracks your subject through every move." },
  { Icon: IconMic, title: "Voice cloning", body: "Voiceovers in your own cloned voice — no studio, no re-records.", pro: true },
  { Icon: IconCaptions, title: "Captions with taste", body: "Caption styles matched to the energy of your content, synced to the word." },
  { Icon: IconWave, title: "Sound that's trending", body: "Drops the right viral sound under the right moment, ducked under your voice." },
  { Icon: IconEye, title: "Shows its reasoning", body: "Every edit comes with a creative rationale, in plain language you can argue with." },
];

function Features() {
  return (
    <section style={{ paddingTop: 100, paddingBottom: 90, background: C.paper }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", paddingInline: "clamp(20px, 5vw, 72px)" }}>
        <Reveal>
          <div className="l-eyebrow" style={{ marginBottom: 14 }}>What it does</div>
          <h2 className="l-display" style={{ fontSize: "clamp(34px, 4.4vw, 60px)", maxWidth: 700, marginBottom: 52, color: C.ink }}>
            The work of a full <em style={{ fontStyle: "italic" }}>edit suite</em> — and an editor with taste.
          </h2>
        </Reveal>

        <div className="l-feat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0, borderTop: `1px solid ${C.line}`, borderLeft: `1px solid ${C.line}` }}>
          {FEATURES.map(({ Icon, title, body, pro }, i) => (
            <Reveal key={title} delay={(i % 3) * 0.07}>
              <div style={{
                padding: "30px 28px 34px",
                borderRight: `1px solid ${C.line}`,
                borderBottom: `1px solid ${C.line}`,
                height: "100%",
                background: C.paper,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
                  <span style={{
                    width: 38, height: 38, borderRadius: 9, background: C.card,
                    border: `1px solid ${C.line}`, display: "grid", placeItems: "center", color: C.ink,
                  }}>
                    <Icon size={19} />
                  </span>
                  {pro && (
                    <span style={{
                      display: "inline-flex", alignItems: "center",
                      fontFamily: "var(--font-mono-l)", fontSize: 10, letterSpacing: "0.08em",
                      textTransform: "uppercase", color: C.accent,
                      border: `1px solid ${C.accent}`, borderRadius: 999,
                      padding: "3px 9px", background: C.accentSoft,
                    }}>Pro</span>
                  )}
                </div>
                <h3 style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em", margin: "0 0 8px", color: C.ink }}>{title}</h3>
                <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.55, margin: 0 }}>{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Pricing teaser ─────────────────────────────────────────── */
const TIERS = [
  { name: "Free",    price: "$0",  note: "2 trial edits", feats: ["Full creative edits", "Rationale included", "720p export"],          cta: "Start free",      href: "/signup",   accent: false },
  { name: "Starter", price: "$10", note: "per month",     feats: ["10 edits / month", "1080p export", "All caption styles"],            cta: "Choose Starter",  href: "/pricing",  accent: false },
  { name: "Pro",     price: "$15", note: "per month",     feats: ["Everything in Starter", "Voice cloning", "4K · priority renders"],   cta: "Go Pro",          href: "/pricing",  accent: true  },
];

function PricingTeaser() {
  return (
    <section style={{ paddingTop: 90, paddingBottom: 90, background: C.paper }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", paddingInline: "clamp(20px, 5vw, 72px)" }}>
        <Reveal>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 44 }}>
            <div>
              <div className="l-eyebrow" style={{ marginBottom: 14 }}>Pricing</div>
              <h2 className="l-display" style={{ fontSize: "clamp(34px, 4.4vw, 58px)", color: C.ink }}>
                Less than <em style={{ fontStyle: "italic" }}>one</em> freelance edit.
              </h2>
            </div>
            <Link href="/pricing" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em",
              padding: "13px 22px", borderRadius: 999, border: `1px solid ${C.line2}`,
              background: "transparent", color: C.ink, textDecoration: "none",
              transition: "border-color 0.18s",
            }}>
              Full pricing <IconArrow size={15} />
            </Link>
          </div>
        </Reveal>

        <div className="l-price-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
          {TIERS.map((tier, i) => (
            <Reveal key={tier.name} delay={i * 0.08}>
              <div style={{
                borderRadius: 16, padding: "30px 28px", height: "100%", position: "relative",
                border: `1px solid ${tier.accent ? C.accent : C.line}`,
                background: tier.accent ? C.ink : C.card,
                color: tier.accent ? C.paper : C.ink,
              }}>
                {tier.accent && (
                  <span style={{
                    position: "absolute", top: 22, right: 24,
                    display: "inline-flex", alignItems: "center", gap: 7,
                    fontFamily: "var(--font-mono-l)", fontSize: 11.5, letterSpacing: "0.08em",
                    textTransform: "uppercase", color: "#fff",
                    border: "1px solid transparent", borderRadius: 999, padding: "6px 12px",
                    background: C.accent,
                  }}>Voice cloning</span>
                )}
                <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 14 }}>{tier.name}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 22 }}>
                  <span style={{ fontFamily: "var(--font-serif-l)", fontWeight: 400, fontSize: 52, lineHeight: 1 }}>{tier.price}</span>
                  <span style={{ fontSize: 14, color: tier.accent ? "rgba(247,245,239,0.6)" : C.muted }}>{tier.note}</span>
                </div>
                <ul style={{ listStyle: "none", margin: "0 0 26px", padding: 0, display: "grid", gap: 11 }}>
                  {tier.feats.map((f) => (
                    <li key={f} style={{ display: "flex", gap: 10, fontSize: 14.5, color: tier.accent ? "rgba(247,245,239,0.85)" : C.inkSoft }}>
                      <span style={{ color: C.accent, flexShrink: 0, marginTop: 2 }}><IconCheck size={16} sw={2.4} /></span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={tier.href}
                  style={{
                    display: "flex", justifyContent: "center",
                    padding: "13px 22px", borderRadius: 999, border: "1px solid transparent",
                    fontWeight: 600, fontSize: 15, textDecoration: "none",
                    ...(tier.accent
                      ? { background: C.accent, color: "#fff" }
                      : { background: "transparent", color: C.ink, borderColor: C.line2 }
                    ),
                  }}
                >
                  {tier.cta}
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Final CTA ──────────────────────────────────────────────── */
function FinalCTA() {
  return (
    <section style={{ paddingBottom: 100, background: C.paper }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", paddingInline: "clamp(20px, 5vw, 72px)" }}>
        <Reveal>
          <div className="l-grain" style={{
            position: "relative",
            borderRadius: 24,
            padding: "clamp(40px, 7vw, 90px)",
            textAlign: "center",
            background: C.accent,
            color: "#fff",
            overflow: "hidden",
          }}>
            <h2 className="l-display" style={{ fontSize: "clamp(38px, 6vw, 86px)", color: "#fff", position: "relative", zIndex: 2 }}>
              Go viral in <em style={{ fontStyle: "italic" }}>your own</em> voice.
            </h2>
            <p style={{ fontSize: "clamp(17px, 1.5vw, 21px)", color: "rgba(255,255,255,0.9)", maxWidth: 540, margin: "20px auto 0", lineHeight: 1.5, position: "relative", zIndex: 2 }}>
              Your first two edits are free. No card, no editor, no all-nighter in CapCut.
            </p>
            <Link
              href="/signup"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "#fff", color: C.ink,
                padding: "16px 28px", borderRadius: 999, border: "none",
                fontWeight: 600, fontSize: 16, textDecoration: "none",
                marginTop: 34, position: "relative", zIndex: 2,
              }}
            >
              <IconSpark size={18} /> Edit your first video free
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Footer ─────────────────────────────────────────────────── */
const FOOTER_COLS = [
  { heading: "Product",   links: [{ label: "The editor", href: "/editor" }, { label: "How it works", href: "#how" }, { label: "Pricing", href: "/pricing" }, { label: "Voice cloning", href: "/voice" }] },
  { heading: "Company",   links: [{ label: "About", href: "/" }, { label: "Creators", href: "/" }, { label: "Careers", href: "/" }, { label: "Press", href: "/" }] },
  { heading: "Resources", links: [{ label: "Help center", href: "/" }, { label: "Community", href: "/" }, { label: "Status", href: "/" }, { label: "Changelog", href: "/" }] },
];

function LandingFooter() {
  return (
    <footer className="l-grain" style={{ position: "relative", background: C.noir, color: C.noirText, overflow: "hidden" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", paddingInline: "clamp(20px, 5vw, 72px)", paddingTop: 88, paddingBottom: 40 }}>
        <div className="l-footer-grid" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 40 }}>
          <div>
            <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/flick-mark-white.svg" alt="" width={28} height={28} style={{ display: "block" }} />
              <span style={{ fontWeight: 800, fontSize: 22, letterSpacing: "-0.04em", color: C.noirText }}>Flicko</span>
            </Link>
            <p className="l-display" style={{ fontSize: 32, marginTop: 22, maxWidth: 360, color: C.noirText, lineHeight: 1.05 }}>
              Go viral in <em style={{ fontStyle: "italic" }}>your own</em> voice.
            </p>
            <Link href="/signup" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: C.accent, color: "#fff",
              padding: "13px 22px", borderRadius: 999, border: "none",
              fontWeight: 600, fontSize: 15, textDecoration: "none", marginTop: 24,
            }}>
              Start editing free <IconArrow size={15} />
            </Link>
          </div>

          {FOOTER_COLS.map((col) => (
            <div key={col.heading}>
              <div className="l-eyebrow" style={{ color: C.noirMuted, marginBottom: 18 }}>{col.heading}</div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="l-footer-link" style={{ color: C.noirMuted, fontSize: 15, textDecoration: "none" }}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div style={{ height: 1, background: C.noirLine, margin: "56px 0 26px" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <span style={{ fontFamily: "var(--font-mono-l)", fontSize: 12.5, color: C.noirMuted, letterSpacing: "0.04em" }}>
            © 2026 FLICKO — MADE FOR CREATORS
          </span>
          <div style={{ display: "flex", gap: 24 }}>
            {["Privacy", "Terms", "Cookies"].map((label) => (
              <Link key={label} href="/" className="l-footer-link"
                style={{ fontFamily: "var(--font-mono-l)", fontSize: 12.5, color: C.noirMuted, letterSpacing: "0.04em", textDecoration: "none" }}>
                {label.toUpperCase()}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ── Page ───────────────────────────────────────────────────── */
export function LandingPageContent() {
  return (
    <div style={{ background: C.paper, color: C.ink, minHeight: "100vh" }}>
      <LandingNav />
      <Hero />
      <PlatformStrip />
      <HowItWorks />
      <Differentiator />
      <Features />
      <PricingTeaser />
      <FinalCTA />
      <LandingFooter />
    </div>
  );
}
