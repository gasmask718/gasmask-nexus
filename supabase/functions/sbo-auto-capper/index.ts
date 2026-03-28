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
];

function containsBettingSignal(text: string): boolean {
  if (!text || text.length < 8) return false;
  let matches = 0;
  for (const pattern of BETTING_PATTERNS) {
    if (pattern.test(text)) matches++;
    if (matches >= 2) return true;
  }
  return false;
}

function extractCapperFromText(text: string): string | null {
  if (!text) return null;
  for (const pattern of CAPPER_NAME_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const name = match[1].trim().replace(/[🔥💰💎⭐🔒]/g, '').trim();
      if (name.length >= 2 && name.length <= 40) return name;
    }
  }
  return null;
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
      let postedBy = displayName || username || telegramUserId;

      if (groupType === 'aggregator') {
        // Extract capper name from the message text
        resolvedCapperName = extractCapperFromText(messageText || '');

        if (resolvedCapperName) {
          // Look up by name
          const { data: existingCapper } = await supabase
            .from('sbo_cappers')
            .select('id, name, tier, confidence_grade')
            .ilike('name', resolvedCapperName)
            .maybeSingle();

          if (existingCapper) {
            resolvedCapperId = existingCapper.id;
            await supabase.from('sbo_cappers')
              .update({ last_active: new Date().toISOString(), updated_at: new Date().toISOString() })
              .eq('id', resolvedCapperId);
          } else {
            // Auto-create from extracted name
            const { data: newCapper, error: createError } = await supabase
              .from('sbo_cappers')
              .insert({
                name: resolvedCapperName,
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
              const { data: retry } = await supabase
                .from('sbo_cappers')
                .select('id, name')
                .ilike('name', resolvedCapperName)
                .maybeSingle();
              if (retry) resolvedCapperId = retry.id;
            } else {
              resolvedCapperId = newCapper.id;
              wasCreated = true;
            }
          }
        }
        // Fallback: if no capper extracted, fall through to sender-based logic
      }

      // Direct group or aggregator fallback: use telegram sender
      if (!resolvedCapperId) {
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
          const { data: newCapper, error: createError } = await supabase
            .from('sbo_cappers')
            .insert({
              name: resolvedCapperName,
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
        group_type: groupType,
        has_betting_signal: true,
        extracted_from_content: groupType === 'aggregator' && !!extractCapperFromText(messageText || ''),
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // MODE: update_profiles — batch update capper profiles from recent picks
    if (mode === 'update_profiles') {
      const { data: cappers } = await supabase
        .from('sbo_cappers')
        .select('id, total_picks, win_rate, roi_pct')
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
        const wins = picks.filter(p => p.result === 'won').length;
        const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

        const sportCounts: Record<string, number> = {};
        picks.forEach(p => { if (p.sport) sportCounts[p.sport] = (sportCounts[p.sport] || 0) + 1; });
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

        await supabase
          .from('sbo_cappers')
          .update({
            total_picks: total,
            win_rate: winRate,
            confidence_grade: grade,
            tier,
            best_sport: bestSport,
            updated_at: new Date().toISOString(),
          })
          .eq('id', capper.id);

        updated++;
      }

      return new Response(JSON.stringify({ updated, total_cappers: cappers.length }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid mode. Use: process, update_profiles' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('sbo-auto-capper error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
