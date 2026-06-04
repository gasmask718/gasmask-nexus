// Cart-recovery cron: drafts personalized recovery messages to notification_queue (status='queued').
// Runs every 15 min. A separate sender drains the queue when Resend/Twilio keys land.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

type CartEvent = {
  id: string;
  email: string | null;
  user_id: string | null;
  visitor_id: string | null;
  event_type: string;
  items: any[];
  cart_total: number;
  created_at: string;
};

function ageWindow(createdAt: string): '1h' | '24h' | null {
  const ageMin = (Date.now() - new Date(createdAt).getTime()) / 60_000;
  if (ageMin >= 50 && ageMin <= 70) return '1h';
  if (ageMin >= 23 * 60 && ageMin <= 25 * 60) return '24h';
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // 1. Pull recent item_added events with an email, last 30h
  const since = new Date(Date.now() - 30 * 60 * 60_000).toISOString();
  const { data: events } = await admin
    .from('cart_events')
    .select('id, email, user_id, visitor_id, event_type, items, cart_total, created_at')
    .gte('created_at', since)
    .not('email', 'is', null)
    .order('created_at', { ascending: false });

  const e = (events ?? []) as CartEvent[];
  const drafted: any[] = [];
  const skipped: any[] = [];

  // group by (email, user_id||visitor_id)
  const groups = new Map<string, CartEvent[]>();
  for (const ev of e) {
    const k = `${ev.email}::${ev.user_id ?? ev.visitor_id ?? 'unknown'}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(ev);
  }

  for (const [key, evs] of groups) {
    const latestAdded = evs.find((x) => x.event_type === 'item_added');
    if (!latestAdded) continue;

    const window = ageWindow(latestAdded.created_at);
    if (!window) { skipped.push({ key, reason: 'outside_window' }); continue; }

    // checkout_started after the add → not abandoned
    const co = evs.find((x) => x.event_type === 'checkout_started' && x.created_at > latestAdded.created_at);
    if (co) { skipped.push({ key, reason: 'checkout_started' }); continue; }

    // hard opt-out
    const optedOut = evs.find((x) => x.event_type === 'opted_out');
    if (optedOut) { skipped.push({ key, reason: 'opted_out' }); continue; }

    // already queued for this cart event?
    const { count: already } = await admin
      .from('notification_queue')
      .select('id', { count: 'exact', head: true })
      .eq('related_kind', 'cart_recovery')
      .eq('related_id', latestAdded.id);
    if ((already ?? 0) > 0) { skipped.push({ key, reason: 'already_queued' }); continue; }

    // Draft via Gemini
    const itemList = (latestAdded.items ?? [])
      .map((i: any) => `- ${i.title ?? i.product_id} x${i.qty} ($${Number(i.price_each ?? 0).toFixed(2)})`)
      .join('\n');
    const prompt = `Draft a short ${window === '1h' ? 'gentle nudge' : 'last-chance'} cart-recovery email.\nCart items:\n${itemList}\nCart total: $${Number(latestAdded.cart_total).toFixed(2)}\n\nRules: under 70 words, plain voice (Aesop x Allbirds), one CTA "Finish your order", no exclamation marks. Return JSON: {"subject":"...","body":"..."}`;

    let subject = window === '1h' ? 'Still thinking it over?' : 'Your cart is about to expire';
    let body = `You left ${(latestAdded.items ?? []).length} item(s) behind. Finish your order anytime.`;
    try {
      const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
        }),
      });
      if (aiRes.ok) {
        const ai = await aiRes.json();
        const parsed = JSON.parse(ai?.choices?.[0]?.message?.content ?? '{}');
        if (parsed.subject) subject = parsed.subject;
        if (parsed.body) body = parsed.body;
      }
    } catch (_) { /* fall through to template */ }

    const { error } = await admin.from('notification_queue').insert({
      status: 'queued',
      channel: 'email',
      provider: 'resend',
      recipient: latestAdded.email!,
      subject,
      payload: { body, items: latestAdded.items, cart_total: latestAdded.cart_total, window, ai_generated: true },
      related_kind: 'cart_recovery',
      related_id: latestAdded.id,
    });
    if (error) { skipped.push({ key, reason: 'insert_failed', error: error.message }); continue; }
    drafted.push({ key, window, subject });
  }

  return new Response(JSON.stringify({ drafted: drafted.length, skipped: skipped.length, detail: { drafted, skipped } }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
