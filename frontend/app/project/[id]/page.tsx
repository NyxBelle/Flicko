"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { JobStatus } from "@/lib/types";

export default function ProjectPage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("job");
  const [job, setJob] = useState<JobStatus | null>(null);

  useEffect(() => {
    if (!jobId) return;

    const poll = async () => {
      const res = await api.get(`/jobs/${jobId}`);
      setJob(res.data);
    };

    poll();
    const interval = setInterval(poll, 3000);

    return () => clearInterval(interval);
  }, [jobId]);

  useEffect(() => {
    if (job?.status === "done" || job?.status === "failed") {
      return;
    }
  }, [job?.status]);

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8">
      {!job || job.status === "pending" ? (
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">⏳</div>
          <h2 className="text-xl font-semibold">Getting things ready...</h2>
        </div>

      ) : job.status === "processing" ? (
        <div className="w-full max-w-md text-center">
          <div className="text-5xl mb-6">🎬</div>
          <h2 className="text-2xl font-bold mb-2">Flicko is editing your video</h2>
          <p className="text-zinc-400 mb-6">{job.message}</p>
          <div className="w-full bg-zinc-800 rounded-full h-3 mb-2">
            <div
              className="bg-violet-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${job.progress}%` }}
            />
          </div>
          <p className="text-zinc-500 text-sm">{job.progress}%</p>
          <p className="text-zinc-600 text-xs mt-8">This usually takes 2–5 minutes</p>
        </div>

      ) : job.status === "done" ? (
        <div className="text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-3xl font-bold mb-2">Your video is ready!</h2>
          <p className="text-zinc-400 mb-8">Download it and post directly to your socials.</p>
          <a
            href={job.result_url}
            download
            className="inline-block bg-violet-600 hover:bg-violet-500 rounded-xl px-10 py-4 font-bold text-lg transition"
          >
            ⬇️ Download Video
          </a>
          <div className="mt-4">
            <Link href="/dashboard" className="text-zinc-500 hover:text-white text-sm transition">
              Back to dashboard
            </Link>
          </div>
        </div>

      ) : (
        <div className="text-center">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
          <p className="text-zinc-400 mb-6">{job.message}</p>
          <Link href="/dashboard" className="text-violet-400 hover:text-violet-300 transition">
            Go back to dashboard
          </Link>
        </div>
      )}
    </main>
  );
}