-- New labels on service_type (001 only defined express, standard, deep).
-- Must be its own migration: Postgres does not allow using new enum values in the same
-- transaction as ALTER TYPE ... ADD VALUE (SQLSTATE 55P04).

do $$ begin
  alter type public.service_type add value 'house_cleaning';
exception when duplicate_object then null;
end $$;

do $$ begin
  alter type public.service_type add value 'lawn_mowing';
exception when duplicate_object then null;
end $$;
