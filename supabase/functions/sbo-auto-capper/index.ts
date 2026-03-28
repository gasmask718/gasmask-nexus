import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Betting signal patterns to filter real picks from chat noise
const BETTING_PATTERNS = [
  /\b(over|under|o|u)\s*\d+\.?\d*/i,
  /[+-]\d+\.?\d*\s*(spread)?/i,
  /\b(ML|moneyline|money\s*line)\b/i,
  /\b(parlay|teaser|prop)\b/i,
  /\b(pts|points|rebounds|assists|yards|receptions|hits|goals|aces|strikeouts|TDs|touchdowns)\b/i,
  /\b(1H|2H|1Q|2Q|3Q|4Q|first\s*half|second\s*half)\b/i,
  /[+-]\d{3,}/,
  /\b(lock|fade|lean|hammer|play|bet)\b/i,
  /\b(BOL|best of luck|tail|tailing)\b/i,
];

// Patterns to extract capper name from text messages
const CAPPER_NAME_PATTERNS = [
  /^(?:from|by|via|source|capper|picks?\s+by)[:\s]+(.+?)(?:\n|$)/im,
  /^(@\w+)[:\s]/m,
  /^(\w[\w\s]{1,25})[:\s]*\n/m,
  /📸\s*(?:screenshot)?[:\s]*["""]?(.+?)["""]?\s*(?:🔥|💰|💎|⭐|$)/i,
  /^["""]?(.+?)["""]?\s*[-–—:]\s*(?:LOCK|lock|🔒|💰|picks?|plays?)/im,
];

/**
 * Normalize a capper name for identity matching.
 * Strips emojis, suffixes like "VIP"/"Picks", and special chars.
 */
function normalizeName(name: string): string {
  let n = name
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '') // emojis
    .replace(/\b(vip|picks?|plays?|locks?|bets?|premium|free|official)\b/gi, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
    .trim();
  return n;
}

function containsBettingSignal(text: string): boolean {
  if (!text || text.length < 8) return false;
  let matches = 0;
  for (const pattern of BETTING_PATTERNS) {
    if (pattern.test(text)) matches++;
    if (matches >= 2) return true;
  }
  return false;
}

function extractCapperFromText(text: string): { name: string; confidence: number } | null {
  if (!text) return null;
  for (let i = 0; i < CAPPER_NAME_PATTERNS.length; i++) {
    const match = text.match(CAPPER_NAME_PATTERNS[i]);
    if (match?.[1]) {
      const raw = match[1].trim().replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim();
      if (raw.length >= 2 && raw.length <= 40) {
        // Earlier patterns = higher confidence
        const confidence = i <= 1 ? 90 : i === 2 ? 75 : 65;
        return { name: raw, confidence };
      }
    }
  }
  return null;
}

/**
 * Resolve a capper by normalized name, checking aliases too.
 */
async function resolveCapperByName(supabase: any, rawName: string): Promise<{ id: string; name: string } | null> {
  const normalized = normalizeName(rawName);
  if (!normalized) return null;

  // 1. Check normalized_name on sbo_cappers
  const { data: byNorm } = await supabase
    .from('sbo_cappers')
    .select('id, name')
    .eq('normalized_name', normalized)
    .maybeSingle();
  if (byNorm) return byNorm;

  // 2. Check aliases
  const { data: alias } = await supabase
    .from('sbo_capper_aliases')
    .select('capper_id, alias')
    .eq('normalized_alias', normalized)
    .maybeSingle();
  if (alias) {
    const { data: capper } = await supabase.from('sbo_cappers').select('id, name').eq('id', alias.capper_id).single();
    return capper || null;
  }

  // 3. Fallback ilike on original name
  const { data: byName } = await supabase
    .from('sbo_cappers')
    .select('id, name')
    .ilike('name', rawName.trim())
    .maybeSingle();
  return byName || null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const text = await req.text();
    let body: Record<string, unknown> = {};
    try { body = JSON.parse(text); } catch { body = {}; }

    const mode = (body.mode as string) || 'process';

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // MODE: process — identify capper from telegram message metadata
    if (mode === 'process') {
      const telegramUserId = body.telegram_user_id as string;
      const username = body.username as string;
      const displayName = body.display_name as string;
      const messageText = body.message_text as string;
      const groupType = (body.group_type as string) || 'direct';
      const sourceGroup = body.source_group as string | undefined;
      const sourceGroupId = body.source_group_id as string | undefined;

      if (!telegramUserId) {
        return new Response(JSON.stringify({ error: 'telegram_user_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Step 1: Check if message contains betting signal
      const hasBettingSignal = containsBettingSignal(messageText || '');

      if (!hasBettingSignal) {
        return new Response(JSON.stringify({
          action: 'skipped',
          reason: 'no_betting_signal',
          message: 'Message does not contain a valid betting pick',
        }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Step 2: Determine the TRUE capper
      let resolvedCapperName: string | null = null;
      let resolvedCapperId: string | null = null;
      let wasCreated = false;
      let capperDetectionConfidence = 100;
      let postedBy = displayName || username || telegramUserId;

      if (groupType === 'aggregator') {
        // Extract capper name from the message text
        const extracted = extractCapperFromText(messageText || '');

        if (extracted) {
          resolvedCapperName = extracted.name;
          capperDetectionConfidence = extracted.confidence;
          const normalized = normalizeName(extracted.name);

          // Look up by normalized name or alias
          const existing = await resolveCapperByName(supabase, extracted.name);

          if (existing) {
            resolvedCapperId = existing.id;
            await supabase.from('sbo_cappers')
              .update({ last_active: new Date().toISOString(), updated_at: new Date().toISOString() })
              .eq('id', resolvedCapperId);
          } else if (capperDetectionConfidence >= 70) {
            // Auto-create from extracted name
            const { data: newCapper, error: createError } = await supabase
              .from('sbo_cappers')
              .insert({
                name: extracted.name,
                normalized_name: normalized || null,
                source: 'aggregator_extract',
                tier: 'unproven',
                confidence_grade: 'D',
                is_active: true,
                total_picks: 0,
                group_type: 'aggregator',
                last_active: new Date().toISOString(),
              })
              .select('id, name')
              .single();

            if (createError) {
              // Race condition — retry lookup
              const retry = await resolveCapperByName(supabase, extracted.name);
              if (retry) resolvedCapperId = retry.id;
            } else {
              resolvedCapperId = newCapper.id;
              wasCreated = true;
            }
          }
          // If confidence < 70, fall through to sender fallback
        }
      }

      // Direct group or aggregator fallback: use telegram sender
      if (!resolvedCapperId) {
        if (groupType === 'aggregator' && !resolvedCapperName) {
          capperDetectionConfidence = 30; // low confidence — using sender as fallback
        }

        const { data: existingCapper } = await supabase
          .from('sbo_cappers')
          .select('id, name, total_picks, confidence_grade, tier')
          .eq('telegram_user_id', telegramUserId)
          .maybeSingle();

        if (existingCapper) {
          resolvedCapperId = existingCapper.id;
          resolvedCapperName = existingCapper.name;
          await supabase.from('sbo_cappers')
            .update({ last_active: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('id', resolvedCapperId);
        } else {
          resolvedCapperName = displayName || username || `TG-${telegramUserId.slice(-6)}`;
          const normalized = normalizeName(resolvedCapperName);
          const { data: newCapper, error: createError } = await supabase
            .from('sbo_cappers')
            .insert({
              name: resolvedCapperName,
              normalized_name: normalized || null,
              source: 'telegram',
              source_handle: username ? `@${username}` : null,
              telegram_user_id: telegramUserId,
              telegram_username: username || null,
              tier: 'unproven',
              confidence_grade: 'D',
              is_active: true,
              total_picks: 0,
              group_type: groupType,
              last_active: new Date().toISOString(),
            })
            .select('id, name')
            .single();

          if (createError) {
            const { data: retry } = await supabase
              .from('sbo_cappers')
              .select('id, name')
              .eq('telegram_user_id', telegramUserId)
              .single();
            if (retry) {
              resolvedCapperId = retry.id;
              resolvedCapperName = retry.name;
            } else {
              throw createError;
            }
          } else {
            resolvedCapperId = newCapper.id;
            resolvedCapperName = newCapper.name;
            wasCreated = true;
          }
        }
      }

      return new Response(JSON.stringify({
        action: wasCreated ? 'created' : 'matched',
        capper_id: resolvedCapperId,
        capper_name: resolvedCapperName,
        posted_by: postedBy,
        source_group: sourceGroup || null,
        source_group_id: sourceGroupId || null,
        group_type: groupType,
        has_betting_signal: true,
        capper_detection_confidence: capperDetectionConfidence,
        extracted_from_content: groupType === 'aggregator' && capperDetectionConfidence >= 70,
        needs_review: capperDetectionConfidence < 70,
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // MODE: update_profiles — batch update capper profiles from recent picks
    if (mode === 'update_profiles') {
      const { data: cappers } = await supabase
        .from('sbo_cappers')
        .select('id, name, total_picks, win_rate, roi_pct')
        .eq('is_active', true);

      if (!cappers || cappers.length === 0) {
        return new Response(JSON.stringify({ updated: 0 }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let updated = 0;
      for (const capper of cappers) {
        const { data: picks } = await supabase
          .from('sbo_capper_picks')
          .select('result, sport')
          .eq('capper_id', capper.id)
          .not('result', 'is', null);

        if (!picks || picks.length === 0) continue;

        const total = picks.length;
        const wins = picks.filter((p: any) => p.result === 'won').length;
        const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

        const sportCounts: Record<string, number> = {};
        picks.forEach((p: any) => { if (p.sport) sportCounts[p.sport] = (sportCounts[p.sport] || 0) + 1; });
        const bestSport = Object.entries(sportCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

        let grade = 'D';
        if (total >= 20 && winRate >= 60) grade = 'A';
        else if (total >= 15 && winRate >= 55) grade = 'B';
        else if (total >= 10 && winRate >= 50) grade = 'C';

        let tier = 'unproven';
        if (total >= 30 && winRate >= 58) tier = 'elite';
        else if (total >= 20 && winRate >= 55) tier = 'sharp';
        else if (total >= 10 && winRate >= 50) tier = 'consistent';
        else if (total >= 5) tier = 'tracked';

        // Backfill normalized_name if missing
        const normalized = normalizeName(capper.name || '');

        await supabase
          .from('sbo_cappers')
          .update({
            total_picks: total,
            win_rate: winRate,
            confidence_grade: grade,
            tier,
            best_sport: bestSport,
            normalized_name: normalized || undefined,
            updated_at: new Date().toISOString(),
          })
          .eq('id', capper.id);

        updated++;
      }

      return new Response(JSON.stringify({ updated, total_cappers: cappers.length }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // MODE: add_alias — manually add a capper alias
    if (mode === 'add_alias') {
      const capperId = body.capper_id as string;
      const alias = body.alias as string;
      if (!capperId || !alias) {
        return new Response(JSON.stringify({ error: 'capper_id and alias required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const normalizedAlias = normalizeName(alias);
      if (!normalizedAlias) {
        return new Response(JSON.stringify({ error: 'Invalid alias — normalizes to empty' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error } = await supabase.from('sbo_capper_aliases').insert({
        capper_id: capperId,
        alias,
        normalized_alias: normalizedAlias,
        source: 'manual',
      });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, normalized_alias: normalizedAlias }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid mode. Use: process, update_profiles, add_alias' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('sbo-auto-capper error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
