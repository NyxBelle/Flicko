import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Flicko collects, uses, and protects your data.",
};

const S = {
  page:    { maxWidth: 720, margin: "0 auto", padding: "64px clamp(20px, 5vw, 48px) 96px", color: "#14130f", fontFamily: "system-ui, sans-serif" } as React.CSSProperties,
  back:    { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: "#6c6657", textDecoration: "none", marginBottom: 48, fontWeight: 500 } as React.CSSProperties,
  eyebrow: { fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#1fb87a", marginBottom: 12 },
  h1:      { fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 800, letterSpacing: "-0.03em", color: "#14130f", margin: "0 0 12px" } as React.CSSProperties,
  meta:    { fontSize: 14, color: "#9a9484", marginBottom: 56 } as React.CSSProperties,
  h2:      { fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em", color: "#14130f", margin: "40px 0 12px" } as React.CSSProperties,
  p:       { fontSize: 16, color: "#2a2823", lineHeight: 1.7, margin: "0 0 16px" } as React.CSSProperties,
  ul:      { paddingLeft: 20, margin: "0 0 16px" } as React.CSSProperties,
  li:      { fontSize: 16, color: "#2a2823", lineHeight: 1.7, marginBottom: 8 } as React.CSSProperties,
  hr:      { border: "none", borderTop: "1px solid #e2ddd0", margin: "48px 0" } as React.CSSProperties,
};

export default function PrivacyPage() {
  return (
    <div style={S.page}>
      <Link href="/" style={S.back}>
        ← Flicko
      </Link>

      <div style={S.eyebrow}>Legal</div>
      <h1 style={S.h1}>Privacy Policy</h1>
      <p style={S.meta}>Last updated: June 2026</p>

      <p style={S.p}>
        Flicko ("we", "our", "us") operates flicko.app. This policy explains what data we collect,
        why we collect it, and how we protect it. If you have questions, email us at{" "}
        <a href="mailto:support@flicko.app" style={{ color: "#1fb87a" }}>support@flicko.app</a>.
      </p>

      <hr style={S.hr} />

      <h2 style={S.h2}>1. What we collect</h2>
      <p style={S.p}><strong>Account data:</strong> When you sign up, we collect your email address and the name you provide.</p>
      <p style={S.p}><strong>Video footage (temporary):</strong> When you submit a project, your footage is uploaded to secure, private storage for processing only. It is deleted as soon as your edit is complete. We never use your footage to train models or share it with any third party.</p>
      <p style={S.p}><strong>Voice samples (Pro only, temporary):</strong> If you use voice cloning, you upload a short audio sample. This is used solely to generate your personal voice model. The raw sample is deleted after model creation.</p>
      <p style={S.p}><strong>Usage data:</strong> We collect anonymised logs of feature usage (e.g. which platform you edited for, edit counts) to improve the product. This is never tied to your specific footage.</p>
      <p style={S.p}><strong>Payment data:</strong> We do not store card or bank details. Payments are handled directly by Paystack or Flutterwave. We receive only a transaction reference and your subscription status.</p>

      <h2 style={S.h2}>2. How we use your data</h2>
      <ul style={S.ul}>
        <li style={S.li}>To provide and improve the Flicko editing service</li>
        <li style={S.li}>To process payments and manage your subscription</li>
        <li style={S.li}>To send you transactional emails (edit ready, payment confirmed)</li>
        <li style={S.li}>To diagnose errors and improve reliability</li>
      </ul>
      <p style={S.p}>We do not sell your data, run advertising, or use your content for any purpose beyond what you explicitly requested.</p>

      <h2 style={S.h2}>3. Your footage</h2>
      <p style={S.p}>
        This bears repeating: <strong>your footage is deleted after processing.</strong> It is never retained,
        never indexed, never used for machine learning, and never viewed by any person at Flicko unless you
        contact support and explicitly share it to diagnose a problem.
      </p>

      <h2 style={S.h2}>4. Data sharing</h2>
      <p style={S.p}>We use the following services to operate Flicko:</p>
      <ul style={S.ul}>
        <li style={S.li}><strong>Supabase</strong> — database and file storage (EU-West, AWS)</li>
        <li style={S.li}><strong>Railway</strong> — server infrastructure</li>
        <li style={S.li}><strong>Paystack / Flutterwave</strong> — payment processing</li>
        <li style={S.li}><strong>AI processing services</strong> — for generating edit decisions and transcriptions. No personally identifiable data is included in these requests.</li>
      </ul>
      <p style={S.p}>Each provider processes only the minimum data necessary and is bound by their own privacy obligations.</p>

      <h2 style={S.h2}>5. Data retention</h2>
      <ul style={S.ul}>
        <li style={S.li}>Video footage: deleted immediately after your edit is complete</li>
        <li style={S.li}>Voice samples: deleted after your voice model is created</li>
        <li style={S.li}>Account data: retained while your account is active</li>
        <li style={S.li}>On account deletion: all your data, projects, and voice models are permanently removed within 30 days</li>
      </ul>

      <h2 style={S.h2}>6. Your rights</h2>
      <p style={S.p}>You can access, export, or delete your account data at any time from Settings. To request complete deletion or if you have any concern about your data, email <a href="mailto:support@flicko.app" style={{ color: "#1fb87a" }}>support@flicko.app</a> and we will respond within 72 hours.</p>

      <h2 style={S.h2}>7. Cookies</h2>
      <p style={S.p}>We use only essential session cookies required for authentication. We do not use tracking cookies, analytics cookies, or any third-party advertising cookies.</p>

      <h2 style={S.h2}>8. Children</h2>
      <p style={S.p}>Flicko is not directed at children under 16. We do not knowingly collect data from anyone under 16.</p>

      <h2 style={S.h2}>9. Changes to this policy</h2>
      <p style={S.p}>If we make material changes, we will notify you by email. The "Last updated" date at the top of this page will always reflect the current version.</p>

      <h2 style={S.h2}>10. Contact</h2>
      <p style={S.p}>
        Questions or requests: <a href="mailto:support@flicko.app" style={{ color: "#1fb87a" }}>support@flicko.app</a>
      </p>

      <hr style={S.hr} />

      <p style={{ fontSize: 13, color: "#9a9484" }}>
        <Link href="/terms" style={{ color: "#6c6657" }}>Terms of Service</Link>
        {" · "}
        <Link href="/" style={{ color: "#6c6657" }}>Back to Flicko</Link>
      </p>
    </div>
  );
}
