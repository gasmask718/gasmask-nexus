// Shared constants for the GasMask store customer portal (/portal/mystore).
// Brand ids are the store_tube_inventory_status keys ('gasmasktubes' = tubes, 'gasmask' = bags).
export const STORE_PORTAL_BRANDS: { brand_id: string; label: string; unit: 'tubes' | 'bags' }[] = [
  { brand_id: 'gasmasktubes', label: 'GasMask Tubes', unit: 'tubes' },
  { brand_id: 'gasmask', label: 'GasMask Bags', unit: 'bags' },
  { brand_id: 'hotmama', label: 'Hot Mama', unit: 'tubes' },
  { brand_id: 'hotscolatti-light', label: 'Hotscolatti Light', unit: 'tubes' },
  { brand_id: 'hotscolatti-dark', label: 'Hotscolatti Dark', unit: 'tubes' },
  { brand_id: 'grabba_r_us', label: 'Grabba R Us', unit: 'tubes' },
];

export const LOW_STOCK_THRESHOLD = 25;

// Quick-pick counts. A full box is 100 units.
export const QUICK_COUNTS: { label: string; value: number }[] = [
  { label: 'Sold out', value: 0 },
  { label: 'Under 25', value: 20 },
  { label: 'About half box', value: 50 },
  { label: 'Full box', value: 100 },
];

export const UNITS_PER_BOX = 100;

export const LAUNCH_CHECKLIST: { key: string; label: string }[] = [
  { key: 'sign_in_code', label: 'Text the test store a link and sign in with the texted code' },
  { key: 'update_inventory', label: 'Update inventory from the portal and see it on the store profile' },
  { key: 'request_asap', label: 'Request an ASAP delivery' },
  { key: 'schedule_delivery', label: 'Schedule a delivery for a date and time window' },
  { key: 'see_on_requests_page', label: 'See the request on this Delivery Requests page' },
  { key: 'see_in_route_center', label: 'See the request in Route Command Center' },
  { key: 'add_to_route', label: 'Add the request to a route' },
  { key: 'confirmation_text', label: 'Receive the delivery confirmation text on the test phone' },
];

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function readFunctionError(error: any): Promise<string> {
  try {
    if (error?.context?.text) {
      const t = await error.context.text();
      try { return JSON.parse(t).error || t; } catch { return t; }
    }
  } catch { /* ignore */ }
  return error?.message || String(error);
}

export const money = (n: number | null | undefined) =>
  `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
