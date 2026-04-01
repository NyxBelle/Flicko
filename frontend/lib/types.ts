export type JobStatus = {
  status: "pending" | "processing" | "done" | "failed";
  progress: number;
  message: string;
  result_url: string;
};

export type Project = {
  id: string;
  name: string;
  style: string;
  status: string;
  target_duration: number;
  created_at: string;
};

export type Video = {
  id: string;
  filename: string;
  order: number;
  duration: number;
};

export type VoiceProfile = {
  has_voice: boolean;
  voice_id?: string;
  created_at?: string;
};