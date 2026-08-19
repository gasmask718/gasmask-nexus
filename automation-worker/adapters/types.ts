import type { Page } from '@playwright/test';

export interface FieldMapping {
  lender_field_label: string;
  lender_selector: string | null;
  field_kind: string;
  canonical_field: string;
  required: boolean;
  sort_order: number;
}

export interface ClaimedJob {
  job: {
    id: string;
    application_id: string;
    /** Ownership chain anchor — the worker refuses to run if this does not match its session. */
    funding_client_id: string;
    submission_method: 'api' | 'browser' | 'manual';
    adapter_key: string;
    lender_name: string | null;
  };
  config: {
    application_url: string | null;
    api_base_url: string | null;
    requires_otp: boolean;
    requires_identity_verification: boolean;
    requires_signature: boolean;
    requires_final_certification: boolean;
  } | null;
  field_mappings: FieldMapping[];
  /** Already validated + formatted by the Automation API. Never raw client data. */
  values: Record<string, string | number | boolean>;
}

export interface AutomationAdapter {
  key: string;
  detectForm(page: Page): Promise<void>;
  fillFields(page: Page, values: ClaimedJob['values'], mappings: FieldMapping[]): Promise<void>;
  uploadDocuments?(page: Page, applicationId: string): Promise<void>;
  submit(page: Page): Promise<void>;
  readResponse(page: Page): Promise<string>;
  submitViaApi?(values: ClaimedJob['values'], config: ClaimedJob['config']): Promise<Record<string, unknown>>;
}
