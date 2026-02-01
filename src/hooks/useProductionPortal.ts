/**
 * PRODUCTION PORTAL HOOKS
 * 
 * Central data fetching and mutations for the Production Portal.
 * Office-scoped manufacturing data with per-brand accountability.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, startOfDay, endOfDay } from 'date-fns';

// ============================================================
// TYPES
// ============================================================

export interface ProductionOffice {
  id: string;
  name: string;
  location: string | null;
  address_line_1: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  operating_hours: Record<string, any> | null;
  status: string;
  active: boolean;
  created_at: string;
}

export interface ProductionWorker {
  id: string;
  office_id: string;
  full_name: string;
  role: 'packer' | 'shredder' | 'qc' | 'supervisor' | 'machine_operator' | 'laborer';
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  status: 'active' | 'inactive' | 'on_leave';
  hire_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface ProductionBatch {
  id: string;
  office_id: string;
  brand: string;
  batch_date: string;
  shift_label: string | null;
  tobacco_lbs: number;
  tubes_total: number | null;
  boxes_produced: number | null;
  stickers_used: Record<string, any> | null;
  empty_boxes_used: Record<string, any> | null;
  tools_used: any[] | null;
  workers_present: string[] | null;
  efficiency_pct: number | null;
  waste_lbs: number | null;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  notes: string | null;
  created_by: string | null;
  completed_at: string | null;
  created_at: string;
  office?: { id: string; name: string } | null;
}

export interface ProductionBatchOutput {
  id: string;
  batch_id: string;
  brand: 'gasmask' | 'hotmama' | 'hotscolati' | 'grabba-rus';
  boxes_completed: number;
  tubes_used: number;
  stickers_used: number;
  empty_boxes_used: number;
  defects_count: number;
  notes: string | null;
  created_at: string;
}

export interface ProductionOfficeTool {
  id: string;
  office_id: string;
  tool_type: 'heat_gun' | 'tobacco_shredder' | 'label_printer' | 'scale' | 'packaging_machine' | 'other';
  tool_name: string;
  quantity: number;
  operational_count: number;
  status: 'operational' | 'needs_repair' | 'out_of_service';
  last_service_date: string | null;
  next_service_date: string | null;
  notes: string | null;
}

export interface ProductionHistory {
  id: string;
  office_id: string | null;
  batch_id: string | null;
  event_type: string;
  event_data: Record<string, any>;
  performed_by: string | null;
  created_at: string;
}

export interface DailyKPIs {
  totalBoxes: number;
  boxesByBrand: Record<string, number>;
  tobaccoUsed: number;
  efficiencyPct: number;
  workersPresent: number;
  toolsOperational: number;
  toolsTotal: number;
}

// ============================================================
// OFFICE HOOKS
// ============================================================

export function useProductionOffices() {
  return useQuery({
    queryKey: ['production-offices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('production_offices')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return (data || []) as ProductionOffice[];
    },
  });
}

export function useProductionOffice(officeId: string | undefined) {
  return useQuery({
    queryKey: ['production-office', officeId],
    queryFn: async () => {
      if (!officeId) return null;
      
      const { data, error } = await supabase
        .from('production_offices')
        .select('*')
        .eq('id', officeId)
        .single();
      
      if (error) throw error;
      return data as ProductionOffice;
    },
    enabled: !!officeId,
  });
}

// ============================================================
// WORKER HOOKS
// ============================================================

export function useProductionWorkers(officeId: string | undefined) {
  return useQuery({
    queryKey: ['production-workers', officeId],
    queryFn: async () => {
      if (!officeId) return [];
      
      const { data, error } = await supabase
        .from('production_workers')
        .select('*')
        .eq('office_id', officeId)
        .order('full_name');
      
      if (error) throw error;
      return (data || []) as ProductionWorker[];
    },
    enabled: !!officeId,
  });
}

export function useCreateWorker() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (worker: Omit<ProductionWorker, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('production_workers')
        .insert(worker)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['production-workers', variables.office_id] });
      toast({ title: 'Worker added successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to add worker', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateWorker() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProductionWorker> & { id: string }) => {
      const { data, error } = await supabase
        .from('production_workers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['production-workers', data.office_id] });
      toast({ title: 'Worker updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update worker', description: error.message, variant: 'destructive' });
    },
  });
}

// ============================================================
// BATCH HOOKS
// ============================================================

export function useProductionBatches(officeId: string | undefined, date?: Date) {
  return useQuery({
    queryKey: ['production-batches', officeId, date?.toISOString()],
    queryFn: async () => {
      if (!officeId) return [];
      
      let query = supabase
        .from('production_batches')
        .select('*, office:production_offices(id, name)')
        .eq('office_id', officeId)
        .order('created_at', { ascending: false });
      
      if (date) {
        const dateStr = format(date, 'yyyy-MM-dd');
        query = query.eq('batch_date', dateStr);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ProductionBatch[];
    },
    enabled: !!officeId,
  });
}

export function useTodayBatches(officeId: string | undefined) {
  const today = new Date();
  return useProductionBatches(officeId, today);
}

export function useCreateBatch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (batch: Partial<ProductionBatch>) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('production_batches')
        .insert({
          office_id: batch.office_id,
          brand: batch.brand || 'gasmask',
          shift_label: batch.shift_label,
          tobacco_lbs: batch.tobacco_lbs,
          tubes_total: batch.tubes_total,
          workers_present: batch.workers_present,
          notes: batch.notes,
          status: batch.status || 'open',
          created_by: userData.user?.id,
          batch_date: batch.batch_date || format(new Date(), 'yyyy-MM-dd'),
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['production-batches', variables.office_id] });
      queryClient.invalidateQueries({ queryKey: ['production-daily-kpis'] });
      toast({ title: 'Batch created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create batch', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateBatch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProductionBatch> & { id: string }) => {
      const { data, error } = await supabase
        .from('production_batches')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['production-batches', data.office_id] });
      queryClient.invalidateQueries({ queryKey: ['production-daily-kpis'] });
      toast({ title: 'Batch updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update batch', description: error.message, variant: 'destructive' });
    },
  });
}

// ============================================================
// BATCH OUTPUT HOOKS
// ============================================================

export function useBatchOutputs(batchId: string | undefined) {
  return useQuery({
    queryKey: ['production-batch-outputs', batchId],
    queryFn: async () => {
      if (!batchId) return [];
      
      const { data, error } = await supabase
        .from('production_batch_outputs')
        .select('*')
        .eq('batch_id', batchId)
        .order('brand');
      
      if (error) throw error;
      return (data || []) as ProductionBatchOutput[];
    },
    enabled: !!batchId,
  });
}

export function useRecordOutput() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (output: Omit<ProductionBatchOutput, 'id' | 'created_at'>) => {
      // Upsert: update if exists, insert if not
      const { data, error } = await supabase
        .from('production_batch_outputs')
        .upsert(output, { onConflict: 'batch_id,brand' })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['production-batch-outputs', variables.batch_id] });
      queryClient.invalidateQueries({ queryKey: ['production-daily-kpis'] });
      toast({ title: 'Output recorded successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to record output', description: error.message, variant: 'destructive' });
    },
  });
}

// ============================================================
// TOOL HOOKS
// ============================================================

export function useOfficeTools(officeId: string | undefined) {
  return useQuery({
    queryKey: ['production-tools', officeId],
    queryFn: async () => {
      if (!officeId) return [];
      
      const { data, error } = await supabase
        .from('production_office_tools')
        .select('*')
        .eq('office_id', officeId)
        .order('tool_name');
      
      if (error) throw error;
      return (data || []) as ProductionOfficeTool[];
    },
    enabled: !!officeId,
  });
}

export function useCreateTool() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (tool: Omit<ProductionOfficeTool, 'id'>) => {
      const { data, error } = await supabase
        .from('production_office_tools')
        .insert(tool)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['production-tools', variables.office_id] });
      toast({ title: 'Tool added successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to add tool', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateTool() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProductionOfficeTool> & { id: string }) => {
      const { data, error } = await supabase
        .from('production_office_tools')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['production-tools', data.office_id] });
      toast({ title: 'Tool updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update tool', description: error.message, variant: 'destructive' });
    },
  });
}

// ============================================================
// DAILY KPI HOOK
// ============================================================

export function useDailyKPIs(officeId: string | undefined, date?: Date) {
  const targetDate = date || new Date();
  const dateStr = format(targetDate, 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['production-daily-kpis', officeId, dateStr],
    queryFn: async (): Promise<DailyKPIs> => {
      if (!officeId) {
        return {
          totalBoxes: 0,
          boxesByBrand: {},
          tobaccoUsed: 0,
          efficiencyPct: 0,
          workersPresent: 0,
          toolsOperational: 0,
          toolsTotal: 0,
        };
      }

      // Get today's batches
      const { data: batches } = await supabase
        .from('production_batches')
        .select('id, tobacco_lbs, workers_present')
        .eq('office_id', officeId)
        .eq('batch_date', dateStr);

      const batchIds = (batches || []).map(b => b.id);

      // Get outputs for today's batches
      let outputs: ProductionBatchOutput[] = [];
      if (batchIds.length > 0) {
        const { data } = await supabase
          .from('production_batch_outputs')
          .select('*')
          .in('batch_id', batchIds);
        outputs = (data || []) as ProductionBatchOutput[];
      }

      // Get tools
      const { data: tools } = await supabase
        .from('production_office_tools')
        .select('quantity, operational_count')
        .eq('office_id', officeId);

      // Calculate KPIs
      const boxesByBrand: Record<string, number> = {};
      let totalBoxes = 0;
      
      for (const output of outputs) {
        boxesByBrand[output.brand] = (boxesByBrand[output.brand] || 0) + output.boxes_completed;
        totalBoxes += output.boxes_completed;
      }

      const tobaccoUsed = (batches || []).reduce((sum, b) => sum + (Number(b.tobacco_lbs) || 0), 0);
      
      // Unique workers across all batches
      const allWorkers = new Set<string>();
      (batches || []).forEach(b => {
        (b.workers_present || []).forEach((w: string) => allWorkers.add(w));
      });

      const toolsTotal = (tools || []).reduce((sum, t) => sum + (t.quantity || 0), 0);
      const toolsOperational = (tools || []).reduce((sum, t) => sum + (t.operational_count || 0), 0);

      // Calculate average efficiency
      const totalTubes = outputs.reduce((sum, o) => sum + (o.tubes_used || 0), 0);
      const expectedBoxes = totalTubes / 20;
      const efficiencyPct = expectedBoxes > 0 ? Math.round((totalBoxes / expectedBoxes) * 100) : 0;

      return {
        totalBoxes,
        boxesByBrand,
        tobaccoUsed,
        efficiencyPct,
        workersPresent: allWorkers.size,
        toolsOperational,
        toolsTotal,
      };
    },
    enabled: !!officeId,
  });
}

// ============================================================
// HISTORY HOOK
// ============================================================

export function useProductionHistory(officeId: string | undefined, limit = 50) {
  return useQuery({
    queryKey: ['production-history', officeId, limit],
    queryFn: async () => {
      if (!officeId) return [];
      
      const { data, error } = await supabase
        .from('production_history')
        .select('*')
        .eq('office_id', officeId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return (data || []) as ProductionHistory[];
    },
    enabled: !!officeId,
  });
}
