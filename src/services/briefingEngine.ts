// ═══════════════════════════════════════════════════════════════════════════════
// BRIEFING ENGINE SERVICE — AI-powered daily briefing generation
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/integrations/supabase/client';

export interface DailyBriefingContent {
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

export interface BriefingRecord {
  id: string;
  briefing_date: string;
  briefing_type: 'morning' | 'evening';
  content: DailyBriefingContent;
  ai_summary: string | null;
  created_at: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUILD BRIEFING DATA
// ═══════════════════════════════════════════════════════════════════════════════

export async function buildBriefingData(
  type: 'morning' | 'evening',
  date?: string
): Promise<DailyBriefingContent> {
  const client = supabase as any;
  const targetDate = date || new Date().toISOString().split('T')[0];

  // Fetch all data in parallel
  const [risksRes, actionsRes, escalationsRes, kpiRes] = await Promise.all([
    client
      .from('ai_risk_insights')
      .select('entity_type, risk_level, risk_type')
      .eq('status', 'open'),
    client
      .from('ai_follow_up_log')
      .select('action_category, action_taken')
      .gte('created_at', `${targetDate}T00:00:00`),
    client
      .from('ai_communication_queue')
      .select('entity_type, entity_id, reason, urgency')
      .eq('status', 'pending')
      .gte('urgency', 70)
      .order('urgency', { ascending: false })
      .limit(10),
    client
      .from('ai_kpi_snapshots')
      .select('*')
      .order('snapshot_date', { ascending: false })
      .limit(1),
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

  // Generate top priorities based on urgency
  const topPriorities: string[] = [];
  
  // Critical items first
  const criticalRisks = risks.filter((r: any) => r.risk_level === 'critical');
  if (criticalRisks.length > 0) {
    topPriorities.push(`Handle ${criticalRisks.length} critical risk items immediately`);
  }
  
  // High urgency escalations
  const highUrgency = escalations.filter((e: any) => e.urgency >= 80);
  if (highUrgency.length > 0) {
    topPriorities.push(`Address ${highUrgency.length} high-urgency escalations`);
  }
  
  // Unpaid invoices
  if (summary.unpaidInvoices > 0) {
    topPriorities.push(`Follow up on ${summary.unpaidInvoices} unpaid invoices`);
  }
  
  // Store visits
  if (summary.storesNeedingVisits > 0) {
    topPriorities.push(`Schedule visits for ${summary.storesNeedingVisits} at-risk stores`);
  }
  
  // Low stock
  if (summary.lowStockItems > 0) {
    topPriorities.push(`Reorder ${summary.lowStockItems} low-stock items`);
  }

  // Tomorrow's plan for evening briefing
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

// ═══════════════════════════════════════════════════════════════════════════════
// GENERATE AI SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

export async function generateAiSummary(
  content: DailyBriefingContent
): Promise<{ summary: string; priorities: string[] }> {
  try {
    // Call AI edge function for summary generation
    const { data, error } = await supabase.functions.invoke('daily-briefing', {
      body: { 
        action: 'generate_summary',
        content 
      },
    });

    if (error) throw error;

    return {
      summary: data?.summary || generateFallbackSummary(content),
      priorities: data?.priorities || content.topPriorities,
    };
  } catch (error) {
    console.error('Failed to generate AI summary:', error);
    // Return fallback summary
    return {
      summary: generateFallbackSummary(content),
      priorities: content.topPriorities,
    };
  }
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

// ═══════════════════════════════════════════════════════════════════════════════
// SAVE BRIEFING
// ═══════════════════════════════════════════════════════════════════════════════

export async function saveBriefing(
  content: DailyBriefingContent,
  aiSummary?: string
): Promise<void> {
  const client = supabase as any;
  
  await client.from('ai_daily_briefings').insert({
    briefing_type: content.type,
    briefing_date: content.date,
    content,
    ai_summary: aiSummary || null,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET LATEST BRIEFINGS
// ═══════════════════════════════════════════════════════════════════════════════

export async function getLatestBriefings(
  date?: string
): Promise<{ morning?: BriefingRecord; evening?: BriefingRecord }> {
  const client = supabase as any;
  const targetDate = date || new Date().toISOString().split('T')[0];

  const { data, error } = await client
    .from('ai_daily_briefings')
    .select('*')
    .eq('briefing_date', targetDate)
    .order('created_at', { ascending: false });

  if (error || !data) {
    return {};
  }

  const morning = data.find((b: any) => b.briefing_type === 'morning');
  const evening = data.find((b: any) => b.briefing_type === 'evening');

  return { morning, evening };
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET BRIEFING CONTENT WITH AI ENHANCEMENT
// ═══════════════════════════════════════════════════════════════════════════════

export async function getEnhancedBriefingContent(
  record: BriefingRecord
): Promise<DailyBriefingContent> {
  const content = record.content as DailyBriefingContent;
  
  // If we already have AI commentary, return as-is
  if (content.aiCommentary) {
    return content;
  }
  
  // Add the stored AI summary if available
  if (record.ai_summary) {
    return {
      ...content,
      aiCommentary: record.ai_summary,
    };
  }
  
  return content;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FULL BRIEFING GENERATION (BUILD + AI + SAVE)
// ═══════════════════════════════════════════════════════════════════════════════

export async function generateFullBriefing(
  type: 'morning' | 'evening',
  date?: string
): Promise<DailyBriefingContent> {
  // Build the raw briefing data
  const content = await buildBriefingData(type, date);
  
  // Generate AI summary and priorities
  const { summary, priorities } = await generateAiSummary(content);
  
  // Enhance content with AI output
  const enhancedContent: DailyBriefingContent = {
    ...content,
    aiCommentary: summary,
    topPriorities: priorities.length > 0 ? priorities : content.topPriorities,
  };
  
  // Save to database
  await saveBriefing(enhancedContent, summary);
  
  return enhancedContent;
}
