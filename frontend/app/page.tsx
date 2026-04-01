import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8">
      <div className="text-center max-w-2xl">
        <h1 className="text-6xl font-bold mb-4">🎬 Flicko</h1>
        <p className="text-xl text-zinc-400 mb-8">
          Upload your clips, describe your event, get a finished video ready to post.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/auth/signup"
            className="bg-violet-600 hover:bg-violet-500 rounded-xl px-8 py-3 font-semibold transition"
          >
            Get Started
          </Link>
          <Link
            href="/auth/login"
            className="border border-zinc-600 hover:border-zinc-400 rounded-xl px-8 py-3 font-semibold transition"
          >
            Log In
          </Link>
        </div>
      </div>
    </main>
  );
}