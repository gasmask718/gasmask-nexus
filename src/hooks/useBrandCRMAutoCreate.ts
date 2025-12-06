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

  // Fetch brand contacts with store links
  const { data: contacts, isLoading: contactsLoading, refetch: refetchContacts } = useQuery({
    queryKey: ['brand-crm-contacts', brandKey],
    queryFn: async (): Promise<ContactWithLinks[]> => {
      if (!brandLabel) return [];
      
      // Fetch contacts
      const { data: contactsData, error: contactsError } = await supabase
        .from('brand_crm_contacts')
        .select('*')
        .eq('brand', brandLabel as any)
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

      const { data: existingAccounts } = await supabase
        .from('store_brand_accounts')
        .select('store_master_id')
        .eq('brand', brandLabel as any);

      const existingStoreIds = new Set(existingAccounts?.map(a => a.store_master_id) || []);

      const { data: storeMasters, error: smError } = await supabase
        .from('store_master')
        .select('id, store_name')
        .limit(200);

      if (smError) throw smError;

      const newAccounts = (storeMasters || [])
        .filter(sm => !existingStoreIds.has(sm.id))
        .slice(0, 50)
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
      }

      return { created: newAccounts.length };
    },
    onSuccess: () => {
      console.log('[BrandCRM] Auto-heal complete, refreshing data...');
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
    refetch: () => {
      refetchAccounts();
      refetchContacts();
    }
  };
}
