import { describe, expect, it } from 'vitest';
import { canSendPortalInvite, contactBadges, contactVcf } from '@/lib/contactStatus';

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
  it('saved in my phone is green only when I saved it', () => {
    expect(tone({ saved_by: [{ name: 'SL', saved_at: 'x', me: false }] }, 'saved').tone).toBe('todo');
    expect(tone({ saved_by: [{ name: 'Me', saved_at: 'x', me: true }] }, 'saved').tone).toBe('done');
  });
  it('portal invite only for verified owner/manager not yet invited', () => {
    expect(canSendPortalInvite({ role: 'owner', status: 'confirmed', confirmed_at: 'x' })).toBe(true);
    expect(canSendPortalInvite({ role: 'worker', status: 'confirmed', confirmed_at: 'x' })).toBe(false);
    expect(canSendPortalInvite({ role: 'owner', status: 'sent' })).toBe(false);
    expect(canSendPortalInvite({ role: 'owner', status: 'confirmed', confirmed_at: 'x', invite_sent_at: 'y' })).toBe(false);
  });
  it('vcf carries name, store and phone', () => {
    const v = contactVcf('Ali', 'Best Deli', '+1 (718) 455-0141');
    expect(v).toContain('FN:Ali (Best Deli)'); expect(v).toContain('TEL;TYPE=CELL:+17184550141');
  });
});
