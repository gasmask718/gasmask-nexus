import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GrabbaBrand, GRABBA_BRAND_CONFIG } from '@/config/grabbaBrands';
import { getBrandEnumValue, getOrderBrandValue } from '@/config/grabbaSkyscraper';
import { toast } from 'sonner';

interface BrandInsights {
  summary: string;
  keyTraits: string[];
  buyingBehavior: string;
  opportunities: string[];
  risks: string[];
  personalNotes: string;
  relationshipSummary: string;
}

interface ContactWithLinks {
  id: string;
  contact_name: string;
  contact_phone: string | null;
  contact_email: string | null;
  primary_role: string;
  additional_roles: string[];
  notes: string | null;
  is_primary_contact: boolean;
  tags: string[];
  created_at: string;
  linkedStores: Array<{
    store_master_id: string;
    store_name: string;
    city: string;
  }>;
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
  // ── Total store_master count (universe) ────────────────────────────
  const { data: totalStoresMaster } = useQuery({
    queryKey: ['brand-crm-total-stores'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('store_master')
        .select('*', { count: 'exact', head: true });
      if (error) { console.error('[BrandCRM] total stores count error:', error); return 0; }
      return count ?? 0;
    },
    staleTime: 5 * 60 * 1000, // cache 5 min — universe rarely changes
  });
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
        .eq('brand', getBrandEnumValue(brandKey!) as any);
      
      if (error) {
        console.error('[BrandCRM] Error fetching accounts:', error);
        return [];
      }
      
      console.log(`[BrandCRM] Loaded ${data?.length || 0} accounts for ${brandLabel}`);
      return data || [];
    },
    enabled: !!brandLabel
  });

  // Fetch brand contacts with store links
  const { data: contacts, isLoading: contactsLoading, refetch: refetchContacts } = useQuery({
    queryKey: ['brand-crm-contacts', brandKey],
    queryFn: async (): Promise<ContactWithLinks[]> => {
      if (!brandLabel) return [];
      
      // Fetch contacts
      const { data: contactsData, error: contactsError } = await supabase
        .from('brand_crm_contacts')
        .select('*')
        .eq('brand', getBrandEnumValue(brandKey!) as any)
        .order('is_primary_contact', { ascending: false })
        .order('primary_role')
        .order('contact_name');
      
      if (contactsError) {
        console.error('[BrandCRM] Error fetching contacts:', contactsError);
        return [];
      }

      if (!contactsData || contactsData.length === 0) return [];

      // Fetch store links for all contacts
      const contactIds = contactsData.map(c => c.id);
      const { data: linksData } = await supabase
        .from('brand_contact_store_links')
        .select('contact_id, store_master_id, store_master:store_master_id(store_name, city)')
        .in('contact_id', contactIds);

      // Map links to contacts
      const linksMap = new Map<string, Array<{ store_master_id: string; store_name: string; city: string }>>();
      (linksData || []).forEach((link: any) => {
        if (!linksMap.has(link.contact_id)) {
          linksMap.set(link.contact_id, []);
        }
        linksMap.get(link.contact_id)!.push({
          store_master_id: link.store_master_id,
          store_name: link.store_master?.store_name || 'Unknown',
          city: link.store_master?.city || ''
        });
      });

      // Combine contacts with their store links
      return contactsData.map(contact => ({
        id: contact.id,
        contact_name: contact.contact_name,
        contact_phone: contact.contact_phone,
        contact_email: contact.contact_email,
        primary_role: contact.primary_role || 'other',
        additional_roles: contact.additional_roles || [],
        notes: contact.notes,
        is_primary_contact: contact.is_primary_contact || false,
        tags: contact.tags || [],
        created_at: contact.created_at || '',
        linkedStores: linksMap.get(contact.id) || []
      }));
    },
    enabled: !!brandLabel
  });

  // ── Aggregate order stats (revenue + count — no LIMIT) ────────────
  const { data: orderAggregates } = useQuery({
    queryKey: ['brand-crm-order-aggregates', brandKey],
    queryFn: async () => {
      if (!brandKey) return { count: 0, revenue: 0, activeStoreIds: new Set<string>() };
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Get ALL orders for this brand (no limit) — only id, total, store_id, created_at
      const { data, error } = await supabase
        .from('wholesale_orders')
        .select('id, total, store_id, created_at')
        .eq('brand', getOrderBrandValue(brandKey));

      if (error) { console.error('[BrandCRM] order aggregates error:', error); return { count: 0, revenue: 0, activeStoreIds: new Set<string>() }; }

      const rows = data || [];
      const revenue = rows.reduce((sum, o) => sum + Number(o.total || 0), 0);
      const activeStoreIds = new Set<string>();
      rows.forEach(o => {
        if (o.store_id && new Date(o.created_at) >= thirtyDaysAgo) {
          activeStoreIds.add(o.store_id);
        }
      });
      return { count: rows.length, revenue, activeStoreIds };
    },
    enabled: !!brandKey,
  });

  // Fetch brand orders for display (latest 100 for the list)
  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['brand-crm-orders', brandKey],
    queryFn: async () => {
      if (!brandKey) return [];
      
      const { data: ordersData, error } = await supabase
        .from('wholesale_orders')
        .select('id, store_id, status, total, boxes, tubes_total, created_at, brand, notes, delivery_method')
        .eq('brand', getOrderBrandValue(brandKey!))
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) {
        console.error('[BrandCRM] Error fetching orders:', error);
        return [];
      }

      if (!ordersData || ordersData.length === 0) return [];

      const storeIds = [...new Set(ordersData.map(o => o.store_id).filter(Boolean))] as string[];
      
      if (storeIds.length === 0) {
        return ordersData.map(order => ({ ...order, store_master: null }));
      }

      const { data: storesData } = await supabase
        .from('store_master')
        .select('id, store_name, address, city')
        .in('id', storeIds);

      const storeMap = new Map((storesData || []).map(s => [s.id, s]));
      
      return ordersData.map(order => ({
        ...order,
        store_master: order.store_id ? storeMap.get(order.store_id) || null : null
      }));
    },
    enabled: !!brandKey
  });

  // Fetch or generate brand insights
  const { data: insights, isLoading: insightsLoading } = useQuery({
    queryKey: ['brand-crm-insights', brandKey],
    queryFn: async (): Promise<BrandInsights> => {
      if (!brandKey) return DEFAULT_INSIGHTS;
      
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

  // Auto-link mutation
  const autoLinkMutation = useMutation({
    mutationFn: async () => {
      if (!brandLabel || !brandKey) {
        throw new Error('Brand not configured');
      }

      console.log(`[BrandCRM] Starting auto-link for ${brandLabel}...`);
      console.log('[BrandCRM] Brand CRM Auto-Healed - starting process');

      // Fetch existing accounts for this brand
      const { data: existingAccounts } = await supabase
        .from('store_brand_accounts')
        .select('store_master_id')
        .eq('brand', getBrandEnumValue(brandKey!) as any);

      const existingStoreIds = new Set(existingAccounts?.map(a => a.store_master_id) || []);

      // Fetch ALL stores — paginated to avoid Supabase 1000-row default
      const allStores: { id: string; store_name: string }[] = [];
      let offset = 0;
      const PAGE = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data: page, error: smError } = await supabase
          .from('store_master')
          .select('id, store_name')
          .range(offset, offset + PAGE - 1);
        if (smError) throw smError;
        allStores.push(...(page || []));
        hasMore = (page?.length || 0) >= PAGE;
        offset += PAGE;
      }

      const newAccounts = allStores
        .filter(sm => !existingStoreIds.has(sm.id))
        .map(sm => ({
          store_master_id: sm.id,
          brand: getBrandEnumValue(brandKey),
          active_status: true,
          loyalty_level: 'Bronze',
          credit_terms: 'COD',
          total_spent: 0
        }));

      if (newAccounts.length > 0) {
        // Batch insert in chunks of 500 to avoid payload limits
        const BATCH = 500;
        let created = 0;
        for (let i = 0; i < newAccounts.length; i += BATCH) {
          const chunk = newAccounts.slice(i, i + BATCH);
          const { error: insertError } = await supabase
            .from('store_brand_accounts')
            .insert(chunk as any);
          if (insertError) {
            console.error(`[BrandCRM] Batch insert error at offset ${i}:`, insertError);
            throw insertError;
          }
          created += chunk.length;
        }

        console.log(`[BrandCRM] Brand Master Created - ${created} accounts for ${brandLabel}`);
      }

      return { created: newAccounts.length };
    },
    onSuccess: (data) => {
      console.log('[BrandCRM] Auto-heal complete, refreshing data...');
      toast.success(`Successfully linked ${data.created} stores to ${brandLabel}!`);
      queryClient.invalidateQueries({ queryKey: ['brand-crm-accounts', brandKey] });
      queryClient.invalidateQueries({ queryKey: ['brand-crm-contacts', brandKey] });
      queryClient.invalidateQueries({ queryKey: ['brand-crm-orders', brandKey] });
      queryClient.invalidateQueries({ queryKey: ['brand-crm-insights', brandKey] });
    }
  });

  // Group contacts by role
  const contactsByRole = (contacts || []).reduce((acc, contact) => {
    const role = contact.primary_role || 'other';
    const roleKey = role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, ' ');
    if (!acc[roleKey]) {
      acc[roleKey] = [];
    }
    acc[roleKey].push(contact);
    return acc;
  }, {} as Record<string, ContactWithLinks[]>);

  // Safe fallbacks
  const safeAccounts = accounts || [];
  const safeContacts = contacts || [];
  const safeOrders = orders || [];
  const safeInsights = insights || DEFAULT_INSIGHTS;

  const agg = orderAggregates ?? { count: 0, revenue: 0, activeStoreIds: new Set<string>() };

  const stats = {
    /** All stores in the system (store_master universe) */
    totalStoresMaster: totalStoresMaster ?? 0,
    /** Stores linked to this brand via store_brand_accounts */
    connectedStores: safeAccounts.length,
    /** Stores with ≥1 order for this brand in the last 30 days */
    activeStores: agg.activeStoreIds.size,
    totalContacts: safeContacts.length,
    /** Sum of all order totals for this brand (no limit) */
    totalRevenue: agg.revenue,
    /** Count of all orders for this brand (no limit) */
    totalOrders: agg.count,
  };

  const isLoading = accountsLoading || contactsLoading || ordersLoading;
  const isBuilding = autoLinkMutation.isPending;
  const hasData = safeAccounts.length > 0 || safeContacts.length > 0;

  // Full refetch — refreshes ALL data sources, not just accounts + contacts
  const refetchAll = () => {
    refetchAccounts();
    refetchContacts();
    queryClient.invalidateQueries({ queryKey: ['brand-crm-orders', brandKey] });
    queryClient.invalidateQueries({ queryKey: ['brand-crm-insights', brandKey] });
  };

  return {
    accounts: safeAccounts,
    contacts: safeContacts,
    contactsByRole,
    orders: safeOrders,
    insights: safeInsights,
    stats,
    isLoading,
    isBuilding,
    hasData,
    autoLink: autoLinkMutation.mutateAsync,
    refetch: refetchAll,
  };
}
