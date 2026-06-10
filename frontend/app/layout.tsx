import type { Metadata } from "next";
import { Schibsted_Grotesk, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const schibstedGrotesk = Schibsted_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Flicko — AI Video Editor",
    template: "%s | Flicko",
  },
  description:
    "Upload your raw footage, describe what you want. Flicko makes the same creative editing decisions a skilled human editor would — choosing clips, pacing, transitions, sound, and captions based entirely on context.",
  keywords: ["AI video editor", "video editing", "short form video", "social media video", "AI editor"],
  openGraph: {
    title: "Flicko — AI Video Editor",
    description: "Upload your footage. Describe what you want. Get a real edit — the kind a human editor would make.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${schibstedGrotesk.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} h-full`}>
      <body className="min-h-full antialiased">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#fffefb",
              border: "1px solid #e2ddd0",
              color: "#14130f",
              borderRadius: "10px",
              fontFamily: "var(--font-sans)",
            },
          }}
        />
      </body>
    </html>
  );
}
