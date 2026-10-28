import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendSms } from '../_shared/sendSms.ts'

// Phone one-time-code sign-in for store portal users. The backend's built-in
// phone OTP provider is not configured, so the code goes out through the
// existing send-sms pipeline and the session is minted server-side via an
// admin magic link (no password, no email ever sent).

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

function normalizePhone(p: string): string {
  const digits = p.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return p.startsWith('+') ? p : `+${digits}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { action, token, code } = await req.json()
    if (!token || typeof token !== 'string' || token.length < 32) return json({ error: 'Invalid token' }, 400)
    if (action !== 'send_code' && action !== 'verify_code') return json({ error: 'Invalid action' }, 400)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const tokenHash = await sha256Hex(token)
    const { data: invite } = await supabase
      .from('portal_invites')
      .select('id, role, phone, store_id, status, expires_at, uses, max_uses')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    const inviteUsable = invite
      && invite.role === 'store'
      && invite.status === 'active'
      && new Date(invite.expires_at) > new Date()
      && invite.uses < invite.max_uses
      && invite.phone

    if (!inviteUsable) return json({ error: 'This invite link is no longer active' }, 400)

    if (action === 'send_code') {
      // Rate limit: max 5 codes per invite per hour.
      const { count } = await supabase
        .from('store_portal_codes')
        .select('id', { count: 'exact', head: true })
        .eq('invite_id', invite.id)
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      if ((count ?? 0) >= 5) return json({ error: 'Too many codes requested. Try again later.' }, 429)

      const otp = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0')
      const codeHash = await sha256Hex(`${invite.id}:${otp}`)

      const { error: insertError } = await supabase.from('store_portal_codes').insert({
        invite_id: invite.id,
        phone: invite.phone,
        code_hash: codeHash,
      })
      if (insertError) {
        console.error('code insert failed:', insertError)
        return json({ error: 'Could not create sign-in code' }, 500)
      }

      const sms = await sendSms({
        to: invite.phone,
        body: `Your GasMask portal sign-in code is ${otp}. It expires in 10 minutes. - Ching`,
        idempotencyKey: `store-portal-code-${invite.id}-${codeHash.slice(0, 12)}`,
        sendClass: 'transactional',
        storeId: invite.store_id,
        purpose: 'store_portal_auth',
        skipCooldown: true,
      })
      if (!sms.success) {
        console.error('code sms failed:', sms.status, sms.errorMessage)
        return json({ error: 'Could not text the code. Ask us to re-send your link.' }, 502)
      }
      return json({ sent: true, phone_last4: invite.phone.replace(/\D/g, '').slice(-4) })
    }

    // verify_code
    if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      return json({ error: 'Enter the 6-digit code' }, 400)
    }

    const { data: codeRow } = await supabase
      .from('store_portal_codes')
      .select('id, code_hash, attempts, expires_at, consumed_at')
      .eq('invite_id', invite.id)
      .is('consumed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!codeRow || new Date(codeRow.expires_at) < new Date()) {
      return json({ error: 'Code expired. Request a new one.' }, 400)
    }
    if (codeRow.attempts >= 5) {
      return json({ error: 'Too many attempts. Request a new code.' }, 429)
    }

    const candidateHash = await sha256Hex(`${invite.id}:${code}`)
    if (candidateHash !== codeRow.code_hash) {
      await supabase.from('store_portal_codes').update({ attempts: codeRow.attempts + 1 }).eq('id', codeRow.id)
      return json({ error: 'Wrong code. Try again.' }, 400)
    }
    await supabase.from('store_portal_codes').update({ consumed_at: new Date().toISOString() }).eq('id', codeRow.id)

    // Find or create the auth user for this phone (synthetic email, never mailed).
    const phoneE164 = normalizePhone(invite.phone)
    const last10 = phoneE164.replace(/\D/g, '').slice(-10)
    const email = `store-${last10}@portal.gasmaskapproved.com`

    let userId: string | null = null
    const { data: existingId } = await supabase.rpc('auth_user_id_by_email', { _email: email })
    if (existingId) {
      userId = existingId as string
    } else {
      let storeName = 'Store'
      if (invite.store_id) {
        const { data: sm } = await supabase.from('store_master').select('store_name').eq('id', invite.store_id).maybeSingle()
        if (sm?.store_name) storeName = sm.store_name
      }
      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        phone: phoneE164,
        phone_confirm: true,
        app_metadata: { provisioned_role: 'store' },
        user_metadata: { name: storeName },
      })
      if (createError || !created.user) {
        console.error('createUser failed:', createError)
        return json({ error: 'Could not create your sign-in. Ask us to re-send your link.' }, 500)
      }
      userId = created.user.id
    }

    // Mint a session: admin magic link -> client verifies the token hash.
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })
    const hashedToken = linkData?.properties?.hashed_token
    if (linkError || !hashedToken) {
      console.error('generateLink failed:', linkError)
      return json({ error: 'Could not sign you in. Try again.' }, 500)
    }

    return json({ verified: true, token_hash: hashedToken, email })
  } catch (err) {
    console.error('store-portal-auth error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
