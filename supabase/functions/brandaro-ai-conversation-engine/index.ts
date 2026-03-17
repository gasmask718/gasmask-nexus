import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Brandaro AI Conversation Engine
 * Generates personalized call scripts and SMS messages based on:
 * - Lead context & heat score
 * - Conversation memory
 * - Current stage in the pipeline
 * - Selected personality
 * - Channel (call vs SMS)
 */

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      lead_id,
      lead_name,
      heat_score,
      stage,
      channel,
      personality_override,
      conversation_memory,
      attempt_number,
    } = await req.json();

    if (!stage || !channel) {
      return new Response(JSON.stringify({ error: "stage and channel are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build the prompt based on stage + channel + personality
    const personality = personality_override || "Professional Closer";
    const isCall = channel.includes("call");

    const stagePrompts: Record<string, string> = {
      first_contact: isCall
        ? `You're making a first outbound sales call to ${lead_name || "a business owner"}. Your goal is to qualify interest in getting a professional website/online presence. Be warm, confident, and direct. Ask one qualifying question.`
        : `Write a short, friendly first-contact SMS to ${lead_name || "a business owner"} about improving their online presence. Keep it under 160 chars. Include a clear CTA.`,
      follow_up: isCall
        ? `This is a follow-up call to ${lead_name || "a lead"} you've previously contacted. Reference the previous interaction naturally. Push for a concrete next step (demo, meeting, quote).`
        : `Write a follow-up SMS to ${lead_name || "a lead"}. Reference previous conversation. Create urgency. Under 160 chars.`,
      nurturing: isCall
        ? `${lead_name || "This lead"} has shown interest but hasn't committed. Your job is to overcome hesitation, provide value, and guide toward a decision. Use social proof.`
        : `Write a nurturing SMS to ${lead_name || "an interested lead"}. Share a quick value point or social proof. Under 160 chars.`,
      re_engagement: isCall
        ? `${lead_name || "This lead"} has gone cold after ${attempt_number || "several"} attempts. Use a completely different angle. Try curiosity, exclusivity, or a time-limited offer.`
        : `Write a re-engagement SMS to ${lead_name || "a cold lead"}. Use a fresh angle — curiosity or limited offer. Under 160 chars.`,
      closing: isCall
        ? `${lead_name || "This lead"} is ready to buy. Guide them to complete payment. Handle any last-minute objections with confidence. Create urgency.`
        : `Write a closing SMS to ${lead_name || "a hot lead"}. Push for payment completion. Create urgency. Include payment link placeholder [LINK]. Under 200 chars.`,
    };

    const stagePrompt = stagePrompts[stage] || stagePrompts.follow_up;

    const systemPrompt = `You are "${personality}", an elite AI sales agent for Brandaro Digital.

RULES:
- Sound 100% human and natural
- Never mention you're AI
- Be conversational, not corporate
- Match the energy level to the lead's heat score (${heat_score || 50}/100)
- ${heat_score >= 70 ? "This is a HOT lead — be assertive and push for action" : heat_score >= 30 ? "This is a warm lead — build rapport while guiding toward action" : "This is a cold lead — focus on curiosity and value"}

CONTEXT:
${conversation_memory ? `Previous interactions:\n${conversation_memory}` : "No previous interaction history."}
Attempt #${attempt_number || 1}

${isCall ? "Generate a natural-sounding CALL SCRIPT (what you would say). 2-4 sentences max." : "Generate an SMS message."}`;

    // Use Lovable AI (Gemini) for generation
    const aiResponse = await fetch("https://qalaaroashbggynpvqct.supabase.co/functions/v1/ai-generate-message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
      },
      body: JSON.stringify({
        system_prompt: systemPrompt,
        user_prompt: stagePrompt,
        max_tokens: isCall ? 300 : 100,
      }),
    });

    let message: string;

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      message = aiData?.message || aiData?.text || aiData?.content || "";
    }

    // Fallback templates if AI fails
    if (!message!) {
      message = getFallbackMessage(stage, channel, lead_name, attempt_number);
    }

    return new Response(JSON.stringify({
      ok: true,
      message,
      stage,
      channel,
      personality,
      attempt: attempt_number,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Conversation engine error:", e);

    // Always return a usable fallback
    return new Response(JSON.stringify({
      ok: true,
      message: "Hey! Quick question — have you thought about getting more customers through a professional online presence? We're helping businesses like yours grow right now. Interested?",
      fallback: true,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getFallbackMessage(stage: string, channel: string, name?: string, attempt?: number): string {
  const isSMS = !channel.includes("call");
  const n = name || "there";

  const templates: Record<string, string[]> = {
    first_contact: isSMS ? [
      `Hi ${n}! We help businesses like yours get found online. Interested in a free consultation? Reply YES 🚀`,
      `Hey ${n}! Quick Q — are you happy with how customers find your business online? We can help. Reply to chat!`,
    ] : [
      `Hi ${n}, this is a quick call from Brandaro Digital. We specialize in helping businesses get more customers online. Do you have 30 seconds?`,
    ],
    follow_up: isSMS ? [
      `Hi ${n}, just following up! We'd love to show you how we can boost your online presence. Still interested?`,
      `Hey ${n}! Circling back — we have availability this week for a quick strategy session. Want in?`,
    ] : [
      `Hey ${n}, I'm following up from our earlier conversation. I wanted to see if you had any questions about getting your business online.`,
    ],
    nurturing: isSMS ? [
      `${n}, one of our clients just saw a 40% increase in calls after launching with us. Want similar results? 📈`,
    ] : [
      `${n}, I know you've been thinking about this. Let me share what we did for a business just like yours — it might change your mind.`,
    ],
    re_engagement: isSMS ? [
      `${n}, we have 2 spots left this month for our launch special. Don't want you to miss out! Details?`,
      `Hey ${n}! We just updated our packages — some really cool options now. Want a quick look?`,
    ] : [
      `${n}, it's been a while! We just rolled out something new that I think would be perfect for your business. Got a minute?`,
    ],
    closing: isSMS ? [
      `${n}, your package is ready to go! Complete setup here: [LINK] — spots are filling fast 🔥`,
      `Almost there ${n}! Lock in your special rate before it expires: [LINK] 💰`,
    ] : [
      `${n}, everything is set up for you. All we need is your go-ahead and we can start building immediately. Ready to get started?`,
    ],
  };

  const msgs = templates[stage] || templates.follow_up;
  return msgs[Math.floor(Math.random() * msgs.length)];
}
