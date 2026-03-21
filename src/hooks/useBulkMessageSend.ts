import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useBulkMessageSend() {
  const [isSending, setIsSending] = useState(false);
  const [currentQueueId, setCurrentQueueId] = useState<string | null>(null);

  const sendBulkMessages = useCallback(async ({
    campaignName,
    audienceType,
    contacts,
    messageBody,
  }: {
    campaignName: string;
    audienceType: string;
    contacts: Array<{ id?: string; phone: string; phone_type?: string; sms_capable?: boolean; name?: string; store_name?: string; contact_name?: string; language_detected?: string }>;
    messageBody: string;
  }) => {
    if (!contacts.length || !messageBody.trim()) {
      toast.error("Select contacts and write a message first");
      return null;
    }

    const eligible = contacts.filter(c =>
      c.phone &&
      c.phone_type !== "landline" &&
      c.sms_capable !== false
    );

    if (!eligible.length) {
      toast.error("No SMS-capable contacts selected");
      return null;
    }

    setIsSending(true);

    try {
      const { data: queue, error: queueErr } = await supabase
        .from("message_send_queue" as any)
        .insert({
          campaign_name: campaignName || `Bulk Send — ${new Date().toLocaleDateString()}`,
          audience_type: audienceType,
          message_body: messageBody,
          total_recipients: eligible.length,
          status: "sending",
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (queueErr) throw queueErr;
      const queueData = queue as any;
      setCurrentQueueId(queueData.id);

      const items = eligible.map(c => ({
        queue_id: queueData.id,
        contact_name: c.contact_name || c.name || "",
        phone: c.phone,
        store_name: c.store_name || c.name || "",
        language: c.language_detected || "english",
        message_body: messageBody,
        status: "pending",
      }));

      await supabase.from("message_send_queue_items" as any).insert(items);

      const BATCH_SIZE = 10;
      let sentCount = 0;
      let failedCount = 0;

      for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
        const batch = eligible.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async (contact) => {
          try {
            const { data: smsResult, error: smsErr } = await supabase.functions.invoke("send-sms", {
              body: {
                to_number: contact.phone,
                message_body: messageBody,
                lead_id: contact.id || null,
              },
            });

            if (smsErr) throw new Error(smsErr.message);

            await supabase
              .from("message_send_queue_items" as any)
              .update({
                status: "sent",
                twilio_sid: smsResult?.sid || smsResult?.provider_message_id || null,
                sent_at: new Date().toISOString(),
              })
              .eq("queue_id", queueData.id)
              .eq("phone", contact.phone);

            sentCount++;
          } catch {
            await supabase
              .from("message_send_queue_items" as any)
              .update({
                status: "failed",
                error_message: "Send failed",
              })
              .eq("queue_id", queueData.id)
              .eq("phone", contact.phone);

            failedCount++;
          }

          await supabase
            .from("message_send_queue" as any)
            .update({
              sent_count: sentCount,
              failed_count: failedCount,
              updated_at: new Date().toISOString(),
            })
            .eq("id", queueData.id);
        }));

        if (i + BATCH_SIZE < eligible.length) {
          await new Promise(r => setTimeout(r, 500));
        }
      }

      await supabase
        .from("message_send_queue" as any)
        .update({
          status: "completed",
          sent_count: sentCount,
          failed_count: failedCount,
          completed_at: new Date().toISOString(),
        })
        .eq("id", queueData.id);

      toast.success(`Sent ${sentCount} messages${failedCount > 0 ? ` · ${failedCount} failed` : ""}`);
      return queueData.id;

    } catch (e: any) {
      toast.error(e.message || "Send failed");
      return null;
    } finally {
      setIsSending(false);
    }
  }, []);

  return { sendBulkMessages, isSending, currentQueueId, setCurrentQueueId };
}
