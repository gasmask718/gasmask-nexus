/**
 * useRealEstatePipelineLeads
 * ---------------------------------------------------------------
 * Dedicated hook for /dynasty-connect/pipelines/real-estate.
 *
 * The real Real Estate ingestion pipeline (re-intake-webhook) writes to
 * `re_leads` (richer schema: arv, mao, deal_score, contract_signed_at, ...),
 * NOT `dc_leads`. This hook queries `re_leads` and reshapes each row into
 * the DCLead-compatible shape the shared PipelineLeadTable / PipelineStats
 * components already expect — so the page renders without changes to any
 * shared component.
 *
 * IMPORTANT: Do not change `usePipelineLeads.ts`. Every other pipeline
 * page (Surplus Funds, Unforgettable Times, PlayBoxxx, ...) must keep
 * querying `dc_leads` as before.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { DCLead } from './usePipelineLeads';

const BUSINESS_NAME = 'Dynasty Real Estate';

// Statuses that count as "contacted" for win-rate math.
const CONTACTED = [
  'called', 'interested', 'booked', 'not_interested', 'not-interested',
  'callback', 'voicemail', 'no_answer', 'wrong_number',
  'contract_sent', 'contract_signed',
];

function mapReLeadToDCLead(row: any): DCLead {
  return {
    id: row.id,
    business_name: BUSINESS_NAME,
    first_name: row.first_name || '',
    last_name: row.last_name || '',
    phone: row.phone || '',
    email: row.email || undefined,
    address: row.property_address || '',
    city: row.city || undefined,
    state: row.state || undefined,
    zip: row.zip || undefined,
    lead_type: row.lead_type || undefined,
    lead_source: row.lead_source || undefined,
    status: row.status || 'new',
    notes: row.notes || undefined,
    call_count: row.call_count ?? 0,
    last_called_at: row.last_called_at || undefined,
    outcome: row.call_outcome || undefined,
    campaign_id: row.dc_campaign_id || undefined,
    external_ref_id: row.realestateapi_property_id || undefined,
    metadata: {
      estimated_value: row.estimated_value,
      arv: row.arv,
      mao: row.mao,
      deal_score: row.deal_score,
      motivation: row.motivation,
      timeline: row.timeline,
      interest_level: row.interest_level,
      interest_score: row.interest_score,
      contract_signed_at: row.contract_signed_at,
    },
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function useRealEstatePipelineLeads(statusFilter?: string) {
  const queryClient = useQueryClient();
  const queryKey = ['re-leads-pipeline', statusFilter];

  const { data: leads = [], isLoading, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      let q = (supabase as any)
        .from('re_leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (statusFilter && statusFilter !== 'all') {
        q = q.eq('status', statusFilter);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []).map(mapReLeadToDCLead) as DCLead[];
    },
  });

  const uploadCSV = async (
    file: File,
    mapFn?: (row: any) => Record<string, any>,
  ) => {
    const text = await file.text();
    const lines = text.trim().split('\n');
    if (lines.length < 2) {
      toast.error('CSV must have header + data rows');
      return 0;
    }

    const headers = lines[0]
      .split(',')
      .map(h => h.trim().toLowerCase().replace(/['"]/g, ''));

    const rows: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i]
        .split(',')
        .map(v => v.trim().replace(/^["']|["']$/g, ''));
      const obj: any = {};
      headers.forEach((h, idx) => {
        obj[h] = vals[idx] || '';
      });

      const mapped = mapFn ? mapFn(obj) : {
        first_name: obj.first_name || obj.owner_first || '',
        last_name: obj.last_name || obj.owner_last || '',
        phone: obj.phone || obj.phone_number || '',
        email: obj.email || '',
        address: obj.address || obj.property_address || '',
        city: obj.city || '',
        state: obj.state || '',
        zip: obj.zip || obj.zipcode || '',
        metadata: {
          estimated_value: obj.value || obj.estimated_value || '',
          arv: obj.arv || '',
        },
      };

      // Map DCLead-shaped upload payload → re_leads columns.
      const property_address = mapped.address || (mapped as any).property_address;
      if (!property_address || !mapped.phone) continue;

      const md: any = (mapped as any).metadata || {};
      const num = (v: any) =>
        v === '' || v == null ? null : Number(String(v).replace(/[^0-9.\-]/g, '')) || null;

      rows.push({
        first_name: mapped.first_name || null,
        last_name: mapped.last_name || null,
        phone: mapped.phone,
        email: mapped.email || null,
        property_address,
        city: mapped.city || null,
        state: mapped.state || null,
        zip: mapped.zip || null,
        estimated_value: num(md.estimated_value),
        arv: num(md.arv),
        status: 'new',
        lead_source: 'csv_upload',
      });
    }

    if (rows.length === 0) {
      toast.error('No valid leads found in CSV (need phone + address)');
      return 0;
    }

    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const { error } = await (supabase as any).from('re_leads').insert(chunk);
      if (error) throw error;
    }

    queryClient.invalidateQueries({ queryKey: ['re-leads-pipeline'] });
    toast.success(`Uploaded ${rows.length} leads`);
    return rows.length;
  };

  const sendToCampaign = useMutation({
    mutationFn: async (leadIds: string[]) => {
      const { data: campaign, error: campErr } = await supabase
        .from('ai_call_campaigns')
        .insert({
          name: `${BUSINESS_NAME} — ${new Date().toLocaleDateString()}`,
          target_segment: BUSINESS_NAME,
          status: 'draft',
          total_targets: leadIds.length,
        })
        .select('id')
        .single();
      if (campErr) throw campErr;

      const { error: updateErr } = await (supabase as any)
        .from('re_leads')
        .update({
          dc_campaign_id: campaign.id,
          status: 'queued',
          updated_at: new Date().toISOString(),
        })
        .in('id', leadIds);
      if (updateErr) throw updateErr;

      return campaign.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['re-leads-pipeline'] });
      toast.success('Campaign created with selected leads');
    },
    onError: (e: any) => toast.error('Failed: ' + e.message),
  });

  const calledCount = leads.filter(l => CONTACTED.includes(l.status)).length;
  const bookedCount = leads.filter(
    l => l.status === 'booked' || !!(l.metadata as any)?.contract_signed_at,
  ).length;
  const interestedCount = leads.filter(l => l.status === 'interested').length;

  const stats = {
    total: leads.length,
    new: leads.filter(l => l.status === 'new').length,
    called: calledCount,
    interested: interestedCount,
    booked: bookedCount,
    winRate: calledCount > 0
      ? (((interestedCount + bookedCount) / calledCount) * 100).toFixed(1)
      : '0.0',
  };

  return { leads, isLoading, refetch, uploadCSV, sendToCampaign, stats };
}
