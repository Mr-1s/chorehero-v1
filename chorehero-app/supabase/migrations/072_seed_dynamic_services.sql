-- Seed dynamic template services (runs after 071 commits so enum labels are usable).

insert into public.services (
  type,
  name,
  description,
  base_price,
  estimated_duration,
  slug,
  category,
  base_questions
)
values
(
  'house_cleaning',
  'House Cleaning',
  'Book house cleaning with custom questions',
  0,
  60,
  'house-cleaning',
  'cleaning',
  '[
  {"id":"sqft","type":"number","label":"Square Footage","placeholder":"e.g. 1500","required":true,"min":200},
  {"id":"bedrooms","type":"select","label":"Bedrooms","options":["1","2","3","4","5+"],"required":true},
  {"id":"bathrooms","type":"select","label":"Bathrooms","options":["1","2","3","4+"],"required":true},
  {"id":"pets","type":"boolean","label":"Have pets?","required":false}
]'::jsonb
),
(
  'lawn_mowing',
  'Lawn Mowing',
  'Outdoor lawn care',
  0,
  45,
  'lawn-mowing',
  'outdoor',
  '[
  {"id":"yard_size","type":"select","label":"Yard Size","options":["Small","Medium","Large"],"required":true},
  {"id":"areas","type":"multiselect","label":"Areas to Mow","options":["Front Yard","Back Yard","Side Yard"],"required":true}
]'::jsonb
)
on conflict (type) do nothing;
