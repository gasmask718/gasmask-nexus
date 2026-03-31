import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const gameDate = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    const dateLabel = new Date().toLocaleDateString("en-US", {
      timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric", year: "numeric",
    });

    // Get email recipients
    const { data: recipients } = await supabase
      .from("sbo_sms_recipients")
      .select("email, name")
      .eq("active", true)
      .not("email", "is", null);

    if (!recipients?.length) {
      return new Response(JSON.stringify({ success: true, message: "No email recipients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch top plays
    const { data: topPlays } = await supabase
      .from("sbo_top_plays")
      .select("*")
      .eq("game_date", gameDate)
      .order("confidence", { ascending: false });

    // Fetch props engine picks
    const { data: propsData } = await supabase
      .from("props_master")
      .select("player_name, stat_type, line, ai_confidence, ai_recommendation, over_odds, under_odds, platform")
      .eq("game_date", gameDate)
      .not("ai_confidence", "is", null)
      .gte("ai_confidence", 70)
      .order("ai_confidence", { ascending: false })
      .limit(10);

    // Fetch Polymarket signals
    const { data: polySignals } = await supabase
      .from("sbo_odds_comparison")
      .select("description, market_slug, implied_edge, sportsbook_odds, polymarket_odds, has_value")
      .eq("has_value", true)
      .gte("created_at", `${gameDate}T00:00:00`)
      .limit(10);

    // Fetch capper signals
    const { data: capperPicks } = await supabase
      .from("sbo_capper_picks")
      .select("capper_id, player_name, stat_type, direction, line, edge_score, source")
      .eq("game_date", gameDate)
      .eq("review_status", "verified")
      .limit(10);

    // Build HTML email
    const elitePlays = (topPlays || []).filter((p: any) => p.recommended_action === "ELITE BET");
    const strongPlays = (topPlays || []).filter((p: any) => p.recommended_action === "STRONG BET");
    const watchlistPlays = (topPlays || []).filter((p: any) => p.recommended_action === "WATCHLIST");

    const renderPlay = (p: any) => {
      const engines = (p.engines_agreed || []).join(", ");
      const conf = p.confidence || 0;
      const color = conf >= 80 ? "#f59e0b" : conf >= 60 ? "#22c55e" : "#3b82f6";
      return `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #333;">${p.player_name || "Market"}</td>
          <td style="padding:8px;border-bottom:1px solid #333;">${p.pick}</td>
          <td style="padding:8px;border-bottom:1px solid #333;"><span style="color:${color};font-weight:bold;">${conf}%</span></td>
          <td style="padding:8px;border-bottom:1px solid #333;">${engines}</td>
          <td style="padding:8px;border-bottom:1px solid #333;">${p.engine_count || 0}</td>
        </tr>`;
    };

    const renderProp = (p: any) => {
      const odds = p.ai_recommendation === "OVER" ? p.over_odds : p.under_odds;
      const oddsStr = odds ? (odds > 0 ? `+${odds}` : `${odds}`) : "";
      return `
        <tr>
          <td style="padding:6px;border-bottom:1px solid #333;">${p.player_name}</td>
          <td style="padding:6px;border-bottom:1px solid #333;">${p.stat_type} ${p.ai_recommendation} ${p.line}</td>
          <td style="padding:6px;border-bottom:1px solid #333;">${p.ai_confidence}%</td>
          <td style="padding:6px;border-bottom:1px solid #333;">${oddsStr}</td>
        </tr>`;
    };

    let html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
    <body style="background:#0a0a0a;color:#e5e5e5;font-family:Arial,sans-serif;margin:0;padding:20px;">
      <div style="max-width:700px;margin:0 auto;">
        <div style="text-align:center;padding:20px 0;border-bottom:2px solid #f59e0b;">
          <h1 style="color:#f59e0b;margin:0;font-size:28px;">🏆 SBO AI Daily Briefing</h1>
          <p style="color:#999;margin:5px 0 0;">${dateLabel}</p>
        </div>`;

    // TOP CONSENSUS PICKS
    if ((topPlays || []).length > 0) {
      html += `
        <div style="margin:30px 0;">
          <h2 style="color:#f59e0b;border-bottom:1px solid #333;padding-bottom:8px;">🎯 Top AI Consensus Picks</h2>`;

      if (elitePlays.length > 0) {
        html += `<h3 style="color:#f59e0b;">🔥 ELITE BETS</h3>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr style="color:#999;"><th style="text-align:left;padding:6px;">Player</th><th style="text-align:left;padding:6px;">Pick</th><th style="text-align:left;padding:6px;">Conf</th><th style="text-align:left;padding:6px;">Engines</th><th style="text-align:left;padding:6px;">#</th></tr>
            ${elitePlays.map(renderPlay).join("")}
          </table>`;
      }
      if (strongPlays.length > 0) {
        html += `<h3 style="color:#22c55e;">💪 STRONG BETS</h3>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr style="color:#999;"><th style="text-align:left;padding:6px;">Player</th><th style="text-align:left;padding:6px;">Pick</th><th style="text-align:left;padding:6px;">Conf</th><th style="text-align:left;padding:6px;">Engines</th><th style="text-align:left;padding:6px;">#</th></tr>
            ${strongPlays.map(renderPlay).join("")}
          </table>`;
      }
      if (watchlistPlays.length > 0) {
        html += `<h3 style="color:#3b82f6;">👀 WATCHLIST</h3>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr style="color:#999;"><th style="text-align:left;padding:6px;">Player</th><th style="text-align:left;padding:6px;">Pick</th><th style="text-align:left;padding:6px;">Conf</th><th style="text-align:left;padding:6px;">Engines</th><th style="text-align:left;padding:6px;">#</th></tr>
            ${watchlistPlays.map(renderPlay).join("")}
          </table>`;
      }
      html += `</div>`;
    }

    // PROPS ENGINE
    if ((propsData || []).length > 0) {
      html += `
        <div style="margin:30px 0;">
          <h2 style="color:#a78bfa;border-bottom:1px solid #333;padding-bottom:8px;">📊 Props Engine Picks</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr style="color:#999;"><th style="text-align:left;padding:6px;">Player</th><th style="text-align:left;padding:6px;">Pick</th><th style="text-align:left;padding:6px;">AI Conf</th><th style="text-align:left;padding:6px;">Odds</th></tr>
            ${(propsData || []).map(renderProp).join("")}
          </table>
        </div>`;
    }

    // POLYMARKET SIGNALS
    if ((polySignals || []).length > 0) {
      html += `
        <div style="margin:30px 0;">
          <h2 style="color:#06b6d4;border-bottom:1px solid #333;padding-bottom:8px;">🌐 Polymarket Signals</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr style="color:#999;"><th style="text-align:left;padding:6px;">Market</th><th style="text-align:left;padding:6px;">Edge</th><th style="text-align:left;padding:6px;">Poly Odds</th><th style="text-align:left;padding:6px;">Book Odds</th></tr>
            ${(polySignals || []).map((s: any) => `
              <tr>
                <td style="padding:6px;border-bottom:1px solid #333;">${s.description || s.market_slug}</td>
                <td style="padding:6px;border-bottom:1px solid #333;color:#22c55e;">${((s.implied_edge || 0) * 100).toFixed(1)}%</td>
                <td style="padding:6px;border-bottom:1px solid #333;">${s.polymarket_odds || "-"}</td>
                <td style="padding:6px;border-bottom:1px solid #333;">${s.sportsbook_odds || "-"}</td>
              </tr>`).join("")}
          </table>
        </div>`;
    }

    // CAPPER SIGNALS
    if ((capperPicks || []).length > 0) {
      html += `
        <div style="margin:30px 0;">
          <h2 style="color:#f97316;border-bottom:1px solid #333;padding-bottom:8px;">🎙️ Capper Signals</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr style="color:#999;"><th style="text-align:left;padding:6px;">Capper</th><th style="text-align:left;padding:6px;">Player</th><th style="text-align:left;padding:6px;">Pick</th><th style="text-align:left;padding:6px;">Source</th></tr>
            ${(capperPicks || []).map((c: any) => `
              <tr>
                <td style="padding:6px;border-bottom:1px solid #333;">${c.capper_id?.slice(0, 8) || "Unknown"}</td>
                <td style="padding:6px;border-bottom:1px solid #333;">${c.player_name || "-"}</td>
                <td style="padding:6px;border-bottom:1px solid #333;">${c.stat_type || ""} ${c.direction} ${c.line || ""}</td>
                <td style="padding:6px;border-bottom:1px solid #333;">${c.source || "manual"}</td>
              </tr>`).join("")}
          </table>
        </div>`;
    }

    html += `
        <div style="text-align:center;padding:20px;margin-top:30px;border-top:1px solid #333;color:#666;font-size:12px;">
          <p>SBO AI Engine — Automated Daily Briefing</p>
          <p>Bet responsibly. Past performance does not guarantee future results.</p>
        </div>
      </div>
    </body>
    </html>`;

    // Send emails via edge function (transactional email)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      try {
        const res = await supabase.functions.invoke("send-transactional-email", {
          body: {
            to: recipient.email,
            subject: `🏆 SBO AI Picks — ${dateLabel}`,
            html,
          },
        });
        if (res.error) {
          console.error(`Email failed for ${recipient.name}:`, res.error);
          failed++;
        } else {
          sent++;
        }
      } catch (e: any) {
        console.error(`Email error for ${recipient.name}:`, e.message);
        failed++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      sent,
      failed,
      total_recipients: recipients.length,
      top_plays: (topPlays || []).length,
      props: (propsData || []).length,
      poly_signals: (polySignals || []).length,
      capper_picks: (capperPicks || []).length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
