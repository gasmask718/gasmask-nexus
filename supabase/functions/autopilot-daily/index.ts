import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRABBA_BRANDS = ['gasmask', 'hotmama', 'scalati', 'grabba'] as const;

// Task type mapping
const ALERT_TYPE_TO_TASK = {
  inventory: 'restock_run',
  payment: 'collection_call',
  delivery: 'driver_review',
  ambassador: 'ambassador_checkin',
  communication: 'communication_followup',
  production: 'production_boost',
};

const TASK_TYPE_TO_FLOOR = {
  store_checkin: 1,
  communication_followup: 2,
  restock_run: 3,
  inventory_audit: 3,
  driver_review: 4,
  route_optimization: 4,
  collection_call: 5,
  pricing_review: 5,
  production_boost: 6,
  wholesaler_activation: 7,
  promo_push: 7,
  ambassador_checkin: 8,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Running daily autopilot task generation...");

    // Fetch intelligence data
    const [storesRes, ordersRes, paymentsRes, inventoryRes] = await Promise.all([
      supabase.from("stores").select("id, name, neighborhood").limit(500),
      supabase.from("wholesale_orders").select("*").in("brand", [...GRABBA_BRANDS]).order("created_at", { ascending: false }).limit(500),
      supabase.from("store_payments").select("*").limit(500),
      supabase.from("store_tube_inventory").select("*").in("brand", [...GRABBA_BRANDS]),
    ]);

    const stores = storesRes.data || [];
    const orders = ordersRes.data || [];
    const payments = paymentsRes.data || [];
    const inventory = inventoryRes.data || [];

    const tasks: any[] = [];
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Check for existing tasks today to avoid duplicates
    const { data: existingTasks } = await supabase
      .from("grabba_autopilot_tasks")
      .select("entity_id, type")
      .gte("created_at", `${today}T00:00:00Z`);

    const existingSet = new Set(
      (existingTasks || []).map((t: any) => `${t.entity_id}-${t.type}`)
    );

    // Generate low stock alerts
    const lowStock = inventory.filter((inv: any) => (inv.current_tubes_left || 0) < 50);
    lowStock.forEach((inv: any) => {
      const key = `${inv.store_id}-restock_run`;
      if (existingSet.has(key)) return;

      const daysUntilEmpty = Math.max(1, Math.floor((inv.current_tubes_left || 0) / 10));
      const priority = daysUntilEmpty <= 2 ? 'critical' : daysUntilEmpty <= 5 ? 'high' : 'medium';
      
      tasks.push({
        type: 'restock_run',
        floor: 3,
        brand: inv.brand,
        priority,
        title: `Restock Store`,
        description: `Only ${inv.current_tubes_left || 0} tubes remaining. Estimated ${daysUntilEmpty} days until empty.`,
        entity_id: inv.store_id,
        entity_type: 'store',
        suggested_due_date: new Date(now.getTime() + daysUntilEmpty * 24 * 60 * 60 * 1000).toISOString(),
        source: 'daily_report',
        status: 'pending',
      });
    });

    // Generate payment alerts
    const unpaidPayments = payments.filter((p: any) => 
      p.payment_status !== 'paid' && 
      ((p.owed_amount || 0) - (p.paid_amount || 0)) > 500
    );

    unpaidPayments.forEach((payment: any) => {
      const key = `${payment.store_id || payment.company_id}-collection_call`;
      if (existingSet.has(key)) return;

      const amount = (payment.owed_amount || 0) - (payment.paid_amount || 0);
      const daysPastDue = payment.due_date 
        ? Math.max(0, Math.floor((Date.now() - new Date(payment.due_date).getTime()) / (1000 * 60 * 60 * 24)))
        : 30;
      
      const priority = daysPastDue > 45 || amount > 3000 ? 'critical' : daysPastDue > 30 ? 'high' : 'medium';

      tasks.push({
        type: 'collection_call',
        floor: 5,
        priority,
        title: `Collection: $${amount.toLocaleString()} outstanding`,
        description: `${daysPastDue} days past due. Follow up required.`,
        entity_id: payment.store_id || payment.company_id,
        entity_type: payment.store_id ? 'store' : 'company',
        suggested_due_date: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        source: 'daily_report',
        status: 'pending',
      });
    });

    // Insert tasks (limit to prevent flooding)
    const tasksToInsert = tasks
      .sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return (priorityOrder[a.priority as keyof typeof priorityOrder] || 3) - 
               (priorityOrder[b.priority as keyof typeof priorityOrder] || 3);
      })
      .slice(0, 50); // Max 50 tasks per day

    if (tasksToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("grabba_autopilot_tasks")
        .insert(tasksToInsert);

      if (insertError) {
        console.error("Error inserting tasks:", insertError);
        throw insertError;
      }
    }

    console.log(`Daily autopilot complete: ${tasksToInsert.length} tasks created`);

    return new Response(
      JSON.stringify({
        success: true,
        tasksCreated: tasksToInsert.length,
        summary: {
          lowStockAlerts: lowStock.length,
          paymentAlerts: unpaidPayments.length,
          totalGenerated: tasks.length,
          totalInserted: tasksToInsert.length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in autopilot-daily:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
