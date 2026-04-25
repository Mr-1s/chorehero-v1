import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabase';
import { DynamicQuestion, ServiceConfigResult } from '../types/serviceTemplate';

const asQuestions = (raw: unknown): DynamicQuestion[] => {
  if (!Array.isArray(raw)) return [];
  return raw.filter((q): q is DynamicQuestion => {
    return !!q && typeof q === 'object' && typeof (q as DynamicQuestion).id === 'string' && typeof (q as DynamicQuestion).type === 'string';
  });
};

export const useServiceConfig = (serviceId?: string, proId?: string) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<ServiceConfigResult | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!serviceId) return;
      setLoading(true);
      setError(null);
      try {
        const { data: service, error: serviceError } = await supabase
          .from('services')
          .select('id, name, base_questions')
          .eq('id', serviceId)
          .single();
        if (serviceError || !service) throw new Error(serviceError?.message || 'Service not found');

        let proService: any = null;
        if (proId) {
          const { data } = await supabase
            .from('pro_services')
            .select('id, custom_questions, pricing_type, base_price, hourly_rate')
            .eq('service_id', serviceId)
            .eq('pro_id', proId)
            .eq('is_active', true)
            .maybeSingle();
          proService = data;
        }

        const mergedQuestions = [...asQuestions(service.base_questions), ...asQuestions(proService?.custom_questions)];
        const next: ServiceConfigResult = {
          serviceId: service.id,
          serviceName: service.name,
          proServiceId: proService?.id,
          pricingType: proService?.pricing_type,
          basePrice: proService?.base_price ?? undefined,
          hourlyRate: proService?.hourly_rate ?? undefined,
          questions: mergedQuestions,
        };
        if (mounted) setConfig(next);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Failed to load service config');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [serviceId, proId]);

  return useMemo(() => ({ loading, error, config }), [loading, error, config]);
};
