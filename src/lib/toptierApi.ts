/**
 * TopTier REST API Client
 * 
 * Fetches data from the TopTier Supabase project via REST API.
 * Uses the logged-in user's JWT for Authorization so RLS policies
 * that check auth.uid() work correctly.
 */

import { supabase } from '@/integrations/supabase/client';

const TOPTIER_URL = import.meta.env.VITE_SUPABASE_URL;
const TOPTIER_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || TOPTIER_KEY;
  return {
    apikey: TOPTIER_KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function fetchTopTierData<T = any>(
  table: string,
  params?: {
    select?: string;
    filters?: Record<string, string>;
    limit?: number;
    order?: string;
  }
): Promise<T[]> {
  const url = new URL(`${TOPTIER_URL}/rest/v1/${table}`);

  if (params?.select) url.searchParams.set('select', params.select);
  if (params?.limit) url.searchParams.set('limit', String(params.limit));
  if (params?.order) url.searchParams.set('order', params.order);

  if (params?.filters) {
    Object.entries(params.filters).forEach(([key, val]) => {
      url.searchParams.set(key, val);
    });
  }

  const headers = await getAuthHeaders();
  headers['Prefer'] = 'return=representation';

  const res = await fetch(url.toString(), { headers });

  if (!res.ok) {
    const text = await res.text();
    console.error(`TopTier API error [${table}]:`, res.status, text);
    throw new Error(`TopTier API error: ${res.status}`);
  }

  return res.json();
}

export async function fetchTopTierCount(
  table: string,
  filters?: Record<string, string>
): Promise<number> {
  const url = new URL(`${TOPTIER_URL}/rest/v1/${table}`);
  url.searchParams.set('select', 'id');

  if (filters) {
    Object.entries(filters).forEach(([key, val]) => {
      url.searchParams.set(key, val);
    });
  }

  const headers = await getAuthHeaders();
  headers['Prefer'] = 'count=exact';
  headers['Range'] = '0-0';

  const res = await fetch(url.toString(), { headers });

  if (!res.ok) return 0;
  const range = res.headers.get('content-range');
  if (range) {
    const match = range.match(/\/(\d+)/);
    if (match) return parseInt(match[1], 10);
  }
  const data = await res.json();
  return Array.isArray(data) ? data.length : 0;
}

export async function patchTopTierData(
  table: string,
  filters: Record<string, string>,
  body: Record<string, any>
): Promise<any> {
  const url = new URL(`${TOPTIER_URL}/rest/v1/${table}`);
  Object.entries(filters).forEach(([key, val]) => {
    url.searchParams.set(key, val);
  });

  const headers = await getAuthHeaders();
  headers['Prefer'] = 'return=representation';

  const res = await fetch(url.toString(), {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TopTier PATCH error: ${res.status} - ${text}`);
  }
  return res.json();
}

export async function postTopTierData(
  table: string,
  body: Record<string, any>
): Promise<any> {
  const url = new URL(`${TOPTIER_URL}/rest/v1/${table}`);

  const headers = await getAuthHeaders();
  headers['Prefer'] = 'return=representation';

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TopTier POST error: ${res.status} - ${text}`);
  }
  return res.json();
}

export async function deleteTopTierData(
  table: string,
  filters: Record<string, string>
): Promise<void> {
  const url = new URL(`${TOPTIER_URL}/rest/v1/${table}`);
  Object.entries(filters).forEach(([key, val]) => {
    url.searchParams.set(key, val);
  });

  const headers = await getAuthHeaders();

  const res = await fetch(url.toString(), {
    method: 'DELETE',
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TopTier DELETE error: ${res.status} - ${text}`);
  }
}

export async function logPenthouseAction(params: {
  action: string;
  target_type: string;
  target_id?: string;
  reason?: string;
  before?: any;
  after?: any;
  actor_user_id: string;
}): Promise<void> {
  try {
    await postTopTierData('admin_audit_log', {
      action: params.action,
      target_type: params.target_type,
      target_id: params.target_id || null,
      reason: params.reason || null,
      before: params.before || null,
      after: params.after || null,
      actor_user_id: params.actor_user_id,
    });
  } catch (e) {
    console.error('Audit log write failed:', e);
  }
}
