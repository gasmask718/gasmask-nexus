import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MemoryContact {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  is_primary: boolean;
  responsiveness_status: string | null;
  last_responded_at: string | null;
  responsive_by_call: boolean;
  responsive_by_text: boolean;
  notes: string | null;
}

export interface PaymentRecall {
  last_payment_date: string | null;
  last_payment_amount: number | null;
  last_paid_by: string | null; // received_by field
  total_outstanding: number;
  outstanding_invoice_count: number;
}

export interface StoreMemorySnapshot {
  contacts: MemoryContact[];
  payment: PaymentRecall;
  recentNotes: Array<{ id: string; note_text: string; created_at: string }>;
  lastVisitDate: string | null;
}

export function useDeliveryMemorySnapshot(storeId: string | undefined) {
  return useQuery({
    queryKey: ["delivery-memory-snapshot", storeId],
    queryFn: async (): Promise<StoreMemorySnapshot> => {
      if (!storeId) throw new Error("No store ID");

      // Parallel fetch: contacts, invoices for payment recall, notes, last visit
      const [contactsRes, paidInvoiceRes, outstandingRes, notesRes, visitRes] = await Promise.all([
        // 1. Contacts
        supabase
          .from("store_contacts")
          .select("id, name, role, phone, is_primary, responsiveness_status, last_responded_at, responsive_by_call, responsive_by_text, notes")
          .eq("store_id", storeId)
          .order("is_primary", { ascending: false })
          .order("last_responded_at", { ascending: false, nullsFirst: false }),

        // 2. Last paid invoice
        supabase
          .from("invoices")
          .select("paid_at, total_amount, received_by")
          .eq("store_id", storeId)
          .eq("payment_status", "paid")
          .is("deleted_at", null)
          .order("paid_at", { ascending: false })
          .limit(1),

        // 3. Outstanding invoices
        supabase
          .from("invoices")
          .select("total_amount, amount_paid")
          .eq("store_id", storeId)
          .neq("payment_status", "paid")
          .is("deleted_at", null),

        // 4. Recent store notes (top 3)
        supabase
          .from("store_notes")
          .select("id, note_text, created_at")
          .eq("store_id", storeId)
          .order("created_at", { ascending: false })
          .limit(3),

        // 5. Last visit
        supabase
          .from("delivery_checklists")
          .select("completed_at")
          .eq("store_id", storeId)
          .eq("status", "completed")
          .order("completed_at", { ascending: false })
          .limit(1),
      ]);

      // Build contacts
      const contacts: MemoryContact[] = (contactsRes.data || []).map((c) => ({
        id: c.id,
        name: c.name || "Unknown",
        role: c.role,
        phone: c.phone,
        is_primary: c.is_primary || false,
        responsiveness_status: c.responsiveness_status,
        last_responded_at: c.last_responded_at,
        responsive_by_call: c.responsive_by_call || false,
        responsive_by_text: c.responsive_by_text || false,
        notes: c.notes,
      }));

      // Build payment recall
      const lastPaid = paidInvoiceRes.data?.[0];
      const outstanding = outstandingRes.data || [];
      const totalOutstanding = outstanding.reduce(
        (sum, inv) => sum + ((inv.total_amount || 0) - (inv.amount_paid || 0)),
        0
      );

      const payment: PaymentRecall = {
        last_payment_date: lastPaid?.paid_at || null,
        last_payment_amount: lastPaid?.total_amount || null,
        last_paid_by: lastPaid?.received_by || null,
        total_outstanding: totalOutstanding,
        outstanding_invoice_count: outstanding.length,
      };

      return {
        contacts,
        payment,
        recentNotes: (notesRes.data || []) as StoreMemorySnapshot["recentNotes"],
        lastVisitDate: visitRes.data?.[0]?.completed_at || null,
      };
    },
    enabled: !!storeId,
    staleTime: 30_000,
  });
}
