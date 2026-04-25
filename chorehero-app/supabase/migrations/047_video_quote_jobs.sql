-- Video Quote System: Jobs and Quotes tables
-- Customer posts jobs with media; pros respond with 60-sec video quotes

CREATE TYPE job_category AS ENUM ('cleaning', 'mounting', 'repairs', 'yard_work', 'moving_help');
CREATE TYPE job_urgency AS ENUM ('today', 'tomorrow', 'this_week', 'flexible');
CREATE TYPE job_status AS ENUM ('open', 'quotes_received', 'booked', 'expired', 'cancelled');
CREATE TYPE quote_status AS ENUM ('pending', 'viewed', 'accepted', 'declined', 'expired');

-- Jobs table (customer posts)
CREATE TABLE public.jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  headline TEXT NOT NULL,
  description TEXT,
  category job_category NOT NULL,
  urgency job_urgency NOT NULL,
  status job_status DEFAULT 'open' NOT NULL,
  budget_min_cents INTEGER,
  budget_max_cents INTEGER,
  address_id UUID REFERENCES public.addresses(id),
  street TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  location GEOGRAPHY(POINT),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Job media (photos or video URLs)
CREATE TABLE public.job_media (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  media_url TEXT NOT NULL,
  media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('photo', 'video')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Video quotes from pros
CREATE TABLE public.quotes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  pro_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  video_url TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  availability_text TEXT,
  availability_slots JSONB,
  status quote_status DEFAULT 'pending' NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(job_id, pro_id)
);

CREATE INDEX idx_jobs_customer ON public.jobs(customer_id);
CREATE INDEX idx_jobs_status ON public.jobs(status);
CREATE INDEX idx_jobs_category ON public.jobs(category);
CREATE INDEX idx_jobs_expires ON public.jobs(expires_at);
CREATE INDEX idx_jobs_location ON public.jobs USING GIST(location);
CREATE INDEX idx_job_media_job ON public.job_media(job_id);
CREATE INDEX idx_quotes_job ON public.quotes(job_id);
CREATE INDEX idx_quotes_pro ON public.quotes(pro_id);

-- RLS
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY jobs_policy ON public.jobs
  FOR ALL USING (
    auth.uid() = customer_id
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'cleaner'
    )
  );

CREATE POLICY job_media_policy ON public.job_media
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_id AND (
        j.customer_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'cleaner')
      )
    )
  );

CREATE POLICY quotes_policy ON public.quotes
  FOR ALL USING (
    auth.uid() = pro_id
    OR EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_id AND j.customer_id = auth.uid()
    )
  );
