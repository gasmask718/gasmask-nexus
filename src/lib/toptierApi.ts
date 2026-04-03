/**
 * TopTier REST API Client
 * 
 * Fetches data from the TopTier Supabase project via REST API.
 * Uses VITE_TOPTIER_SUPABASE_URL / VITE_TOPTIER_SUPABASE_ANON_KEY
 * if set, otherwise falls back to the local Supabase project.
 */

const TOPTIER_URL = import.meta.env.VITE_TOPTIER_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const TOPTIER_KEY = import.meta.env.VITE_TOPTIER_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

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

  const res = await fetch(url.toString(), {
    headers: {
      apikey: TOPTIER_KEY,
      Authorization: `Bearer ${TOPTIER_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`TopTier API error [${table}]:`, res.status, text);
    throw new Error(`TopTier API error: ${res.status}`);
  }

  return res.json();
}

/**
 * Fetch with count header (for exact counts without full data)
 */
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

  const res = await fetch(url.toString(), {
    headers: {
      apikey: TOPTIER_KEY,
      Authorization: `Bearer ${TOPTIER_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'count=exact',
      Range: '0-0',
    },
  });

  if (!res.ok) return 0;
  const range = res.headers.get('content-range');
  if (range) {
    const match = range.match(/\/(\d+)/);
    if (match) return parseInt(match[1], 10);
  }
  const data = await res.json();
  return Array.isArray(data) ? data.length : 0;
}

/**
 * Mutate TopTier data (PATCH/POST)
 */
export async function patchTopTierData(
  table: string,
  filters: Record<string, string>,
  body: Record<string, any>
): Promise<any> {
  const url = new URL(`${TOPTIER_URL}/rest/v1/${table}`);
  Object.entries(filters).forEach(([key, val]) => {
    url.searchParams.set(key, val);
  });

  const res = await fetch(url.toString(), {
    method: 'PATCH',
    headers: {
      apikey: TOPTIER_KEY,
      Authorization: `Bearer ${TOPTIER_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TopTier PATCH error: ${res.status} - ${text}`);
  }
  return res.json();
}
