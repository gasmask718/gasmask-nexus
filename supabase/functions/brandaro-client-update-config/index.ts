// brandaro-client-update-config
// Client Portal (CLIENT-3) — a signed-in receptionist_client updates their own
// receptionist config and the change is pushed to their Retell agent's LLM.
// The client row is resolved from the caller's JWT (auth_user_id or verified
// email) — never from request data.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RETELL_BASE = "https://api.retellai.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);

    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userErr } = await admin.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userData.user) return json({ error: "Not authenticated" }, 401);
    const user = userData.user;

    const body = await req.json().catch(() => ({}));

    // Resolve the caller's own client row (by link, then by paid email).
    let { data: client } = await admin
      .from("brandaro_receptionist_clients")
      .select("*")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!client && user.email) {
      const { data: byEmail } = await admin
        .from("brandaro_receptionist_clients")
        .select("*")
        .ilike("email", user.email)
        .maybeSingle();
      client = byEmail;
    }
    if (!client) return json({ error: "No receptionist account found for this login" }, 404);

    // Whitelist of client-editable fields.
    const patch: Record<string, unknown> = {};
    if (typeof body.receptionist_name === "string" && body.receptionist_name.trim()) {
      patch.receptionist_name = body.receptionist_name.trim().slice(0, 80);
    }
    if (body.business_hours && typeof body.business_hours === "object") {
      patch.business_hours = body.business_hours;
    }
    if (Array.isArray(body.faqs)) {
      patch.faqs = body.faqs
        .filter((f: any) => f && typeof f.question === "string" && typeof f.answer === "string")
        .slice(0, 50)
        .map((f: any) => ({
          question: String(f.question).slice(0, 300),
          answer: String(f.answer).slice(0, 2000),
        }));
    }
    if ("appointment_calendar_url" in body) {
      const v = body.appointment_calendar_url;
      patch.appointment_calendar_url = v ? String(v).trim().slice(0, 500) : null;
    }
    if ("escalation_phone" in body) {
      const v = body.escalation_phone;
      patch.escalation_phone = v ? String(v).trim().slice(0, 32) : null;
    }
    if (!Object.keys(patch).length) return json({ error: "Nothing to update" }, 400);

    const { data: updated, error: updErr } = await admin
      .from("brandaro_receptionist_clients")
      .update(patch)
      .eq("id", client.id)
      .select("*")
      .maybeSingle();
    if (updErr) return json({ error: updErr.message }, 500);

    // Push the new config to the Retell agent's LLM (best-effort, reported honestly).
    let agent_updated = false;
    let agent_error: string | null = null;
    const retellKey = Deno.env.get("RETELL_API_KEY");

    if (!retellKey) {
      agent_error = "RETELL_API_KEY not configured";
    } else if (!updated?.retell_agent_id) {
      agent_error = "Agent not provisioned yet";
    } else {
      try {
        const agentResp = await fetch(`${RETELL_BASE}/get-agent/${updated.retell_agent_id}`, {
          headers: { Authorization: `Bearer ${retellKey}` },
        });
        if (!agentResp.ok) {
          agent_error = `Retell get-agent failed: ${agentResp.status} ${await agentResp.text()}`;
        } else {
          const agent = await agentResp.json();
          const llmId = agent?.response_engine?.llm_id;
          if (!llmId) {
            agent_error = "Agent has no Retell LLM attached";
          } else {
            const llmResp = await fetch(`${RETELL_BASE}/update-retell-llm/${llmId}`, {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${retellKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ general_prompt: buildSystemPrompt(updated) }),
            });
            if (!llmResp.ok) {
              agent_error = `Retell LLM update failed: ${llmResp.status} ${await llmResp.text()}`;
            } else {
              // Keep the agent display name in sync with the receptionist name.
              await fetch(`${RETELL_BASE}/update-agent/${updated.retell_agent_id}`, {
                method: "PATCH",
                headers: {
                  Authorization: `Bearer ${retellKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  agent_name: `${updated.receptionist_name ?? "Sara"} for ${updated.business_name}`,
                }),
              });
              agent_updated = true;
            }
          }
        }
      } catch (e) {
        agent_error = String((e as Error)?.message ?? e);
      }
    }

    if (agent_error) console.error("[brandaro-client-update-config] agent sync:", agent_error);

    return json({ success: true, agent_updated, agent_error });
  } catch (err) {
    console.error("[brandaro-client-update-config] error", err);
    return json({ error: String((err as Error)?.message ?? err) }, 500);
  }
});

// Mirrors buildSystemPrompt() in brandaro-provision-receptionist.
function buildSystemPrompt(client: any): string {
  const faqs = Array.isArray(client.faqs)
    ? client.faqs.map((f: any) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n")
    : "";
  const services = Array.isArray(client.services_offered) ? client.services_offered.join(", ") : "";
  return `You are ${client.receptionist_name ?? "Sara"}, the AI receptionist for ${client.business_name} located in ${client.city ?? ""}, ${client.state ?? ""}.

ABOUT THE BUSINESS:
${client.business_description ?? ""}

SERVICES WE OFFER:
${services}

BUSINESS HOURS:
${JSON.stringify(client.business_hours ?? {})}

YOUR ROLE:
- Answer every call professionally and warmly.
- Book appointments when requested.
- Answer questions about the business.
- Take messages for callbacks.
- Never say you are an AI unless directly asked; if asked, say you are a virtual receptionist.
- If a caller demands a human immediately, offer a callback or transfer.

FREQUENTLY ASKED QUESTIONS:
${faqs}

APPOINTMENT BOOKING:
${
    client.appointment_booking_enabled
      ? `You can book appointments. Calendar: ${client.appointment_calendar_url ?? "(ask the caller for preferred time and confirm we will call back to lock it in)"}`
      : "Take a detailed message and the owner will call the caller back."
  }

ESCALATION:
If a caller is very upset or demands an immediate human, tell them the owner will call back within 1 hour.${
    client.escalation_phone ? ` You may also offer to transfer to ${client.escalation_phone}.` : ""
  }
`;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
