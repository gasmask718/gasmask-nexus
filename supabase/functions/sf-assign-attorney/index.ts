import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    const { case_id, attorney_id, attorney_fee_percentage, notes } = await req.json()
    if (!case_id || !attorney_id) throw new Error('case_id and attorney_id required')

    const { data: sfCase, error: caseErr } = await supabase
      .from('surplus_funds_cases')
      .select('id, state, client_name')
      .eq('id', case_id)
      .single()
    if (caseErr || !sfCase) throw new Error('Case not found')

    const { data: attorney, error: attErr } = await supabase
      .from('surplus_funds_attorneys')
      .select('id, name, phone, states, status, cases_total')
      .eq('id', attorney_id)
      .single()
    if (attErr || !attorney) throw new Error('Attorney not found')

    if (attorney.status !== 'active') {
      throw new Error(`Attorney is not active (status=${attorney.status})`)
    }
    const covers = Array.isArray(attorney.states) && attorney.states.includes(sfCase.state)
    if (!covers) {
      throw new Error(`Attorney does not cover state ${sfCase.state}`)
    }

    const { data: assignment, error: assignErr } = await supabase
      .from('surplus_funds_attorney_assignments')
      .insert({
        case_id,
        attorney_id,
        status: 'pending',
        attorney_fee_percentage: attorney_fee_percentage ?? null,
        notes: notes ?? null,
      })
      .select('id')
      .single()
    if (assignErr) throw assignErr

    await supabase
      .from('surplus_funds_cases')
      .update({
        attorney_id,
        attorney_name: attorney.name,
        status: 'attorney_assigned',
        updated_at: new Date().toISOString(),
      })
      .eq('id', case_id)

    await supabase
      .from('surplus_funds_attorneys')
      .update({ cases_total: (attorney.cases_total ?? 0) + 1 })
      .eq('id', attorney_id)

    if (attorney.phone) {
      await supabase.functions.invoke('send-sms', {
        body: {
          to: attorney.phone,
          message: `New surplus funds case assigned: ${sfCase.client_name} (${sfCase.state}). Log in to review.`,
        },
      })
    }

    const DAVID_PHONE = Deno.env.get('DAVID_PHONE')
    if (DAVID_PHONE) {
      await supabase.functions.invoke('send-sms', {
        body: {
          to: DAVID_PHONE,
          message: `⚖️ SF attorney assigned: ${attorney.name} → ${sfCase.client_name} (${sfCase.state})`,
        },
      })
    }

    return new Response(
      JSON.stringify({ success: true, assignment_id: assignment.id }),
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
