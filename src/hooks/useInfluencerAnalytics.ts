import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SocialAccount {
  id: string;
  platform: string;
  handle: string;
  profile_url: string | null;
  follower_count: number;
  following_count: number;
  verified: boolean;
  connection_status: string;
  last_synced_at: string | null;
}

export interface PostWithMetrics {
  id: string;
  platform: string | null;
  url: string | null;
  caption: string | null;
  posted_at: string | null;
  campaign_id: string;
  ai_summary: string | null;
  sentiment: string | null;
  metrics: {
    views?: number;
    impressions?: number;
    reach?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    saves?: number;
  } | null;
  campaign?: {
    name: string;
  };
}

export interface InfluencerMetricsAggregate {
  total_exposures: number;
  total_views: number;
  total_impressions: number;
  total_reach: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  total_saves: number;
  avg_engagement_rate: number;
  post_count: number;
  milestone_1m_reached_at: string | null;
  milestone_10m_reached_at: string | null;
  milestone_50m_reached_at: string | null;
  milestone_100m_reached_at: string | null;
}

export interface TrackingLink {
  id: string;
  link_name: string;
  tracking_url: string;
  clicks: number;
  conversions: number;
  campaign?: { name: string } | null;
}

export interface PromoCode {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  current_uses: number;
  total_revenue: number;
  status: string;
  campaign?: { name: string } | null;
}

export interface Payout {
  id: string;
  amount: number;
  currency: string;
  payout_type: string;
  status: string;
  paid_at: string | null;
  created_at: string;
  campaign?: { name: string } | null;
}

export function useInfluencerSocialAccounts(influencerId: string | undefined) {
  return useQuery({
    queryKey: ['influencer-social-accounts', influencerId],
    queryFn: async () => {
      if (!influencerId) return [];
      const { data, error } = await supabase
        .from('influencer_social_accounts')
        .select('*')
        .eq('influencer_id', influencerId)
        .order('platform');
      
      if (error) throw error;
      return data as SocialAccount[];
    },
    enabled: !!influencerId,
  });
}

export function useInfluencerPosts(influencerId: string | undefined) {
  return useQuery({
    queryKey: ['influencer-posts', influencerId],
    queryFn: async () => {
      if (!influencerId) return [];
      const { data, error } = await supabase
        .from('influencer_posts')
        .select(`
          *,
          campaign:influencer_campaigns(name)
        `)
        .eq('influencer_id', influencerId)
        .order('posted_at', { ascending: false });
      
      if (error) throw error;
      return data as PostWithMetrics[];
    },
    enabled: !!influencerId,
  });
}

export function useInfluencerMetricsAggregate(influencerId: string | undefined) {
  return useQuery({
    queryKey: ['influencer-metrics-aggregate', influencerId],
    queryFn: async () => {
      if (!influencerId) return null;
      const { data, error } = await supabase
        .from('influencer_metrics_aggregate')
        .select('*')
        .eq('influencer_id', influencerId)
        .maybeSingle();
      
      if (error) throw error;
      return data as InfluencerMetricsAggregate | null;
    },
    enabled: !!influencerId,
  });
}

export function useInfluencerTrackingLinks(influencerId: string | undefined) {
  return useQuery({
    queryKey: ['influencer-tracking-links', influencerId],
    queryFn: async () => {
      if (!influencerId) return [];
      const { data, error } = await supabase
        .from('influencer_tracking_links')
        .select(`
          *,
          campaign:influencer_campaigns(name)
        `)
        .eq('influencer_id', influencerId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as TrackingLink[];
    },
    enabled: !!influencerId,
  });
}

export function useInfluencerPromoCodes(influencerId: string | undefined) {
  return useQuery({
    queryKey: ['influencer-promo-codes', influencerId],
    queryFn: async () => {
      if (!influencerId) return [];
      const { data, error } = await supabase
        .from('influencer_promo_codes')
        .select(`
          *,
          campaign:influencer_campaigns(name)
        `)
        .eq('influencer_id', influencerId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as PromoCode[];
    },
    enabled: !!influencerId,
  });
}

export function useInfluencerPayouts(influencerId: string | undefined) {
  return useQuery({
    queryKey: ['influencer-payouts', influencerId],
    queryFn: async () => {
      if (!influencerId) return [];
      const { data, error } = await supabase
        .from('influencer_payouts')
        .select(`
          *,
          campaign:influencer_campaigns(name)
        `)
        .eq('influencer_id', influencerId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Payout[];
    },
    enabled: !!influencerId,
  });
}

// Global analytics across all influencers
export function useInfluencerGlobalAnalytics() {
  return useQuery({
    queryKey: ['influencer-global-analytics'],
    queryFn: async () => {
      // Get aggregate metrics
      const { data: aggregates, error: aggError } = await supabase
        .from('influencer_metrics_aggregate')
        .select('*');
      
      if (aggError) throw aggError;

      // Calculate totals
      const totals = (aggregates || []).reduce((acc, curr) => ({
        total_exposures: acc.total_exposures + (curr.total_exposures || 0),
        total_views: acc.total_views + (curr.total_views || 0),
        total_impressions: acc.total_impressions + (curr.total_impressions || 0),
        total_reach: acc.total_reach + (curr.total_reach || 0),
        total_likes: acc.total_likes + (curr.total_likes || 0),
        total_comments: acc.total_comments + (curr.total_comments || 0),
        total_shares: acc.total_shares + (curr.total_shares || 0),
        total_saves: acc.total_saves + (curr.total_saves || 0),
        post_count: acc.post_count + (curr.post_count || 0),
      }), {
        total_exposures: 0,
        total_views: 0,
        total_impressions: 0,
        total_reach: 0,
        total_likes: 0,
        total_comments: 0,
        total_shares: 0,
        total_saves: 0,
        post_count: 0,
      });

      // Get top performers by total exposures
      const topPerformers = [...(aggregates || [])]
        .sort((a, b) => (b.total_exposures || 0) - (a.total_exposures || 0))
        .slice(0, 10);

      // Get milestones
      const milestones = (aggregates || []).filter(a => 
        a.milestone_1m_reached_at || 
        a.milestone_10m_reached_at || 
        a.milestone_50m_reached_at || 
        a.milestone_100m_reached_at
      );

      // Get connection health
      const { data: connections, error: connError } = await supabase
        .from('influencer_social_accounts')
        .select('connection_status, platform');
      
      if (connError) throw connError;

      const connectionHealth = {
        connected: (connections || []).filter(c => c.connection_status === 'connected').length,
        needs_reconnect: (connections || []).filter(c => c.connection_status === 'needs_reconnect').length,
        disconnected: (connections || []).filter(c => c.connection_status === 'disconnected').length,
      };

      return {
        totals,
        topPerformers,
        milestones,
        connectionHealth,
        influencerCount: aggregates?.length || 0,
      };
    },
  });
}
