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

    // Send SMS alerts for at-risk bills via Twilio if configured
    if (atRiskBills.length > 0) {
      const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
      const twilioFrom = Deno.env.get("TWILIO_PHONE_NUMBER");
      const alertPhone = Deno.env.get("ADMIN_PHONE_NUMBER");

      if (twilioSid && twilioToken && twilioFrom && alertPhone) {
        for (const bill of atRiskBills) {
          const dueDate = bill.due_date;
          const amount = Number(bill.amount).toFixed(2);
          const message = `⚠️ DYNASTY FUNDING: ${bill.bill_name} due ${dueDate} for $${amount} — card balance may be insufficient. Log in to resolve.`;

          try {
            // Ensure AC prefix
            const sid = twilioSid.startsWith("AC") ? twilioSid : `AC${twilioSid.replace(/^US/, "")}`;
            
            await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
              method: "POST",
              headers: {
                "Authorization": "Basic " + btoa(`${sid}:${twilioToken}`),
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({ To: alertPhone, From: twilioFrom, Body: message }),
            });
          } catch (smsErr) {
            console.error("SMS alert failed:", smsErr);
          }
        }
      }
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
