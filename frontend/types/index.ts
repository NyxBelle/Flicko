export type UserTier = "free" | "starter" | "pro";

export type ProjectStatus =
  | "draft"
  | "transcribing"
  | "analyzing"
  | "deciding"
  | "editing"
  | "rendering"
  | "done"
  | "failed";

export type AudioTreatment = "flicko_decides" | "voiceover" | "trending_sound";

export type TargetPlatform = "tiktok" | "reels" | "shorts" | "linkedin" | "youtube";

export type CaptionStyle =
  | "bold_center"
  | "minimal_bottom"
  | "viral_highlight"
  | "professional"
  | "none";

export type TransitionType = "cut" | "fade" | "zoom" | "swipe";

export interface Segment {
  start: number;
  end: number;
  order: number;
  reason: string;
  speed?: number; // 0.5 = slow-mo, 1.0 = normal, 2.0 = double speed
}

export interface EditDecision {
  segments: Segment[];
  pacing: "slow" | "medium" | "fast" | "very_fast";
  transition_type: TransitionType;
  audio_treatment: AudioTreatment;
  caption_style: CaptionStyle;
  energy_level: 1 | 2 | 3 | 4 | 5;
  hook_moment: number;
  rationale: string;
  editorial_note: string;
  energy_arc?: string;
  suggested_title?: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  tier: UserTier;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  tier: UserTier;
  provider: "flutterwave" | "paystack";
  provider_subscription_id: string | null;
  status: "active" | "cancelled" | "past_due";
  current_period_end: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  title: string;
  content_context: string;
  desired_outcome: string;
  target_platform: TargetPlatform;
  audio_preference: AudioTreatment;
  status: ProjectStatus;
  edit_decisions: EditDecision | null;
  transcript: string | null;
  video_urls: string[];
  render_url: string | null;
  openshorts_job_id: string | null;
  hyperframes_job_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface VoiceClone {
  id: string;
  user_id: string;
  elevenlabs_voice_id: string;
  sample_url: string;
  status: "processing" | "ready" | "failed";
  created_at: string;
}

export interface UsageCounter {
  id: string;
  user_id: string;
  period: string;
  edits_used: number;
  created_at: string;
  updated_at: string;
}

export type StatusStep = {
  key: ProjectStatus;
  label: string;
  description: string;
};

export const STATUS_STEPS: StatusStep[] = [
  { key: "transcribing", label: "Analyzing your video", description: "Reading every frame and word" },
  { key: "analyzing", label: "Understanding your content", description: "Building context from what you told us" },
  { key: "deciding", label: "Making creative decisions", description: "Choosing what stays, what goes, how it feels" },
  { key: "editing", label: "Editing", description: "Cutting, reframing, and timing every moment" },
  { key: "rendering", label: "Rendering", description: "Composing the final video with captions and audio" },
  { key: "done", label: "Ready", description: "Your video is ready to post" },
];

export const TIER_LIMITS: Record<UserTier, { edits: number; period: "lifetime" | "monthly"; voiceClone: boolean }> = {
  free: { edits: 2, period: "lifetime", voiceClone: false },
  starter: { edits: 10, period: "monthly", voiceClone: false },
  pro: { edits: 50, period: "monthly", voiceClone: true },
};

export const PLATFORM_LABELS: Record<TargetPlatform, string> = {
  tiktok: "TikTok",
  reels: "Instagram Reels",
  shorts: "YouTube Shorts",
  linkedin: "LinkedIn",
  youtube: "YouTube",
};

export const PLATFORM_ASPECT_RATIOS: Record<TargetPlatform, string> = {
  tiktok: "9:16",
  reels: "9:16",
  shorts: "9:16",
  linkedin: "16:9",
  youtube: "16:9",
};
