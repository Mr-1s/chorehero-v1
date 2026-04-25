-- Add admin to user_role. Own migration so it commits before any policy references it (55P04).

do $$ begin
  alter type public.user_role add value 'admin';
exception when duplicate_object then null;
end $$;
