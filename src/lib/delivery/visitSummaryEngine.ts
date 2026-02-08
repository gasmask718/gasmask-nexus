// ═══════════════════════════════════════════════════════════════
// Phase IV — Deterministic Post-Visit Summary Engine
// 100% derived from checklist JSON — NO AI, NO hallucination
// Re-generatable at any time from the same input
// ═══════════════════════════════════════════════════════════════

import { CANONICAL_BRANDS, CanonicalBrandId, getBrandDisplayName } from '@/config/brands';
import type { DeliveryChecklist, TasksCompletedMap } from '@/hooks/useDeliveryChecklist';

export interface VisitSummarySections {
  inventory: string | null;
  orders: string | null;
  lastOrderContext: string | null;
  growth: string | null;
  contacts: string | null;
  stickers: string | null;
}

export interface GeneratedVisitSummary {
  summaryText: string;
  sections: VisitSummarySections;
}

/**
 * Generate a deterministic, human-readable visit summary
 * from a completed delivery checklist. No LLM — pure data derivation.
 */
export function generateVisitSummary(checklist: DeliveryChecklist): GeneratedVisitSummary {
  const sections: VisitSummarySections = {
    inventory: deriveInventorySection(checklist),
    orders: deriveOrdersSection(checklist),
    lastOrderContext: null, // Read-only context is not summarized
    growth: deriveGrowthSection(checklist),
    contacts: deriveContactsSection(checklist),
    stickers: deriveStickersSection(checklist),
  };

  const parts: string[] = [];
  if (sections.inventory) parts.push(`📦 ${sections.inventory}`);
  if (sections.orders) parts.push(`🚚 ${sections.orders}`);
  if (sections.growth) parts.push(`🌱 ${sections.growth}`);
  if (sections.contacts) parts.push(`📞 ${sections.contacts}`);
  if (sections.stickers) parts.push(`🏷️ ${sections.stickers}`);

  const summaryText = parts.length > 0
    ? parts.join(' | ')
    : 'Visit completed — no structured data captured.';

  return { summaryText, sections };
}

function deriveInventorySection(cl: DeliveryChecklist): string | null {
  const inv = cl.inventory_updates || {};
  const brands = Object.keys(inv);
  if (brands.length === 0) {
    const invTasks = cl.tasks_completed || {};
    if (invTasks['inventory_update_all']?.completed) {
      return 'Inventory verified (no brand-level data recorded)';
    }
    return null;
  }

  const brandSummaries = brands.map((brandKey) => {
    const data = inv[brandKey];
    const displayName = getBrandDisplayName(brandKey);
    const count = data?.count ?? data?.tube_count ?? '?';
    return `${displayName}: ${count} tubes`;
  });

  return `Inventory: ${brandSummaries.join(', ')}`;
}

function deriveOrdersSection(cl: DeliveryChecklist): string | null {
  const orders = cl.order_confirmations || {};
  const tasks = cl.tasks_completed || {};

  if (tasks['orders_confirm']?.completed) {
    const recipient = orders.recipient_name;
    const recipientStr = recipient ? ` → received by ${recipient}` : '';
    return `Orders delivered${recipientStr}`;
  }

  if (tasks['orders_view']?.completed && !tasks['orders_confirm']?.completed) {
    return 'Orders reviewed — no delivery made';
  }

  return null;
}

function deriveGrowthSection(cl: DeliveryChecklist): string | null {
  const growth = cl.growth_captures || {};
  const tasks = cl.tasks_completed || {};
  const signals: string[] = [];

  if (growth.sells_flowers === true || tasks['growth_sells_flowers']?.metadata?.sells_flowers === true) {
    signals.push('Sells flowers ✓');
  } else if (growth.sells_flowers === false || tasks['growth_sells_flowers']?.metadata?.sells_flowers === false) {
    signals.push('No flowers');
  }

  if (growth.new_store_name || growth.new_store_address) {
    signals.push(`New lead: ${growth.new_store_name || 'unnamed'} (${growth.new_store_address || 'no address'})`);
  }

  return signals.length > 0 ? signals.join(', ') : null;
}

function deriveContactsSection(cl: DeliveryChecklist): string | null {
  const contacts = cl.contact_updates || {};
  const tasks = cl.tasks_completed || {};
  const signals: string[] = [];

  if (tasks['contacts_boss_name']?.completed) {
    const name = contacts.boss_name || tasks['contacts_boss_name']?.metadata?.name;
    signals.push(name ? `Boss: ${name}` : 'Boss confirmed');
  }

  if (tasks['contacts_responsiveness']?.completed) {
    const resp = contacts.responsiveness || tasks['contacts_responsiveness']?.metadata?.type;
    if (resp) signals.push(`Responds via: ${resp}`);
  }

  if (tasks['contacts_replace_unresponsive']?.completed) {
    signals.push('Unresponsive # replaced');
  }

  if (tasks['contacts_who_spoke']?.completed) {
    const spoke = contacts.spoke_with_name || tasks['contacts_who_spoke']?.metadata?.name;
    if (spoke) signals.push(`Spoke with: ${spoke}`);
  }

  return signals.length > 0 ? signals.join(', ') : null;
}

function deriveStickersSection(cl: DeliveryChecklist): string | null {
  const stickers = cl.sticker_status || {};
  const tasks = cl.tasks_completed || {};
  const signals: string[] = [];

  if (tasks['stickers_present']?.completed) {
    const present = stickers.present ?? tasks['stickers_present']?.metadata?.present;
    signals.push(present === false ? 'Stickers missing' : 'Stickers present');
  }

  if (tasks['stickers_condition']?.completed) {
    const good = stickers.condition_good ?? tasks['stickers_condition']?.metadata?.good;
    if (good === false) signals.push('Poor condition');
  }

  if (tasks['stickers_added']?.completed) {
    signals.push('New stickers added');
  }

  return signals.length > 0 ? signals.join(', ') : null;
}
