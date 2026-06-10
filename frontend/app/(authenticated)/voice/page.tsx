import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/supabase/auth";
import type { Profile, VoiceClone } from "@/types";
import Link from "next/link";
import { Mic, CheckCircle, ChevronRight, Lock } from "lucide-react";

export const metadata: Metadata = { title: "Voice Clone" };

export default async function VoicePage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: profile }, { data: voiceClone }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("voice_clones")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .maybeSingle(),
  ]);

  const p = profile as Profile | null;
  const isPro = p?.tier === "pro";
  const vc = voiceClone as VoiceClone | null;

  if (!isPro) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-2xl font-semibold text-[#F0EEE9] mb-8">Voice Clone</h1>
        <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-10 text-center">
          <div className="w-14 h-14 rounded-xl bg-[#1A1A1A] border border-[#1F1F1F] flex items-center justify-center mx-auto mb-4">
            <Lock size={24} className="text-[#4A4846]" />
          </div>
          <h3 className="font-semibold text-[#F0EEE9] mb-2">Pro feature</h3>
          <p className="text-sm text-[#8A8785] max-w-sm mx-auto mb-6">
            Upload a 30-second voice sample and Flicko will narrate your edits in your own voice — ElevenLabs-powered, perfectly synced.
          </p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 bg-[#2563EB] hover:bg-[#3B82F6] text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            Upgrade to Pro
            <ChevronRight size={15} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-semibold text-[#F0EEE9] mb-2">Voice Clone</h1>
      <p className="text-sm text-[#8A8785] mb-8">
        Your cloned voice is used when Flicko&apos;s AI determines voiceover best serves your content.
      </p>

      {vc && vc.status === "ready" ? (
        <div className="bg-[#141414] border border-[#1F1F1F] rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-[#1C2A1C] border border-[#22C55E]/20 flex items-center justify-center">
              <Mic size={18} className="text-[#22C55E]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-[#F0EEE9]">Voice clone ready</p>
                <CheckCircle size={14} className="text-[#22C55E]" />
              </div>
              <p className="text-xs text-[#8A8785]">Powered by ElevenLabs</p>
            </div>
          </div>
          <VoiceUploadForm userId={user.id} />
        </div>
      ) : vc && vc.status === "processing" ? (
        <div className="bg-[#141414] border border-[#1F1F1F] rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#1A1E35] border border-[#2563EB]/20 flex items-center justify-center">
              <Mic size={18} className="text-[#60A5FA]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#F0EEE9]">Processing your voice sample...</p>
              <p className="text-xs text-[#8A8785]">Usually takes 2–3 minutes</p>
            </div>
          </div>
        </div>
      ) : (
        <VoiceUploadForm userId={user.id} />
      )}
    </div>
  );
}

function VoiceUploadForm({ userId }: { userId: string }) {
  return (
    <form action="/api/voice/upload" method="POST" encType="multipart/form-data">
      <input type="hidden" name="userId" value={userId} />
      <div className="space-y-4">
        <div>
          <p className="text-xs text-[#4A4846] uppercase tracking-widest font-medium mb-2">
            Tips for a great clone
          </p>
          <ul className="text-xs text-[#8A8785] space-y-1">
            <li>• Record 30–60 seconds of yourself speaking naturally</li>
            <li>• No background music or noise</li>
            <li>• Speak at your normal pace and tone</li>
            <li>• Use your content voice, not a &quot;radio voice&quot;</li>
          </ul>
        </div>
        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[#1F1F1F] rounded-xl py-10 cursor-pointer hover:border-[#2563EB] hover:bg-[#2563EB]/5 transition-all">
          <input type="file" name="sample" accept="audio/*,video/*" className="hidden" required />
          <Mic size={22} className="text-[#4A4846]" />
          <span className="text-sm font-medium text-[#F0EEE9]">Upload voice sample</span>
          <span className="text-xs text-[#8A8785]">MP3, WAV, M4A, MP4 · Max 50MB</span>
        </label>
        <button
          type="submit"
          className="w-full bg-[#2563EB] hover:bg-[#3B82F6] text-white text-sm font-semibold py-3 rounded-xl transition-colors"
        >
          Clone my voice
        </button>
      </div>
    </form>
  );
}
