// ICW webhook config resolver.
// Prefers edge-function environment secrets; falls back to the service-role-only
// public.icw_webhook_config table (the project is at the 100-secret cap).
import { createClient } from 'npm:@supabase/supabase-js@2';

export type IcwConfigKey =
  | 'ICW_INTAKE_SECRET'
  | 'ICW_STATUS_SYNC_SECRET'
  | 'PUBLIC_SITE_STATUS_WEBHOOK_URL';

export async function getIcwConfig(key: IcwConfigKey): Promise<string | null> {
  const fromEnv = Deno.env.get(key);
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await supabase
    .from('icw_webhook_config')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) {
    console.error('[icwWebhookConfig] lookup failed', key, error.message);
    return null;
  }
  const v = data?.value;
  return v && v.trim() ? v.trim() : null;
}
