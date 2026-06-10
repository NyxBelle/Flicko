"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { LayoutGrid, Sparkles, Settings, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types";
import Logo from "@/components/shared/Logo";

interface AppNavProps {
  profile: Profile | null;
}

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/editor",    label: "Editor",    icon: Sparkles  },
  { href: "/settings",  label: "Settings",  icon: Settings  },
];


export default function AppNav({ profile }: AppNavProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const tier = profile?.tier ?? "free";
  const initials = (profile?.full_name ?? profile?.email ?? "?")
    .split(/[\s@]/).slice(0, 2)
    .map((s: string) => s[0]?.toUpperCase() ?? "").join("") || "?";

  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 50, height: 64,
      background: "rgba(247,245,239,0.82)",
      backdropFilter: "saturate(140%) blur(14px)",
      WebkitBackdropFilter: "saturate(140%) blur(14px)",
      borderBottom: "1px solid var(--line)",
      display: "flex", alignItems: "center",
    }}>
      <div style={{
        maxWidth: "var(--maxw)", width: "100%",
        margin: "0 auto", padding: "0 var(--gutter)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
      }}>
        {/* Left: Logo + pill nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Logo href="/dashboard" />
          {/* Pill nav */}
          <div style={{
            display: "flex", alignItems: "center", gap: 2,
            background: "var(--paper-2)", border: "1px solid var(--line)",
            borderRadius: 999, padding: "3px 4px",
          }}>
            {NAV_LINKS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "6px 13px",
                    borderRadius: 999,
                    fontSize: 13.5,
                    fontWeight: active ? 600 : 400,
                    color: active ? "var(--ink)" : "var(--muted)",
                    background: active ? "var(--card)" : "transparent",
                    border: active ? "1px solid var(--line)" : "1px solid transparent",
                    textDecoration: "none",
                    transition: "color 0.15s, background 0.15s",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Icon size={13} />
                  <span className="l-nav-label">{label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right: plan chip + avatar */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Plan chip */}
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em",
            textTransform: "uppercase", color: "var(--muted)",
            border: "1px solid var(--line-2)", borderRadius: 999,
            padding: "5px 10px", background: "var(--card)",
          }}>
            <span className="live-dot" style={{
              width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", flexShrink: 0,
            }} />
            {tier} plan
          </span>

          {/* Avatar → settings */}
          <Link
            href="/settings"
            style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "var(--ink)", color: "var(--paper)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 500,
              textDecoration: "none", flexShrink: 0,
              letterSpacing: "0.04em",
            }}
          >
            {initials}
          </Link>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            title="Sign out"
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--faint)", padding: 6, borderRadius: 8,
              display: "flex", alignItems: "center",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--faint)")}
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) { .l-nav-label { display: none; } }
      `}</style>
    </nav>
  );
}
