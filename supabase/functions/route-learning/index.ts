// route-learning — computes public.route_insights from REAL field data.
//
// Sources (no mock/random values anywhere in this function):
//   route_stops : actual_arrival, actual_departure, actual_duration_minutes,
//                 planned_arrival_time, was_on_time, status  (+ routes.territory)
//   store_visits: started_at, completed_at, status, payment_collected
//
// A store only gets an insight row when it has at least one real completed
// stop or visit in the lookback window. Stores with no evidence are skipped —
// an empty panel is better than a fabricated one.
//
// Invoked nightly by cron (see health_checks: route_learning_nightly).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOOKBACK_DAYS = 90;

type Agg = {
  store_id: string;
  serviceTimes: number[];
  arrivalDelays: number[];
  arrivalHours: number[];
  totalStops: number;
  successfulStops: number;
  territories: string[];
};

function emptyAgg(store_id: string): Agg {
  return {
    store_id,
    serviceTimes: [],
    arrivalDelays: [],
    arrivalHours: [],
    totalStops: 0,
    successfulStops: 0,
    territories: [],
  };
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function mode(xs: string[]): string | null {
  if (!xs.length) return null;
  const counts: Record<string, number> = {};
  for (const x of xs) counts[x] = (counts[x] || 0) + 1;
  return Object.entries(counts).sort(([, a], [, b]) => b - a)[0][0];
}

function windowOf(hour: number) {
  return hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
}

function difficultyFrom(successRate: number): number {
  if (successRate > 80) return 1;
  if (successRate > 60) return 2;
  if (successRate > 40) return 3;
  if (successRate > 20) return 4;
  return 5;
}

function buildNotes(a: Agg, successRate: number, difficulty: number, serviceTime: number | null, bestWindow: string | null) {
  const notes: string[] = [];
  if (difficulty === 1) notes.push('⭐ Smooth store — high completion rate on recent stops.');
  else if (difficulty === 5) notes.push('⚠️ High friction — most recent stops did not complete.');
  else notes.push('⚡ Moderate difficulty — standard procedures apply.');

  if (serviceTime !== null) notes.push(`Average ${Math.round(serviceTime)} min on site.`);
  if (bestWindow) notes.push(`Most activity lands in the ${bestWindow}.`);
  notes.push(`Based on ${a.totalStops} recorded stop${a.totalStops === 1 ? '' : 's'} in the last ${LOOKBACK_DAYS} days.`);
  return notes.join(' ');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  try {
    let body: any = {};
    try { body = await req.json(); } catch { /* cron sends an empty body */ }
    const storeFilter: string | null = body?.store_id ?? null;

    const since = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString();
    const aggs = new Map<string, Agg>();
    const get = (id: string) => {
      let a = aggs.get(id);
      if (!a) { a = emptyAgg(id); aggs.set(id, a); }
      return a;
    };

    // ---- route stops (real arrival / departure telemetry) ----
    let stopQuery = supabase
      .from('route_stops')
      .select('store_id, status, planned_arrival_time, actual_arrival, actual_departure, actual_duration_minutes, routes!inner(territory, date)')
      .not('store_id', 'is', null)
      .gte('routes.date', since.slice(0, 10));
    if (storeFilter) stopQuery = stopQuery.eq('store_id', storeFilter);

    const { data: stops, error: stopsErr } = await stopQuery;
    if (stopsErr) throw stopsErr;

    for (const s of stops ?? []) {
      const a = get(s.store_id as string);
      a.totalStops++;
      if (s.status === 'completed') a.successfulStops++;

      if (s.actual_duration_minutes != null) {
        a.serviceTimes.push(Number(s.actual_duration_minutes));
      } else if (s.actual_arrival && s.actual_departure) {
        const mins = (new Date(s.actual_departure as string).getTime() - new Date(s.actual_arrival as string).getTime()) / 60000;
        if (mins > 0 && mins < 480) a.serviceTimes.push(mins);
      }

      if (s.actual_arrival) {
        const arrived = new Date(s.actual_arrival as string);
        a.arrivalHours.push(arrived.getHours());
        if (s.planned_arrival_time) {
          const planned = new Date(s.planned_arrival_time as string);
          if (!Number.isNaN(planned.getTime())) {
            const delay = (arrived.getTime() - planned.getTime()) / 60000;
            if (Math.abs(delay) < 720) a.arrivalDelays.push(delay);
          }
        }
      }

      const territory = (s as any).routes?.territory;
      if (territory) a.territories.push(territory);
    }

    // ---- store visits (field app check-ins) ----
    let visitQuery = supabase
      .from('store_visits')
      .select('store_id, status, started_at, completed_at')
      .not('store_id', 'is', null)
      .gte('created_at', since);
    if (storeFilter) visitQuery = visitQuery.eq('store_id', storeFilter);

    const { data: visits, error: visitsErr } = await visitQuery;
    if (visitsErr) throw visitsErr;

    for (const v of visits ?? []) {
      const a = get(v.store_id as string);
      a.totalStops++;
      if (v.status === 'completed' || v.completed_at) a.successfulStops++;
      if (v.started_at && v.completed_at) {
        const mins = (new Date(v.completed_at as string).getTime() - new Date(v.started_at as string).getTime()) / 60000;
        if (mins > 0 && mins < 480) a.serviceTimes.push(mins);
      }
      if (v.started_at) a.arrivalHours.push(new Date(v.started_at as string).getHours());
    }

    // ---- build + upsert rows ----
    const rows: any[] = [];
    for (const a of aggs.values()) {
      if (a.totalStops === 0) continue;
      const successRate = (a.successfulStops / a.totalStops) * 100;
      const serviceTime = avg(a.serviceTimes);
      const delay = avg(a.arrivalDelays);
      const bestWindow = mode(a.arrivalHours.map(windowOf));
      const difficulty = difficultyFrom(successRate);

      rows.push({
        store_id: a.store_id,
        average_service_time_minutes: serviceTime === null ? null : Math.round(serviceTime),
        average_arrival_delay_minutes: delay === null ? null : Math.round(delay),
        visit_success_rate: Number(successRate.toFixed(1)),
        best_time_window: bestWindow,
        difficulty_score: difficulty,
        recommended_route_group: mode(a.territories),
        sample_size: a.totalStops,
        notes: buildNotes(a, successRate, difficulty, serviceTime, bestWindow),
        last_computed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    if (rows.length) {
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabase
          .from('route_insights')
          .upsert(rows.slice(i, i + 500), { onConflict: 'store_id' });
        if (error) throw error;
      }
    }

    console.log(`[route-learning] computed ${rows.length} insight rows from ${stops?.length ?? 0} stops + ${visits?.length ?? 0} visits`);

    return new Response(JSON.stringify({
      success: true,
      stores_with_evidence: rows.length,
      stops_considered: stops?.length ?? 0,
      visits_considered: visits?.length ?? 0,
      lookback_days: LOOKBACK_DAYS,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[route-learning] failed:', message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
