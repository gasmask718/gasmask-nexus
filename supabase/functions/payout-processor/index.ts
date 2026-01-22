import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PayoutItem {
  id: string;
  ambassador_id: string;
  payout_account_id: string | null;
  amount: number;
  currency: string;
  status: string;
}

interface PayoutAccount {
  id: string;
  provider: string;
  provider_account_id: string | null;
  payouts_enabled: boolean;
  kyc_status: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { batch_id, dry_run = false } = await req.json();

    if (!batch_id) {
      return new Response(
        JSON.stringify({ error: "batch_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing payout batch: ${batch_id}, dry_run: ${dry_run}`);

    // Fetch the batch
    const { data: batch, error: batchError } = await supabase
      .from("payout_batches")
      .select("*")
      .eq("id", batch_id)
      .single();

    if (batchError || !batch) {
      return new Response(
        JSON.stringify({ error: "Batch not found", details: batchError }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only process approved batches
    if (batch.status !== "approved" && batch.status !== "processing") {
      return new Response(
        JSON.stringify({ error: `Batch status is ${batch.status}, must be 'approved' or 'processing'` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark batch as processing
    if (!dry_run && batch.status === "approved") {
      await supabase.rpc("start_payout_batch_processing", { p_batch_id: batch_id });
    }

    // Fetch all queued items
    const { data: items, error: itemsError } = await supabase
      .from("payout_batch_items")
      .select(`
        *,
        ambassador_payout_accounts(*)
      `)
      .eq("payout_batch_id", batch_id)
      .eq("status", "queued");

    if (itemsError) {
      console.error("Error fetching items:", itemsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch items", details: itemsError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = {
      processed: 0,
      paid: 0,
      skipped: 0,
      failed: 0,
      details: [] as any[],
    };

    const MINIMUM_PAYOUT = 25.0; // $25 minimum

    for (const item of items || []) {
      results.processed++;
      const account = item.ambassador_payout_accounts as PayoutAccount | null;

      // Validation checks
      if (!account) {
        if (!dry_run) {
          await supabase.rpc("skip_payout_item", {
            p_item_id: item.id,
            p_reason: "No payout account configured",
          });
        }
        results.skipped++;
        results.details.push({ id: item.id, status: "skipped", reason: "No payout account" });
        continue;
      }

      if (!account.payouts_enabled) {
        if (!dry_run) {
          await supabase.rpc("skip_payout_item", {
            p_item_id: item.id,
            p_reason: "Payouts not enabled on account",
          });
        }
        results.skipped++;
        results.details.push({ id: item.id, status: "skipped", reason: "Payouts not enabled" });
        continue;
      }

      if (account.kyc_status !== "verified") {
        if (!dry_run) {
          await supabase.rpc("skip_payout_item", {
            p_item_id: item.id,
            p_reason: `KYC status: ${account.kyc_status}`,
          });
        }
        results.skipped++;
        results.details.push({ id: item.id, status: "skipped", reason: `KYC: ${account.kyc_status}` });
        continue;
      }

      if (item.amount < MINIMUM_PAYOUT) {
        if (!dry_run) {
          await supabase.rpc("skip_payout_item", {
            p_item_id: item.id,
            p_reason: `Below minimum payout threshold ($${MINIMUM_PAYOUT})`,
          });
        }
        results.skipped++;
        results.details.push({ id: item.id, status: "skipped", reason: `Below $${MINIMUM_PAYOUT} minimum` });
        continue;
      }

      // Process based on provider
      if (account.provider === "stripe") {
        // Stripe Connect transfer
        if (!stripeSecretKey) {
          if (!dry_run) {
            await supabase.rpc("mark_payout_item_failed", {
              p_item_id: item.id,
              p_reason: "Stripe not configured",
            });
          }
          results.failed++;
          results.details.push({ id: item.id, status: "failed", reason: "Stripe not configured" });
          continue;
        }

        if (!account.provider_account_id) {
          if (!dry_run) {
            await supabase.rpc("mark_payout_item_failed", {
              p_item_id: item.id,
              p_reason: "No Stripe account ID",
            });
          }
          results.failed++;
          results.details.push({ id: item.id, status: "failed", reason: "No Stripe account ID" });
          continue;
        }

        // Create idempotency key
        const idempotencyKey = `payout:${batch_id}:${item.ambassador_id}:${item.amount}:${item.currency}`;

        if (dry_run) {
          results.paid++;
          results.details.push({ id: item.id, status: "would_pay", amount: item.amount, provider: "stripe" });
          continue;
        }

        try {
          // Record attempt
          await supabase.from("payout_attempts").insert({
            payout_batch_item_id: item.id,
            idempotency_key: idempotencyKey,
            status: "started",
          });

          // Create Stripe transfer
          const transferResponse = await fetch("https://api.stripe.com/v1/transfers", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${stripeSecretKey}`,
              "Content-Type": "application/x-www-form-urlencoded",
              "Idempotency-Key": idempotencyKey,
            },
            body: new URLSearchParams({
              amount: Math.round(item.amount * 100).toString(), // Convert to cents
              currency: item.currency.toLowerCase(),
              destination: account.provider_account_id,
              description: `Payout batch ${batch_id.slice(0, 8)}`,
            }),
          });

          const transferData = await transferResponse.json();

          if (transferResponse.ok && transferData.id) {
            // Success
            await supabase.rpc("mark_payout_item_paid", {
              p_item_id: item.id,
              p_transfer_id: transferData.id,
            });

            await supabase
              .from("payout_attempts")
              .update({ status: "succeeded", provider_response: transferData })
              .eq("payout_batch_item_id", item.id)
              .eq("idempotency_key", idempotencyKey);

            results.paid++;
            results.details.push({ id: item.id, status: "paid", transfer_id: transferData.id });
          } else {
            // Stripe error
            await supabase.rpc("mark_payout_item_failed", {
              p_item_id: item.id,
              p_reason: transferData.error?.message || "Stripe transfer failed",
            });

            await supabase
              .from("payout_attempts")
              .update({ 
                status: "failed", 
                provider_response: transferData,
                error_message: transferData.error?.message 
              })
              .eq("payout_batch_item_id", item.id)
              .eq("idempotency_key", idempotencyKey);

            results.failed++;
            results.details.push({ id: item.id, status: "failed", reason: transferData.error?.message });
          }
        } catch (err: any) {
          await supabase.rpc("mark_payout_item_failed", {
            p_item_id: item.id,
            p_reason: err.message || "Unknown error",
          });
          results.failed++;
          results.details.push({ id: item.id, status: "failed", reason: err.message });
        }
      } else if (account.provider === "manual") {
        // Manual payouts - just mark as paid (admin will handle externally)
        if (dry_run) {
          results.paid++;
          results.details.push({ id: item.id, status: "would_mark_paid", amount: item.amount, provider: "manual" });
          continue;
        }

        await supabase.rpc("mark_payout_item_paid", {
          p_item_id: item.id,
          p_transfer_id: `manual-${Date.now()}`,
        });
        results.paid++;
        results.details.push({ id: item.id, status: "paid", provider: "manual" });
      }
    }

    // Finalize batch if all items processed
    if (!dry_run) {
      await supabase.rpc("finalize_payout_batch", { p_batch_id: batch_id });
    }

    console.log("Payout processing complete:", results);

    return new Response(
      JSON.stringify({ success: true, batch_id, dry_run, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Payout processor error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
