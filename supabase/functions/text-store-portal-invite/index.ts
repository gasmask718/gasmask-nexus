import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendSms } from '../_shared/sendSms.ts'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
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

    const { store_id } = await req.json()
    if (!store_id || typeof store_id !== 'string') return json({ error: 'store_id is required' }, 400)

    // Authorization: staff/admin, or the ambassador who can see this store.
    const [{ data: isStaff }, { data: isAmb }] = await Promise.all([
      supabase.rpc('is_staff', { _user_id: userId }),
      supabase.rpc('ambassador_has_store_access', { _user_id: userId, _store_id: store_id }),
    ])
    if (!isStaff && !isAmb) return json({ error: 'Not authorized for this store' }, 403)

    // Load the store.
    const { data: store, error: storeError } = await supabase
      .from('store_master')
      .select('id, store_name, address, city, state, zip, business_id, deleted_at, is_portal_test')
      .eq('id', store_id)
      .maybeSingle()
    if (storeError || !store || store.deleted_at) return json({ error: 'Store not found' }, 404)

    // Launch lock: while the portal is not live, only test stores may be texted. Fail closed.
    const { data: live, error: liveError } = await supabase.rpc('store_portal_is_live')
    if (liveError) return json({ error: 'Could not read portal launch setting' }, 500)
    if (live !== true && store.is_portal_test !== true) {
      return json({ error: 'Portal not live yet' }, 403)
    }


    // Primary SMS-capable contact (fail closed if none).
    const { data: contact } = await supabase
      .from('store_contacts')
      .select('id, name, phone')
      .eq('store_id', store_id)
      .eq('is_primary', true)
      .eq('can_receive_sms', true)
      .is('deleted_at', null)
      .or('opted_out.is.null,opted_out.eq.false')
      .not('phone', 'is', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (!contact?.phone) {
      return json({ error: 'No SMS-capable primary contact on this store. Add one first.' }, 400)
    }

    // Create the invite (raw token is only ever sent by text, never stored).
    const rawToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    const tokenHash = await sha256Hex(rawToken)

    const { data: invite, error: inviteError } = await supabase
      .from('portal_invites')
      .insert({
        token_hash: tokenHash,
        role: 'store',
        phone: contact.phone,
        store_id,
        created_by: userId,
        max_uses: 1,
        metadata: { contact_id: contact.id, contact_name: contact.name, source: 'text-store-portal-invite' },
      })
      .select('id, expires_at')
      .single()
    if (inviteError || !invite) {
      console.error('invite insert failed:', inviteError)
      return json({ error: 'Could not create the invite' }, 500)
    }

    const baseUrl = (Deno.env.get('APP_PUBLIC_URL') || Deno.env.get('FRONTEND_BASE_URL') || '').replace(/\/$/, '')
    const link = `${baseUrl}/portal/invite/${rawToken}`
    const message = `GasMask: update your inventory or schedule your next delivery here: ${link} - Ching`

    const sms = await sendSms({
      to: contact.phone,
      body: message,
      idempotencyKey: `store-portal-invite-${invite.id}`,
      sendClass: 'transactional',
      storeId: store_id,
      purpose: 'store_portal_invite',
      skipCooldown: true,
    })

    // Log to the store's call/text history with the real delivery outcome.
    const { error: logError } = await supabase.from('communication_logs').insert({
      store_id,
      channel: 'sms',
      direction: 'outbound',
      summary: 'Store portal sign-in link texted',
      message_content: message,
      full_message: message,
      recipient_phone: contact.phone,
      delivery_status: sms.success ? 'sent' : 'failed',
      provider_message_id: sms.providerMessageId,
      error_code: sms.errorCode,
      error_message: sms.errorMessage,
      idempotency_key: `store-portal-invite-${invite.id}`,
      source_table: 'portal_invites',
      source_id: invite.id,
      created_by: userId,
      business_id: store.business_id,
    })
    if (logError) console.error('communication_logs insert failed:', logError)

    return json({
      success: sms.success,
      invite_id: invite.id,
      expires_at: invite.expires_at,
      phone: contact.phone,
      contact_name: contact.name,
      link,
      sms_status: sms.status,
      error: sms.success ? undefined : (sms.errorMessage || 'Text failed to send'),
    })
  } catch (err) {
    console.error('text-store-portal-invite error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
