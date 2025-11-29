// ═══════════════════════════════════════════════════════════════════════════════
// DAILY BRIEFING EDGE FUNCTION — Generate AI-powered daily briefings
// ═══════════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DailyBriefingContent {
  date: string;
  type: 'morning' | 'evening';
  summary: {
    newRisks: number;
    storesNeedingVisits: number;
    unpaidInvoices: number;
    lowStockItems: number;
    driverIssues: number;
    ambassadorIssues: number;
  };
  actionsTaken: {
    invoicesEmailed: number;
    storesTexted: number;
    tasksCreated: number;
    routesGenerated: number;
    ambassadorsMessaged: number;
    reorderAlertsSent: number;
  };
  escalations: Array<{
    entityType: string;
    entityId: string;
    reason: string;
    urgency: number;
  }>;
  recommendations: string[];
  tomorrowPlan?: string[];
  topPriorities: string[];
  aiCommentary?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { type, date, action, content } = body;

    // Handle summary generation request
    if (action === 'generate_summary' && content) {
      const summary = await generateAiSummaryFromContent(content);
      return new Response(JSON.stringify(summary), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine briefing type based on time if not provided
    const currentHour = new Date().getHours();
    const briefingType: 'morning' | 'evening' = type || (currentHour < 14 ? 'morning' : 'evening');
    const targetDate = date || new Date().toISOString().split('T')[0];

    console.log(`Generating ${briefingType} briefing for ${targetDate}`);

    // Build briefing data
    const briefingContent = await buildBriefingData(supabase, briefingType, targetDate);

    // Generate AI summary
    const aiResult = await generateAiSummary(briefingContent);
    
    // Enhance content with AI output
    const enhancedContent: DailyBriefingContent = {
      ...briefingContent,
      aiCommentary: aiResult.summary,
      topPriorities: aiResult.priorities.length > 0 ? aiResult.priorities : briefingContent.topPriorities,
    };

    // Save to database
    const { error: insertError } = await supabase
      .from('ai_daily_briefings')
      .insert({
        briefing_type: briefingType,
        briefing_date: targetDate,
        content: enhancedContent,
        ai_summary: aiResult.summary,
      });

    if (insertError) {
      console.error('Failed to save briefing:', insertError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        type: briefingType,
        date: targetDate,
        briefing: enhancedContent,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Daily briefing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function buildBriefingData(
  supabase: any,
  type: 'morning' | 'evening',
  targetDate: string
): Promise<DailyBriefingContent> {
  // Fetch all data in parallel
  const [risksRes, actionsRes, escalationsRes] = await Promise.all([
    supabase
      .from('ai_risk_insights')
      .select('entity_type, risk_level, risk_type')
      .eq('status', 'open'),
    supabase
      .from('ai_follow_up_log')
      .select('action_category, action_taken')
      .gte('created_at', `${targetDate}T00:00:00`),
    supabase
      .from('ai_communication_queue')
      .select('entity_type, entity_id, reason, urgency')
      .eq('status', 'pending')
      .gte('urgency', 70)
      .order('urgency', { ascending: false })
      .limit(10),
  ]);

  const risks = risksRes.data || [];
  const todayActions = actionsRes.data || [];
  const escalations = escalationsRes.data || [];

  // Calculate risk summary
  const summary = {
    newRisks: risks.length,
    storesNeedingVisits: risks.filter((r: any) => r.entity_type === 'store' && r.risk_type === 'churn').length,
    unpaidInvoices: risks.filter((r: any) => r.entity_type === 'invoice').length,
    lowStockItems: risks.filter((r: any) => r.risk_type === 'low_stock').length,
    driverIssues: risks.filter((r: any) => r.entity_type === 'driver').length,
    ambassadorIssues: risks.filter((r: any) => r.entity_type === 'ambassador').length,
  };

  // Calculate actions taken
  const actionsTaken = {
    invoicesEmailed: todayActions.filter((a: any) => a.action_category === 'invoice').length,
    storesTexted: todayActions.filter((a: any) => a.action_category === 'store').length,
    tasksCreated: todayActions.filter((a: any) => a.action_taken?.includes('task')).length,
    routesGenerated: todayActions.filter((a: any) => a.action_taken?.includes('route')).length,
    ambassadorsMessaged: todayActions.filter((a: any) => a.action_category === 'ambassador').length,
    reorderAlertsSent: todayActions.filter((a: any) => a.action_category === 'inventory').length,
  };

  // Generate recommendations
  const recommendations: string[] = [];
  if (summary.storesNeedingVisits > 10) {
    recommendations.push(`Consider creating a bulk recovery route for ${summary.storesNeedingVisits} at-risk stores`);
  }
  if (summary.unpaidInvoices > 5) {
    recommendations.push(`${summary.unpaidInvoices} unpaid invoices need attention - consider a collections push`);
  }
  if (summary.lowStockItems > 0) {
    recommendations.push(`Review ${summary.lowStockItems} low-stock items for potential reorders`);
  }
  if (summary.driverIssues > 0) {
    recommendations.push(`Address ${summary.driverIssues} driver-related issues to maintain delivery quality`);
  }
  if (summary.ambassadorIssues > 0) {
    recommendations.push(`Re-engage ${summary.ambassadorIssues} inactive ambassadors with outreach`);
  }

  // Generate top priorities
  const topPriorities: string[] = [];
  const criticalRisks = risks.filter((r: any) => r.risk_level === 'critical');
  if (criticalRisks.length > 0) {
    topPriorities.push(`Handle ${criticalRisks.length} critical risk items immediately`);
  }
  const highUrgency = escalations.filter((e: any) => e.urgency >= 80);
  if (highUrgency.length > 0) {
    topPriorities.push(`Address ${highUrgency.length} high-urgency escalations`);
  }
  if (summary.unpaidInvoices > 0) {
    topPriorities.push(`Follow up on ${summary.unpaidInvoices} unpaid invoices`);
  }
  if (summary.storesNeedingVisits > 0) {
    topPriorities.push(`Schedule visits for ${summary.storesNeedingVisits} at-risk stores`);
  }
  if (summary.lowStockItems > 0) {
    topPriorities.push(`Reorder ${summary.lowStockItems} low-stock items`);
  }

  const tomorrowPlan = type === 'evening' ? [
    'Run morning risk scan at 8 AM',
    'Process follow-ups for high-priority items',
    'Generate optimized routes for recovery visits',
    'Review ambassador activity and send motivation messages',
    'Check inventory levels and process reorders',
  ] : undefined;

  return {
    date: targetDate,
    type,
    summary,
    actionsTaken,
    escalations: escalations.map((e: any) => ({
      entityType: e.entity_type,
      entityId: e.entity_id,
      reason: e.reason,
      urgency: e.urgency,
    })),
    recommendations,
    tomorrowPlan,
    topPriorities,
  };
}

async function generateAiSummary(content: DailyBriefingContent): Promise<{ summary: string; priorities: string[] }> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    console.log('No LOVABLE_API_KEY, using fallback summary');
    return {
      summary: generateFallbackSummary(content),
      priorities: content.topPriorities,
    };
  }

  try {
    const prompt = `You are an operations manager AI assistant. Based on the following business data, write a brief 2-3 sentence summary of the current situation and list the top 3-5 priorities in order of importance.

Current Data:
- Active Risks: ${content.summary.newRisks}
- Stores Needing Visits: ${content.summary.storesNeedingVisits}
- Unpaid Invoices: ${content.summary.unpaidInvoices}
- Low Stock Items: ${content.summary.lowStockItems}
- Driver Issues: ${content.summary.driverIssues}
- Ambassador Issues: ${content.summary.ambassadorIssues}

Today's Actions Completed:
- Invoices Emailed: ${content.actionsTaken.invoicesEmailed}
- Stores Texted: ${content.actionsTaken.storesTexted}
- Tasks Created: ${content.actionsTaken.tasksCreated}
- Routes Generated: ${content.actionsTaken.routesGenerated}

Escalations Pending: ${content.escalations.length}

Briefing Type: ${content.type}

Respond in JSON format:
{
  "summary": "Your 2-3 sentence summary here",
  "priorities": ["Priority 1", "Priority 2", "Priority 3"]
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a business operations AI. Respond only with valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI request failed: ${response.status}`);
    }

    const data = await response.json();
    const aiContent = data.choices?.[0]?.message?.content || '';
    
    // Parse JSON from response
    const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: parsed.summary || generateFallbackSummary(content),
        priorities: parsed.priorities || content.topPriorities,
      };
    }
    
    throw new Error('Could not parse AI response');
  } catch (error) {
    console.error('AI summary generation failed:', error);
    return {
      summary: generateFallbackSummary(content),
      priorities: content.topPriorities,
    };
  }
}

async function generateAiSummaryFromContent(content: DailyBriefingContent): Promise<{ summary: string; priorities: string[] }> {
  return generateAiSummary(content);
}

function generateFallbackSummary(content: DailyBriefingContent): string {
  const { summary, actionsTaken, escalations } = content;
  const totalActions = Object.values(actionsTaken).reduce((a, b) => a + b, 0);
  
  let summaryText = `Today's ${content.type} briefing: `;
  
  if (summary.newRisks > 0) {
    summaryText += `${summary.newRisks} active risks identified. `;
  }
  
  if (totalActions > 0) {
    summaryText += `${totalActions} automated actions completed. `;
  }
  
  if (escalations.length > 0) {
    summaryText += `${escalations.length} items require manual attention. `;
  }
  
  if (summary.unpaidInvoices > 0 || summary.storesNeedingVisits > 0) {
    summaryText += `Focus areas: `;
    const focuses = [];
    if (summary.unpaidInvoices > 0) focuses.push(`${summary.unpaidInvoices} unpaid invoices`);
    if (summary.storesNeedingVisits > 0) focuses.push(`${summary.storesNeedingVisits} stores needing visits`);
    summaryText += focuses.join(', ') + '.';
  }
  
  return summaryText || 'Operations running smoothly with no major issues to report.';
}
