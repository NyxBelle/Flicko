"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/login", { email, password });
      localStorage.setItem("flicko_token", res.data.access_token);
      router.push("/dashboard");
    } catch {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold mb-8 text-center">Log in to Flicko</h1>

        {error && <p className="text-red-400 text-sm mb-4 text-center">{error}</p>}

        <div className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full bg-zinc-900 rounded-lg px-4 py-3 outline-none focus:ring-2 ring-violet-500"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full bg-zinc-900 rounded-lg px-4 py-3 outline-none focus:ring-2 ring-violet-500"
          />
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg py-3 font-semibold transition"
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </div>

        <p className="text-center text-zinc-500 text-sm mt-6">
          Don't have an account?{" "}
          <Link href="/auth/signup" className="text-violet-400 hover:text-violet-300">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}