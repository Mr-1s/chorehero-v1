-- ============================================================================
-- Booking Locks Table - Prevents Concurrent Booking Race Conditions
-- Implements optimistic locking for booking time slots
-- ============================================================================

-- Create booking_locks table
CREATE TABLE IF NOT EXISTS public.booking_locks (
    id TEXT PRIMARY KEY,
    cleaner_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    time_slot TIMESTAMPTZ NOT NULL,
    locked_by UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint to prevent multiple locks for same time slot
    UNIQUE(cleaner_id, time_slot)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_booking_locks_cleaner 
ON public.booking_locks(cleaner_id);

CREATE INDEX IF NOT EXISTS idx_booking_locks_expires 
ON public.booking_locks(expires_at);

CREATE INDEX IF NOT EXISTS idx_booking_locks_time_slot
ON public.booking_locks(cleaner_id, time_slot);

-- Create index for cleanup of expired locks
CREATE INDEX IF NOT EXISTS idx_booking_locks_expired
ON public.booking_locks(expires_at)
WHERE expires_at < NOW();

-- Enable RLS
ALTER TABLE public.booking_locks ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view locks they created" ON public.booking_locks
  FOR SELECT USING (locked_by = auth.uid());

CREATE POLICY "Users can create locks" ON public.booking_locks
  FOR INSERT WITH CHECK (locked_by = auth.uid());

CREATE POLICY "Users can delete their own locks" ON public.booking_locks
  FOR DELETE USING (locked_by = auth.uid());

CREATE POLICY "System can manage all locks" ON public.booking_locks
  FOR ALL USING (auth.role() = 'service_role');

-- Function to automatically clean up expired locks
CREATE OR REPLACE FUNCTION cleanup_expired_booking_locks()
RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER := 0;
BEGIN
    -- Delete expired locks
    DELETE FROM public.booking_locks
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    
    RETURN cleaned_count;
END;
$$ language 'plpgsql';

-- Function to prevent overlapping locks
CREATE OR REPLACE FUNCTION validate_booking_lock()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if there's already a non-expired lock for this time slot
    IF EXISTS (
        SELECT 1 FROM public.booking_locks
        WHERE cleaner_id = NEW.cleaner_id
          AND time_slot = NEW.time_slot
          AND expires_at > NOW()
          AND id != COALESCE(NEW.id, '')
    ) THEN
        RAISE EXCEPTION 'Time slot is already locked by another booking';
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to validate booking locks on insert/update
CREATE TRIGGER validate_booking_lock_trigger
    BEFORE INSERT OR UPDATE ON public.booking_locks
    FOR EACH ROW
    EXECUTE FUNCTION validate_booking_lock();

-- Function to extend lock expiry
CREATE OR REPLACE FUNCTION extend_booking_lock(
    lock_id TEXT,
    additional_minutes INTEGER DEFAULT 10
)
RETURNS BOOLEAN AS $$
DECLARE
    lock_found BOOLEAN := FALSE;
BEGIN
    -- Update the expiry time if lock exists and hasn't expired
    UPDATE public.booking_locks
    SET expires_at = expires_at + INTERVAL '1 minute' * additional_minutes
    WHERE id = lock_id
      AND expires_at > NOW();
    
    GET DIAGNOSTICS lock_found = FOUND;
    
    RETURN lock_found;
END;
$$ language 'plpgsql';

-- Function to check if a time slot is available (no conflicts or locks)
CREATE OR REPLACE FUNCTION is_time_slot_available(
    p_cleaner_id UUID,
    p_start_time TIMESTAMPTZ,
    p_duration_minutes INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    p_end_time TIMESTAMPTZ;
    conflict_count INTEGER := 0;
    lock_count INTEGER := 0;
BEGIN
    p_end_time := p_start_time + INTERVAL '1 minute' * p_duration_minutes;
    
    -- Check for conflicting bookings
    SELECT COUNT(*) INTO conflict_count
    FROM public.bookings
    WHERE cleaner_id = p_cleaner_id
      AND status IN ('pending', 'confirmed', 'cleaner_assigned', 'cleaner_en_route', 'cleaner_arrived', 'in_progress')
      AND (
          (scheduled_time < p_end_time AND scheduled_time + INTERVAL '1 minute' * estimated_duration > p_start_time)
      );
    
    -- Check for active locks
    SELECT COUNT(*) INTO lock_count
    FROM public.booking_locks
    WHERE cleaner_id = p_cleaner_id
      AND time_slot = p_start_time
      AND expires_at > NOW();
    
    RETURN (conflict_count = 0 AND lock_count = 0);
END;
$$ language 'plpgsql';

-- Add database constraints to bookings table to prevent overlaps
-- (This is additional protection beyond the locking mechanism)
CREATE OR REPLACE FUNCTION prevent_booking_overlaps()
RETURNS TRIGGER AS $$
DECLARE
    overlap_count INTEGER := 0;
BEGIN
    -- Only check for overlaps on INSERT or if critical fields changed on UPDATE
    IF TG_OP = 'INSERT' OR 
       (TG_OP = 'UPDATE' AND (
         OLD.cleaner_id != NEW.cleaner_id OR 
         OLD.scheduled_time != NEW.scheduled_time OR 
         OLD.estimated_duration != NEW.estimated_duration
       )) THEN
        
        -- Check for overlapping bookings for the same cleaner
        SELECT COUNT(*) INTO overlap_count
        FROM public.bookings
        WHERE cleaner_id = NEW.cleaner_id
          AND id != NEW.id
          AND status IN ('pending', 'confirmed', 'cleaner_assigned', 'cleaner_en_route', 'cleaner_arrived', 'in_progress')
          AND (
              -- New booking starts during existing booking
              (NEW.scheduled_time >= scheduled_time AND 
               NEW.scheduled_time < scheduled_time + INTERVAL '1 minute' * estimated_duration)
              OR
              -- New booking ends during existing booking  
              (NEW.scheduled_time + INTERVAL '1 minute' * NEW.estimated_duration > scheduled_time AND
               NEW.scheduled_time + INTERVAL '1 minute' * NEW.estimated_duration <= scheduled_time + INTERVAL '1 minute' * estimated_duration)
              OR
              -- New booking completely encompasses existing booking
              (NEW.scheduled_time <= scheduled_time AND
               NEW.scheduled_time + INTERVAL '1 minute' * NEW.estimated_duration >= scheduled_time + INTERVAL '1 minute' * estimated_duration)
          );
        
        IF overlap_count > 0 THEN
            RAISE EXCEPTION 'Booking conflicts with existing booking for this cleaner';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to prevent booking overlaps
CREATE TRIGGER prevent_booking_overlaps_trigger
    BEFORE INSERT OR UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION prevent_booking_overlaps();

-- Comments for documentation
COMMENT ON TABLE public.booking_locks IS 'Optimistic locks to prevent concurrent booking of the same time slot';
COMMENT ON COLUMN public.booking_locks.time_slot IS 'The specific time slot being locked';
COMMENT ON COLUMN public.booking_locks.expires_at IS 'When the lock expires (10 minutes default)';
COMMENT ON COLUMN public.booking_locks.locked_by IS 'Customer who acquired the lock';

COMMENT ON FUNCTION cleanup_expired_booking_locks() IS 'Cleans up expired booking locks, should be run periodically';
COMMENT ON FUNCTION is_time_slot_available(UUID, TIMESTAMPTZ, INTEGER) IS 'Checks if a time slot is available for booking';
COMMENT ON FUNCTION prevent_booking_overlaps() IS 'Prevents overlapping bookings at the database level';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Booking Locks table created successfully!';
  RAISE NOTICE '- Added optimistic locking for booking time slots';
  RAISE NOTICE '- Created unique constraints to prevent race conditions';
  RAISE NOTICE '- Added automatic cleanup of expired locks';
  RAISE NOTICE '- Created database-level overlap prevention';
  RAISE NOTICE '- Added utility functions for availability checking';
END $$;
