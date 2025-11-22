import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AIAgentRequest {
  agent_id: string;
  user_message: string;
  conversation_history?: Array<{ role: string; content: string }>;
  caller_context?: any;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { agent_id, user_message, conversation_history = [], caller_context }: AIAgentRequest = await req.json();

    // Get AI agent configuration
    const { data: agent } = await supabase
      .from('call_center_ai_agents')
      .select('*')
      .eq('id', agent_id)
      .single();

    if (!agent) {
      throw new Error('AI agent not found');
    }

    // Build system prompt
    const systemPrompt = `You are ${agent.name}, an AI assistant for ${agent.business_name}.

Personality: ${agent.personality}

${agent.greeting_message ? `Greeting: "${agent.greeting_message}"` : ''}

Knowledge Base:
${JSON.stringify(agent.knowledge_base, null, 2)}

Response Guidelines:
${agent.response_scripts && Array.isArray(agent.response_scripts) ? agent.response_scripts.map((s: any) => `- ${s}`).join('\n') : ''}

Allowed Actions:
${agent.allowed_actions && Array.isArray(agent.allowed_actions) ? agent.allowed_actions.map((a: any) => `- ${a}`).join('\n') : ''}

Escalation Rules:
${agent.escalation_rules && Array.isArray(agent.escalation_rules) ? agent.escalation_rules.map((r: any) => `- ${r}`).join('\n') : ''}

${caller_context ? `\nCaller Context:\n${JSON.stringify(caller_context, null, 2)}` : ''}

IMPORTANT: 
- Be helpful, professional, and aligned with your personality
- Follow the response scripts when applicable
- Escalate to a human agent if you detect any of the escalation triggers
- Keep responses concise and natural
- If asked to perform an action not in your allowed actions list, politely explain what you can help with`;

    // Build messages array
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversation_history,
      { role: 'user', content: user_message }
    ];

    // Call Lovable AI
    const aiResponse = await fetch('https://api.lovable.app/v1/inference', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-5-mini',
        messages
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.statusText}`);
    }

    const aiData = await aiResponse.json();
    const agentResponse = aiData.choices[0].message.content;

    // Check if escalation is needed
    const escalationKeywords = ['speak to manager', 'human agent', 'real person', 'escalate'];
    const needsEscalation = escalationKeywords.some(keyword => 
      user_message.toLowerCase().includes(keyword) || 
      agentResponse.toLowerCase().includes('escalat')
    );

    // Check for upsell opportunities
    const upsellKeywords = ['upgrade', 'more', 'better', 'premium', 'additional'];
    const upsellOpportunity = upsellKeywords.some(keyword => 
      user_message.toLowerCase().includes(keyword)
    );

    return new Response(
      JSON.stringify({ 
        success: true,
        response: agentResponse,
        agent_name: agent.name,
        business: agent.business_name,
        needs_escalation: needsEscalation,
        upsell_opportunity: upsellOpportunity
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Call Center AI Agent Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});