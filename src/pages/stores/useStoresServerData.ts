/**
 * Phase 2A Win 2 — server-side dual path for the Stores grid.
 *
 * Fetches:
 *   1. leanStores — id + count-source columns for ALL live stores (~150KB
 *      vs ~5MB for the full-fetch mapper). Powers header/chip counts.
 *   2. tagCounts  — one grouped query over tag_attachments/global_tags.
 *   3. pageRows   — filtered + paginated rows + aux joins narrowed to the
 *      current page's IDs. Uses supabase-js filters that mirror the parity
 *      harness in /tmp/parity/harness.py.
 *
 * All queries are gated by `enabled` so the legacy full-fetch remains
 * usable as a fallback when USE_SERVER_PATH is flipped off.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Force select strings to be typed as plain `string` so tsc does not
// exponentially parse them (see /docs "query builder type performance").
const sel = (s: string): string => s;

export interface LeanStore {
  id: string;
  name: string;
  owner_name: string | null;
  sticker_door: boolean;
  sticker_instore: boolean;
  sticker_phone: boolean;
  sells_flowers: false;
  payment_type: null;
  created_at: string | null;
  relationship_status: string | null;
  tags: never[];
  [k: string]: any;
}

export interface UseStoresServerDataArgs {
  enabled: boolean;
  simulationMode: boolean;
  searchQuery: string;
  activeFilter: 'all' | 'active' | 'inactive';
  relationshipFilter: string;
  tagFilter: string;
  stickerFilter: string;
  paymentTypeFilter: string;
  noNameFilter: boolean;
  newStoresOnly: boolean;
  monthFilter: string;
  customDateFrom: string;
  customDateTo: string;
  currentPage: number;
  pageSize: number;
  activeStoreIds: Set<string>;
  storeIdsWithNotes: Set<string>;
  reviewFilter?: 'all' | 'admin_yes' | 'admin_no' | 'va_yes' | 'va_no' | 'needs_review';
}

export function useStoresServerData(args: UseStoresServerDataArgs) {
  const { enabled, simulationMode } = args;

  // ── (1) Lean fetch — count-source columns for ALL live stores. ────
  const leanQ = useQuery({
    queryKey: ['stores-lean', simulationMode],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      let all: any[] = [];
      const CHUNK = 1000;
      for (let page = 0; ; page++) {
        const { data, error } = await (supabase as any)
          .from('store_master')
          .select(sel('id, store_name, owner_name, sticker_on_door, sticker_in_store, sticker_with_phone, relationship_status, created_at'))
          .eq('is_simulation', simulationMode)
          .is('deleted_at', null)
          .order('store_name')
          .range(page * CHUNK, (page + 1) * CHUNK - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < CHUNK) break;
      }
      return all.map((r: any): LeanStore => ({
        id: r.id,
        name: r.store_name || '',
        owner_name: r.owner_name || null,
        sticker_door: !!r.sticker_on_door,
        sticker_instore: !!r.sticker_in_store,
        sticker_phone: !!r.sticker_with_phone,
        sells_flowers: false,
        payment_type: null,
        created_at: r.created_at || null,
        relationship_status: r.relationship_status || 'Non-active (New - need to speak)',
        tags: [],
      }));
    },
  });

  // ── (2) Global tag counts (one grouped query). ─────────────────────
  const tagCountsQ = useQuery({
    queryKey: ['stores-tag-counts'],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('tag_attachments')
        .select(sel('entity_id, global_tags!inner(name)'))
        .eq('entity_type', 'store');
      if (error) throw error;
      const map = new Map<string, number>();
      const seen = new Set<string>();
      for (const r of (data ?? [])) {
        const name: string | undefined = r?.global_tags?.name;
        if (!name) continue;
        const k = `${r.entity_id}|${name.toLowerCase()}`;
        if (seen.has(k)) continue;
        seen.add(k);
        const lk = name.toLowerCase();
        map.set(lk, (map.get(lk) ?? 0) + 1);
      }
      return map;
    },
  });

  // ── (3) Page fetch — filtered + paginated + hydrated. ──────────────
  const pageQ = useQuery({
    queryKey: [
      'stores-server-page',
      simulationMode,
      {
        s: args.searchQuery, a: args.activeFilter, r: args.relationshipFilter,
        t: args.tagFilter, k: args.stickerFilter, p: args.paymentTypeFilter,
        nn: args.noNameFilter, no: args.newStoresOnly, m: args.monthFilter,
        df: args.customDateFrom, dt: args.customDateTo,
        pg: args.currentPage, sz: args.pageSize,
        aids: args.activeStoreIds.size,
        nids: args.storeIdsWithNotes.size,
        rv: args.reviewFilter ?? 'all',
      },
    ],
    enabled,
    staleTime: 30_000,
    placeholderData: (prev: any) => prev,
    queryFn: async () => {
      // Impossible-result short-circuits (parity with in-memory: sells_flowers
      // + payment_type aren't mapped from any source, so any positive filter
      // there returns zero rows).
      if (
        args.tagFilter === 'flowers' ||
        (args.paymentTypeFilter !== 'all' && args.paymentTypeFilter !== 'not_set')
      ) {
        return { rows: [] as any[], total: 0 };
      }

      // Preresolve tag-attached IDs when filtering by a real tag.
      let tagIds: string[] | null = null;
      if (args.tagFilter !== 'all') {
        const { data, error } = await (supabase as any)
          .from('tag_attachments')
          .select(sel('entity_id, global_tags!inner(name)'))
          .eq('entity_type', 'store')
          .ilike('global_tags.name', args.tagFilter);
        if (error) throw error;
        tagIds = Array.from(new Set((data ?? []).map((r: any) => r.entity_id)));
        if (tagIds.length === 0) return { rows: [], total: 0 };
      }

      // Preresolve tag-search matches so the .or() below can OR them in.
      let searchTagIds: string[] = [];
      if (args.searchQuery) {
        const pat = `%${args.searchQuery}%`;
        const { data } = await (supabase as any)
          .from('tag_attachments')
          .select(sel('entity_id, global_tags!inner(name)'))
          .eq('entity_type', 'store')
          .ilike('global_tags.name', pat);
        searchTagIds = Array.from(new Set((data ?? []).map((r: any) => r.entity_id)));
      }

      const from = (args.currentPage - 1) * args.pageSize;
      const to = from + args.pageSize - 1;

      let qb: any = (supabase as any)
        .from('store_master')
        .select(sel('*'), { count: 'exact' })
        .eq('is_simulation', simulationMode)
        .is('deleted_at', null)
        .order('store_name')
        .range(from, to);

      // ── search ────────────────────────────────────────────────────
      if (args.searchQuery) {
        // strip characters that would confuse the .or() DSL (comma and parens
        // are top-level separators); apostrophes/spaces are fine.
        const s = args.searchQuery.replace(/[,()]/g, ' ').trim();
        if (s) {
          const clauses = [
            `store_name.ilike.%${s}%`,
            `address.ilike.%${s}%`,
            `city.ilike.%${s}%`,
            `state.ilike.%${s}%`,
            `zip.ilike.%${s}%`,
            `phone.ilike.%${s}%`,
            `owner_name.ilike.%${s}%`,
          ];
          if (searchTagIds.length) {
            clauses.push(`id.in.(${searchTagIds.join(',')})`);
          }
          qb = qb.or(clauses.join(','));
        }
      }

      // ── active / inactive (via MV set) ────────────────────────────
      if (args.activeFilter === 'active') {
        const ids = Array.from(args.activeStoreIds);
        if (ids.length === 0) return { rows: [], total: 0 };
        qb = qb.in('id', ids);
      } else if (args.activeFilter === 'inactive') {
        const ids = Array.from(args.activeStoreIds);
        if (ids.length > 0) qb = qb.not('id', 'in', `(${ids.join(',')})`);
      }

      // ── relationship ──────────────────────────────────────────────
      if (args.relationshipFilter !== 'all') {
        qb = qb.eq('relationship_status', args.relationshipFilter);
      }

      // ── tag (non-flowers) ─────────────────────────────────────────
      if (tagIds) {
        qb = qb.in('id', tagIds);
      }

      // ── sticker ───────────────────────────────────────────────────
      switch (args.stickerFilter) {
        case 'has_door':    qb = qb.eq('sticker_on_door', true); break;
        case 'has_instore': qb = qb.eq('sticker_in_store', true); break;
        case 'has_phone':   qb = qb.eq('sticker_with_phone', true); break;
        case 'has_any':
          qb = qb.or('sticker_on_door.eq.true,sticker_in_store.eq.true,sticker_with_phone.eq.true');
          break;
        case 'no_sticker':
          qb = qb.eq('sticker_on_door', false).eq('sticker_in_store', false).eq('sticker_with_phone', false);
          break;
      }

      // ── no_name (mirrors: null OR '' OR trim.lower === 'no name') ─
      if (args.noNameFilter) {
        qb = qb.or('store_name.is.null,store_name.eq.,store_name.ilike.no name');
      }

      // ── new_stores_only (no notes OR created today) ───────────────
      if (args.newStoresOnly) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const noteIds = Array.from(args.storeIdsWithNotes);
        if (noteIds.length === 0) {
          // every store qualifies as "new" (no notes); no extra filter.
        } else {
          qb = qb.or(`id.not.in.(${noteIds.join(',')}),created_at.gte.${todayStart.toISOString()}`);
        }
      }

      // ── month ─────────────────────────────────────────────────────
      const now = new Date();
      if (args.monthFilter === 'this_month') {
        qb = qb.gte('created_at', new Date(now.getFullYear(), now.getMonth(), 1).toISOString());
      } else if (args.monthFilter === 'this_year') {
        qb = qb.gte('created_at', new Date(now.getFullYear(), 0, 1).toISOString());
      } else if (args.monthFilter.startsWith('months_ago_')) {
        const n = parseInt(args.monthFilter.slice('months_ago_'.length), 10);
        qb = qb.gte('created_at', new Date(now.getFullYear(), now.getMonth() - n, 1).toISOString());
      } else if (args.monthFilter === 'custom') {
        if (args.customDateFrom) qb = qb.gte('created_at', new Date(args.customDateFrom).toISOString());
        if (args.customDateTo)   qb = qb.lte('created_at', new Date(args.customDateTo + 'T23:59:59').toISOString());
      }

      const { data, count, error } = await qb;
      if (error) throw error;

      const rows = (data ?? []) as any[];
      if (rows.length === 0) return { rows: [], total: count ?? 0 };
      const ids = rows.map((r) => r.id);

      // Hydrate aux data for the visible page only.
      const [tagsRes, contactsRes, tubesRes, legacyRes] = await Promise.all([
        (supabase as any).from('tag_attachments').select(sel('entity_id, global_tags(id, name)')).eq('entity_type', 'store').in('entity_id', ids),
        (supabase as any).from('store_contacts').select(sel('id, store_id, name, role, phone, can_receive_sms, is_primary')).in('store_id', ids),
        (supabase as any).from('store_tube_inventory').select(sel('id, store_id, brand, current_tubes_left')).in('store_id', ids).neq('brand', 'hotscolatti'),
        (supabase as any).from('stores').select(sel('id, phone, alt_phone, status, last_active_date, reactivation_priority')).in('id', ids),
      ]);

      const tagsByStore: Record<string, string[]> = {};
      for (const t of (tagsRes.data ?? [])) {
        if (!t.global_tags?.name) continue;
        (tagsByStore[t.entity_id] ??= []).push(t.global_tags.name);
      }
      const contactsByStore: Record<string, any[]> = {};
      for (const c of (contactsRes.data ?? [])) {
        (contactsByStore[c.store_id] ??= []).push(c);
      }
      const tubeByStore: Record<string, any[]> = {};
      for (const it of (tubesRes.data ?? [])) {
        (tubeByStore[it.store_id] ??= []).push({
          id: it.id, brand: it.brand, current_tubes_left: it.current_tubes_left,
        });
      }
      const legacyByStore: Record<string, any> = {};
      for (const l of (legacyRes.data ?? [])) legacyByStore[l.id] = l;

      const mapped = rows.map((store: any) => {
        const legacy = legacyByStore[store.id];
        return {
          id: store.id,
          name: store.store_name || '',
          type: store.store_type || '',
          address_street: store.address || '',
          address_city: store.city || '',
          address_state: store.state || '',
          address_zip: store.zip || '',
          phone: store.phone ? String(store.phone) : (legacy?.phone ? String(legacy.phone) : ''),
          alt_phone: legacy?.alt_phone ? String(legacy.alt_phone) : null,
          email: store.email || null,
          status: legacy?.status || 'active',
          tags: tagsByStore[store.id] || [],
          sells_flowers: false,
          sticker_status: '',
          sticker_door: !!store.sticker_on_door,
          sticker_instore: !!store.sticker_in_store,
          sticker_phone: !!store.sticker_with_phone,
          sticker_notes: store.sticker_notes || null,
          payment_type: null,
          contacts: contactsByStore[store.id] || [],
          tubeInventory: tubeByStore[store.id] || [],
          owner_name: store.owner_name || null,
          connectedStoresCount: 0, // patched by caller from lean owner-map
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
          last_active_date: legacy?.last_active_date || null,
          reactivation_priority: legacy?.reactivation_priority || null,
          relationship_status: store.relationship_status || 'Non-active (New - need to speak)',
        };
      });

      return { rows: mapped, total: count ?? mapped.length };
    },
  });

  return {
    leanStores: (leanQ.data ?? []) as LeanStore[],
    pageRows: (pageQ.data?.rows ?? []) as any[],
    pageTotal: pageQ.data?.total ?? 0,
    tagCounts: (tagCountsQ.data ?? new Map<string, number>()),
    isLoading: (enabled && (leanQ.isLoading || pageQ.isLoading)),
    isFetching: pageQ.isFetching,
  };
}
