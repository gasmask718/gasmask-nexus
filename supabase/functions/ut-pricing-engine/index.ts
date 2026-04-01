import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TIER_RATES: Record<string, number> = {
  starter: 10,
  silver: 12,
  gold: 15,
  platinum: 17,
  legend: 20
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const body = await req.json()
  const { action } = body

  if (action === 'build_package') {
    const { items, package_name, event_type, city, state, description } = body

    let totalVendorCost = 0
    let totalCustomerPrice = 0
    let totalProfit = 0

    const enrichedItems = items.map((item: any) => {
      const vendorCost = Number(item.base_cost) * (item.quantity || 1)
      const markupPct = item.vendor_type === 'venue' ? 40 : 50
      const customerPrice = vendorCost * (1 + markupPct / 100)
      const profit = customerPrice - vendorCost

      totalVendorCost += vendorCost
      totalCustomerPrice += customerPrice
      totalProfit += profit

      return { ...item, vendor_cost: vendorCost, markup_percent: markupPct, customer_price: customerPrice, our_profit: profit }
    })

    const marginPercent = totalCustomerPrice > 0 ? (totalProfit / totalCustomerPrice) * 100 : 0

    const commissions: Record<string, number> = {}
    const netProfits: Record<string, number> = {}

    Object.entries(TIER_RATES).forEach(([tier, rate]) => {
      const commission = totalCustomerPrice * (rate / 100)
      commissions[`ambassador_commission_${tier}`] = commission
      netProfits[`net_profit_${tier}`] = totalProfit - commission
    })

    const { data: pkg, error } = await supabase
      .from('ut_event_packages')
      .insert({
        package_name, event_type, description, city, state,
        items: enrichedItems,
        total_vendor_cost: totalVendorCost,
        total_customer_price: totalCustomerPrice,
        total_our_profit: totalProfit,
        our_margin_percent: marginPercent,
        ...commissions,
        net_profit_starter: netProfits.net_profit_starter,
        net_profit_legend: netProfits.net_profit_legend
      })
      .select()
      .single()

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }

    return new Response(JSON.stringify({
      success: true, package: pkg,
      summary: {
        vendor_cost: totalVendorCost, customer_price: totalCustomerPrice,
        our_profit: totalProfit, margin_percent: marginPercent,
        min_net_profit: netProfits.net_profit_legend, max_net_profit: netProfits.net_profit_starter
      }
    }), { status: 200, headers: corsHeaders })
  }

  if (action === 'generate_quote') {
    const { package_id, customer_name, customer_email, customer_phone,
      event_type, event_date, city, state, guest_count, referral_code,
      custom_items, discount_percent } = body

    const { data: pkg } = await supabase.from('ut_event_packages').select('*').eq('id', package_id).single()

    let ambassador = null
    let commissionRate = 10

    if (referral_code) {
      const { data: amb } = await supabase
        .from('unforgettable_ambassadors')
        .select('id, tier, commission_rate')
        .eq('referral_code', referral_code)
        .single()
      if (amb) { ambassador = amb; commissionRate = amb.commission_rate }
    }

    const subtotal = pkg?.total_customer_price || 0
    const discountAmount = subtotal * ((discount_percent || 0) / 100)
    const totalPrice = subtotal - discountAmount
    const vendorCost = pkg?.total_vendor_cost || 0
    const ourProfit = totalPrice - vendorCost
    const marginPct = totalPrice > 0 ? (ourProfit / totalPrice) * 100 : 0
    const commissionAmount = totalPrice * (commissionRate / 100)
    const netProfit = ourProfit - commissionAmount

    const quoteNumber = `UT-Q-${Date.now()}`
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const { data: quote, error } = await supabase
      .from('ut_quotes')
      .insert({
        quote_number: quoteNumber, customer_name, customer_email, customer_phone,
        event_type, event_date, city, state, guest_count, package_id,
        custom_items: custom_items || [], subtotal,
        discount_percent: discount_percent || 0, discount_amount: discountAmount,
        total_customer_price: totalPrice, total_vendor_cost: vendorCost,
        total_our_profit: ourProfit, our_margin_percent: marginPct,
        referral_code, ambassador_id: ambassador?.id,
        ambassador_commission_rate: commissionRate,
        ambassador_commission_amount: commissionAmount,
        net_profit: netProfit, expires_at: expiresAt.toISOString(), status: 'draft'
      })
      .select()
      .single()

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
    }

    return new Response(JSON.stringify({
      success: true, quote,
      profit_breakdown: {
        customer_pays: totalPrice, vendor_cost: vendorCost, gross_profit: ourProfit,
        margin_percent: marginPct, ambassador_commission: commissionAmount,
        net_profit: netProfit, still_profitable: netProfit > 0
      }
    }), { status: 200, headers: corsHeaders })
  }

  return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: corsHeaders })
})
