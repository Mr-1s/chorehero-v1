-- New service_type enum labels for "coming soon" template rows.
-- Seeded in 081 — must be a separate migration from inserts (55P04).

do $$ begin
  alter type public.service_type add value 'laundry_pickup';
exception when duplicate_object then null;
end $$;

do $$ begin
  alter type public.service_type add value 'lawn_care_coming_soon';
exception when duplicate_object then null;
end $$;

do $$ begin
  alter type public.service_type add value 'pressure_washing_coming_soon';
exception when duplicate_object then null;
end $$;

do $$ begin
  alter type public.service_type add value 'pet_care_coming_soon';
exception when duplicate_object then null;
end $$;

do $$ begin
  alter type public.service_type add value 'errands_coming_soon';
exception when duplicate_object then null;
end $$;

do $$ begin
  alter type public.service_type add value 'handyman_coming_soon';
exception when duplicate_object then null;
end $$;
