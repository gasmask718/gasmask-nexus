import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { errText } from "../_shared/errText.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results: any = { resent: 0, blocked: 0, alerted: 0, preferred: 0, savings_logged: 0 };

    // 1. Auto-resend if no supplier response > 48h
    const { data: rfqs } = await supabase
      .from('ut_rfq_requests')
      .select('*')
      .eq('status', 'sent');

    const { data: rfqResponses } = await supabase
      .from('ut_rfq_supplier_responses')
      .select('rfq_id');

    const respondedRfqIds = new Set((rfqResponses || []).map((r: any) => r.rfq_id));

    for (const rfq of (rfqs || [])) {
      const daysSinceSent = (Date.now() - new Date(rfq.created_at).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceSent > 2 && !respondedRfqIds.has(rfq.id)) {
        // Log a reminder conversation
        await supabase.from('ut_supplier_conversations').insert({
          supplier_id: null,
          channel: 'system',
          message: `[AUTO] RFQ "${rfq.product_name}" has no response after ${Math.floor(daysSinceSent)} days. Consider following up.`,
          direction: 'system',
          read_status: false,
        });
        results.resent++;
      }
    }

    // 2. Auto-block high risk suppliers (risk_score > 85)
    const { data: highRiskSuppliers } = await supabase
      .from('ut_suppliers')
      .select('id, name, risk_score, is_active')
      .gt('risk_score', 85)
      .eq('is_active', true);

    for (const supplier of (highRiskSuppliers || [])) {
      await supabase.from('ut_suppliers').update({
        is_active: false,
        verification_status: 'blocked',
        notes: `[AUTO-BLOCKED] Risk score ${supplier.risk_score} exceeded threshold (85). Blocked on ${new Date().toISOString().split('T')[0]}.`,
      }).eq('id', supplier.id);

      await supabase.from('ut_supplier_risk_profiles').upsert({
        supplier_id: supplier.id,
        risk_level: 'critical',
        risk_score: supplier.risk_score,
        last_updated: new Date().toISOString(),
      }, { onConflict: 'supplier_id' });

      results.blocked++;
    }

    // 3. Auto-alert on delayed shipments
    const { data: shipments } = await supabase
      .from('ut_shipments')
      .select('*')
      .neq('status', 'delivered');

    for (const shipment of (shipments || [])) {
      if (shipment.estimated_arrival && new Date(shipment.estimated_arrival) < new Date()) {
        const daysOverdue = Math.floor((Date.now() - new Date(shipment.estimated_arrival).getTime()) / (1000 * 60 * 60 * 24));
        if (daysOverdue > 0) {
          // Update supplier delay stats
          if (shipment.supplier_id) {
            await supabase.from('ut_suppliers').update({
              avg_shipping_delay: daysOverdue,
            }).eq('id', shipment.supplier_id);
          }
          results.alerted++;
        }
      }
    }

    // 4. Auto-preferred for well-performing suppliers
    const { data: suppliers } = await supabase
      .from('ut_suppliers')
      .select('*')
      .eq('is_active', true)
      .eq('preferred', false);

    for (const supplier of (suppliers || [])) {
      const goodOrders = (supplier.successful_orders || 0) >= 3;
      const lowRisk = (supplier.risk_score || 50) < 30;
      const noDisputes = (supplier.dispute_count || 0) === 0;

      if (goodOrders && lowRisk && noDisputes) {
        await supabase.from('ut_suppliers').update({
          preferred: true,
          verification_status: 'verified',
        }).eq('id', supplier.id);
        results.preferred++;
      }
    }

    // 5. Log negotiation savings
    const { data: negs } = await supabase
      .from('ut_supplier_negotiations')
      .select('*')
      .gt('total_savings', 0)
      .eq('status', 'finalized');

    results.savings_logged = (negs || []).length;
    const totalSavings = (negs || []).reduce((acc: number, n: any) => acc + (n.total_savings || 0), 0);

    return new Response(JSON.stringify({
      success: true,
      results,
      total_savings: totalSavings,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Automation error:', errText(error));
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
