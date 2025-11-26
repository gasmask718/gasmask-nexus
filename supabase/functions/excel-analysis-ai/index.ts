import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { fileName, data, columns, attachToBrand, attachToStore } = await req.json();

    console.log('Analyzing Excel file:', fileName);
    console.log('Columns detected:', columns);
    console.log('Row count:', data?.length);

    // Auto-classify columns
    const dataClassification: Record<string, string> = {};
    columns.forEach((col: string) => {
      const lower = col.toLowerCase();
      if (lower.includes('revenue') || lower.includes('sales') || lower.includes('amount') || lower.includes('price')) {
        dataClassification[col] = 'monetary';
      } else if (lower.includes('date') || lower.includes('time')) {
        dataClassification[col] = 'temporal';
      } else if (lower.includes('store') || lower.includes('location') || lower.includes('customer')) {
        dataClassification[col] = 'entity';
      } else if (lower.includes('qty') || lower.includes('quantity') || lower.includes('count')) {
        dataClassification[col] = 'numeric';
      } else {
        dataClassification[col] = 'categorical';
      }
    });

    // Prepare data summary for AI
    const dataSummary = {
      totalRows: data.length,
      columns: columns,
      classification: dataClassification,
      sampleData: data.slice(0, 5), // First 5 rows
      statistics: calculateStats(data, columns),
    };

    // Call Lovable AI for deep analysis
    const prompt = `You are a business intelligence analyst for Dynasty OS. Analyze this Excel data and provide actionable insights.

FILE: ${fileName}
COLUMNS: ${JSON.stringify(columns)}
CLASSIFICATION: ${JSON.stringify(dataClassification)}
ROWS: ${data.length}
SAMPLE DATA: ${JSON.stringify(data.slice(0, 10))}

Provide analysis in the following JSON structure:
{
  "trends": [{"title": "...", "description": "...", "severity": "high/medium/low"}],
  "anomalies": [{"title": "...", "description": "...", "impact": "..."}],
  "performanceRankings": [{"entity": "...", "metric": "...", "value": "...", "rank": 1}],
  "profitability": {"summary": "...", "recommendations": []},
  "growthVsDecline": {"growth": [], "decline": []},
  "comparisons": [{"comparison": "...", "insight": "..."}],
  "cashLeaks": [{"issue": "...", "estimatedLoss": "...", "fix": "..."}],
  "forecasting": {"prediction": "...", "confidence": "...", "factors": []},
  "operationalIssues": [{"issue": "...", "priority": "...", "solution": "..."}],
  "summary": "Executive summary in 2-3 paragraphs",
  "actionPlan": [{"action": "...", "priority": "high/medium/low", "timeline": "..."}]
}

Focus on Dynasty OS context: stores, delivery routes, brands, revenue, inventory, customer behavior.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a business intelligence AI. Return analysis as valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const analysis = JSON.parse(aiData.choices[0].message.content);

    console.log('AI analysis complete');

    // Save analysis to database
    const { data: savedAnalysis, error } = await supabase
      .from('excel_analyses')
      .insert({
        file_name: fileName,
        uploaded_by: req.headers.get('x-user-id') || null,
        columns_detected: columns,
        data_classification: dataClassification,
        analysis_results: analysis,
        ai_summary: analysis.summary,
        ai_recommendations: JSON.stringify(analysis.actionPlan),
        action_plan: analysis.actionPlan,
        attached_to_brand: attachToBrand,
        attached_to_store: attachToStore,
        status: 'completed',
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({
      success: true,
      analysisId: savedAnalysis.id,
      analysis,
      dataSummary,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in excel-analysis-ai:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function calculateStats(data: any[], columns: string[]) {
  const stats: Record<string, any> = {};
  
  columns.forEach(col => {
    const values = data.map(row => row[col]).filter(v => v != null);
    const numericValues = values.filter(v => !isNaN(Number(v))).map(Number);
    
    if (numericValues.length > 0) {
      stats[col] = {
        count: numericValues.length,
        min: Math.min(...numericValues),
        max: Math.max(...numericValues),
        avg: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
        sum: numericValues.reduce((a, b) => a + b, 0),
      };
    } else {
      const uniqueValues = [...new Set(values)];
      stats[col] = {
        count: values.length,
        unique: uniqueValues.length,
        top: uniqueValues.slice(0, 5),
      };
    }
  });
  
  return stats;
}