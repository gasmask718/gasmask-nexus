import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

// Tables actually read by the 9 TopTier call sites. Nothing else is proxied.
const ALLOWED_TABLES = new Set([
  'promo_codes',
  'commission_rates',
  'commissions',
  'affiliates',
  'affiliate_applications',
  'affiliate_commissions',
  'partner_earnings',
  'payments',
  'partners',
  'bookings',
  'service_packages',
  'packages',
  'add_on_packages',
  'add_ons',
])

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // --- Auth: reject anonymous ---
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(
      authHeader.replace('Bearer ', ''),
    )
    if (claimsError || !claimsData?.claims?.sub) return json({ error: 'Unauthorized' }, 401)

    const { table, select, filters, order, limit } = await req.json()

    if (typeof table !== 'string' || !ALLOWED_TABLES.has(table)) {
      return json({ error: 'Table not allowed' }, 403)
    }

    const publicUrl = Deno.env.get('PUBLIC_SITE_URL')
    const key =
      Deno.env.get('PUBLIC_SITE_SERVICE_ROLE_KEY') || Deno.env.get('PUBLIC_SITE_ANON_KEY')
    if (!publicUrl || !key) return json({ error: 'Public site proxy not configured' }, 503)

    let url = `${publicUrl.replace(/\/$/, '')}/rest/v1/${table}?select=${encodeURIComponent(select || '*')}`
    if (filters && typeof filters === 'object') {
      for (const [k, v] of Object.entries(filters as Record<string, string>)) {
        url += `&${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`
      }
    }
    if (order) url += `&order=${encodeURIComponent(String(order))}`
    if (limit) url += `&limit=${encodeURIComponent(String(limit))}`

    const res = await fetch(url, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
    })

    return json(await res.json(), res.ok ? 200 : res.status)
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
