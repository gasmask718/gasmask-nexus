import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

// Public webhook: no JWT check. Optional Stripe signature soft-validation.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    const stripeSig = req.headers.get('stripe-signature')
    const stripeSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    if (stripeSig && !stripeSecret) {
      console.warn('sf-payment-handler: stripe-signature present but STRIPE_WEBHOOK_SECRET not set — accepting without verification')
    }

    const body = await req.json()
    const {
      case_id,
      contract_id,
      amount,
      our_fee_amount,
      attorney_fee_amount,
      claimant_net_amount,
      payment_method,
      court_order_date,
      disbursement_date,
      our_fee_received_date,
      notes,
    } = body || {}

    if (!case_id) throw new Error('case_id required')

    const { data: sfCase, error: caseErr } = await supabase
      .from('surplus_funds_cases')
      .select('id, client_name, surplus_amount, our_percentage')
      .eq('id', case_id)
      .single()
    if (caseErr || !sfCase) throw new Error('Case not found')

    const totalSurplus = amount ?? sfCase.surplus_amount ?? 0
    const ourPct = sfCase.our_percentage ?? 0
    const computedOurFee = our_fee_amount ?? (totalSurplus && ourPct ? (Number(totalSurplus) * Number(ourPct)) / 100 : null)
    const status = our_fee_received_date ? 'received' : disbursement_date ? 'disbursed' : 'pending'

    // Idempotent-ish upsert: one payment row per (case_id, contract_id).
    // If contract_id null, we upsert on case_id only by first trying update, then insert.
    let paymentId: string | null = null
    if (contract_id) {
      const { data: existing } = await supabase
        .from('surplus_funds_payments')
        .select('id')
        .eq('case_id', case_id)
        .eq('contract_id', contract_id)
        .maybeSingle()
      if (existing) paymentId = existing.id
    } else {
      const { data: existing } = await supabase
        .from('surplus_funds_payments')
        .select('id')
        .eq('case_id', case_id)
        .is('contract_id', null)
        .maybeSingle()
      if (existing) paymentId = existing.id
    }

    const payload = {
      case_id,
      contract_id: contract_id ?? null,
      claimant_name: sfCase.client_name,
      total_surplus_amount: totalSurplus,
      our_percentage: ourPct,
      our_fee_amount: computedOurFee,
      attorney_fee_amount: attorney_fee_amount ?? null,
      claimant_net_amount: claimant_net_amount ?? null,
      status,
      court_order_date: court_order_date ?? null,
      disbursement_date: disbursement_date ?? null,
      our_fee_received_date: our_fee_received_date ?? null,
      payment_method: payment_method ?? null,
      notes: notes ?? null,
    }

    if (paymentId) {
      const { error: updErr } = await supabase
        .from('surplus_funds_payments')
        .update(payload)
        .eq('id', paymentId)
      if (updErr) throw updErr
    } else {
      const { data: ins, error: insErr } = await supabase
        .from('surplus_funds_payments')
        .insert(payload)
        .select('id')
        .single()
      if (insErr) throw insErr
      paymentId = ins.id
    }

    if (disbursement_date) {
      await supabase
        .from('surplus_funds_cases')
        .update({
          funds_released_at: new Date(disbursement_date).toISOString(),
          amount_received: computedOurFee ?? totalSurplus,
          status: 'paid',
          updated_at: new Date().toISOString(),
        })
        .eq('id', case_id)
    }

    const DAVID_PHONE = Deno.env.get('DAVID_PHONE')
    if (DAVID_PHONE && our_fee_received_date) {
      await supabase.functions.invoke('send-sms', {
        body: {
          to: DAVID_PHONE,
          message: `💰 SF payment received: $${Number(computedOurFee ?? 0).toLocaleString()} — ${sfCase.client_name}`,
        },
      })
    }

    return new Response(
      JSON.stringify({ success: true, payment_id: paymentId, status }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('sf-payment-handler error:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
