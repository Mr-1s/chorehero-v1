-- ============================================================================
-- Communication & Reliability Support Tables
-- Supporting tables for Gaps #6, #7, #9, #25
-- ============================================================================

-- Table for multi-device session state synchronization (Gap #9)
CREATE TABLE IF NOT EXISTS public.user_session_states (
    device_id TEXT NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    app_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    sync_version INTEGER NOT NULL DEFAULT 1,
    last_active TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (device_id, user_id)
);

-- Table for message delivery tracking (Gap #6)
CREATE TABLE IF NOT EXISTS public.message_delivery_log (
    message_id TEXT PRIMARY KEY,
    room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN (
        'pending', 'sent', 'delivered', 'failed', 'retrying'
    )),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,
    error_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for location update queue (Gap #7)
CREATE TABLE IF NOT EXISTS public.location_update_queue (
    id TEXT PRIMARY KEY,
    cleaner_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(5, 2) DEFAULT 10.0,
    network_quality TEXT DEFAULT 'good' CHECK (network_quality IN ('good', 'poor', 'offline')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- Table for operation timeout tracking (Gap #25)
CREATE TABLE IF NOT EXISTS public.operation_tracking (
    operation_id TEXT PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    operation_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN (
        'running', 'completed', 'timeout', 'error', 'canceled'
    )),
    timeout_ms INTEGER NOT NULL,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 2,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Session state indexes
CREATE INDEX IF NOT EXISTS idx_session_states_user 
ON public.user_session_states(user_id, last_active DESC);

CREATE INDEX IF NOT EXISTS idx_session_states_sync_version 
ON public.user_session_states(user_id, sync_version DESC);

-- Message delivery indexes
CREATE INDEX IF NOT EXISTS idx_message_delivery_status 
ON public.message_delivery_log(delivery_status, created_at);

CREATE INDEX IF NOT EXISTS idx_message_delivery_failed 
ON public.message_delivery_log(created_at) 
WHERE delivery_status IN ('failed', 'retrying');

-- Location queue indexes
CREATE INDEX IF NOT EXISTS idx_location_queue_cleaner 
ON public.location_update_queue(cleaner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_location_queue_pending 
ON public.location_update_queue(status, created_at) 
WHERE status = 'pending';

-- Operation tracking indexes
CREATE INDEX IF NOT EXISTS idx_operation_tracking_user 
ON public.operation_tracking(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_operation_tracking_running 
ON public.operation_tracking(started_at) 
WHERE status = 'running';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.user_session_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_delivery_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_update_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_tracking ENABLE ROW LEVEL SECURITY;

-- Session states policies
CREATE POLICY "Users can manage their own session states" ON public.user_session_states
  FOR ALL USING (user_id = auth.uid());

-- Message delivery policies
CREATE POLICY "Users can view their message delivery status" ON public.message_delivery_log
  FOR SELECT USING (sender_id = auth.uid());

CREATE POLICY "System can manage message delivery" ON public.message_delivery_log
  FOR ALL USING (auth.role() = 'service_role');

-- Location queue policies
CREATE POLICY "Cleaners can manage their location updates" ON public.location_update_queue
  FOR ALL USING (cleaner_id = auth.uid());

-- Operation tracking policies
CREATE POLICY "Users can view their operations" ON public.operation_tracking
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can manage operations" ON public.operation_tracking
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- AUTOMATIC CLEANUP FUNCTIONS
-- ============================================================================

-- Clean up old session states (keep only last 5 per user)
CREATE OR REPLACE FUNCTION cleanup_old_session_states()
RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER := 0;
BEGIN
    -- Keep only the 5 most recent session states per user
    WITH ranked_sessions AS (
        SELECT device_id, user_id,
               ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY last_active DESC) as rn
        FROM public.user_session_states
    )
    DELETE FROM public.user_session_states
    WHERE (device_id, user_id) IN (
        SELECT device_id, user_id FROM ranked_sessions WHERE rn > 5
    );
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    RETURN cleaned_count;
END;
$$ language 'plpgsql';

-- Clean up delivered messages older than 24 hours
CREATE OR REPLACE FUNCTION cleanup_delivered_messages()
RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER := 0;
BEGIN
    DELETE FROM public.message_delivery_log
    WHERE delivery_status = 'delivered'
      AND delivered_at < NOW() - INTERVAL '24 hours';
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    RETURN cleaned_count;
END;
$$ language 'plpgsql';

-- Clean up processed location updates older than 1 hour
CREATE OR REPLACE FUNCTION cleanup_processed_locations()
RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER := 0;
BEGIN
    DELETE FROM public.location_update_queue
    WHERE status = 'sent'
      AND processed_at < NOW() - INTERVAL '1 hour';
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    RETURN cleaned_count;
END;
$$ language 'plpgsql';

-- Clean up completed operations older than 1 hour
CREATE OR REPLACE FUNCTION cleanup_completed_operations()
RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER := 0;
BEGIN
    DELETE FROM public.operation_tracking
    WHERE status IN ('completed', 'timeout', 'error', 'canceled')
      AND completed_at < NOW() - INTERVAL '1 hour';
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    RETURN cleaned_count;
END;
$$ language 'plpgsql';

-- Mark long-running operations as timed out
CREATE OR REPLACE FUNCTION timeout_stale_operations()
RETURNS INTEGER AS $$
DECLARE
    timed_out_count INTEGER := 0;
BEGIN
    UPDATE public.operation_tracking
    SET status = 'timeout',
        completed_at = NOW(),
        error_message = 'Operation timed out due to inactivity'
    WHERE status = 'running'
      AND started_at < NOW() - INTERVAL '1 minute' * (timeout_ms / 60000 + 5);
    
    GET DIAGNOSTICS timed_out_count = ROW_COUNT;
    RETURN timed_out_count;
END;
$$ language 'plpgsql';

-- ============================================================================
-- UPDATE TRIGGERS
-- ============================================================================

-- Update trigger for session states
CREATE OR REPLACE FUNCTION update_session_state_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER session_states_updated_at
    BEFORE UPDATE ON public.user_session_states
    FOR EACH ROW
    EXECUTE FUNCTION update_session_state_timestamp();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get pending messages for retry
CREATE OR REPLACE FUNCTION get_pending_message_retries(max_age_hours INTEGER DEFAULT 1)
RETURNS TABLE (
    message_id TEXT,
    room_id UUID,
    sender_id UUID,
    attempts INTEGER,
    last_attempt_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT mdl.message_id, mdl.room_id, mdl.sender_id, mdl.attempts, mdl.last_attempt_at
    FROM public.message_delivery_log mdl
    WHERE mdl.delivery_status IN ('failed', 'retrying')
      AND mdl.attempts < mdl.max_attempts
      AND mdl.created_at > NOW() - INTERVAL '1 hour' * max_age_hours;
END;
$$ language 'plpgsql';

-- Get pending location updates
CREATE OR REPLACE FUNCTION get_pending_location_updates()
RETURNS TABLE (
    id TEXT,
    cleaner_id UUID,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    accuracy DECIMAL(5, 2),
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT luq.id, luq.cleaner_id, luq.latitude, luq.longitude, luq.accuracy, luq.created_at
    FROM public.location_update_queue luq
    WHERE luq.status = 'pending'
      AND luq.attempts < 3
    ORDER BY luq.created_at;
END;
$$ language 'plpgsql';

-- Detect session conflicts
CREATE OR REPLACE FUNCTION detect_session_conflicts(
    p_user_id UUID,
    p_device_id TEXT,
    p_app_state JSONB
)
RETURNS TABLE (
    conflicting_device TEXT,
    conflicting_field TEXT,
    local_value TEXT,
    remote_value TEXT
) AS $$
BEGIN
    -- This is a simplified conflict detection
    -- In production, you'd have more sophisticated logic
    RETURN QUERY
    SELECT 
        uss.device_id,
        'booking_id'::TEXT,
        (p_app_state->>'current_booking_id')::TEXT,
        (uss.app_state->>'current_booking_id')::TEXT
    FROM public.user_session_states uss
    WHERE uss.user_id = p_user_id
      AND uss.device_id != p_device_id
      AND uss.app_state->>'current_booking_id' IS NOT NULL
      AND p_app_state->>'current_booking_id' IS NOT NULL
      AND uss.app_state->>'current_booking_id' != p_app_state->>'current_booking_id';
END;
$$ language 'plpgsql';

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.user_session_states IS 'Multi-device session synchronization for Gap #9';
COMMENT ON TABLE public.message_delivery_log IS 'Message delivery tracking and retry logic for Gap #6';
COMMENT ON TABLE public.location_update_queue IS 'Location update queue for network failures Gap #7';
COMMENT ON TABLE public.operation_tracking IS 'Operation timeout and loading state tracking for Gap #25';

COMMENT ON FUNCTION cleanup_old_session_states() IS 'Keeps only 5 most recent session states per user';
COMMENT ON FUNCTION cleanup_delivered_messages() IS 'Removes delivered messages older than 24 hours';
COMMENT ON FUNCTION timeout_stale_operations() IS 'Marks long-running operations as timed out';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Communication & Reliability tables created successfully!';
  RAISE NOTICE '- Multi-device session synchronization (Gap #9)';
  RAISE NOTICE '- Message delivery tracking (Gap #6)';
  RAISE NOTICE '- Location update queue (Gap #7)';
  RAISE NOTICE '- Operation timeout tracking (Gap #25)';
  RAISE NOTICE '- Automatic cleanup functions included';
  RAISE NOTICE '- RLS policies configured';
END $$;
