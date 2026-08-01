import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

// Daily demo expiry cleanup (cron: 0 9 * * *)
// Real table: public.brandaro_demo_sites
//   expires_at            (added for this job, default now() + 14 days)
//   deployment_status     'pending' | 'deploying' | 'live' | 'failed' | 'expired'

//   converted_to_paid     (matches spec)
//   vercel_deployment_id  (deployment to delete)

const VERCEL_API_TOKEN = Deno.env.get('VERCEL_API_TOKEN')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    const { data: demos, error } = await supabase
      .from('brandaro_demo_sites')
      .select('id, slug, business_name, vercel_deployment_id, expires_at')
      .lt('expires_at', new Date().toISOString())
      .eq('public_status', 'live')
      .eq('converted_to_paid', false)

    if (error) throw error

    const results: Array<Record<string, unknown>> = []

    for (const demo of demos ?? []) {
      let vercelDeleted = false
      let vercelError: string | null = null

      if (demo.vercel_deployment_id && VERCEL_API_TOKEN) {
        try {
          const res = await fetch(
            `https://api.vercel.com/v13/deployments/${demo.vercel_deployment_id}`,
            { method: 'DELETE', headers: { Authorization: `Bearer ${VERCEL_API_TOKEN}` } },
          )
          // 404 = already gone; treat as success
          vercelDeleted = res.ok || res.status === 404
          if (!vercelDeleted) vercelError = `${res.status}: ${await res.text()}`
        } catch (e) {
          vercelError = e instanceof Error ? e.message : String(e)
        }
      } else if (!demo.vercel_deployment_id) {
        vercelError = 'no vercel_deployment_id'
      } else {
        vercelError = 'VERCEL_API_TOKEN not configured'
      }

      const { error: upErr } = await supabase
        .from('brandaro_demo_sites')
        .update({ public_status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', demo.id)

      results.push({
        id: demo.id,
        slug: demo.slug,
        business_name: demo.business_name,
        vercel_deleted: vercelDeleted,
        vercel_error: vercelError,
        row_updated: !upErr,
        update_error: upErr?.message ?? null,
      })
    }

    console.log(`[demo-expiry-cleanup] expired ${results.length} demo(s)`)

    return new Response(
      JSON.stringify({ success: true, expired_count: results.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[demo-expiry-cleanup] fatal', message)
    return new Response(JSON.stringify({ success: false, error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
