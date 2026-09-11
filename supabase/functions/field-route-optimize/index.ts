/**
 * field-route-optimize
 *
 * Resequences the stops of ONE canonical route (public.routes + public.route_stops)
 * into a practical driving order starting from a user-defined start address.
 *
 * Real road routing: Mapbox Geocoding (start address) + Mapbox Directions Matrix
 * (driving durations), then nearest-neighbour + 2-opt over the real duration matrix.
 * No straight-line ordering unless Mapbox cannot be reached (reported explicitly).
 *
 * Caller must be the route's assignee (routes.assigned_to = auth.uid()) or an
 * owner/admin. Only the given route is ever touched.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_MATRIX_COORDS = 25; // Mapbox driving matrix limit (includes the start point)

interface Stop {
  id: string;
  store_id: string | null;
  lat: number;
  lng: number;
  name: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function haversine(a: [number, number], b: [number, number]) {
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const la1 = (a[1] * Math.PI) / 180;
  const la2 = (b[1] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Order 0..n over a cost matrix: nearest neighbour from index 0 (the start), then 2-opt. */
function solve(matrix: number[][]): number[] {
  const n = matrix.length;
  const unvisited = new Set<number>();
  for (let i = 1; i < n; i++) unvisited.add(i);

  const order: number[] = [0];
  let cur = 0;
  while (unvisited.size) {
    let best = -1;
    let bestCost = Infinity;
    for (const i of unvisited) {
      const c = matrix[cur][i];
      if (c < bestCost) {
        bestCost = c;
        best = i;
      }
    }
    order.push(best);
    unvisited.delete(best);
    cur = best;
  }

  // 2-opt (open path, start pinned at index 0)
  const cost = (o: number[]) => {
    let t = 0;
    for (let i = 0; i < o.length - 1; i++) t += matrix[o[i]][o[i + 1]];
    return t;
  };
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 60) {
    improved = false;
    for (let i = 1; i < order.length - 1; i++) {
      for (let k = i + 1; k < order.length; k++) {
        const candidate = [
          ...order.slice(0, i),
          ...order.slice(i, k + 1).reverse(),
          ...order.slice(k + 1),
        ];
        if (cost(candidate) + 1e-9 < cost(order)) {
          order.splice(0, order.length, ...candidate);
          improved = true;
        }
      }
    }
  }
  return order;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const mapboxToken = Deno.env.get('MAPBOX_PUBLIC_TOKEN');
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: 'Not authenticated' }, 401);

    const body = await req.json();
    const routeId: string | undefined = body?.routeId;
    const startAddress: string | undefined = body?.startAddress?.toString().trim();
    if (!routeId) return json({ error: 'routeId is required' }, 400);
    if (!startAddress) return json({ error: 'startAddress is required' }, 400);

    const { data: route, error: routeErr } = await admin
      .from('routes')
      .select('id, assigned_to, start_address, start_lat, start_lng')
      .eq('id', routeId)
      .maybeSingle();
    if (routeErr) throw routeErr;
    if (!route) return json({ error: 'Route not found' }, 404);

    if (route.assigned_to !== user.id) {
      const { data: roles } = await admin
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      const isAdmin = (roles ?? []).some((r: { role: string }) =>
        ['owner', 'admin'].includes(r.role),
      );
      if (!isAdmin) return json({ error: 'This route is not assigned to you' }, 403);
    }

    // ---- Resolve the start address to coordinates (Mapbox Geocoding) --------
    if (!mapboxToken) return json({ error: 'Map service is not configured' }, 500);

    const geoRes = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        startAddress,
      )}.json?limit=1&country=US&access_token=${mapboxToken}`,
    );
    if (!geoRes.ok) {
      const text = await geoRes.text();
      console.error(`[field-route-optimize] geocode ${geoRes.status}: ${text}`);
      return json({ error: 'Could not look up that start address', status: geoRes.status }, 502);
    }
    const geo = await geoRes.json();
    const feature = geo?.features?.[0];
    if (!feature) return json({ error: 'Start address not found. Add more detail.' }, 422);
    const [startLng, startLat] = feature.center as [number, number];
    const resolvedStart: string = feature.place_name ?? startAddress;

    // ---- Load the route's stops with real coordinates ----------------------
    const { data: stopRows, error: stopErr } = await admin
      .from('route_stops')
      .select('id, store_id, status')
      .eq('route_id', routeId);
    if (stopErr) throw stopErr;

    const openStops = (stopRows ?? []).filter(
      (s: { status: string | null }) =>
        !['completed', 'complete', 'skipped', 'failed', 'cancelled'].includes(
          (s.status ?? '').toLowerCase(),
        ),
    );
    const storeIds = openStops.map((s) => s.store_id).filter(Boolean) as string[];

    const coords = new Map<string, { lat: number; lng: number; name: string }>();
    for (let i = 0; i < storeIds.length; i += 200) {
      const { data, error } = await admin
        .from('stores')
        .select('id, store_name, lat, lng')
        .in('id', storeIds.slice(i, i + 200));
      if (error) throw error;
      for (const s of data ?? []) {
        if (s.lat != null && s.lng != null) {
          coords.set(s.id, { lat: Number(s.lat), lng: Number(s.lng), name: s.store_name ?? 'Store' });
        }
      }
    }

    const stops: Stop[] = [];
    const unmapped: string[] = [];
    for (const s of openStops) {
      const c = s.store_id ? coords.get(s.store_id) : undefined;
      if (c) stops.push({ id: s.id, store_id: s.store_id, lat: c.lat, lng: c.lng, name: c.name });
      else unmapped.push(s.id);
    }

    if (!stops.length) {
      await admin
        .from('routes')
        .update({
          start_address: resolvedStart,
          start_lat: startLat,
          start_lng: startLng,
          sequence_stale: false,
          optimized_at: new Date().toISOString(),
        })
        .eq('id', routeId);
      return json({
        success: true,
        optimizedStops: 0,
        unmappedStops: unmapped.length,
        message: 'Start address saved. No stops with map locations to sequence yet.',
      });
    }

    // Mapbox matrix caps at 25 coordinates — sequence the nearest ones first,
    // then append the remainder in distance order so nothing is lost.
    const byDistance = [...stops].sort(
      (a, b) =>
        haversine([startLng, startLat], [a.lng, a.lat]) -
        haversine([startLng, startLat], [b.lng, b.lat]),
    );
    const inMatrix = byDistance.slice(0, MAX_MATRIX_COORDS - 1);
    const overflow = byDistance.slice(MAX_MATRIX_COORDS - 1);

    const coordStr = [
      `${startLng},${startLat}`,
      ...inMatrix.map((s) => `${s.lng},${s.lat}`),
    ].join(';');

    let matrix: number[][] | null = null;
    let routingMode = 'mapbox_driving_matrix';
    const matRes = await fetch(
      `https://api.mapbox.com/directions-matrix/v1/mapbox/driving/${coordStr}?annotations=duration&access_token=${mapboxToken}`,
    );
    if (matRes.ok) {
      const mat = await matRes.json();
      if (Array.isArray(mat?.durations)) {
        matrix = (mat.durations as (number | null)[][]).map((row) =>
          row.map((v) => (v == null ? 1e9 : v)),
        );
      }
    } else {
      const text = await matRes.text();
      console.error(`[field-route-optimize] matrix ${matRes.status}: ${text}`);
    }

    if (!matrix) {
      // Explicit, reported fallback — straight-line distance.
      routingMode = 'straight_line_fallback';
      const pts: [number, number][] = [
        [startLng, startLat],
        ...inMatrix.map((s) => [s.lng, s.lat] as [number, number]),
      ];
      matrix = pts.map((a) => pts.map((b) => haversine(a, b)));
    }

    const order = solve(matrix);
    const sequenced: Stop[] = order.slice(1).map((idx) => inMatrix[idx - 1]);
    const finalOrder = [...sequenced, ...overflow];

    // Estimated driving time/distance along the sequenced leg
    let durationS = 0;
    for (let i = 0; i < order.length - 1; i++) durationS += matrix[order[i]][order[i + 1]];
    let distanceKm = 0;
    let prev: [number, number] = [startLng, startLat];
    for (const s of finalOrder) {
      distanceKm += haversine(prev, [s.lng, s.lat]);
      prev = [s.lng, s.lat];
    }

    // ---- Persist the new sequence -----------------------------------------
    for (let i = 0; i < finalOrder.length; i++) {
      const { error } = await admin
        .from('route_stops')
        .update({ planned_order: i + 1, updated_at: new Date().toISOString() })
        .eq('id', finalOrder[i].id)
        .eq('route_id', routeId);
      if (error) throw error;
    }
    // Finished/skipped stops keep their history but sit after the live sequence.
    let tail = finalOrder.length;
    for (const s of stopRows ?? []) {
      if (openStops.some((o) => o.id === s.id)) continue;
      tail += 1;
      await admin
        .from('route_stops')
        .update({ planned_order: tail })
        .eq('id', s.id)
        .eq('route_id', routeId);
    }

    const { error: upErr } = await admin
      .from('routes')
      .update({
        start_address: resolvedStart,
        start_lat: startLat,
        start_lng: startLng,
        sequence_stale: false,
        optimized_at: new Date().toISOString(),
        is_optimized: true,
        estimated_duration_minutes: Math.round(durationS / 60),
        estimated_distance_km: Math.round(distanceKm * 10) / 10,
      })
      .eq('id', routeId);
    if (upErr) throw upErr;

    return json({
      success: true,
      routeId,
      routingMode,
      startAddress: resolvedStart,
      startLat,
      startLng,
      optimizedStops: finalOrder.length,
      appendedBeyondMatrixLimit: overflow.length,
      unmappedStops: unmapped.length,
      estimatedMinutes: Math.round(durationS / 60),
      estimatedKm: Math.round(distanceKm * 10) / 10,
      sequence: finalOrder.map((s, i) => ({ order: i + 1, stopId: s.id, name: s.name })),
    });
  } catch (error) {
    console.error('[field-route-optimize] error:', error);
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
