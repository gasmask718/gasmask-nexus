import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@3.23.8'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const str = (max: number) => z.string().trim().max(max)

const BodySchema = z.object({
  full_name: str(120).min(2),
  email: z.string().trim().email().max(255).optional().or(z.literal('')),
  phone: str(40).optional(),
  category_slug: str(80).optional(),
  role_id: z.string().uuid().optional(),
  role_slug: str(80).optional(),
  business_slug: str(80).optional(),
  city: str(120).optional(),
  state: str(60).optional(),
  country: str(60).optional(),
  experience_summary: str(4000).optional(),
  qualifications: str(4000).optional(),
  license_info: str(1000).optional(),
  availability_summary: str(1000).optional(),
  notes: str(2000).optional(),
  campaign_code: str(80).optional(),
  source_platform: str(80).optional(),
  source_ad_id: str(120).optional(),
  // spam honeypot – must stay empty
  company_website: z.string().max(200).optional(),
})

async function hashIp(ip: string) {
  const data = new TextEncoder().encode(`recruiting-apply:${ip}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url)
      if (url.searchParams.get('taxonomy') !== '1') return json({ error: 'not found' }, 404)
      const [cats, roles] = await Promise.all([
        admin.from('recruiting_categories').select('id,slug,name,sort_order').eq('is_active', true).order('sort_order'),
        admin.from('recruiting_roles').select('id,category_id,slug,name,requires_license,sort_order').eq('is_active', true).order('sort_order'),
      ])
      if (cats.error) throw cats.error
      if (roles.error) throw roles.error
      return json({ categories: cats.data, roles: roles.data })
    }

    if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

    const raw = await req.json().catch(() => null)
    const parsed = BodySchema.safeParse(raw)
    if (!parsed.success) {
      return json({ error: 'validation_failed', fields: parsed.error.flatten().fieldErrors }, 400)
    }
    const b = parsed.data

    // honeypot: silently accept, write nothing
    if (b.company_website && b.company_website.trim() !== '') {
      return json({ ok: true, applicant_created: false, application_created: false })
    }

    const email = b.email?.trim() || null
    const phoneDigits = (b.phone || '').replace(/\D/g, '')
    if (!email && phoneDigits.length < 10) {
      return json({ error: 'validation_failed', fields: { email: ['Provide an email or a valid phone number'] } }, 400)
    }
    if (!b.role_id && !(b.category_slug && b.role_slug) && !b.category_slug) {
      return json({ error: 'validation_failed', fields: { role_id: ['Select a role'] } }, 400)
    }

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('cf-connecting-ip') ||
      'unknown'
    const ipHash = await hashIp(ip)

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count } = await admin
      .from('recruiting_intake_events')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', since)
    if ((count ?? 0) >= 10) {
      await admin.from('recruiting_intake_events').insert({ ip_hash: ipHash, outcome: 'rate_limited' })
      return json({ error: 'rate_limited', message: 'Too many submissions. Please try again later.' }, 429)
    }

    const payload: Record<string, unknown> = {
      full_name: b.full_name,
      email,
      phone: b.phone || null,
      city: b.city || null,
      state: b.state || null,
      country: b.country || null,
      experience_summary: b.experience_summary || null,
      qualifications: b.qualifications || null,
      license_info: b.license_info || null,
      availability_summary: b.availability_summary || null,
      notes: b.notes || null,
      business_slug: b.business_slug || null,
      source_platform: b.source_platform || 'public_form',
      source_ad_id: b.source_ad_id || null,
    }
    if (b.role_id) payload.role_id = b.role_id
    if (b.role_slug) payload.role_slug = b.role_slug
    if (b.category_slug) payload.category_slug = b.category_slug

    if (b.campaign_code) {
      const { data: camp } = await admin
        .from('recruiting_campaigns')
        .select('id')
        .eq('code', b.campaign_code)
        .maybeSingle()
      if (camp?.id) payload.campaign_id = camp.id
      payload.campaign_code_submitted = b.campaign_code
    }

    const { data, error } = await admin.rpc('ingest_recruiting_applicant', { p_payload: payload })
    if (error) {
      await admin.from('recruiting_intake_events').insert({ ip_hash: ipHash, email_norm: email, outcome: 'error' })
      console.error('ingest failed', error.message)
      return json({ error: 'ingest_failed', message: error.message }, 400)
    }

    await admin.from('recruiting_intake_events').insert({ ip_hash: ipHash, email_norm: email, outcome: 'accepted' })

    return json({ ok: true, ...(data as Record<string, unknown>) })
  } catch (e) {
    console.error('recruiting-apply error', e)
    return json({ error: 'server_error' }, 500)
  }
})
