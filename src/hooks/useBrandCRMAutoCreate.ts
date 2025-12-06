import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GrabbaBrand, GRABBA_BRAND_CONFIG } from '@/config/grabbaBrands';

interface BrandCRMData {
  accounts: any[];
  contacts: any[];
  orders: any[];
  stats: {
    totalStores: number;
    totalContacts: number;
    totalRevenue: number;
    totalOrders: number;
  };
}

/**
 * Self-healing hook for Brand CRM data.
 * Ensures brand accounts exist by linking existing stores to the brand.
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

  // Auto-link mutation: Find store_master records and create brand accounts
  const autoLinkMutation = useMutation({
    mutationFn: async () => {
      if (!brandLabel || !brandKey) {
        throw new Error('Brand not configured');
      }

      console.log(`[BrandCRM] Starting auto-link for ${brandLabel}...`);

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

        console.log(`[BrandCRM] Created ${newAccounts.length} brand accounts for ${brandLabel}`);
      } else {
        console.log(`[BrandCRM] No new accounts to create for ${brandLabel}`);
      }

      return { created: newAccounts.length };
    },
    onSuccess: (result) => {
      if (result.created > 0) {
        queryClient.invalidateQueries({ queryKey: ['brand-crm-accounts', brandKey] });
        queryClient.invalidateQueries({ queryKey: ['brand-crm-contacts', brandKey] });
      }
    }
  });

  // Calculate stats
  const stats = {
    totalStores: accounts?.length || 0,
    totalContacts: contacts?.length || 0,
    totalRevenue: accounts?.reduce((sum, acc) => sum + Number(acc.total_spent || 0), 0) || 0,
    totalOrders: orders?.length || 0
  };

  const isLoading = accountsLoading || contactsLoading || ordersLoading;
  const isBuilding = autoLinkMutation.isPending;
  const hasData = (accounts && accounts.length > 0) || (contacts && contacts.length > 0);

  return {
    accounts: accounts || [],
    contacts: contacts || [],
    orders: orders || [],
    stats,
    isLoading,
    isBuilding,
    hasData,
    autoLink: autoLinkMutation.mutateAsync,
    refetch: refetchAccounts
  };
}
