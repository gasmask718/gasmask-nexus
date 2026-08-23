// Admin-triggered: create a VA invite + dispatch email and/or SMS.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Channel = 'email' | 'sms' | 'both';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return json({ error: 'Missing bearer token' }, 401);
    }

    // Validate the caller is an admin
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) return json({ error: 'Invalid session' }, 401);
    const callerId = userRes.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: roleRow, error: roleErr } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId)
      .eq('role', 'admin')
      .maybeSingle();
    if (roleErr) throw roleErr;
    if (!roleRow) return json({ error: 'Admin role required' }, 403);

    const body = await req.json().catch(() => ({}));
    const email = (body.email ?? '').toString().trim().toLowerCase();
    const company_id = (body.company_id ?? '').toString();
    const role = (body.role ?? 'va').toString();
    const channel = ((body.channel ?? 'email').toString() as Channel);
    const phoneRaw = (body.phone ?? '').toString().trim();

    if (!['email', 'sms', 'both'].includes(channel)) {
      return json({ error: 'invalid_channel' }, 400);
    }
    if (!email || !email.includes('@') || !company_id) {
      return json({ error: 'email and company_id are required' }, 400);
    }
    if ((channel === 'sms' || channel === 'both') && !phoneRaw) {
      return json({ error: 'phone required for sms channel' }, 400);
    }

    // Verify company exists
    const { data: company, error: cErr } = await admin
      .from('va_companies').select('id, name, slug').eq('id', company_id).maybeSingle();
    if (cErr) throw cErr;
    if (!company) return json({ error: 'Company not found' }, 404);

    // If this email already belongs to a user with an ACTIVE membership in
    // THIS company, say so plainly instead of sending a redundant invite.
    // Memberships in OTHER companies are fine — accepting this invite simply
    // adds another membership (accept_va_invite_atomic upserts per company).
    const { data: existingUserId } = await admin.rpc('auth_user_id_by_email', { _email: email });
    if (existingUserId) {
      const { data: existingMembership } = await admin
        .from('va_company_memberships')
        .select('id')
        .eq('user_id', existingUserId)
        .eq('company_id', company_id)
        .eq('is_active', true)
        .maybeSingle();
      if (existingMembership) {
        return json({ error: `${email} is already an active member of ${company.name}` }, 409);
      }
    }

    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');

    const insertPayload: Record<string, unknown> = {
      email, company_id, role, token, invited_by: callerId, channel,
    };
    if (phoneRaw) insertPayload.phone = phoneRaw;

    const { data: invite, error: insErr } = await admin
      .from('va_invites')
      .insert(insertPayload)
      .select('id, token, expires_at')
      .single();

    if (insErr) {
      // Surface the partial-unique violation as a clean error
      if ((insErr as any).code === '23505') {
        return json({ error: 'A pending invite already exists for this email + company' }, 409);
      }
      throw insErr;
    }

    // Log creation
    await admin.rpc('log_va_invite_event', {
      p_invite_id: invite.id,
      p_event_type: 'created',
      p_actor_user_id: callerId,
      p_channel: channel,
      p_metadata: { email_target: email, phone_target: phoneRaw || null },
    });

    const baseUrl = 'https://gasmask-os-nexus.lovable.app';
    const acceptUrl = `${baseUrl}/va/auth?invite=${token}`;

    let emailSent = false;
    let emailError: string | null = null;
    let smsSent = false;
    let smsError: string | null = null;

    // ── EMAIL leg ─────────────────────────────────────────────────────
    if (channel === 'email' || channel === 'both') {
      try {
        const { data: mailData, error: mailErr } = await admin.functions.invoke('va-send-email', {
          body: {
            to: email,
            subject: `You're invited to join ${company.name} as a VA`,
            from_name: company.name,
            html: `
              <div style="font-family:sans-serif;padding:24px;max-width:560px;margin:auto">
                <h2>You've been invited to ${company.name}</h2>
                <p>You've been invited to join <strong>${company.name}</strong> as a Virtual Assistant.</p>
                <p>Click the button below to set up your account. This link expires in 14 days.</p>
                <p><a href="${acceptUrl}" style="display:inline-block;background:#06b6d4;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Accept invite</a></p>
                <p style="color:#64748b;font-size:12px;word-break:break-all">${acceptUrl}</p>
              </div>
            `,
            text: `You've been invited to ${company.name} as a VA. Accept your invite: ${acceptUrl}`,
          },
        });
        if (mailErr) emailError = mailErr.message ?? String(mailErr);
        else if ((mailData as any)?.error) emailError = (mailData as any).error;
        else emailSent = true;
      } catch (e) {
        emailError = (e as Error).message;
      }

      if (emailSent) {
        await admin.from('va_invites')
          .update({ sent_to_email: email })
          .eq('id', invite.id);
        await admin.rpc('log_va_invite_event', {
          p_invite_id: invite.id, p_event_type: 'sent', p_actor_user_id: callerId,
          p_channel: 'email', p_metadata: { to: email },
        });
      } else {
        await admin.rpc('log_va_invite_event', {
          p_invite_id: invite.id, p_event_type: 'send_failed', p_actor_user_id: callerId,
          p_channel: 'email', p_metadata: { to: email, error: emailError },
        });
      }
    }

    // ── SMS leg ───────────────────────────────────────────────────────
    if (channel === 'sms' || channel === 'both') {
      const smsBody =
        `You've been invited to ${company.name} as a VA. ` +
        `Set up your account (link expires in 14 days): ${acceptUrl}`;
      try {
        const { data: smsData, error: smsErr } = await admin.functions.invoke('send-sms', {
          body: { to: phoneRaw, message: smsBody },
        });
        if (smsErr) smsError = smsErr.message ?? String(smsErr);
        else if ((smsData as any)?.error_message) smsError = (smsData as any).error_message;
        else if ((smsData as any)?.success === false) smsError = (smsData as any).error || 'sms_failed';
        else smsSent = true;
      } catch (e) {
        smsError = (e as Error).message;
      }

      if (smsSent) {
        await admin.from('va_invites')
          .update({ sent_to_phone: phoneRaw })
          .eq('id', invite.id);
        await admin.rpc('log_va_invite_event', {
          p_invite_id: invite.id, p_event_type: 'sent', p_actor_user_id: callerId,
          p_channel: 'sms', p_metadata: { to: phoneRaw },
        });
      } else {
        await admin.rpc('log_va_invite_event', {
          p_invite_id: invite.id, p_event_type: 'send_failed', p_actor_user_id: callerId,
          p_channel: 'sms', p_metadata: { to: phoneRaw, error: smsError },
        });
      }
    }

    return json({
      success: true,
      invite_id: invite.id,
      accept_url: acceptUrl,
      expires_at: invite.expires_at,
      channel,
      email_sent: emailSent,
      email_error: emailError,
      sms_sent: smsSent,
      sms_error: smsError,
    });
  } catch (e) {
    console.error('invite-va error', e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
