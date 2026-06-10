-- ============================================================
-- Flicko Database Schema
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- PROFILES
-- ============================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  tier        text not null default 'free' check (tier in ('free', 'starter', 'pro')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================
create table if not exists public.subscriptions (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null references public.profiles(id) on delete cascade,
  tier                      text not null check (tier in ('free', 'starter', 'pro')),
  provider                  text not null check (provider in ('flutterwave', 'paystack')),
  provider_subscription_id  text,
  provider_transaction_id   text,
  status                    text not null default 'active' check (status in ('active', 'cancelled', 'past_due')),
  current_period_end        timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "Users can read own subscriptions"
  on public.subscriptions for select
  using (auth.uid() = user_id);

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- PROJECTS
-- ============================================================
create table if not exists public.projects (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  title               text not null,
  content_context     text not null,
  desired_outcome     text not null,
  target_platform     text not null check (target_platform in ('tiktok', 'reels', 'shorts', 'linkedin', 'youtube')),
  audio_preference    text not null default 'flicko_decides' check (audio_preference in ('flicko_decides', 'voiceover', 'trending_sound')),
  status              text not null default 'draft' check (status in ('draft', 'transcribing', 'analyzing', 'deciding', 'editing', 'rendering', 'done', 'failed')),
  edit_decisions      jsonb,
  transcript          text,
  video_urls          text[] not null default '{}',
  render_url          text,
  openshorts_job_id   text,
  hyperframes_job_id  text,
  error_message       text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "Users can read own projects"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "Users can insert own projects"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "Users can update own projects"
  on public.projects for update
  using (auth.uid() = user_id);

create policy "Users can delete own projects"
  on public.projects for delete
  using (auth.uid() = user_id);

create trigger projects_updated_at
  before update on public.projects
  for each row execute procedure public.set_updated_at();

create index if not exists projects_user_id_idx on public.projects(user_id);
create index if not exists projects_status_idx on public.projects(status);

-- ============================================================
-- VOICE CLONES
-- ============================================================
create table if not exists public.voice_clones (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles(id) on delete cascade,
  elevenlabs_voice_id   text,
  sample_url            text not null,
  status                text not null default 'processing' check (status in ('processing', 'ready', 'failed')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.voice_clones enable row level security;

create policy "Users can read own voice clones"
  on public.voice_clones for select
  using (auth.uid() = user_id);

create policy "Users can insert own voice clones"
  on public.voice_clones for insert
  with check (auth.uid() = user_id);

create policy "Users can update own voice clones"
  on public.voice_clones for update
  using (auth.uid() = user_id);

create trigger voice_clones_updated_at
  before update on public.voice_clones
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- USAGE COUNTERS
-- ============================================================
create table if not exists public.usage_counters (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  period      text not null,
  edits_used  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(user_id, period)
);

alter table public.usage_counters enable row level security;

create policy "Users can read own usage"
  on public.usage_counters for select
  using (auth.uid() = user_id);

create trigger usage_counters_updated_at
  before update on public.usage_counters
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- STORAGE BUCKETS
-- (Run these in Supabase dashboard or via their API — SQL editor doesn't support storage commands)
--
-- insert into storage.buckets (id, name, public) values ('videos', 'videos', false);
-- insert into storage.buckets (id, name, public) values ('voice-samples', 'voice-samples', false);
-- insert into storage.buckets (id, name, public) values ('renders', 'renders', false);
--
-- Storage RLS policies:
--
-- create policy "Users can upload own videos"
--   on storage.objects for insert
--   with check (bucket_id = 'videos' and auth.uid()::text = (storage.foldername(name))[1]);
--
-- create policy "Users can read own videos"
--   on storage.objects for select
--   using (bucket_id = 'videos' and auth.uid()::text = (storage.foldername(name))[1]);
--
-- create policy "Users can upload own voice samples"
--   on storage.objects for insert
--   with check (bucket_id = 'voice-samples' and auth.uid()::text = (storage.foldername(name))[1]);
--
-- create policy "Users can read own voice samples"
--   on storage.objects for select
--   using (bucket_id = 'voice-samples' and auth.uid()::text = (storage.foldername(name))[1]);
--
-- create policy "Users can read own renders"
--   on storage.objects for select
--   using (bucket_id = 'renders' and auth.uid()::text = (storage.foldername(name))[1]);
-- ============================================================
