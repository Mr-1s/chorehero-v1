-- Add onboarding state tracking and role locking
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'customer_onboarding_state') THEN
    CREATE TYPE customer_onboarding_state AS ENUM (
      'PROSPECT',
      'IDENTITY_PENDING',
      'LOCATION_SET',
      'ACTIVE_CUSTOMER',
      'TRANSACTION_READY'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cleaner_onboarding_state') THEN
    CREATE TYPE cleaner_onboarding_state AS ENUM (
      'APPLICANT',
      'UNDER_REVIEW',
      'SERVICE_DEFINED',
      'PAYOUT_READY',
      'STAGING',
      'LIVE'
    );
  END IF;
END $$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS customer_onboarding_state customer_onboarding_state,
  ADD COLUMN IF NOT EXISTS customer_onboarding_step INTEGER,
  ADD COLUMN IF NOT EXISTS cleaner_onboarding_state cleaner_onboarding_state,
  ADD COLUMN IF NOT EXISTS cleaner_onboarding_step INTEGER,
  ADD COLUMN IF NOT EXISTS role_locked BOOLEAN DEFAULT false;

-- Default existing users to completed states (preserve current behavior)
UPDATE public.users
SET customer_onboarding_state = 'ACTIVE_CUSTOMER',
    customer_onboarding_step = 5,
    role_locked = true
WHERE role = 'customer' AND customer_onboarding_state IS NULL;

UPDATE public.users
SET cleaner_onboarding_state = 'LIVE',
    cleaner_onboarding_step = 6,
    role_locked = true
WHERE role = 'cleaner' AND cleaner_onboarding_state IS NULL;

CREATE OR REPLACE FUNCTION enforce_role_lock()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Lock role once onboarding state is set
    IF NEW.customer_onboarding_state IS NOT NULL OR NEW.cleaner_onboarding_state IS NOT NULL THEN
      NEW.role_locked := true;
    END IF;

    -- Prevent role switching when locked (allow service role for admin migration)
    IF OLD.role IS NOT NULL AND NEW.role IS DISTINCT FROM OLD.role AND NEW.role_locked IS TRUE THEN
      IF auth.role() IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Role is locked once onboarding begins';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_role_lock_trigger ON public.users;
CREATE TRIGGER enforce_role_lock_trigger
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION enforce_role_lock();
