// ═══════════════════════════════════════════════════════════════════════
// UFT API Service Layer — Dynasty OS reads UFT platform via secure API
// NEVER writes directly to UFT's database
// ═══════════════════════════════════════════════════════════════════════

const UFT_API_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || 'qalaaroashbggynpvqct'}.supabase.co/functions/v1`;

const uftHeaders = {
  'Content-Type': 'application/json',
};

export interface UFTPlatformMetrics {
  total_vendors: number;
  total_bookings: number;
  total_revenue: number;
  this_month_revenue: number;
  total_ambassadors: number;
  conversion_rate: number;
  top_vendor_categories: { category: string; count: number }[];
}

export interface UFTVendorSummary {
  id: string;
  business_name: string;
  vendor_type: string;
  city: string;
  state: string;
  rating: number;
  review_count: number;
  bookings_count: number;
  total_revenue: number;
  status: string;
  cover_photo: string | null;
}

export interface UFTAmbassador {
  rank: number;
  name: string;
  tier: string;
  total_sales: number;
  total_earned: number;
  commission_rate: number;
  status: string;
  ref_code: string;
}

export async function getUFTPlatformMetrics(): Promise<UFTPlatformMetrics> {
  const res = await fetch(`${UFT_API_BASE}/ut-get-platform-metrics`, {
    headers: uftHeaders,
  });
  if (!res.ok) throw new Error('Failed to fetch UFT metrics');
  return res.json();
}

export async function getUFTVendorSummary(vendorId: string): Promise<UFTVendorSummary> {
  const res = await fetch(`${UFT_API_BASE}/ut-get-vendor-summary?vendor_id=${vendorId}`, {
    headers: uftHeaders,
  });
  if (!res.ok) throw new Error('Failed to fetch vendor summary');
  return res.json();
}

export async function getUFTAmbassadorLeaderboard(): Promise<UFTAmbassador[]> {
  const res = await fetch(`${UFT_API_BASE}/ut-get-ambassador-leaderboard`, {
    headers: uftHeaders,
  });
  if (!res.ok) throw new Error('Failed to fetch ambassador leaderboard');
  const data = await res.json();
  return data.leaderboard || [];
}
