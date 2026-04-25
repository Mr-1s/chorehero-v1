-- Runs after 073: SELECT waitlist rows for users with role admin.

drop policy if exists "Waitlist readable by admins only" on public.waitlist_signups;

create policy "Waitlist readable by admins only"
  on public.waitlist_signups for select using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );
