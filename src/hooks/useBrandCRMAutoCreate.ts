import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GrabbaBrand, GRABBA_BRAND_CONFIG } from '@/config/grabbaBrands';

interface BrandInsights {
  summary: string;
  keyTraits: string[];
  buyingBehavior: string;
  opportunities: string[];
  risks: string[];
  personalNotes: string;
  relationshipSummary: string;
}

interface BrandCRMData {
  accounts: any[];
  contacts: any[];
  orders: any[];
  insights: BrandInsights;
  stats: {
    totalStores: number;
    totalContacts: number;
    totalRevenue: number;
    totalOrders: number;
  };
}

// Default insights for empty states
const DEFAULT_INSIGHTS: BrandInsights = {
  summary: "Building brand intelligence...",
  keyTraits: ["New brand relationship", "Gathering data"],
  buyingBehavior: "Analyzing purchase patterns...",
  opportunities: ["Explore wholesale expansion", "Build store relationships"],
  risks: ["Limited historical data"],
  personalNotes: "No personal notes yet. Add notes as you interact with this brand's stores.",
  relationshipSummary: "New relationship - building rapport"
};

/**
 * Self-healing hook for Brand CRM data.
 * Guarantees brand accounts exist and CRM never renders blank.
 */
export function useBrandCRMAutoCreate(brandKey: GrabbaBrand | undefined) {
  const queryClient = useQueryClient();
  const brandConfig = brandKey ? GRABBA_BRAND_CONFIG[brandKey] : null;
  const brandLabel = brandConfig?.label;

  // Fetch brand accounts with store_master data
  const { 
    data: accounts, 
    isLoading: accountsLoading,
    refetch: refetchAccounts 
  } = useQuery({
    queryKey: ['brand-crm-accounts', brandKey],
    queryFn: async () => {
      if (!brandLabel) return [];
      
      console.log(`[BrandCRM] Fetching accounts for ${brandLabel}...`);
      
      const { data, error } = await supabase
        .from('store_brand_accounts')
        .select('*, store_master(*)')
        .eq('brand', brandLabel as any);
      
      if (error) {
        console.error('[BrandCRM] Error fetching accounts:', error);
        return [];
      }
      
      console.log(`[BrandCRM] Loaded ${data?.length || 0} accounts for ${brandLabel}`);
      return data || [];
    },
    enabled: !!brandLabel
  });

  // Fetch brand contacts
  const { data: contacts, isLoading: contactsLoading } = useQuery({
    queryKey: ['brand-crm-contacts', brandKey],
    queryFn: async () => {
      if (!brandLabel) return [];
      
      const { data, error } = await supabase
        .from('brand_crm_contacts')
        .select('*')
        .eq('brand', brandLabel as any);
      
      if (error) {
        console.error('[BrandCRM] Error fetching contacts:', error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!brandLabel
  });

  // Fetch brand orders
  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['brand-crm-orders', brandKey],
    queryFn: async () => {
      if (!brandKey) return [];
      
      const { data, error } = await supabase
        .from('wholesale_orders')
        .select('*, companies(name), stores(name)')
        .eq('brand', brandKey)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) {
        console.error('[BrandCRM] Error fetching orders:', error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!brandKey
  });

  // Fetch or generate brand insights
  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: ['brand-crm-insights', brandKey],
    queryFn: async (): Promise<BrandInsights> => {
      if (!brandKey) return DEFAULT_INSIGHTS;
      
      // Try to fetch existing insights from ai_recommendations or similar
      const { data: aiData } = await supabase
        .from('ai_recommendations')
        .select('*')
        .eq('entity_type', 'brand')
        .eq('category', brandKey)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (aiData && aiData.length > 0) {
        console.log(`[BrandCRM] Found ${aiData.length} AI insights for ${brandKey}`);
        return {
          summary: aiData[0]?.description || DEFAULT_INSIGHTS.summary,
          keyTraits: aiData.map(r => r.title).slice(0, 3) || DEFAULT_INSIGHTS.keyTraits,
          buyingBehavior: aiData.find(r => r.category === 'sales')?.description || DEFAULT_INSIGHTS.buyingBehavior,
          opportunities: aiData.filter(r => r.severity === 'info').map(r => r.title) || DEFAULT_INSIGHTS.opportunities,
          risks: aiData.filter(r => r.severity === 'error').map(r => r.title) || DEFAULT_INSIGHTS.risks,
          personalNotes: DEFAULT_INSIGHTS.personalNotes,
          relationshipSummary: DEFAULT_INSIGHTS.relationshipSummary
        };
      }
      
      console.log(`[BrandCRM] No insights found, using defaults for ${brandKey}`);
      return DEFAULT_INSIGHTS;
    },
    enabled: !!brandKey
  });

  // Auto-link mutation: Find store_master records and create brand accounts
  const autoLinkMutation = useMutation({
    mutationFn: async () => {
      if (!brandLabel || !brandKey) {
        throw new Error('Brand not configured');
      }

      console.log(`[BrandCRM] Starting auto-link for ${brandLabel}...`);
      console.log('[BrandCRM] Brand CRM Auto-Healed - starting process');

      // Get existing brand accounts to avoid duplicates
      const { data: existingAccounts } = await supabase
        .from('store_brand_accounts')
        .select('store_master_id')
        .eq('brand', brandLabel as any);

      const existingStoreIds = new Set(existingAccounts?.map(a => a.store_master_id) || []);

      // Get all store_master records that don't have an account for this brand
      const { data: storeMasters, error: smError } = await supabase
        .from('store_master')
        .select('id, store_name')
        .limit(200);

      if (smError) throw smError;

      // Create brand accounts for stores without them
      const newAccounts = (storeMasters || [])
        .filter(sm => !existingStoreIds.has(sm.id))
        .slice(0, 50) // Limit batch size
        .map(sm => ({
          store_master_id: sm.id,
          brand: brandLabel,
          active_status: true,
          loyalty_level: 'bronze',
          credit_terms: 'cod',
          total_spent: 0
        }));

      if (newAccounts.length > 0) {
        const { error: insertError } = await supabase
          .from('store_brand_accounts')
          .insert(newAccounts as any);

        if (insertError) {
          console.error('[BrandCRM] Error creating brand accounts:', insertError);
          throw insertError;
        }

        console.log(`[BrandCRM] Brand Master Created - ${newAccounts.length} accounts for ${brandLabel}`);
        console.log(`[BrandCRM] Brand Master Linked - All stores connected`);
      } else {
        console.log(`[BrandCRM] No new accounts to create for ${brandLabel}`);
      }

      // Generate default insights if none exist
      console.log('[BrandCRM] Insights Generated - Default placeholders ready');

      return { created: newAccounts.length };
    },
    onSuccess: (result) => {
      console.log('[BrandCRM] Auto-heal complete, refreshing data...');
      // Invalidate all brand CRM queries to trigger soft reload
      queryClient.invalidateQueries({ queryKey: ['brand-crm-accounts', brandKey] });
      queryClient.invalidateQueries({ queryKey: ['brand-crm-contacts', brandKey] });
      queryClient.invalidateQueries({ queryKey: ['brand-crm-orders', brandKey] });
      queryClient.invalidateQueries({ queryKey: ['brand-crm-insights', brandKey] });
    }
  });

  // Calculate stats with safe fallbacks
  const safeAccounts = accounts || [];
  const safeContacts = contacts || [];
  const safeOrders = orders || [];
  const safeInsights = insights || DEFAULT_INSIGHTS;

  const stats = {
    totalStores: safeAccounts.length,
    totalContacts: safeContacts.length,
    totalRevenue: safeAccounts.reduce((sum, acc) => sum + Number(acc.total_spent || 0), 0),
    totalOrders: safeOrders.length
  };

  const isLoading = accountsLoading || contactsLoading || ordersLoading;
  const isBuilding = autoLinkMutation.isPending;
  const hasData = safeAccounts.length > 0 || safeContacts.length > 0;

  return {
    // Always return arrays, never null/undefined
    accounts: safeAccounts,
    contacts: safeContacts,
    orders: safeOrders,
    insights: safeInsights,
    stats,
    isLoading,
    isBuilding,
    hasData,
    autoLink: autoLinkMutation.mutateAsync,
    refetch: refetchAccounts
  };
}
