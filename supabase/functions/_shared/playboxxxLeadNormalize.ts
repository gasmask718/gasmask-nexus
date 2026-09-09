// ═══════════════════════════════════════════════════════════════════════════
// PLAYBOXXX RECRUITING LEAD NORMALIZE
// ═══════════════════════════════════════════════════════════════════════════
//
// Shared normalisation + validation for playboxxx-recruiting-ingest.
// Phone/text normalisation follows the same rules as
// _shared/icwCandidateDedupe.ts (last-10 for NANP, lowercase-alnum for text).
//
// Stage 1 is US-only: business_leads.state is NOT NULL, exactly 2 uppercase
// characters, and constrained to US states/territories. Non-US leads cannot be
// stored yet and are rejected rather than coerced.

export const US_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA',
  'ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK',
  'OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC','PR','VI','GU',
  'AS','MP',
]);

/**
 * Explicit allow-list of semantically valid role → business_leads.category
 * pairings. Anything not listed here is REJECTED — never filed under `other`,
 * never silently misclassified. Adding a role is a deliberate change here.
 */
const ROLE_CATEGORY_MAP: Record<string, string> = {
  // beauty lane
  hair: 'beauty',
  hairdresser: 'beauty',
  hair_makeup: 'beauty',
  'hair/makeup': 'beauty',
  makeup: 'beauty',
  makeup_artist: 'beauty',
  salon: 'beauty',
  hairdressing: 'beauty',
  beauty: 'beauty',
  beauty_salon: 'beauty',
  barber: 'beauty',
  barbershop: 'beauty',
  nails: 'beauty',
  nail: 'beauty',
  nail_salon: 'beauty',
  nail_technician: 'beauty',
  manicurist: 'beauty',
  spa: 'beauty',
  // food lane
  chef: 'private_chef',
  cook: 'private_chef',
  private_chef: 'private_chef',
  catering: 'private_chef',
  caterer: 'private_chef',
  // cleaning lane
  cleaner: 'cleaner',
  cleaning: 'cleaner',
  housekeeping: 'cleaner',
  housekeeper: 'cleaner',
  // decorator lane
  seamstress: 'decorator',
  tailor: 'decorator',
  tailoring: 'decorator',
  dressmaker: 'decorator',
  decorator: 'decorator',
  // florist
  florist: 'florist',
  flowers: 'florist',
  // general staff
  staff: 'staff',
  event_staff: 'staff',
  server: 'staff',
  waiter: 'staff',
  waitress: 'staff',
  usher: 'staff',
  // social / creator lane (Playboxxx recruiting)
  model: 'model',
  creator: 'creator',
  photographer: 'photographer',
  cameraman: 'cameraman',
  videographer: 'videographer',
};

export function roleKey(raw: string | null | undefined): string {
  return (raw ?? '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_/]+/g, '');
}

/** Returns the mapped category, or null when the role is unknown/ambiguous. */
export function mapRoleToCategory(raw: string | null | undefined): string | null {
  const key = roleKey(raw);
  if (!key) return null;
  return ROLE_CATEGORY_MAP[key] ?? ROLE_CATEGORY_MAP[key.replace(/_/g, '/')] ?? null;
}

/** Last-10 digits for NANP numbers; null when not a usable US/CA number. */
export function normalizePhoneLast10(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

/** E.164 for a valid NANP number, otherwise the trimmed original. */
export function normalizePhoneE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const last10 = normalizePhoneLast10(raw);
  if (last10) return `+1${last10}`;
  const trimmed = String(raw).trim();
  return trimmed || null;
}

export function normText(raw: string | null | undefined): string {
  return (raw ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function titleCase(raw: string | null | undefined): string | null {
  const t = (raw ?? '').trim();
  if (!t) return null;
  return t.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

export function cleanText(raw: unknown, max = 500): string | null {
  if (raw === null || raw === undefined) return null;
  const t = String(raw).trim();
  if (!t) return null;
  return t.slice(0, max);
}

/** Instagram handle: strip leading @, keep only alphanumerics/underscores/periods, max 30. */
export function cleanInstagramUsername(raw: unknown): string | null {
  const t = cleanText(raw, 32);
  if (!t) return null;
  return t.replace(/^@+/, '').replace(/[^a-zA-Z0-9_.]/g, '').slice(0, 30) || null;
}

/** Instagram profile URL: accept only instagram.com or null. */
export function cleanInstagramUrl(raw: unknown): string | null {
  const t = cleanText(raw, 300);
  if (!t) return null;
  const lower = t.toLowerCase();
  if (!lower.includes('instagram.com')) return null;
  try {
    const url = new URL(lower.startsWith('http') ? lower : `https://${lower}`);
    if (url.hostname !== 'instagram.com' && !url.hostname.endsWith('.instagram.com')) return null;
    return url.toString().toLowerCase();
  } catch {
    return null;
  }
}

export function toNumberOrNull(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export type RawLead = Record<string, unknown>;

export type NormalizedLead = {
  business: 'playboxxx';
  business_name: string;
  category: string;
  category_original: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  full_address: string | null;
  city: string | null;
  state: string;
  latitude: number | null;
  longitude: number | null;
  external_place_id: string | null;
  external_source: string | null;
  source: string;
  instagram_username: string | null;
  instagram_url: string | null;
  instagram_bio: string | null;
  instagram_followers: number | null;
};

export type NormalizeResult =
  | { ok: true; lead: NormalizedLead; phoneLast10: string | null; nameKey: string }
  | { ok: false; error: string };

/** Validate + normalise a single inbound Make.com lead. */
export function normalizeLead(raw: RawLead, defaultSource: string | null): NormalizeResult {
  const name = cleanText(raw.name ?? raw.business_name ?? raw.title, 300);
  if (!name) return { ok: false, error: 'name is required' };

  const roleRaw = cleanText(raw.role_type ?? raw.role ?? raw.category, 120);
  if (!roleRaw) return { ok: false, error: 'role_type is required' };

  const category = mapRoleToCategory(roleRaw);
  if (!category) {
    return {
      ok: false,
      error: `unrecognised role_type '${roleRaw}' — no valid category mapping`,
    };
  }

  const stateRaw = cleanText(raw.state ?? raw.region, 40);
  if (!stateRaw) return { ok: false, error: 'state is required (2-letter US state)' };
  const state = stateRaw.toUpperCase();
  if (state.length !== 2 || !US_STATES.has(state)) {
    return {
      ok: false,
      error: `state must be a 2-letter US state — got '${stateRaw}'. Non-US leads are not supported in stage 1.`,
    };
  }

  const phoneLast10 = normalizePhoneLast10(raw.phone as string | null | undefined);
  const city = titleCase(cleanText(raw.city, 120));
  const emailRaw = cleanText(raw.email, 250);
  const email = emailRaw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) ? emailRaw.toLowerCase() : null;

  const externalSource =
    cleanText(raw.source ?? raw.external_source, 60) ?? (defaultSource ? defaultSource : null);

  const instagramUsername = cleanInstagramUsername(raw.instagram_username ?? raw.instagram_handle ?? raw.ig_username);
  const instagramUrl = cleanInstagramUrl(raw.instagram_url ?? raw.instagram ?? raw.ig_url);

  return {
    ok: true,
    phoneLast10,
    nameKey: `${normText(name)}|${normText(city)}|${state}`,
    lead: {
      business: 'playboxxx',
      business_name: name,
      category,
      category_original: roleRaw,
      phone: normalizePhoneE164(raw.phone as string | null | undefined),
      email,
      website: cleanText(raw.website ?? raw.url, 500),
      full_address: cleanText(raw.address ?? raw.full_address, 500),
      city,
      state,
      latitude: toNumberOrNull(raw.latitude ?? raw.lat),
      longitude: toNumberOrNull(raw.longitude ?? raw.lng ?? raw.lon),
      external_place_id: cleanText(raw.external_id ?? raw.external_place_id ?? raw.osm_id, 200),
      external_source: externalSource ? externalSource.toLowerCase() : null,
      source: 'playboxxx_make_ingest',
      instagram_username: instagramUsername,
      instagram_url: instagramUrl ?? (instagramUsername ? `https://instagram.com/${instagramUsername}` : null),
      instagram_bio: cleanText(raw.instagram_bio ?? raw.bio, 1000),
      instagram_followers: toNumberOrNull(raw.instagram_followers ?? raw.followers),
    },
  };
}
