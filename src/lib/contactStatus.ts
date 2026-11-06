export type BadgeTone = 'done' | 'todo' | 'failed';
export type StatusBadge = { key: string; label: string; tone: BadgeTone; when: string | null };

export type ContactStatusInput = {
  line_type?: string | null; carrier?: string | null; line_checked_on?: string | null;
  status?: string | null; sent_at?: string | null; delivered_at?: string | null; confirmed_at?: string | null; failed_at?: string | null; opted_out?: boolean | null;
  total_calls_answered?: number | null; last_call_answered_at?: string | null;
  total_texts_received?: number | null; last_text_received_at?: string | null;
  saved_our_number?: boolean | null; saved_our_number_at?: string | null;
  link_status?: string | null; link_attempt_at?: string | null; invite_sent_at?: string | null; invite_opened_at?: string | null; invite_consumed_at?: string | null;
};

/** One badge per status the owner asked for. Green = done, grey = not yet, red = failed. */
export function contactBadges(c: ContactStatusInput): StatusBadge[] {
  const checked = !!(c.line_type || c.line_checked_on);
  const badLine = c.line_type === 'invalid' || c.line_type === 'unknown';
  const verify: StatusBadge = c.opted_out ? { key: 'verify', label: 'Opted out', tone: 'failed', when: null }
    : c.status === 'confirmed' && c.confirmed_at ? { key: 'verify', label: 'CONFIRMED', tone: 'done', when: c.confirmed_at }
    : c.status === 'failed' ? { key: 'verify', label: 'Verify text failed', tone: 'failed', when: c.failed_at ?? null }
    : c.status === 'delivered' ? { key: 'verify', label: 'Verify text delivered', tone: 'todo', when: c.delivered_at ?? null }
    : c.status === 'sent' ? { key: 'verify', label: 'Verify text sent', tone: 'todo', when: c.sent_at ?? null }
    : { key: 'verify', label: 'Not verified', tone: 'todo', when: null };
  const invite: StatusBadge = c.invite_consumed_at ? { key: 'invite', label: 'ACCOUNT CREATED', tone: 'done', when: c.invite_consumed_at }
    : c.link_status === 'failed' || c.link_status === 'blocked' ? { key: 'invite', label: 'Invite failed', tone: 'failed', when: c.link_attempt_at ?? null }
    : c.invite_opened_at ? { key: 'invite', label: 'Invite opened', tone: 'todo', when: c.invite_opened_at }
    : c.invite_sent_at || c.link_status === 'sent' || c.link_status === 'sending' || c.link_status === 'queued' ? { key: 'invite', label: 'Invite sent', tone: 'todo', when: c.invite_sent_at ?? c.link_attempt_at ?? null }
    : { key: 'invite', label: 'Invite not sent', tone: 'todo', when: null };
  return [
    { key: 'checked', label: checked ? `Number checked${c.line_type ? ` · ${c.line_type}` : ''}${c.carrier ? ` · ${c.carrier}` : ''}` : 'Number not checked', tone: checked ? (badLine ? 'failed' : 'done') : 'todo', when: c.line_checked_on ?? null },
    verify,
    { key: 'call', label: (c.total_calls_answered || 0) > 0 ? 'Answered our call' : 'No call answered', tone: (c.total_calls_answered || 0) > 0 ? 'done' : 'todo', when: c.last_call_answered_at ?? null },
    { key: 'text', label: (c.total_texts_received || 0) > 0 ? 'Replied to our text' : 'No text reply', tone: (c.total_texts_received || 0) > 0 ? 'done' : 'todo', when: c.last_text_received_at ?? null },
    { key: 'saved', label: c.saved_our_number ? 'Saved our number' : "Hasn't saved our number", tone: c.saved_our_number ? 'done' : 'todo', when: c.saved_our_number_at ?? null },
    invite,
  ];
}

const esc = (v: string) => v.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
/** Our business number shown to stores (same number verification texts come from). */
export const OUR_NUMBER = '+18776818621';
export const OUR_NAME = 'GasMask - Ching';
export const PORTAL_LINK = 'https://app.gasmaskapproved.com/portal/mystore';
export const formatUs = (e164: string) => { const d = e164.replace(/\D/g, '').slice(-10); return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`; };

/** vCard 3.0 the store contact scans/saves: our name + business number + portal link. */
export function ourVcf(name = OUR_NAME, phone = OUR_NUMBER, url = PORTAL_LINK): string {
  return ['BEGIN:VCARD', 'VERSION:3.0', `FN:${esc(name)}`, `N:${esc(name)};;;;`, 'ORG:GasMask', `TEL;TYPE=WORK,VOICE:${phone.replace(/[^\d+]/g, '')}`, `URL:${url}`, 'END:VCARD', ''].join('\r\n');
}

/** Portal invite is offered only to verified owner/manager contacts. */
export function canSendPortalInvite(c: { role?: string | null; status?: string | null; confirmed_at?: string | null; opted_out?: boolean | null; invite_sent_at?: string | null; link_status?: string | null }): boolean {
  return ['owner', 'manager'].includes((c.role || '').toLowerCase()) && c.status === 'confirmed' && !!c.confirmed_at && !c.opted_out
    && !c.invite_sent_at && !['sending', 'sent', 'queued', 'failed', 'blocked'].includes(c.link_status || '');
}
