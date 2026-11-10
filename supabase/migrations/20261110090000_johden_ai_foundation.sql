-- Johden AI only. Apply ONLY to the dedicated JohdenAI Supabase project.
create extension if not exists pgcrypto;
create table if not exists public.ai_prospects (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 company_name text not null, contact_name text, public_contact text, industry text,
 stage text not null default 'new', next_step text, source_url text, source_notes text,
 source_checked_at timestamptz, outreach_permission text not null default 'not_verified',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint ai_prospects_stage_check check (stage in ('new','research','qualified','contacted','meeting','proposal','won','lost')),
 constraint ai_prospects_permission_check check (outreach_permission in ('not_verified','permitted','opted_out'))
);
create index if not exists ai_prospects_owner_updated_idx on public.ai_prospects(owner_id, updated_at desc);
create table if not exists public.ai_message_drafts (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 prospect_id uuid references public.ai_prospects(id) on delete set null,
 channel text not null default 'whatsapp', message_text text not null,
 status text not null default 'needs_approval', version integer not null default 1,
 approved_at timestamptz, approved_by uuid references auth.users(id) on delete set null,
 sent_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint ai_message_channel_check check (channel in ('whatsapp','email','sms','other')),
 constraint ai_message_status_check check (status in ('needs_approval','approved','sent','rejected','superseded'))
);
create index if not exists ai_message_drafts_owner_status_idx on public.ai_message_drafts(owner_id, status, created_at desc);
create table if not exists public.ai_tasks (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 prospect_id uuid references public.ai_prospects(id) on delete set null, title text not null, details text,
 due_at timestamptz, status text not null default 'open', completed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint ai_tasks_status_check check (status in ('open','in_progress','done','cancelled'))
);
create index if not exists ai_tasks_owner_due_idx on public.ai_tasks(owner_id, due_at);
create table if not exists public.ai_activities (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 entity_type text not null, entity_id uuid, action text not null, details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists ai_activities_owner_created_idx on public.ai_activities(owner_id, created_at desc);
create table if not exists public.ai_integrations (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 provider text not null, status text not null default 'disconnected', account_label text,
 encrypted_credentials text, metadata jsonb not null default '{}'::jsonb,
 connected_at timestamptz, updated_at timestamptz not null default now(), unique(owner_id, provider),
 constraint ai_integrations_provider_check check (provider in ('openai','google_calendar','whatsapp_cloud'))
);
alter table public.ai_prospects enable row level security;
alter table public.ai_message_drafts enable row level security;
alter table public.ai_tasks enable row level security;
alter table public.ai_activities enable row level security;
alter table public.ai_integrations enable row level security;
drop policy if exists "Owner manages own AI prospects" on public.ai_prospects;
create policy "Owner manages own AI prospects" on public.ai_prospects for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "Owner manages own AI message drafts" on public.ai_message_drafts;
create policy "Owner manages own AI message drafts" on public.ai_message_drafts for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "Owner manages own AI tasks" on public.ai_tasks;
create policy "Owner manages own AI tasks" on public.ai_tasks for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "Owner reads own AI activity" on public.ai_activities;
create policy "Owner reads own AI activity" on public.ai_activities for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists "Owner manages own AI integrations" on public.ai_integrations;
create policy "Owner manages own AI integrations" on public.ai_integrations for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
comment on table public.ai_prospects is 'JohdenAI only; separate from JBCS finance data.';
comment on table public.ai_message_drafts is 'Requires explicit approval; no automatic sending.';
