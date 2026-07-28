import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type FieldWorkerType = "driver" | "biker" | "ambassador";

export interface FieldWorker {
  key: string;              // `${type}:${id}`
  id: string;               // drivers.id / bikers.id / ambassadors.id
  user_id: string | null;
  name: string;
  phone: string | null;
  type: FieldWorkerType;
  status: string | null;
}

export interface AssignedStore {
  store_id: string;
  store_name: string | null;
  address: string | null;
  city: string | null;
  source: "assignment" | "route";
  assignment_id?: string;
  route_label?: string | null;
}

export interface StoreOption {
  id: string;
  store_name: string | null;
  address: string | null;
  city: string | null;
}

/** All field workers (drivers, bikers, ambassadors) for the picker. */
export function useFieldWorkers() {
  return useQuery({
    queryKey: ["field-workers"],
    queryFn: async (): Promise<FieldWorker[]> => {
      const [drivers, bikers, ambassadors] = await Promise.all([
        supabase.from("drivers").select("id, user_id, full_name, phone, status").order("full_name"),
        supabase.from("bikers").select("id, user_id, full_name, phone, status").order("full_name"),
        supabase.from("ambassadors").select("id, user_id, name, phone_primary, is_active").is("deleted_at", null).order("name"),
      ]);
      if (drivers.error) throw drivers.error;
      if (bikers.error) throw bikers.error;
      if (ambassadors.error) throw ambassadors.error;

      const out: FieldWorker[] = [];
      for (const d of drivers.data || []) {
        out.push({ key: `driver:${d.id}`, id: d.id, user_id: d.user_id, name: d.full_name || "Unnamed driver", phone: d.phone, type: "driver", status: d.status });
      }
      for (const b of bikers.data || []) {
        out.push({ key: `biker:${b.id}`, id: b.id, user_id: b.user_id, name: b.full_name || "Unnamed biker", phone: b.phone, type: "biker", status: b.status });
      }
      for (const a of ambassadors.data || []) {
        out.push({ key: `ambassador:${a.id}`, id: a.id, user_id: a.user_id, name: a.name || "Unnamed ambassador", phone: a.phone_primary, type: "ambassador", status: a.is_active ? "active" : "inactive" });
      }
      return out;
    },
  });
}

/**
 * Effective store access for one worker:
 *  - permanent explicit assignments (driver_assignments / ambassador_assignments)
 *  - read-only route-derived access (routes assigned in the last 30 days)
 * Mirrors public.field_worker_has_store / my_field_store_ids.
 */
export function useWorkerEffectiveStores(worker: FieldWorker | null) {
  return useQuery({
    queryKey: ["worker-effective-stores", worker?.key],
    enabled: !!worker,
    queryFn: async (): Promise<AssignedStore[]> => {
      if (!worker) return [];
      const rows: AssignedStore[] = [];
      const storeIds = new Set<string>();

      if (worker.type === "ambassador") {
        const { data, error } = await supabase
          .from("ambassador_assignments")
          .select("id, store_id")
          .eq("ambassador_id", worker.id)
          .eq("active", true)
          .is("unassigned_at", null)
          .not("store_id", "is", null);
        if (error) throw error;
        for (const r of data || []) {
          rows.push({ store_id: r.store_id as string, store_name: null, address: null, city: null, source: "assignment", assignment_id: r.id });
          storeIds.add(r.store_id as string);
        }
      } else {
        const ids = [worker.id, worker.user_id].filter(Boolean) as string[];
        const { data, error } = await supabase
          .from("driver_assignments")
          .select("id, store_id, driver_id")
          .in("driver_id", ids)
          .eq("is_active", true)
          .not("store_id", "is", null);
        if (error) throw error;
        for (const r of data || []) {
          rows.push({ store_id: r.store_id as string, store_name: null, address: null, city: null, source: "assignment", assignment_id: r.id });
          storeIds.add(r.store_id as string);
        }
      }

      // Route-derived (read-only) — only meaningful when the worker has a login
      if (worker.user_id) {
        const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
        const { data: routes, error: rErr } = await supabase
          .from("routes")
          .select("id, name, date")
          .eq("assigned_to", worker.user_id)
          .gte("date", since);
        if (rErr) throw rErr;
        const routeIds = (routes || []).map((r) => r.id);
        if (routeIds.length) {
          const { data: stops, error: sErr } = await supabase
            .from("route_stops")
            .select("store_id, route_id")
            .in("route_id", routeIds)
            .not("store_id", "is", null);
          if (sErr) throw sErr;
          const routeName = new Map((routes || []).map((r) => [r.id, r.name || r.date]));
          for (const s of stops || []) {
            const sid = s.store_id as string;
            if (storeIds.has(sid)) continue;
            storeIds.add(sid);
            rows.push({ store_id: sid, store_name: null, address: null, city: null, source: "route", route_label: String(routeName.get(s.route_id) ?? "") });
          }
        }
      }

      if (storeIds.size) {
        const { data: stores, error: stErr } = await supabase
          .from("store_master")
          .select("id, store_name, address, city")
          .in("id", Array.from(storeIds));
        if (stErr) throw stErr;
        const map = new Map((stores || []).map((s) => [s.id, s]));
        for (const row of rows) {
          const s = map.get(row.store_id);
          row.store_name = s?.store_name ?? null;
          row.address = s?.address ?? null;
          row.city = s?.city ?? null;
        }
      }

      return rows.sort((a, b) => (a.store_name || "").localeCompare(b.store_name || ""));
    },
  });
}

/** Store search for the "add stores" panel. */
export function useStoreSearch(term: string) {
  return useQuery({
    queryKey: ["assignment-store-search", term],
    enabled: term.trim().length >= 2,
    queryFn: async (): Promise<StoreOption[]> => {
      const q = term.trim();
      const { data, error } = await supabase
        .from("store_master")
        .select("id, store_name, address, city")
        .or(`store_name.ilike.%${q}%,address.ilike.%${q}%`)
        .limit(50);
      if (error) throw error;
      return (data || []) as StoreOption[];
    },
  });
}

export function useAssignStores() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ worker, storeIds }: { worker: FieldWorker; storeIds: string[] }) => {
      if (!storeIds.length) return;
      const { data: auth } = await supabase.auth.getUser();
      const createdBy = auth.user?.id ?? null;

      if (worker.type === "ambassador") {
        const rows = storeIds.map((store_id) => ({
          ambassador_id: worker.id,
          store_id,
          active: true,
          assignment_type: "store",
          created_by: createdBy,
        }));
        const { error } = await supabase.from("ambassador_assignments").insert(rows);
        if (error) throw error;
      } else {
        // field_worker_has_store matches driver_assignments.driver_id against the
        // worker's auth user id (and, for drivers, drivers.id). Prefer user_id so
        // bikers resolve too; fall back to the record id when they have no login.
        const driverId = worker.user_id || worker.id;
        const rows = storeIds.map((store_id) => ({
          driver_id: driverId,
          store_id,
          is_active: true,
          assigned_date: new Date().toISOString().slice(0, 10),
          created_by: createdBy,
        }));
        const { error } = await supabase.from("driver_assignments").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["worker-effective-stores", vars.worker.key] });
      toast.success(`Assigned ${vars.storeIds.length} store${vars.storeIds.length === 1 ? "" : "s"}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUnassignStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ worker, assignmentId }: { worker: FieldWorker; assignmentId: string }) => {
      if (worker.type === "ambassador") {
        const { data: auth } = await supabase.auth.getUser();
        const { error } = await supabase
          .from("ambassador_assignments")
          .update({ active: false, unassigned_at: new Date().toISOString(), unassigned_by: auth.user?.id ?? null })
          .eq("id", assignmentId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("driver_assignments")
          .update({ is_active: false })
          .eq("id", assignmentId);
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["worker-effective-stores", vars.worker.key] });
      toast.success("Store unassigned");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
