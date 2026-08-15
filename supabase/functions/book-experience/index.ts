import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { errText } from "../_shared/errText.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "book";

    // ─── BOOK EXPERIENCE ───
    if (action === "book") {
      const {
        experience_id, user_id, customer_name, customer_email, customer_phone,
        selected_addons = [], notes
      } = body;

      if (!experience_id || !user_id) {
        return new Response(
          JSON.stringify({ error: "experience_id and user_id required" }),
          { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
        );
      }

      // Get experience
      const { data: exp, error: expErr } = await supabase
        .from("experiences_master")
        .select("*")
        .eq("id", experience_id)
        .single();

      if (expErr || !exp) {
        await logAlert(supabase, {
          alert_type: "booking_failed",
          severity: "critical",
          title: "Booking failed — experience not found",
          message: `Experience ${experience_id} not found`,
          experience_id,
        });
        return new Response(
          JSON.stringify({ error: "Experience not found" }),
          { status: 404, headers: { ...CORS, "Content-Type": "application/json" } }
        );
      }

      // Calculate pricing
      const basePrice = Number(exp.price);
      const markupPct = Number(exp.markup_pct);

      // Check markup rules for overrides
      const { data: rules } = await supabase
        .from("experience_markup_rules")
        .select("*")
        .eq("is_active", true)
        .order("priority", { ascending: false });

      let effectiveMarkup = markupPct;
      if (rules && rules.length > 0) {
        for (const rule of rules) {
          const catMatch = !rule.category || rule.category === exp.category;
          const cityMatch = !rule.city || rule.city === exp.city;
          if (catMatch && cityMatch) {
            effectiveMarkup = Number(rule.markup_pct);
            break;
          }
        }
      }

      const markupAmount = basePrice * (effectiveMarkup / 100);
      const displayPrice = basePrice + markupAmount;

      // Calculate addon total
      let addonTotal = 0;
      if (selected_addons.length > 0) {
        const addonIds = selected_addons
          .map((a: any) => (typeof a === "string" ? a : a.id))
          .filter(Boolean);

        if (addonIds.length > 0) {
          const { data: addons } = await supabase
            .from("experience_addons")
            .select("id, name, price")
            .in("id", addonIds);

          addonTotal = (addons || []).reduce(
            (s: number, a: any) => s + Number(a.price || 0),
            0
          );
        }
      }

      const totalPrice = displayPrice + addonTotal;
      const profit = markupAmount + addonTotal;

      // Create booking
      const { data: booking, error: bookErr } = await supabase
        .from("experience_bookings")
        .insert({
          user_id,
          experience_id,
          customer_name,
          customer_email,
          customer_phone,
          selected_addons,
          notes,
          base_price: basePrice,
          markup_amount: markupAmount,
          total_price: totalPrice,
          addon_total: addonTotal,
          profit,
          supplier_type: exp.booking_type === "external" ? "viator" : "internal",
          booking_status: "pending",
        })
        .select()
        .single();

      if (bookErr) {
        await logAlert(supabase, {
          alert_type: "booking_failed",
          severity: "critical",
          title: "Booking creation failed",
          message: bookErr.message,
          experience_id,
        });
        return new Response(
          JSON.stringify({ error: bookErr.message }),
          { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
        );
      }

      // If external (Viator), attempt to call booking API
      let supplierConfirmation = null;
      if (exp.booking_type === "external" && exp.viator_product_code) {
        const VIATOR_API_KEY = Deno.env.get("VIATOR_API_KEY");
        if (VIATOR_API_KEY) {
          try {
            const viatorRes = await fetch(
              "https://api.viator.com/partner/bookings/book",
              {
                method: "POST",
                headers: {
                  "exp-api-key": VIATOR_API_KEY,
                  "Content-Type": "application/json",
                  Accept: "application/json;version=2.0",
                },
                body: JSON.stringify({
                  productCode: exp.viator_product_code,
                  currency: "USD",
                  partnerBookingRef: booking.id,
                }),
              }
            );

            if (viatorRes.ok) {
              const viatorData = await viatorRes.json();
              supplierConfirmation = viatorData.bookingRef || viatorData.id;
              // Viator has already committed a live booking. If we cannot store
              // the reference, we hold a supplier booking we cannot identify —
              // same class as the refund case, so it fails loudly and alerts.
              const { error: confirmErr } = await supabase
                .from("experience_bookings")
                .update({
                  supplier_confirmation: supplierConfirmation,
                  booking_status: "confirmed",
                })
                .eq("id", booking.id);
              if (confirmErr) {
                await logAlert(supabase, {
                  alert_type: "supplier_confirmation_lost",
                  severity: "critical",
                  title: "Viator booking confirmed but reference not stored",
                  message: `Viator ref ${supplierConfirmation} for booking ${booking.id} could not be written: ${errText(confirmErr)}`,
                  experience_id,
                  booking_id: booking.id,
                });
                return new Response(
                  JSON.stringify({
                    error: "Supplier booking succeeded but the confirmation could not be recorded. Do not retry — the supplier booking exists.",
                    supplier_booked: true,
                    supplier_confirmation: supplierConfirmation,
                    booking_id: booking.id,
                    needs_manual_repair: true,
                  }),
                  { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
                );
              }
            } else {
              const viatorBody = await viatorRes.text();
              await logAlert(supabase, {
                alert_type: "api_failure",
                severity: "warning",
                title: "Viator booking API failed",
                message: `Status ${viatorRes.status}: ${viatorBody}`,
                experience_id,
                booking_id: booking.id,
              });
            }
          } catch (apiErr: unknown) {
            await logAlert(supabase, {
              alert_type: "api_failure",
              severity: "warning",
              title: "Viator API connection error",
              message: errText(apiErr),
              experience_id,
              booking_id: booking.id,
            });
          }
        }
      }

      // Upsert customer data — CRM totals only, no money attached. Must never
      // fail a booking that is already confirmed, so errors log and continue.
      if (customer_email) {
        const { data: existing } = await supabase
          .from("experience_customers")
          .select("id, total_bookings, total_spend, upsells_accepted")
          .eq("email", customer_email)
          .single();

        if (existing) {
          const { error: custErr } = await supabase
            .from("experience_customers")
            .update({
              total_bookings: existing.total_bookings + 1,
              total_spend: Number(existing.total_spend) + totalPrice,
              upsells_accepted:
                existing.upsells_accepted +
                (selected_addons.length > 0 ? selected_addons.length : 0),
              last_booking_at: new Date().toISOString(),
              name: customer_name || undefined,
              phone: customer_phone || undefined,
            })
            .eq("id", existing.id);
          if (custErr) console.error("book-experience customer update failed:", errText(custErr));
        } else {
          const { error: custErr } = await supabase.from("experience_customers").insert({
            user_id,
            email: customer_email,
            phone: customer_phone,
            name: customer_name,
            total_bookings: 1,
            total_spend: totalPrice,
            upsells_accepted: selected_addons.length,
            last_booking_at: new Date().toISOString(),
          });
          if (custErr) console.error("book-experience customer insert failed:", errText(custErr));
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          booking: booking,
          pricing: { basePrice, markupAmount, addonTotal, totalPrice, profit },
          supplier_confirmation: supplierConfirmation,
        }),
        { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});

async function logAlert(
  supabase: any,
  alert: {
    alert_type: string;
    severity: string;
    title: string;
    message: string;
    experience_id?: string;
    booking_id?: string;
  }
) {
  await supabase.from("experience_alerts").insert(alert);
}
