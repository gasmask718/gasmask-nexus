import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Types
export interface Driver {
  id: string;
  business_id: string;
  user_id?: string;
  full_name: string;
  phone?: string;
  email?: string;
  vehicle_type?: string;
  license_number?: string;
  home_base?: string;
  status: string;
  payout_method?: string;
  payout_handle?: string;
  created_at: string;
  updated_at: string;
}

export interface Biker {
  id: string;
  business_id: string;
  user_id?: string;
  full_name: string;
  phone?: string;
  email?: string;
  territory?: string;
  status: string;
  payout_method?: string;
  payout_handle?: string;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: string;
  business_id: string;
  location_type: string;
  name: string;
  address_line1?: string;
  city?: string;
  state?: string;
  zip?: string;
  lat?: number;
  lng?: number;
  contact_name?: string;
  contact_phone?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Delivery {
  id: string;
  business_id: string;
  delivery_type: string;
  created_by_user_id?: string;
  scheduled_date: string;
  priority: string;
  status: string;
  assigned_driver_id?: string;
  dispatcher_notes?: string;
  internal_notes?: string;
  created_at: string;
  updated_at: string;
  driver?: Driver;
  stops?: DeliveryStop[];
}

export interface DeliveryStop {
  id: string;
  delivery_id: string;
  stop_order: number;
  location_id?: string;
  stop_type: string;
  window_start?: string;
  window_end?: string;
  items_summary?: string;
  amount_due?: number;
  status: string;
  driver_notes?: string;
  completion_time?: string;
  created_at: string;
  updated_at: string;
  location?: Location;
}

export interface StoreCheck {
  id: string;
  business_id: string;
  assigned_biker_id?: string;
  location_id?: string;
  check_type: string;
  scheduled_date: string;
  status: string;
  summary_notes?: string;
  created_by_user_id?: string;
  reviewed_by_user_id?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
  biker?: Biker;
  location?: Location;
}

export interface WorkerPayout {
  id: string;
  business_id: string;
  worker_type: string;
  worker_id: string;
  period_start: string;
  period_end: string;
  total_earned: number;
  adjustments: number;
  debt_withheld: number;
  total_to_pay: number;
  status: string;
  approved_by_user_id?: string;
  paid_at?: string;
  payout_method?: string;
  payout_reference?: string;
  created_at: string;
  updated_at: string;
}

export interface DriverDebt {
  id: string;
  business_id: string;
  driver_id: string;
  debt_type: string;
  original_amount: number;
  remaining_amount: number;
  status: string;
  notes?: string;
  created_by_user_id?: string;
  created_at: string;
  updated_at: string;
  driver?: Driver;
}

// Activity logging helper
export async function logDeliveryActivity(
  businessId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>
) {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("delivery_activity_log").insert([{
    business_id: businessId,
    actor_user_id: user?.id,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata_json: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
  }]);
}

// DRIVERS HOOKS
export function useDrivers(businessId?: string) {
  return useQuery({
    queryKey: ["drivers", businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await supabase
        .from("drivers")
        .select("*")
        .eq("business_id", businessId)
        .order("full_name");
      if (error) throw error;
      return data as Driver[];
    },
    enabled: !!businessId,
  });
}

export function useCreateDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (driver: Partial<Driver> & { business_id: string; full_name: string }) => {
      const { data, error } = await supabase
        .from("drivers")
        .insert([driver])
        .select()
        .single();
      if (error) throw error;
      await logDeliveryActivity(driver.business_id, "created", "driver", data.id);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["drivers", variables.business_id] });
      toast.success("Driver created");
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useUpdateDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Driver> & { id: string }) => {
      const { data, error } = await supabase
        .from("drivers")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      await logDeliveryActivity(data.business_id, "updated", "driver", id, updates);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["drivers", data.business_id] });
      toast.success("Driver updated");
    },
    onError: (error) => toast.error(error.message),
  });
}

// BIKERS HOOKS
export function useBikers(businessId?: string) {
  return useQuery({
    queryKey: ["bikers", businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await supabase
        .from("bikers")
        .select("*")
        .eq("business_id", businessId)
        .order("full_name");
      if (error) throw error;
      return data as Biker[];
    },
    enabled: !!businessId,
  });
}

export function useCreateBiker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (biker: Partial<Biker> & { business_id: string; full_name: string }) => {
      const { data, error } = await supabase
        .from("bikers")
        .insert([biker])
        .select()
        .single();
      if (error) throw error;
      await logDeliveryActivity(biker.business_id, "created", "biker", data.id);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["bikers", variables.business_id] });
      toast.success("Biker created");
    },
    onError: (error) => toast.error(error.message),
  });
}

// LOCATIONS HOOKS
export function useLocations(businessId?: string) {
  return useQuery({
    queryKey: ["locations", businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .eq("business_id", businessId)
        .order("name");
      if (error) throw error;
      return data as Location[];
    },
    enabled: !!businessId,
  });
}

export function useCreateLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (location: Partial<Location> & { business_id: string; name: string }) => {
      const { data, error } = await supabase
        .from("locations")
        .insert([location])
        .select()
        .single();
      if (error) throw error;
      await logDeliveryActivity(location.business_id, "created", "location", data.id);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["locations", variables.business_id] });
      toast.success("Location created");
    },
    onError: (error) => toast.error(error.message),
  });
}

// DELIVERIES HOOKS
export function useDeliveries(businessId?: string, filters?: { status?: string; date?: string; driverId?: string }) {
  return useQuery({
    queryKey: ["deliveries", businessId, filters],
    queryFn: async () => {
      if (!businessId) return [];
      let query = supabase
        .from("deliveries")
        .select("*, driver:drivers(*)")
        .eq("business_id", businessId)
        .order("scheduled_date", { ascending: false });

      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.date) query = query.eq("scheduled_date", filters.date);
      if (filters?.driverId) query = query.eq("assigned_driver_id", filters.driverId);

      const { data, error } = await query;
      if (error) throw error;
      return data as Delivery[];
    },
    enabled: !!businessId,
  });
}

export function useDeliveryWithStops(deliveryId?: string) {
  return useQuery({
    queryKey: ["delivery", deliveryId],
    queryFn: async () => {
      if (!deliveryId) return null;
      const { data: delivery, error: delError } = await supabase
        .from("deliveries")
        .select("*, driver:drivers(*)")
        .eq("id", deliveryId)
        .single();
      if (delError) throw delError;

      const { data: stops, error: stopsError } = await supabase
        .from("delivery_stops")
        .select("*, location:locations(*)")
        .eq("delivery_id", deliveryId)
        .order("stop_order");
      if (stopsError) throw stopsError;

      return { ...delivery, stops } as Delivery;
    },
    enabled: !!deliveryId,
  });
}

export function useCreateDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (delivery: Partial<Delivery> & { business_id: string }) => {
      const { data, error } = await supabase
        .from("deliveries")
        .insert([delivery])
        .select()
        .single();
      if (error) throw error;
      await logDeliveryActivity(delivery.business_id, "created", "delivery", data.id);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["deliveries", variables.business_id] });
      toast.success("Delivery created");
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useUpdateDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Delivery> & { id: string }) => {
      const { data, error } = await supabase
        .from("deliveries")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      await logDeliveryActivity(data.business_id, "updated", "delivery", id, updates);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["deliveries", data.business_id] });
      queryClient.invalidateQueries({ queryKey: ["delivery", data.id] });
      toast.success("Delivery updated");
    },
    onError: (error) => toast.error(error.message),
  });
}

// STOPS HOOKS
export function useCreateStop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (stop: Partial<DeliveryStop> & { delivery_id: string }) => {
      const { data, error } = await supabase
        .from("delivery_stops")
        .insert([stop])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["delivery", data.delivery_id] });
      toast.success("Stop added");
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useUpdateStop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, businessId, ...updates }: Partial<DeliveryStop> & { id: string; businessId: string }) => {
      const { data, error } = await supabase
        .from("delivery_stops")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      await logDeliveryActivity(businessId, "stop_updated", "delivery_stop", id, updates);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["delivery", data.delivery_id] });
      toast.success("Stop updated");
    },
    onError: (error) => toast.error(error.message),
  });
}

// STORE CHECKS HOOKS
export function useStoreChecks(businessId?: string, filters?: { status?: string; date?: string; bikerId?: string }) {
  return useQuery({
    queryKey: ["store_checks", businessId, filters],
    queryFn: async () => {
      if (!businessId) return [];
      let query = supabase
        .from("store_checks")
        .select("*, biker:bikers(*), location:locations(*)")
        .eq("business_id", businessId)
        .order("scheduled_date", { ascending: false });

      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.date) query = query.eq("scheduled_date", filters.date);
      if (filters?.bikerId) query = query.eq("assigned_biker_id", filters.bikerId);

      const { data, error } = await query;
      if (error) throw error;
      return data as StoreCheck[];
    },
    enabled: !!businessId,
  });
}

export function useCreateStoreCheck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (check: Partial<StoreCheck> & { business_id: string }) => {
      const { data, error } = await supabase
        .from("store_checks")
        .insert([check])
        .select()
        .single();
      if (error) throw error;
      await logDeliveryActivity(check.business_id, "created", "store_check", data.id);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["store_checks", variables.business_id] });
      toast.success("Store check created");
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useUpdateStoreCheck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<StoreCheck> & { id: string }) => {
      const { data, error } = await supabase
        .from("store_checks")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      await logDeliveryActivity(data.business_id, "updated", "store_check", id, updates);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["store_checks", data.business_id] });
      toast.success("Store check updated");
    },
    onError: (error) => toast.error(error.message),
  });
}

// PAYOUTS HOOKS
export function useWorkerPayouts(businessId?: string, filters?: { workerType?: string; status?: string }) {
  return useQuery({
    queryKey: ["worker_payouts", businessId, filters],
    queryFn: async () => {
      if (!businessId) return [];
      let query = supabase
        .from("worker_payouts")
        .select("*")
        .eq("business_id", businessId)
        .order("period_end", { ascending: false });

      if (filters?.workerType) query = query.eq("worker_type", filters.workerType);
      if (filters?.status) query = query.eq("status", filters.status);

      const { data, error } = await query;
      if (error) throw error;
      return data as WorkerPayout[];
    },
    enabled: !!businessId,
  });
}

export function useUpdatePayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkerPayout> & { id: string }) => {
      const { data, error } = await supabase
        .from("worker_payouts")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      await logDeliveryActivity(data.business_id, "payout_updated", "worker_payout", id, updates);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["worker_payouts", data.business_id] });
      toast.success("Payout updated");
    },
    onError: (error) => toast.error(error.message),
  });
}

// DEBTS HOOKS
export function useDriverDebts(businessId?: string) {
  return useQuery({
    queryKey: ["driver_debts", businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await supabase
        .from("driver_debts")
        .select("*, driver:drivers(*)")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DriverDebt[];
    },
    enabled: !!businessId,
  });
}

export function useCreateDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (debt: { business_id: string; driver_id: string; debt_type: string; original_amount: number; remaining_amount: number; notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("driver_debts")
        .insert([{ ...debt, created_by_user_id: user?.id }])
        .select()
        .single();
      if (error) throw error;
      await logDeliveryActivity(debt.business_id, "created", "driver_debt", data.id);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["driver_debts", variables.business_id] });
      toast.success("Debt created");
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useRecordDebtPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ debtId, amount, method, reference, businessId }: { debtId: string; amount: number; method: string; reference?: string; businessId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Create payment record
      const { error: payError } = await supabase
        .from("driver_debt_payments")
        .insert([{
          debt_id: debtId,
          amount,
          method,
          reference,
          recorded_by_user_id: user?.id,
        }]);
      if (payError) throw payError;

      // Update debt remaining amount
      const { data: debt, error: debtError } = await supabase
        .from("driver_debts")
        .select("remaining_amount")
        .eq("id", debtId)
        .single();
      if (debtError) throw debtError;

      const newRemaining = Math.max(0, debt.remaining_amount - amount);
      const { error: updateError } = await supabase
        .from("driver_debts")
        .update({ 
          remaining_amount: newRemaining,
          status: newRemaining === 0 ? "settled" : undefined,
        })
        .eq("id", debtId);
      if (updateError) throw updateError;

      await logDeliveryActivity(businessId, "payment_recorded", "driver_debt", debtId, { amount, method });
      return { debtId, newRemaining };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["driver_debts", variables.businessId] });
      toast.success("Payment recorded");
    },
    onError: (error) => toast.error(error.message),
  });
}

// ACTIVITY LOG
export function useDeliveryActivityLog(entityType?: string, entityId?: string) {
  return useQuery({
    queryKey: ["delivery_activity", entityType, entityId],
    queryFn: async () => {
      if (!entityType || !entityId) return [];
      const { data, error } = await supabase
        .from("delivery_activity_log")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!entityType && !!entityId,
  });
}

// PROOFS
export function useCreateProof() {
  return useMutation({
    mutationFn: async (proof: { business_id: string; related_type: string; related_id: string; proof_type: string; file_url?: string; text_note?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("proofs")
        .insert([{ ...proof, captured_by_user_id: user?.id }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => toast.success("Proof uploaded"),
    onError: (error) => toast.error(error.message),
  });
}
