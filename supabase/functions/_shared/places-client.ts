// Shared Google Places (v1) client for the UT territory pipeline.
// Single source of truth — do not re-declare textSearch / placeDetails inline
// in any edge function. GasMask's ingest-google-places is a separate system
// and intentionally does NOT use this module.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Text Search mask — includes places.location and places.userRatingCount.
export const TEXT_SEARCH_MASK =
  'places.id,places.displayName,places.formattedAddress,places.types,places.rating,places.userRatingCount,places.googleMapsUri,places.businessStatus,places.nationalPhoneNumber,places.websiteUri,places.addressComponents,places.location,nextPageToken';

// Union of the two previous inline Details masks PLUS location.
// types / businessStatus / googleMapsUri were missing from the territory-job
// copy; they are the classifier signal for google_types and are restored here.
export const DETAILS_MASK_FULL =
  'id,displayName,formattedAddress,nationalPhoneNumber,internationalPhoneNumber,websiteUri,rating,userRatingCount,types,businessStatus,googleMapsUri,addressComponents,location';

// Cheapest tier (Essentials SKU) — coordinates only.
export const DETAILS_MASK_GEO = 'id,location';

// ── Cost metering (UT-006) ───────────────────────────────────────────────
// IMPORTANT: these SKU names and per-call rates are estimates and MUST be
// verified against actual Google Cloud billing before being used for any
// financial reporting.
// Rate verified 31 Jul 2026 against actual Google Cloud billing: 444 requests = $38.56.
// This is a BLENDED rate across Text Search and Place Details; Google's report does not
// separate them. Re-verify if field masks change, since adding fields moves the SKU tier.
export const SKU_TEXT_SEARCH = 'text_search_enterprise';
export const COST_TEXT_SEARCH = 0.0868; // USD per call — blended, verified 31 Jul 2026
export const SKU_PLACE_DETAILS = 'place_details_enterprise';
export const COST_PLACE_DETAILS = 0.0868; // USD per call — blended, verified 31 Jul 2026

export const SKU_RATES: Record<string, number> = {
  [SKU_TEXT_SEARCH]: COST_TEXT_SEARCH,
  [SKU_PLACE_DETAILS]: COST_PLACE_DETAILS,
};

export interface UsageLedgerRow {
  sku: string;
  request_count: number;
  estimated_cost: number;
}

export interface UsageTracker {
  runId: string;
  maxRequests: number;
  capped: boolean;
  counts: Record<string, number>;
  total(): number;
  canRequest(): boolean;
  note(sku: string): void;
  estimatedCost(): number;
  rows(): UsageLedgerRow[];
}

// Per-invocation request counter + cap. Passing this to textSearch/placeDetails
// is optional; without it those functions behave exactly as before.
export function createUsageTracker(maxRequests = 200): UsageTracker {
  const counts: Record<string, number> = {};
  const t: UsageTracker = {
    runId: crypto.randomUUID(),
    maxRequests,
    capped: false,
    counts,
    total: () => Object.values(counts).reduce((a, b) => a + b, 0),
    canRequest: () => t.total() < maxRequests,
    note: (sku: string) => { counts[sku] = (counts[sku] || 0) + 1; },
    estimatedCost: () =>
      Object.entries(counts).reduce((sum, [sku, n]) => sum + n * (SKU_RATES[sku] || 0), 0),
    rows: () =>
      Object.entries(counts)
        .filter(([, n]) => n > 0)
        .map(([sku, n]) => ({
          sku,
          request_count: n,
          estimated_cost: Number((n * (SKU_RATES[sku] || 0)).toFixed(4)),
        })),
  };
  return t;
}

// Google Places Text Search (paginated).
export async function textSearch(query: string, apiKey: string, pageToken?: string, tracker?: UsageTracker) {
  const body: Record<string, unknown> = { textQuery: query, maxResultCount: 20, languageCode: 'en' };
  if (pageToken) body.pageToken = pageToken;
  tracker?.note(SKU_TEXT_SEARCH);
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': TEXT_SEARCH_MASK,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Places Text Search failed [${res.status}]: ${err}`);
  }
  return res.json();
}

// Place Details. Mask-parameterized; returns null on any non-OK response.
export async function placeDetails(
  placeId: string,
  apiKey: string,
  fieldMask: string = DETAILS_MASK_FULL,
  tracker?: UsageTracker,
) {
  tracker?.note(SKU_PLACE_DETAILS);
  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': fieldMask,
    },
  });
  if (!res.ok) return null;
  return res.json();
}

// Normalise to the exact 2-char uppercase form the ut_upsert RPC / CHECK requires.
// Returns '' when unresolvable — callers MUST skip those rows before calling the RPC.
export function normState(raw: string | null | undefined): string {
  const s = (raw || '').toUpperCase().slice(0, 2);
  return s.length === 2 ? s : '';
}

export function parseCityState(addressComponents: any[]): { city: string; state: string } {
  let city = '', state = '';
  if (!addressComponents) return { city, state };
  for (const c of addressComponents) {
    if (c.types?.includes('locality')) city = c.longText || c.shortText || '';
    if (c.types?.includes('administrative_area_level_1')) state = normState(c.shortText);
  }
  return { city, state };
}
