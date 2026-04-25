-- Follow-up for dynamic service templates:
-- 1) Waitlist capture for "coming soon" areas (email-based)
-- 2) Promote service_id to first-class column on content_posts
-- 3) Service area zips on pro_services for location-gated availability
-- 4) Allow booking_status to include 'pending_quote'
--
-- Waitlist SELECT for role=admin is in 074 (after 073 adds enum value; PG 55P04 otherwise).

create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text default 'unknown',
  zip_code text,
  city text,
  state text,
  created_at timestamptz default now()
);
create index if not exists idx_waitlist_signups_email on public.waitlist_signups (email);

alter table public.waitlist_signups enable row level security;

drop policy if exists "Anyone can insert waitlist" on public.waitlist_signups;
create policy "Anyone can insert waitlist"
  on public.waitlist_signups for insert with check (true);

alter table public.content_posts
  add column if not exists service_id uuid references public.services(id),
  add column if not exists pro_service_id uuid references public.pro_services(id);

create index if not exists idx_content_posts_service on public.content_posts (service_id);

alter table public.pro_services
  add column if not exists service_area_zips text[] default '{}',
  add column if not exists service_area_km integer;

-- Extend booking_status to allow pending_quote
do $$ begin
  alter type public.booking_status add value if not exists 'pending_quote';
exception when duplicate_object then null; end $$;
