import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const TRIGGER_TYPE_DESC: Record<string, string> = {
  restock: 'The store needs product restocked. Bring inventory and process the order.',
  urgent_visit: 'This is an urgent visit. Something needs immediate attention.',
  follow_up: 'Follow up on a previous visit or outstanding issue.',
  first_visit: 'This is the first visit to this store. Introduction and onboarding.',
  prospecting: 'Prospect this store as a potential new account.',
  complaint: 'The store has a complaint that needs resolution.',
  merchandising: 'Check product placement, displays, and shelf position.',
  audit: 'Conduct a full audit of the account.',
  collection: 'Collect payment on an outstanding account balance.',
  ai_flag: 'AI detected an issue with this account that needs attention.',
  pickup: 'Pick up items from the store.',
  escalation: 'An escalated issue requiring senior attention.',
  compliance: 'Compliance check on store operations.',
  training: 'Training visit for store staff.',
  other: 'General visit.',
};

const ROLE_DESC: Record<string, string> = {
  driver: 'delivery driver making a product delivery and account check',
  biker: 'field biker doing quick stops and lightweight deliveries',
  ambassador: 'brand ambassador building relationships and merchandising',
  admin: 'admin doing account management and oversight',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      trigger_id,
      assigned_to,
      assigned_role = 'driver',
      generate_batch = false,
      batch_trigger_ids = [],
    } = body;

    const triggerIds = generate_batch ? batch_trigger_ids : trigger_id ? [trigger_id] : [];

    if (!triggerIds.length) {
      return new Response(JSON.stringify({ error: 'trigger_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: any[] = [];

    for (const tid of triggerIds) {
      // Get trigger
      const { data: trigger } = await supabase
        .from('gasmask_visit_triggers')
        .select('*')
        .eq('id', tid)
        .single();

      if (!trigger) continue;

      // Check existing
      const { data: existing } = await supabase
        .from('visit_action_checklists')
        .select('id')
        .eq('trigger_id', tid)
        .maybeSingle();

      if (existing) {
        results.push({ trigger_id: tid, checklist_id: existing.id, already_existed: true });
        continue;
      }

      // Get store data
      const { data: storeData } = await supabase
        .from('stores')
        .select('*')
        .ilike('name', `%${trigger.store_name}%`)
        .limit(1)
        .maybeSingle();

      // Get contact profile
      const { data: contactProfile } = await supabase
        .from('contact_profiles')
        .select('*')
        .ilike('business_name', `%${trigger.store_name}%`)
        .limit(1)
        .maybeSingle();

      // Get tube intel
      const storeId = storeData?.id || contactProfile?.store_id;
      let tubeSignals: any = null;
      if (storeId) {
        const { data: signals } = await supabase
          .from('tube_intel')
          .select('*')
          .eq('store_id', storeId)
          .order('last_updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        tubeSignals = signals;
      }

      // Recent interactions
      let recentInteractions: any[] = [];
      if (contactProfile) {
        const { data: interactions } = await supabase
          .from('contact_interactions')
          .select('*')
          .eq('contact_id', contactProfile.id)
          .order('created_at', { ascending: false })
          .limit(5);
        recentInteractions = interactions || [];
      }

      const context = `
VISIT DETAILS:
Store: ${trigger.store_name}
Location: ${trigger.store_city || ''}, ${trigger.store_state || ''}
Visit Type: ${trigger.trigger_type} — ${TRIGGER_TYPE_DESC[trigger.trigger_type] || 'Standard visit'}
Urgency: ${trigger.urgency}
Priority Score: ${trigger.priority_score}/10
Visit Notes: ${trigger.trigger_notes || 'No specific notes'}
Source: ${trigger.trigger_source || 'Unknown'}

FIELD ROLE: ${assigned_role} — ${ROLE_DESC[assigned_role] || 'field team member'}

STORE PROFILE:
${storeData ? `Health Score: ${storeData.health_score || 'Unknown'}/100
Last Visit: ${storeData.last_visit_date ? new Date(storeData.last_visit_date).toLocaleDateString() : 'Unknown'}
Last Order: ${storeData.last_order_date ? new Date(storeData.last_order_date).toLocaleDateString() : 'Unknown'}
Owner: ${storeData.primary_contact_name || 'Unknown'}
Status: ${storeData.status || 'active'}` : 'No store profile data available'}

OWNER PERSONALITY:
${contactProfile?.personality_notes || 'No personality data — approach professionally'}
${contactProfile?.preferences || ''}
${contactProfile?.best_contact_time ? `Best time: ${contactProfile.best_contact_time}` : ''}

FIELD INTELLIGENCE:
${tubeSignals ? `Needs order: ${tubeSignals.needs_order ? 'YES' : 'No'}
Bring samples: ${tubeSignals.bring_samples ? 'YES' : 'No'}
Bring starter kit: ${tubeSignals.bring_starter_kit ? 'YES' : 'No'}
Needs tube switch: ${tubeSignals.needs_switch ? `YES — ${tubeSignals.switch_quantity || 'unknown'} tubes` : 'No'}
Owner interested: ${tubeSignals.owner_interested === true ? 'YES' : tubeSignals.owner_interested === false ? 'NO' : 'Unknown'}` : 'No field intelligence data'}

RECENT INTERACTIONS:
${recentInteractions.length > 0
  ? recentInteractions.map((i: any) => `- ${i.interaction_type} (${new Date(i.created_at).toLocaleDateString()}): ${i.content?.substring(0, 100) || 'No details'}`).join('\n')
  : 'No recent interactions'}`.trim();

      // Call AI
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'system',
              content: `You are the Dynasty OS field operations intelligence system.
Generate a specific, actionable visit checklist for a ${assigned_role} visiting a store.
Every instruction must be specific and practical — nothing generic.
Use the store data to make each action relevant to this exact visit.

Return ONLY valid JSON in this exact format:
{
  "visit_objective": "One sentence describing the main goal of this visit",
  "priority_actions": ["Specific action #1", "Specific action #2", "...max 5"],
  "products_to_bring": ["Product or item to bring"],
  "talking_points": ["Specific thing to say or ask the owner"],
  "things_to_check": ["Physical thing to inspect or verify"],
  "photos_required": ["What photo to take and why"],
  "store_context": "2-3 sentences giving context about this store",
  "best_approach": "How to approach this specific owner",
  "success_criteria": "How to know if this visit was successful"
}

Rules:
- priority_actions: 3-5 items, SPECIFIC to the trigger type
- products_to_bring: only if relevant
- talking_points: sound like a real person
- things_to_check: visual inspection items
- photos_required: 1-3 max
- For drivers: focus on delivery and account health
- For bikers: focus on speed, quick wins
- For ambassadors: focus on relationships, product placement
- Never include generic advice`,
            },
            { role: 'user', content: context },
          ],
        }),
      });

      if (!aiResponse.ok) {
        console.error('[CHECKLIST] AI error:', aiResponse.status, await aiResponse.text());
        continue;
      }

      const aiData = await aiResponse.json();
      const aiText = aiData.choices?.[0]?.message?.content || '';

      let checklist: any = {};
      try {
        const match = aiText.match(/\{[\s\S]*\}/);
        checklist = JSON.parse(match?.[0] || '{}');
      } catch {
        checklist = {
          visit_objective: `Complete ${trigger.trigger_type} visit at ${trigger.store_name}`,
          priority_actions: [trigger.trigger_notes || 'Complete the assigned visit task'],
          products_to_bring: [],
          talking_points: [],
          things_to_check: [],
          photos_required: ['Photo of the store front'],
          store_context: trigger.trigger_notes || '',
          best_approach: 'Approach professionally and introduce yourself',
        };
      }

      // Save
      const { data: saved, error: saveError } = await supabase
        .from('visit_action_checklists')
        .insert({
          trigger_id: tid,
          store_id: storeId,
          store_name: trigger.store_name,
          assigned_to: assigned_to || trigger.assigned_driver_name,
          assigned_role,
          visit_objective: checklist.visit_objective || '',
          priority_actions: checklist.priority_actions || [],
          products_to_bring: checklist.products_to_bring || [],
          talking_points: checklist.talking_points || [],
          things_to_check: checklist.things_to_check || [],
          photos_required: checklist.photos_required || [],
          store_context: checklist.store_context || '',
          owner_name: storeData?.primary_contact_name || contactProfile?.owner_name || '',
          owner_personality: contactProfile?.personality_notes || '',
          best_approach: checklist.best_approach || '',
          previous_issues: recentInteractions
            .filter((i: any) => i.outcome === 'negative')
            .map((i: any) => i.content)
            .join('; ') || '',
          status: 'pending',
          ai_generated: true,
        })
        .select()
        .single();

      if (saveError) {
        console.error('[CHECKLIST] Save error:', saveError);
      } else {
        await supabase
          .from('gasmask_visit_triggers')
          .update({ ai_recommendation: checklist.visit_objective })
          .eq('id', tid);
      }

      results.push({
        trigger_id: tid,
        checklist_id: saved?.id,
        store_name: trigger.store_name,
        objective: checklist.visit_objective,
        actions_count: checklist.priority_actions?.length || 0,
      });
    }

    return new Response(JSON.stringify({ success: true, results, total: results.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[GENERATE-CHECKLIST]', e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
