import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DeliveryStopIntelligence {
  store: {
    id: string;
    name: string;
    address: string;
    phone: string | null;
    boro: string | null;
    neighborhood: string | null;
  };
  intelligence: {
    lifetime_tubes: number;
    lifetime_revenue: number;
    invoice_count: number;
    top_brand: string | null;
    last_order_date: string | null;
    days_since_last: number | null;
    flow_status: string | null;
  };
  recommendation: {
    recommended_boxes: number | null;
    recommended_brand: string | null;
    estimated_revenue: number | null;
    reason: string | null;
    confidence_level: 'high' | 'medium' | 'low' | null;
  };
  recent_comms: Array<{
    id: string;
    channel: string;
    direction: string;
    summary: string;
    outcome: string | null;
    created_at: string;
  }>;
  special_notes: Array<{
    type: 'pinned_note' | 'follow_up';
    content: string;
    created_at: string;
  }>;
}

export function useDeliveryStopIntelligence(
  storeId: string | null | undefined,
  routeStopId?: string,
) {
  return useQuery({
    queryKey: ['delivery-stop-intelligence', storeId, routeStopId],
    enabled: !!storeId,
    staleTime: 60_000,
    queryFn: async (): Promise<DeliveryStopIntelligence> => {
      if (!storeId) throw new Error('storeId required');

      const [
        storeRes,
        tubeRes,
        flowRes,
        commsRes,
        followUpsRes,
        notesRes,
        recRes,
      ] = await Promise.all([
        supabase
          .from('stores')
          .select('id, name, address_street, address_city, phone, boro, neighborhood')
          .eq('id', storeId)
          .maybeSingle(),
        supabase
          .from('v_store_tube_summary')
          .select('lifetime_tubes_sold, lifetime_invoice_revenue, invoice_count, top_brand, last_tube_transaction_at')
          .eq('store_id', storeId)
          .maybeSingle(),
        supabase
          .from('v_prior_customer_segments')
          .select('flow_status, days_since_last_order, last_order_date')
          .eq('store_id', storeId)
          .maybeSingle(),
        supabase
          .from('communication_logs')
          .select('id, channel, direction, summary, outcome, created_at')
          .eq('store_id', storeId)
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('follow_up_queue')
          .select('id, reason, recommended_action, due_at, status')
          .eq('store_id', storeId)
          .eq('status', 'open')
          .order('due_at', { ascending: true })
          .limit(2),
        supabase
          .from('store_notes')
          .select('id, note_text, created_at')
          .eq('store_id', storeId)
          .order('created_at', { ascending: false })
          .limit(3),
        supabase.functions
          .invoke('tube-replenishment-ai', { body: { storeId } })
          .catch((e) => ({ data: null, error: e })),
      ]);

      const store: any = storeRes.data ?? {};
      const summary: any = tubeRes.data ?? {};
      const flow: any = flowRes.data ?? {};
      const recData: any = (recRes as any)?.data ?? {};
      const topRec = recData?.recommendations?.[0] ?? null;
      const confidence: 'high' | 'medium' | 'low' | null =
        recData?.analysis?.price_verification?.verification_confidence ?? null;

      const recent_comms = (commsRes.data ?? []).map((c: any) => ({
        id: c.id,
        channel: c.channel ?? 'unknown',
        direction: c.direction ?? 'outbound',
        summary: c.summary ?? '',
        outcome: c.outcome ?? null,
        created_at: c.created_at,
      }));

      const special_notes: DeliveryStopIntelligence['special_notes'] = [
        ...(notesRes.data ?? []).map((n: any) => ({
          type: 'pinned_note' as const,
          content: n.note_text ?? '',
          created_at: n.created_at,
        })),
        ...(followUpsRes.data ?? []).map((f: any) => ({
          type: 'follow_up' as const,
          content: `Open follow-up: ${f.reason ?? f.recommended_action ?? 'pending'} (due ${
            f.due_at ? new Date(f.due_at).toLocaleDateString() : 'soon'
          })`,
          created_at: f.due_at ?? new Date().toISOString(),
        })),
      ];

      const days_since_last =
        flow?.days_since_last_order ??
        (summary?.last_tube_transaction_at
          ? Math.floor((Date.now() - new Date(summary.last_tube_transaction_at).getTime()) / 86_400_000)
          : null);

      return {
        store: {
          id: store?.id ?? storeId,
          name: store?.name ?? 'Unknown Store',
          address: [store?.address_street, store?.address_city].filter(Boolean).join(', '),
          phone: store?.phone ?? null,
          boro: store?.boro ?? null,
          neighborhood: store?.neighborhood ?? null,
        },
        intelligence: {
          lifetime_tubes: Number(summary?.lifetime_tubes_sold ?? 0),
          lifetime_revenue: Number(summary?.lifetime_invoice_revenue ?? 0),
          invoice_count: Number(summary?.invoice_count ?? 0),
          top_brand: summary?.top_brand ?? null,
          last_order_date: summary?.last_tube_transaction_at ?? flow?.last_order_date ?? null,
          days_since_last,
          flow_status: flow?.flow_status ?? null,
        },
        recommendation: {
          recommended_boxes: topRec?.recommended_boxes ?? null,
          recommended_brand: topRec?.brand ?? null,
          estimated_revenue: topRec?.estimated_revenue ?? null,
          reason: topRec?.reason ?? null,
          confidence_level: confidence,
        },
        recent_comms,
        special_notes,
      };
    },
  });
}
