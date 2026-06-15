import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of Flicko.",
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

export default function TermsPage() {
  return (
    <div style={S.page}>
      <Link href="/" style={S.back}>
        ← Flicko
      </Link>

      <div style={S.eyebrow}>Legal</div>
      <h1 style={S.h1}>Terms of Service</h1>
      <p style={S.meta}>Last updated: June 2026</p>

      <p style={S.p}>
        By creating an account or using Flicko, you agree to these terms. If you do not agree, do not use the service.
        Questions? Email <a href="mailto:support@flicko.app" style={{ color: "#1fb87a" }}>support@flicko.app</a>.
      </p>

      <hr style={S.hr} />

      <h2 style={S.h2}>1. The service</h2>
      <p style={S.p}>
        Flicko is an AI-assisted video editing service. You upload footage, describe your goal, and Flicko
        produces an edited video with a written rationale for its creative decisions.
        Flicko is provided "as is." Edit quality varies based on footage quality, clip length, and goal clarity.
        We do not guarantee any specific outcome, viral performance, or platform approval.
      </p>

      <h2 style={S.h2}>2. Your account</h2>
      <ul style={S.ul}>
        <li style={S.li}>You must be at least 18 years old to create an account.</li>
        <li style={S.li}>You are responsible for keeping your credentials secure.</li>
        <li style={S.li}>You may not share, sell, or transfer your account to another person.</li>
        <li style={S.li}>One account per person. We reserve the right to suspend accounts that appear to be operated by the same person under multiple registrations.</li>
      </ul>

      <h2 style={S.h2}>3. Acceptable use</h2>
      <p style={S.p}>You may only upload footage that you own or have explicit rights to use. You agree not to use Flicko to:</p>
      <ul style={S.ul}>
        <li style={S.li}>Edit footage containing illegal content of any kind</li>
        <li style={S.li}>Produce content that infringes on another person's copyright, trademark, or right of publicity</li>
        <li style={S.li}>Create or distribute deepfakes, non-consensual intimate imagery, or defamatory content</li>
        <li style={S.li}>Circumvent any technical limits of the service (e.g. edit quotas)</li>
        <li style={S.li}>Use automated scripts or bots to interact with the service</li>
      </ul>
      <p style={S.p}>We may suspend or terminate accounts that violate these rules without prior notice.</p>

      <h2 style={S.h2}>4. Voice cloning</h2>
      <p style={S.p}>
        By uploading a voice sample, you confirm that it is your own voice and that you consent to Flicko
        creating a voice model from it. You may not upload another person's voice without their explicit written consent.
        Your voice model is tied to your account and deleted when your account is deleted.
      </p>

      <h2 style={S.h2}>5. Payments and billing</h2>
      <ul style={S.ul}>
        <li style={S.li}>Free plan users receive 2 lifetime edits at no cost. No card required.</li>
        <li style={S.li}>Paid plans are billed monthly or annually, as selected at checkout.</li>
        <li style={S.li}>Payments are processed by Paystack or Flutterwave. By subscribing you also agree to their terms.</li>
        <li style={S.li}>Unused edits in a billing period do not roll over.</li>
        <li style={S.li}>We reserve the right to change pricing. Existing subscribers will be notified at least 30 days before any price change takes effect.</li>
      </ul>

      <h2 style={S.h2}>6. Cancellation and refunds</h2>
      <p style={S.p}>
        You can cancel your subscription at any time from Settings. Cancellation takes effect at the end
        of your current billing period. You retain access to paid features until that date.
      </p>
      <p style={S.p}>
        Refunds are handled on a case-by-case basis. If a technical failure on our end prevents you from using
        edits you paid for, contact <a href="mailto:support@flicko.app" style={{ color: "#1fb87a" }}>support@flicko.app</a> within 14 days and we will make it right.
      </p>

      <h2 style={S.h2}>7. Intellectual property</h2>
      <p style={S.p}>
        You own all footage you upload and all output videos Flicko produces from your footage.
        Flicko does not claim any rights over your content.
      </p>
      <p style={S.p}>
        Flicko owns the service, the software, the interface, and the underlying systems.
        You may not copy, reverse-engineer, resell, or create derivative works from any part of the Flicko service.
      </p>

      <h2 style={S.h2}>8. Disclaimer and limitations</h2>
      <p style={S.p}>
        THE SERVICE IS PROVIDED WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, FLICKO IS NOT LIABLE FOR ANY INDIRECT,
        INCIDENTAL, OR CONSEQUENTIAL DAMAGES ARISING FROM YOUR USE OF THE SERVICE,
        INCLUDING LOSS OF REVENUE, LOST PROFITS, OR DAMAGE TO YOUR REPUTATION.
        OUR TOTAL LIABILITY TO YOU IN ANY TWELVE-MONTH PERIOD WILL NOT EXCEED THE AMOUNT
        YOU PAID TO US IN THAT PERIOD.
      </p>

      <h2 style={S.h2}>9. Termination</h2>
      <p style={S.p}>
        You can delete your account at any time from Settings. We may terminate or suspend your account if you
        violate these terms. On termination, your data is deleted in accordance with our{" "}
        <Link href="/privacy" style={{ color: "#1fb87a" }}>Privacy Policy</Link>.
      </p>

      <h2 style={S.h2}>10. Changes to these terms</h2>
      <p style={S.p}>
        We may update these terms from time to time. If we make material changes, we will notify you by email
        at least 14 days before they take effect. Continued use of the service after that date constitutes
        acceptance of the updated terms.
      </p>

      <h2 style={S.h2}>11. Governing law</h2>
      <p style={S.p}>
        These terms are governed by the laws of the Federal Republic of Nigeria.
        Any disputes will be resolved through good-faith negotiation first;
        if unresolved, through binding arbitration in Lagos, Nigeria.
      </p>

      <h2 style={S.h2}>12. Contact</h2>
      <p style={S.p}>
        For any questions about these terms:{" "}
        <a href="mailto:support@flicko.app" style={{ color: "#1fb87a" }}>support@flicko.app</a>
      </p>

      <hr style={S.hr} />

      <p style={{ fontSize: 13, color: "#9a9484" }}>
        <Link href="/privacy" style={{ color: "#6c6657" }}>Privacy Policy</Link>
        {" · "}
        <Link href="/" style={{ color: "#6c6657" }}>Back to Flicko</Link>
      </p>
    </div>
  );
}
