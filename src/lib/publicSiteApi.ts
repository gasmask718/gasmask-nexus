/**
 * Public Site API Client
 * Routes read requests through proxy-public-data edge function
 * to bypass RLS on the public site. Writes go direct.
 */

const PUBLIC_URL = 'https://hruhkyvwtfpfviwnvhne.supabase.co';
const PUBLIC_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhydWhreXZ3dGZwZnZpd252aG5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMTM3MzAsImV4cCI6MjA3NzY4OTczMH0.XqD-w-e-tOYnF87rpxvspwdyhk63hBm4WNErwpXq5iE';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const directHeaders: Record<string, string> = {
  apikey: PUBLIC_KEY,
  Authorization: `Bearer ${PUBLIC_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

export async function pubFetch<T = any>(
  table: string,
  params?: {
    select?: string;
    filters?: Record<string, string>;
    order?: string;
    limit?: number;
  }
): Promise<T[]> {
  try {
    const { data, error } = await supabase.functions.invoke('proxy-public-data', {
      body: {
        table,
        select: params?.select || '*',
        filters: params?.filters,
        order: params?.order,
        limit: params?.limit,
      },
    });
    if (error) return [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}


export async function pubPatch(
  table: string,
  id: string,
  data: Record<string, any>
): Promise<boolean> {
  try {
    const res = await fetch(`${PUBLIC_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: 'PATCH',
      headers: directHeaders,
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function pubPost(
  table: string,
  data: Record<string, any>
): Promise<any | null> {
  try {
    const res = await fetch(`${PUBLIC_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: directHeaders,
      body: JSON.stringify(data),
    });
    if (!res.ok) return null;
    const result = await res.json();
    return Array.isArray(result) ? result[0] : result;
  } catch {
    return null;
  }
}

export async function pubDelete(
  table: string,
  id: string
): Promise<boolean> {
  try {
    const res = await fetch(`${PUBLIC_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: 'DELETE',
      headers: directHeaders,
    });
    return res.ok;
  } catch {
    return false;
  }
}
