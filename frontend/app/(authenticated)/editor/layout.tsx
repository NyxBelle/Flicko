import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Edit",
  description:
    "Upload your footage, describe your content and goal. Flicko's AI makes the creative editing decisions — clips, pacing, audio, captions — and delivers a finished video.",
};

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
