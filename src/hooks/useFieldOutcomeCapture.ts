import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { FieldOutcome } from "@/components/delivery/FieldOutcomeCaptureModal";

export function useFieldOutcomeCapture(storeId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      checklistId,
      outcome,
    }: {
      checklistId: string;
      outcome: FieldOutcome;
    }) => {
      if (!storeId || !user?.id) throw new Error("Missing store or user");

      // 1. If new contact → create in store_contacts
      let resolvedContactId = outcome.contact_id;
      if (outcome.is_new_contact && outcome.contact_name) {
        const { data: newContact, error: contactErr } = await supabase
          .from("store_contacts")
          .insert({
            store_id: storeId,
            name: outcome.contact_name,
            role: outcome.new_contact_role || null,
          })
          .select("id")
          .single();

        if (contactErr) throw contactErr;
        resolvedContactId = newContact.id;
      }

      // 2. Write outcome_summary to checklist
      const outcomeSummary = {
        contact_id: resolvedContactId,
        contact_name: outcome.contact_name,
        outcome_type: outcome.outcome_type,
        payment_collected: outcome.payment_collected,
        payment_amount: outcome.payment_amount,
        payment_method: outcome.payment_method,
        notes: outcome.notes,
        captured_at: outcome.captured_at,
        captured_by: user.id,
      };

      const { error: updateErr } = await supabase
        .from("delivery_checklists")
        .update({
          outcome_summary: outcomeSummary as any,
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", checklistId);

      if (updateErr) throw updateErr;

      // 3. Create a store note from this interaction
      if (outcome.notes.trim()) {
        const outcomeLabel = outcome.outcome_type.replace(/_/g, " ");
        const noteText = `[${outcomeLabel}] Spoke with ${outcome.contact_name}${outcome.payment_collected ? ` — collected $${outcome.payment_amount?.toFixed(2)} (${outcome.payment_method})` : ""}${outcome.notes ? `: ${outcome.notes}` : ""}`;

        await supabase.from("store_notes").insert({
          store_id: storeId,
          note_text: noteText,
        });
      }

      // 4. Update contact's last interaction timestamp if we have a contact_id
      if (resolvedContactId) {
        await supabase
          .from("store_contacts")
          .update({
            last_responded_at: new Date().toISOString(),
          })
          .eq("id", resolvedContactId);
      }

      return outcomeSummary;
    },
    onSuccess: () => {
      const today = new Date().toISOString().split("-")[0] ? new Date().toISOString().split("T")[0] : "";
      queryClient.invalidateQueries({ queryKey: ["delivery-checklist", storeId, today] });
      queryClient.invalidateQueries({ queryKey: ["store-notes", storeId] });
      queryClient.invalidateQueries({ queryKey: ["store-contacts-for-capture", storeId] });
      queryClient.invalidateQueries({ queryKey: ["delivery-memory-snapshot", storeId] });
      toast.success("Visit completed — outcome recorded!");
    },
    onError: (error: Error) => {
      toast.error(`Failed to save outcome: ${error.message}`);
    },
  });
}
