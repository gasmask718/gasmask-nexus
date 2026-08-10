import type { AutomationAdapter, ClaimedJob, FieldMapping } from './types';
import type { Page } from '@playwright/test';

/**
 * Generic adapter — the proof-of-concept lender adapter.
 * Uses explicit per-lender selectors from automation_field_mappings.
 * It never guesses: a mapping without a selector and without a matching label fails loudly.
 */
export const genericAdapter: AutomationAdapter = {
  key: 'generic',

  async detectForm(page: Page) {
    await page.waitForSelector('form', { timeout: 30_000 });
  },

  async fillFields(page: Page, values: ClaimedJob['values'], mappings: FieldMapping[]) {
    for (const m of [...mappings].sort((a, b) => a.sort_order - b.sort_order)) {
      const value = values[m.lender_field_label];
      if (value === undefined) {
        if (m.required) throw new Error(`Missing validated value for required field "${m.lender_field_label}"`);
        continue;
      }
      const locator = m.lender_selector
        ? page.locator(m.lender_selector)
        : page.getByLabel(m.lender_field_label, { exact: false });

      if (await locator.count() === 0) throw new Error(`Field not found on page: "${m.lender_field_label}"`);

      switch (m.field_kind) {
        case 'select':
          await locator.first().selectOption(String(value));
          break;
        case 'checkbox':
          if (value) await locator.first().check(); else await locator.first().uncheck();
          break;
        case 'radio':
          await page.locator(`${m.lender_selector ?? ''}[value="${value}"]`).first().check();
          break;
        default:
          await locator.first().fill(String(value));
      }
    }
  },

  async submit(page: Page) {
    const button = page.getByRole('button', { name: /submit|apply|continue/i }).last();
    await button.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2_000);
  },

  async readResponse(page: Page) {
    return (await page.locator('body').innerText()).slice(0, 8_000);
  },
};

/** Manual "adapter": never executes anything. Package is prepared by Funding Hub. */
export const manualAdapter: AutomationAdapter = {
  key: 'manual',
  async detectForm() { throw new Error('Manual submission — no automation permitted for this lender'); },
  async fillFields() { throw new Error('Manual submission — no automation permitted for this lender'); },
  async submit() { throw new Error('Manual submission — no automation permitted for this lender'); },
  async readResponse() { return ''; },
};

export const adapters: Record<string, AutomationAdapter> = {
  generic: genericAdapter,
  manual: manualAdapter,
};
