import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

export interface ProServiceRow {
  id: string;
  pro_id: string;
  service_id: string;
  is_active: boolean;
  pricing_type: 'fixed' | 'hourly' | 'quote';
  base_price: number | null;
  hourly_rate: number | null;
}

export const useProServices = (proId?: string) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ProServiceRow[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!proId) return;
      setLoading(true);
      setError(null);
      const { data, error: e } = await supabase
        .from('pro_services')
        .select('id, pro_id, service_id, is_active, pricing_type, base_price, hourly_rate')
        .eq('pro_id', proId);
      if (!mounted) return;
      if (e) setError(e.message);
      else setRows((data || []) as ProServiceRow[]);
      setLoading(false);
    };
    load();
    return () => {
      mounted = false;
    };
  }, [proId]);

  return { loading, error, rows };
};
