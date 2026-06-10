import Link from "next/link";

interface LogoProps {
  variant?: "light" | "dark";
  href?: string;
  size?: "sm" | "md";
}

export default function Logo({ variant = "light", href = "/", size = "md" }: LogoProps) {
  const markSrc = variant === "dark" ? "/brand/flick-mark-white.svg" : "/brand/flick-mark-ink.svg";
  const textColor = variant === "dark" ? "var(--noir-text)" : "var(--ink)";
  const imgSize = size === "sm" ? 22 : 28;

  return (
    <Link href={href} style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={markSrc} alt="Flicko" width={imgSize} height={imgSize} style={{ display: "block" }} />
      <span style={{
        fontFamily: "var(--font-sans)", fontWeight: 800,
        fontSize: size === "sm" ? 15 : 17, letterSpacing: "-0.04em", color: textColor,
      }}>
        Flicko
      </span>
    </Link>
  );
}
