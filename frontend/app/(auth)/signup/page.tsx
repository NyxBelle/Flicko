"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight } from "lucide-react";
import Logo from "@/components/shared/Logo";

function Field({ label, type, value, onChange, placeholder }: {
  label: string; type: string; value: string;
  onChange: (v: string) => void; placeholder: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label style={{
        display: "block", fontFamily: "var(--font-mono)", fontSize: 11,
        letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--muted)",
        fontWeight: 500, marginBottom: 7,
      }}>{label}</label>
      <input
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        style={{
          width: "100%", background: "var(--card)",
          border: `1px solid ${focused ? "var(--ink)" : "var(--line-2)"}`,
          borderRadius: 10, padding: "13px 16px", fontSize: 14,
          color: "var(--ink)", outline: "none",
          transition: "border-color 0.15s",
          fontFamily: "var(--font-sans)",
        }}
      />
    </div>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Please enter your name"); return; }
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
      },
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    toast.success("Account created! Signing you in…");
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (!loginError) {
      router.push("/dashboard");
      router.refresh();
    } else {
      router.push("/login");
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* ── Left: form ────────────────────────────────────── */}
      <div style={{
        flex: 1, background: "var(--paper)", display: "flex", flexDirection: "column",
        padding: "36px clamp(28px, 6vw, 72px)", position: "relative",
      }}>
        <Logo href="/" />

        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          justifyContent: "center", maxWidth: 400, width: "100%", margin: "0 auto",
        }}>
          <p className="eyebrow" style={{ marginBottom: 14 }}>Create your account</p>
          <h1 className="display" style={{ fontSize: "clamp(32px,5vw,48px)", color: "var(--ink)", marginBottom: 32 }}>
            Your first two edits{" "}
            <em className="serif-i" style={{ color: "var(--accent)" }}>on the house.</em>
          </h1>

          <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Your name" type="text" value={name} onChange={setName} placeholder="e.g. Amara Okafor" />
            <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
            <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="Min 8 characters" />

            <button
              type="submit"
              disabled={loading}
              className="btn btn-accent"
              style={{ marginTop: 6, width: "100%", justifyContent: "center", opacity: loading ? 0.65 : 1 }}
            >
              {loading ? "Creating account…" : <>Create account <ArrowRight size={15} /></>}
            </button>
          </form>

          <p style={{ textAlign: "center", marginTop: 24, fontSize: 14, color: "var(--muted)" }}>
            Already have an account?{" "}
            <Link href="/login" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>
              Log in
            </Link>
          </p>
        </div>

        <Link href="/" style={{
          position: "absolute", bottom: 28, left: "clamp(28px,6vw,72px)",
          fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.14em",
          textTransform: "uppercase", color: "var(--faint)", textDecoration: "none",
          transition: "color 0.15s",
        }}>
          ← Back to Flicko.com
        </Link>
      </div>

      {/* ── Right: brand panel ───────────────────────────── */}
      <div
        className="auth-brand-panel"
        style={{
          flex: "0 0 44%", background: "var(--noir)", position: "relative",
          display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: "48px 52px", overflow: "hidden",
        }}
      >
        <div className="grain" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <span className="chip" style={{ background: "var(--noir-2)", borderColor: "var(--noir-line)", color: "var(--noir-muted)" }}>
            <span className="dot live-dot" />
            12,400 edits shipped this week
          </span>
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>
          <p style={{
            fontFamily: "var(--font-serif)", fontSize: "clamp(22px,2.8vw,34px)",
            color: "var(--noir-text)", lineHeight: 1.18, letterSpacing: "-0.01em", marginBottom: 28,
          }}>
            &ldquo;Flicko cut my footage in a way I{" "}
            <em style={{ color: "var(--accent)" }}>would have</em>{" "}
            been proud to deliver to a client.&rdquo;
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%",
              background: "var(--noir-2)", border: "1px solid var(--noir-line)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--noir-muted)",
            }}>TZ</div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--noir-text)" }}>Tobi Z.</p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--noir-muted)" }}>
                480K Followers · Food Creator
              </p>
            </div>
          </div>
        </div>

        <div style={{
          position: "relative", zIndex: 1,
          display: "flex", gap: 32, borderTop: "1px solid var(--noir-line)", paddingTop: 28,
        }}>
          {[["2.4M", "total views"], ["18 min", "footage to post"], ["4.9★", "avg rating"]].map(([val, label]) => (
            <div key={label}>
              <p style={{ fontFamily: "var(--font-serif)", fontSize: 26, color: "var(--noir-text)", lineHeight: 1 }}>{val}</p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--noir-muted)", marginTop: 5 }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) { .auth-brand-panel { display: none !important; } }
      `}</style>
    </div>
  );
}
