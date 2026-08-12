import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizeStat, UNMATCHABLE } from "../_shared/statNormalize.ts";
import { shouldCreateCapper, markPendingPromoted, isHumanShapedName } from "../_shared/capperIdentity.ts";


/** Canonicalize prop_type at write time — see sbo-telegram-intake for rationale. */
function canonicalPropType(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const norm = normalizeStat(raw);
  if (norm && norm !== UNMATCHABLE) return norm;
  return raw.toLowerCase().trim().replace(/[_\-\s]+/g, "_");
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SPORTS_CONTEXT = `
SUPPORTED SPORTS & STAT TYPES:
- NBA/WNBA/NCAAB: points, rebounds, assists, steals, blocks, turnovers, 3-pointers, pts+reb+ast, pts+reb, pts+ast, reb+ast, double-double, fantasy
- NFL: passing_yards, rushing_yards, receiving_yards, touchdowns, pass_completions, interceptions, receptions, longest_reception, fantasy
- MLB: hits, home_runs, rbis, runs, stolen_bases, total_bases, strikeouts_pitched, earned_runs, walks, hits_allowed, pitcher_outs
- NHL: goals, assists, points, shots, saves, blocks, power_play_points, faceoff_wins
- Soccer/MLS: goals, assists, shots, shots_on_target, tackles, passes, crosses
- UFC/MMA: method_of_victory, rounds, significant_strikes
- Tennis: aces, double_faults, games_won, sets_won

BET TYPES:
- prop: player prop (OVER/UNDER a line)
- moneyline: team to win
- spread: point spread
- total: game total (OVER/UNDER)
- futures: season/tournament outcome
- parlay: multi-leg bet (list each leg)

DIRECTION VALUES: OVER, UNDER, WIN, LOSE, YES, NO
`;

const NOISE_TOKENS = ['premium', 'official', 'picks', 'plays', 'locks', 'bets', 'pick', 'play', 'lock', 'bet', 'free', 'vip'];

/**
 * Normalize a capper name for identity matching.
 * Pass 1: whole-word noise stripping (handles "CAPPERS FREE").
 * Pass 2: suffix-only noise stripping with a >=4 char minimum-residual
 * guard (handles unspaced watermarks like "cappersfree").
 */
function normalizeName(name: string): string {
  if (!name) return '';

  let s = name
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/\b(vip|picks?|plays?|locks?|bets?|premium|free|official)\b/gi, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
    .trim();

  let changed = true;
  while (changed) {
    changed = false;
    for (const token of NOISE_TOKENS) {
      if (s.endsWith(token) && s.length - token.length >= 4) {
        s = s.slice(0, s.length - token.length);
        changed = true;
        break;
      }
    }
  }

  return s;
}


/**
 * Resolve a capper by normalized name, checking aliases too.
 */
async function resolveCapperByName(supabase: any, rawName: string): Promise<{ id: string; name: string } | null> {
  const normalized = normalizeName(rawName);
  if (!normalized) return null;

  // Check normalized_name
  const { data: byNorm } = await supabase
    .from('sbo_cappers').select('id, name')
    .eq('normalized_name', normalized).maybeSingle();
  if (byNorm) return byNorm;

  // Check aliases
  const { data: alias } = await supabase
    .from('sbo_capper_aliases').select('capper_id')
    .eq('normalized_alias', normalized).maybeSingle();
  if (alias) {
    const { data: capper } = await supabase.from('sbo_cappers').select('id, name').eq('id', alias.capper_id).single();
    return capper || null;
  }

  // Fallback ilike
  const { data: byName } = await supabase
    .from('sbo_cappers').select('id, name')
    .ilike('name', rawName.trim()).maybeSingle();
  return byName || null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawText = await req.text();
    let body: Record<string, unknown> = {};
    try { body = JSON.parse(rawText); } catch { body = {}; }

    const image = body.image as string;
    const capper_id = body.capper_id as string | undefined;
    const capper_name = body.capper_name as string | undefined;
    const platform = body.platform as string | undefined;
    const source_group = body.source_group as string | undefined;
    const source_group_id = body.source_group_id as string | undefined;
    const source_message_id = body.source_message_id as string | undefined;
    const posted_by = body.posted_by as string | undefined;
    const group_type = body.group_type as string || 'direct';

    if (!image) throw new Error('No image provided');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Use AI to parse the capper pick image — extracts capper_name + picks
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a multi-sport betting pick parser. Extract ALL picks from the image.

CRITICAL: Also extract the CAPPER NAME (the person who made the picks) if visible.
Look for capper identity in:
- Screenshot headers/titles (e.g. "VegasKing 🔥", "@SharpPlays")
- Watermarks or logos with usernames
- Username/handle displayed in the image
- Account name at top of screenshot
- Any attribution text (e.g. "Picks by...", "From: ...")
- Consistent branding labels

Return a JSON object with these EXACT fields:
{
  "capper_name": "string or null — the name/handle of the person who made these picks",
  "capper_handle": "string or null — @username if visible",
  "capper_detection_confidence": number 0-100 — how confident you are in the capper identification,
  "picks": [
    {
      "player_name": "string or null for game bets",
      "team": "string, team name or abbreviation",
      "opponent": "string or null",
      "sport": "string: NBA, WNBA, NFL, MLB, NHL, Soccer, UFC, Tennis, NCAAB, NCAAF",
      "league": "string or null",
      "stat_type": "string, normalized lowercase",
      "line": "number or null",
      "direction": "string: OVER, UNDER, WIN, LOSE, YES, NO",
      "odds": "string or null, e.g. -110",
      "bet_type": "string: prop, moneyline, spread, total, futures, parlay",
      "confidence_note": "string or null",
      "game_date": "string YYYY-MM-DD if visible, else null"
    }
  ]
}

${SPORTS_CONTEXT}

RULES:
1. Return ONLY the JSON object, no markdown
2. Auto-detect the sport from context clues
3. Normalize stat types to lowercase
4. For parlays, return each leg as a separate pick
5. If confidence/conviction is indicated (🔒, 💰, "LOCK", "MAX PLAY"), note it
6. If you can't parse something, still include it with what you can extract
7. Return empty picks array [] if no picks found
8. ALWAYS try to extract capper_name — this is critical for attribution
9. Set capper_detection_confidence to 0 if no capper name visible`
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Parse all picks from this ${platform || 'capper'} screenshot. Extract every bet/pick visible AND the capper name/identity if shown.` },
              { type: 'image_url', image_url: { url: image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}` } }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 6000,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`AI API error [${aiResponse.status}]: ${errText}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '{}';

    // PHASE 8F — Item 4: persist vision token usage so the first funded week can
    // MEASURE whether max_tokens 6000 is over-provisioned. The cap itself is
    // deliberately UNCHANGED this phase (vision output shape is unmeasured).
    // No extra paid call: this only reads the response already received.
    {
      const finishReason = aiData?.choices?.[0]?.finish_reason ?? null;
      const { error: usageLogErr } = await supabase.from('sbo_function_logs').insert({
        function_name: 'sbo-parse-capper-image',
        status: 'completed',
        records_processed: 0,
        completed_at: new Date().toISOString(),
        metadata: {
          phase: '8F',
          provider: 'lovable_ai_gateway',
          call: 'vision_extract',
          model: aiData?.model ?? 'google/gemini-2.5-flash',
          max_tokens_configured: 6000,
          finish_reason: finishReason,
          output_chars: String(content).length,
          usage: aiData?.usage ?? null,
        },
      });
      if (usageLogErr) console.error('usage log insert failed:', usageLogErr.message);
    }


    let parsed: any;
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('Failed to parse AI response:', content);
      throw new Error('AI could not extract picks from the image');
    }

    // Handle both old (array) and new (object with picks) formats
    let picks: any[];
    let extractedCapperName: string | null = null;
    let extractedCapperHandle: string | null = null;
    let capperDetectionConfidence = 0;

    if (Array.isArray(parsed)) {
      picks = parsed;
    } else {
      picks = parsed.picks || [];
      extractedCapperName = parsed.capper_name || null;
      extractedCapperHandle = parsed.capper_handle || null;
      capperDetectionConfidence = parsed.capper_detection_confidence ?? (extractedCapperName ? 80 : 0);
    }

    if (picks.length === 0) {
      return new Response(JSON.stringify({ success: true, count: 0, picks: [], extracted_capper_name: extractedCapperName, message: 'No picks found in image' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate parse confidence per pick
    const scoredPicks = picks.map((p: any) => {
      let confidence = 100;
      if (!p.player_name && p.bet_type === 'prop') confidence -= 30;
      if (!p.sport) confidence -= 25;
      if (!p.direction) confidence -= 20;
      if (!p.line && p.bet_type === 'prop') confidence -= 15;
      if (!p.stat_type && p.bet_type === 'prop') confidence -= 10;
      return { ...p, parse_confidence: Math.max(0, confidence) };
    });

    // --- CAPPER RESOLUTION LOGIC ---
    let resolvedCapperId = capper_id || null;
    let resolvedCapperName = capper_name || null;
    // Stage 3 gate telemetry — why a new identity was or wasn't minted.
    let capperGateReason: string | null = null;


    if (group_type === 'aggregator' && extractedCapperName) {
      // Use the normalization + alias system for lookup
      const existing = await resolveCapperByName(supabase, extractedCapperName);

      if (existing) {
        resolvedCapperId = existing.id;
        resolvedCapperName = existing.name;
      } else {
        // Stage 3 — gated CREATE (shape + confidence + second sighting).
        const normalized = normalizeName(extractedCapperName);
        const gate = await shouldCreateCapper(supabase, {
          name: extractedCapperName,
          normalized: normalized || '',
          confidence: capperDetectionConfidence,
          sourceMessageId: source_message_id ?? null,
          source: 'image_extract',
          groupType: 'aggregator',
        });
        capperGateReason = gate.reason;

        if (gate.allow) {
          const { data: newCapper, error: createErr } = await supabase
            .from('sbo_cappers')
            .insert({
              name: extractedCapperName.trim(),
              normalized_name: normalized || null,
              source: 'image_extract',
              source_handle: extractedCapperHandle || null,
              tier: 'unproven',
              confidence_grade: 'D',
              is_active: true,
              total_picks: 0,
              group_type: 'aggregator',
            })
            .select('id')
            .single();

          if (createErr) {
            // Race condition retry
            const retry = await resolveCapperByName(supabase, extractedCapperName);
            resolvedCapperId = retry?.id || capper_id || null;
          } else {
            resolvedCapperId = newCapper.id;
            resolvedCapperName = extractedCapperName.trim();
            await markPendingPromoted(supabase, normalized || '', newCapper.id);
          }
        }
        // Gate refused → falls through to the Unknown Capper bucket below, which
        // is the correct home for an unconfirmed identity.
      }

      // If confidence < 70 and no capper_id provided, assign to "unknown_capper"
      if (!resolvedCapperId && !capper_id) {
        const { data: unknown } = await supabase
          .from('sbo_cappers').select('id')
          .eq('normalized_name', 'unknowncapper').maybeSingle();
        if (unknown) {
          resolvedCapperId = unknown.id;
        } else {
          const { data: created } = await supabase
            .from('sbo_cappers')
            .insert({ name: 'Unknown Capper', normalized_name: 'unknowncapper', source: 'system', tier: 'unproven', confidence_grade: 'D', is_active: true, total_picks: 0 })
            .select('id').single();
          resolvedCapperId = created?.id || null;
        }
      }
    } else if (group_type === 'direct' && !resolvedCapperId) {
      // Resolution order for direct dispatches (per-poster identity wins over channel fallback):
      // 1) Resolve AI-extracted capper_name against existing sbo_cappers
      // 2) If extracted passes quality gate (len>=3 AND != channel-name normalization),
      //    auto-create a new per-poster capper from it — BEFORE caller/channel fallback.
      //    (Critical: channel row almost always exists after first message; if we resolve
      //     channel first, per-poster identity gets swallowed forever.)
      // 3) Resolve caller-provided name (intake: capper_name || channel_name || channel_username)
      // 4) Auto-create from caller name (permissive fallback)
      const callerName = (capper_name || '').trim();
      const extractedName = (extractedCapperName || '').trim();
      const callerNorm = normalizeName(callerName);
      const extractedNorm = normalizeName(extractedName);

      const autoCreate = async (autoName: string, autoSource: string) => {
        const normalized = normalizeName(autoName);
        const { data: newCapper, error: createErr } = await supabase
          .from('sbo_cappers')
          .insert({
            name: autoName,
            normalized_name: normalized || null,
            source: autoSource,
            source_handle: extractedCapperHandle || null,
            tier: 'unproven',
            confidence_grade: 'D',
            is_active: true,
            total_picks: 0,
            group_type: 'direct',
          })
          .select('id, name')
          .single();

        if (createErr) {
          // Race condition retry
          const retry = await resolveCapperByName(supabase, autoName);
          resolvedCapperId = retry?.id || null;
          resolvedCapperName = retry?.name || null;
        } else {
          resolvedCapperId = newCapper.id;
          resolvedCapperName = newCapper.name;
        }
      };

      // 1) Try resolving extracted name against existing cappers
      if (extractedName) {
        const existing = await resolveCapperByName(supabase, extractedName);
        if (existing) {
          resolvedCapperId = existing.id;
          resolvedCapperName = existing.name;
        }
      }

      // 2) Auto-create from extracted name — now behind the Stage 3 gate.
      //    The old check (len>=3 AND != channel name) is what let date headings
      //    and system labels through, so it is replaced, not merely extended.
      if (!resolvedCapperId && extractedName && extractedNorm !== callerNorm) {
        const gate = await shouldCreateCapper(supabase, {
          name: extractedName,
          normalized: extractedNorm,
          confidence: capperDetectionConfidence,
          sourceMessageId: source_message_id ?? null,
          source: 'image_extract',
          groupType: 'direct',
        });
        capperGateReason = gate.reason;
        if (gate.allow) {
          await autoCreate(extractedName, 'image_extract');
          if (resolvedCapperId) await markPendingPromoted(supabase, extractedNorm, resolvedCapperId);
        }
      }

      // 3) Fall back to caller/channel name resolution
      if (!resolvedCapperId && callerName) {
        const existing = await resolveCapperByName(supabase, callerName);
        if (existing) {
          resolvedCapperId = existing.id;
          resolvedCapperName = existing.name;
        }
      }

      // 4) Last resort — create from the CALLER/CHANNEL name. This value comes
      //    from Telegram channel metadata, not from extracted message text, so
      //    the second-sighting rule does not apply. The shape check still does:
      //    a channel named like a date is still not an identity.
      if (!resolvedCapperId && callerName) {
        const shape = isHumanShapedName(callerName);
        if (shape.ok) {
          await autoCreate(callerName, 'telegram_direct');
        } else {
          capperGateReason = `caller_not_human_shaped:${shape.reason}`;
        }
      }

    }

    // Final safety net — never silently drop. If still unresolved, use Unknown Capper bucket.
    if (!resolvedCapperId) {
      const { data: unknown } = await supabase
        .from('sbo_cappers').select('id, name')
        .eq('normalized_name', 'unknowncapper').maybeSingle();
      if (unknown) {
        resolvedCapperId = unknown.id;
        resolvedCapperName = unknown.name;
      } else {
        const { data: created, error: unkErr } = await supabase
          .from('sbo_cappers')
          .insert({ name: 'Unknown Capper', normalized_name: 'unknowncapper', source: 'system', tier: 'unproven', confidence_grade: 'D', is_active: true, total_picks: 0 })
          .select('id, name').single();
        if (unkErr) {
          console.error('FATAL: could not resolve or create Unknown Capper bucket:', unkErr);
        } else {
          resolvedCapperId = created?.id || null;
          resolvedCapperName = created?.name || null;
        }
      }
    }

    // Determine review status based on both parse and capper detection confidence
    const needsCapperReview = group_type === 'aggregator' && capperDetectionConfidence < 70;

    // Insert picks — resolvedCapperId is guaranteed by the fallback chain above.
    if (!resolvedCapperId) {
      console.error('FATAL: resolvedCapperId still null after fallback chain — refusing to silently drop', {
        group_type, capper_name, extractedCapperName, picks_count: scoredPicks.length,
      });
      return new Response(JSON.stringify({
        success: false,
        error: 'Could not resolve or create any capper (including Unknown bucket)',
        extracted_capper_name: extractedCapperName,
        picks_count: scoredPicks.length,
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      const rows = scoredPicks.map((p: any) => ({
        capper_id: resolvedCapperId,
        pick_text: [p.player_name, p.direction, p.line, p.stat_type].filter(Boolean).join(' '),
        player_name: p.player_name || null,
        team: p.team || null,
        prop_type: canonicalPropType(p.stat_type),
        line: p.line ? parseFloat(p.line) : null,
        direction: p.direction || null,
        odds: p.odds ? parseInt(String(p.odds).replace('+', '')) : null,
        sport: p.sport || 'NBA',
        league: p.league || null,
        bet_type: p.bet_type || 'prop',
        parse_confidence: p.parse_confidence,
        review_status: (p.parse_confidence < 70 || needsCapperReview) ? 'needs_review' : 'verified',
        parsed_by_ai: true,
        game_date: p.game_date || today,
        result: 'pending',
        source_group: source_group || null,
        source_group_id: source_group_id || null,
        source_message_id: source_message_id || null,
        data_source: 'image_extract',
        posted_by: posted_by || null,
        extracted_capper_name: extractedCapperName || null,
        capper_detection_confidence: capperDetectionConfidence,
      }));

      // Insert with dedup: skip true duplicates. As of Stage 2 the unique index
      // also covers line-less / prop-less markets (NRFI, UFC moneylines) via
      // coalesce, so 23505 now fires for those too. Still a silent skip.
      const inserted: any[] = [];
      let dupCount = 0;
      for (const row of rows) {
        const { data, error: insertError } = await supabase.from('sbo_capper_picks').insert(row).select('id, player_name, prop_type, line, game_date, sport');
        if (insertError) {
          if (insertError.code === '23505') {
            dupCount++;
            console.log(`Skipped duplicate: ${row.player_name} ${row.prop_type} ${row.line} ${row.game_date}`);
            continue;
          }
          console.error('Insert error:', insertError);
          throw new Error(`Database error: ${insertError.message}`);
        }
        if (data) inserted.push(...data);
      }
      if (dupCount > 0) console.log(`Skipped ${dupCount} duplicate picks`);

      // Auto-match to props_master
      if (inserted && inserted.length > 0) {
        const dates = [...new Set(inserted.map((p: any) => p.game_date).filter(Boolean))];
        let allProps: any[] = [];
        for (const d of dates) {
          const { data: props } = await supabase.from('props_master')
            .select('id, player_name, stat_type, line, game_date')
            .eq('game_date', d).limit(1000);
          if (props) allProps.push(...props);
        }

        for (const pick of inserted) {
          if (!pick.player_name) continue;
          const normName = pick.player_name.toLowerCase().trim();
          const normStat = (pick.prop_type || '').toLowerCase().trim();
          
          const match = allProps.find((p: any) => {
            const pName = p.player_name.toLowerCase().trim();
            const pStat = p.stat_type.toLowerCase().trim();
            if (!pName.includes(normName.split(' ').pop()!) && !normName.includes(pName.split(' ').pop()!)) return false;
            if (normStat && pStat !== normStat) return false;
            if (pick.line != null && Math.abs(p.line - pick.line) > 1.0) return false;
            if (pick.game_date && p.game_date && pick.game_date !== p.game_date) return false;
            return true;
          });

          if (match) {
            await supabase.from('sbo_capper_picks').update({ matched_prop_id: match.id }).eq('id', pick.id);
          }
        }
      }

      // Update capper sports list
      const sports = [...new Set(scoredPicks.map((p: any) => p.sport).filter(Boolean))];
      if (sports.length > 0) {
        const { data: capper } = await supabase.from('sbo_cappers').select('sports').eq('id', resolvedCapperId).single();
        const existingSports = (capper?.sports as string[]) || [];
        const allSports = [...new Set([...existingSports, ...sports])];
        await supabase.from('sbo_cappers').update({ sports: allSports }).eq('id', resolvedCapperId);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      count: scoredPicks.length,
      picks: scoredPicks,
      extracted_capper_name: extractedCapperName,
      extracted_capper_handle: extractedCapperHandle,
      capper_detection_confidence: capperDetectionConfidence,
      resolved_capper_id: resolvedCapperId,
      resolved_capper_name: resolvedCapperName,
      group_type,
      capper_gate_reason: capperGateReason,

      needs_review: scoredPicks.filter((p: any) => p.parse_confidence < 70).length,
      needs_capper_review: needsCapperReview,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
