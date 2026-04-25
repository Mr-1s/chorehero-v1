-- Dynamic service templates foundation
--
-- Requires `public.services` from 001_initial_schema (type service_type UNIQUE, base_price, …).
-- Older DBs skipped `create table if not exists` in the original 067, so `slug` never existed.

alter table public.services
  add column if not exists slug text,
  add column if not exists category text,
  add column if not exists icon text default 'Wrench',
  add column if not exists requires_location boolean default true,
  add column if not exists base_questions jsonb default '[]'::jsonb;

-- Backfill from legacy enum `type` (express / standard / deep)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'services' and column_name = 'type'
  ) then
    update public.services
    set slug = lower(replace(type::text, '_', '-'))
    where slug is null;
    update public.services
    set category = coalesce(nullif(trim(category), ''), 'cleaning')
    where category is null;
  end if;
end $$;

update public.services set base_questions = coalesce(base_questions, '[]'::jsonb) where base_questions is null;

-- Unique slug for template lookups (legacy rows backfilled above)
create unique index if not exists services_slug_unique on public.services (slug);

-- New service_type enum values + seed rows for house_cleaning / lawn_mowing live in 071 + 072.
-- PG forbids using a new enum label in the same transaction as ALTER TYPE ADD VALUE (55P04).

create table if not exists public.pro_services (
  id uuid primary key default gen_random_uuid(),
  pro_id uuid not null references public.users(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  is_active boolean default true,
  custom_questions jsonb default '[]'::jsonb,
  pricing_type text not null check (pricing_type in ('fixed', 'hourly', 'quote')),
  base_price integer,
  hourly_rate integer,
  min_hours integer default 1,
  max_hours integer default 8,
  description text,
  media_urls text[] default '{}',
  availability jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(pro_id, service_id)
);

create table if not exists public.booking_answers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  question_id text not null,
  question_label text not null,
  answer jsonb not null,
  created_at timestamptz default now()
);

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.users(id) on delete cascade,
  service_name text not null,
  category text not null,
  description text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now()
);

alter table public.bookings
  add column if not exists service_id uuid references public.services(id),
  add column if not exists pro_service_id uuid references public.pro_services(id);

alter table public.services enable row level security;
alter table public.pro_services enable row level security;
alter table public.booking_answers enable row level security;
alter table public.service_requests enable row level security;

drop policy if exists "Services are viewable by everyone" on public.services;
create policy "Services are viewable by everyone"
  on public.services for select using (true);

drop policy if exists "Pro services viewable by everyone" on public.pro_services;
create policy "Pro services viewable by everyone"
  on public.pro_services for select using (true);

drop policy if exists "Pros can manage their services" on public.pro_services;
create policy "Pros can manage their services"
  on public.pro_services for all using (auth.uid() = pro_id);

drop policy if exists "Booking answers viewable by booking participants" on public.booking_answers;
create policy "Booking answers viewable by booking participants"
  on public.booking_answers for select using (
    exists (
      select 1 from public.bookings
      where bookings.id = booking_answers.booking_id
        and (bookings.customer_id = auth.uid() or bookings.cleaner_id = auth.uid())
    )
  );

drop policy if exists "Booking answers insertable by customer" on public.booking_answers;
create policy "Booking answers insertable by customer"
  on public.booking_answers for insert with check (
    exists (
      select 1 from public.bookings
      where bookings.id = booking_answers.booking_id
        and bookings.customer_id = auth.uid()
    )
  );

drop policy if exists "Pros can create service requests" on public.service_requests;
create policy "Pros can create service requests"
  on public.service_requests for insert with check (auth.uid() = requester_id);
