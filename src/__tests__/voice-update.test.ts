import { describe, expect, it } from 'vitest';
import { emptyVoiceCheckCard, validateVoiceCheckCard, voiceSavedSummary } from '@/lib/voice/voiceUpdate';
import { encodeWav } from '@/lib/voice/recordWav';

describe('voice update confirmation rules', () => {
  it('rejects fractional inventory counts before confirmation', () => {
    const card = emptyVoiceCheckCard('store-1', 'Test Store');
    card.counts.push({ brand_id: 'gasmasktubes', brand_name: 'GasMask Tubes', count: 1.5, unit: 'tubes' });
    expect(validateVoiceCheckCard(card)).toContain('whole number');
  });

  it('requires half-box steps for voice order quantities', () => {
    const card = emptyVoiceCheckCard('store-1', 'Test Store');
    card.order.requested = true;
    card.order.items.push({ brand_key: 'gasmask_tubes', name: 'GasMask Tubes', quantity: 0.25 });
    expect(validateVoiceCheckCard(card)).toContain('half-box');
    card.order.items[0].quantity = 0.5;
    expect(validateVoiceCheckCard(card)).toBeNull();
  });

  it('requires complete lead geography rather than inventing it', () => {
    const card = emptyVoiceCheckCard('store-1', 'Test Store');
    card.leads.push({ name: 'Other Store', address: '1 Main St', city: '', state: 'NY' });
    expect(validateVoiceCheckCard(card)).toContain('street, city, and state');
  });

  it('never presents a money mention as a saved payment', () => {
    const lines = voiceSavedSummary({ note_id: 'n1', visit_id: 'v1', money_requires_normal_screen: true });
    expect(lines.join(' ')).not.toContain('Payment saved');
    expect(lines.join(' ')).not.toContain('payment');
  });
});

describe('WAV recording', () => {
  it('writes a complete RIFF/WAVE header and PCM payload length', () => {
    const blob = encodeWav([new Float32Array([0, 0.5, -0.5])], 16000);
    expect(blob.size).toBe(50);
    expect(blob.type).toBe('audio/wav');
    return blob.arrayBuffer().then(buffer => {
      const bytes = new Uint8Array(buffer);
      expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('RIFF');
      expect(String.fromCharCode(...bytes.slice(8, 12))).toBe('WAVE');
      expect(new DataView(buffer).getUint32(40, true)).toBe(6);
    });
  });
});
