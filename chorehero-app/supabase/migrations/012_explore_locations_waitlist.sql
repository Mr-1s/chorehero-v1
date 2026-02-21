-- Active locations for zip gating + waitlist leads
CREATE TABLE IF NOT EXISTS public.active_locations (
  zip_code VARCHAR(10) PRIMARY KEY,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.waitlist_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  zip_code VARCHAR(10) NOT NULL,
  city VARCHAR(100),
  state VARCHAR(50),
  primary_service_needed VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
