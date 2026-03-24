import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Canonical agent mapping
const AGENTS = [
  {
    id: "agent_0301kmdmp16aevv8svr78pbr75n8",
    name: "Sales Introduction",
  },
  {
    id: "agent_3101kmdn5q9tfh7r3padaq6j37r3",
    name: "Follow-up Call",
  },
  {
    id: "agent_5901kmdnb01sfzs9hp76mz806813",
    name: "Reactivation",
  },
  {
    id: "agent_8601khrh92krfgrrdj6gqcdpwate",
    name: "GASMASK INVENTORY CHECK",
  },
];

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!ELEVENLABS_API_KEY || !ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({
        error: "Missing ELEVENLABS_API_KEY or ANTHROPIC_API_KEY",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Parse optional body for target agent filter
    let targetAgentIds: string[] | null = null;
    try {
      const body = await req.json();
      if (body?.agent_ids && Array.isArray(body.agent_ids)) {
        targetAgentIds = body.agent_ids;
      }
    } catch {
      // No body — process all agents
    }

    const agentsToProcess = targetAgentIds
      ? AGENTS.filter((a) => targetAgentIds!.includes(a.id))
      : AGENTS;

    // ── Step 1: Fetch recent call logs for analysis ──
    const { data: callLogs, error: logsErr } = await supabase
      .from("ai_call_logs")
      .select("id, outcome, transcription, ai_summary, duration_seconds, created_at")
      .not("transcription", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (logsErr) throw logsErr;

    if (!callLogs || callLogs.length === 0) {
      return new Response(
        JSON.stringify({
          status: "skipped",
          reason: "No call logs with transcripts to analyze",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const wins = callLogs.filter(
      (c) => c.outcome === "reached" || c.outcome === "callback_requested"
    );
    const losses = callLogs.filter(
      (c) => c.outcome === "no_answer" || c.outcome === "voicemail" || c.outcome === "busy" || c.outcome === "wrong_number"
    );

    // ── Step 2: Build analysis prompt for Claude ──
    const transcriptSample = callLogs
      .slice(0, 20)
      .map(
        (c, i) =>
          `--- Call ${i + 1} (${c.outcome || "unknown"}, ${c.duration_seconds || 0}s) ---\n${
            c.transcription?.substring(0, 1500) || "No transcript"
          }\nSummary: ${c.ai_summary || "None"}`
      )
      .join("\n\n");

    const analysisPrompt = `You are analyzing AI sales call transcripts for a wholesale distribution company (GASMASK / Dynasty brands). Your job is to produce a concise playbook update that will make the AI agent perform better.

Here are the ${callLogs.length} most recent calls (${wins.length} wins, ${losses.length} losses):

${transcriptSample}

Produce your analysis in this EXACT format:

TOP_INSIGHT: [Single most impactful finding]

WINNING_PATTERNS:
- [Pattern 1]
- [Pattern 2]
- [Pattern 3]

LOSING_PATTERNS:
- [Pattern 1]
- [Pattern 2]

PLAYBOOK_UPDATE:
[Write 3-5 specific tactical instructions the AI agent should follow on calls. Be concrete — include exact phrases, timing, and responses to common objections. This will be appended to the agent's system prompt.]

Keep the playbook under 500 words. Be specific, not generic.`;

    // ── Step 3: Call Claude for analysis ──
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        messages: [{ role: "user", content: analysisPrompt }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      throw new Error(`Claude API error ${claudeRes.status}: ${err}`);
    }

    const claudeData = await claudeRes.json();
    const analysisText =
      claudeData.content?.[0]?.text || "No analysis generated";

    // Extract top insight
    const topInsightMatch = analysisText.match(
      /TOP_INSIGHT:\s*(.+?)(?:\n|WINNING)/s
    );
    const topInsight = topInsightMatch
      ? topInsightMatch[1].trim()
      : "See full analysis";

    // Extract playbook section
    const playbookMatch = analysisText.match(
      /PLAYBOOK_UPDATE:\s*([\s\S]+?)$/
    );
    const playbookUpdate = playbookMatch
      ? playbookMatch[1].trim()
      : analysisText;

    const today = new Date().toISOString().split("T")[0];

    // ── Step 4: Update each ElevenLabs agent ──
    const results: Array<{
      agent_id: string;
      agent_name: string;
      status: string;
      error?: string;
    }> = [];

    for (const agent of agentsToProcess) {
      try {
        // First fetch the current agent config to get the base prompt
        const getRes = await fetch(
          `https://api.elevenlabs.io/v1/convai/agents/${agent.id}`,
          {
            headers: { "xi-api-key": ELEVENLABS_API_KEY },
          }
        );

        let basePrompt = "";
        if (getRes.ok) {
          const agentData = await getRes.json();
          const currentPrompt =
            agentData?.conversation_config?.agent?.prompt?.prompt || "";
          // Strip any previous playbook section to avoid stacking
          basePrompt = currentPrompt
            .replace(/\n*=== LIVE PLAYBOOK[\s\S]*?=== END PLAYBOOK ===/g, "")
            .trim();
        }

        const updatedPrompt = `${basePrompt}\n\n=== LIVE PLAYBOOK (updated ${today}) ===\n${playbookUpdate}\n=== END PLAYBOOK ===`;

        // PATCH the agent
        const patchRes = await fetch(
          `https://api.elevenlabs.io/v1/convai/agents/${agent.id}`,
          {
            method: "PATCH",
            headers: {
              "xi-api-key": ELEVENLABS_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              conversation_config: {
                agent: {
                  prompt: {
                    prompt: updatedPrompt,
                  },
                },
              },
            }),
          }
        );

        if (!patchRes.ok) {
          const errText = await patchRes.text();
          results.push({
            agent_id: agent.id,
            agent_name: agent.name,
            status: "failed",
            error: `ElevenLabs PATCH ${patchRes.status}: ${errText}`,
          });
          continue;
        }

        // Log to playbook_history
        await supabase.from("playbook_history").insert({
          agent_id: agent.id,
          agent_name: agent.name,
          update_content: playbookUpdate,
          top_insight: topInsight,
          calls_analyzed: callLogs.length,
          wins_analyzed: wins.length,
          losses_analyzed: losses.length,
        });

        results.push({
          agent_id: agent.id,
          agent_name: agent.name,
          status: "updated",
        });
      } catch (agentErr: any) {
        results.push({
          agent_id: agent.id,
          agent_name: agent.name,
          status: "error",
          error: agentErr.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        status: "completed",
        date: today,
        calls_analyzed: callLogs.length,
        wins: wins.length,
        losses: losses.length,
        top_insight: topInsight,
        agents_updated: results,
        full_analysis: analysisText,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("agent-self-learn error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
