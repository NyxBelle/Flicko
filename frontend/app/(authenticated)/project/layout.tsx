import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Project",
  description: "View your Flicko edit — the AI's creative decisions, the final video, and your download.",
};

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  return children;
}
