// ═══════════════════════════════════════════════════════════════
// Phase V — Rule-Based Follow-Up Action Engine
// NO outbound messages. NO AI. Only tasks, flags, reminders.
// ═══════════════════════════════════════════════════════════════

import type { DeliveryChecklist, TasksCompletedMap } from '@/hooks/useDeliveryChecklist';
import { getBrandDisplayName, CANONICAL_BRAND_IDS } from '@/config/brands';

export interface FollowUpAction {
  action_type: string;
  action_label: string;
  description: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  assigned_role: string;
  rule_trigger: string;
  metadata: Record<string, any>;
}

/**
 * Evaluate a completed checklist and return deterministic follow-up actions.
 * Rules are explicit, ordered, and auditable.
 */
export function evaluateFollowUpRules(checklist: DeliveryChecklist): FollowUpAction[] {
  const actions: FollowUpAction[] = [];
  const tasks = checklist.tasks_completed || {};
  const inventory = checklist.inventory_updates || {};
  const contacts = checklist.contact_updates || {};
  const growth = checklist.growth_captures || {};
  const stickers = checklist.sticker_status || {};

  // ─── RULE 1: Low inventory on any brand ───
  for (const brandId of CANONICAL_BRAND_IDS) {
    const brandInv = inventory[brandId];
    if (brandInv) {
      const count = Number(brandInv.count ?? brandInv.tube_count ?? -1);
      if (count >= 0 && count <= 3) {
        actions.push({
          action_type: 'restock_needed',
          action_label: `Restock ${getBrandDisplayName(brandId)}`,
          description: `${getBrandDisplayName(brandId)} inventory is low (${count} tubes). Schedule restock delivery.`,
          priority: count === 0 ? 'urgent' : 'high',
          assigned_role: 'sales',
          rule_trigger: 'inventory_low',
          metadata: { brand: brandId, count },
        });
      }
    }
  }

  // ─── RULE 2: No responsive boss contact ───
  const bossResponsiveness = contacts.responsiveness
    || tasks['contacts_responsiveness']?.metadata?.type;
  if (bossResponsiveness === 'none' || bossResponsiveness === 'unresponsive') {
    actions.push({
      action_type: 'contact_risk',
      action_label: 'Contact Risk — No Responsive Boss',
      description: 'Store boss is unresponsive. Flag for alternate contact strategy.',
      priority: 'high',
      assigned_role: 'operations',
      rule_trigger: 'no_responsive_contact',
      metadata: { responsiveness: bossResponsiveness },
    });
  }

  // ─── RULE 3: Boss number replaced ───
  if (tasks['contacts_replace_unresponsive']?.completed) {
    actions.push({
      action_type: 'contact_updated',
      action_label: 'Verify New Boss Number',
      description: 'Boss phone number was replaced during visit. Verify new number with a test message.',
      priority: 'normal',
      assigned_role: 'operations',
      rule_trigger: 'contact_number_replaced',
      metadata: {},
    });
  }

  // ─── RULE 4: New store lead captured ───
  const newStoreName = growth.new_store_name;
  const newStoreAddress = growth.new_store_address;
  if (newStoreName || newStoreAddress) {
    actions.push({
      action_type: 'new_store_lead',
      action_label: 'New Store Lead Captured',
      description: `New store lead: ${newStoreName || 'unnamed'} at ${newStoreAddress || 'no address'}. Add to CRM pipeline.`,
      priority: 'normal',
      assigned_role: 'sales',
      rule_trigger: 'new_store_lead',
      metadata: { store_name: newStoreName, address: newStoreAddress },
    });
  }

  // ─── RULE 5: Stickers missing ───
  const stickersPresent = stickers.present
    ?? tasks['stickers_present']?.metadata?.present;
  if (stickersPresent === false) {
    actions.push({
      action_type: 'stickers_needed',
      action_label: 'Stickers Missing — Reapply',
      description: 'Store is missing brand stickers. Schedule marketing materials delivery.',
      priority: 'normal',
      assigned_role: 'marketing',
      rule_trigger: 'stickers_missing',
      metadata: {},
    });
  }

  // ─── RULE 6: Sticker condition poor ───
  const stickerCondition = stickers.condition_good
    ?? tasks['stickers_condition']?.metadata?.good;
  if (stickerCondition === false && stickersPresent !== false) {
    actions.push({
      action_type: 'stickers_replace',
      action_label: 'Replace Worn Stickers',
      description: 'Stickers are present but in poor condition. Schedule replacement.',
      priority: 'low',
      assigned_role: 'marketing',
      rule_trigger: 'stickers_poor_condition',
      metadata: {},
    });
  }

  // ─── RULE 7: Sells flowers (growth signal) ───
  const sellsFlowers = growth.sells_flowers
    ?? tasks['growth_sells_flowers']?.metadata?.sells_flowers;
  if (sellsFlowers === true) {
    actions.push({
      action_type: 'growth_signal',
      action_label: 'Flower Sales Opportunity',
      description: 'Store sells flowers — potential cross-sell opportunity.',
      priority: 'low',
      assigned_role: 'sales',
      rule_trigger: 'sells_flowers_yes',
      metadata: { sells_flowers: true },
    });
  }

  // ─── RULE 8: Required tasks not completed (governance alert) ───
  const requiredKeys = [
    'inventory_update_all', 'inventory_exact_count',
    'growth_sells_flowers',
    'contacts_boss_name', 'contacts_boss_phone',
    'contacts_responsiveness', 'contacts_who_spoke',
    'stickers_present', 'stickers_condition',
  ];
  const missingRequired = requiredKeys.filter(k => !tasks[k]?.completed);
  if (missingRequired.length > 0 && checklist.status === 'completed') {
    actions.push({
      action_type: 'incomplete_checklist',
      action_label: 'Checklist Incomplete — Review Needed',
      description: `${missingRequired.length} required tasks were not completed. Review visit quality.`,
      priority: 'high',
      assigned_role: 'operations',
      rule_trigger: 'incomplete_required_tasks',
      metadata: { missing_tasks: missingRequired },
    });
  }

  return actions;
}
