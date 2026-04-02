import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, ...payload } = await req.json();
    const PLAID_CLIENT_ID = Deno.env.get("PLAID_CLIENT_ID");
    const PLAID_SECRET = Deno.env.get("PLAID_SECRET");
    const PLAID_BASE = "https://sandbox.plaid.com";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
      return new Response(JSON.stringify({
        error: { code: "NO_PLAID_CREDENTIALS", message: "Plaid integration requires API credentials — add PLAID_CLIENT_ID and PLAID_SECRET in your Supabase edge function secrets to enable automatic velocity tracking." }
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    switch (action) {
      case "create_link_token": {
        const res = await fetch(`${PLAID_BASE}/link/token/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: PLAID_CLIENT_ID,
            secret: PLAID_SECRET,
            user: { client_user_id: payload.client_id },
            client_name: "Dynasty Funding Machine",
            products: ["transactions"],
            country_codes: ["US"],
            language: "en",
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error_message || "Plaid link token error");
        return new Response(JSON.stringify({ link_token: data.link_token }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "exchange_token": {
        const exchangeRes = await fetch(`${PLAID_BASE}/item/public_token/exchange`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ client_id: PLAID_CLIENT_ID, secret: PLAID_SECRET, public_token: payload.public_token }),
        });
        const exchangeData = await exchangeRes.json();
        if (!exchangeRes.ok) throw new Error(exchangeData.error_message || "Exchange error");

        const accountsRes = await fetch(`${PLAID_BASE}/accounts/get`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ client_id: PLAID_CLIENT_ID, secret: PLAID_SECRET, access_token: exchangeData.access_token }),
        });
        const accountsData = await accountsRes.json();
        const institution_name = accountsData.item?.institution_id || "Connected Bank";
        const account_id = accountsData.accounts?.[0]?.account_id || null;

        const { error } = await supabase.from("funding_plaid_connections").insert({
          client_id: payload.client_id,
          access_token: exchangeData.access_token,
          item_id: exchangeData.item_id,
          institution_name,
          account_id,
          is_active: true,
        });
        if (error) throw error;

        return new Response(JSON.stringify({ success: true, institution_name }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "sync_transactions": {
        const { data: conn, error: connErr } = await supabase
          .from("funding_plaid_connections")
          .select("*")
          .eq("client_id", payload.client_id)
          .eq("is_active", true)
          .limit(1)
          .single();
        if (connErr || !conn) throw new Error("No active Plaid connection found");

        const endDate = new Date().toISOString().split("T")[0];
        const startDate = new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];

        const txRes = await fetch(`${PLAID_BASE}/transactions/get`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: PLAID_CLIENT_ID,
            secret: PLAID_SECRET,
            access_token: conn.access_token,
            start_date: startDate,
            end_date: endDate,
          }),
        });
        const txData = await txRes.json();
        if (!txRes.ok) throw new Error(txData.error_message || "Transaction sync error");

        const transactions = txData.transactions || [];
        if (transactions.length > 0) {
          const rows = transactions.map((tx: any) => ({
            connection_id: conn.id,
            client_id: payload.client_id,
            transaction_date: tx.date,
            amount: tx.amount,
            merchant_name: tx.merchant_name || tx.name,
            category: tx.category?.[0] || null,
          }));
          await supabase.from("funding_plaid_transactions").insert(rows);
        }

        // Calculate monthly metrics
        const now = new Date();
        for (let m = 0; m < 3; m++) {
          const monthStart = new Date(now.getFullYear(), now.getMonth() - m, 1);
          const monthEnd = new Date(now.getFullYear(), now.getMonth() - m + 1, 0);
          const monthTxns = transactions.filter((tx: any) => {
            const d = new Date(tx.date);
            return d >= monthStart && d <= monthEnd;
          });
          const deposits = monthTxns.filter((tx: any) => tx.amount < 0).reduce((s: number, tx: any) => s + Math.abs(tx.amount), 0);
          const txCount = monthTxns.length;
          const avgBalance = deposits > 0 ? Math.round(deposits / 30) : 0;

          await supabase.from("funding_banking_velocity")
            .update({
              actual_avg_daily_balance: avgBalance,
              actual_monthly_deposits: Math.round(deposits),
              actual_transaction_count: txCount,
            })
            .eq("client_id", payload.client_id)
            .eq("institution", conn.institution_name)
            .eq("month_number", m + 1);
        }

        await supabase.from("funding_plaid_connections")
          .update({ last_synced_at: new Date().toISOString() })
          .eq("id", conn.id);

        return new Response(JSON.stringify({ success: true, transactions_synced: transactions.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (e) {
    console.error("funding-plaid error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
