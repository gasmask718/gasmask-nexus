import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Search, MapPin, Phone, Plus, Users, Flower2, Sticker, Tag, Edit, CreditCard, Loader2, Link, Upload, Package, Sparkles, CalendarDays, ShoppingCart, Clock, Route as RouteIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { RouteAssignmentDialog } from '@/components/delivery/RouteAssignmentDialog';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';
import { useCall } from '@/components/communication/CallProvider';
import { ClickablePhone } from '@/components/communication/ClickablePhone';
import BulkUploadModal from '@/components/stores/BulkUploadModal';
import { useAuth } from '@/contexts/AuthContext';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { useGlobalTags } from '@/hooks/useGlobalTags';
import { useStoreProductCounts } from '@/hooks/useProductStoreAssignments';
import { useStoreTubeKPIBatch } from '@/hooks/useStoreTubeKPIBatch';
import { useStoreTubeSummariesBulk } from '@/hooks/useStoreTubeSummariesBulk';
import { useStoreTubeIntelSummaryBatch } from '@/hooks/useStoreTubeIntelSummary';
import { useLastOrderSnapshotBatch } from '@/hooks/useLastOrderSnapshot';
import { StoreKPIBadge } from '@/components/store/StoreKPIBadge';
import { LastOrderKPIBadge } from '@/components/store/LastOrderKPIBadge';
import { DataTablePagination } from '@/components/crud/DataTablePagination';
import { PagePurpose } from '@/components/portal/guidance/PagePurpose';
import { CardHelper } from '@/components/portal/guidance/CardHelper';
import { useTranslation } from '@/hooks/useTranslation';
import { getBrandIdentity } from '@/config/brands';
import { cn } from '@/lib/utils';
import {
  STORE_RELATIONSHIP_STATUSES,
  RELATIONSHIP_STATUS_COLORS,
  RELATIONSHIP_STATUS_SHORT,
} from '@/config/storeRelationshipStatus';
import { RelationshipStatusSelect } from '@/components/store/RelationshipStatusSelect';
import { format } from 'date-fns';

interface StoreContact {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  can_receive_sms: boolean | null;
  is_primary: boolean | null;
}

interface TubeInventory {
  id: string;
  brand: string;
  current_tubes_left: number | null;
}

type StoreContactRow = StoreContact & { store_id: string };
type TubeInventoryRow = TubeInventory & { store_id: string };

interface Store {
  id: string;
  name: string;
  type: string;
  address_street: string;
  address_city: string;
  address_state: string;
  address_zip: string;
  phone: string;
  alt_phone: string | null;
  email: string | null;
  status: string;
  tags: string[];
  sells_flowers: boolean;
  sticker_status: string;
  sticker_door: boolean;
  sticker_instore: boolean;
  sticker_phone: boolean;
  sticker_notes: string | null;
  payment_type: string | null;
  contacts: StoreContact[];
  tubeInventory: TubeInventory[];
  owner_name: string | null;
  connectedStoresCount: number;
  created_at: string | null;
  updated_at: string | null;
  notes: string | null;
  nickname: string | null;
  country_of_origin: string | null;
  country: string | null;
  languages: string[] | null;
  communication_preference: string | null;
  personality_notes: string | null;
  has_expansion: boolean | null;
  new_store_addresses: string[] | null;
  expected_open_dates: string[] | null;
  expansion_notes: string | null;
  influence_level: string | null;
  loyalty_triggers: string[] | null;
  frustration_triggers: string[] | null;
  risk_score: string | null;
  brand_id: string | null;
  borough_id: string | null;
  language_preference: string | null;
  dialect_preference: string | null;
  formality_level: string | null;
  preferred_channel: string | null;
  notes_for_tone: string | null;
  personality_profile_id: string | null;
  connected_group_id: string | null;
  sourced_by_ambassador_id: string | null;
  assigned_ambassador_id: string | null;
  sourced_at: string | null;
  last_visit_at: string | null;
  last_order_at: string | null;
  health_status: string | null;
  last_active_date?: string | null;
  reactivation_priority?: string | null;
  relationship_status?: string | null;
}

const Stores = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { simulationMode } = useSimulationMode();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [relationshipFilter, setRelationshipFilter] = useState<string>('all');
  const [stickerFilter, setStickerFilter] = useState<string>('all');
  const [newStoresOnly, setNewStoresOnly] = useState(false);
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<string>('all');
  const [noNameFilter, setNoNameFilter] = useState(false);
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [customDateFrom, setCustomDateFrom] = useState<string>('');
  const [customDateTo, setCustomDateTo] = useState<string>('');
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [newStoreName, setNewStoreName] = useState('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [isSavingStoreName, setIsSavingStoreName] = useState(false);
  
  // Add Store Modal State
  const [showAddStore, setShowAddStore] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [dispatchStores, setDispatchStores] = useState<string[] | null>(null);
  const [newStoreData, setNewStoreData] = useState({
    name: '',
    type: 'retail',
    address_street: '',
    address_city: '',
    address_state: 'NY',
    address_zip: '',
    phone: '',
    status: 'prospect',
    primary_contact_name: '',
    notes: '',
  });

  const createStoreMutation = useMutation({
    mutationFn: async (data: typeof newStoreData) => {
      // Note: RLS policies automatically filter by is_simulation based on system_settings
      // For stores table, we insert into store_master which has the is_simulation column
      const { data: result, error } = await supabase
        .from('store_master')
        .insert([{
          store_name: data.name,
          store_type: data.type,
          address: data.address_street || null,
          city: data.address_city || null,
          state: data.address_state || null,
          zip: data.address_zip || null,
          phone: data.phone || null,
          is_simulation: simulationMode, // Data isolation flag
        }])
        .select('id')
        .maybeSingle();
      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['stores-with-contacts'] });
      toast.success(simulationMode ? 'Store created (simulation)' : 'Store created successfully');
      setShowAddStore(false);
      resetNewStoreForm();
      // Navigate to store profile if we got an id back
      if (data?.id) {
        navigate(`/stores/${data.id}`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to create store: ${error.message}`);
    },
  });

  const resetNewStoreForm = () => {
    setNewStoreData({
      name: '',
      type: 'retail',
      address_street: '',
      address_city: '',
      address_state: 'NY',
      address_zip: '',
      phone: '',
      status: 'prospect',
      primary_contact_name: '',
      notes: '',
    });
  };

  const handleCreateStore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreData.name.trim()) {
      toast.error('Store name is required');
      return;
    }
    createStoreMutation.mutate(newStoreData);
  };

  // Fetch all global tags for the filter dropdown
  const { data: allGlobalTags = [] } = useGlobalTags();
  
  // Fetch product counts for stores
  const { data: storeProductCounts = {} } = useStoreProductCounts();

  // Fetch store IDs that have notes (to identify "new" stores without notes)
  const { data: storeIdsWithNotes = new Set<string>() } = useQuery({
    queryKey: ['stores-with-notes-ids', simulationMode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_notes')
        .select('store_id');
      
      if (error) throw error;
      
      return new Set((data || []).map(row => row.store_id));
    },
    select: (data) => data,
  });

  // Active store IDs = any store that has at least one invoice ever (source of truth)
  const { data: activeStoreIds = new Set<string>() } = useQuery({
    queryKey: ['stores-active-ids-invoiced'],
    queryFn: async () => {
      const ids = new Set<string>();
      let page = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('invoices_unified')
          .select('store_id')
          .not('store_id', 'is', null)
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw error;
        (data || []).forEach((r: any) => r.store_id && ids.add(r.store_id));
        if (!data || data.length < pageSize) break;
        page++;
      }
      return ids;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch stores from database - RLS automatically filters by simulation mode
  const { data: stores = [], isLoading } = useQuery({
    queryKey: ['stores-with-contacts', simulationMode],
    queryFn: async () => {
      // Fetch from store_master - explicitly filter by simulation mode
      let storesData: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('store_master')
          .select('*')
          .eq('is_simulation', simulationMode)
          .is('deleted_at', null)
          .order('store_name')
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          storesData = [...storesData, ...data];
          if (data.length < pageSize) hasMore = false;
          page++;
        } else {
          hasMore = false;
        }
      }

      const storesError = null; // Cleared because we threw on error above

      // Map store_master fields to expected Store interface
      const mappedStores = (storesData || []).map(store => ({
        id: store.id,
        name: store.store_name || '',
        type: store.store_type || '',
        address_street: store.address || '',
        address_city: store.city || '',
        address_state: store.state || '',
        address_zip: store.zip || '',
        phone: store.phone ? String(store.phone) : '',
        alt_phone: null as string | null,
        email: store.email || null,
        status: 'active', // Default; overridden by legacy stores.status when available
        tags: [] as string[],
        sells_flowers: false,
        sticker_status: '',
        sticker_door: store.sticker_on_door || false,
        sticker_instore: store.sticker_in_store || false,
        sticker_phone: store.sticker_with_phone || false,
        sticker_notes: store.sticker_notes || null,
        payment_type: null as string | null,
        contacts: [] as StoreContact[],
        tubeInventory: [] as TubeInventory[],
        owner_name: store.owner_name || null,
        connectedStoresCount: 0,
        created_at: store.created_at || null,
        updated_at: store.updated_at || null,
        notes: store.notes || null,
        nickname: store.nickname || null,
        country_of_origin: store.country_of_origin || null,
        country: store.country || null,
        languages: store.languages || null,
        communication_preference: store.communication_preference || null,
        personality_notes: store.personality_notes || null,
        has_expansion: store.has_expansion || null,
        new_store_addresses: store.new_store_addresses || null,
        expected_open_dates: store.expected_open_dates || null,
        expansion_notes: store.expansion_notes || null,
        influence_level: store.influence_level || null,
        loyalty_triggers: store.loyalty_triggers || null,
        frustration_triggers: store.frustration_triggers || null,
        risk_score: store.risk_score || null,
        brand_id: store.brand_id || null,
        borough_id: store.borough_id || null,
        language_preference: store.language_preference || null,
        dialect_preference: store.dialect_preference || null,
        formality_level: store.formality_level || null,
        preferred_channel: store.preferred_channel || null,
        notes_for_tone: store.notes_for_tone || null,
        personality_profile_id: store.personality_profile_id || null,
        connected_group_id: store.connected_group_id || null,
        sourced_by_ambassador_id: store.sourced_by_ambassador_id || null,
        assigned_ambassador_id: store.assigned_ambassador_id || null,
        sourced_at: store.sourced_at || null,
        last_visit_at: store.last_visit_at || null,
        last_order_at: store.last_order_at || null,
        health_status: store.health_status || null,
        contact_name: store.contact_name || null,
        mode: store.mode || null,
        last_order_date: store.last_order_date || null,
        owed_amount: store.owed_amount || null,
        invoice_amount: store.invoice_amount || null,
        invoice_payment_status: store.invoice_payment_status || null,
        invoice_payment_method: store.invoice_payment_method || null,
        invoice_amount_paid: store.invoice_amount_paid || null,
        last_active_date: null,
        reactivation_priority: null,
        relationship_status: (store as any).relationship_status || 'Non-active (New - need to speak)',
      }));

      // Fetch contacts for these stores
      const storeIds = mappedStores.map(s => s.id);
      
      // Helper to batch .in() queries to avoid URL length limits
      const BATCH_SIZE = 200;
      async function batchedIn<T>(
        queryFn: (ids: string[]) => PromiseLike<{ data: T[] | null; error: any }>
      ): Promise<T[]> {
        const results: T[] = [];
        for (let i = 0; i < storeIds.length; i += BATCH_SIZE) {
          const batch = storeIds.slice(i, i + BATCH_SIZE);
          try {
            const { data, error } = await queryFn(batch);
            if (!error && data) results.push(...data);
          } catch {
            // Silently skip failed batches
          }
        }
        return results;
      }
      
      if (storeIds.length) {
        // Fetch global tags for all stores (batched)
        const tagAttachments = await batchedIn<any>((ids) =>
          supabase
            .from('tag_attachments')
            .select(`
              entity_id,
              global_tags (
                id,
                name
              )
            `)
            .eq('entity_type', 'store')
            .in('entity_id', ids)
        );

        if (tagAttachments.length) {
          const tagsByStore = tagAttachments.reduce((acc, attachment) => {
            const storeId = attachment.entity_id;
            if (!acc[storeId]) acc[storeId] = [];
            if (attachment.global_tags?.name) {
              acc[storeId].push(attachment.global_tags.name);
            }
            return acc;
          }, {} as Record<string, string[]>);

          mappedStores.forEach(store => {
            store.tags = tagsByStore[store.id] || [];
          });
        }

        // Fetch contacts (batched)
        const contactsData = await batchedIn<any>((ids) =>
          supabase
            .from('store_contacts')
            .select('id, store_id, name, role, phone, can_receive_sms, is_primary')
            .in('store_id', ids)
        );
        
        if (contactsData.length) {
          const contactsByStore = contactsData.reduce((acc, contact) => {
            if (!acc[contact.store_id]) acc[contact.store_id] = [];
            acc[contact.store_id].push(contact);
            return acc;
          }, {} as Record<string, StoreContact[]>);
          
          mappedStores.forEach(store => {
            store.contacts = contactsByStore[store.id] || [];
          });
        }
        
        // Fetch tube inventory (batched)
        const tubeData = await batchedIn<any>((ids) =>
          supabase
            .from('store_tube_inventory')
            .select('id, store_id, brand, current_tubes_left')
            .in('store_id', ids)
            .neq('brand', 'hotscolatti')
        );
        
        if (tubeData.length) {
          const inventoryByStore = tubeData.reduce((acc, item) => {
            if (!acc[item.store_id]) acc[item.store_id] = [];
            acc[item.store_id].push({
              id: item.id,
              brand: item.brand,
              current_tubes_left: item.current_tubes_left,
            });
            return acc;
          }, {} as Record<string, TubeInventory[]>);
          
          mappedStores.forEach(store => {
            store.tubeInventory = inventoryByStore[store.id] || [];
          });
        }

        // Fetch status + phone numbers from legacy stores table (batched)
        const legacyStoresData = await batchedIn<any>((ids) =>
          supabase
            .from('stores')
            .select('id, phone, alt_phone, status, last_active_date, reactivation_priority')
            .in('id', ids)
        );

        if (legacyStoresData.length) {
          const legacyByStore = legacyStoresData.reduce((acc, store) => {
            acc[store.id] = {
              phone: store.phone ? String(store.phone) : null,
              alt_phone: store.alt_phone ? String(store.alt_phone) : null,
              status: store.status,
              last_active_date: store.last_active_date,
              reactivation_priority: store.reactivation_priority,
            };
            return acc;
          }, {} as Record<string, { phone: string | null; alt_phone: string | null; status: string | null; last_active_date: string | null; reactivation_priority: string | null }>);

          mappedStores.forEach(store => {
            const legacy = legacyByStore[store.id];
            if (legacy) {
              if (!store.phone && legacy.phone) {
                store.phone = legacy.phone;
              }
              store.alt_phone = legacy.alt_phone;
              if (legacy.status) {
                store.status = legacy.status;
              }
              store.last_active_date = legacy.last_active_date;
              store.reactivation_priority = legacy.reactivation_priority;
            }
          });
        }

        // Calculate connected stores count based on owner_name
        // Stores with the same owner_name are considered connected
        const ownerNameCounts = mappedStores.reduce((acc, store) => {
          if (store.owner_name) {
            if (!acc[store.owner_name]) acc[store.owner_name] = [];
            acc[store.owner_name].push(store.id);
          }
          return acc;
        }, {} as Record<string, string[]>);

        mappedStores.forEach(store => {
          if (store.owner_name && ownerNameCounts[store.owner_name]) {
            // Count excludes the store itself
            store.connectedStoresCount = ownerNameCounts[store.owner_name].length - 1;
          }
        });
      }

      return mappedStores;
    },
  });

  // Use global tags for the filter dropdown - combines tags from stores AND all global tags
  const availableStoreTags = useMemo(() => {
    const storeTagsSet = new Set(
      stores
        .flatMap(store => store.tags ?? [])
        .map(tag => tag?.trim())
        .filter((tag): tag is string => Boolean(tag))
    );
    
    // Also include all global tags so they appear in the dropdown
    allGlobalTags.forEach(tag => storeTagsSet.add(tag.name));
    
    return Array.from(storeTagsSet).sort((a, b) => a.localeCompare(b));
  }, [stores, allGlobalTags]);

  // Active = the store has at least one invoice in invoices_unified.
  // Inactive = no invoice on record.
  const isStoreActive = (storeId: string) => activeStoreIds.has(storeId);

  const filteredStores = stores.filter(store => {
    // Search across name + full address fields (street, city, state, zip)
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery ||
      store.name.toLowerCase().includes(searchLower) ||
      store.address_street?.toLowerCase().includes(searchLower) ||
      store.address_city?.toLowerCase().includes(searchLower) ||
      store.address_state?.toLowerCase().includes(searchLower) ||
      store.address_zip?.toLowerCase().includes(searchLower) ||
      store.phone?.includes(searchQuery) ||
      store.owner_name?.toLowerCase().includes(searchLower) ||
      store.tags?.some(tag => tag.toLowerCase().includes(searchLower));
    
    const matchesStatus = activeFilter === 'all' 
      || (activeFilter === 'active' && isStoreActive(store.id))
      || (activeFilter === 'inactive' && !isStoreActive(store.id));

    const matchesRelationship = relationshipFilter === 'all'
      || store.relationship_status === relationshipFilter;
    
    const matchesTag =
      tagFilter === 'all' ||
      (tagFilter === 'flowers' && store.sells_flowers) ||
      store.tags?.some(tag => tag.toLowerCase() === tagFilter.toLowerCase());
    
    // Sticker filter
    const matchesSticker = stickerFilter === 'all' ||
      (stickerFilter === 'has_door' && store.sticker_door) ||
      (stickerFilter === 'has_instore' && store.sticker_instore) ||
      (stickerFilter === 'has_phone' && store.sticker_phone) ||
      (stickerFilter === 'has_any' && (store.sticker_door || store.sticker_instore || store.sticker_phone)) ||
      (stickerFilter === 'no_sticker' && !store.sticker_door && !store.sticker_instore && !store.sticker_phone);
    
    // Payment type filter
    const matchesPaymentType = 
      paymentTypeFilter === 'all' || 
      (paymentTypeFilter === 'not_set' && !store.payment_type) ||
      (paymentTypeFilter !== 'not_set' && store.payment_type === paymentTypeFilter);
    
    // No Name filter
    const matchesNoName = !noNameFilter || !store.name || store.name.trim() === '' || store.name.trim().toLowerCase() === 'no name';

    // New stores filter (stores without notes OR created today)
    const isCreatedToday = store.created_at 
      ? new Date(store.created_at).toDateString() === new Date().toDateString()
      : false;
    const matchesNewStores = !newStoresOnly || !storeIdsWithNotes.has(store.id) || isCreatedToday;

    // Month/date filter
    const matchesMonth = (() => {
      if (monthFilter === 'all') return true;
      if (!store.created_at) return false;
      const created = new Date(store.created_at);
      const now = new Date();

      if (monthFilter === 'this_month') {
        return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
      }
      if (monthFilter === 'this_year') {
        return created.getFullYear() === now.getFullYear();
      }
      if (monthFilter.startsWith('months_ago_')) {
        const monthsAgo = parseInt(monthFilter.replace('months_ago_', ''), 10);
        const cutoff = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
        return created >= cutoff;
      }
      if (monthFilter === 'custom') {
        const from = customDateFrom ? new Date(customDateFrom) : null;
        const to = customDateTo ? new Date(customDateTo + 'T23:59:59') : null;
        if (from && created < from) return false;
        if (to && created > to) return false;
        return true;
      }
      return true;
    })();
    
    return matchesSearch && matchesStatus && matchesRelationship && matchesTag && matchesSticker && matchesPaymentType && matchesNoName && matchesNewStores && matchesMonth;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'revenue_active':
      case 'engagement_active':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'inactive': return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
      case 'prospect': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'needsFollowUp': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'reactivation_target': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const statusCounts = {
    all: stores.length,
    active: stores.filter(s => isStoreActive(s.id)).length,
    inactive: stores.filter(s => !isStoreActive(s.id)).length,
  };

  const flowersCount = stores.filter(s => s.sells_flowers).length;
  const stickerCounts = {
    hasDoor: stores.filter(s => s.sticker_door).length,
    hasInstore: stores.filter(s => s.sticker_instore).length,
    hasPhone: stores.filter(s => s.sticker_phone).length,
    hasAny: stores.filter(s => s.sticker_door || s.sticker_instore || s.sticker_phone).length,
    noSticker: stores.filter(s => !s.sticker_door && !s.sticker_instore && !s.sticker_phone).length,
  };
  const paymentTypeCounts = {
    paysUpfront: stores.filter(s => s.payment_type === 'pays_upfront').length,
    billToBill: stores.filter(s => s.payment_type === 'bill_to_bill').length,
    notSet: stores.filter(s => !s.payment_type).length,
  };
  
  // Count of new stores (stores without notes OR created today)
  const isStoreNew = (store: Store) => {
    const isCreatedToday = store.created_at 
      ? new Date(store.created_at).toDateString() === new Date().toDateString()
      : false;
    return !storeIdsWithNotes.has(store.id) || isCreatedToday;
  };
  const newStoresCount = stores.filter(isStoreNew).length;
  const noNameCount = stores.filter(s => !s.name || s.name.trim() === '' || s.name.trim().toLowerCase() === 'no name').length;

  // ═══════════════════════════════════════════════════════════════════════════════
  // PAGINATION
  // ═══════════════════════════════════════════════════════════════════════════════
  const totalPages = Math.ceil(filteredStores.length / pageSize);
  const paginatedStores = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStores.slice(start, start + pageSize);
  }, [filteredStores, currentPage, pageSize]);

  // Reset to page 1 when filters change
  const handleFilterChange = () => setCurrentPage(1);

  // ═══════════════════════════════════════════════════════════════════════════════
  // TUBE KPI BATCH FETCH
  // Fetches KPI data for ALL visible stores in a single query
  // ═══════════════════════════════════════════════════════════════════════════════
  const paginatedStoreIds = useMemo(() => paginatedStores.map(s => s.id), [paginatedStores]);
  const { data: tubeKPIMap, isLoading: kpiLoading } = useStoreTubeKPIBatch(paginatedStoreIds);
  const { data: tubeIntelMap } = useStoreTubeIntelSummaryBatch(paginatedStoreIds);
  const { data: losMap } = useLastOrderSnapshotBatch(paginatedStoreIds);
  const { map: tubeSummaryMap } = useStoreTubeSummariesBulk();

  const formatBrandName = (brand: string) => {
    const normalized = brand.toLowerCase();
    // Special case: gasmask should display as "gasmask bags"
    if (normalized === 'gasmask' || (normalized.includes('gasmask') && !normalized.includes('gasmasktubes'))) {
      return 'Gasmask Bags';
    }
    return brand
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  const getBrandColor = (brand: string) => {
    const normalizedBrand = brand.toLowerCase();
    // Check gasmasktubes first (before gasmask) since it contains "gasmask"
    if (normalizedBrand.includes('gasmasktubes') || normalizedBrand === 'gasmasktubes') {
      return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    }
    if (normalizedBrand.includes('gasmask')) {
      return 'bg-red-500/10 text-red-500 border-red-500/20';
    }
    if (normalizedBrand.includes('hotmama')) {
      return 'bg-pink-500/10 text-pink-500 border-pink-500/20';
    }
    if (normalizedBrand.includes('grabba') || normalizedBrand.includes('grabbar')) {
      return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
    }
    if (normalizedBrand.includes('hotscolatti') || normalizedBrand.includes('hotscolatti')) {
      return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    }
    return 'bg-muted text-muted-foreground';
  };

  const openEditStoreName = (store: Store) => {
    setEditingStore(store);
    setNewStoreName(store.name);
  };

  const closeEditStoreName = () => {
    setEditingStore(null);
    setNewStoreName('');
  };

  const handleSaveStoreName = async () => {
    if (!editingStore) return;

    const trimmedName = newStoreName.trim();
    if (!trimmedName) {
      toast.error('Store name cannot be empty');
      return;
    }

    setIsSavingStoreName(true);
    try {
      const { error } = await supabase
        .from('stores')
        .update({ name: trimmedName })
        .eq('id', editingStore.id);

      if (error) throw error;

      toast.success('Store name updated');
      closeEditStoreName();
      await queryClient.invalidateQueries({ queryKey: ['stores-with-contacts'] });
    } catch (error) {
      console.error('Error updating store name:', error);
      toast.error('Failed to update store name');
    } finally {
      setIsSavingStoreName(false);
    }
  };

  const pageConfig = {
    admin: {
      title: t('page.stores.admin') || 'Stores',
      description: t('page.stores.purpose') || 'Browse and manage all stores in the distribution network. View inventory, sticker status, and governance records.',
      actions: [
        t('page.stores.action.edit') || 'Edit store details and contacts',
        t('page.stores.action.view_inventory') || 'View tube inventory and orders',
        t('page.stores.action.verify') || 'Verify sticker placement',
      ],
      warnings: [
        t('page.stores.warning.changes_audit') || 'Store edits are tracked in audit logs',
      ],
    },
    default: {
      title: t('page.stores.default') || 'Stores',
      description: t('page.stores.purpose') || 'Browse and select stores for visits or deliveries.',
      actions: [
        t('page.stores.action.search') || 'Search stores by name or location',
        t('page.stores.action.filter') || 'Filter by status, tags, or inventory',
        t('page.stores.action.select') || 'Click to view store details',
      ],
    },
  };

  return (
    <div className="space-y-6">
      <PagePurpose 
        pageKey="page.stores" 
        config={pageConfig}
        variant="default"
      />
      
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-bold tracking-tight">{t('nav.stores') || 'Stores'}</h2>
            {simulationMode && <SimulationBadge />}
          </div>
          <p className="text-muted-foreground">
            {simulationMode ? t('page.stores.demo_preview') || 'Demo stores preview' : t('page.stores.subtitle') || 'Manage your distribution network'} • {filteredStores.length} stores
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={selectedStoreIds.length === 0}
            onClick={() => setDispatchStores(selectedStoreIds)}
          >
            <RouteIcon className="h-4 w-4 mr-2" />
            Dispatch Selected{selectedStoreIds.length > 0 ? ` (${selectedStoreIds.length})` : ''}
          </Button>
          <Button variant="outline" onClick={() => setShowBulkUpload(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Bulk Upload
          </Button>
          <Button className="bg-primary hover:bg-primary-hover" onClick={() => setShowAddStore(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Store
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('page.stores.search_placeholder') || 'Search stores by name, location, or tags...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-secondary/50 border-border/50"
            />
          </div>
          <div className="flex gap-2">
            {([
              { key: 'all', label: 'All' },
              { key: 'active', label: 'Invoiced' },
              { key: 'inactive', label: 'Never Invoiced' },
            ] as const).map(({ key, label }) => {
              const count = key === 'all' ? stores.length : key === 'active' ? stores.filter(s => isStoreActive(s.id)).length : stores.filter(s => !isStoreActive(s.id)).length;
              return (
                <Button
                  key={key}
                  variant={activeFilter === key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveFilter(key)}
                  className="h-9 gap-1.5"
                >
                  {label}
                  <Badge variant={activeFilter === key ? 'secondary' : 'outline'} className="text-xs">
                    {count}
                  </Badge>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Relationship Status (9-state) Filter */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-muted-foreground mr-1" title="Relationship health from store_master.relationship_status (separate from invoice activity)">Relationship health:</span>
          {(() => {
            const counts: Record<string, number> = { all: stores.length };
            for (const s of STORE_RELATIONSHIP_STATUSES) counts[s] = 0;
            for (const st of stores) {
              const v = st.relationship_status || 'Non-active (New - need to speak)';
              counts[v] = (counts[v] || 0) + 1;
            }
            const chips: Array<{ key: string; label: string; cls?: string }> = [
              { key: 'all', label: 'All' },
              ...STORE_RELATIONSHIP_STATUSES.map((s) => ({
                key: s,
                label: RELATIONSHIP_STATUS_SHORT[s],
                cls: RELATIONSHIP_STATUS_COLORS[s],
              })),
            ];
            return chips.map(({ key, label, cls }) => (
              <Button
                key={key}
                variant={relationshipFilter === key ? 'default' : 'outline'}
                size="sm"
                className={cn('h-8 gap-1.5 text-xs', relationshipFilter !== key && cls)}
                onClick={() => setRelationshipFilter(key)}
              >
                {label}
                <Badge variant="secondary" className="text-[10px]">{counts[key] || 0}</Badge>
              </Button>
            ));
          })()}
        </div>

        {/* Additional Filters Row */}
        <div className="flex flex-wrap gap-2">
          {/* Tag Filter */}
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="w-44 bg-secondary/50 border-border/50">
              <Tag className="h-4 w-4 mr-2" />
              <SelectValue placeholder={t('page.stores.filter_tags') || 'Tags'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('page.stores.all_tags') || 'All Tags'}</SelectItem>
              <SelectItem value="flowers">
                <span className="flex items-center gap-2">
                  <Flower2 className="h-4 w-4 text-pink-500" />
                  Sells Flowers ({flowersCount})
                </span>
              </SelectItem>
              {availableStoreTags.map(tagValue => (
                <SelectItem key={tagValue} value={tagValue}>
                  <span className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-primary" />
                    {tagValue}
                    <span className="text-xs text-muted-foreground">
                      (
                      {
                        stores.filter(store =>
                          store.tags?.some(tag => tag.toLowerCase() === tagValue.toLowerCase())
                        ).length
                      }
                      )
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sticker Filter */}
          <Select value={stickerFilter} onValueChange={setStickerFilter}>
            <SelectTrigger className="w-52 bg-secondary/50 border-border/50">
              <Sticker className="h-4 w-4 mr-2" />
              <SelectValue placeholder={t('page.stores.filter_stickers') || 'Stickers'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('page.stores.all_sticker_status') || 'All Sticker Status'}</SelectItem>
              <SelectItem value="has_any">{t('page.stores.has_any_sticker') || 'Has Any Sticker'} ({stickerCounts.hasAny})</SelectItem>
              <SelectItem value="has_door">{t('page.stores.door_sticker') || 'Door Sticker'} ({stickerCounts.hasDoor})</SelectItem>
              <SelectItem value="has_instore">{t('page.stores.instore_sticker') || 'In-Store Sticker'} ({stickerCounts.hasInstore})</SelectItem>
              <SelectItem value="has_phone">{t('page.stores.phone_sticker') || 'Phone Sticker'} ({stickerCounts.hasPhone})</SelectItem>
              <SelectItem value="no_sticker">{t('page.stores.no_stickers') || 'No Stickers'} ({stickerCounts.noSticker})</SelectItem>
            </SelectContent>
          </Select>

          {/* Payment Type Filter */}
          <Select value={paymentTypeFilter} onValueChange={setPaymentTypeFilter}>
            <SelectTrigger className="w-48 bg-secondary/50 border-border/50">
              <CreditCard className="h-4 w-4 mr-2" />
              <SelectValue placeholder={t('page.stores.filter_payment') || 'Payment'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('page.stores.all_payment_types') || 'All Payment Types'}</SelectItem>
              <SelectItem value="pays_upfront">{t('page.stores.pays_upfront') || 'Pays Upfront'} ({paymentTypeCounts.paysUpfront})</SelectItem>
              <SelectItem value="bill_to_bill">{t('page.stores.bill_to_bill') || 'Bill to Bill'} ({paymentTypeCounts.billToBill})</SelectItem>
              <SelectItem value="not_set">{t('page.stores.not_set') || 'Not Set'} ({paymentTypeCounts.notSet})</SelectItem>
            </SelectContent>
          </Select>

          {/* Date Added Filter */}
          <Select value={monthFilter} onValueChange={(v) => { setMonthFilter(v); setShowCustomDate(v === 'custom'); }}>
            <SelectTrigger className="w-52 bg-secondary/50 border-border/50">
              <CalendarDays className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Date Added" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="months_ago_2">Last 2 Months</SelectItem>
              <SelectItem value="months_ago_3">Last 3 Months</SelectItem>
              <SelectItem value="months_ago_6">Last 6 Months</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
              <SelectItem value="custom">Custom Range…</SelectItem>
            </SelectContent>
          </Select>

          {/* Custom Date Range Inputs */}
          {showCustomDate && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={customDateFrom}
                onChange={(e) => setCustomDateFrom(e.target.value)}
                className="w-36 h-9 bg-secondary/50 border-border/50 text-sm"
                placeholder="From"
              />
              <span className="text-muted-foreground text-xs">to</span>
              <Input
                type="date"
                value={customDateTo}
                onChange={(e) => setCustomDateTo(e.target.value)}
                className="w-36 h-9 bg-secondary/50 border-border/50 text-sm"
                placeholder="To"
              />
            </div>
          )}

          {/* New Stores Filter */}
          <Button
            variant={newStoresOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setNewStoresOnly(!newStoresOnly)}
            className="h-9 gap-2"
          >
            <Sparkles className="h-4 w-4" />
            {t('page.stores.new_stores') || 'New Stores'} ({newStoresCount})
          </Button>

          {/* No Name Filter */}
          <Button
            variant={noNameFilter ? 'default' : 'outline'}
            size="sm"
            onClick={() => setNoNameFilter(!noNameFilter)}
            className="h-9 gap-2"
          >
            <Users className="h-4 w-4" />
            No Name ({noNameCount})
          </Button>

          {/* Active Filters Display */}
          {(activeFilter !== 'all' || tagFilter !== 'all' || stickerFilter !== 'all' || paymentTypeFilter !== 'all' || newStoresOnly || noNameFilter || monthFilter !== 'all') && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => { setActiveFilter('all'); setTagFilter('all'); setStickerFilter('all'); setPaymentTypeFilter('all'); setNewStoresOnly(false); setNoNameFilter(false); setMonthFilter('all'); setCustomDateFrom(''); setCustomDateTo(''); setShowCustomDate(false); }}
              className="text-muted-foreground"
            >
              {t('page.stores.clear_filters') || 'Clear filters'}
            </Button>
          )}
        </div>
      </div>

      {/* Pagination - Top */}
      {!isLoading && filteredStores.length > 0 && (
        <DataTablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredStores.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
          pageSizeOptions={[25, 50, 100, 250]}
        />
      )}

      {/* Stores Grid */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : (
        <>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {paginatedStores.map((store, index) => {
            // Group inventory by brand (case-insensitive) and sum counts
            const inventoryByBrand = (store.tubeInventory || []).reduce((acc, item) => {
              const brandKey = item.brand.toLowerCase();
              if (!acc[brandKey]) {
                acc[brandKey] = {
                  brand: item.brand,
                  totalCount: 0,
                };
              }
              acc[brandKey].totalCount += Math.max(0, item.current_tubes_left ?? 0);
              return acc;
            }, {} as Record<string, { brand: string; totalCount: number }>);

            const groupedInventory = Object.values(inventoryByBrand).sort((a, b) =>
              a.brand.localeCompare(b.brand)
            );

            return (
              <Card
                key={store.id}
                className="glass-card border-border/50 hover-lift hover-glow cursor-pointer"
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => navigate(`/stores/${store.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{store.owner_name || store.name}</CardTitle>
                      {store.owner_name && store.name !== store.owner_name && (
                        <p className="text-xs text-muted-foreground">{store.name}</p>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {store.type.replace('_', ' ')}
                      </Badge>
                    </div>
                  <div className="flex items-start gap-2">
                    <Checkbox
                      checked={selectedStoreIds.includes(store.id)}
                      onCheckedChange={(checked) => {
                        setSelectedStoreIds((prev) =>
                          checked
                            ? Array.from(new Set([...prev, store.id]))
                            : prev.filter((id) => id !== store.id)
                        );
                      }}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select ${store.name}`}
                      className="mt-1"
                    />
                    <Badge className={getStatusColor(store.status)}>
                      {store.status === 'needsFollowUp' ? 'Follow-up' : store.status}
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(event) => {
                        event.stopPropagation();
                        setDispatchStores([store.id]);
                      }}
                      aria-label={`Add ${store.name} to a route`}
                      title="Add to Route"
                    >
                      <RouteIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(event) => {
                        event.stopPropagation();
                        openEditStoreName(store);
                      }}
                      aria-label={`Edit ${store.name} name`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Full Address */}
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                    <div className="space-y-0.5">
                      {store.address_street ? (
                        <span className="block text-foreground">{store.address_street}</span>
                      ) : (
                        <span>No street address on file</span>
                      )}
                      {(store.address_city || store.address_state || store.address_zip) && (
                        <span className="block">
                          {[store.address_city, store.address_state].filter(Boolean).join(', ')}
                          {store.address_zip ? ` ${store.address_zip}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Phone Numbers - matching StoreContactInfoCard display */}
                  <div className="flex items-start gap-2 text-sm">
                    <Phone className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="flex-1">
                      {store.phone || store.alt_phone ? (
                        <div className="space-y-1">
                          {store.phone && (
                            <div className="flex items-center gap-2">
                              <span className="text-foreground">{store.phone}</span>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">Store</Badge>
                            </div>
                          )}
                          {store.alt_phone && (
                            <div className="flex items-center gap-2">
                              <span className="text-foreground">{store.alt_phone}</span>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-600 border-green-500/30">Cell</Badge>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No phone on file</span>
                      )}
                    </div>
                  </div>

                  {/* All Contacts */}
                  <div className="flex items-start gap-2 text-sm">
                    <Users className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                    <div className="flex-1">
                      <span className="text-muted-foreground text-xs">Contacts: </span>
                      {store.contacts && store.contacts.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {store.contacts.slice(0, 5).map((contact) => (
                            <Badge key={contact.id} variant="outline" className="text-xs flex items-center gap-1">
                              <span>{contact.name}</span>
                              {contact.role && (
                                <span className="text-muted-foreground">
                                  ({contact.role.toLowerCase()})
                                </span>
                              )}
                              {contact.phone && (
                                <ClickablePhone
                                  phone={contact.phone}
                                  entityType="customer"
                                  entityName={contact.name}
                                  className="ml-1"
                                />
                              )}
                            </Badge>
                          ))}
                          {store.contacts.length > 5 && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              +{store.contacts.length - 5} more
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="font-medium text-muted-foreground">Not on file</span>
                      )}
                    </div>
                  </div>

                  {groupedInventory.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {groupedInventory.map((item, idx) => (
                        <Badge key={`${item.brand}-${idx}`} className={`text-xs ${getBrandColor(item.brand)}`}>
                          {formatBrandName(item.brand)}: {item.totalCount}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Operations Tags */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {storeProductCounts[store.id] > 0 && (
                      <Badge className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                        <Package className="h-3 w-3 mr-1" />
                        {storeProductCounts[store.id]} Products
                      </Badge>
                    )}
                    {store.sells_flowers && (
                      <Badge className="text-xs bg-pink-500/10 text-pink-600 border-pink-500/30">
                        <Flower2 className="h-3 w-3 mr-1" />
                        Flowers
                      </Badge>
                    )}
                    {(store.sticker_door || store.sticker_instore || store.sticker_phone) && (
                      <Badge className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/30">
                        <Sticker className="h-3 w-3 mr-1" />
                        Sticker
                      </Badge>
                    )}
                    {store.connectedStoresCount > 0 && (
                      <Badge className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/30">
                        <Link className="h-3 w-3 mr-1" />
                        {store.connectedStoresCount} Connected
                      </Badge>
                    )}
                  </div>

                  {/* Tags */}
                  {store.tags && store.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {store.tags.slice(0, 3).map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {store.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{store.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}

                   {/* Last Order Snapshot — Full Brand Coverage */}
                   <div className="pt-2 space-y-1">
                     <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-1">
                       <ShoppingCart className="h-3 w-3" />
                       Last Order Snapshot
                     </p>
                     {(() => {
                       const snaps = losMap?.get(store.id);
                       if (!snaps || snaps.length === 0) {
                         return <p className="text-xs text-muted-foreground">No order data</p>;
                       }
                       return (
                         <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                           {snaps.map((snap) => {
                             const brand = snap.canonical_brand_id
                               ? getBrandIdentity(snap.canonical_brand_id)
                               : null;
                             return (
                               <div key={snap.brand_key} className="flex items-center justify-between text-xs">
                                 <span className="flex items-center gap-1 min-w-0">
                                   {brand && <span className="text-[10px]">{brand.icon}</span>}
                                   <span className={cn('truncate font-medium', brand?.textClass || 'text-muted-foreground')}>
                                     {brand?.shortName || brand?.displayName || snap.brand_name}
                                   </span>
                                 </span>
                                 <span className={cn(
                                   'text-[10px] shrink-0 ml-1',
                                   snap.is_placeholder ? 'text-muted-foreground italic' : 'text-foreground'
                                 )}>
                                   {snap.is_placeholder
                                     ? 'Never'
                                     : `${format(new Date(snap.last_order_date), 'MMM d')} · ${snap.last_order_size_label}`
                                   }
                                 </span>
                               </div>
                             );
                           })}
                         </div>
                       );
                     })()}
                   </div>

                   {/* Tube KPI Badge with Helper */}
                   <div className="pt-1 border-t border-border/50">
                     <CardHelper
                       summary={t('card.tube_inventory') || 'Tube inventory status across brands'}
                       details={t('card.tube_inventory.detail') || 'Updated during store visits. Shows stocked, ordered, and out-of-stock brands.'}
                       dataSource={t('card.tube_inventory.source') || 'v_store_tube_kpi'}
                       variant="inline"
                     />
                       <StoreKPIBadge
                         summary={tubeKPIMap?.get(store.id)}
                         isLoading={kpiLoading}
                         intelSummary={tubeIntelMap?.get(store.id)}
                       />
                       {(() => {
                         const ts = tubeSummaryMap.get(store.id);
                         const sold = Number(ts?.lifetime_tubes_delivered || 0);
                         const sold30 = Number(ts?.tubes_last_30_days || 0);
                         const onHand = Number(ts?.current_inventory_count || 0);
                         return (
                           <div className="flex items-center gap-3 mt-2 text-xs">
                             <span className="flex items-center gap-1 text-blue-600" title="On hand">
                               📦 <span className="font-mono font-semibold">{onHand.toLocaleString()}</span>
                               <span className="text-muted-foreground">on hand</span>
                             </span>
                             <span className="flex items-center gap-1 text-red-600" title="Lifetime sold">
                               🔥 <span className="font-mono font-semibold">{sold.toLocaleString()}</span>
                               <span className="text-muted-foreground">sold</span>
                             </span>
                             <span className="flex items-center gap-1 text-red-500" title="Last 30 days sold">
                               📈 <span className="font-mono font-semibold">{sold30.toLocaleString()}</span>
                               <span className="text-muted-foreground">30d</span>
                             </span>
                           </div>
                         );
                        })()}
                     </div>

                    {/* Inactive Store Triage — last_active_date + reactivation_priority */}
                    {!isStoreActive(store.id) && (store.last_active_date || store.reactivation_priority) && (
                      <div className="pt-2 border-t border-border/50 space-y-1.5">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Reactivation Triage
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {store.last_active_date && (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <CalendarDays className="h-3 w-3" />
                              Last active: {format(new Date(store.last_active_date), 'MMM d, yyyy')}
                            </span>
                          )}
                          {store.reactivation_priority && (
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px]',
                                store.reactivation_priority === 'easy_reorder' && 'bg-green-500/10 text-green-600 border-green-500/30',
                                store.reactivation_priority === 'warm_restart' && 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
                                store.reactivation_priority === 'cold_restart' && 'bg-red-500/10 text-red-600 border-red-500/30',
                              )}
                            >
                              {store.reactivation_priority.replace('_', ' ')}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                 </CardContent>
              </Card>
            );
          })}
        </div>
        
        {/* Pagination removed - moved to top */}
        </>
      )}

      {!isLoading && filteredStores.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">{t('page.stores.no_results') || 'No stores found matching your filters'}</p>
        </div>
      )}

      <Dialog
        open={Boolean(editingStore)}
        onOpenChange={(open) => {
          if (!open && !isSavingStoreName) {
            closeEditStoreName();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Store Name</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="store-name-input">Store Name</Label>
              <Input
                id="store-name-input"
                value={newStoreName}
                onChange={(event) => setNewStoreName(event.target.value)}
                placeholder="Enter store name"
                autoFocus
              />
            </div>
            {editingStore && (
              <div className="space-y-2">
                <Label>Relationship Status</Label>
                <RelationshipStatusSelect
                  storeId={editingStore.id}
                  value={editingStore.relationship_status}
                />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={closeEditStoreName}
              disabled={isSavingStoreName}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveStoreName}
              disabled={isSavingStoreName || !newStoreName.trim()}
            >
              {isSavingStoreName ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Store Modal */}
      <Dialog open={showAddStore} onOpenChange={(open) => {
        if (!open && !createStoreMutation.isPending) {
          setShowAddStore(false);
          resetNewStoreForm();
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Store</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateStore} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="new-store-name">Store Name *</Label>
                <Input
                  id="new-store-name"
                  value={newStoreData.name}
                  onChange={(e) => setNewStoreData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Store name"
                  autoFocus
                />
              </div>

              <div>
                <Label htmlFor="new-store-type">Store Type</Label>
                <Select
                  value={newStoreData.type}
                  onValueChange={(value) => setNewStoreData(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger id="new-store-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="smoke_shop">Smoke Shop</SelectItem>
                    <SelectItem value="bodega">Bodega</SelectItem>
                    <SelectItem value="gas_station">Gas Station</SelectItem>
                    <SelectItem value="wholesaler">Wholesaler</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="new-store-status">Status</Label>
                <Select
                  value={newStoreData.status}
                  onValueChange={(value) => setNewStoreData(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger id="new-store-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="needsFollowUp">Needs Follow-up</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="new-store-contact">Primary Contact</Label>
                <Input
                  id="new-store-contact"
                  value={newStoreData.primary_contact_name}
                  onChange={(e) => setNewStoreData(prev => ({ ...prev, primary_contact_name: e.target.value }))}
                  placeholder="Owner/Manager name"
                />
              </div>

              <div>
                <Label htmlFor="new-store-phone">Phone</Label>
                <Input
                  id="new-store-phone"
                  value={newStoreData.phone}
                  onChange={(e) => setNewStoreData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="(555) 555-5555"
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="new-store-address">Street Address</Label>
                <AddressAutocomplete
                  id="new-store-address"
                  value={newStoreData.address_street}
                  onChange={(val) => setNewStoreData(prev => ({ ...prev, address_street: val }))}
                  onSelect={(parsed) => setNewStoreData(prev => ({
                    ...prev,
                    address_street: parsed.street,
                    address_city: parsed.city,
                    address_state: parsed.state,
                    address_zip: parsed.zip,
                  }))}
                  placeholder="123 Main St"
                />
              </div>

              <div>
                <Label htmlFor="new-store-city">City</Label>
                <Input
                  id="new-store-city"
                  value={newStoreData.address_city}
                  onChange={(e) => setNewStoreData(prev => ({ ...prev, address_city: e.target.value }))}
                  placeholder="City"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="new-store-state">State</Label>
                  <Input
                    id="new-store-state"
                    value={newStoreData.address_state}
                    onChange={(e) => setNewStoreData(prev => ({ ...prev, address_state: e.target.value }))}
                    placeholder="NY"
                  />
                </div>
                <div>
                  <Label htmlFor="new-store-zip">ZIP</Label>
                  <Input
                    id="new-store-zip"
                    value={newStoreData.address_zip}
                    onChange={(e) => setNewStoreData(prev => ({ ...prev, address_zip: e.target.value }))}
                    placeholder="10001"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddStore(false);
                  resetNewStoreForm();
                }}
                disabled={createStoreMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createStoreMutation.isPending || !newStoreData.name.trim()}>
                {createStoreMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Store
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        open={showBulkUpload}
        onOpenChange={setShowBulkUpload}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['stores-with-contacts'] })}
      />

      {/* Dispatch — reuses working RouteAssignmentDialog with empty assignee so picker opens */}
      {dispatchStores && (
        <RouteAssignmentDialog
          open={!!dispatchStores}
          onOpenChange={(open) => {
            if (!open) {
              setDispatchStores(null);
              setSelectedStoreIds([]);
            }
          }}
          assigneeId=""
          assigneeName=""
          assigneeType="driver"
          assigneeUserId={null}
          bulkMode={dispatchStores.length > 1}
          preselectedStores={dispatchStores}
        />
      )}
    </div>
  );
};

export default Stores;
