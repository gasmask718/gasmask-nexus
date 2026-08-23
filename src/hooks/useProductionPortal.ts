/**
 * PRODUCTION PORTAL HOOKS
 * 
 * Central data fetching and mutations for the Production Portal.
 * Office-scoped manufacturing data with per-brand accountability.
 * Production-grade: variance tracking, day locking, attendance ledger.
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
  daily_box_goal?: number | null;
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

export type BrandInputs = Record<string, number>;

export type ProductType = 'tubes' | 'bags';

export interface ProductionBatch {
  id: string;
  office_id: string | null;
  brand: string;
  batch_date: string | null;
  shift_label: string | null;
  tobacco_lbs: number | null;
  tubes_total: number | null;
  boxes_produced: number | null;
  stickers_issued: BrandInputs | null;
  empty_boxes_issued: BrandInputs | null;
  stickers_used: Record<string, any> | null;
  empty_boxes_used: Record<string, any> | null;
  tools_used: any[] | null;
  workers_present: string[] | null;
  efficiency_pct: number | null;
  waste_lbs: number | null;
  status: string | null;
  notes: string | null;
  created_by: string | null;
  completed_at: string | null;
  created_at: string | null;
  // Product type (tubes or bags) — two-layer model
  product_type: ProductType;
  product_output_units: number | null;
  boxes_full: number | null;
  units_remainder: number | null;
  boxes_equivalent: number | null;
  // Time tracking
  production_start_timestamp: string | null;
  production_end_timestamp: string | null;
  production_time_minutes: number | null;
  changeover_minutes: number | null;
  net_production_minutes: number | null;
  // Variance fields
  is_locked: boolean | null;
  locked_at: string | null;
  locked_by: string | null;
  total_tubes_used: number | null;
  total_stickers_used: number | null;
  total_empty_boxes_used: number | null;
  total_defects: number | null;
  variance_tubes: number | null;
  variance_notes: string | null;
  // Time & Motion metrics
  tobacco_heatup_minutes: number | null;
  avg_tube_fill_seconds: number | null;
  avg_sticker_apply_seconds: number | null;
  // Cycle time tracking
  expected_completion_minutes: number | null;
  actual_completion_minutes: number | null;
  cycle_time_variance_pct: number | null;
  // Inventory state machine
  inventory_state: string;
  // Conversion snapshots
  conversion_units_per_lb_snapshot: number | null;
  conversion_lbs_per_unit_snapshot: number | null;
  conversion_boxes_per_lb_snapshot: number | null;
  time_per_unit_snapshot: number | null;
  time_per_box_snapshot: number | null;
  time_per_unit_net_snapshot: number | null;
  time_per_box_net_snapshot: number | null;
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
  defect_reason: string | null;
  defect_category: string | null;
  notes: string | null;
  created_at: string;
  // Worker attribution
  worker_id: string | null;
  sticker_worker_id: string | null;
  fill_worker_id: string | null;
  // Time & Motion
  tube_fill_seconds: number | null;
  sticker_apply_seconds: number | null;
  // Variance fields
  stickers_issued: number;
  empty_boxes_issued: number;
  variance_stickers: number;
  variance_boxes: number;
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

export interface ProductionDailyCloseout {
  id: string;
  office_id: string;
  close_date: string;
  closed_by: string;
  closed_at: string;
  unlocked_by: string | null;
  unlocked_at: string | null;
  is_locked: boolean;
  total_boxes: number;
  total_tobacco_lbs: number;
  total_tubes_used: number;
  total_defects: number;
  variance_summary: Record<string, any>;
  notes: string | null;
}

export interface WorkerAttendance {
  id: string;
  office_id: string;
  worker_id: string;
  batch_id: string | null;
  attendance_date: string;
  shift_label: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  hours_worked: number | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface DailyKPIs {
  totalBoxes: number;
  boxesByBrand: Record<string, number>;
  tobaccoUsed: number;
  tubesIssued: number;
  tubesUsed: number;
  tubesVariance: number;
  efficiencyPct: number;
  workersPresent: number;
  toolsOperational: number;
  toolsTotal: number;
  totalDefects: number;
  defectRate: number;
  isDayClosed: boolean;
}

export interface VarianceSummary {
  tubesIssued: number;
  tubesUsed: number;
  tubesVariance: number;
  stickersByBrand: Record<string, { issued: number; used: number; variance: number }>;
  boxesByBrand: Record<string, { issued: number; used: number; variance: number }>;
  expectedBoxes: number;
  actualBoxes: number;
  efficiencyPct: number;
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
export function useCreateOffice() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (office: Omit<ProductionOffice, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('production_offices')
        .insert(office)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-offices'] });
      toast({ title: 'Office created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create office', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateOffice() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProductionOffice> & { id: string }) => {
      const { data, error } = await supabase
        .from('production_offices')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-offices'] });
      toast({ title: 'Office updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update office', description: error.message, variant: 'destructive' });
    },
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
// WORKER ATTENDANCE HOOKS
// ============================================================

export function useWorkerAttendance(officeId: string | undefined, date?: Date) {
  const targetDate = date || new Date();
  const dateStr = format(targetDate, 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['worker-attendance', officeId, dateStr],
    queryFn: async (): Promise<(WorkerAttendance & { worker: ProductionWorker | null })[]> => {
      if (!officeId) return [];
      
      const { data, error } = await supabase
        .from('production_worker_attendance')
        .select('*')
        .eq('office_id', officeId)
        .eq('attendance_date', dateStr)
        .order('checked_in_at', { ascending: true });
      
      if (error) throw error;
      // Map to our expected interface
      return (data || []).map((d: any) => ({
        id: d.id,
        office_id: d.office_id || officeId,
        worker_id: d.worker_id,
        batch_id: d.batch_id,
        attendance_date: d.attendance_date || dateStr,
        shift_label: d.shift_label,
        checked_in_at: d.checked_in_at,
        checked_out_at: d.checked_out_at,
        hours_worked: d.hours_worked,
        notes: d.notes,
        recorded_by: d.recorded_by,
        created_at: d.created_at,
        worker: null, // Will be joined client-side if needed
      }));
    },
    enabled: !!officeId,
  });
}

export function useCheckInWorker() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      officeId, 
      workerId, 
      shiftLabel,
      batchId 
    }: { 
      officeId: string; 
      workerId: string; 
      shiftLabel?: string;
      batchId?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const now = new Date();
      
      const { data, error } = await supabase
        .from('production_worker_attendance')
        .insert({
          office_id: officeId,
          worker_id: workerId,
          batch_id: batchId || null,
          attendance_date: format(now, 'yyyy-MM-dd'),
          shift_label: shiftLabel || null,
          checked_in_at: now.toISOString(),
          recorded_by: userData.user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return { id: data.id, officeId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['worker-attendance', data.officeId] });
      queryClient.invalidateQueries({ queryKey: ['production-daily-kpis'] });
      toast({ title: 'Worker checked in' });
    },
    onError: (error: Error) => {
      toast({ title: 'Check-in failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useCheckOutWorker() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ attendanceId, officeId }: { attendanceId: string; officeId: string }) => {
      const now = new Date();
      
      // Get check-in time to calculate hours worked
      const { data: attendance } = await supabase
        .from('production_worker_attendance')
        .select('checked_in_at')
        .eq('id', attendanceId)
        .single();
      
      let hoursWorked = null;
      if (attendance?.checked_in_at) {
        const checkIn = new Date(attendance.checked_in_at);
        hoursWorked = Math.round((now.getTime() - checkIn.getTime()) / (1000 * 60 * 60) * 100) / 100;
      }
      
      const { data, error } = await supabase
        .from('production_worker_attendance')
        .update({
          checked_out_at: now.toISOString(),
          hours_worked: hoursWorked,
        })
        .eq('id', attendanceId)
        .select()
        .single();
      
      if (error) throw error;
      return { id: data.id, officeId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['worker-attendance', data.officeId] });
      toast({ title: 'Worker checked out' });
    },
    onError: (error: Error) => {
      toast({ title: 'Check-out failed', description: error.message, variant: 'destructive' });
    },
  });
}

// ============================================================
// BATCH HOOKS
// ============================================================

export function useProductionBatches(officeId: string | undefined, date?: Date) {
  // Use consistent date string for cache key
  const dateStr = date ? format(date, 'yyyy-MM-dd') : undefined;
  
  return useQuery({
    queryKey: ['production-batches', officeId, dateStr],
    queryFn: async () => {
      if (!officeId) return [];
      
      let query = supabase
        .from('production_batches')
        .select('*, office:production_offices(id, name)')
        .eq('office_id', officeId)
        .eq('is_test', false)
        .neq('status', 'cancelled') // Exclude cancelled batches
        .order('created_at', { ascending: false });
      
      if (dateStr) {
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
  // Use stable date string that doesn't change throughout the day
  const today = format(new Date(), 'yyyy-MM-dd');
  
  return useQuery({
    queryKey: ['production-batches', officeId, today],
    queryFn: async () => {
      if (!officeId) return [];
      
      const { data, error } = await supabase
        .from('production_batches')
        .select('*, office:production_offices(id, name)')
        .eq('office_id', officeId)
        .eq('batch_date', today)
        .eq('is_test', false)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as ProductionBatch[];
    },
    enabled: !!officeId,
  });
}

export function useCreateBatch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (batch: Partial<ProductionBatch>) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('production_batches')
        .insert([{
          office_id: batch.office_id,
          brand: batch.brand || 'gasmask',
          shift_label: batch.shift_label,
          tobacco_lbs: batch.tobacco_lbs,
          tubes_total: batch.tubes_total,
          stickers_issued: (batch.stickers_issued as Record<string, any>) || {},
          empty_boxes_issued: (batch.empty_boxes_issued as Record<string, any>) || {},
          workers_present: batch.workers_present,
          notes: batch.notes,
          status: batch.status || 'open',
          created_by: userData.user?.id,
          batch_date: batch.batch_date || format(new Date(), 'yyyy-MM-dd'),
          product_type: (batch as any).product_type || 'tubes',
          product_output_units: (batch as any).product_output_units || 0,
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      // Invalidate all batch queries for this office (with and without date filter)
      queryClient.invalidateQueries({ 
        queryKey: ['production-batches', variables.office_id],
        exact: false,
      });
      queryClient.invalidateQueries({ queryKey: ['production-daily-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['production-history'] });
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
      // Clean the updates to remove non-DB fields and convert types
      const cleanUpdates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.brand !== undefined) cleanUpdates.brand = updates.brand;
      if (updates.shift_label !== undefined) cleanUpdates.shift_label = updates.shift_label;
      if (updates.tobacco_lbs !== undefined) cleanUpdates.tobacco_lbs = updates.tobacco_lbs;
      if (updates.tubes_total !== undefined) cleanUpdates.tubes_total = updates.tubes_total;
      if (updates.stickers_issued !== undefined) cleanUpdates.stickers_issued = updates.stickers_issued;
      if (updates.empty_boxes_issued !== undefined) cleanUpdates.empty_boxes_issued = updates.empty_boxes_issued;
      if (updates.workers_present !== undefined) cleanUpdates.workers_present = updates.workers_present;
      if (updates.notes !== undefined) cleanUpdates.notes = updates.notes;
      if (updates.status !== undefined) cleanUpdates.status = updates.status;
      if (updates.completed_at !== undefined) cleanUpdates.completed_at = updates.completed_at;
      if (updates.is_locked !== undefined) cleanUpdates.is_locked = updates.is_locked;
      if (updates.product_type !== undefined) cleanUpdates.product_type = updates.product_type;
      if (updates.product_output_units !== undefined) cleanUpdates.product_output_units = updates.product_output_units;
      if (updates.changeover_minutes !== undefined) cleanUpdates.changeover_minutes = updates.changeover_minutes;
      if (updates.production_start_timestamp !== undefined) cleanUpdates.production_start_timestamp = updates.production_start_timestamp;
      if (updates.production_end_timestamp !== undefined) cleanUpdates.production_end_timestamp = updates.production_end_timestamp;
      if (updates.locked_at !== undefined) cleanUpdates.locked_at = updates.locked_at;
      if (updates.locked_by !== undefined) cleanUpdates.locked_by = updates.locked_by;
      
      const { data, error } = await supabase
        .from('production_batches')
        .update(cleanUpdates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['production-batches', data.office_id] });
      queryClient.invalidateQueries({ queryKey: ['production-daily-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['production-history'] });
      toast({ title: 'Batch updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update batch', description: error.message, variant: 'destructive' });
    },
  });
}

export function useLockBatch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ batchId, officeId }: { batchId: string; officeId: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('production_batches')
        .update({
          is_locked: true,
          locked_at: new Date().toISOString(),
          locked_by: userData.user?.id,
        })
        .eq('id', batchId)
        .select()
        .single();
      
      if (error) throw error;
      return { ...data, officeId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['production-batches', data.officeId] });
      queryClient.invalidateQueries({ queryKey: ['production-history'] });
      toast({ title: 'Batch locked' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to lock batch', description: error.message, variant: 'destructive' });
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
    mutationFn: async (output: {
      batch_id: string;
      brand: 'gasmask' | 'hotmama' | 'hotscolati' | 'grabba-rus';
      boxes_completed: number;
      tubes_used: number;
      stickers_used: number;
      empty_boxes_used: number;
      defects_count: number;
      defect_reason?: string | null;
      defect_category?: string | null;
      notes?: string | null;
      worker_id?: string | null;
      sticker_worker_id?: string | null;
      fill_worker_id?: string | null;
      tube_fill_seconds?: number | null;
      sticker_apply_seconds?: number | null;
      stickers_issued?: number;
      empty_boxes_issued?: number;
    }) => {
      // Calculate variance fields
      const variance_stickers = (output.stickers_issued || 0) - output.stickers_used;
      const variance_boxes = (output.empty_boxes_issued || 0) - output.empty_boxes_used;
      
      const { data, error } = await supabase
        .from('production_batch_outputs')
        .insert({
          batch_id: output.batch_id,
          brand: output.brand,
          boxes_completed: output.boxes_completed,
          tubes_used: output.tubes_used,
          stickers_used: output.stickers_used,
          empty_boxes_used: output.empty_boxes_used,
          defects_count: output.defects_count,
          defect_reason: output.defect_reason || null,
          defect_category: output.defect_category || null,
          notes: output.notes || null,
          worker_id: output.worker_id || null,
          sticker_worker_id: output.sticker_worker_id || null,
          fill_worker_id: output.fill_worker_id || null,
          tube_fill_seconds: output.tube_fill_seconds || null,
          sticker_apply_seconds: output.sticker_apply_seconds || null,
          stickers_issued: output.stickers_issued || 0,
          empty_boxes_issued: output.empty_boxes_issued || 0,
          variance_stickers,
          variance_boxes,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['production-batch-outputs', variables.batch_id] });
      queryClient.invalidateQueries({ queryKey: ['production-daily-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['production-batches'] });
      queryClient.invalidateQueries({ queryKey: ['production-history'] });
      queryClient.invalidateQueries({ queryKey: ['worker-skill-profiles'] });
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
// DAILY CLOSEOUT HOOKS
// ============================================================

export function useDailyCloseout(officeId: string | undefined, date?: Date) {
  const targetDate = date || new Date();
  const dateStr = format(targetDate, 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['production-closeout', officeId, dateStr],
    queryFn: async () => {
      if (!officeId) return null;
      
      const { data, error } = await supabase
        .from('production_daily_closeouts')
        .select('*')
        .eq('office_id', officeId)
        .eq('close_date', dateStr)
        .maybeSingle();
      
      if (error) throw error;
      return data as ProductionDailyCloseout | null;
    },
    enabled: !!officeId,
  });
}

export function useCloseDay() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      officeId, 
      date,
      summary 
    }: { 
      officeId: string; 
      date?: Date;
      summary: {
        totalBoxes: number;
        totalTobaccoLbs: number;
        totalTubesUsed: number;
        totalDefects: number;
        varianceSummary: Record<string, any>;
      };
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const closeDate = format(date || new Date(), 'yyyy-MM-dd');
      
      // Lock all batches for this day
      await supabase
        .from('production_batches')
        .update({ 
          is_locked: true, 
          locked_at: new Date().toISOString(),
          locked_by: userData.user?.id,
        })
        .eq('office_id', officeId)
        .eq('batch_date', closeDate)
        .eq('is_locked', false);
      
      // Create closeout record
      const { data, error } = await supabase
        .from('production_daily_closeouts')
        .insert({
          office_id: officeId,
          close_date: closeDate,
          closed_by: userData.user?.id,
          total_boxes: summary.totalBoxes,
          total_tobacco_lbs: summary.totalTobaccoLbs,
          total_tubes_used: summary.totalTubesUsed,
          total_defects: summary.totalDefects,
          variance_summary: summary.varianceSummary,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['production-closeout', data.office_id] });
      queryClient.invalidateQueries({ queryKey: ['production-batches', data.office_id] });
      queryClient.invalidateQueries({ queryKey: ['production-daily-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['production-history'] });
      toast({ title: 'Day closed successfully', description: 'All batches have been locked.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to close day', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUnlockDay() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ closeoutId, officeId }: { closeoutId: string; officeId: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('production_daily_closeouts')
        .update({
          is_locked: false,
          unlocked_by: userData.user?.id,
          unlocked_at: new Date().toISOString(),
        })
        .eq('id', closeoutId)
        .select()
        .single();
      
      if (error) throw error;
      
      // Also unlock batches for that day
      await supabase
        .from('production_batches')
        .update({ is_locked: false })
        .eq('office_id', officeId)
        .eq('batch_date', data.close_date);
      
      return { ...data, officeId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['production-closeout', data.officeId] });
      queryClient.invalidateQueries({ queryKey: ['production-batches', data.officeId] });
      toast({ title: 'Day unlocked', description: 'Batches can now be edited.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to unlock day', description: error.message, variant: 'destructive' });
    },
  });
}

// ============================================================
// DAILY KPI HOOK (ENHANCED WITH VARIANCE)
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
          tubesIssued: 0,
          tubesUsed: 0,
          tubesVariance: 0,
          efficiencyPct: 0,
          workersPresent: 0,
          toolsOperational: 0,
          toolsTotal: 0,
          totalDefects: 0,
          defectRate: 0,
          isDayClosed: false,
        };
      }

      // Get today's batches
      const { data: batches } = await supabase
        .from('production_batches')
        .select('id, tobacco_lbs, tubes_total, workers_present, total_tubes_used, total_defects, variance_tubes')
        .eq('office_id', officeId)
        .eq('batch_date', dateStr)
        .eq('is_test', false);

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

      // Get attendance count
      const attendanceResult = await supabase
        .from('production_worker_attendance')
        .select('id', { count: 'exact', head: true })
        .eq('office_id', officeId)
        .eq('attendance_date', dateStr);
      const attendanceCount = attendanceResult?.count || 0;

      // Check if day is closed
      const { data: closeout } = await supabase
        .from('production_daily_closeouts')
        .select('is_locked')
        .eq('office_id', officeId)
        .eq('close_date', dateStr)
        .maybeSingle();

      // Calculate KPIs
      const boxesByBrand: Record<string, number> = {};
      let totalBoxes = 0;
      let totalDefectsFromOutputs = 0;
      
      for (const output of outputs) {
        boxesByBrand[output.brand] = (boxesByBrand[output.brand] || 0) + output.boxes_completed;
        totalBoxes += output.boxes_completed;
        totalDefectsFromOutputs += output.defects_count || 0;
      }

      const tobaccoUsed = (batches || []).reduce((sum, b) => sum + (Number(b.tobacco_lbs) || 0), 0);
      const tubesIssued = (batches || []).reduce((sum, b) => sum + (Number(b.tubes_total) || 0), 0);
      const tubesUsed = (batches || []).reduce((sum, b) => sum + (Number(b.total_tubes_used) || 0), 0);
      const tubesVariance = tubesIssued - tubesUsed;
      const totalDefects = (batches || []).reduce((sum, b) => sum + (Number(b.total_defects) || 0), 0);
      
      // Unique workers across all batches (legacy) + attendance ledger
      const allWorkers = new Set<string>();
      (batches || []).forEach(b => {
        (b.workers_present || []).forEach((w: string) => allWorkers.add(w));
      });
      const workersPresent = Math.max(allWorkers.size, attendanceCount || 0);

      const toolsTotal = (tools || []).reduce((sum, t) => sum + (t.quantity || 0), 0);
      const toolsOperational = (tools || []).reduce((sum, t) => sum + (t.operational_count || 0), 0);

      // Calculate efficiency and defect rate
      const expectedBoxes = tubesUsed / 20;
      const efficiencyPct = expectedBoxes > 0 ? Math.round((totalBoxes / expectedBoxes) * 100) : 0;
      const defectRate = totalBoxes > 0 ? Math.round((totalDefects / totalBoxes) * 100 * 10) / 10 : 0;

      return {
        totalBoxes,
        boxesByBrand,
        tobaccoUsed,
        tubesIssued,
        tubesUsed,
        tubesVariance,
        efficiencyPct,
        workersPresent,
        toolsOperational,
        toolsTotal,
        totalDefects,
        defectRate,
        isDayClosed: closeout?.is_locked || false,
      };
    },
    enabled: !!officeId,
  });
}

// ============================================================
// VARIANCE SUMMARY HOOK
// ============================================================

export function useVarianceSummary(officeId: string | undefined, date?: Date) {
  const targetDate = date || new Date();
  const dateStr = format(targetDate, 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['production-variance', officeId, dateStr],
    queryFn: async (): Promise<VarianceSummary> => {
      if (!officeId) {
        return {
          tubesIssued: 0,
          tubesUsed: 0,
          tubesVariance: 0,
          stickersByBrand: {},
          boxesByBrand: {},
          expectedBoxes: 0,
          actualBoxes: 0,
          efficiencyPct: 0,
        };
      }

      // Get batches with their issued inputs
      const { data: batches } = await supabase
        .from('production_batches')
        .select('id, tubes_total, stickers_issued, empty_boxes_issued, total_tubes_used')
        .eq('office_id', officeId)
        .eq('batch_date', dateStr);

      const batchIds = (batches || []).map(b => b.id);

      // Get outputs
      let outputs: ProductionBatchOutput[] = [];
      if (batchIds.length > 0) {
        const { data } = await supabase
          .from('production_batch_outputs')
          .select('*')
          .in('batch_id', batchIds);
        outputs = (data || []) as ProductionBatchOutput[];
      }

      // Calculate totals
      const tubesIssued = (batches || []).reduce((sum, b) => sum + (Number(b.tubes_total) || 0), 0);
      const tubesUsed = (batches || []).reduce((sum, b) => sum + (Number(b.total_tubes_used) || 0), 0);
      
      // Aggregate per-brand stickers and boxes issued from batches
      const stickersByBrand: Record<string, { issued: number; used: number; variance: number }> = {};
      const boxesByBrand: Record<string, { issued: number; used: number; variance: number }> = {};
      
      const brands = ['gasmask', 'hotmama', 'hotscolati', 'grabba-rus'];
      brands.forEach(brand => {
        let stickersIssued = 0;
        let emptyBoxesIssued = 0;
        
        (batches || []).forEach(b => {
          const si = b.stickers_issued as BrandInputs;
          const ebi = b.empty_boxes_issued as BrandInputs;
          stickersIssued += si?.[brand as keyof BrandInputs] || 0;
          emptyBoxesIssued += ebi?.[brand as keyof BrandInputs] || 0;
        });
        
        const brandOutputs = outputs.filter(o => o.brand === brand);
        const stickersUsed = brandOutputs.reduce((sum, o) => sum + (o.stickers_used || 0), 0);
        const emptyBoxesUsed = brandOutputs.reduce((sum, o) => sum + (o.empty_boxes_used || 0), 0);
        
        stickersByBrand[brand] = {
          issued: stickersIssued,
          used: stickersUsed,
          variance: stickersIssued - stickersUsed,
        };
        
        boxesByBrand[brand] = {
          issued: emptyBoxesIssued,
          used: emptyBoxesUsed,
          variance: emptyBoxesIssued - emptyBoxesUsed,
        };
      });

      const actualBoxes = outputs.reduce((sum, o) => sum + o.boxes_completed, 0);
      const expectedBoxes = tubesUsed / 20;
      const efficiencyPct = expectedBoxes > 0 ? Math.round((actualBoxes / expectedBoxes) * 100) : 0;

      return {
        tubesIssued,
        tubesUsed,
        tubesVariance: tubesIssued - tubesUsed,
        stickersByBrand,
        boxesByBrand,
        expectedBoxes: Math.round(expectedBoxes),
        actualBoxes,
        efficiencyPct,
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

// ============================================================
// COMMUNICATION LOG HOOK
// ============================================================

export function useProductionCommunications(officeId: string | undefined, limit = 50) {
  return useQuery({
    queryKey: ['production-communications', officeId, limit],
    queryFn: async () => {
      if (!officeId) return [];
      
      const { data, error } = await supabase
        .from('production_communication_log')
        .select('*, worker:production_workers(id, full_name)')
        .eq('office_id', officeId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!officeId,
  });
}

export function useLogCommunication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (log: {
      officeId: string;
      workerId?: string;
      batchId?: string;
      channel: 'sms' | 'whatsapp' | 'call';
      phoneUsed: string;
      messageBody?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('production_communication_log')
        .insert({
          office_id: log.officeId,
          worker_id: log.workerId || null,
          batch_id: log.batchId || null,
          channel: log.channel,
          phone_used: log.phoneUsed,
          message_body: log.messageBody || null,
          sent_by: userData.user?.id,
          status: 'queued',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['production-communications', data.office_id] });
      queryClient.invalidateQueries({ queryKey: ['production-history', data.office_id] });
    },
  });
}

// ============================================================
// OFFICE ASSIGNMENT HOOKS (office leader scoping)
// ============================================================

export interface OfficeAssignment {
  id: string;
  office_id: string;
  user_id: string;
  role: string;
  is_primary: boolean;
  active: boolean;
}

/** Offices the current user is assigned to (production_office_users). */
export function useMyOfficeAssignments() {
  return useQuery({
    queryKey: ['my-office-assignments'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return [];
      const { data, error } = await supabase
        .from('production_office_users')
        .select('*')
        .eq('user_id', userData.user.id)
        .eq('active', true);
      if (error) throw error;
      return (data || []) as OfficeAssignment[];
    },
  });
}

// ============================================================
// ISSUANCE LEDGER — shipments HQ → office
// ============================================================

export interface ShipmentItem {
  id: string;
  shipment_id: string;
  material_type: 'tobacco' | 'empty_tubes' | 'stickers' | 'sleeves' | 'empty_boxes' | 'tools' | 'other';
  brand: string | null;
  quantity: number;
  unit: 'lb' | 'kg' | 'each' | 'roll';
  unit_cost: number | null;
  total_cost: number | null;
  expected_yield_boxes: number | null;
  received_quantity: number | null;
}

export interface OfficeShipment {
  id: string;
  office_id: string;
  sent_date: string;
  sent_by: string | null;
  status: 'sent' | 'received' | 'disputed';
  notes: string | null;
  received_at: string | null;
  received_by: string | null;
  created_at: string;
  items?: ShipmentItem[];
}

export function useOfficeShipments(officeId: string | undefined) {
  return useQuery({
    queryKey: ['office-shipments', officeId],
    queryFn: async () => {
      if (!officeId) return [];
      const { data, error } = await (supabase
        .from('production_office_shipments') as any)
        .select('*, items:production_office_shipment_items(*)')
        .eq('office_id', officeId)
        .order('sent_date', { ascending: false });
      if (error) throw error;
      return (data || []) as OfficeShipment[];
    },
    enabled: !!officeId,
  });
}

export function useCreateShipment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      officeId: string;
      sentDate: string;
      notes?: string;
      items: Array<Omit<ShipmentItem, 'id' | 'shipment_id' | 'received_quantity'>>;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data: shipment, error: shipErr } = await (supabase
        .from('production_office_shipments') as any)
        .insert({
          office_id: params.officeId,
          sent_date: params.sentDate,
          sent_by: userData.user?.id || null,
          notes: params.notes || null,
          status: 'sent',
        })
        .select()
        .single();
      if (shipErr) throw shipErr;

      if (params.items.length > 0) {
        const { error: itemErr } = await (supabase
          .from('production_office_shipment_items') as any)
          .insert(params.items.map(i => ({ ...i, shipment_id: shipment.id })));
        if (itemErr) throw itemErr;
      }
      return shipment as OfficeShipment;
    },
    onSuccess: (shipment) => {
      queryClient.invalidateQueries({ queryKey: ['office-shipments', shipment.office_id] });
      queryClient.invalidateQueries({ queryKey: ['office-material-balance'] });
      toast({ title: 'Shipment recorded' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to record shipment', description: error.message, variant: 'destructive' });
    },
  });
}

/** Office leader confirms receipt: sets received quantities + variance. */
export function useConfirmShipmentReceipt() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      shipmentId: string;
      officeId: string;
      receivedQuantities: Record<string, number>; // item_id -> received qty
      disputed?: boolean;
      notes?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();

      for (const [itemId, qty] of Object.entries(params.receivedQuantities)) {
        const { error } = await (supabase
          .from('production_office_shipment_items') as any)
          .update({ received_quantity: qty })
          .eq('id', itemId);
        if (error) throw error;
      }

      const { error } = await (supabase
        .from('production_office_shipments') as any)
        .update({
          status: params.disputed ? 'disputed' : 'received',
          received_at: new Date().toISOString(),
          received_by: userData.user?.id || null,
          notes: params.notes || undefined,
        })
        .eq('id', params.shipmentId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['office-shipments', vars.officeId] });
      queryClient.invalidateQueries({ queryKey: ['office-material-balance'] });
      toast({ title: vars.disputed ? 'Shipment disputed' : 'Receipt confirmed' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to confirm receipt', description: error.message, variant: 'destructive' });
    },
  });
}

// ============================================================
// OFFICE MATERIAL BALANCE (issued − consumed)
// ============================================================

export interface OfficeMaterialBalance {
  office_id: string;
  office_name: string | null;
  material_type: string;
  brand: string | null;
  unit: string | null;
  total_issued: number;
  total_received: number;
  total_consumed: number;
  expected_on_hand: number;
  total_issued_cost: number;
}

export function useOfficeMaterialBalance(officeId: string | undefined) {
  return useQuery({
    queryKey: ['office-material-balance', officeId],
    queryFn: async () => {
      if (!officeId) return [];
      const { data, error } = await (supabase
        .from('v_office_material_balance') as any)
        .select('*')
        .eq('office_id', officeId);
      if (error) throw error;
      return (data || []) as OfficeMaterialBalance[];
    },
    enabled: !!officeId,
  });
}
