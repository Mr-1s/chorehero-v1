import { supabase } from './supabase';

export const proService = {
  async upsertService(input: {
    pro_id: string;
    service_id: string;
    is_active: boolean;
    pricing_type: 'fixed' | 'hourly' | 'quote';
    base_price?: number | null;
    hourly_rate?: number | null;
    custom_questions?: unknown[];
  }) {
    return supabase
      .from('pro_services')
      .upsert(
        {
          ...input,
          custom_questions: input.custom_questions ?? [],
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'pro_id,service_id' }
      )
      .select()
      .single();
  },
};
