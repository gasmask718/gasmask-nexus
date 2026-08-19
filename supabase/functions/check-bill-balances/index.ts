import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all bills with auto-pay enabled
    const { data: bills, error: billsError } = await supabase
      .from("funding_bills")
      .select("*, payment_card:funding_payment_cards(id, available_balance, card_brand, last4)")
      .eq("auto_pay_enabled", true)
      .neq("status", "paid");

    if (billsError) throw billsError;

    const atRiskBills: any[] = [];

    for (const bill of bills || []) {
      if (!bill.payment_card_id || !bill.payment_card) {
        // No card linked - mark at risk
        await supabase.from("funding_bills").update({ card_sufficient: false, status: "at_risk" }).eq("id", bill.id);
        atRiskBills.push(bill);
        continue;
      }

      const card = bill.payment_card;
      const sufficient = card.available_balance >= bill.amount;

      await supabase.from("funding_bills").update({
        card_sufficient: sufficient,
        status: sufficient ? bill.status : "at_risk",
        payment_card_last4: card.last4,
        payment_card_brand: card.card_brand,
      }).eq("id", bill.id);

      if (!sufficient) {
        atRiskBills.push(bill);
      }
    }

    // Also check for overdue bills
    const today = new Date().toISOString().split("T")[0];
    await supabase
      .from("funding_bills")
      .update({ status: "overdue" })
      .lt("due_date", today)
      .neq("status", "paid")
      .neq("status", "at_risk");

    // Internal ops alert (Group A): email-first via the canonical channel.
    // This used to POST Twilio directly with ADMIN_PHONE_NUMBER — the dead
    // credential that produced the 96% alert failure rate.
    if (atRiskBills.length > 0) {
      const lines = atRiskBills.map((bill: Record<string, unknown>) =>
        `• ${bill.bill_name} due ${bill.due_date} — $${Number(bill.amount).toFixed(2)}`
      ).join("\n");
      await sendOpsAlert({
        source: "check-bill-balances",
        severity: "critical",
        subject: `Dynasty Funding: ${atRiskBills.length} bill(s) at risk`,
        message: `Card balance may be insufficient for the following bills:\n${lines}`,
        context: { at_risk_count: atRiskBills.length },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      bills_checked: (bills || []).length,
      at_risk_count: atRiskBills.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Bill balance check failed:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
