import { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/supabase/auth";
import { getCurrentPeriod } from "@/lib/utils";
import { TIER_LIMITS } from "@/types";
import type { Profile, Subscription, UsageCounter } from "@/types";
import { PasswordResetButton, SignOutButton, DeleteAccountButton } from "./_components/security-actions";
import { ProfileEditForm } from "./_components/profile-edit-form";

export const metadata: Metadata = { title: "Settings" };

const TIER_PRICES: Record<string, string> = {
  free: "Free",
  starter: "$10 / month",
  pro: "$15 / month",
};

function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--card)", border: "1px solid var(--line)",
      borderRadius: 16, padding: "28px 30px",
    }}>
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.01em" }}>{title}</p>
        {desc && <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 3 }}>{desc}</p>}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "11px 0", borderBottom: "1px solid var(--line)",
    }}>
      <span style={{ fontSize: 13, color: "var(--muted)" }}>{label}</span>
      <span style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

export default async function SettingsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: profileRaw }, { data: subRaw }, { data: usageRaw }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("subscriptions").select("*")
      .eq("user_id", user.id).eq("status", "active")
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase
      .from("usage_counters").select("*")
      .eq("user_id", user.id).eq("period", getCurrentPeriod()).maybeSingle(),
  ]);

  const profile = profileRaw as Profile | null;
  const sub = subRaw as Subscription | null;
  const usage = usageRaw as UsageCounter | null;

  const tier = profile?.tier ?? "free";
  const limits = TIER_LIMITS[tier];
  const editsUsed = usage?.edits_used ?? 0;
  const editsLimit = limits.edits;
  const usagePct = Math.min(100, Math.round((editsUsed / editsLimit) * 100));

  const initials = (profile?.full_name ?? user.email ?? "?")
    .split(/[\s@]/).slice(0, 2)
    .map((s: string) => s[0]?.toUpperCase() ?? "").join("") || "?";

  const renewalDate = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null;

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "44px var(--gutter)" }}>
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <p className="eyebrow" style={{ marginBottom: 10 }}>Account</p>
        <h1 className="display" style={{ fontSize: "clamp(30px,4vw,46px)", color: "var(--ink)" }}>
          Make Flicko <em className="serif-i" style={{ color: "var(--accent)" }}>yours.</em>
        </h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "210px 1fr", gap: 32, alignItems: "start" }}>

        {/* ── Left nav ── */}
        <nav style={{ position: "sticky", top: 88 }}>
          {[
            { label: "Profile", href: "#profile" },
            { label: "Plan & billing", href: "#billing" },
            { label: "Usage", href: "#usage" },
            { label: "Security", href: "#security" },
          ].map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="settings-nav-link"
              style={{
                display: "block", padding: "10px 14px", borderRadius: 10,
                fontSize: 14, color: "var(--muted)", textDecoration: "none",
                marginBottom: 2, transition: "color 0.15s, background 0.15s",
              }}
            >{label}</a>
          ))}
          <div style={{ height: 1, background: "var(--line)", margin: "12px 0" }} />
          <SignOutButton />
        </nav>

        {/* ── Content pane ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Profile */}
          <div id="profile">
            <Card title="Profile">
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: "var(--ink)", color: "var(--paper)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 500, letterSpacing: "0.04em",
                }}>{initials}</div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>
                    {profile?.full_name ?? <span style={{ color: "var(--faint)", fontStyle: "italic" }}>No name set</span>}
                  </p>
                  <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{user.email}</p>
                </div>
              </div>
              <Row label="Email" value={user.email} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", borderBottom: "1px solid var(--line)" }}>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>Display name</span>
                <div style={{ minWidth: 220 }}>
                  <ProfileEditForm initialName={profile?.full_name ?? ""} userId={user.id} />
                </div>
              </div>
              {memberSince && <Row label="Member since" value={memberSince} />}
            </Card>
          </div>

          {/* Plan & billing */}
          <div id="billing">
            <Card title="Plan & billing">
              <div>
                {/* Current plan hero */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "16px 20px", borderRadius: 12,
                  background: tier === "pro" ? "var(--ink)" : "var(--paper-2)",
                  border: "1px solid var(--line)", marginBottom: 16,
                }}>
                  <div>
                    <p style={{ fontFamily: "var(--font-serif)", fontSize: 32, color: tier === "pro" ? "var(--noir-text)" : "var(--ink)", lineHeight: 1 }}>
                      {tier.charAt(0).toUpperCase() + tier.slice(1)}
                    </p>
                    {tier === "pro" && (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5, marginTop: 6,
                        fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em",
                        textTransform: "uppercase", color: "var(--accent)",
                        border: "1px solid var(--accent)", borderRadius: 999, padding: "3px 10px",
                      }}>Voice cloning</span>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: tier === "pro" ? "var(--noir-text)" : "var(--ink)" }}>{TIER_PRICES[tier]}</p>
                    {renewalDate && <p style={{ fontSize: 12, color: tier === "pro" ? "var(--noir-muted)" : "var(--muted)", marginTop: 2 }}>Renews {renewalDate}</p>}
                  </div>
                </div>

                {sub?.provider && <Row label="Payment provider" value={<span style={{ textTransform: "capitalize" }}>{sub.provider}</span>} />}
                {sub?.status && (
                  <Row label="Status" value={
                    <span style={{ color: sub.status === "active" ? "#22a06b" : sub.status === "past_due" ? "#c07d10" : "var(--muted)" }}>
                      {sub.status === "past_due" ? "Past due" : sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                    </span>
                  } />
                )}

                {tier !== "pro" && (
                  <Link href="/pricing" className="btn btn-accent btn-sm" style={{ marginTop: 16, display: "inline-flex" }}>
                    Upgrade plan →
                  </Link>
                )}
              </div>
            </Card>
          </div>

          {/* Usage */}
          <div id="usage">
            <Card title="Usage" desc={limits.period === "lifetime" ? "Lifetime edits" : "Resets on the 1st of each month"}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>{editsUsed} / {editsLimit} edits used</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)" }}>
                    {tier} plan
                  </span>
                </div>
                <div style={{ height: 6, background: "var(--paper-2)", borderRadius: 999, overflow: "hidden", marginBottom: 16 }}>
                  <div style={{
                    height: "100%", borderRadius: 999, transition: "width 0.4s",
                    width: `${usagePct}%`,
                    background: usagePct >= 90 ? "#c0392b" : usagePct >= 70 ? "#c07d10" : "var(--accent)",
                  }} />
                </div>
                <Row label="Voice cloning" value={
                  limits.voiceClone
                    ? <span style={{ color: "#22a06b", fontWeight: 600 }}>Included</span>
                    : <span style={{ color: "var(--faint)" }}>Pro only</span>
                } />
                {usagePct >= 90 && tier !== "pro" && (
                  <p style={{ fontSize: 12.5, color: "#c07d10", marginTop: 12 }}>
                    Running low.{" "}
                    <Link href="/pricing" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>
                      Upgrade for more edits
                    </Link>
                  </p>
                )}
              </div>
            </Card>
          </div>

          {/* Security */}
          <div id="security">
            <Card title="Security">
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>Password</p>
                    <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
                      We&apos;ll send a reset link to {user.email}
                    </p>
                  </div>
                  <PasswordResetButton email={user.email!} />
                </div>

                <div style={{ height: 1, background: "var(--line)" }} />

                {/* Danger */}
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#c0392b", marginBottom: 6 }}>Delete account</p>
                  <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14 }}>
                    Permanent and cannot be undone. All projects and data will be lost.
                  </p>
                  <DeleteAccountButton />
                </div>
              </div>
            </Card>
          </div>

        </div>
      </div>

      <style>{`
        .settings-nav-link:hover { background: var(--paper-2); color: var(--ink) !important; }
        @media (max-width: 900px) {
          .settings-layout { grid-template-columns: 1fr !important; }
          .settings-nav { position: static !important; display: flex !important; gap: 6px !important; overflow-x: auto; }
        }
      `}</style>
    </div>
  );
}
