import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'analyze';

    if (action === 'analyze') {
      const { data: triggers } = await supabase
        .from('gasmask_visit_triggers')
        .select('*')
        .eq('status', 'pending')
        .order('priority_score', { ascending: false })
        .limit(50);

      const { data: recentCompleted } = await supabase
        .from('gasmask_visit_triggers')
        .select('store_name, trigger_type, completed_at')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(20);

      if (!triggers?.length) {
        return new Response(
          JSON.stringify({ success: true, message: 'No pending triggers', triggers: [], route_advice: null }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const analysisRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'system',
              content: `You are an expert field operations manager for GasMask, a multi-brand tobacco/grabba distribution company. You manage driver routes and store visits. Analyze pending visit triggers and provide intelligent routing advice.

Return ONLY valid JSON:
{
  "summary": "2-3 sentence overview",
  "critical_count": N,
  "high_count": N,
  "recommendations": [
    {
      "trigger_id": "uuid",
      "priority_rank": 1,
      "ai_recommendation": "what to do",
      "best_visit_time": "morning/afternoon/any",
      "combine_with": [],
      "estimated_minutes": 20
    }
  ],
  "route_groups": [
    {
      "group_name": "Route Name",
      "trigger_ids": ["id1"],
      "estimated_duration_minutes": 120,
      "suggested_date": "today/tomorrow"
    }
  ],
  "stores_to_prioritize": ["store name"],
  "stores_at_risk": [
    { "store": "name", "reason": "why", "action": "what to do" }
  ]
}`
            },
            {
              role: 'user',
              content: `PENDING TRIGGERS (${triggers.length}):\n${triggers.map(t =>
                `- ${t.store_name} | ${t.trigger_type} | ${t.urgency} urgency | score: ${t.priority_score} | ${t.trigger_notes || 'no notes'} | ID: ${t.id}`
              ).join('\n')}\n\nRECENTLY COMPLETED:\n${recentCompleted?.map(r =>
                `- ${r.store_name}: ${r.trigger_type}`
              ).join('\n') || 'none'}\n\nAnalyze these triggers and provide routing recommendations.`
            }
          ],
        }),
      });

      let analysis = null;
      if (analysisRes.ok) {
        const data = await analysisRes.json();
        const raw = data.choices?.[0]?.message?.content || '{}';
        try {
          analysis = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}');
        } catch {
          analysis = { summary: raw.substring(0, 200) };
        }
      }

      if (analysis?.recommendations) {
        for (const rec of analysis.recommendations) {
          await supabase
            .from('gasmask_visit_triggers')
            .update({
              ai_recommendation: rec.ai_recommendation,
              visit_duration_minutes: rec.estimated_minutes || 20,
            })
            .eq('id', rec.trigger_id);
        }
      }

      return new Response(
        JSON.stringify({ success: true, trigger_count: triggers.length, analysis }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'create_trigger') {
      let {
        store_id, store_name, store_address, store_city, store_state,
        store_lat, store_lng, store_phone, trigger_source, trigger_type,
        floor_source, urgency = 'normal', priority_score = 5,
        trigger_notes, source_record_id, source_record_type,
        visit_duration_minutes = 20,
      } = body;

      if (!store_name || !trigger_type || !floor_source) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ── ADDRESS-FIRST resolve-or-reject ──
      // Collision model: store NAMES collide (many "Ali"), PHONES collide
      // (one owner = multiple stores). Only ADDRESS uniquely identifies a
      // physical store. Phone/name are confirmatory only — never primary.
      const normPhone = (p?: string | null) =>
        (p || '').replace(/\D/g, '').slice(-10) || null;
      const nameKey = (s?: string | null) =>
        (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
      const addrKey = (s?: string | null) => {
        if (!s) return '';
        let v = s.toLowerCase();
        v = v.replace(/[^a-z0-9 \-]/g, ' ');     // strip punctuation (keep hyphens for Queens "107-60")
        v = v.replace(/\bave\b/g, 'avenue');
        v = v.replace(/\bst\b/g, 'street');
        v = v.replace(/\bblvd\b/g, 'boulevard');
        v = v.replace(/\brd\b/g, 'road');
        v = v.replace(/\bdr\b/g, 'drive');
        v = v.replace(/\bpkwy\b/g, 'parkway');
        v = v.replace(/\s+/g, ' ').trim();
        return v;
      };

      const resolution: { method: string; warnings?: string[] } = { method: 'none' };

      if (store_id) {
        const { data: byId } = await supabase
          .from('stores').select('id').eq('id', store_id).maybeSingle();
        if (byId) {
          resolution.method = 'provided_id';
        } else {
          console.warn('[create_trigger] provided store_id not found in stores', {
            store_id, store_name, trigger_source,
          });
          return new Response(JSON.stringify({
            error: 'store_not_resolved',
            reason: 'provided store_id does not match a real store',
            store_id, store_name, store_address, trigger_source,
          }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      } else {
        // REQUIRE store_address — name/phone alone are unsafe (both collide)
        const ak = addrKey(store_address);
        if (!ak) {
          console.warn('[create_trigger] no_address_cannot_resolve', {
            store_name, store_phone, store_city, trigger_source, floor_source,
          });
          return new Response(JSON.stringify({
            error: 'no_address_cannot_resolve',
            reason: 'store_address is required — name/phone alone are unsafe (names and phones both collide across multiple stores)',
            store_name, store_phone, store_city, trigger_source,
          }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Pull candidate pool, normalize address server-side for exact compare
        const { data: addrRows } = await supabase
          .from('stores').select('id, name, phone, address_street, address_city');
        const addrMatches = (addrRows || []).filter(
          (r: any) => addrKey(r.address_street) === ak
        );

        if (addrMatches.length === 0) {
          console.warn('[create_trigger] address_not_found', {
            store_name, store_address, store_city, trigger_source, floor_source,
          });
          return new Response(JSON.stringify({
            error: 'address_not_found',
            reason: 'normalized store_address did not match any row in stores',
            store_name, store_address, store_city, trigger_source,
            normalized: ak,
          }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (addrMatches.length > 1) {
          // Multiple stores at the same physical address = duplicate-store issue,
          // not a trigger-logic issue. Surface for dedup, do NOT guess.
          console.warn('[create_trigger] address_ambiguous_duplicate_stores', {
            store_name, store_address, candidate_ids: addrMatches.map((r: any) => r.id),
          });
          return new Response(JSON.stringify({
            error: 'address_ambiguous_duplicate_stores',
            reason: 'multiple stores share this address — dedup the stores table first',
            store_name, store_address,
            candidates: addrMatches.map((r: any) => ({
              id: r.id, name: r.name, phone: r.phone,
              address_street: r.address_street, address_city: r.address_city,
            })),
          }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Unique address match — trust it. Phone/name are confirmatory only.
        const resolved: any = addrMatches[0];
        store_id = resolved.id;
        resolution.method = 'address';

        const warnings: string[] = [];
        const tPhone = normPhone(store_phone);
        const rPhone = normPhone(resolved.phone);
        if (tPhone && rPhone && tPhone !== rPhone) {
          warnings.push(`phone mismatch: trigger=${tPhone} store=${rPhone}`);
        }
        const tName = nameKey(store_name);
        const rName = nameKey(resolved.name);
        if (tName && rName && tName !== rName) {
          warnings.push(`name mismatch: trigger="${tName}" store="${rName}"`);
        }
        if (warnings.length) {
          resolution.warnings = warnings;
          console.warn('[create_trigger] address matched but confirmatory mismatch (trusting address)', {
            store_id, store_address, warnings,
          });
        }
      }

      const { data: existing } = await supabase
        .from('gasmask_visit_triggers')
        .select('id')
        .eq('store_id', store_id)
        .eq('trigger_type', trigger_type)
        .eq('status', 'pending')
        .limit(1)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ success: true, duplicate: true, existing_id: existing.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: trigger, error } = await supabase
        .from('gasmask_visit_triggers')
        .insert({
          store_id, store_name, store_address, store_city, store_state,
          store_lat, store_lng, store_phone, trigger_source, trigger_type,
          floor_source, urgency, priority_score, trigger_notes,
          source_record_id, source_record_type, visit_duration_minutes,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, trigger, resolution: resolution.method }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'build_route') {
      const { trigger_ids, driver_name, scheduled_date, route_notes } = body;

      if (!trigger_ids?.length) {
        return new Response(
          JSON.stringify({ error: 'No triggers selected' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: triggers } = await supabase
        .from('gasmask_visit_triggers')
        .select('*')
        .in('id', trigger_ids);

      const routeRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-lite',
          messages: [
            {
              role: 'system',
              content: 'Optimize the order of store visits for a driver route. Consider critical/urgent stops first, geographic clustering, logical flow. Return ONLY a JSON array of trigger IDs in optimal order: ["id1", "id2"]'
            },
            {
              role: 'user',
              content: `Optimize visit order:\n${triggers?.map((t: any, i: number) =>
                `${i + 1}. ${t.store_name} | ${t.urgency} | ${t.store_city || 'unknown city'} | ID: ${t.id}`
              ).join('\n')}`
            }
          ],
        }),
      });

      let optimizedOrder = trigger_ids;
      if (routeRes.ok) {
        const routeData = await routeRes.json();
        const raw = routeData.choices?.[0]?.message?.content || '[]';
        try {
          const arr = JSON.parse(raw.match(/\[[\s\S]*\]/)?.[0] || '[]');
          if (arr.length) optimizedOrder = arr;
        } catch {}
      }

      const totalDuration = triggers?.reduce((sum: number, t: any) => sum + (t.visit_duration_minutes || 20), 0) || 0;

      // CANONICAL WRITE: insert into routes (not gasmask_route_runs)
      const { data: route, error: routeErr } = await supabase
        .from('routes')
        .insert({
          name: `Route ${scheduled_date} - ${driver_name || 'Driver'}`,
          date: scheduled_date,
          type: 'driver',
          status: 'planned',
          source: 'gasmask_agent',
          total_stops: trigger_ids.length,
          estimated_duration_minutes: totalDuration,
          notes: route_notes,
        })
        .select()
        .single();

      if (routeErr) throw routeErr;

      // Build trigger_id -> store_id map in optimized order
      const triggerMap = new Map((triggers || []).map((t: any) => [t.id, t]));
      const orderedStoreIds = optimizedOrder
        .map((tid: string) => (triggerMap.get(tid) as any)?.store_id)
        .filter((sid: string | null | undefined): sid is string => !!sid);

      // Pre-validate which store_ids actually exist in `stores` (route_stops.store_id has FK)
      let validStoreIds = new Set<string>();
      if (orderedStoreIds.length) {
        const { data: existingStores } = await supabase
          .from('stores')
          .select('id')
          .in('id', orderedStoreIds);
        validStoreIds = new Set((existingStores || []).map((s: any) => s.id));
      }

      const stopRows: any[] = [];
      let skippedStops = 0;
      optimizedOrder.forEach((tid: string, idx: number) => {
        const t: any = triggerMap.get(tid);
        const sid = t?.store_id;
        if (sid && validStoreIds.has(sid)) {
          stopRows.push({
            route_id: route.id,
            store_id: sid,
            planned_order: idx + 1,
            status: 'pending',
            notes: `gasmask_trigger:${tid} | ${t?.store_name || ''}`,
          });
        } else {
          skippedStops += 1;
        }
      });

      if (stopRows.length) {
        const { error: stopsErr } = await supabase.from('route_stops').insert(stopRows);
        if (stopsErr) {
          // Roll back the route header so we don't leave an orphan canonical route
          await supabase.from('routes').delete().eq('id', route.id);
          throw stopsErr;
        }
      }

      await supabase
        .from('gasmask_visit_triggers')
        .update({
          status: 'scheduled',
          route_id: route.id,
          scheduled_for: scheduled_date,
          assigned_driver_name: driver_name || 'Unassigned',
        })
        .in('id', trigger_ids);

      for (let i = 0; i < optimizedOrder.length; i++) {
        await supabase
          .from('gasmask_visit_triggers')
          .update({ route_position: i + 1 })
          .eq('id', optimizedOrder[i]);
      }

      return new Response(
        JSON.stringify({
          success: true,
          route,
          optimized_order: optimizedOrder,
          total_stops: trigger_ids.length,
          route_stops_created: stopRows.length,
          stops_skipped_missing_store: skippedStops,
          estimated_hours: (totalDuration / 60).toFixed(1),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }


    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    console.error('[ROUTE-AGENT]', e.message);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
