import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const JURISDICTIONS = new Set([
  'FL','TX','GA','NJ','NY','IL','MN','PA','KY','WV','DC','AZ','NV','OH','SC','MI','MO','TN','MS','CA','CO','MD',
])
const TIERS = new Set(['A1', 'A2', 'A3'])
const STAGES = new Set(['identified','bar_verified','conflict_checked','recruited','retainer_signed','active'])

const BATCH_SIZE = 200

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else quoted = false
      } else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (c !== '\r') field += c
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  if (!rows.length) return []
  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'))
  return rows.slice(1)
    .filter((r) => r.some((v) => v.trim() !== ''))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
    const { data: userData } = await userClient.auth.getUser()
    const user = userData?.user
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', user.id)
    const allowed = (roles ?? []).some((r: { role: string }) =>
      ['owner', 'admin', 'employee', 'staff'].includes(r.role))
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { csv, source } = await req.json()
    if (typeof csv !== 'string' || !csv.trim()) {
      return new Response(JSON.stringify({ error: 'csv (string) is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const parsed = parseCsv(csv)
    const rows: Record<string, unknown>[] = []
    const errors: string[] = []

    parsed.forEach((r, idx) => {
      const line = idx + 2
      const name = r.attorney_name || r.name || ''
      const jurisdiction = (r.jurisdiction || r.state || '').toUpperCase()
      if (!name) { errors.push(`Line ${line}: missing attorney_name`); return }
      if (!JURISDICTIONS.has(jurisdiction)) {
        errors.push(`Line ${line}: jurisdiction "${jurisdiction}" is not one of the 22 states`); return
      }
      const tier = (r.priority_tier || '').toUpperCase()
      if (tier && !TIERS.has(tier)) { errors.push(`Line ${line}: priority_tier "${tier}" invalid`); return }
      const stage = (r.stage || 'identified').toLowerCase()
      if (!STAGES.has(stage)) { errors.push(`Line ${line}: stage "${stage}" invalid`); return }

      rows.push({
        attorney_name: name,
        firm: r.firm || null,
        jurisdiction,
        priority_tier: tier || null,
        stage,
        next_action: r.next_action || null,
        phone: r.phone || null,
        email: r.email || null,
        source: r.source || source || 'csv_import',
        source_ref: r.source_ref || null,
        notes: r.notes || null,
      })
    })

    let inserted = 0
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE)
      const { error } = await admin.from('sf_recruiting_queue').insert(batch)
      if (error) {
        errors.push(`Batch starting at row ${i + 1}: ${error.message}`)
      } else {
        inserted += batch.length
      }
    }

    return new Response(JSON.stringify({
      success: true, parsed: parsed.length, inserted, skipped: parsed.length - inserted, errors: errors.slice(0, 50),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('sf-recruiting-import error:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
