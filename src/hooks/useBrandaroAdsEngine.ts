import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useInternalAds = () => {
  return useQuery({
    queryKey: ['brandaro-internal-ads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brandaro_internal_ads')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
};

export const useClientAds = () => {
  return useQuery({
    queryKey: ['brandaro-client-ads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brandaro_client_ads')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
};

export const useAdLeads = () => {
  return useQuery({
    queryKey: ['brandaro-ad-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brandaro_ad_leads')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
};

export const useAdsOverview = () => {
  const { data: internalAds = [] } = useInternalAds();
  const { data: clientAds = [] } = useClientAds();
  const { data: adLeads = [] } = useAdLeads();

  const activeInternal = internalAds.filter((a: any) => a.status === 'active');
  const activeClient = clientAds.filter((a: any) => a.status === 'active');

  const totalInternalSpend = activeInternal.reduce((s: number, a: any) => s + Number(a.total_spent || 0), 0);
  const totalInternalLeads = activeInternal.reduce((s: number, a: any) => s + Number(a.leads_generated || 0), 0);
  const totalInternalRevenue = activeInternal.reduce((s: number, a: any) => s + Number(a.revenue_generated || 0), 0);

  const totalClientSpend = activeClient.reduce((s: number, a: any) => s + Number(a.total_spent || 0), 0);
  const totalClientLeads = activeClient.reduce((s: number, a: any) => s + Number(a.leads_generated || 0), 0);
  const totalServiceFees = activeClient.reduce((s: number, a: any) => s + Number(a.service_fee || 0), 0);

  const inboundToday = adLeads.filter((l: any) => {
    const d = new Date(l.created_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  const conversionRate = adLeads.length > 0
    ? Math.round((adLeads.filter((l: any) => l.converted).length / adLeads.length) * 100)
    : 0;

  return {
    internalAds,
    clientAds,
    adLeads,
    totalInternalSpend,
    totalInternalLeads,
    totalInternalRevenue,
    totalClientSpend,
    totalClientLeads,
    totalServiceFees,
    inboundToday,
    conversionRate,
    activeInternalCount: activeInternal.length,
    activeClientCount: activeClient.length,
  };
};
