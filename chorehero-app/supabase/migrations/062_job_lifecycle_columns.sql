-- Job Data Lifecycle & Storage Management
-- Add columns for hide, archive, soft delete, and pro capacity

-- Jobs table: lifecycle columns
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS hidden_by_customer BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS permanently_deleted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS booked_at TIMESTAMPTZ;

-- Cleaner profiles: capacity limit
ALTER TABLE public.cleaner_profiles
  ADD COLUMN IF NOT EXISTS max_concurrent_bookings INTEGER DEFAULT 3;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_customer_active ON public.jobs(customer_id, archived, deleted);
CREATE INDEX IF NOT EXISTS idx_jobs_status_archived ON public.jobs(status, archived);
CREATE INDEX IF NOT EXISTS idx_bookings_cleaner_active ON public.bookings(cleaner_id, status);
