import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    // Get yesterday's bookings
    const { data: bookings } = await supabase
      .from('tt_bookings')
      .select('total_price,status,payment_status')
      .gte('created_at', yStr)
      .lt('created_at', today);

    const totalBookings = bookings?.length || 0;
    const paidRevenue = (bookings || [])
      .filter(b => b.payment_status === 'paid')
      .reduce((s, b) => s + Number(b.total_price), 0);
    const completed = (bookings || []).filter(b => b.status === 'completed').length;
    const cancelled = (bookings || []).filter(b => b.status === 'cancelled').length;

    // Active drivers
    const { count: activeDrivers } = await supabase
      .from('tt_drivers')
      .select('id', { count: 'exact', head: true })
      .in('status', ['available', 'on_assignment']);

    // Avg rating yesterday
    const { data: reviews } = await supabase
      .from('tt_customer_reviews')
      .select('rating')
      .gte('created_at', yStr)
      .lt('created_at', today);

    const avgRating = reviews?.length
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : 'N/A';

    const dateStr = yesterday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const smsBody = `TT Daily Report ${dateStr}: ${totalBookings} bookings | $${paidRevenue.toLocaleString()} revenue | ${completed} completed | ${cancelled} cancelled | ${activeDrivers || 0} active drivers | ⭐${avgRating} avg rating`;

    // Internal ops alert (Group A): email-first, SMS only as escalation.
    await sendOpsAlert({
      source: "tt-nightly-report",
      severity: "info",
      subject: `TopTier daily report ${dateStr}`,
      message: smsBody,
      context: { totalBookings, paidRevenue, completed, cancelled, activeDrivers, avgRating },
    });

    return new Response(JSON.stringify({ success: true, report: smsBody }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('tt-nightly-report error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
