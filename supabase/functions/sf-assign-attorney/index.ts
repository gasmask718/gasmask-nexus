import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isSuppressed } from '../_shared/dnc.ts'
import { legalStopBlocked } from '../_shared/twilioSend.ts'
import { sendSms } from '../_shared/sendSms.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function refuse(reason: string, detail: Record<string, unknown> = {}) {
  console.error('sf-assign-attorney refused:', JSON.stringify({ reason, ...detail }))
  return new Response(JSON.stringify({ success: false, refused: true, reason, ...detail }), {
    status: 422,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    const { case_id, attorney_id, notes } = await req.json()
    if (!case_id || !attorney_id) throw new Error('case_id and attorney_id required')

    const { data: sfCase, error: caseErr } = await supabase
      .from('surplus_funds_cases')
      .select('id, state, client_name')
      .eq('id', case_id)
      .single()
    if (caseErr || !sfCase) throw new Error('Case not found')

    const { data: attorney, error: attErr } = await supabase
      .from('surplus_funds_attorneys')
      .select('id, name, phone, states, status, cases_total, application_status, bar_verified, malpractice_confirmed, iolta_confirmed, engagement_type, fee_arrangement')
      .eq('id', attorney_id)
      .single()
    if (attErr || !attorney) throw new Error('Attorney not found')

    // --- Eligibility gate: fails closed, every refusal carries a reason ---
    if (attorney.application_status !== 'eligible') {
      return refuse('attorney_not_eligible', { application_status: attorney.application_status })
    }
    if (!attorney.bar_verified) return refuse('bar_not_verified')
    if (!attorney.malpractice_confirmed) return refuse('malpractice_not_confirmed')
    if (!attorney.iolta_confirmed) return refuse('iolta_not_confirmed')
    if (attorney.status !== 'active') return refuse('attorney_not_active', { status: attorney.status })

    // Jurisdiction: prefer the structured table, fall back to legacy states[]
    const { data: juris } = await supabase
      .from('sf_attorney_jurisdiction')
      .select('jurisdiction, status, discipline_flag')
      .eq('attorney_id', attorney_id)
      .eq('jurisdiction', sfCase.state)
      .maybeSingle()

    if (juris) {
      if (juris.status !== 'active') {
        return refuse('jurisdiction_not_active', { jurisdiction: sfCase.state, status: juris.status })
      }
      if (juris.discipline_flag) {
        return refuse('jurisdiction_discipline_flag', { jurisdiction: sfCase.state })
      }
    } else {
      const covers = Array.isArray(attorney.states) && attorney.states.includes(sfCase.state)
      if (!covers) return refuse('jurisdiction_not_covered', { jurisdiction: sfCase.state })
    }

    const { data: assignment, error: assignErr } = await supabase
      .from('surplus_funds_attorney_assignments')
      .insert({
        case_id,
        attorney_id,
        status: 'pending',
        notes: notes ?? null,
      })
      .select('id')
      .single()
    if (assignErr) throw assignErr

    // FIX: 'attorney_assigned' is not in surplus_funds_cases_status_check —
    // every assignment update failed silently. 'referred' is the valid state.
    const { error: caseUpdErr } = await supabase
      .from('surplus_funds_cases')
      .update({
        attorney_id,
        attorney_name: attorney.name,
        status: 'referred',
        updated_at: new Date().toISOString(),
      })
      .eq('id', case_id)
    if (caseUpdErr) throw caseUpdErr

    await supabase
      .from('surplus_funds_attorneys')
      .update({ cases_total: (attorney.cases_total ?? 0) + 1 })
      .eq('id', attorney_id)

    // --- Attorney-side notification: canonical suppression, no reimplementation ---
    let attorneyNotice: Record<string, unknown> = { attempted: false }
    if (attorney.phone) {
      const sup = await isSuppressed(supabase, attorney.phone)
      const stop = await legalStopBlocked(supabase, attorney.phone)
      if (sup.blocked || stop.blocked) {
        attorneyNotice = {
          attempted: true,
          sent: false,
          reason: sup.reason || stop.reason || 'suppressed',
        }
        console.warn('sf-assign-attorney attorney SMS suppressed:', JSON.stringify(attorneyNotice))
      } else {
        const res = await sendSms({
          to: attorney.phone,
          body: `New surplus funds case assigned: ${sfCase.client_name} (${sfCase.state}). Log in to review.`,
          idempotencyKey: `sf-assign:${assignment.id}:attorney`,
          sendClass: 'workforce',
          purpose: 'sf_attorney_assignment',
        })
        attorneyNotice = { attempted: true, sent: res.success, status: res.status }
      }
    }

    const DAVID_PHONE = Deno.env.get('DAVID_PHONE')
    if (DAVID_PHONE) {
      const stop = await legalStopBlocked(supabase, DAVID_PHONE)
      if (!stop.blocked) {
        await sendSms({
          to: DAVID_PHONE,
          body: `SF attorney assigned: ${attorney.name} -> ${sfCase.client_name} (${sfCase.state})`,
          idempotencyKey: `sf-assign:${assignment.id}:owner`,
          sendClass: 'workforce',
          purpose: 'sf_attorney_assignment_alert',
        })
      }
    }

    return new Response(
      JSON.stringify({ success: true, assignment_id: assignment.id, attorney_notice: attorneyNotice }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('sf-assign-attorney error:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
