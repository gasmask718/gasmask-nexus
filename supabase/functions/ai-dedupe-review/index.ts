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
    const { entity_type, entity_id } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Fetch entities to compare
    const tableMap: Record<string, string> = {
      customer: 'crm_customers',
      store: 'stores',
      wholesale: 'wholesale_hubs',
      driver: 'profiles',
      influencer: 'influencers',
    };

    const tableName = tableMap[entity_type];
    if (!tableName) {
      throw new Error('Invalid entity type');
    }

    const { data: entities, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(100);

    if (error) throw error;

    const targetEntity = entities?.find(e => e.id === entity_id);
    if (!targetEntity) {
      throw new Error('Entity not found');
    }

    const prompt = `You are a duplicate detection expert. Find potential duplicates for this entity:

Target Entity:
${JSON.stringify(targetEntity, null, 2)}

Compare against these entities:
${JSON.stringify(entities?.filter(e => e.id !== entity_id).slice(0, 20), null, 2)}

Look for matches based on:
- Name similarity (fuzzy matching)
- Phone number similarity
- Email similarity
- Address similarity
- Other identifying fields

Return JSON:
{
  "duplicates": [
    {
      "entity_id": "uuid",
      "similarity_score": 0-100,
      "matching_fields": ["name", "phone", ...],
      "recommendation": "merge|update|review",
      "reasoning": "why this is a duplicate"
    }
  ]
}

Only include matches with similarity_score > 70.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a duplicate detection assistant. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API Error:', errorText);
      throw new Error('AI dedupe failed');
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content || '{}';
    
    // Extract JSON from markdown if present
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      content = jsonMatch[1];
    }
    
    const result = JSON.parse(content);

    // Store dedupe suggestions
    if (result.duplicates && result.duplicates.length > 0) {
      for (const dup of result.duplicates) {
        await supabase.from('dedupe_suggestions').insert({
          entity_type,
          entity_id,
          duplicate_id: dup.entity_id,
          similarity_score: dup.similarity_score,
          merge_recommendation: dup.reasoning,
        });
      }
    }

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in ai-dedupe-review:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
