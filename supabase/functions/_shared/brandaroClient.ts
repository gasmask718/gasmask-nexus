// Shared helpers for the canonical paying-client record (brandaro_clients).
//
// brandaro_clients is the single destination every downstream Brandaro surface
// already reads (War Room revenue, Production Pipeline, Review Queue, Result
// Engine, Activation Center, monthly reporting). These helpers are the ONLY
// supported way for the demo->payment->intake->provision pipeline to write it,
// so idempotency lives in one place.
//
// Lifecycle:
//   payment  (demo-stripe-webhook)            -> create,   onboarding_status = 'pending'
//   intake   (brandaro-intake)                -> enrich,   onboarding_status = 'content_gathering'
//   provision(brandaro-provision-client-site) -> advance,  onboarding_status = 'draft_ready'
//   hosting  (brandaro-start-hosting-subscription) -> monthly_recurring sync
//
// NOTE: the older proposal-based path (brandaro-post-payment /
// brandaro-stripe-webhook) is intentionally untouched.

// deno-lint-ignore no-explicit-any
type Supa = any;

export type ClientOnboardingStatus =
  | "pending"
  | "content_gathering"
  | "design_phase"
  | "draft_ready"
  | "client_review"
  | "revisions"
  | "final_approval"
  | "launched";

export interface EnsureClientInput {
  build_job_id?: string | null;
  lead_id?: string | null;
  business_name?: string | null;
  email?: string | null;
  phone?: string | null;
  tier?: string | null;
  amount_paid?: number | null;
}

export interface EnsureClientResult {
  client_id: string | null;
  created: boolean;
  error?: string;
}

/**
 * Find-or-create the canonical client row for a paid build job.
 *
 * Idempotency order:
 *   1. brandaro_build_jobs.client_id (already wired)
 *   2. brandaro_clients.lead_id / qualified_lead_id (same lead paid twice)
 *   3. insert
 *
 * Always stamps brandaro_build_jobs.client_id when a job id is supplied.
 * Never throws — callers run inside best-effort webhook paths.
 */
export async function ensureClientForJob(
  supabase: Supa,
  input: EnsureClientInput,
): Promise<EnsureClientResult> {
  try {
    const {
      build_job_id = null,
      lead_id = null,
      business_name,
      email,
      phone,
      tier,
      amount_paid,
    } = input;

    // --- 1. already linked to the build job? ---
    if (build_job_id) {
      const { data: job } = await supabase
        .from("brandaro_build_jobs")
        .select("client_id")
        .eq("id", build_job_id)
        .maybeSingle();
      if (job?.client_id) return { client_id: job.client_id, created: false };
    }

    // --- 2. an existing client for the same lead? ---
    if (lead_id) {
      const { data: existing } = await supabase
        .from("brandaro_clients")
        .select("id")
        .or(`lead_id.eq.${lead_id},qualified_lead_id.eq.${lead_id}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing?.id) {
        if (build_job_id) await stampJobClient(supabase, build_job_id, existing.id);
        return { client_id: existing.id, created: false };
      }
    }

    // --- 3. create ---
    const { data: created, error: insErr } = await supabase
      .from("brandaro_clients")
      .insert({
        business_name: business_name?.trim() || "Unnamed client",
        lead_id,
        qualified_lead_id: lead_id,
        email: email || null,
        phone: phone || null,
        website_package: tier || null,
        package_chosen: tier || null,
        website_package_price: typeof amount_paid === "number" ? amount_paid : null,
        onboarding_status: "pending",
        client_status: "active",
        maintenance_status: "inactive",
        monthly_recurring: 0,
      })
      .select("id")
      .maybeSingle();

    if (insErr || !created?.id) {
      const msg = insErr?.message ?? "client insert returned no row";
      console.error("[brandaroClient] create failed:", msg);
      return { client_id: null, created: false, error: msg };
    }

    if (build_job_id) await stampJobClient(supabase, build_job_id, created.id);
    return { client_id: created.id, created: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[brandaroClient] ensureClientForJob threw:", msg);
    return { client_id: null, created: false, error: msg };
  }
}

/** Link a build job to its client. Safe to call repeatedly. */
export async function stampJobClient(
  supabase: Supa,
  buildJobId: string,
  clientId: string,
): Promise<void> {
  const { error } = await supabase
    .from("brandaro_build_jobs")
    .update({ client_id: clientId, updated_at: new Date().toISOString() })
    .eq("id", buildJobId);
  if (error) console.error("[brandaroClient] stampJobClient failed:", error.message);
}

export interface IntakeEnrichment {
  business_name?: string | null;
  contact_email?: string | null;
  preferred_domain?: string | null;
  content_notes?: string | null;
  colors?: Record<string, string> | null;
  logo_url?: string | null;
}

/**
 * Apply the client's real business details once intake lands, and advance the
 * onboarding status to content_gathering (never regresses a later status).
 */
export async function applyIntakeToClient(
  supabase: Supa,
  clientId: string,
  intake: IntakeEnrichment,
): Promise<void> {
  try {
    const { data: current } = await supabase
      .from("brandaro_clients")
      .select("onboarding_status, brand_colors, logo_url")
      .eq("id", clientId)
      .maybeSingle();

    // deno-lint-ignore no-explicit-any
    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (intake.business_name?.trim()) patch.business_name = intake.business_name.trim();
    if (intake.contact_email?.trim()) patch.email = intake.contact_email.trim();
    if (intake.preferred_domain?.trim()) patch.domain_info = intake.preferred_domain.trim();
    if (intake.colors && Object.keys(intake.colors).length > 0) {
      patch.brand_colors = { ...(current?.brand_colors ?? {}), ...intake.colors };
    }
    if (intake.logo_url) patch.logo_url = intake.logo_url;

    // Only move forward out of the initial 'pending' state.
    if (!current?.onboarding_status || current.onboarding_status === "pending") {
      patch.onboarding_status = "content_gathering";
    }

    const { error } = await supabase.from("brandaro_clients").update(patch).eq("id", clientId);
    if (error) console.error("[brandaroClient] applyIntakeToClient failed:", error.message);
  } catch (e) {
    console.error(
      "[brandaroClient] applyIntakeToClient threw:",
      e instanceof Error ? e.message : e,
    );
  }
}

const STATUS_ORDER: ClientOnboardingStatus[] = [
  "pending",
  "content_gathering",
  "design_phase",
  "draft_ready",
  "client_review",
  "revisions",
  "final_approval",
  "launched",
];

/** Advance onboarding_status, never regressing an already-further client. */
export async function advanceClientStatus(
  supabase: Supa,
  clientId: string,
  target: ClientOnboardingStatus,
): Promise<void> {
  try {
    const { data: current } = await supabase
      .from("brandaro_clients")
      .select("onboarding_status")
      .eq("id", clientId)
      .maybeSingle();

    const from = STATUS_ORDER.indexOf(
      (current?.onboarding_status ?? "pending") as ClientOnboardingStatus,
    );
    const to = STATUS_ORDER.indexOf(target);
    if (to <= from) return;

    const { error } = await supabase
      .from("brandaro_clients")
      .update({ onboarding_status: target, updated_at: new Date().toISOString() })
      .eq("id", clientId);
    if (error) console.error("[brandaroClient] advanceClientStatus failed:", error.message);
  } catch (e) {
    console.error(
      "[brandaroClient] advanceClientStatus threw:",
      e instanceof Error ? e.message : e,
    );
  }
}

/**
 * Recompute monthly_recurring from the client's live subscriptions so Revenue
 * Analytics / War Room MRR reflect real billing rather than a typed number.
 */
export async function syncClientMRR(supabase: Supa, clientId: string): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from("brandaro_subscriptions")
      .select("monthly_fee, status")
      .eq("client_id", clientId)
      .in("status", ["active", "trialing", "past_due"]);
    if (error) {
      console.error("[brandaroClient] syncClientMRR read failed:", error.message);
      return null;
    }

    const mrr = (data ?? []).reduce(
      (sum: number, row: { monthly_fee: number | null }) => sum + Number(row.monthly_fee ?? 0),
      0,
    );

    const { error: upErr } = await supabase
      .from("brandaro_clients")
      .update({
        monthly_recurring: mrr,
        maintenance_status: mrr > 0 ? "active" : "inactive",
        updated_at: new Date().toISOString(),
      })
      .eq("id", clientId);
    if (upErr) console.error("[brandaroClient] syncClientMRR write failed:", upErr.message);

    return mrr;
  } catch (e) {
    console.error("[brandaroClient] syncClientMRR threw:", e instanceof Error ? e.message : e);
    return null;
  }
}
