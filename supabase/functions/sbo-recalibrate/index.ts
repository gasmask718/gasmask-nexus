import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BUCKETS = ['50-55', '55-60', '60-65', '65-70', '70-75', '75-80', '80-90', '90-100'];

function getBucket(confidence: number): string {
  if (confidence >= 90) return '90-100';
  if (confidence >= 80) return '80-90';
  if (confidence >= 75) return '75-80';
  if (confidence >= 70) return '70-75';
  if (confidence >= 65) return '65-70';
  if (confidence >= 60) return '60-65';
  if (confidence >= 55) return '55-60';
  return '50-55';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get all verified predictions
    const { data: verified } = await supabase
      .from('sbo_predictions')
      .select('final_confidence, verdict')
      .eq('verified', true)
      .not('verdict', 'is', null)
      .not('final_confidence', 'is', null);

    if (!verified?.length) {
      return new Response(JSON.stringify({ success: true, message: 'No verified predictions to calibrate', buckets: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Group by bucket
    const bucketData: Record<string, { total: number; correct: number }> = {};
    for (const b of BUCKETS) bucketData[b] = { total: 0, correct: 0 };

    for (const pred of verified) {
      const bucket = getBucket(pred.final_confidence);
      bucketData[bucket].total++;
      if (pred.verdict === 'correct') bucketData[bucket].correct++;
    }

    // Upsert calibration data
    const results = [];
    for (const [bucket, data] of Object.entries(bucketData)) {
      if (data.total === 0) continue;

      const actualAccuracy = (data.correct / data.total) * 100;
      const [low, high] = bucket.split('-').map(Number);
      const expectedAccuracy = (low + high) / 2;
      const calibrationScore = expectedAccuracy > 0 ? actualAccuracy / expectedAccuracy : 1;

      const row = {
        confidence_bucket: bucket,
        total_picks: data.total,
        correct_picks: data.correct,
        actual_accuracy: Math.round(actualAccuracy * 10) / 10,
        expected_accuracy: expectedAccuracy,
        calibration_score: Math.round(calibrationScore * 100) / 100,
        last_updated: new Date().toISOString(),
      };

      // Upsert by bucket
      const { data: existing } = await supabase
        .from('sbo_calibration')
        .select('id')
        .eq('confidence_bucket', bucket)
        .maybeSingle();

      if (existing) {
        await supabase.from('sbo_calibration').update(row).eq('id', existing.id);
      } else {
        await supabase.from('sbo_calibration').insert(row);
      }
      results.push(row);
    }

    // Update bettor profile
    const totalPicks = verified.length;
    const correctPicks = verified.filter(p => p.verdict === 'correct').length;
    const overallAccuracy = (correctPicks / totalPicks) * 100;

    // Determine strongest bet type, best confidence tier
    const bestBucket = results.sort((a, b) => (b.actual_accuracy || 0) - (a.actual_accuracy || 0))[0];

    // Calculate edge score: weighted combo of accuracy, CLV, calibration
    const avgCalibration = results.reduce((s, r) => s + (r.calibration_score || 0), 0) / (results.length || 1);
    const edgeScore = Math.min(100, Math.max(0,
      overallAccuracy * 0.4 +
      avgCalibration * 30 +
      (totalPicks > 100 ? 15 : totalPicks * 0.15) +
      (correctPicks > 50 ? 15 : correctPicks * 0.3)
    ));

    const sharpRating = edgeScore >= 81 ? 'Elite' : edgeScore >= 61 ? 'Sharp' : edgeScore >= 41 ? 'Semi-Sharp' : 'Recreational';

    const { data: profile } = await supabase
      .from('sbo_bettor_profile')
      .select('id')
      .limit(1)
      .maybeSingle();

    const profileData = {
      overall_edge_score: Math.round(edgeScore),
      sharp_rating: sharpRating,
      best_confidence_tier: bestBucket?.confidence_bucket || null,
      roi_all_time: overallAccuracy,
      total_units_wagered: totalPicks,
      total_units_won: correctPicks,
      updated_at: new Date().toISOString(),
    };

    if (profile) {
      await supabase.from('sbo_bettor_profile').update(profileData).eq('id', profile.id);
    } else {
      await supabase.from('sbo_bettor_profile').insert(profileData);
    }

    return new Response(JSON.stringify({
      success: true,
      total_verified: totalPicks,
      overall_accuracy: Math.round(overallAccuracy * 10) / 10,
      edge_score: Math.round(edgeScore),
      sharp_rating: sharpRating,
      buckets: results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('Recalibration error:', e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
