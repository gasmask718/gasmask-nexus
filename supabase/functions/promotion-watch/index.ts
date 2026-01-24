import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, ...params } = await req.json();

    switch (action) {
      case 'run_watch_check': {
        // Get all active promotions in watch mode
        const { data: activePromotions, error } = await supabase
          .from('ai_promotions')
          .select('*')
          .eq('watch_mode_active', true)
          .eq('is_rolled_back', false);

        if (error) throw error;

        const results: Array<{
          promotion_id: string;
          status: string;
          action_taken: string;
        }> = [];

        for (const promotion of activePromotions || []) {
          // Check if watch mode should expire
          const watchUntil = new Date(promotion.watch_mode_until);
          const now = new Date();

          if (now > watchUntil) {
            // Watch mode complete - check if can grant permanence
            const { data: watchEvents } = await supabase
              .from('promotion_watch_events')
              .select('*')
              .eq('promotion_id', promotion.id)
              .eq('severity', 'critical');

            if (!watchEvents || watchEvents.length === 0) {
              // Grant permanence
              await supabase
                .from('ai_promotions')
                .update({
                  watch_mode_active: false,
                  elevated_sensitivity: false,
                  is_permanent: true
                })
                .eq('id', promotion.id);

              await supabase
                .from('promotion_watch_events')
                .insert({
                  promotion_id: promotion.id,
                  event_type: 'permanence_granted',
                  severity: 'info',
                  metrics_snapshot: { 
                    watch_duration_hours: 48,
                    critical_events: 0 
                  },
                  action_taken: 'Promotion granted permanence after successful watch period'
                });

              results.push({
                promotion_id: promotion.id,
                status: 'permanence_granted',
                action_taken: 'Watch period complete, promotion is now permanent'
              });
            } else {
              // Had critical events - extend watch
              const extendedUntil = new Date();
              extendedUntil.setHours(extendedUntil.getHours() + 24);

              await supabase
                .from('ai_promotions')
                .update({ watch_mode_until: extendedUntil.toISOString() })
                .eq('id', promotion.id);

              await supabase
                .from('promotion_watch_events')
                .insert({
                  promotion_id: promotion.id,
                  event_type: 'watch_extended',
                  severity: 'warning',
                  metrics_snapshot: { 
                    critical_events: watchEvents.length,
                    extended_by_hours: 24
                  },
                  action_taken: 'Watch extended due to critical events'
                });

              results.push({
                promotion_id: promotion.id,
                status: 'watch_extended',
                action_taken: 'Watch extended 24h due to critical events'
              });
            }
            continue;
          }

          // Still in watch mode - run metric check
          const metricsResult = await checkPromotionMetrics(supabase, promotion);

          if (metricsResult.anomaly_detected) {
            if (metricsResult.severity === 'critical') {
              // Auto-rollback
              await supabase
                .from('ai_promotions')
                .update({
                  is_rolled_back: true,
                  rolled_back_at: new Date().toISOString(),
                  rollback_reason: 'Auto-rollback: Critical anomaly detected during watch',
                  watch_mode_active: false
                })
                .eq('id', promotion.id);

              await supabase
                .from('ai_learning_proposals')
                .update({ status: 'rolled_back' })
                .eq('id', promotion.proposal_id);

              await supabase
                .from('promotion_watch_events')
                .insert({
                  promotion_id: promotion.id,
                  event_type: 'auto_rollback',
                  severity: 'critical',
                  metrics_snapshot: metricsResult.metrics,
                  drift_detected: true,
                  anomaly_score: metricsResult.anomaly_score,
                  triggered_rollback: true,
                  action_taken: 'Auto-rollback triggered due to critical anomaly'
                });

              results.push({
                promotion_id: promotion.id,
                status: 'auto_rolled_back',
                action_taken: 'Critical anomaly detected - automatic rollback'
              });
            } else {
              // Warning-level anomaly
              await supabase
                .from('promotion_watch_events')
                .insert({
                  promotion_id: promotion.id,
                  event_type: 'anomaly_detected',
                  severity: 'warning',
                  metrics_snapshot: metricsResult.metrics,
                  drift_detected: true,
                  anomaly_score: metricsResult.anomaly_score,
                  action_taken: 'Anomaly logged, monitoring continues'
                });

              results.push({
                promotion_id: promotion.id,
                status: 'anomaly_warning',
                action_taken: 'Warning-level anomaly detected'
              });
            }
          } else {
            // Normal check
            await supabase
              .from('promotion_watch_events')
              .insert({
                promotion_id: promotion.id,
                event_type: 'metric_check',
                severity: 'info',
                metrics_snapshot: metricsResult.metrics,
                drift_detected: false,
                anomaly_score: metricsResult.anomaly_score,
                action_taken: 'Metrics within normal range'
              });

            results.push({
              promotion_id: promotion.id,
              status: 'healthy',
              action_taken: 'Metrics check passed'
            });
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            promotions_checked: results.length,
            results
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_watch_status': {
        const { promotion_id } = params;

        const { data: promotion } = await supabase
          .from('ai_promotions')
          .select('*')
          .eq('id', promotion_id)
          .single();

        const { data: events } = await supabase
          .from('promotion_watch_events')
          .select('*')
          .eq('promotion_id', promotion_id)
          .order('created_at', { ascending: false })
          .limit(20);

        return new Response(
          JSON.stringify({ 
            success: true, 
            promotion,
            events,
            time_remaining: promotion?.watch_mode_until 
              ? Math.max(0, new Date(promotion.watch_mode_until).getTime() - Date.now())
              : 0
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('Promotion Watch Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

interface MetricsCheckResult {
  anomaly_detected: boolean;
  severity: 'info' | 'warning' | 'critical';
  anomaly_score: number;
  metrics: Record<string, unknown>;
}

async function checkPromotionMetrics(
  supabaseClient: any,
  promotion: Record<string, unknown>
): Promise<MetricsCheckResult> {
  // Get recent compliance metrics
  const { data: recentMetrics } = await supabaseClient
    .from('compliance_metrics_snapshots')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  // Calculate anomaly score (0-1, higher = more anomalous)
  let anomalyScore = 0;
  const metrics: Record<string, unknown> = {};

  if (recentMetrics && recentMetrics.length > 0) {
    const latest = recentMetrics[0] as Record<string, unknown>;
    
    // Check key metrics
    metrics.confidence_avg = latest.ai_confidence_avg;
    metrics.unauthorized_speech = latest.unauthorized_ai_speech;
    metrics.kill_switch_latency = latest.kill_switch_latency_ms;
    metrics.human_available = latest.human_available;

    // Score anomalies
    if (((latest.ai_confidence_avg as number) || 0) < 0.8) {
      anomalyScore += 0.3;
    }
    if ((latest.unauthorized_ai_speech as number) > 0) {
      anomalyScore += 0.5;
    }
    if (((latest.kill_switch_latency_ms as number) || 0) > 500) {
      anomalyScore += 0.2;
    }
    if (!latest.human_available) {
      anomalyScore += 0.4;
    }
  }

  // Elevated sensitivity during watch mode
  if (promotion.elevated_sensitivity) {
    anomalyScore *= 1.5;
  }

  anomalyScore = Math.min(1, anomalyScore);

  let severity: 'info' | 'warning' | 'critical' = 'info';
  if (anomalyScore > 0.7) {
    severity = 'critical';
  } else if (anomalyScore > 0.4) {
    severity = 'warning';
  }

  return {
    anomaly_detected: anomalyScore > 0.3,
    severity,
    anomaly_score: anomalyScore,
    metrics
  };
}
