// Receives donation events from the public site (hrugucnccfbkqqjrvqqn)
// after Stripe confirms payment, and syncs them into Dynasty OS
// (uben_donors + uben_donations).
//
// Auth: UBEN-specific secret UBEN_SYNC_API_KEY sent as `Authorization: Bearer <key>`.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

interface DonationPayload {
  donor_name: string
  donor_email: string
  amount: number
  donation_type: string
  stripe_payment_intent_id: string
  donated_at: string
}

function bad(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') return bad(405, 'Method not allowed')

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  // --- Auth: pull expected key from DB (workaround for broken secret injection) ---
  const apiKey = req.headers.get('Authorization')?.replace('Bearer ', '')
  const { data: cfg, error: cfgErr } = await supabase
    .from('uben_sync_config')
    .select('api_key')
    .eq('id', 1)
    .maybeSingle()
  console.log('[uben-sync-donation] db key lookup', {
    found: cfg?.api_key ? 'present' : 'MISSING',
    error: cfgErr?.message ?? null,
  })
  if (cfgErr) return bad(500, `Config lookup failed: ${cfgErr.message}`)
  if (!cfg?.api_key) return bad(500, 'UBEN sync api_key not configured in uben_sync_config')
  if (!apiKey || apiKey !== cfg.api_key) return bad(401, 'Unauthorized')


  // --- Parse ---
  let body: DonationPayload
  try {
    body = await req.json()
  } catch {
    return bad(400, 'Invalid JSON')
  }

  const required = [
    'donor_name',
    'donor_email',
    'amount',
    'donation_type',
    'stripe_payment_intent_id',
    'donated_at',
  ] as const
  for (const k of required) {
    if (body[k] === undefined || body[k] === null || body[k] === '') {
      return bad(400, `Missing field: ${k}`)
    }
  }
  if (typeof body.amount !== 'number' || body.amount <= 0) {
    return bad(400, 'amount must be a positive number')
  }

  const email = body.donor_email.trim().toLowerCase()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  try {
    // --- Idempotency: skip if this Stripe PI already synced ---
    const { data: existing, error: existingErr } = await supabase
      .from('uben_donations')
      .select('id')
      .eq('stripe_payment_intent_id', body.stripe_payment_intent_id)
      .maybeSingle()
    if (existingErr) throw existingErr
    if (existing) {
      return new Response(
        JSON.stringify({ success: true, deduped: true, donation_id: existing.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // --- Find or create donor ---
    let donorId: string
    const { data: donor, error: donorErr } = await supabase
      .from('uben_donors')
      .select('id, total_donated')
      .eq('donor_email', email)
      .maybeSingle()
    if (donorErr) throw donorErr

    if (donor) {
      donorId = donor.id
    } else {
      const { data: created, error: createErr } = await supabase
        .from('uben_donors')
        .insert({
          donor_name: body.donor_name,
          donor_email: email,
          donor_type: 'individual',
          total_donated: 0,
          is_recurring: body.donation_type === 'recurring',
        })
        .select('id')
        .single()
      if (createErr) throw createErr
      donorId = created.id
    }

    // --- Insert donation ---
    const { data: donation, error: donationErr } = await supabase
      .from('uben_donations')
      .insert({
        donor_id: donorId,
        amount: body.amount,
        donation_type: body.donation_type,
        stripe_payment_intent_id: body.stripe_payment_intent_id,
        status: 'completed',
        created_at: body.donated_at,
      })
      .select('id')
      .single()
    if (donationErr) throw donationErr

    // --- Update donor totals ---
    const { error: updateErr } = await supabase.rpc('uben_increment_donor_total', {
      p_donor_id: donorId,
      p_amount: body.amount,
    })
    if (updateErr) {
      // Fallback: read-modify-write if RPC isn't present
      const { data: cur } = await supabase
        .from('uben_donors')
        .select('total_donated')
        .eq('id', donorId)
        .single()
      const next = Number(cur?.total_donated ?? 0) + body.amount
      await supabase
        .from('uben_donors')
        .update({
          total_donated: next,
          last_donation_date: new Date().toISOString().slice(0, 10),
        })
        .eq('id', donorId)
    }

    return new Response(
      JSON.stringify({ success: true, donor_id: donorId, donation_id: donation.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('uben-sync-donation error', err)
    return bad(500, (err as Error).message ?? 'Internal error')
  }
})
