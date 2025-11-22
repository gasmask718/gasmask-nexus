import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { columns, target_table, sample_rows } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const schemaMap: Record<string, string[]> = {
      crm_customers: ['name', 'email', 'phone', 'address', 'city', 'state', 'zip', 'business_type', 'notes'],
      stores: ['name', 'type', 'address', 'city', 'state', 'zip', 'phone', 'email', 'status', 'notes'],
      wholesale_hubs: ['name', 'address', 'city', 'state', 'zip', 'phone', 'email', 'status', 'notes'],
      drivers: ['name', 'email', 'phone', 'license_number', 'vehicle_type'],
      influencers: ['name', 'username', 'platform', 'followers', 'engagement_rate', 'email', 'phone'],
      products: ['name', 'sku', 'category', 'price', 'wholesale_price', 'description'],
    };

    const targetFields = schemaMap[target_table] || [];

    const prompt = `You are a data mapping expert. Map these CSV columns to the target database schema.

CSV Columns:
${columns.join(', ')}

Target Table: ${target_table}
Target Fields: ${targetFields.join(', ')}

Sample Data (first 3 rows):
${JSON.stringify(sample_rows.slice(0, 3), null, 2)}

Return JSON mapping with confidence scores:
{
  "mappings": [
    {
      "source_column": "column_name",
      "destination_field": "field_name",
      "type": "string|number|phone|email|address",
      "confidence": 0.0-1.0,
      "required": true|false
    }
  ],
  "unmapped_columns": [...columns that couldn't be mapped...],
  "suggestions": "any notes or warnings"
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
          { role: 'system', content: 'You are a data mapping assistant. Return only valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API Error:', errorText);
      throw new Error('AI mapping failed');
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
    console.error('Error in ai-map-columns:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
