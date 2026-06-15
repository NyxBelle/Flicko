import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Flicko — Go viral in your own voice";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#100f0c",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px 96px",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Accent bar */}
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: 4,
          background: "#1fb87a",
        }} />

        {/* Wordmark */}
        <div style={{
          fontSize: 28,
          fontWeight: 800,
          color: "#1fb87a",
          letterSpacing: "-0.03em",
          marginBottom: 48,
        }}>
          Flicko
        </div>

        {/* Headline */}
        <div style={{
          fontSize: 72,
          fontWeight: 800,
          color: "#f3f0e7",
          letterSpacing: "-0.04em",
          lineHeight: 1.05,
          maxWidth: 900,
          marginBottom: 28,
        }}>
          Go viral in your own voice.
        </div>

        {/* Subline */}
        <div style={{
          fontSize: 24,
          color: "#97917f",
          lineHeight: 1.5,
          maxWidth: 700,
          marginBottom: 56,
        }}>
          Upload your footage. Describe your goal. Get a real edit with a written rationale for every decision.
        </div>

        {/* CTA chip */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "#1fb87a",
          color: "#fff",
          fontSize: 18,
          fontWeight: 700,
          padding: "14px 28px",
          borderRadius: 999,
        }}>
          Start free · 2 edits included
        </div>
      </div>
    ),
    { ...size },
  );
}
