// Public client intake endpoint (Pipeline Step 13).
//
// The paying client is NOT logged in, so this function is the ONLY path between
// the browser and the strictly-locked brandaro_* tables. It runs with the
// service role internally; no anonymous table access is granted anywhere.
//
// Guards:
//  - the demo id must map to an existing PAID build job, otherwise 404
//  - the prefill response is field-allowlisted (never build/pricing internals)
//  - intake is single-use: a completed job rejects resubmission
//  - every field is validated & length-capped server-side

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { applyIntakeToClient, ensureClientForJob } from "../_shared/brandaroClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;
const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

function svc() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

/** Find the paid build job for a demo id. Returns null when there is none. */
async function findJob(supabase: ReturnType<typeof svc>, demoId: string) {
  const { data, error } = await supabase
    .from("brandaro_build_jobs")
    .select(
      "id, demo_id, package_tier, intake_completed, intake_completed_at, logo_storage_path, created_at",
    )
    .eq("demo_id", demoId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

function normalizeColors(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const key of ["primary", "secondary", "accent"]) {
      const v = (raw as Record<string, unknown>)[key];
      if (typeof v === "string" && HEX_RE.test(v.trim())) out[key] = v.trim().toLowerCase();
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = svc();

    // ---------------- LOAD (prefill) ----------------
    if (req.method === "GET") {
      const demoId = new URL(req.url).searchParams.get("demo")?.trim() ?? "";
      if (!UUID_RE.test(demoId)) return json({ error: "Invalid intake link." }, 400);

      const job = await findJob(supabase, demoId);
      if (!job) return json({ error: "Intake link not found." }, 404);

      const { data: demo } = await supabase
        .from("brandaro_demo_sites")
        .select("business_name, industry, city, state, logo_url, generated_colors")
        .eq("id", demoId)
        .maybeSingle();

      // Allowlisted prefill only.
      return json({
        tier: job.package_tier ?? "starter",
        intake_completed: job.intake_completed === true,
        prefill: {
          business_name: demo?.business_name ?? "",
          industry: demo?.industry ?? null,
          city: demo?.city ?? null,
          state: demo?.state ?? null,
          logo_url: demo?.logo_url ?? null,
          colors: normalizeColors(demo?.generated_colors),
        },
      });
    }

    // ---------------- SUBMIT ----------------
    if (req.method === "POST") {
      const body = await req.json().catch(() => null) as Record<string, unknown> | null;
      if (!body) return json({ error: "Invalid request body." }, 400);

      const demoId = String(body.demo_id ?? "").trim();
      if (!UUID_RE.test(demoId)) return json({ error: "Invalid intake link." }, 400);

      const businessName = String(body.business_name ?? "").trim();
      const contactEmail = String(body.contact_email ?? "").trim();
      const contentNotes = String(body.content_notes ?? "").trim();
      const preferredDomain = String(body.preferred_domain ?? "").trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
      const colors = normalizeColors(body.colors);

      const errors: string[] = [];
      if (!businessName) errors.push("Business name is required.");
      if (businessName.length > 200) errors.push("Business name must be under 200 characters.");
      if (!contactEmail || !EMAIL_RE.test(contactEmail)) errors.push("A valid contact email is required.");
      if (contactEmail.length > 255) errors.push("Contact email is too long.");
      if (contentNotes.length > 5000) errors.push("Content notes must be under 5000 characters.");
      if (preferredDomain && (preferredDomain.length > 253 || !DOMAIN_RE.test(preferredDomain))) {
        errors.push("Preferred domain doesn't look like a valid domain name.");
      }
      if (errors.length) return json({ error: errors.join(" ") }, 400);

      const job = await findJob(supabase, demoId);
      if (!job) return json({ error: "Intake link not found." }, 404);
      if (job.intake_completed) {
        return json({ error: "This intake form has already been submitted.", already: true, tier: job.package_tier }, 409);
      }

      // ----- optional logo upload into the PRIVATE brandaro-logos bucket -----
      let logoPath: string | null = job.logo_storage_path ?? null;
      const logo = body.logo as Record<string, unknown> | undefined;
      if (logo && typeof logo.data === "string" && logo.data.length > 0) {
        const contentType = String(logo.content_type ?? "");
        if (!ALLOWED_LOGO_TYPES.includes(contentType)) {
          return json({ error: "Logo must be a PNG, JPG, WEBP, or SVG image." }, 400);
        }
        let bytes: Uint8Array;
        try {
          const base64 = logo.data.includes(",") ? logo.data.split(",").pop()! : logo.data;
          const bin = atob(base64);
          bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
        } catch {
          return json({ error: "Logo upload could not be read." }, 400);
        }
        if (bytes.byteLength > MAX_LOGO_BYTES) {
          return json({ error: "Logo must be smaller than 5 MB." }, 400);
        }
        const path = `intake/${job.id}/logo.${EXT_BY_TYPE[contentType]}`;
        const { error: upErr } = await supabase.storage
          .from("brandaro-logos")
          .upload(path, bytes, { contentType, upsert: true });
        if (upErr) {
          console.error("[brandaro-intake] logo upload failed:", upErr.message);
          return json({ error: "Logo upload failed. Please try again." }, 500);
        }
        logoPath = path;
      }

      const now = new Date().toISOString();
      const intake_data = {
        business_name: businessName,
        contact_email: contactEmail,
        preferred_domain: preferredDomain || null,
        content_notes: contentNotes || null,
        colors,
        logo_storage_path: logoPath,
        submitted_at: now,
      };

      const { error: updErr } = await supabase
        .from("brandaro_build_jobs")
        .update({
          intake_data,
          intake_completed: true,
          intake_completed_at: now,
          logo_storage_path: logoPath,
          progress_stage: "intake_completed",
          updated_at: now,
        })
        .eq("id", job.id);
      if (updErr) {
        console.error("[brandaro-intake] job update failed:", updErr.message);
        return json({ error: "Could not save your details. Please try again." }, 500);
      }

      // Pipeline Step 15: pro/custom builds start once we have the intake
      // answers. Fire-and-forget — the client's confirmation must never wait on
      // Vercel, and the job row carries all state (including failures).
      const tier = (job.package_tier ?? "").toLowerCase();
      if (tier === "pro" || tier === "custom") {
        supabase.functions
          .invoke("brandaro-provision-client-site", { body: { build_job_id: job.id } })
          .then(({ error }: { error: unknown }) => {
            if (error) console.error("[brandaro-intake] provision invoke failed:", error);
          })
          .catch((err: unknown) => console.error("[brandaro-intake] provision invoke threw:", err));
      }

      return json({ success: true, tier: job.package_tier ?? "starter" });
    }

    return json({ error: "Method not allowed." }, 405);
  } catch (e) {
    console.error("[brandaro-intake] unhandled:", e instanceof Error ? e.message : e);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
