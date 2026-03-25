import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DCLead {
  id: string;
  business_name: string;
  business_id?: string;
  first_name?: string;
  last_name?: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  lead_type?: string;
  lead_source?: string;
  status: string;
  notes?: string;
  call_count: number;
  last_called_at?: string;
  outcome?: string;
  campaign_id?: string;
  external_ref_id?: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export function usePipelineLeads(businessName: string, statusFilter?: string) {
  const queryClient = useQueryClient();
  const queryKey = ['dc-leads', businessName, statusFilter];

  const { data: leads = [], isLoading, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      let q = (supabase as any)
        .from('dc_leads')
        .select('*')
        .eq('business_name', businessName)
        .order('created_at', { ascending: false })
        .limit(500);
      if (statusFilter && statusFilter !== 'all') {
        q = q.eq('status', statusFilter);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as DCLead[];
    },
  });

  const addLead = useMutation({
    mutationFn: async (lead: Partial<DCLead>) => {
      const { error } = await (supabase as any).from('dc_leads').insert({
        ...lead,
        business_name: businessName,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dc-leads', businessName] });
      toast.success('Lead added');
    },
    onError: (e: any) => toast.error('Failed: ' + e.message),
  });

  const uploadCSV = async (file: File, mapFn?: (row: any) => Partial<DCLead>) => {
    const text = await file.text();
    const lines = text.trim().split('\n');
    if (lines.length < 2) { toast.error('CSV must have header + data rows'); return 0; }
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    const rows: Partial<DCLead>[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
      const obj: any = {};
      headers.forEach((h, idx) => { obj[h] = vals[idx] || ''; });
      
      const mapped = mapFn ? mapFn(obj) : {
        first_name: obj.first_name || obj.firstname || obj.name?.split(' ')[0] || '',
        last_name: obj.last_name || obj.lastname || obj.name?.split(' ').slice(1).join(' ') || '',
        phone: obj.phone || obj.phone_number || obj.mobile || '',
        email: obj.email || '',
        address: obj.address || obj.street || '',
        city: obj.city || '',
        state: obj.state || '',
        zip: obj.zip || obj.zipcode || obj.postal_code || '',
      };
      
      if (mapped.phone) {
        rows.push({ ...mapped, business_name: businessName, status: 'new', lead_source: 'csv_upload' });
      }
    }
    
    if (rows.length === 0) { toast.error('No valid leads found in CSV'); return 0; }
    
    // Batch insert in chunks of 100
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const { error } = await (supabase as any).from('dc_leads').insert(chunk);
      if (error) throw error;
    }
    
    queryClient.invalidateQueries({ queryKey: ['dc-leads', businessName] });
    toast.success(`Uploaded ${rows.length} leads`);
    return rows.length;
  };

  const sendToCampaign = useMutation({
    mutationFn: async (leadIds: string[]) => {
      // Create campaign
      const { data: campaign, error: campErr } = await supabase.from('ai_call_campaigns').insert({
        name: `${businessName} — ${new Date().toLocaleDateString()}`,
        target_segment: businessName,
        status: 'draft',
        total_targets: leadIds.length,
      }).select('id').single();
      if (campErr) throw campErr;
      
      // Update leads with campaign_id and status
      const { error: updateErr } = await (supabase as any)
        .from('dc_leads')
        .update({ campaign_id: campaign.id, status: 'queued', updated_at: new Date().toISOString() })
        .in('id', leadIds);
      if (updateErr) throw updateErr;
      
      return campaign.id;
    },
    onSuccess: (campaignId) => {
      queryClient.invalidateQueries({ queryKey: ['dc-leads', businessName] });
      toast.success('Campaign created with selected leads');
    },
    onError: (e: any) => toast.error('Failed: ' + e.message),
  });

  const stats = {
    total: leads.length,
    new: leads.filter(l => l.status === 'new').length,
    called: leads.filter(l => ['called', 'interested', 'booked', 'not-interested', 'callback'].includes(l.status)).length,
    interested: leads.filter(l => l.status === 'interested').length,
    booked: leads.filter(l => l.status === 'booked').length,
    winRate: leads.filter(l => ['called', 'interested', 'booked', 'not-interested', 'callback'].includes(l.status)).length > 0
      ? ((leads.filter(l => ['booked', 'interested'].includes(l.status)).length / 
          leads.filter(l => ['called', 'interested', 'booked', 'not-interested', 'callback'].includes(l.status)).length) * 100).toFixed(1)
      : '0.0',
  };

  return { leads, isLoading, refetch, addLead, uploadCSV, sendToCampaign, stats };
}
