import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface SignalResult {
  signal_type: string;
  invoice_id: string;
  invoice_number: string;
  action: 'mission_created' | 'duplicate_detected' | 'context_appended';
  mission_id?: string;
  details: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate the calling user (must be owner/admin)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify owner/admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['owner', 'admin'].includes(profile.role)) {
      return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ──────────────────────────────────────────────
    // SIGNAL DETECTION: Find unpaid invoices >30 days overdue
    // ──────────────────────────────────────────────
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];

    const { data: overdueInvoices, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, invoice_number, total_amount, total, due_date, store_id, company_id, brand')
      .eq('payment_status', 'unpaid')
      .gt('total', 0)
      .lt('due_date', cutoffDate);

    if (invoiceError) throw invoiceError;

    if (!overdueInvoices || overdueInvoices.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        signals_detected: 0,
        missions_created: 0,
        duplicates_found: 0,
        results: [],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ──────────────────────────────────────────────
    // DUPLICATE PREVENTION: Check existing active missions
    // ──────────────────────────────────────────────
    const sourceRefs = overdueInvoices.map(inv => `invoice:${inv.id}`);

    const { data: existingMissions } = await supabase
      .from('owner_missions')
      .select('id, source_reference, status')
      .in('source_reference', sourceRefs)
      .in('status', ['pending', 'in_progress', 'blocked']);

    const existingRefMap = new Map(
      (existingMissions || []).map(m => [m.source_reference, m])
    );

    // ──────────────────────────────────────────────
    // Resolve store names for better mission titles
    // ──────────────────────────────────────────────
    const storeIds = [...new Set(overdueInvoices.map(i => i.store_id).filter(Boolean))];
    let storeMap = new Map<string, string>();
    if (storeIds.length > 0) {
      const { data: stores } = await supabase
        .from('store_master')
        .select('id, store_name')
        .in('id', storeIds);
      storeMap = new Map((stores || []).map(s => [s.id, s.store_name]));
    }

    // ──────────────────────────────────────────────
    // PROCESS SIGNALS
    // ──────────────────────────────────────────────
    const results: SignalResult[] = [];
    const now = new Date();

    for (const invoice of overdueInvoices) {
      const sourceRef = `invoice:${invoice.id}`;
      const daysOverdue = Math.floor(
        (now.getTime() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24)
      );
      const severityScore = Math.min(10, Math.floor(daysOverdue / 10));
      const priority = daysOverdue >= 60 ? 'critical' : 'high';
      const amount = invoice.total || invoice.total_amount || 0;
      const storeName = invoice.store_id ? storeMap.get(invoice.store_id) : null;
      const customerLabel = storeName || invoice.brand || `Invoice #${invoice.invoice_number}`;

      const existing = existingRefMap.get(sourceRef);

      if (existing) {
        // DUPLICATE: Append context update to activity log
        await supabase.from('owner_mission_activity').insert({
          mission_id: existing.id,
          action: 'context_appended',
          details: `Invoice now ${daysOverdue} days overdue. Amount: $${amount}. Severity: ${severityScore}/10.`,
          performed_by: 'system',
        });

        // Update severity if it increased
        await supabase
          .from('owner_missions')
          .update({
            severity_score: severityScore,
            priority: priority,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        results.push({
          signal_type: 'unpaid_invoice',
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          action: 'duplicate_detected',
          mission_id: existing.id,
          details: `Active mission exists. Context appended: ${daysOverdue} days overdue.`,
        });
      } else {
        // NEW MISSION: Create governed mission
        const title = `Unpaid invoice overdue: ${customerLabel}`;
        const description = `Invoice #${invoice.invoice_number} has been unpaid for ${daysOverdue} days.\nAmount: $${amount}.\nDue date: ${invoice.due_date}.`;

        const { data: newMission, error: createError } = await supabase
          .from('owner_missions')
          .insert({
            owner_id: user.id,
            title,
            description,
            category: 'financial',
            priority,
            status: 'pending',
            source: 'floor_generated',
            floor_origin: 'floor5_finance',
            source_entity_type: 'invoice',
            source_entity_id: invoice.id,
            source_reference: sourceRef,
            severity_score: severityScore,
            tags: ['overdue', 'finance', 'auto-signal'],
          })
          .select('id')
          .single();

        if (createError) {
          console.error(`Failed to create mission for invoice ${invoice.id}:`, createError);
          continue;
        }

        // Log signal detection + mission creation
        await supabase.from('owner_mission_activity').insert([
          {
            mission_id: newMission.id,
            action: 'signal_detected',
            details: `Finance signal: Invoice #${invoice.invoice_number} unpaid for ${daysOverdue} days ($${invoice.total_amount}).`,
            performed_by: 'system',
          },
          {
            mission_id: newMission.id,
            action: 'mission_created',
            details: `Mission auto-created from Floor 5 finance signal. Priority: ${priority}. Severity: ${severityScore}/10.`,
            performed_by: 'system',
          },
        ]);

        results.push({
          signal_type: 'unpaid_invoice',
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          action: 'mission_created',
          mission_id: newMission.id,
          details: `New mission created: ${daysOverdue} days overdue, $${amount}.`,
        });
      }
    }

    const missionsCreated = results.filter(r => r.action === 'mission_created').length;
    const duplicatesFound = results.filter(r => r.action === 'duplicate_detected').length;

    return new Response(JSON.stringify({
      success: true,
      signals_detected: overdueInvoices.length,
      missions_created: missionsCreated,
      duplicates_found: duplicatesFound,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Finance signal scanner error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
