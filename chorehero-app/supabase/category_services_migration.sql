-- Migration: Add Room-Specific Service Categories
-- This migration adds support for room-based service filtering

-- Add room_type column to services table
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS room_type VARCHAR(50);
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'cleaning';

-- Create service categories table for better organization
CREATE TABLE IF NOT EXISTS public.service_categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  icon_name VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert predefined categories that match the UI
INSERT INTO public.service_categories (name, display_name, description, icon_name, sort_order) VALUES
('featured', 'Featured', 'Most popular and trending services', 'star', 0),
('kitchen', 'Kitchen', 'Kitchen cleaning and maintenance services', 'restaurant', 1),
('bathroom', 'Bathroom', 'Bathroom cleaning and sanitization', 'water', 2),
('living_room', 'Living Room', 'Living room and common area cleaning', 'home', 3),
('bedroom', 'Bedroom', 'Bedroom cleaning and organization', 'bed', 4),
('outdoors', 'Outdoors', 'Outdoor cleaning and maintenance', 'leaf', 5)
ON CONFLICT (name) DO NOTHING;

-- Update existing services with room types
UPDATE public.services SET 
  room_type = 'general',
  category = 'cleaning'
WHERE room_type IS NULL;

-- Insert room-specific services
INSERT INTO public.services (type, name, description, base_price, estimated_duration, included_tasks, room_type, category, is_active) VALUES
-- Kitchen Services
('standard', 'Kitchen Deep Clean', 'Complete kitchen deep cleaning including appliances, cabinets, and surfaces', 89.00, 150, 
 ARRAY['Appliance cleaning (exterior)', 'Cabinet fronts', 'Countertop deep clean', 'Sink sanitization', 'Backsplash cleaning'], 
 'kitchen', 'cleaning', true),
('deep', 'Kitchen Appliance Interior', 'Deep clean inside kitchen appliances', 120.00, 180,
 ARRAY['Inside oven cleaning', 'Inside refrigerator', 'Microwave interior', 'Dishwasher deep clean', 'Hood vent cleaning'],
 'kitchen', 'cleaning', true),
('express', 'Kitchen Quick Clean', 'Fast kitchen maintenance cleaning', 55.00, 60,
 ARRAY['Counter wipe down', 'Sink cleaning', 'Stovetop cleaning', 'Quick appliance exterior'],
 'kitchen', 'cleaning', true),

-- Bathroom Services  
('standard', 'Bathroom Deep Clean', 'Thorough bathroom cleaning and sanitization', 75.00, 90,
 ARRAY['Toilet deep clean', 'Shower/tub scrubbing', 'Tile and grout cleaning', 'Mirror and fixtures', 'Floor mopping'],
 'bathroom', 'cleaning', true),
('deep', 'Bathroom Restoration', 'Intensive bathroom cleaning with mold/mildew treatment', 110.00, 150,
 ARRAY['Grout restoration', 'Mold treatment', 'Calcium buildup removal', 'Caulk cleaning', 'Deep sanitization'],
 'bathroom', 'cleaning', true),
('express', 'Bathroom Quick Clean', 'Fast bathroom maintenance', 45.00, 45,
 ARRAY['Toilet cleaning', 'Sink wipe down', 'Mirror cleaning', 'Quick floor mop'],
 'bathroom', 'cleaning', true),

-- Living Room Services
('standard', 'Living Room Detail', 'Complete living room cleaning and organization', 65.00, 120,
 ARRAY['Furniture dusting', 'Carpet vacuuming', 'Surface cleaning', 'Light organizing', 'Baseboard cleaning'],
 'living_room', 'cleaning', true),
('deep', 'Living Room Deep Clean', 'Intensive living room cleaning with upholstery', 95.00, 180,
 ARRAY['Upholstery cleaning', 'Carpet deep clean', 'Window cleaning', 'Detailed dusting', 'Electronics cleaning'],
 'living_room', 'cleaning', true),

-- Bedroom Services
('standard', 'Bedroom Refresh', 'Bedroom cleaning and organization', 55.00, 90,
 ARRAY['Bed making', 'Dusting surfaces', 'Closet organization', 'Vacuuming', 'Light cleaning'],
 'bedroom', 'cleaning', true),
('deep', 'Bedroom Deep Organization', 'Complete bedroom cleaning with closet organization', 85.00, 150,
 ARRAY['Deep closet organization', 'Under-bed cleaning', 'Detailed dusting', 'Mattress vacuuming', 'Drawer organization'],
 'bedroom', 'organization', true),

-- Outdoor Services
('standard', 'Patio Cleaning', 'Outdoor patio and deck cleaning', 70.00, 120,
 ARRAY['Pressure washing', 'Furniture cleaning', 'Plant care', 'Debris removal', 'Surface sanitization'],
 'outdoors', 'cleaning', true),
('deep', 'Garage Organization', 'Complete garage cleaning and organization', 100.00, 180,
 ARRAY['Deep cleaning', 'Storage organization', 'Tool organization', 'Floor cleaning', 'Cobweb removal'],
 'outdoors', 'organization', true)

ON CONFLICT (type, name) DO NOTHING;

-- Update cleaner specialties to match room categories
-- First, let's check existing specialties and update them
UPDATE public.cleaner_profiles 
SET specialties = ARRAY['Kitchen', 'Bathroom', 'General Cleaning']
WHERE 'Kitchen' = ANY(specialties) OR 'Bathroom' = ANY(specialties);

UPDATE public.cleaner_profiles 
SET specialties = ARRAY['Living Room', 'Bedroom', 'General Cleaning']
WHERE 'Living Room' = ANY(specialties) OR 'Bedroom' = ANY(specialties);

UPDATE public.cleaner_profiles 
SET specialties = ARRAY['Outdoors', 'Garage', 'General Cleaning']
WHERE 'Outdoors' = ANY(specialties) OR 'Pressure Washing' = ANY(specialties);

-- Ensure all cleaners have at least some room-specific specialties
UPDATE public.cleaner_profiles 
SET specialties = CASE 
  WHEN array_length(specialties, 1) IS NULL OR NOT (specialties && ARRAY['Kitchen', 'Bathroom', 'Living Room', 'Bedroom', 'Outdoors']) THEN
    specialties || ARRAY['Kitchen', 'Bathroom']
  ELSE specialties
END;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_services_room_type ON public.services(room_type);
CREATE INDEX IF NOT EXISTS idx_services_category ON public.services(category);
CREATE INDEX IF NOT EXISTS idx_cleaner_profiles_specialties ON public.cleaner_profiles USING GIN(specialties);

-- Enable RLS for service_categories
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view service categories" ON public.service_categories
  FOR SELECT USING (is_active = true); 