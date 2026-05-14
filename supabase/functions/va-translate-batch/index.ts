// Batch translator with DB cache. Input: { texts: string[], target_lang: 'es'|'en' }
// Output: { translations: string[] } in same order. Uses Lovable AI gateway.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { texts, target_lang = "es" } = await req.json();
    if (!Array.isArray(texts) || texts.length === 0) {
      return new Response(JSON.stringify({ translations: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Dedup
    const unique = Array.from(new Set(texts.map((t: string) => (t || "").trim()).filter(Boolean)));
    const result: Record<string, string> = {};

    // 1. Cache lookup
    if (unique.length) {
      const { data: cached } = await supabase
        .from("va_ui_translations")
        .select("source_text, translated_text")
        .eq("target_lang", target_lang)
        .in("source_text", unique);
      for (const row of cached || []) result[row.source_text] = row.translated_text;
    }

    const missing = unique.filter((t) => !(t in result));

    // 2. Translate missing in one AI call
    if (missing.length > 0) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      const langName = target_lang === "es" ? "Spanish" : "English";
      const numbered = missing.map((t, i) => `${i + 1}. ${t}`).join("\n");

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "system",
              content:
                `Translate each numbered UI string to ${langName}. Return ONLY a JSON array of strings in the same order, no commentary. Keep brand names, proper nouns, numbers, currency, emojis, and product names unchanged. Preserve punctuation/casing style.`,
            },
            { role: "user", content: numbered },
          ],
        }),
      });

      if (!aiRes.ok) throw new Error(`AI gateway ${aiRes.status}: ${await aiRes.text()}`);
      const data = await aiRes.json();
      let raw = data.choices?.[0]?.message?.content?.trim() || "[]";
      // strip markdown fences
      raw = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      let arr: string[] = [];
      try { arr = JSON.parse(raw); } catch { arr = []; }

      const rows: any[] = [];
      missing.forEach((src, i) => {
        const tr = (arr[i] || src).toString();
        result[src] = tr;
        rows.push({ source_text: src, target_lang, translated_text: tr });
      });

      if (rows.length) {
        await supabase.from("va_ui_translations").upsert(rows, {
          onConflict: "source_hash,target_lang",
          ignoreDuplicates: true,
        });
      }
    }

    const translations = texts.map((t: string) => {
      const k = (t || "").trim();
      return result[k] ?? t;
    });
    return new Response(JSON.stringify({ translations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
