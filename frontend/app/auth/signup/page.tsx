"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.post("/auth/register", { email, password });
      localStorage.setItem("flicko_token", res.data.access_token);
      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Try a different email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold mb-8 text-center">Create your Flicko account</h1>

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
            onClick={handleSignup}
            disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg py-3 font-semibold transition"
          >
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </div>

        <p className="text-center text-zinc-500 text-sm mt-6">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-violet-400 hover:text-violet-300">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}