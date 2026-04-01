"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Project } from "@/lib/types";
import Link from "next/link";

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/projects/")
      .then(res => setProjects(res.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-black text-white p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">My Projects</h1>
        <Link
          href="/project/new"
          className="bg-violet-600 hover:bg-violet-500 px-6 py-2 rounded-lg font-semibold transition"
        >
          + New Project
        </Link>
      </div>

      {loading ? (
        <p className="text-zinc-500">Loading...</p>
      ) : projects.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">🎬</p>
          <p className="text-zinc-400 mb-6">No projects yet. Create your first one!</p>
          <Link
            href="/project/new"
            className="bg-violet-600 hover:bg-violet-500 px-8 py-3 rounded-lg font-semibold transition"
          >
            Create Project
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map(p => (
            <Link
              key={p.id}
              href={`/project/${p.id}`}
              className="bg-zinc-900 hover:bg-zinc-800 rounded-xl p-5 flex justify-between items-center transition"
            >
              <div>
                <h2 className="font-semibold text-lg">{p.name}</h2>
                <p className="text-zinc-500 text-sm mt-1">{p.style} · {p.target_duration}s · {p.status}</p>
              </div>
              <span className="text-zinc-600">→</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
