/**
 * dd-application-triage
 *
 * Score a store_application's legitimacy signals (0-100) and write back
 * triage_score / triage_summary / triage_signals. Informs human reviewers;
 * never auto-approves or auto-rejects.
 *
 * POST { application_id: uuid }  -> { score, summary, signals, model }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "google/gemini-3-flash-preview";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { application_id } = await req.json();
    if (!application_id) {
      return json({ error: "application_id required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: app, error } = await supabase
      .from("store_applications")
      .select(
        "id, business_name, contact_name, email, phone, store_address, city, state, zip, ein, website, notes, source, created_at",
      )
      .eq("id", application_id)
      .single();
    if (error || !app) return json({ error: error?.message ?? "not found" }, 404);

    // ── Deterministic signals (cheap, always computed) ─────────────────
    const signals = computeDeterministicSignals(app);

    // ── AI signal (overrides nothing; produces summary + adjustment) ───
    const ai = await runAiPass(app, signals);

    const score = clamp(
      Math.round(signals.baseScore * 0.6 + (ai.aiScore ?? signals.baseScore) * 0.4),
      0,
      100,
    );

    const triage_signals = {
      ...signals,
      ai_score: ai.aiScore,
      ai_flags: ai.flags ?? [],
      ai_positive: ai.positive ?? [],
    };

    const { error: updErr } = await supabase
      .from("store_applications")
      .update({
        triage_score: score,
        triage_summary: ai.summary ?? defaultSummary(signals),
        triage_signals,
        triage_model: ai.summary ? MODEL : null,
        triaged_at: new Date().toISOString(),
      })
      .eq("id", application_id);
    if (updErr) return json({ error: updErr.message }, 500);

    return json({
      score,
      summary: ai.summary ?? defaultSummary(signals),
      signals: triage_signals,
      model: ai.summary ? MODEL : "rule-only",
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

// ──────────────────────────────────────────────────────────────────────

interface Signals {
  hasEin: boolean;
  einLooksValid: boolean;
  hasWebsite: boolean;
  websiteIsHttp: boolean;
  hasPhone: boolean;
  hasAddress: boolean;
  hasBusinessSuffix: boolean;
  emailIsFreeProvider: boolean;
  notesLength: number;
  baseScore: number;
}

function computeDeterministicSignals(app: any): Signals {
  const ein = (app.ein || "").replace(/\D/g, "");
  const hasEin = ein.length > 0;
  const einLooksValid = ein.length === 9;
  const website = (app.website || "").trim();
  const hasWebsite = website.length > 0;
  const websiteIsHttp = /^https?:\/\//i.test(website);
  const hasPhone = !!(app.phone || "").replace(/\D/g, "").match(/\d{10,}/);
  const hasAddress = !!(app.store_address || app.city);
  const name = (app.business_name || "").toLowerCase();
  const hasBusinessSuffix = /\b(llc|inc|corp|co\.?|ltd|enterprises|holdings|wholesale|distrib)\b/.test(name);
  const email = (app.email || "").toLowerCase();
  const emailIsFreeProvider = /@(gmail|yahoo|hotmail|outlook|icloud|aol|proton|protonmail)\.com$/.test(email);
  const notesLength = (app.notes || "").length;

  // Heuristic baseline: ~50 + signals
  let base = 50;
  if (hasEin) base += einLooksValid ? 12 : 4;
  if (hasWebsite) base += websiteIsHttp ? 12 : 6;
  if (hasPhone) base += 6;
  if (hasAddress) base += 8;
  if (hasBusinessSuffix) base += 4;
  if (!emailIsFreeProvider) base += 6;
  if (notesLength > 30) base += 2;

  return {
    hasEin, einLooksValid, hasWebsite, websiteIsHttp,
    hasPhone, hasAddress, hasBusinessSuffix,
    emailIsFreeProvider, notesLength,
    baseScore: clamp(base, 0, 100),
  };
}

async function runAiPass(app: any, signals: Signals): Promise<{
  aiScore?: number; summary?: string; flags?: string[]; positive?: string[];
}> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return {};

  const system = `You triage store-onboarding applications for a tobacco-product distribution OS.
Return ONLY JSON: { "score": 0-100, "summary": "<=140 chars, plain", "flags": [..], "positive": [..] }
- score reflects legitimacy: real business vs. tire-kicker / fraud
- summary is one sentence a human reviewer can read in 2 seconds
- flags: concrete concerns ("EIN missing", "free-email + no website")
- positive: concrete positives ("has 10-digit phone + LLC suffix")
Do not auto-approve or auto-reject — this is a sort/inform signal only.`;

  const user = `APPLICATION:
${JSON.stringify({
    business_name: app.business_name, contact_name: app.contact_name,
    email: app.email, phone: app.phone, ein: app.ein, website: app.website,
    address: [app.store_address, app.city, app.state, app.zip].filter(Boolean).join(", "),
    notes: app.notes, source: app.source,
  }, null, 2)}

DETERMINISTIC SIGNALS:
${JSON.stringify(signals, null, 2)}`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        response_format: { type: "json_object" },
      }),
    });
    if (!resp.ok) {
      console.warn("[triage] ai gateway non-ok", resp.status, await resp.text());
      return {};
    }
    const data = await resp.json();
    const raw = data.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw);
    return {
      aiScore: typeof parsed.score === "number" ? clamp(parsed.score, 0, 100) : undefined,
      summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 200) : undefined,
      flags: Array.isArray(parsed.flags) ? parsed.flags.slice(0, 6) : [],
      positive: Array.isArray(parsed.positive) ? parsed.positive.slice(0, 6) : [],
    };
  } catch (e) {
    console.warn("[triage] ai pass failed", e);
    return {};
  }
}

function defaultSummary(s: Signals) {
  const bits: string[] = [];
  if (s.einLooksValid) bits.push("9-digit EIN");
  else if (s.hasEin) bits.push("EIN provided");
  else bits.push("no EIN");
  if (s.hasWebsite) bits.push("website");
  if (s.hasPhone) bits.push("phone");
  if (s.emailIsFreeProvider) bits.push("free-email");
  return bits.join(" · ");
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
