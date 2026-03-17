import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdsOverview } from './useBrandaroAdsEngine';
import { useSEOOverview } from './useBrandaroSEO';
import { useReportingOverview } from './useBrandaroReporting';

export function useOptimizationLog() {
  return useQuery({
    queryKey: ['brandaro-optimization-log'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('brandaro_optimization_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useGlobalPerformance() {
  const ads = useAdsOverview();
  const seo = useSEOOverview();
  const reporting = useReportingOverview();
  const { data: optimizationLog = [] } = useOptimizationLog();

  const reportData = reporting.data;

  // Best performer detection
  const topInternalAds = [...ads.internalAds]
    .filter((a: any) => a.status === 'active')
    .sort((a: any, b: any) => Number(b.performance_score || 0) - Number(a.performance_score || 0))
    .slice(0, 5);

  const topClientAds = [...ads.clientAds]
    .filter((a: any) => a.status === 'active')
    .sort((a: any, b: any) => Number(b.roi_pct || 0) - Number(a.roi_pct || 0))
    .slice(0, 5);

  // Campaigns needing attention
  const highCPL = ads.internalAds.filter((a: any) =>
    a.status === 'active' && Number(a.cost_per_lead || 0) > Number(a.target_cpl || 25)
  );
  const negativeROI = ads.internalAds.filter((a: any) =>
    a.status === 'active' && Number(a.roi_pct || 0) < 0
  );
  const killSwitched = [
    ...ads.internalAds.filter((a: any) => a.kill_switch),
    ...ads.clientAds.filter((a: any) => a.kill_switch),
  ];

  // SEO winners
  const topSEOPages = [...seo.pages]
    .sort((a: any, b: any) => (b.clicks || 0) - (a.clicks || 0))
    .slice(0, 5);
  const lowPerformingSEO = seo.pages.filter((p: any) =>
    p.status === 'published' && (p.clicks || 0) < 5 && (p.impressions || 0) > 100
  );

  // Scalable campaigns (high ROI, low scaling level)
  const scalable = ads.internalAds.filter((a: any) =>
    a.status === 'active' &&
    Number(a.roi_pct || 0) > 100 &&
    Number(a.scaling_level || 1) < 5
  );

  // High quality leads
  const hotLeads = ads.adLeads
    .filter((l: any) => Number(l.lead_quality_score || 0) >= 50)
    .sort((a: any, b: any) => Number(b.lead_quality_score || 0) - Number(a.lead_quality_score || 0))
    .slice(0, 10);

  // Auto-generated recommendations
  const recommendations: { engine: string; type: string; text: string; priority: string }[] = [];

  scalable.forEach((c: any) => {
    recommendations.push({
      engine: 'ads', type: 'scale',
      text: `Scale "${c.campaign_name}" — ROI ${Number(c.roi_pct).toFixed(0)}%, level ${c.scaling_level}`,
      priority: 'high',
    });
  });

  highCPL.forEach((c: any) => {
    recommendations.push({
      engine: 'ads', type: 'alert',
      text: `High CPL on "${c.campaign_name}" — $${Number(c.cost_per_lead).toFixed(2)}/lead`,
      priority: 'high',
    });
  });

  negativeROI.forEach((c: any) => {
    recommendations.push({
      engine: 'ads', type: 'pause',
      text: `Pause "${c.campaign_name}" — negative ROI (${Number(c.roi_pct).toFixed(0)}%)`,
      priority: 'critical',
    });
  });

  lowPerformingSEO.forEach((p: any) => {
    recommendations.push({
      engine: 'seo', type: 'alert',
      text: `Refresh "${p.page_title || p.slug}" — ${p.impressions} impr but only ${p.clicks} clicks`,
      priority: 'medium',
    });
  });

  seo.topCities.slice(0, 3).forEach((city) => {
    recommendations.push({
      engine: 'seo', type: 'expand',
      text: `Expand SEO cluster in ${city} — high traffic potential`,
      priority: 'medium',
    });
  });

  // Revenue attribution summary
  const totalAdRevenue = ads.totalInternalRevenue + (reportData?.totalAdRevenue || 0);
  const totalSEOLeads = seo.pages.reduce((s: number, p: any) => s + (p.leads_generated || 0), 0);
  const totalMRR = ads.totalServiceFees + seo.seoMRR;

  return {
    topInternalAds, topClientAds, topSEOPages,
    highCPL, negativeROI, killSwitched, scalable,
    lowPerformingSEO, hotLeads,
    recommendations: recommendations.sort((a, b) => {
      const p: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return (p[a.priority] || 3) - (p[b.priority] || 3);
    }),
    optimizationLog,
    totalAdRevenue, totalSEOLeads, totalMRR,
    adsOverview: ads,
    seoOverview: seo,
    reportingOverview: reportData,
  };
}
