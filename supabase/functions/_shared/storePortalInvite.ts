import { sendSms } from './sendSms.ts';

/** One portal-invite sender for staff taps and signed inbound confirmations. */
export async function sendVerifiedStorePortalInvite(sb: any, storeId: string, contactId: string, actor: string | null, auto = false) {
  const { data: claim, error } = await sb.rpc('contact_verification_claim_link', {
    p_store_id: storeId, p_contact_id: contactId, p_actor: actor, p_auto: auto,
  });
  if (error) throw new Error(error.message);
  if (claim?.status !== 'claimed') return { success: false, status: claim?.status, already_attempted: claim?.already_attempted, error: claim?.error || (claim?.status === 'ready_locked' ? 'Portal not live yet — ready to send link' : undefined) };
  const finish = async (patch: Record<string, unknown>) => {
    const { error: e } = await sb.from('store_contacts').update(patch).eq('id', contactId);
    if (e) throw new Error(e.message);
  };
  try {
    const rawToken = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('');
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawToken));
    const tokenHash = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    const { data: invite, error: insertError } = await sb.from('portal_invites').insert({
      token_hash: tokenHash, role: 'store', phone: claim.phone, store_id: storeId, created_by: claim.actor, max_uses: 1,
      metadata: { contact_id: contactId, contact_name: claim.name, source: 'text-store-portal-invite', verification_attempt_id: claim.attempt_id },
    }).select('id,expires_at').single();
    if (insertError || !invite) throw new Error(insertError?.message || 'Invite creation failed');
    await finish({ portal_link_invite_id: invite.id });
    const base = (Deno.env.get('APP_PUBLIC_URL') || Deno.env.get('FRONTEND_BASE_URL') || 'https://app.gasmaskapproved.com').replace(/\/$/, '');
    const link = `${base}/portal/invite/${rawToken}`;
    const body = `GasMask: update your inventory or schedule your next delivery here: ${link} - Ching`;
    const sms = await sendSms({ to: claim.phone, body, idempotencyKey: `store-portal-contact-${claim.attempt_id}`, sendClass: 'transactional', storeId, purpose: 'store_portal_invite', skipCooldown: true, metadata: { contact_id: contactId, verification_attempt_id: claim.attempt_id } });
    const { error: logError } = await sb.from('communication_logs').upsert({
      store_id: storeId, contact_id: contactId, channel: 'sms', direction: 'outbound', summary: 'Verified contact portal invite attempt', message_content: body, full_message: body,
      recipient_phone: claim.phone, delivery_status: sms.success ? 'sent' : 'failed', provider_message_id: sms.providerMessageId, twilio_sid: sms.providerMessageId,
      error_code: sms.errorCode, error_message: sms.errorMessage, idempotency_key: `store-portal-contact-${claim.attempt_id}`, source_table: 'portal_invites', source_id: invite.id, created_by: claim.actor, business_id: claim.business_id,
    }, { onConflict: 'idempotency_key' });
    if (logError) throw new Error(logError.message);
    await finish({ portal_link_status: sms.success ? 'sent' : sms.blocked ? 'blocked' : 'failed', portal_link_error: sms.errorMessage });
    return { success: sms.success, status: sms.status, invite_id: invite.id, expires_at: invite.expires_at, error: sms.errorMessage, error_code: sms.errorCode };
  } catch (e) {
    await finish({ portal_link_status: 'failed', portal_link_error: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}
