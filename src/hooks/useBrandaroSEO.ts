import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useSEOPages() {
  return useQuery({
    queryKey: ['brandaro-seo-pages'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('brandaro_seo_pages')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useSEOClusters() {
  return useQuery({
    queryKey: ['brandaro-seo-clusters'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('brandaro_seo_clusters')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useLocalRankings() {
  return useQuery({
    queryKey: ['brandaro-local-rankings'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('brandaro_local_rankings')
        .select('*')
        .order('rank_score', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useClientSEO() {
  return useQuery({
    queryKey: ['brandaro-client-seo'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('brandaro_client_seo')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useSEOOverview() {
  const { data: pages = [] } = useSEOPages();
  const { data: clusters = [] } = useSEOClusters();
  const { data: rankings = [] } = useLocalRankings();
  const { data: clientSeo = [] } = useClientSEO();

  const published = pages.filter((p: any) => p.status === 'published');
  const indexed = pages.filter((p: any) => p.indexed);
  const totalImpressions = pages.reduce((s: number, p: any) => s + (p.impressions || 0), 0);
  const totalClicks = pages.reduce((s: number, p: any) => s + (p.clicks || 0), 0);
  const activeClusters = clusters.filter((c: any) => c.status === 'active');
  const totalTrafficEst = clusters.reduce((s: number, c: any) => s + (c.traffic_estimate || 0), 0);
  const activeClientSeo = clientSeo.filter((c: any) => c.status === 'active');
  const seoMRR = activeClientSeo.reduce((s: number, c: any) => s + Number(c.service_fee || 0), 0);
  const topCities = [...new Set(pages.map((p: any) => p.city).filter(Boolean))].slice(0, 10) as string[];
  const topIndustries = [...new Set(pages.map((p: any) => p.industry).filter(Boolean))].slice(0, 10) as string[];

  return {
    pages, clusters, rankings, clientSeo,
    published: published.length,
    indexed: indexed.length,
    totalImpressions, totalClicks,
    activeClusters: activeClusters.length,
    totalTrafficEst, activeClientSeo: activeClientSeo.length,
    seoMRR, topCities, topIndustries,
  };
}
