import type { BrandKey, OrderItem } from '@/lib/orders/fieldOrders';

export const VOICE_COUNT_BRANDS = [
  { id: 'gasmasktubes', name: 'GasMask Tubes', unit: 'tubes' },
  { id: 'gasmask', name: 'GasMask Bags', unit: 'bags' },
  { id: 'hotmama', name: 'Hot Mama', unit: 'tubes' },
  { id: 'hotscolatti-light', name: 'Hotscolatti Light', unit: 'tubes' },
  { id: 'hotscolatti-dark', name: 'Hotscolatti Dark', unit: 'tubes' },
  { id: 'hotscalatimixpack', name: 'Hotscolatti Mix Pack', unit: 'tubes' },
  { id: 'hotscalatibros', name: 'Hotscolatti Bros', unit: 'tubes' },
  { id: 'grabba_r_us', name: 'Grabba R Us', unit: 'tubes' },
] as const;

export type VoiceCount = { brand_id: string; brand_name: string; count: number | null; unit: string };
export type VoiceContact = {
  mentioned: boolean;
  contact_id: string | null;
  name: string | null;
  phone: string | null;
  role: string | null;
  is_new: boolean;
};
export type VoiceLead = {
  name: string;
  address: string;
  city: string;
  state: string;
};
export type VoiceCheckCard = {
  store_id: string;
  store_name: string;
  store_address: string;
  summary: string;
  counts: VoiceCount[];
  order: {
    requested: boolean;
    items: OrderItem[];
    deliver_by: 'next_visit' | 'tomorrow' | 'date';
    deliver_date: string | null;
    note: string | null;
  };
  contact: VoiceContact;
  leads: VoiceLead[];
  note: string | null;
  status_change: 'closed' | 'no_tobacco' | 'not_interested' | null;
  money: { mentioned: boolean; amount: number | null; note: string | null };
};

export function emptyVoiceCheckCard(storeId: string, storeName = '', storeAddress = ''): VoiceCheckCard {
  return {
    store_id: storeId,
    store_name: storeName,
    store_address: storeAddress,
    summary: '',
    counts: [],
    order: { requested: false, items: [], deliver_by: 'next_visit', deliver_date: null, note: null },
    contact: { mentioned: false, contact_id: null, name: null, phone: null, role: 'worker', is_new: true },
    leads: [],
    note: null,
    status_change: null,
    money: { mentioned: false, amount: null, note: null },
  };
}

export function validateVoiceCheckCard(card: VoiceCheckCard): string | null {
  for (const count of card.counts) {
    if (!VOICE_COUNT_BRANDS.some(b => b.id === count.brand_id)) return 'Choose a known inventory brand.';
    if (!Number.isInteger(count.count) || Number(count.count) < 0 || Number(count.count) > 100000) {
      return `${count.brand_name}: enter a whole number, zero or more.`;
    }
  }
  if (card.order.requested) {
    if (!card.order.items.length) return 'Add at least one order item, or turn the order request off.';
    for (const item of card.order.items) {
      const quantity = Number(item.quantity);
      if (!['gasmask_tubes', 'gasmask_bags', 'hotmama', 'hotscolatti', 'grabba_r_us'].includes(item.brand_key as BrandKey)) {
        return 'Choose a known order brand.';
      }
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100 || Math.round(quantity * 2) !== quantity * 2) {
        return `${item.name}: use half-box steps, up to 100 boxes.`;
      }
    }
    if (card.order.deliver_by === 'date' && !card.order.deliver_date) return 'Pick the delivery date.';
  }
  if (card.contact.mentioned && (!card.contact.name?.trim() || !card.contact.phone?.trim())) {
    return 'Contact name and phone are required, or turn the contact update off.';
  }
  for (const lead of card.leads) {
    if (!lead.name.trim() || !lead.address.trim() || !lead.city.trim() || !lead.state.trim()) {
      return 'Every other-store lead needs a name, street, city, and state.';
    }
  }
  return null;
}

export function voiceSavedSummary(result: any): string[] {
  if (!result) return [];
  const lines: string[] = [];
  const counts = Array.isArray(result.counts) ? result.counts : [];
  if (counts.length) lines.push(`Counts: ${counts.map((c: any) => `${c.brand_name} ${c.count}`).join(', ')}`);
  if (result.order_request_id) lines.push('Order request added to Today\'s order requests.');
  if (result.contact_id) lines.push('Contact saved.');
  const leads = Array.isArray(result.leads) ? result.leads : [];
  if (leads.length) lines.push(`Other stores: ${leads.map((l: any) => `${l.name} (${l.status === 'connected' ? 'connected' : 'needs review'})`).join(', ')}`);
  if (result.status_change) lines.push(`Status changed: ${String(result.status_change).replace(/_/g, ' ')}.`);
  if (result.store_note_id) lines.push('Dated note and transcript saved.');
  if (result.visit_id) lines.push('Visit logged.');
  return lines;
}
