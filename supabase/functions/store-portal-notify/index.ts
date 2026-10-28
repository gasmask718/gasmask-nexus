import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendSms } from '../_shared/sendSms.ts'

// Texts for delivery-request lifecycle events:
//   created   -> admin (David) + the store's assigned ambassador
//   scheduled -> the store's primary contact (confirmation)
//   delivered -> the store's primary contact (confirmation)
// Recipients differ per event — one call per audience, per the send-helper rule.

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type Item = { name?: string; quantity?: number; unit?: string }

function itemsSummary(items: unknown): string {
  if (!Array.isArray(items)) return ''
  return (items as Item[])
    .map((i) => `${i.quantity ?? 1} x ${i.name ?? 'item'}${i.unit ? ` (${i.unit})` : ''}`)
    .join(', ')
}

function whenSummary(r: { request_type: string; requested_date: string | null; time_window: string | null }): string {
  if (r.request_type === 'asap') return 'as soon as possible'
  return `${r.requested_date}${r.time_window ? ` (${r.time_window})` : ''}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: claims, error: claimsError } = await anonClient.auth.getClaims(
      authHeader.replace('Bearer ', ''),
    )
    if (claimsError || !claims?.claims?.sub) return json({ error: 'Invalid session' }, 401)
    const userId = claims.claims.sub as string

    const { request_id, event } = await req.json()
    if (!request_id || typeof request_id !== 'string') return json({ error: 'request_id is required' }, 400)
    if (!['created', 'scheduled', 'delivered'].includes(event)) return json({ error: 'Invalid event' }, 400)

    const { data: request, error: reqError } = await supabase
      .from('delivery_requests')
      .select('id, store_id, requested_by, request_type, requested_date, time_window, items, notes, status')
      .eq('id', request_id)
      .maybeSingle()
    if (reqError || !request) return json({ error: 'Request not found' }, 404)

    // Caller must be the requesting store user, staff, or the store's ambassador.
    const [{ data: isStaff }, { data: isAmb }, { data: isStoreUser }] = await Promise.all([
      supabase.rpc('is_staff', { _user_id: userId }),
      supabase.rpc('ambassador_has_store_access', { _user_id: userId, _store_id: request.store_id }),
      supabase.rpc('is_store_user_for', { _user_id: userId, _store_id: request.store_id }),
    ])
    if (event === 'created') {
      if (!isStoreUser && !isStaff && !isAmb) return json({ error: 'Not authorized' }, 403)
    } else {
      if (!isStaff && !isAmb) return json({ error: 'Not authorized' }, 403)
    }

    const { data: store } = await supabase
      .from('store_master')
      .select('id, store_name, address, city, state, zip, business_id, assigned_ambassador_id')
      .eq('id', request.store_id)
      .maybeSingle()
    if (!store) return json({ error: 'Store not found' }, 404)

    const storeLabel = `${store.store_name}, ${store.address}${store.city ? `, ${store.city}` : ''}`
    const sent: { to: string; ok: boolean; status: string }[] = []

    async function textStoreContact(body: string, keySuffix: string) {
      const { data: contact } = await supabase
        .from('store_contacts')
        .select('phone')
        .eq('store_id', store.id)
        .eq('is_primary', true)
        .eq('can_receive_sms', true)
        .is('deleted_at', null)
        .or('opted_out.is.null,opted_out.eq.false')
        .not('phone', 'is', null)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (!contact?.phone) return
      const sms = await sendSms({
        to: contact.phone,
        body,
        idempotencyKey: `store-portal-notify-${request.id}-${keySuffix}`,
        sendClass: 'transactional',
        storeId: store.id,
        purpose: 'store_portal_delivery',
        skipCooldown: true,
      })
      sent.push({ to: contact.phone, ok: sms.success, status: sms.status })
      const { error: logError } = await supabase.from('communication_logs').insert({
        store_id: store.id,
        channel: 'sms',
        direction: 'outbound',
        summary: `Delivery request ${event}`,
        message_content: body,
        full_message: body,
        recipient_phone: contact.phone,
        delivery_status: sms.success ? 'sent' : 'failed',
        provider_message_id: sms.providerMessageId,
        error_code: sms.errorCode,
        error_message: sms.errorMessage,
        idempotency_key: `store-portal-notify-${request.id}-${keySuffix}`,
        source_table: 'delivery_requests',
        source_id: request.id,
        created_by: userId,
        business_id: store.business_id,
      })
      if (logError) console.error('communication_logs insert failed:', logError)
    }

    if (event === 'created') {
      const body = `Delivery request: ${storeLabel}. Items: ${itemsSummary(request.items)}. Wanted: ${whenSummary(request)}.${request.notes ? ` Note: ${request.notes}` : ''} - GasMask portal`
      const recipients: string[] = []
      const adminPhone = Deno.env.get('DAVID_PHONE_NUMBER') || Deno.env.get('ADMIN_ALERT_PHONE') || ''
      if (adminPhone) recipients.push(adminPhone)
      if (store.assigned_ambassador_id) {
        const { data: amb } = await supabase
          .from('ambassadors')
          .select('phone_primary, personal_phone')
          .eq('id', store.assigned_ambassador_id)
          .is('deleted_at', null)
          .maybeSingle()
        const ambPhone = amb?.phone_primary || amb?.personal_phone
        if (ambPhone && !recipients.includes(ambPhone)) recipients.push(ambPhone)
      }
      for (const to of recipients) {
        const sms = await sendSms({
          to,
          body,
          idempotencyKey: `store-portal-notify-${request.id}-created-${to.replace(/\D/g, '').slice(-10)}`,
          sendClass: 'transactional',
          storeId: store.id,
          purpose: 'store_portal_delivery',
          skipCooldown: true,
        })
        sent.push({ to, ok: sms.success, status: sms.status })
        const { error: logError } = await supabase.from('communication_logs').insert({
          store_id: store.id,
          channel: 'sms',
          direction: 'outbound',
          summary: 'Delivery request created (staff notification)',
          message_content: body,
          full_message: body,
          recipient_phone: to,
          delivery_status: sms.success ? 'sent' : 'failed',
          provider_message_id: sms.providerMessageId,
          error_code: sms.errorCode,
          error_message: sms.errorMessage,
          idempotency_key: `store-portal-notify-${request.id}-created-${to.replace(/\D/g, '').slice(-10)}`,
          source_table: 'delivery_requests',
          source_id: request.id,
          created_by: userId,
          business_id: store.business_id,
        })
        if (logError) console.error('communication_logs insert failed:', logError)
      }
    } else if (event === 'scheduled') {
      await textStoreContact(
        `GasMask: your delivery is scheduled for ${whenSummary(request)}. Items: ${itemsSummary(request.items)}. - Ching`,
        'scheduled',
      )
    } else {
      await textStoreContact(
        `GasMask: your delivery was marked delivered. Thank you! - Ching`,
        'delivered',
      )
    }

    return json({ success: true, sent })
  } catch (err) {
    console.error('store-portal-notify error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
