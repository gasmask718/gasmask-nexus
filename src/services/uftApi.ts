// ═══════════════════════════════════════════════════════════════════════
// UFT API Service Layer — Dynasty OS reads UFT platform via secure API
// NEVER writes directly to UFT's database
// ═══════════════════════════════════════════════════════════════════════

const UFT_API_BASE = `https://pxylmrmwqmxotqffejbe.supabase.co/functions/v1`;

const uftHeaders = {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer DYNASTY_OS_2026_UFT_xK9mP3qR7vL2nW8',
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

export interface UFTPayoutRequest {
  id: string;
  ambassador_id: string;
  ambassador_name: string;
  ref_code: string;
  amount: number;
  method: string;
  account: string;
  status: string;
  notes?: string | null;
  requested_at: string;
  paid_at?: string | null;
}

export interface UFTPayoutResponse {
  requests: UFTPayoutRequest[];
  stats?: {
    total_pending: number;
    total_pending_amount: number;
    paid_this_month: number;
    average_payout: number;
  };
}

export interface UFTVerificationItem {
  id: string;
  vendor_type: 'venue' | 'staff' | 'rental';
  name: string;
  cover_photo: string | null;
  city: string;
  state: string;
  submitted_at: string;
  status: string;
  documents: {
    id_doc?: string | null;
    business_license?: string | null;
    insurance?: string | null;
  };
}

export interface UFTVendorListItem {
  id: string;
  name: string;
  business_name?: string | null;
  vendor_type: 'venue' | 'staff' | 'rental';
  city: string;
  state: string;
  rating: number;
  review_count: number;
  bookings_count: number;
  status: string;
  verified: boolean;
  cover_photo: string | null;
}

export interface UFTVendorListResponse {
  vendors: UFTVendorListItem[];
  total: number;
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

// ─────────────────────────────────────────────────────────────────────
// Payout management
// ─────────────────────────────────────────────────────────────────────
export async function getUFTPayoutRequests(status?: string): Promise<UFTPayoutResponse> {
  const url = status
    ? `${UFT_API_BASE}/ut-get-payout-requests?status=${status}`
    : `${UFT_API_BASE}/ut-get-payout-requests`;
  const res = await fetch(url, { headers: uftHeaders });
  if (!res.ok) throw new Error('Failed to fetch payouts');
  return res.json();
}

export async function updateUFTPayoutStatus(payoutId: string, status: string, notes?: string) {
  const res = await fetch(`${UFT_API_BASE}/ut-update-payout-status`, {
    method: 'POST',
    headers: uftHeaders,
    body: JSON.stringify({ payout_id: payoutId, status, notes }),
  });
  if (!res.ok) throw new Error('Failed to update payout');
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────
// Vendor verification
// ─────────────────────────────────────────────────────────────────────
export async function getUFTVerificationQueue(type?: string): Promise<{ items: UFTVerificationItem[] }> {
  const url = type
    ? `${UFT_API_BASE}/ut-get-verification-queue?type=${type}`
    : `${UFT_API_BASE}/ut-get-verification-queue`;
  const res = await fetch(url, { headers: uftHeaders });
  if (!res.ok) throw new Error('Failed to fetch queue');
  return res.json();
}

export async function updateUFTVendorVerification(
  vendorId: string,
  vendorType: string,
  status: string,
  reason?: string,
) {
  const res = await fetch(`${UFT_API_BASE}/ut-update-vendor-verification`, {
    method: 'POST',
    headers: uftHeaders,
    body: JSON.stringify({
      vendor_id: vendorId,
      vendor_type: vendorType,
      status,
      reason,
    }),
  });
  if (!res.ok) throw new Error('Failed to update verification');
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────
// Vendor list and management
// ─────────────────────────────────────────────────────────────────────
export async function getUFTVendorsList(
  type?: string,
  limit = 50,
  offset = 0,
): Promise<UFTVendorListResponse> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (type) params.set('type', type);
  const res = await fetch(`${UFT_API_BASE}/ut-get-vendors-list?${params}`, { headers: uftHeaders });
  if (!res.ok) throw new Error('Failed to fetch vendors');
  return res.json();
}

export async function updateUFTVendorStatus(vendorId: string, vendorType: string, status: string) {
  const res = await fetch(`${UFT_API_BASE}/ut-update-vendor-status`, {
    method: 'POST',
    headers: uftHeaders,
    body: JSON.stringify({ vendor_id: vendorId, vendor_type: vendorType, status }),
  });
  if (!res.ok) throw new Error('Failed to update vendor');
  return res.json();
}
