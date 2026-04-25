-- Seed "coming soon" service templates (after 080 adds enum values).

INSERT INTO public.services (
  type,
  name,
  description,
  base_price,
  estimated_duration,
  slug,
  category,
  icon,
  is_active,
  coming_soon,
  base_questions
)
SELECT 'laundry_pickup', 'Laundry Pickup & Delivery', 'Wash, dry, fold — picked up and delivered to your door.',
  0, 60, 'laundry-pickup', 'laundry', 'Shirt', true, true, '[]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.services WHERE slug = 'laundry-pickup');

INSERT INTO public.services (
  type,
  name,
  description,
  base_price,
  estimated_duration,
  slug,
  category,
  icon,
  is_active,
  coming_soon,
  base_questions
)
SELECT 'lawn_care_coming_soon', 'Lawn Care', 'Mowing, edging, and yard cleanup from local pros.',
  0, 60, 'lawn-care', 'outdoor', 'Sun', true, true, '[]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.services WHERE slug = 'lawn-care');

INSERT INTO public.services (
  type,
  name,
  description,
  base_price,
  estimated_duration,
  slug,
  category,
  icon,
  is_active,
  coming_soon,
  base_questions
)
SELECT 'pressure_washing_coming_soon', 'Pressure Washing', 'Driveways, siding, and decks — cleaned in one visit.',
  0, 60, 'pressure-washing', 'outdoor', 'Droplets', true, true, '[]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.services WHERE slug = 'pressure-washing');

INSERT INTO public.services (
  type,
  name,
  description,
  base_price,
  estimated_duration,
  slug,
  category,
  icon,
  is_active,
  coming_soon,
  base_questions
)
SELECT 'pet_care_coming_soon', 'Pet Care', 'Dog walks, feeding visits, and pet sitting near you.',
  0, 60, 'pet-care', 'pets', 'Dog', true, true, '[]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.services WHERE slug = 'pet-care');

INSERT INTO public.services (
  type,
  name,
  description,
  base_price,
  estimated_duration,
  slug,
  category,
  icon,
  is_active,
  coming_soon,
  base_questions
)
SELECT 'errands_coming_soon', 'Errands & Grocery', 'Grocery runs, returns, and quick errands by trusted heroes.',
  0, 60, 'errands', 'errands', 'ShoppingBag', true, true, '[]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.services WHERE slug = 'errands');

INSERT INTO public.services (
  type,
  name,
  description,
  base_price,
  estimated_duration,
  slug,
  category,
  icon,
  is_active,
  coming_soon,
  base_questions
)
SELECT 'handyman_coming_soon', 'Handyman Help', 'Picture hanging, furniture assembly, small repairs.',
  0, 60, 'handyman', 'handyman', 'Wrench', true, true, '[]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.services WHERE slug = 'handyman');
