import type { Metadata } from "next";
import { LandingPageContent } from "@/components/landing/LandingPageContent";

export const metadata: Metadata = {
  title: "Flicko — Go viral in your own voice",
  description:
    "Upload your raw footage. Describe what you want. Flicko makes every creative editing decision a world-class editor would — then shows you exactly why.",
  keywords: ["AI video editor", "video editing", "short form video", "social media video", "AI editor"],
  openGraph: {
    title: "Flicko — Go viral in your own voice",
    description:
      "Upload your footage. Get back a finished, post-ready cut with a written rationale for every decision.",
    type: "website",
  },
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "Flicko",
            applicationCategory: "MultimediaApplication",
            operatingSystem: "Web",
            description:
              "AI video editor that makes every creative editing decision a world-class editor would — and explains exactly why.",
            offers: [
              { "@type": "Offer", price: "0", priceCurrency: "USD", name: "Free" },
              { "@type": "Offer", price: "10", priceCurrency: "USD", name: "Starter" },
              { "@type": "Offer", price: "15", priceCurrency: "USD", name: "Pro" },
            ],
          }),
        }}
      />
      <LandingPageContent />
    </>
  );
}
