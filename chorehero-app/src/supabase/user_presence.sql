-- user_presence table and upsert policy
create table if not exists public.user_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  online boolean not null default false,
  last_seen_at timestamptz not null default now()
);

alter table public.user_presence enable row level security;

-- allow users to upsert their own presence
create policy if not exists "presence_self_upsert"
on public.user_presence for insert
to authenticated
with check (auth.uid() = user_id);

create policy if not exists "presence_self_update"
on public.user_presence for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- allow read to everyone
create policy if not exists "presence_read_all"
on public.user_presence for select
to anon, authenticated
using (true);


