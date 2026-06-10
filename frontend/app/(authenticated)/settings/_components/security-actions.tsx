"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function PasswordResetButton({ email }: { email: string }) {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/settings`,
      });
      if (error) throw error;
      setSent(true);
      toast.success("Password reset email sent");
    } catch {
      toast.error("Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleReset}
      disabled={loading || sent}
      style={{
        fontSize: 13.5, fontWeight: 600, color: "var(--ink)",
        border: "1px solid var(--line-2)", background: "var(--card)",
        padding: "8px 16px", borderRadius: 999, cursor: loading || sent ? "default" : "pointer",
        opacity: loading || sent ? 0.6 : 1, transition: "all 0.15s", whiteSpace: "nowrap",
      }}
    >
      {sent ? "Email sent" : loading ? "Sending…" : "Send reset email"}
    </button>
  );
}

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <button
      onClick={handleSignOut}
      disabled={loading}
      style={{
        display: "block", width: "100%", textAlign: "left",
        padding: "10px 14px", borderRadius: 10, border: "none",
        fontSize: 14, color: "var(--muted)", background: "transparent",
        cursor: "pointer", transition: "color 0.15s, background 0.15s",
        opacity: loading ? 0.6 : 1,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--paper-2)"; (e.currentTarget as HTMLElement).style.color = "var(--ink)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; (e.currentTarget as HTMLElement).style.color = ""; }}
    >
      {loading ? "Signing out…" : "Log out"}
    </button>
  );
}

export function DeleteAccountButton() {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/account/delete", { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.push("/");
    } catch {
      toast.error("Failed to delete account. Contact support.");
      setLoading(false);
      setConfirming(false);
    }
  };

  if (confirming) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>Are you sure? This cannot be undone.</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          style={{
            fontSize: 13.5, fontWeight: 600, color: "#fff", background: "#c0392b",
            border: "none", padding: "8px 16px", borderRadius: 999,
            cursor: "pointer", opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Deleting…" : "Yes, delete"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          style={{ fontSize: 13.5, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", padding: "8px" }}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="btn btn-ghost btn-sm"
      style={{ borderColor: "#f5c6c6", color: "#c0392b" }}
    >
      Delete account
    </button>
  );
}
