import { describe, expect, it } from 'vitest';
import { canSendPortalInvite, contactBadges, ourVcf } from '@/lib/contactStatus';

const tone = (c: any, key: string) => contactBadges(c).find(b => b.key === key)!;

describe('contact status badges', () => {
  it('confirmed verify text is green, failed is red, nothing is grey', () => {
    expect(tone({ status: 'confirmed', confirmed_at: '2026-11-06' }, 'verify').tone).toBe('done');
    expect(tone({ status: 'failed' }, 'verify').tone).toBe('failed');
    expect(tone({}, 'verify').tone).toBe('todo');
  });
  it('answered call / replied text need a count above zero', () => {
    expect(tone({ total_calls_answered: 1 }, 'call').tone).toBe('done');
    expect(tone({ total_texts_received: 0 }, 'text').tone).toBe('todo');
  });
  it('invite moves sent -> account created', () => {
    expect(tone({ invite_sent_at: '2026-11-06' }, 'invite').label).toBe('Invite sent');
    expect(tone({ invite_sent_at: '2026-11-06', invite_consumed_at: '2026-11-07' }, 'invite').label).toBe('ACCOUNT CREATED');
  });
  it('saved our number is green only once the store contact saved it', () => {
    expect(tone({}, 'saved').label).toBe("Hasn't saved our number");
    expect(tone({ saved_our_number: true, saved_our_number_at: '2026-11-06' }, 'saved')).toMatchObject({ tone: 'done', label: 'Saved our number', when: '2026-11-06' });
  });
  it('portal invite only for verified owner/manager not yet invited', () => {
    expect(canSendPortalInvite({ role: 'owner', status: 'confirmed', confirmed_at: 'x' })).toBe(true);
    expect(canSendPortalInvite({ role: 'worker', status: 'confirmed', confirmed_at: 'x' })).toBe(false);
    expect(canSendPortalInvite({ role: 'owner', status: 'sent' })).toBe(false);
    expect(canSendPortalInvite({ role: 'owner', status: 'confirmed', confirmed_at: 'x', invite_sent_at: 'y' })).toBe(false);
  });
  it('our contact card is GasMask - Ching + business number + portal link', () => {
    const v = ourVcf();
    expect(v).toContain('FN:GasMask - Ching'); expect(v).toContain('TEL;TYPE=WORK,VOICE:+18776818621'); expect(v).toContain('URL:https://app.gasmaskapproved.com/portal/mystore');
  });
});
