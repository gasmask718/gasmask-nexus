/**
 * vault-snapshot — records a names-only fingerprint of the secret vault.
 *
 * AUDIT PURPOSE: proves exactly which secrets existed between any two timestamps
 * and which ones were added, deleted, or rotated in between.
 *
 * SAFETY: secret VALUES are never stored, logged, or returned. Only the name and
 * a salted SHA-256 fingerprint (first 16 hex chars) are persisted, which is
 * enough to detect a rotation but not to recover the value.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const FINGERPRINT_SALT = 'dynasty-vault-snapshot-v1';

async function fingerprint(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${FINGERPRINT_SALT}:${value}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    let triggerSource = 'cron';
    try {
      const body = await req.json();
      if (body?.trigger_source) triggerSource = String(body.trigger_source).slice(0, 60);
    } catch (_) {
      // no body — fine
    }

    const env = Deno.env.toObject();
    const secrets: Array<{ name: string; fingerprint: string }> = [];
    for (const [name, value] of Object.entries(env)) {
      // Skip Deno/runtime noise; keep configured project secrets only.
      if (name.startsWith('DENO_') || name === 'PWD' || name === 'HOME' || name === 'PATH') continue;
      secrets.push({ name, fingerprint: await fingerprint(String(value ?? '')) });
    }
    secrets.sort((a, b) => a.name.localeCompare(b.name));

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data, error } = await supabase
      .from('vault_secret_snapshots')
      .insert({
        trigger_source: triggerSource,
        secret_count: secrets.length,
        secrets,
      })
      .select('id, taken_at, secret_count')
      .single();

    if (error) throw error;

    // Response deliberately excludes names and fingerprints.
    return new Response(JSON.stringify({ ok: true, snapshot: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
