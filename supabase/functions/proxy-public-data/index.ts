import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PUBLIC_URL = 'https://hruhkyvwtfpfviwnvhne.supabase.co'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { table, select, filters, order, limit } = await req.json()

    const serviceKey = Deno.env.get('PUBLIC_SITE_SERVICE_ROLE_KEY')
    const key = serviceKey || Deno.env.get('PUBLIC_SITE_ANON_KEY') ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhydWhreXZ3dGZwZnZpd252aG5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMTM3MzAsImV4cCI6MjA3NzY4OTczMH0.XqD-w-e-tOYnF87rpxvspwdyhk63hBm4WNErwpXq5iE'

    let url = `${PUBLIC_URL}/rest/v1/${table}?select=${select || '*'}`
    if (filters) Object.entries(filters).forEach(([k, v]) => url += `&${k}=${v}`)
    if (order) url += `&order=${order}`
    if (limit) url += `&limit=${limit}`

    const res = await fetch(url, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      }
    })

    const data = await res.json()
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
