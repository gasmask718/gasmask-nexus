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
    const { rows, target_table, mapping } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Build AI prompt for data cleaning
    const prompt = `You are a data cleaning expert. Clean and normalize the following ${target_table} data:

Sample rows (first 10):
${JSON.stringify(rows.slice(0, 10), null, 2)}

Target schema: ${target_table}
Column mapping: ${JSON.stringify(mapping, null, 2)}

Tasks:
1. Fix capitalization (proper case for names, uppercase for states)
2. Normalize phone numbers to E.164 format (+1XXXXXXXXXX)
3. Normalize email addresses (lowercase)
4. Fix address formatting and typos
5. Standardize city/state names
6. Detect and flag duplicates
7. Flag invalid or suspicious data
8. Fill missing fields only if highly confident

Return JSON with:
{
  "cleaned_rows": [...cleaned data...],
  "flagged_rows": [...rows needing review...],
  "duplicates": [...potential duplicates...],
  "summary": "cleaning summary text"
}`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a data cleaning assistant. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API Error:', errorText);
      throw new Error('AI cleaning failed');
    }

    const aiData = await aiResponse.json();
    let content = aiData.choices?.[0]?.message?.content || '{}';
    
    // Extract JSON from markdown if present
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      content = jsonMatch[1];
    }
    
    const result = JSON.parse(content);

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in ai-clean-data:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
