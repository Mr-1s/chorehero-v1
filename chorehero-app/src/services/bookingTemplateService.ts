import { supabase } from './supabase';

// Types for booking template system
export interface BookingTemplate {
  id: string;
  cleaner_id: string;
  name: string;
  description: string;
  is_active: boolean;
  is_default: boolean;
  completion_rate: number;
  customer_rating: number;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface BookingFlowStep {
  id: string;
  template_id: string;
  step_type: 'service_selection' | 'custom_questions' | 'scheduling' | 'add_ons' | 'contact_info' | 'special_instructions' | 'payment';
  step_title: string;
  step_description: string;
  sort_order: number;
  is_required: boolean;
  is_active: boolean;
  configuration: Record<string, any>;
  created_at: string;
}

export interface CustomBookingQuestion {
  id: string;
  template_id: string;
  question_text: string;
  question_type: 'text' | 'textarea' | 'single_choice' | 'multiple_choice' | 'yes_no' | 'number' | 'date';
  is_required: boolean;
  sort_order: number;
  options?: string[];
  placeholder_text?: string;
  help_text?: string;
  validation_rules?: Record<string, any>;
  created_at: string;
}

export interface CleanerTemplateAddon {
  id: string;
  template_id: string;
  addon_name: string;
  addon_description: string;
  price: number;
  duration_minutes: number;
  category: 'appliances' | 'specialty' | 'convenience' | 'products';
  is_popular: boolean;
  sort_order: number;
  icon_name?: string;
  created_at: string;
}

export interface BookingTemplateAnalytics {
  id: string;
  template_id: string;
  date: string;
  views_count: number;
  started_count: number;
  completed_count: number;
  abandoned_at_step?: string;
  average_completion_time?: number;
  total_revenue: number;
}

export interface CleanerBookingPreferences {
  cleaner_id: string;
  minimum_booking_hours: number;
  advance_notice_hours: number;
  same_day_booking_allowed: boolean;
  weekend_availability: boolean;
  evening_availability: boolean;
  cancellation_policy?: string;
  requires_consultation: boolean;
  auto_accept_bookings: boolean;
  custom_cancellation_fee?: number;
  travel_fee_per_mile: number;
  updated_at: string;
}

export interface BookingQuestionResponse {
  id: string;
  booking_id: string;
  question_id: string;
  response_text?: string;
  response_json?: any;
  created_at: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

class BookingTemplateService {
  /**
   * Get all templates for a cleaner
   */
  async getCleanerTemplates(cleanerId: string): Promise<ApiResponse<BookingTemplate[]>> {
    try {
      const { data, error } = await supabase
        .from('booking_templates')
        .select('*')
        .eq('cleaner_id', cleanerId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error fetching cleaner templates:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch templates' 
      };
    }
  }

  /**
   * Get active template for a cleaner
   */
  async getActiveTemplate(cleanerId: string): Promise<ApiResponse<BookingTemplate>> {
    // Validate cleanerId before making the query
    if (!cleanerId || cleanerId === 'undefined' || cleanerId === 'null') {
      return { success: true, data: null as any };
    }
    
    // Check if it's a valid UUID format
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanerId);
    if (!isUuid) {
      return { success: true, data: null as any };
    }
    
    try {
      const { data, error } = await supabase
        .from('booking_templates')
        .select('*')
        .eq('cleaner_id', cleanerId)
        .eq('is_active', true)
        .eq('is_default', true)
        .maybeSingle(); // Use maybeSingle to return null instead of error when no rows

      if (error) throw error;

      // No template found is not an error - just return success with null data
      if (!data) {
        return { success: true, data: null as any };
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error fetching active template:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch template' 
      };
    }
  }

  /**
   * Create a new booking template
   */
  async createTemplate(
    cleanerId: string, 
    templateData: Partial<BookingTemplate>
  ): Promise<ApiResponse<BookingTemplate>> {
    try {
      const { data, error } = await supabase
        .from('booking_templates')
        .insert({
          cleaner_id: cleanerId,
          name: templateData.name,
          description: templateData.description,
          is_active: templateData.is_active ?? false,
          is_default: templateData.is_default ?? false,
        })
        .select()
        .single();

      if (error) throw error;

      // Create default flow steps
      await this.createDefaultFlowSteps(data.id);

      return { success: true, data };
    } catch (error) {
      console.error('Error creating template:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create template' 
      };
    }
  }

  /**
   * Update a booking template
   */
  async updateTemplate(
    templateId: string, 
    updates: Partial<BookingTemplate>
  ): Promise<ApiResponse<BookingTemplate>> {
    try {
      const { data, error } = await supabase
        .from('booking_templates')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', templateId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('Error updating template:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update template' 
      };
    }
  }

  /**
   * Get flow steps for a template
   */
  async getTemplateFlowSteps(templateId: string): Promise<ApiResponse<BookingFlowStep[]>> {
    try {
      const { data, error } = await supabase
        .from('booking_flow_steps')
        .select('*')
        .eq('template_id', templateId)
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error fetching flow steps:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch flow steps' 
      };
    }
  }

  /**
   * Update flow steps for a template
   */
  async updateFlowSteps(
    templateId: string, 
    steps: Partial<BookingFlowStep>[]
  ): Promise<ApiResponse<BookingFlowStep[]>> {
    try {
      // Delete existing steps
      await supabase
        .from('booking_flow_steps')
        .delete()
        .eq('template_id', templateId);

      // Insert new steps
      const { data, error } = await supabase
        .from('booking_flow_steps')
        .insert(
          steps.map((step, index) => ({
            template_id: templateId,
            step_type: step.step_type,
            step_title: step.step_title,
            step_description: step.step_description,
            sort_order: index + 1,
            is_required: step.is_required ?? true,
            is_active: step.is_active ?? true,
            configuration: step.configuration || {},
          }))
        )
        .select();

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error updating flow steps:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update flow steps' 
      };
    }
  }

  /**
   * Get custom questions for a template
   */
  async getTemplateQuestions(templateId: string): Promise<ApiResponse<CustomBookingQuestion[]>> {
    // Validate templateId before making the query
    if (!templateId || templateId === 'undefined' || templateId === 'null') {
      return { success: true, data: [] };
    }
    
    // Check if it's a valid UUID format
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(templateId);
    if (!isUuid) {
      return { success: true, data: [] };
    }
    
    try {
      const { data, error } = await supabase
        .from('custom_booking_questions')
        .select('*')
        .eq('template_id', templateId)
        .order('sort_order');

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error fetching custom questions:', error);
      return { 
        success: false, 
        data: [], // Always return empty array on error
        error: error instanceof Error ? error.message : 'Failed to fetch questions' 
      };
    }
  }

  /**
   * Add custom question to template
   */
  async addCustomQuestion(
    templateId: string, 
    question: Partial<CustomBookingQuestion>
  ): Promise<ApiResponse<CustomBookingQuestion>> {
    try {
      const { data, error } = await supabase
        .from('custom_booking_questions')
        .insert({
          template_id: templateId,
          question_text: question.question_text,
          question_type: question.question_type,
          is_required: question.is_required ?? false,
          sort_order: question.sort_order ?? 1,
          options: question.options,
          placeholder_text: question.placeholder_text,
          help_text: question.help_text,
          validation_rules: question.validation_rules,
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('Error adding custom question:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to add question' 
      };
    }
  }

  /**
   * Get template add-ons
   */
  async getTemplateAddons(templateId: string): Promise<ApiResponse<CleanerTemplateAddon[]>> {
    try {
      const { data, error } = await supabase
        .from('cleaner_template_addons')
        .select('*')
        .eq('template_id', templateId)
        .order('sort_order');

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error fetching template addons:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch addons' 
      };
    }
  }

  /**
   * Add custom addon to template
   */
  async addTemplateAddon(
    templateId: string, 
    addon: Partial<CleanerTemplateAddon>
  ): Promise<ApiResponse<CleanerTemplateAddon>> {
    try {
      const { data, error } = await supabase
        .from('cleaner_template_addons')
        .insert({
          template_id: templateId,
          addon_name: addon.addon_name,
          addon_description: addon.addon_description,
          price: addon.price,
          duration_minutes: addon.duration_minutes ?? 0,
          category: addon.category,
          is_popular: addon.is_popular ?? false,
          sort_order: addon.sort_order ?? 1,
          icon_name: addon.icon_name,
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('Error adding template addon:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to add addon' 
      };
    }
  }

  /**
   * Get booking preferences for cleaner
   */
  async getBookingPreferences(cleanerId: string): Promise<ApiResponse<CleanerBookingPreferences>> {
    try {
      const { data, error } = await supabase
        .from('cleaner_booking_preferences')
        .select('*')
        .eq('cleaner_id', cleanerId)
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('Error fetching booking preferences:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'No preferences found' 
      };
    }
  }

  /**
   * Update booking preferences
   */
  async updateBookingPreferences(
    cleanerId: string, 
    preferences: Partial<CleanerBookingPreferences>
  ): Promise<ApiResponse<CleanerBookingPreferences>> {
    try {
      const { data, error } = await supabase
        .from('cleaner_booking_preferences')
        .upsert({
          cleaner_id: cleanerId,
          ...preferences,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('Error updating booking preferences:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update preferences' 
      };
    }
  }

  /**
   * Get template analytics
   */
  async getTemplateAnalytics(
    templateId: string, 
    days: number = 30
  ): Promise<ApiResponse<BookingTemplateAnalytics[]>> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('booking_template_analytics')
        .select('*')
        .eq('template_id', templateId)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error fetching template analytics:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch analytics' 
      };
    }
  }

  /**
   * Track template analytics
   */
  async trackTemplateAction(
    templateId: string, 
    action: 'view' | 'start' | 'complete' | 'abandon'
  ): Promise<void> {
    try {
      await supabase.rpc('update_template_analytics', {
        p_template_id: templateId,
        p_action: action,
      });
    } catch (error) {
      console.error('Error tracking template action:', error);
    }
  }

  /**
   * Clone template (for creating variations)
   */
  async cloneTemplate(
    originalTemplateId: string, 
    newName: string
  ): Promise<ApiResponse<BookingTemplate>> {
    try {
      // Get original template
      const { data: original } = await supabase
        .from('booking_templates')
        .select('*')
        .eq('id', originalTemplateId)
        .single();

      if (!original) throw new Error('Original template not found');

      // Create new template
      const { data: newTemplate, error: templateError } = await supabase
        .from('booking_templates')
        .insert({
          cleaner_id: original.cleaner_id,
          name: newName,
          description: `Copy of ${original.description}`,
          is_active: false,
          is_default: false,
        })
        .select()
        .single();

      if (templateError) throw templateError;

      // Clone flow steps
      const { data: steps } = await supabase
        .from('booking_flow_steps')
        .select('*')
        .eq('template_id', originalTemplateId);

      if (steps?.length) {
        const { error: stepsError } = await supabase
          .from('booking_flow_steps')
          .insert(
            steps.map(step => ({
              template_id: newTemplate.id,
              step_type: step.step_type,
              step_title: step.step_title,
              step_description: step.step_description,
              sort_order: step.sort_order,
              is_required: step.is_required,
              is_active: step.is_active,
              configuration: step.configuration,
            }))
          );

        if (stepsError) throw stepsError;
      }

      // Clone custom questions
      const { data: questions } = await supabase
        .from('custom_booking_questions')
        .select('*')
        .eq('template_id', originalTemplateId);

      if (questions?.length) {
        await supabase
          .from('custom_booking_questions')
          .insert(
            questions.map(q => ({
              template_id: newTemplate.id,
              question_text: q.question_text,
              question_type: q.question_type,
              is_required: q.is_required,
              sort_order: q.sort_order,
              options: q.options,
              placeholder_text: q.placeholder_text,
              help_text: q.help_text,
              validation_rules: q.validation_rules,
            }))
          );
      }

      // Clone addons
      const { data: addons } = await supabase
        .from('cleaner_template_addons')
        .select('*')
        .eq('template_id', originalTemplateId);

      if (addons?.length) {
        await supabase
          .from('cleaner_template_addons')
          .insert(
            addons.map(addon => ({
              template_id: newTemplate.id,
              addon_name: addon.addon_name,
              addon_description: addon.addon_description,
              price: addon.price,
              duration_minutes: addon.duration_minutes,
              category: addon.category,
              is_popular: addon.is_popular,
              sort_order: addon.sort_order,
              icon_name: addon.icon_name,
            }))
          );
      }

      return { success: true, data: newTemplate };
    } catch (error) {
      console.error('Error cloning template:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to clone template' 
      };
    }
  }

  /**
   * Create default flow steps for a new template
   */
  private async createDefaultFlowSteps(templateId: string): Promise<void> {
    const defaultSteps = [
      {
        step_type: 'service_selection' as const,
        step_title: 'Choose Your Service',
        step_description: 'Select the type of cleaning service you need',
        sort_order: 1,
        configuration: { allow_multiple: false, show_duration: true },
      },
      {
        step_type: 'scheduling' as const,
        step_title: 'Pick Your Time',
        step_description: 'Select your preferred date and time',
        sort_order: 2,
        configuration: { show_availability: true, allow_recurring: true },
      },
      {
        step_type: 'contact_info' as const,
        step_title: 'Contact & Access',
        step_description: 'Provide contact details and access information',
        sort_order: 3,
        configuration: { require_phone: true },
      },
      {
        step_type: 'payment' as const,
        step_title: 'Secure Payment',
        step_description: 'Complete your booking with secure payment',
        sort_order: 4,
        configuration: { save_payment_method: true },
      },
    ];

    await supabase
      .from('booking_flow_steps')
      .insert(
        defaultSteps.map(step => ({
          template_id: templateId,
          ...step,
          is_required: true,
          is_active: true,
        }))
      );
  }
}

export const bookingTemplateService = new BookingTemplateService();
