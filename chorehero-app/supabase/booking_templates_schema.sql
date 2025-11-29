-- Custom Booking Templates System
-- Allows cleaners to create personalized booking flows

-- Booking templates table - each cleaner can have multiple templates
CREATE TABLE IF NOT EXISTS public.booking_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cleaner_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- e.g., "Deep Clean Process", "Eco-Friendly Flow"
    description TEXT,
    is_active BOOLEAN DEFAULT false,
    is_default BOOLEAN DEFAULT false, -- Only one can be default per cleaner
    completion_rate DECIMAL(5,2) DEFAULT 0, -- Track how often customers complete this flow
    customer_rating DECIMAL(3,2) DEFAULT 0, -- Average rating for this template
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure only one default template per cleaner
    CONSTRAINT one_default_per_cleaner UNIQUE(cleaner_id, is_default) DEFERRABLE INITIALLY DEFERRED
);

-- Booking flow steps - customizable sequence for each template
CREATE TABLE IF NOT EXISTS public.booking_flow_steps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    template_id UUID REFERENCES public.booking_templates(id) ON DELETE CASCADE,
    step_type VARCHAR(50) NOT NULL, -- 'service_selection', 'custom_questions', 'scheduling', 'add_ons', 'contact_info', 'special_instructions', 'payment'
    step_title VARCHAR(100) NOT NULL,
    step_description TEXT,
    sort_order INTEGER NOT NULL,
    is_required BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    configuration JSONB, -- Store step-specific config
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(template_id, step_type),
    UNIQUE(template_id, sort_order)
);

-- Custom questions that cleaners can add to their booking flow
CREATE TABLE IF NOT EXISTS public.custom_booking_questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    template_id UUID REFERENCES public.booking_templates(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(20) NOT NULL, -- 'text', 'textarea', 'single_choice', 'multiple_choice', 'yes_no', 'number', 'date'
    is_required BOOLEAN DEFAULT false,
    sort_order INTEGER NOT NULL,
    options JSONB, -- For choice questions: ["Option 1", "Option 2"]
    placeholder_text VARCHAR(200),
    help_text TEXT,
    validation_rules JSONB, -- {"min_length": 10, "max_length": 500}
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(template_id, sort_order)
);

-- Cleaner-specific add-ons for their templates
CREATE TABLE IF NOT EXISTS public.cleaner_template_addons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    template_id UUID REFERENCES public.booking_templates(id) ON DELETE CASCADE,
    addon_name VARCHAR(100) NOT NULL,
    addon_description TEXT,
    price DECIMAL(8,2) NOT NULL,
    duration_minutes INTEGER DEFAULT 0,
    category VARCHAR(50), -- 'appliances', 'specialty', 'convenience', 'products'
    is_popular BOOLEAN DEFAULT false,
    sort_order INTEGER NOT NULL,
    icon_name VARCHAR(50), -- For UI icons
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(template_id, sort_order)
);

-- Track customer responses to custom questions
CREATE TABLE IF NOT EXISTS public.booking_question_responses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.custom_booking_questions(id) ON DELETE CASCADE,
    response_text TEXT,
    response_json JSONB, -- For complex answers (multiple choice, etc.)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(booking_id, question_id)
);

-- Booking template analytics for cleaners
CREATE TABLE IF NOT EXISTS public.booking_template_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    template_id UUID REFERENCES public.booking_templates(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    views_count INTEGER DEFAULT 0,
    started_count INTEGER DEFAULT 0,
    completed_count INTEGER DEFAULT 0,
    abandoned_at_step VARCHAR(50), -- Track where customers drop off
    average_completion_time INTEGER, -- in minutes
    total_revenue DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(template_id, date)
);

-- Cleaner booking preferences
CREATE TABLE IF NOT EXISTS public.cleaner_booking_preferences (
    cleaner_id UUID REFERENCES public.users(id) ON DELETE CASCADE PRIMARY KEY,
    minimum_booking_hours DECIMAL(3,1) DEFAULT 1.0,
    advance_notice_hours INTEGER DEFAULT 24,
    same_day_booking_allowed BOOLEAN DEFAULT false,
    weekend_availability BOOLEAN DEFAULT true,
    evening_availability BOOLEAN DEFAULT false, -- After 6 PM
    cancellation_policy TEXT,
    requires_consultation BOOLEAN DEFAULT false, -- For deep cleans, etc.
    auto_accept_bookings BOOLEAN DEFAULT false,
    custom_cancellation_fee DECIMAL(8,2),
    travel_fee_per_mile DECIMAL(5,2) DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_booking_templates_cleaner_active ON public.booking_templates(cleaner_id, is_active);
CREATE INDEX IF NOT EXISTS idx_booking_flow_steps_template_order ON public.booking_flow_steps(template_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_custom_questions_template_order ON public.custom_booking_questions(template_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_template_addons_template_order ON public.cleaner_template_addons(template_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_booking_analytics_template_date ON public.booking_template_analytics(template_id, date);

-- RLS Policies
ALTER TABLE public.booking_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_flow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_booking_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaner_template_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_question_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_template_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaner_booking_preferences ENABLE ROW LEVEL SECURITY;

-- Cleaners can manage their own templates
CREATE POLICY "Cleaners can manage their booking templates" ON public.booking_templates
    FOR ALL USING (
        auth.uid() IN (
            SELECT id FROM public.users WHERE id = cleaner_id AND role = 'cleaner'
        )
    );

-- Customers can view active templates when booking
CREATE POLICY "Customers can view active booking templates" ON public.booking_templates
    FOR SELECT USING (is_active = true);

-- Similar policies for related tables
CREATE POLICY "Cleaners can manage their flow steps" ON public.booking_flow_steps
    FOR ALL USING (
        auth.uid() IN (
            SELECT bt.cleaner_id FROM public.booking_templates bt WHERE bt.id = template_id
        )
    );

CREATE POLICY "Customers can view active flow steps" ON public.booking_flow_steps
    FOR SELECT USING (
        template_id IN (
            SELECT id FROM public.booking_templates WHERE is_active = true
        )
    );

CREATE POLICY "Cleaners can manage their custom questions" ON public.custom_booking_questions
    FOR ALL USING (
        auth.uid() IN (
            SELECT bt.cleaner_id FROM public.booking_templates bt WHERE bt.id = template_id
        )
    );

CREATE POLICY "Customers can view active custom questions" ON public.custom_booking_questions
    FOR SELECT USING (
        template_id IN (
            SELECT id FROM public.booking_templates WHERE is_active = true
        )
    );

CREATE POLICY "Cleaners can manage their template addons" ON public.cleaner_template_addons
    FOR ALL USING (
        auth.uid() IN (
            SELECT bt.cleaner_id FROM public.booking_templates bt WHERE bt.id = template_id
        )
    );

CREATE POLICY "Customers can view active template addons" ON public.cleaner_template_addons
    FOR SELECT USING (
        template_id IN (
            SELECT id FROM public.booking_templates WHERE is_active = true
        )
    );

-- Question responses - customers can create, cleaners can view their bookings' responses
CREATE POLICY "Customers can create question responses" ON public.booking_question_responses
    FOR INSERT WITH CHECK (
        auth.uid() IN (
            SELECT customer_id FROM public.bookings WHERE id = booking_id
        )
    );

CREATE POLICY "Cleaners can view responses to their bookings" ON public.booking_question_responses
    FOR SELECT USING (
        auth.uid() IN (
            SELECT cleaner_id FROM public.bookings WHERE id = booking_id
        )
    );

-- Analytics - only cleaners can view their own analytics
CREATE POLICY "Cleaners can view their template analytics" ON public.booking_template_analytics
    FOR ALL USING (
        auth.uid() IN (
            SELECT bt.cleaner_id FROM public.booking_templates bt WHERE bt.id = template_id
        )
    );

-- Booking preferences - cleaners manage their own
CREATE POLICY "Cleaners can manage their booking preferences" ON public.cleaner_booking_preferences
    FOR ALL USING (auth.uid() = cleaner_id);

-- Functions to automatically create default template for new cleaners
CREATE OR REPLACE FUNCTION create_default_booking_template()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create for cleaners
    IF NEW.role = 'cleaner' THEN
        -- Create default template
        INSERT INTO public.booking_templates (
            cleaner_id, 
            name, 
            description, 
            is_active, 
            is_default
        ) VALUES (
            NEW.id,
            'Standard Cleaning Process',
            'My professional cleaning service with proven results',
            true,
            true
        );
        
        -- Create default booking preferences
        INSERT INTO public.cleaner_booking_preferences (cleaner_id) 
        VALUES (NEW.id)
        ON CONFLICT (cleaner_id) DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create default template for new cleaners
CREATE TRIGGER create_default_template_trigger
    AFTER INSERT ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_booking_template();

-- Function to update template analytics
CREATE OR REPLACE FUNCTION update_template_analytics(
    p_template_id UUID,
    p_action VARCHAR(20) -- 'view', 'start', 'complete', 'abandon'
)
RETURNS VOID AS $$
DECLARE
    today_date DATE := CURRENT_DATE;
BEGIN
    -- Insert or update analytics for today
    INSERT INTO public.booking_template_analytics (template_id, date, views_count, started_count, completed_count)
    VALUES (p_template_id, today_date, 
            CASE WHEN p_action = 'view' THEN 1 ELSE 0 END,
            CASE WHEN p_action = 'start' THEN 1 ELSE 0 END,
            CASE WHEN p_action = 'complete' THEN 1 ELSE 0 END
    )
    ON CONFLICT (template_id, date) 
    DO UPDATE SET
        views_count = public.booking_template_analytics.views_count + 
                     CASE WHEN p_action = 'view' THEN 1 ELSE 0 END,
        started_count = public.booking_template_analytics.started_count + 
                       CASE WHEN p_action = 'start' THEN 1 ELSE 0 END,
        completed_count = public.booking_template_analytics.completed_count + 
                         CASE WHEN p_action = 'complete' THEN 1 ELSE 0 END;
END;
$$ LANGUAGE plpgsql;

-- Sample default flow steps for new templates
INSERT INTO public.booking_flow_steps (template_id, step_type, step_title, step_description, sort_order, configuration)
SELECT 
    bt.id,
    step_data.step_type,
    step_data.step_title,
    step_data.step_description,
    step_data.sort_order,
    step_data.configuration::jsonb
FROM public.booking_templates bt
CROSS JOIN (
    VALUES 
    ('service_selection', 'Choose Your Service', 'Select the type of cleaning service you need', 1, '{"allow_multiple": false, "show_duration": true}'),
    ('custom_questions', 'Tell Me About Your Space', 'Help me provide the best service for your needs', 2, '{"skip_if_empty": true}'),
    ('scheduling', 'Pick Your Time', 'Select your preferred date and time', 3, '{"show_availability": true, "allow_recurring": true}'),
    ('add_ons', 'Extra Services', 'Add any additional services you need', 4, '{"skip_if_empty": true, "show_popular": true}'),
    ('contact_info', 'Contact & Access', 'Provide contact details and access information', 5, '{"require_phone": true}'),
    ('payment', 'Secure Payment', 'Complete your booking with secure payment', 6, '{"save_payment_method": true}')
) AS step_data(step_type, step_title, step_description, sort_order, configuration)
WHERE bt.name = 'Standard Cleaning Process'
AND NOT EXISTS (
    SELECT 1 FROM public.booking_flow_steps bfs 
    WHERE bfs.template_id = bt.id AND bfs.step_type = step_data.step_type
);

-- Grant permissions
GRANT ALL ON public.booking_templates TO authenticated;
GRANT ALL ON public.booking_flow_steps TO authenticated;
GRANT ALL ON public.custom_booking_questions TO authenticated;
GRANT ALL ON public.cleaner_template_addons TO authenticated;
GRANT ALL ON public.booking_question_responses TO authenticated;
GRANT ALL ON public.booking_template_analytics TO authenticated;
GRANT ALL ON public.cleaner_booking_preferences TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
