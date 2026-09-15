/**
 * PRODUCTION FLOOR OPS — returns to HQ + tool/equipment problem reports.
 *
 * Both tables are office-scoped by RLS: an office manager only ever sees and
 * writes rows for the office(s) they are assigned to. HQ (core staff) sees all
 * and is the only side that can confirm a return as received.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ── RETURNS ────────────────────────────────────────────────────────────────

export type ReturnType =
  | 'unused_material'
  | 'finished_goods'
  | 'damaged'
  | 'tool_equipment'
  | 'other';

export type ReturnStatus = 'submitted' | 'received' | 'rejected' | 'cancelled';

export interface OfficeReturn {
  id: string;
  office_id: string;
  return_type: ReturnType;
  item_name: string;
  material_type: string | null;
  brand: string | null;
  quantity: number;
  unit: string;
  item_condition: string | null;
  reason: string | null;
  notes: string | null;
  status: ReturnStatus;
  initiated_by: string;
  initiated_at: string;
  received_quantity: number | null;
  received_by: string | null;
  received_at: string | null;
  hq_notes: string | null;
  created_at: string;
}

export const RETURN_TYPE_LABEL: Record<ReturnType, string> = {
  unused_material: 'Unused materials',
  finished_goods: 'Finished boxes / products',
  damaged: 'Damaged items',
  tool_equipment: 'Tool / equipment',
  other: 'Other',
};

/** officeId omitted → every office the caller may see (HQ view). */
export function useOfficeReturns(officeId?: string, status?: ReturnStatus | 'all') {
  return useQuery({
    queryKey: ['production-office-returns', officeId ?? 'all', status ?? 'all'],
    queryFn: async () => {
      let q = (supabase.from('production_office_returns') as any)
        .select('*')
        .order('initiated_at', { ascending: false })
        .limit(200);
      if (officeId) q = q.eq('office_id', officeId);
      if (status && status !== 'all') q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as OfficeReturn[];
    },
  });
}

export function useCreateReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      office_id: string;
      return_type: ReturnType;
      item_name: string;
      material_type?: string | null;
      brand?: string | null;
      quantity: number;
      unit: string;
      item_condition?: string | null;
      reason?: string | null;
      notes?: string | null;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not signed in');
      const { data, error } = await (supabase.from('production_office_returns') as any)
        .insert({ ...payload, initiated_by: userData.user.id, status: 'submitted' })
        .select()
        .single();
      if (error) throw error;
      return data as OfficeReturn;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production-office-returns'] });
      toast.success('Return sent to HQ');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** HQ confirms (or rejects) a return. Original record is preserved. */
export function useConfirmReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: string;
      status: 'received' | 'rejected';
      received_quantity?: number | null;
      hq_notes?: string | null;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await (supabase.from('production_office_returns') as any)
        .update({
          status: params.status,
          received_quantity: params.received_quantity ?? null,
          hq_notes: params.hq_notes ?? null,
          received_by: userData.user?.id ?? null,
          received_at: new Date().toISOString(),
        })
        .eq('id', params.id)
        .select()
        .single();
      if (error) throw error;
      return data as OfficeReturn;
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['production-office-returns'] });
      toast.success(d.status === 'received' ? 'Return received' : 'Return rejected');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── TOOL / EQUIPMENT PROBLEM REPORTS ───────────────────────────────────────

export type ToolIssueType = 'damage' | 'fault' | 'missing' | 'maintenance' | 'other';
export type ToolIssueStatus = 'open' | 'acknowledged' | 'resolved' | 'closed';

export interface ToolIssue {
  id: string;
  office_id: string;
  tool_id: string | null;
  equipment_assignment_id: string | null;
  tool_name: string;
  issue_type: ToolIssueType;
  severity: 'low' | 'normal' | 'high';
  description: string;
  status: ToolIssueStatus;
  reported_by: string;
  reported_at: string;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
}

export const ISSUE_TYPE_LABEL: Record<ToolIssueType, string> = {
  damage: 'Damaged',
  fault: 'Not working right',
  missing: 'Missing',
  maintenance: 'Needs service',
  other: 'Other',
};

export function useToolIssues(officeId?: string, status?: ToolIssueStatus | 'all') {
  return useQuery({
    queryKey: ['production-tool-issues', officeId ?? 'all', status ?? 'all'],
    queryFn: async () => {
      let q = (supabase.from('production_tool_issues') as any)
        .select('*')
        .order('reported_at', { ascending: false })
        .limit(200);
      if (officeId) q = q.eq('office_id', officeId);
      if (status && status !== 'all') q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as ToolIssue[];
    },
  });
}

export function useReportToolIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      office_id: string;
      tool_id?: string | null;
      equipment_assignment_id?: string | null;
      tool_name: string;
      issue_type: ToolIssueType;
      severity?: 'low' | 'normal' | 'high';
      description: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not signed in');
      const { data, error } = await (supabase.from('production_tool_issues') as any)
        .insert({
          ...payload,
          severity: payload.severity || 'normal',
          reported_by: userData.user.id,
          status: 'open',
        })
        .select()
        .single();
      if (error) throw error;
      return data as ToolIssue;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production-tool-issues'] });
      toast.success('Problem reported to HQ');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useResolveToolIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; status: ToolIssueStatus; resolution_notes?: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const done = params.status === 'resolved' || params.status === 'closed';
      const { data, error } = await (supabase.from('production_tool_issues') as any)
        .update({
          status: params.status,
          resolution_notes: params.resolution_notes ?? null,
          resolved_by: done ? userData.user?.id ?? null : null,
          resolved_at: done ? new Date().toISOString() : null,
        })
        .eq('id', params.id)
        .select()
        .single();
      if (error) throw error;
      return data as ToolIssue;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production-tool-issues'] });
      toast.success('Issue updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── PREVIOUS DAYS (closed-day history for one office) ──────────────────────

export interface ClosedDay {
  id: string;
  close_date: string;
  total_boxes: number | null;
  total_tobacco_lbs: number | null;
  total_tubes_used: number | null;
  total_defects: number | null;
  is_locked: boolean | null;
  closed_at: string | null;
  closed_by: string | null;
  notes: string | null;
}

export function useOfficeClosedDays(officeId: string | undefined, limit = 14) {
  return useQuery({
    queryKey: ['production-closed-days', officeId, limit],
    queryFn: async () => {
      if (!officeId) return [];
      const { data, error } = await supabase
        .from('production_daily_closeouts')
        .select('id, close_date, total_boxes, total_tobacco_lbs, total_tubes_used, total_defects, is_locked, closed_at, closed_by, notes')
        .eq('office_id', officeId)
        .order('close_date', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as ClosedDay[];
    },
    enabled: !!officeId,
  });
}

// ── MANAGED OFFICES (production_office_managers) ───────────────────────────
// An office manager may be recorded as a manager rather than an office user.
// Both count as "my office" for scoping the manager workspace.

export function useMyManagedOffices() {
  return useQuery({
    queryKey: ['my-managed-offices'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return [] as string[];
      const { data, error } = await (supabase.from('production_office_managers') as any)
        .select('office_id')
        .eq('user_id', userData.user.id);
      if (error) throw error;
      return ((data || []) as { office_id: string }[]).map((r) => r.office_id);
    },
  });
}
