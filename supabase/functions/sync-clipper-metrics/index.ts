// Dynasty Clipper Nation — daily sync of social metrics from Phyllo.
// Iterates approved submissions with a phyllo_content_id, refreshes views/likes/shares,
// recalculates base_earnings + total_earnings, upserts a base_views earning row,
// and updates the clipper_accounts aggregates.
//
// Returns 503 with a clear message until PHYLLO_CLIENT_ID / PHYLLO_SECRET are set.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PHYLLO_API_BASE = "https://api.getphyllo.com/v1";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const PHYLLO_CLIENT_ID = Deno.env.get("PHYLLO_CLIENT_ID");
  const PHYLLO_SECRET = Deno.env.get("PHYLLO_SECRET");

  if (!PHYLLO_CLIENT_ID || !PHYLLO_SECRET) {
    return json(503, {
      error: "Phyllo not configured",
      message: "Add PHYLLO_CLIENT_ID and PHYLLO_SECRET to vault",
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const phylloHeaders = {
    "x-phyllo-client-id": PHYLLO_CLIENT_ID,
    Authorization: `Bearer ${PHYLLO_SECRET}`,
    Accept: "application/json",
  };

  try {
    // 1. Approved submissions with a Phyllo content id.
    const { data: subs, error: sErr } = await (supabase as any)
      .from("clipper_submissions")
      .select(`
        id, clipper_id, campaign_id, phyllo_content_id,
        views, conversion_earnings,
        clipper_campaigns:campaign_id ( base_rate_per_1k )
      `)
      .eq("status", "approved")
      .not("phyllo_content_id", "is", null);

    if (sErr) throw sErr;

    const rows = subs ?? [];
    const errors: Array<{ submission_id: string; error: string }> = [];
    const touchedClippers = new Set<string>();
    let synced = 0;
    let totalViewsUpdated = 0;

    for (const s of rows) {
      try {
        const res = await fetch(
          `${PHYLLO_API_BASE}/contents/${encodeURIComponent(s.phyllo_content_id)}`,
          { headers: phylloHeaders },
        );

        if (!res.ok) {
          errors.push({
            submission_id: s.id,
            error: `Phyllo ${res.status}: ${await res.text()}`,
          });
          continue;
        }

        const payload = await res.json();
        const eng = payload?.data?.engagement ?? payload?.engagement ?? {};
        const new_views = Number(
          eng.video_views ?? eng.view_count ?? payload?.data?.view_count ?? payload?.view_count ?? 0,
        );
        const new_likes = Number(eng.like_count ?? 0);
        const new_shares = Number(eng.share_count ?? 0);

        const baseRate = Number(s.clipper_campaigns?.base_rate_per_1k ?? 0);
        const base_earnings = Math.round((new_views / 1000) * baseRate * 100) / 100;
        const conversion_earnings = Number(s.conversion_earnings ?? 0);
        const total_earnings = Math.round((base_earnings + conversion_earnings) * 100) / 100;

        // 2. Update the submission.
        const { error: uErr } = await (supabase as any)
          .from("clipper_submissions")
          .update({
            views: new_views,
            likes: new_likes,
            shares: new_shares,
            base_earnings,
            total_earnings,
            last_synced_at: new Date().toISOString(),
          })
          .eq("id", s.id);
        if (uErr) throw uErr;

        // 3. Upsert base_views earning row for this submission.
        const { data: existing } = await (supabase as any)
          .from("clipper_earnings")
          .select("id")
          .eq("submission_id", s.id)
          .eq("earning_type", "base_views")
          .maybeSingle();

        if (existing?.id) {
          await (supabase as any)
            .from("clipper_earnings")
            .update({ amount: base_earnings, status: "approved" })
            .eq("id", existing.id);
        } else if (base_earnings > 0) {
          await (supabase as any).from("clipper_earnings").insert({
            clipper_id: s.clipper_id,
            campaign_id: s.campaign_id,
            submission_id: s.id,
            earning_type: "base_views",
            amount: base_earnings,
            status: "approved",
          });
        }

        touchedClippers.add(s.clipper_id);
        synced += 1;
        totalViewsUpdated += new_views;
      } catch (e) {
        errors.push({ submission_id: s.id, error: String((e as Error).message) });
      }
    }

    // 4. Refresh per-clipper aggregates.
    for (const clipperId of touchedClippers) {
      const [{ data: viewRows }, { data: earnRows }] = await Promise.all([
        (supabase as any)
          .from("clipper_submissions")
          .select("views")
          .eq("clipper_id", clipperId)
          .eq("status", "approved"),
        (supabase as any)
          .from("clipper_earnings")
          .select("amount")
          .eq("clipper_id", clipperId)
          .in("status", ["approved", "paid"]),
      ]);

      const total_views = (viewRows ?? []).reduce(
        (sum: number, r: any) => sum + Number(r.views || 0),
        0,
      );
      const total_earnings = Math.round(
        (earnRows ?? []).reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0) * 100,
      ) / 100;

      await (supabase as any)
        .from("clipper_accounts")
        .update({ total_views, total_earnings })
        .eq("id", clipperId);
    }

    return json(200, {
      synced,
      errors,
      total_views_updated: totalViewsUpdated,
      clippers_updated: touchedClippers.size,
    });
  } catch (e) {
    console.error("[sync-clipper-metrics] fatal", e);
    return json(500, { error: String((e as Error).message) });
  }
});
