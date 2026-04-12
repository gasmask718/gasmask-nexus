import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-bridge-secret',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const bridgeSecret = req.headers.get('x-admin-bridge-secret')
    const expectedSecret = Deno.env.get('ADMIN_BRIDGE_SECRET')

    if (!expectedSecret || bridgeSecret !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    return new Response(
      JSON.stringify({
        success: true,
        supabase_url: supabaseUrl,
        anon_key: anonKey,
        whitelisted_tables: [
          'tt_partners',
          'tt_vehicles', 
          'tt_payouts',
          'tt_commissions',
          'tt_bookings',
          'tt_dispatches',
          'tt_drivers',
          'tt_pricing_rules',
          'tt_customer_reviews',
          'tt_corporate_accounts',
          'tt_notifications_log',
        ],
        rest_endpoint: `${supabaseUrl}/rest/v1/`,
        instructions: 'Use anon_key as apikey header + Bearer token. RLS applies. For service-level access, use your own service_role key.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
