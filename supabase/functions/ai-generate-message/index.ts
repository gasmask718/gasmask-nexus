import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { entity_type, entity_id, message_purpose, tone_style, context } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Fetch entity details
    let entityData: any = null;
    let entityName = '';
    
    if (entity_type === 'store') {
      const { data } = await supabase
        .from('stores')
        .select('name, type, status, notes, last_visit_date')
        .eq('id', entity_id)
        .single();
      entityData = data;
      entityName = data?.name || 'Store';
    } else if (entity_type === 'customer') {
      const { data } = await supabase
        .from('crm_customers')
        .select('name, business_type, relationship_status, notes')
        .eq('id', entity_id)
        .single();
      entityData = data;
      entityName = data?.name || 'Customer';
    } else if (entity_type === 'wholesale') {
      const { data } = await supabase
        .from('wholesale_hubs')
        .select('name, status, notes')
        .eq('id', entity_id)
        .single();
      entityData = data;
      entityName = data?.name || 'Wholesale Hub';
    } else if (entity_type === 'driver' || entity_type === 'influencer') {
      const { data } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', entity_id)
        .single();
      entityData = data;
      entityName = data?.name || 'Team Member';
    }
    
    // Fetch recent communications
    const { data: recentComms } = await supabase
      .from('communication_events')
      .select('channel, summary, created_at')
      .eq('linked_entity_type', entity_type)
      .eq('linked_entity_id', entity_id)
      .order('created_at', { ascending: false })
      .limit(5);

    // Build AI prompt
    let prompt = `You are a professional business communication assistant for GasMask OS.

Generate a ${tone_style || 'professional'} ${message_purpose || 'follow-up'} message for ${entityName}.

Entity Details:
${JSON.stringify(entityData, null, 2)}

Recent Communication History:
${recentComms?.map(c => `- ${c.channel}: ${c.summary}`).join('\n') || 'No recent communications'}

Additional Context:
${context || 'None'}

Generate a concise, actionable message that is ${tone_style || 'professional'} in tone.
The message should be ready to send via SMS or email.
Keep it under 160 characters if purpose suggests SMS, otherwise 2-3 sentences max.
Do not include greetings like "Hi" or "Hello" - start directly with the message content.`;

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a professional business communication assistant. Generate concise, actionable messages.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API Error:', errorText);
      throw new Error('AI generation failed');
    }

    const aiData = await aiResponse.json();
    const message = aiData.choices?.[0]?.message?.content || '';

    return new Response(
      JSON.stringify({ message: message.trim() }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in ai-generate-message:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});