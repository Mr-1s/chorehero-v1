-- ChoreHero: Foundational Service Categories
-- Run this AFTER the main schema to populate core service offerings

INSERT INTO public.service_categories (name, description, base_price, estimated_duration_minutes) VALUES
('Express Clean', 'Quick 30-45 minute cleaning for maintenance', 45.00, 35),
('Standard Clean', 'Comprehensive cleaning for regular maintenance', 75.00, 90),
('Deep Clean', 'Thorough cleaning for move-in/out or special occasions', 150.00, 180),
('Kitchen Deep Clean', 'Specialized kitchen cleaning including appliances', 85.00, 120),
('Bathroom Deep Clean', 'Complete bathroom cleaning and sanitization', 65.00, 75),
('Window Cleaning', 'Interior and exterior window cleaning', 80.00, 90),
('Carpet Cleaning', 'Professional carpet deep cleaning and stain removal', 120.00, 150),
('Move-in/Move-out Clean', 'Complete cleaning for rental transitions', 200.00, 240),
('Post-Construction Clean', 'Cleanup after construction or renovation work', 250.00, 300),
('Office Cleaning', 'Commercial office space cleaning', 100.00, 120),
('Garage Organization', 'Garage cleaning and organization service', 90.00, 180),
('Laundry Service', 'Washing, drying, and folding laundry', 40.00, 60),
('Interior Car Cleaning', 'Complete car interior detailing', 70.00, 90),
('Holiday Cleaning', 'Special cleaning before/after holidays', 130.00, 150),
('Pet-Safe Cleaning', 'Cleaning with pet-friendly products only', 80.00, 100)
ON CONFLICT (name) DO NOTHING;

-- Success message
SELECT 'Service categories created successfully! Your marketplace now has ' || count(*) || ' service offerings.' as result
FROM public.service_categories;