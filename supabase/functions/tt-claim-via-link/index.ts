// tt-claim-via-link
// Wrapper invoked by the partner accept magic-link page (PartnerAccept.tsx).
// 1. Calls tt_claim_dispatch(token) RPC (atomic claim)
// 2. On 'won', invokes tt-finalize-accept with the dispatch_id
// 3. Returns unified outcome to the client.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { token } = await req.json()
    if (!token) {
      return new Response(JSON.stringify({ outcome: 'invalid', reason: 'token required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: claimRes, error: claimErr } = await supabase.rpc('tt_claim_dispatch', { p_token: token })
    if (claimErr) {
      console.error('[tt-claim-via-link] claim RPC error:', claimErr.message)
      return new Response(JSON.stringify({ outcome: 'error', reason: claimErr.message, finalize_result: null }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const res = (claimRes as any) || {}
    const outcome = res.outcome as string

    if (outcome !== 'won') {
      // 'invalid' | 'lost' | anything-else — do not finalize
      return new Response(JSON.stringify({
        outcome,
        reason: res.reason,
        finalize_result: null,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Won — finalize side effects.
    const dispatch_id = res.dispatch_id
    const { data: finalizeData, error: finalizeErr } = await supabase.functions.invoke(
      'tt-finalize-accept',
      { body: { dispatch_id, trigger_source: 'link_tap' } }
    )

    if (finalizeErr) {
      console.error('[tt-claim-via-link] finalize invoke failed:', finalizeErr)
      return new Response(JSON.stringify({
        outcome: 'won',
        finalize_result: { success: false, error: finalizeErr.message },
        warning: 'claim succeeded but finalize failed — ops must reconcile',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({
      outcome: 'won',
      booking_id: res.booking_id,
      partner_name: res.partner_name,
      finalize_result: finalizeData,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err) {
    console.error('tt-claim-via-link fatal:', err)
    return new Response(JSON.stringify({
      outcome: 'error', reason: (err as any)?.message ?? String(err), finalize_result: null,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
