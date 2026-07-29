import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

/**
 * Resolves the current portal customer from the REAL Supabase auth session.
 * Matches auth.user email/phone against crm_customers.
 * Redirects to /portal/login when there is no session.
 */
export function usePortalCustomerId() {
  const navigate = useNavigate();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) navigate('/portal/login');
        return;
      }
      const filters: string[] = [];
      if (user.email) filters.push(`email.eq.${user.email}`);
      if (user.phone) filters.push(`phone.eq.${user.phone}`);
      if (filters.length === 0) {
        if (!cancelled) { setLoading(false); navigate('/portal/login'); }
        return;
      }
      const { data, error } = await supabase
        .from('crm_customers')
        .select('id')
        .or(filters.join(','))
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setLoading(false);
        navigate('/portal/login');
        return;
      }
      setCustomerId(data.id);
      setLoading(false);
    };

    resolve();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate('/portal/login');
    });

    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, [navigate]);

  return { customerId, loading };
}
