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
  /[+-]\d{3,}/,  // odds like +150 -110
  /\b(lock|fade|lean|hammer|play|bet)\b/i,
  /\b(BOL|best of luck|tail|tailing)\b/i,
];

function containsBettingSignal(text: string): boolean {
  if (!text || text.length < 8) return false;
  let matches = 0;
  for (const pattern of BETTING_PATTERNS) {
    if (pattern.test(text)) matches++;
    if (matches >= 2) return true; // require at least 2 signals
  }
  return false;
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

      // Step 2: Check if capper already exists by telegram_user_id
      const { data: existingCapper } = await supabase
        .from('sbo_cappers')
        .select('id, name, total_picks, confidence_grade, tier')
        .eq('telegram_user_id', telegramUserId)
        .maybeSingle();

      let capperId: string;
      let capperName: string;
      let wasCreated = false;

      if (existingCapper) {
        capperId = existingCapper.id;
        capperName = existingCapper.name;

        // Update last_active
        await supabase
          .from('sbo_cappers')
          .update({ last_active: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', capperId);

      } else {
        // Step 3: Create new capper
        capperName = displayName || username || `TG-${telegramUserId.slice(-6)}`;

        const { data: newCapper, error: createError } = await supabase
          .from('sbo_cappers')
          .insert({
            name: capperName,
            source: 'telegram',
            source_handle: username ? `@${username}` : null,
            telegram_user_id: telegramUserId,
            telegram_username: username || null,
            tier: 'unproven',
            confidence_grade: 'D',
            is_active: true,
            total_picks: 0,
            last_active: new Date().toISOString(),
          })
          .select('id, name')
          .single();

        if (createError) {
          // Could be unique constraint race condition — retry lookup
          const { data: retry } = await supabase
            .from('sbo_cappers')
            .select('id, name')
            .eq('telegram_user_id', telegramUserId)
            .single();

          if (retry) {
            capperId = retry.id;
            capperName = retry.name;
          } else {
            throw createError;
          }
        } else {
          capperId = newCapper.id;
          capperName = newCapper.name;
          wasCreated = true;
        }
      }

      return new Response(JSON.stringify({
        action: wasCreated ? 'created' : 'matched',
        capper_id: capperId,
        capper_name: capperName,
        has_betting_signal: true,
        tier: wasCreated ? 'unproven' : (existingCapper?.tier || 'unproven'),
        confidence_grade: wasCreated ? 'D' : (existingCapper?.confidence_grade || 'D'),
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // MODE: update_profiles — batch update capper profiles from recent picks
    if (mode === 'update_profiles') {
      const { data: cappers } = await supabase
        .from('sbo_cappers')
        .select('id, total_picks, win_rate, roi_pct')
        .eq('source', 'telegram')
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

        // Detect best sport
        const sportCounts: Record<string, number> = {};
        picks.forEach(p => { if (p.sport) sportCounts[p.sport] = (sportCounts[p.sport] || 0) + 1; });
        const bestSport = Object.entries(sportCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

        // Assign grade
        let grade = 'D';
        if (total >= 20 && winRate >= 60) grade = 'A';
        else if (total >= 15 && winRate >= 55) grade = 'B';
        else if (total >= 10 && winRate >= 50) grade = 'C';

        // Assign tier
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

  } catch (error) {
    console.error('sbo-auto-capper error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
