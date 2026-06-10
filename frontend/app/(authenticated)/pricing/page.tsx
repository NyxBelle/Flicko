"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, ChevronDown } from "lucide-react";

/* ── Plan data ──────────────────────────────────────────────── */
const PLANS = [
  {
    id: "free", name: "Free", tier: "free",
    mo: 0, yr: 0, suffix: "forever",
    blurb: "Try Flicko with real edits, no card required.",
    features: ["2 lifetime edits", "All platforms (TikTok, Reels, Shorts…)", "Flicko creative decisions", "Captions and transitions", "Trending sound overlay"],
    missing: ["Voice cloning", "Priority processing"],
    cta: "Current plan",
  },
  {
    id: "starter", name: "Starter", tier: "starter",
    mo: 10, yr: 8, suffix: "/ month",
    blurb: "For consistent creators who need more edits every month.",
    features: ["10 edits per month", "All platforms", "Flicko creative decisions", "Captions and transitions", "Trending sound overlay", "Priority processing"],
    missing: ["Voice cloning"],
    cta: "Upgrade to Starter",
  },
  {
    id: "pro", name: "Pro", tier: "pro",
    mo: 15, yr: 12, suffix: "/ month",
    blurb: "Full creative control with your own cloned voice.",
    features: ["50 edits per month", "All platforms", "Flicko creative decisions", "Captions and transitions", "Trending sound overlay", "Priority processing", "Voice cloning (your voice, your edits)"],
    missing: [],
    cta: "Upgrade to Pro",
    popular: true,
  },
];

const FAQS = [
  {
    q: "Does Flicko really make editorial judgment calls?",
    a: "Yes — Flicko uses Claude to analyse your footage, understand your goal, and make the same creative decisions a skilled human editor would: what to cut, where to start, how to pace, what audio serves the content. It then explains each decision in plain language.",
  },
  {
    q: "How does voice cloning work?",
    a: "On Pro you upload a 30–60 second sample of your voice. Flicko trains a personal model and uses it to narrate edits in your voice — synced to the content, in your tone. Your voice data never leaves our infrastructure.",
  },
  {
    q: "What do I get on the Free plan?",
    a: "Two lifetime edits, full Flicko AI decisions, captions, transitions, and trending sound overlay. No credit card required. It's a real edit — not a watermarked preview.",
  },
  {
    q: "Can I ask Flicko to reconsider a decision?",
    a: "Yes. Every edit comes with a decision rationale. You can request adjustments on individual decisions — Flicko re-evaluates with your feedback while keeping the rest of the edit intact.",
  },
];

type Provider = "flutterwave" | "paystack";
type BillingPeriod = "monthly" | "annual";

function FaqRow({ q, a, defaultOpen }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div style={{ borderBottom: "1px solid var(--line)", paddingBlock: "18px 0" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "none", border: "none", cursor: "pointer", textAlign: "left",
          paddingBottom: 18, gap: 16,
        }}
      >
        <span style={{ fontSize: "clamp(15px,2vw,19px)", fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.01em" }}>{q}</span>
        <ChevronDown
          size={18}
          color="var(--muted)"
          style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
        />
      </button>
      <div style={{
        overflow: "hidden", maxHeight: open ? 300 : 0,
        transition: "max-height 0.3s cubic-bezier(.2,.7,.2,1)",
      }}>
        <p style={{ fontSize: 15, color: "var(--muted)", lineHeight: 1.65, paddingBottom: 20 }}>{a}</p>
      </div>
    </div>
  );
}

export default function PricingPage() {
  const [billing, setBilling] = useState<BillingPeriod>("monthly");
  const [provider, setProvider] = useState<Provider>("paystack");
  const [loading, setLoading] = useState<string | null>(null);

  const handleUpgrade = async (tier: string) => {
    if (tier === "free") return;
    setLoading(tier);
    try {
      const res = await fetch(`/api/billing/${provider}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to initiate checkout");
      }
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div style={{ maxWidth: "var(--maxw)", margin: "0 auto", padding: "64px var(--gutter)" }}>

      {/* Hero */}
      <div style={{ textAlign: "center", maxWidth: 680, margin: "0 auto 56px" }}>
        <span className="chip" style={{ marginBottom: 18 }}>Pricing</span>
        <h1 className="display" style={{ fontSize: "clamp(36px,6vw,72px)", color: "var(--ink)", marginBottom: 18 }}>
          Less than <em className="serif-i" style={{ color: "var(--accent)" }}>one</em> freelance edit.
        </h1>
        <p style={{ fontSize: 17, color: "var(--muted)", lineHeight: 1.6 }}>
          Freelance editors charge $50–200 per video. Flicko delivers the same creative judgment — AI-powered, explained, and post-ready — for the price of a coffee a week.
        </p>
      </div>

      {/* Billing toggle */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
        <div style={{
          display: "inline-flex", background: "var(--card)", border: "1px solid var(--line)",
          borderRadius: 999, padding: 4,
        }}>
          {(["monthly", "annual"] as BillingPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setBilling(p)}
              style={{
                padding: "8px 20px", borderRadius: 999, border: "none", cursor: "pointer",
                fontSize: 14, fontWeight: billing === p ? 600 : 400,
                background: billing === p ? "var(--ink)" : "transparent",
                color: billing === p ? "var(--paper)" : "var(--muted)",
                transition: "all 0.15s",
              }}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
              {p === "annual" && (
                <span style={{
                  marginLeft: 7, fontSize: 11, fontFamily: "var(--font-mono)",
                  color: billing === "annual" ? "var(--accent-soft)" : "var(--accent)",
                  letterSpacing: "0.04em",
                }}>save 20%</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Payment provider */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 48 }}>
        <span style={{ fontSize: 13, color: "var(--faint)", alignSelf: "center" }}>Pay with:</span>
        {(["paystack", "flutterwave"] as Provider[]).map((p) => (
          <button
            key={p}
            onClick={() => setProvider(p)}
            style={{
              padding: "5px 14px", borderRadius: 999,
              border: `1px solid ${provider === p ? "var(--ink)" : "var(--line-2)"}`,
              background: provider === p ? "var(--ink)" : "transparent",
              color: provider === p ? "var(--paper)" : "var(--muted)",
              fontSize: 12.5, fontWeight: provider === p ? 600 : 400,
              cursor: "pointer", transition: "all 0.15s",
              textTransform: "capitalize",
            }}
          >{p}</button>
        ))}
      </div>

      {/* Plans grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20, marginBottom: 80, alignItems: "stretch" }}>
        {PLANS.map(({ id, name, tier, mo, yr, suffix, blurb, features, missing, cta, popular }) => {
          const price = billing === "annual" ? yr : mo;
          const isPro = popular;
          return (
            <div
              key={id}
              style={{
                position: "relative",
                background: isPro ? "var(--ink)" : "var(--card)",
                border: `1px solid ${isPro ? "transparent" : "var(--line)"}`,
                borderRadius: 20, padding: "32px 28px",
                display: "flex", flexDirection: "column",
                boxShadow: isPro ? "0 24px 60px -20px rgba(20,19,15,0.28)" : "none",
              }}
            >
              {/* Popular badge */}
              {popular && (
                <span style={{
                  position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)",
                  background: "var(--accent)", color: "#fff",
                  fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em",
                  textTransform: "uppercase", borderRadius: 999, padding: "5px 14px",
                  whiteSpace: "nowrap",
                }}>Most popular</span>
              )}

              {/* Name + blurb */}
              <p style={{ fontSize: 18, fontWeight: 700, color: isPro ? "var(--noir-text)" : "var(--ink)", marginBottom: 6 }}>{name}</p>
              <p style={{ fontSize: 13.5, color: isPro ? "var(--noir-muted)" : "var(--muted)", marginBottom: 28, lineHeight: 1.5 }}>{blurb}</p>

              {/* Price */}
              <div style={{ marginBottom: 28 }}>
                <span style={{ fontFamily: "var(--font-serif)", fontSize: 64, color: isPro ? "var(--noir-text)" : "var(--ink)", lineHeight: 1 }}>
                  {price === 0 ? "$0" : `$${price}`}
                </span>
                <span style={{ fontSize: 14, color: isPro ? "var(--noir-muted)" : "var(--muted)", marginLeft: 6 }}>{suffix}</span>
              </div>

              {/* CTA */}
              <button
                onClick={() => handleUpgrade(tier)}
                disabled={tier === "free" || loading === tier}
                style={{
                  width: "100%", padding: "14px", borderRadius: 999,
                  border: `1px solid ${tier === "free" ? (isPro ? "var(--noir-line)" : "var(--line)") : "transparent"}`,
                  background: tier === "free" ? "transparent" : isPro ? "var(--accent)" : "var(--ink)",
                  color: tier === "free" ? (isPro ? "var(--noir-muted)" : "var(--muted)") : "#fff",
                  fontSize: 15, fontWeight: 600, cursor: tier === "free" ? "default" : "pointer",
                  marginBottom: 28, transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                {loading === tier ? (
                  <span className="spin" style={{
                    width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "#fff", borderRadius: "50%", display: "inline-block",
                  }} />
                ) : cta}
              </button>

              {/* Feature list */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                {features.map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14 }}>
                    <Check size={14} color={isPro ? "var(--accent)" : "var(--accent)"} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ color: isPro ? "var(--noir-text)" : "var(--ink)" }}>{f}</span>
                  </div>
                ))}
                {missing.map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, opacity: 0.35 }}>
                    <span style={{ width: 14, textAlign: "center", color: isPro ? "var(--noir-muted)" : "var(--muted)", flexShrink: 0 }}>×</span>
                    <span style={{ color: isPro ? "var(--noir-muted)" : "var(--muted)" }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* FAQ */}
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ borderTop: "1px solid var(--ink)", paddingTop: 36, marginBottom: 36 }}>
          <h2 className="display" style={{ fontSize: "clamp(28px,4vw,46px)", color: "var(--ink)" }}>
            Questions, <em className="serif-i" style={{ color: "var(--accent)" }}>answered.</em>
          </h2>
        </div>
        {FAQS.map((faq, i) => (
          <FaqRow key={faq.q} q={faq.q} a={faq.a} defaultOpen={i === 0} />
        ))}
      </div>

      <p style={{ textAlign: "center", fontSize: 12, color: "var(--faint)", marginTop: 48 }}>
        Payments processed securely via {provider === "paystack" ? "Paystack" : "Flutterwave"}. Cancel anytime.
      </p>

      <style>{`
        @media (max-width: 768px) { .pricing-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
