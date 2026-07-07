import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const summary = {
    checked: 0,
    overdue: 0,
    reminders_created: 0,
    errors: [] as string[],
  };

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = new Date().toISOString().split("T")[0];

    // Find overdue letters (30-day deadline passed, no response, no escalation yet)
    const { data: overdue, error: qErr } = await supabase
      .from("bureau_response_tracking")
      .select(`
        id,
        client_id,
        bureau,
        letter_sent_date,
        certified_mail_number,
        response_deadline_30,
        funding_clients!inner ( full_name )
      `)
      .lte("response_deadline_30", today)
      .is("response_received_date", null)
      .eq("escalation_sent", false);

    if (qErr) {
      summary.errors.push(qErr.message);
      return json({ success: false, error: qErr.message, summary }, 500);
    }

    summary.checked = overdue?.length ?? 0;

    if (summary.checked === 0) {
      return json({
        success: true,
        checked: 0,
        overdue: 0,
        reminders_created: 0,
        message: "No overdue letters",
      });
    }

    for (const row of overdue ?? []) {
      try {
        const clientName =
          (row.funding_clients as any)?.full_name ?? "Client";

        const { error: remErr } = await supabase
          .from("client_reminders")
          .insert({
            client_id: row.client_id,
            title:
              row.bureau + " overdue — send §605B escalation letter",
            reminder_type: "dispute_deadline",
            due_date: today,
            priority: "urgent",
            description:
              "Bureau: " + row.bureau +
              "\nClient: " + clientName +
              "\nLetter sent: " + row.letter_sent_date +
              "\nCertified mail: " +
              (row.certified_mail_number || "N/A") +
              "\n30-day deadline was: " + row.response_deadline_30,
          });

        if (remErr) {
          summary.errors.push(row.id + ": " + remErr.message);
          continue;
        }

        await supabase
          .from("bureau_response_tracking")
          .update({ escalation_sent: true })
          .eq("id", row.id);

        summary.overdue++;
        summary.reminders_created++;
      } catch (e) {
        summary.errors.push(row.id + ": " + (e as Error).message);
      }
    }

    return json({ success: true, summary });
  } catch (e) {
    summary.errors.push((e as Error).message);
    return json({ success: false, summary }, 500);
  }
});
