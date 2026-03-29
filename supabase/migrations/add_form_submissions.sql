-- Run this in the Supabase SQL editor (or via `supabase db push`).
-- Creates the form_submissions table that the browser extension writes to
-- and agents read from.

create type form_submission_status as enum ('pending', 'processing', 'done');

create table if not exists form_submissions (
  id            uuid primary key default gen_random_uuid(),
  session_token text not null,           -- extension-generated UUID (chrome.storage.local)
  page_url      text not null,
  page_title    text not null default '',
  form_fields   jsonb not null,          -- array of field definitions from the extension
  answers       jsonb not null,          -- { field_key: value } map
  status        form_submission_status not null default 'pending',
  created_at    timestamptz not null default now()
);

-- Index so agents can efficiently pull all pending rows
create index if not exists form_submissions_status_idx
  on form_submissions (status, created_at asc);

-- Index for the extension to poll its own submissions
create index if not exists form_submissions_token_idx
  on form_submissions (session_token, created_at desc);

-- Row Level Security
alter table form_submissions enable row level security;

-- Service-role (used by Next.js API routes via supabaseAdmin) can do everything.
-- No anon/user policies needed — the extension goes through the Next.js API,
-- not directly to Supabase.
create policy "service role full access"
  on form_submissions
  for all
  to service_role
  using (true)
  with check (true);
