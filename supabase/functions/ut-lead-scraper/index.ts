
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { errText } from "../_shared/errText.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-shared-secret',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const { source, query, city, state, lead_type } = await req.json()

    if (!source || !query) {
      return new Response(
        JSON.stringify({ error: 'source and query are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Log automation run
    const { data: run } = await supabase
      .from('ut_automation_runs')
      .insert({ run_type: 'lead_scrape', source, status: 'running' })
      .select().single()

    let leads: any[] = []

    if (source === 'outscraper') {
      const apiKey = Deno.env.get('OUTSCRAPER_API_KEY')
      if (!apiKey) throw new Error('OUTSCRAPER_API_KEY not configured. Connect Outscraper in Lead Intelligence.')

      const response = await fetch(
        `https://api.app.outscraper.com/maps/search-v3?query=${encodeURIComponent(query + ' ' + city + ' ' + state)}&limit=100&async=false`,
        { headers: { 'X-API-KEY': apiKey } }
      )
      const data = await response.json()
      leads = (data.data?.[0] || []).map((item: any) => ({
        source: 'outscraper',
        lead_type: lead_type || 'venue',
        business_name: item.name,
        phone: item.phone,
        address: item.full_address,
        city: item.city || city,
        state: item.state || state,
        website: item.site,
        google_rating: item.rating,
        google_reviews: item.reviews,
        status: 'new'
      }))
    }

    if (source === 'apollo') {
      const apiKey = Deno.env.get('APOLLO_API_KEY')
      if (!apiKey) throw new Error('APOLLO_API_KEY not configured. Connect Apollo in Lead Intelligence.')

      const response = await fetch('https://api.apollo.io/v1/mixed_people/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({
          q_keywords: query,
          q_city: city,
          q_state: state,
          per_page: 100
        })
      })
      const data = await response.json()
      leads = (data.people || []).map((person: any) => ({
        source: 'apollo',
        lead_type: lead_type || 'partner',
        contact_name: `${person.first_name} ${person.last_name}`,
        email: person.email,
        phone: person.phone_numbers?.[0]?.sanitized_number,
        business_name: person.organization?.name,
        city, state,
        linkedin_url: person.linkedin_url,
        status: 'new'
      }))
    }

    if (source === 'phantombuster') {
      const apiKey = Deno.env.get('PHANTOMBUSTER_API_KEY')
      if (!apiKey) throw new Error('PHANTOMBUSTER_API_KEY not configured. Connect PhantomBuster in Lead Intelligence.')

      const agentId = Deno.env.get('PHANTOMBUSTER_AGENT_ID')
      const response = await fetch('https://api.phantombuster.com/api/v2/agents/launch', {
        method: 'POST',
        headers: { 'X-Phantombuster-Key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: agentId,
          argument: { hashtag: query, numberOfProfiles: 100 }
        })
      })
      const data = await response.json()
      leads = (data.output || []).map((profile: any) => ({
        source: 'phantombuster',
        lead_type: 'ambassador',
        contact_name: profile.fullName,
        instagram_handle: profile.username,
        followers_count: profile.followersCount,
        engagement_rate: profile.engagementRate,
        city, state,
        status: 'new'
      }))
    }

    // Insert leads
    if (leads.length > 0) {
      const { error: insertError } = await supabase
        .from('ut_leads')
        .insert(leads)
      if (insertError) console.error('Insert error:', insertError)
    }

    // Update run record
    if (run?.id) {
      await supabase
        .from('ut_automation_runs')
        .update({
          status: 'completed',
          leads_found: leads.length,
          leads_graded: leads.filter((l: any) => l.grade).length,
          completed_at: new Date().toISOString(),
          summary: `Found ${leads.length} leads from ${source}`
        })
        .eq('id', run.id)
    }

    // Update lead source stats
    await supabase
      .from('ut_lead_sources')
      .update({
        last_run_at: new Date().toISOString(),
        last_run_count: leads.length
      })
      .eq('source_name', source)

    return new Response(
      JSON.stringify({ success: true, leads_found: leads.length, run_id: run?.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Lead scraper error:', errText(err))
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
