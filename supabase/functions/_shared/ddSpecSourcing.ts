// Dynasty Direct — automatic shipping-spec sourcing.
//
// Finds PACKAGED shipping weight + dimensions for a physical product from
// trusted online sources, verifies the page really is the same product using
// strong identifiers, normalizes to the canonical units the shipping
// calculator expects (ounces / inches) and records full provenance.
//
// It NEVER invents values. No trustworthy exact match => status 'not_found'
// and nothing is written to weight_oz / length_in / width_in / height_in.

import { resolveSerpApiKey } from "./marketPrice.ts";

export type SpecStatus =
  | "confirmed"
  | "high_confidence"
  | "needs_review"
  | "not_found"
  | "sourcing"
  | "manual";

export interface ProductIdentifiers {
  id: string;
  product_name: string;
  brand: string | null;
  upc: string | null;
  gtin: string | null;
  supplier_sku: string | null;
  sku: string | null;
  size_or_count: string | null;
  package_text: string | null;
  flavor_or_variant: string | null;
  units_per_case: number | null;
  case_qty: number | null;
  item_type: string | null;
}

export interface SpecCandidate {
  weight_oz: number | null;
  length_in: number | null;
  width_in: number | null;
  height_in: number | null;
  /** true when the source clearly described package/shipping values. */
  packaged: boolean;
  source_url: string;
  source_name: string;
  matched_on: string[];
  raw: Record<string, unknown>;
  retrieved_at: string;
  score: number;
}

export interface SourcingResult {
  status: SpecStatus;
  chosen: SpecCandidate | null;
  candidates: SpecCandidate[];
  identifier_key: string | null;
  sources_tried: string[];
  reason: string;
}

/* ------------------------------- units --------------------------------- */

export function toOunces(value: number, unit: string): number | null {
  const u = unit.toLowerCase().trim();
  if (!isFinite(value) || value <= 0) return null;
  if (/^(oz|ounce|ounces)$/.test(u)) return value;
  if (/^(lb|lbs|pound|pounds)$/.test(u)) return value * 16;
  if (/^(g|gram|grams)$/.test(u)) return value * 0.0352739619;
  if (/^(kg|kilogram|kilograms)$/.test(u)) return value * 35.2739619;
  return null;
}

export function toInches(value: number, unit: string): number | null {
  const u = unit.toLowerCase().trim();
  if (!isFinite(value) || value <= 0) return null;
  if (/^(in|inch|inches|")$/.test(u)) return value;
  if (/^(ft|foot|feet)$/.test(u)) return value * 12;
  if (/^(cm|centimeter|centimeters|centimetre|centimetres)$/.test(u)) return value / 2.54;
  if (/^(mm|millimeter|millimeters|millimetre|millimetres)$/.test(u)) return value / 25.4;
  if (/^(m|meter|meters|metre|metres)$/.test(u)) return value * 39.3700787;
  return null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/* ---------------------------- identifiers ------------------------------ */

const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");

export function identifierKey(p: ProductIdentifiers): string | null {
  const gt = digits(p.gtin) || digits(p.upc);
  if (gt.length >= 8) return `gtin:${gt}`;
  const sku = (p.supplier_sku || p.sku || "").trim().toLowerCase();
  if (sku) return `sku:${sku}`;
  const name = `${p.brand ?? ""} ${p.product_name ?? ""} ${p.size_or_count ?? ""}`
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return name ? `name:${name}` : null;
}

/** Search queries, strongest identifier first. */
export function buildQueries(p: ProductIdentifiers): string[] {
  // Without these exclusions the spec phrases pull in shipping-calculator and
  // carrier help pages instead of product listings.
  const NEG = ` -calculator -"dimensional weight" -inurl:calculator`;
  const q: string[] = [];
  const gt = digits(p.gtin) || digits(p.upc);
  if (gt.length >= 8) {
    // The bare barcode surfaces barcode databases and retailer listings that
    // carry both the identifier and a package-dimensions block.
    q.push(`"${gt}"`);
    q.push(`"${gt}" "package dimensions"${NEG}`);
  }
  const sku = (p.supplier_sku || p.sku || "").trim();
  if (sku) {
    q.push(`${p.brand ?? ""} "${sku}" "package dimensions"${NEG}`.trim());
    q.push(`${p.brand ?? ""} "${sku}" "shipping weight"${NEG}`.trim());
  }
  const desc = [p.brand, p.product_name, p.size_or_count, p.flavor_or_variant]
    .filter(Boolean).join(" ");
  if (desc) q.push(`${desc} "package dimensions" "item weight"${NEG}`);
  return q.slice(0, 4);
}

/* ------------------------- candidate discovery ------------------------- */

type SearchLink = { url: string; title: string; snippet: string };

/**
 * Search snippets matter as much as the page body: large retailers serve a
 * bot page with the spec table stripped, while the indexed snippet still
 * carries "Package Dimensions … ; 12.8 ounces".
 */
async function serpApiLinks(key: string, query: string): Promise<SearchLink[]> {
  const url = `https://serpapi.com/search.json?engine=google&num=10&gl=us&hl=en&google_domain=google.com&q=${encodeURIComponent(query)}&api_key=${key}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const j = await res.json().catch(() => null) as any;
  const out: SearchLink[] = [];
  const snippetOf = (r: any) => {
    const parts = [r?.snippet, ...(r?.rich_snippet?.bottom?.extensions ?? []),
      ...(r?.rich_snippet?.top?.extensions ?? []), ...(r?.snippet_highlighted_words ?? [])];
    return parts.filter((x: unknown) => typeof x === "string").join(" | ");
  };
  for (const r of (j?.organic_results ?? [])) {
    if (typeof r?.link === "string") {
      out.push({ url: r.link, title: String(r.title ?? ""), snippet: snippetOf(r) });
    }
  }
  for (const r of (j?.shopping_results ?? [])) {
    if (typeof r?.link === "string") {
      out.push({ url: r.link, title: String(r.title ?? ""), snippet: snippetOf(r) });
    }
  }
  return out;
}

/**
 * Non-US storefronts sell different pack/packaging variants — never trust them.
 * Allow-list, not block-list: anything outside these generic/US endings (or any
 * `something.co.xx` / `something.com.xx` country storefront) is rejected, so a
 * new country domain can never slip through by simply not being listed.
 */
const US_TLD = /\.(com|net|org|us|edu|gov|shop|store|biz|info)$/;
const COUNTRY_SECOND_LEVEL = /\.(co|com|net|org|ac|gov)\.[a-z]{2}$/;

function isForeignHost(host: string): boolean {
  if (COUNTRY_SECOND_LEVEL.test(host)) return true;
  return !US_TLD.test(host);
}

/** Ranking of a host as a spec source (higher = more trusted). 0 = reject. */
function hostScore(url: string, p: ProductIdentifiers): number {
  let host = "";
  try { host = new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return 0; }
  if (FOREIGN_TLD.test(host)) return 0;
  const brand = (p.brand ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (brand.length >= 4 && host.replace(/[^a-z0-9]/g, "").includes(brand)) return 100; // manufacturer
  if (/(^|\.)(amazon|walmart|target|homedepot|lowes|staples|officedepot|costco|samsclub|bhphotovideo|newegg|webstaurantstore|uline)\./.test(`.${host}.`)) return 70;
  if (/(upcitemdb|barcodelookup|go-upc|upcdatabase)\./.test(`.${host}.`)) return 55;
  return 40;
}

/**
 * Per-seller marketplace listings can describe their own repackaging, so they
 * may be shown as review candidates but never auto-applied.
 */
export function isAutoApplyHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return !/(^|\.)(ebay|aliexpress|etsy|mercari|poshmark|wish|alibaba|dhgate|temu)\./.test(`.${host}.`);
  } catch { return false; }
}

/* --------------------------- page extraction --------------------------- */

const UNIT_W = "(?:oz|ounces?|lbs?|pounds?|g|grams?|kg|kilograms?)";
const UNIT_L = "(?:in|inch(?:es)?|\"|cm|mm|ft|feet|m)";

interface Extracted {
  weight: { value: number; unit: string; packaged: boolean } | null;
  dims: { l: number; w: number; h: number; unit: string; packaged: boolean } | null;
  gtins: string[];
  mpns: string[];
  title: string;
  raw: Record<string, unknown>;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ");
}

function collectJsonLd(html: string): any[] {
  const out: any[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1].trim());
      Array.isArray(parsed) ? out.push(...parsed) : out.push(parsed);
    } catch { /* ignore malformed blocks */ }
  }
  return out;
}

export function extractFromHtml(html: string): Extracted {
  const text = stripHtml(html);
  const raw: Record<string, unknown> = {};
  const gtins: string[] = [];
  const mpns: string[] = [];
  let weight: Extracted["weight"] = null;
  let dims: Extracted["dims"] = null;
  let title = "";

  // 1. structured data (most reliable)
  for (const node of collectJsonLd(html)) {
    const types = ([] as string[]).concat(node?.["@type"] ?? []);
    if (!types.some((t) => String(t).toLowerCase() === "product")) continue;
    title ||= String(node.name ?? "");
    for (const k of ["gtin", "gtin8", "gtin12", "gtin13", "gtin14", "sku"]) {
      const v = digits(node[k]); if (v.length >= 8) gtins.push(v);
    }
    if (node.mpn) mpns.push(String(node.mpn).trim().toLowerCase());
    if (node.model) mpns.push(String(node.model).trim().toLowerCase());
    const wq = node.weight?.value ?? node.weight?.["@value"];
    const wu = node.weight?.unitCode ?? node.weight?.unitText;
    if (wq && wu) {
      const unit = String(wu).replace("ONZ", "oz").replace("LBR", "lb").replace("GRM", "g").replace("KGM", "kg");
      weight = { value: Number(wq), unit, packaged: false };
      raw.jsonld_weight = node.weight;
    }
    const dget = (key: string) => {
      const d = node[key];
      if (!d) return null;
      const v = Number(d.value ?? d["@value"]);
      const u = String(d.unitCode ?? d.unitText ?? "in").replace("INH", "in").replace("CMT", "cm").replace("MMT", "mm");
      return isFinite(v) && v > 0 ? { v, u } : null;
    };
    const L = dget("depth") ?? dget("length"), W = dget("width"), H = dget("height");
    if (L && W && H) {
      dims = { l: L.v, w: W.v, h: H.v, unit: L.u, packaged: false };
      raw.jsonld_dims = { depth: node.depth, width: node.width, height: node.height };
    }
  }

  // 2. labelled spec text — this is where PACKAGE values live.
  // Retailers separate the label from the numbers with colons, bidi marks and
  // whitespace, so a short run of non-digits is tolerated between them.
  const SEP = `[^0-9]{0,40}?`;
  const dimLabel = new RegExp(
    `(package|shipping|carton|box|product|item|assembled)\\s*dimensions?${SEP}` +
    `([\\d.]+)\\s*${UNIT_L}?\\s*[x×]\\s*([\\d.]+)\\s*${UNIT_L}?\\s*[x×]\\s*([\\d.]+)\\s*(${UNIT_L})?` +
    `(?:\\s*[;,]\\s*([\\d.]+)\\s*(${UNIT_W}))?`,
    "i",
  );
  const dm = text.match(dimLabel);
  if (dm) {
    const packaged = /package|shipping|carton|box/i.test(dm[1]);
    const unit = (dm[5] || "in").toLowerCase();
    const cand = { l: Number(dm[2]), w: Number(dm[3]), h: Number(dm[4]), unit, packaged };
    if ([cand.l, cand.w, cand.h].every((n) => isFinite(n) && n > 0) && (packaged || !dims)) {
      dims = cand;
      raw.dims_text = dm[0];
    }
    // Trailing "… inches; 12.8 ounces" form.
    if (dm[6] && dm[7] && Number(dm[6]) > 0) {
      weight = { value: Number(dm[6]), unit: dm[7].toLowerCase(), packaged };
      raw.weight_text = `${dm[6]} ${dm[7]}`;
    }
  }

  const wLabel = new RegExp(
    `(shipping|package|item|product|net|gross)\\s*weight${SEP}([\\d.]+)\\s*(${UNIT_W})`,
    "i",
  );
  const wm = text.match(wLabel);
  if (wm) {
    const packaged = /shipping|package|gross/i.test(wm[1]);
    const cand = { value: Number(wm[2]), unit: wm[3].toLowerCase(), packaged };
    if (isFinite(cand.value) && cand.value > 0 && (packaged || !weight)) {
      weight = cand;
      raw.weight_text = wm[0];
    }
  }

  // 3. identifiers in plain text
  // Bare 12-14 digit runs are collected too: they are only ever compared
  // against OUR barcode, so a stray number can never create a false match.
  let bare = 0;
  for (const m1 of text.matchAll(/\b\d{12,14}\b/g)) {
    gtins.push(m1[0]);
    if (++bare >= 80) break;
  }
  for (const m2 of text.matchAll(/\b(?:upc|ean|gtin)\s*[:#]?\s*([0-9\s-]{8,20})/gi)) {
    const v = digits(m2[1]); if (v.length >= 8) gtins.push(v);
  }
  for (const m3 of text.matchAll(/\b(?:mpn|model(?:\s*number)?|part\s*(?:number|no\.?))\s*[:#]?\s*([A-Za-z0-9._\-\/]{3,32})/gi)) {
    mpns.push(m3[1].trim().toLowerCase());
  }
  if (!title) title = (html.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i)?.[1] ?? "").trim();

  return { weight, dims, gtins: [...new Set(gtins)], mpns: [...new Set(mpns)], title, raw };
}

/* ---------------------------- exact matching --------------------------- */

const PACK_RE = /(\d+)\s*(?:ct|count|pack|pk|pcs|pieces|rolls?|booklets?|sheets?)\b/i;

function packCount(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = String(s).match(PACK_RE);
  return m ? Number(m[1]) : null;
}

export function verifyMatch(
  p: ProductIdentifiers,
  ex: Extracted,
  pageUrl = "",
): { ok: boolean; matched_on: string[]; reason: string } {
  const urlDigits = pageUrl.replace(/\D/g, "");
  const matched: string[] = [];
  const ourGtin = digits(p.gtin) || digits(p.upc);
  const last12 = (s: string) => s.replace(/^0+/, "");
  if (ourGtin.length >= 8 &&
    (ex.gtins.some((g) => last12(g) === last12(ourGtin)) || urlDigits.includes(ourGtin))) {
    matched.push("gtin");
  }
  const title = ex.title.toLowerCase();
  const brand = (p.brand ?? "").toLowerCase().trim();
  // Listings shorten brands ("Rubbermaid Commercial" -> "Rubbermaid®"), so the
  // leading brand token counts as a brand match.
  const brandRoot = brand.split(/[\s®™,-]+/).filter(Boolean)[0] ?? "";
  const brandOk = !!brand && (title.includes(brand) || (brandRoot.length >= 4 && title.includes(brandRoot)));
  if (brandOk) matched.push("brand");

  const sku = (p.supplier_sku || p.sku || "").trim().toLowerCase();
  if (sku) {
    const inMpn = ex.mpns.includes(sku);
    const inTitle = title.includes(sku);
    const inUrl = pageUrl.toLowerCase().includes(sku);
    // A model number quoted loosely in a listing for a DIFFERENT item (e.g. a
    // "fits 2407-20" accessory) must not count as an exact match.
    if (inMpn || ((inTitle || inUrl) && brandOk)) matched.push("mpn_sku");
  }

  // Pack / count / size configuration must agree when we know ours.
  const ourPack = packCount(p.size_or_count) ?? packCount(p.package_text) ?? packCount(p.product_name);
  const theirPack = packCount(ex.title);
  if (ourPack != null && theirPack != null && ourPack !== theirPack) {
    return { ok: false, matched_on: matched, reason: `pack_mismatch:${ourPack}_vs_${theirPack}` };
  }
  if (ourPack != null && theirPack != null && ourPack === theirPack) matched.push("pack_count");

  // Never inherit case-pack specs for a single unit.
  if ((p.units_per_case ?? 0) <= 1 && /\b(case|carton|display box|master case)\b/i.test(ex.title)) {
    return { ok: false, matched_on: matched, reason: "case_pack_source_for_single_unit" };
  }

  if (matched.includes("gtin") || matched.includes("mpn_sku")) {
    return { ok: true, matched_on: matched, reason: "strong_identifier" };
  }
  // Title-only evidence is never enough to auto-apply; it can still be a
  // review candidate when brand + pack size both line up.
  if (matched.includes("brand") && matched.includes("pack_count")) {
    return { ok: true, matched_on: matched, reason: "weak_title_match" };
  }
  return { ok: false, matched_on: matched, reason: "no_identifier_match" };
}

/* ------------------------------ pipeline -------------------------------- */

const UA = "Mozilla/5.0 (compatible; DynastyDirectSpecBot/1.0)";

async function fetchPage(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) return null;
    return (await res.text()).slice(0, 600_000);
  } catch { return null; }
}

function candidateFrom(
  url: string,
  ex: Extracted,
  match: { matched_on: string[]; reason: string },
  p: ProductIdentifiers,
): SpecCandidate | null {
  const weight_oz = ex.weight ? toOunces(ex.weight.value, ex.weight.unit) : null;
  let l: number | null = null, w: number | null = null, h: number | null = null;
  if (ex.dims) {
    l = toInches(ex.dims.l, ex.dims.unit);
    w = toInches(ex.dims.w, ex.dims.unit);
    h = toInches(ex.dims.h, ex.dims.unit);
  }
  if (!weight_oz && !(l && w && h)) return null;
  const packaged = !!(ex.dims?.packaged || ex.weight?.packaged);
  let score = hostScore(url, p);
  if (match.matched_on.includes("gtin")) score += 60;
  if (match.matched_on.includes("mpn_sku")) score += 40;
  if (packaged) score += 25;
  if (weight_oz && l && w && h) score += 20;
  let source_name = url;
  try { source_name = new URL(url).hostname.replace(/^www\./, ""); } catch { /* keep url */ }
  return {
    weight_oz: weight_oz ? round2(weight_oz) : null,
    length_in: l ? round2(l) : null,
    width_in: w ? round2(w) : null,
    height_in: h ? round2(h) : null,
    packaged,
    source_url: url,
    source_name,
    matched_on: match.matched_on,
    raw: { ...ex.raw, source_title: ex.title, match_reason: match.reason },
    retrieved_at: new Date().toISOString(),
    score,
  };
}

const conflicts = (a: SpecCandidate, b: SpecCandidate): boolean => {
  const diff = (x: number | null, y: number | null) =>
    x != null && y != null && Math.abs(x - y) / Math.max(x, y) > 0.15;
  return diff(a.weight_oz, b.weight_oz) || diff(a.length_in, b.length_in) ||
    diff(a.width_in, b.width_in) || diff(a.height_in, b.height_in);
};

/**
 * Barcode-database adapter (UPCitemdb). Structured, identifier-keyed and free
 * of page scraping. Its dimension field is not explicitly package-vs-item, so
 * results from it never auto-apply on their own.
 */
async function upcItemDbCandidate(p: ProductIdentifiers): Promise<SpecCandidate | null> {
  const gt = digits(p.gtin) || digits(p.upc);
  if (gt.length < 8) return null;
  try {
    const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${gt}`, {
      headers: { Accept: "application/json", "User-Agent": UA },
    });
    if (!res.ok) return null;
    const j = await res.json() as any;
    const item = j?.items?.[0];
    if (!item) return null;
    let l: number | null = null, w: number | null = null, h: number | null = null;
    const dm = String(item.dimension ?? "").match(/([\d.]+)\s*[xX]\s*([\d.]+)\s*[xX]\s*([\d.]+)/);
    if (dm) { l = Number(dm[1]); w = Number(dm[2]); h = Number(dm[3]); }
    let weight_oz: number | null = null;
    const wm = String(item.weight ?? "").match(/([\d.]+)\s*([A-Za-z]+)/);
    if (wm) weight_oz = toOunces(Number(wm[1]), wm[2]);
    if (!weight_oz && !(l && w && h)) return null;
    return {
      weight_oz: weight_oz ? round2(weight_oz) : null,
      length_in: l ? round2(l) : null,
      width_in: w ? round2(w) : null,
      height_in: h ? round2(h) : null,
      packaged: false,
      source_url: `https://www.upcitemdb.com/upc/${gt}`,
      source_name: "upcitemdb.com",
      matched_on: ["gtin"],
      raw: { title: item.title, dimension: item.dimension, weight: item.weight, brand: item.brand },
      retrieved_at: new Date().toISOString(),
      score: 95,
    };
  } catch { return null; }
}

export async function sourceShippingSpecs(
  supabase: any,
  p: ProductIdentifiers,
  opts: { maxPages?: number } = {},
): Promise<SourcingResult> {
  const sources_tried: string[] = [];
  const preCandidates: SpecCandidate[] = [];

  const barcodeHit = await upcItemDbCandidate(p);
  sources_tried.push(`upcitemdb:${barcodeHit ? "hit" : "miss"}`);
  if (barcodeHit) preCandidates.push(barcodeHit);

  const key = await resolveSerpApiKey(supabase);
  if (!key) {
    if (preCandidates.length) {
      return {
        status: "needs_review", chosen: null, candidates: preCandidates,
        identifier_key: identifierKey(p), sources_tried, reason: "barcode_database_only",
      };
    }
    return {
      status: "not_found", chosen: null, candidates: [], identifier_key: identifierKey(p),
      sources_tried, reason: "no_search_provider_configured",
    };
  }


  const seen = new Set<string>();
  const links: SearchLink[] = [];
  for (const q of buildQueries(p)) {
    sources_tried.push(`serpapi:${q}`);
    for (const l of await serpApiLinks(key, q)) {
      if (seen.has(l.url)) continue;
      seen.add(l.url);
      links.push(l);
    }
    if (links.length >= 12) break;
  }

  const usable = links.filter((l) => {
    if (hostScore(l.url, p) > 0) return true;
    sources_tried.push(`rejected:foreign_storefront:${l.url}`);
    return false;
  });
  usable.sort((a, b) => hostScore(b.url, p) - hostScore(a.url, p));
  const maxPages = opts.maxPages ?? 8;

  const candidates: SpecCandidate[] = [...preCandidates];
  sources_tried.push(`links_found:${usable.length}`);
  for (const link of usable.slice(0, maxPages)) {
    const html = await fetchPage(link.url);
    if (!html) sources_tried.push(`fetch_failed:${link.url}`);
    const body = `${html ?? ""}\n${link.title}\n${link.snippet}`;
    if (!body.trim()) continue;
    const ex = extractFromHtml(body);
    if (!ex.title) ex.title = link.title;
    const match = verifyMatch(p, ex, link.url);
    if (!match.ok) { sources_tried.push(`rejected:${match.reason}:${link.url}`); continue; }
    const cand = candidateFrom(link.url, ex, match, p);
    if (cand) candidates.push(cand);
    else sources_tried.push(`no_specs_on_page:${link.url}`);
    if (candidates.length >= 4) break;
  }

  if (candidates.length === 0) {
    return {
      status: "not_found", chosen: null, candidates: [], identifier_key: identifierKey(p),
      sources_tried, reason: "no_verified_source_with_specs",
    };
  }

  candidates.sort((a, b) => b.score - a.score);
  const isStrong = (c: SpecCandidate) =>
    c.matched_on.includes("gtin") || c.matched_on.includes("mpn_sku");

  // Real listings often carry the package dimensions on one page and the
  // shipping weight on another. Combining them is only allowed when BOTH parts
  // came from an exact-identifier match and are labelled as package/shipping
  // values — never by inferring a missing half.
  let best = candidates[0];
  let composed_from: string | null = null;
  const autoOk = (c: SpecCandidate) => isStrong(c) && c.packaged && isAutoApplyHost(c.source_url);
  if (autoOk(best)) {
    const hasDims = !!(best.length_in && best.width_in && best.height_in);
    if (hasDims && !best.weight_oz) {
      const w = candidates.find((c) => c !== best && c.weight_oz && autoOk(c));
      if (w) { best = { ...best, weight_oz: w.weight_oz, raw: { ...best.raw, weight_from: w.source_url, weight_text: w.raw?.weight_text } }; composed_from = w.source_url; }
    } else if (!hasDims && best.weight_oz) {
      const d = candidates.find((c) => c !== best && c.length_in && c.width_in && c.height_in && autoOk(c));
      if (d) { best = { ...best, length_in: d.length_in, width_in: d.width_in, height_in: d.height_in, raw: { ...best.raw, dims_from: d.source_url, dims_text: d.raw?.dims_text } }; composed_from = d.source_url; }
    }
  }

  const complete = !!(best.weight_oz && best.length_in && best.width_in && best.height_in);
  const strong = isStrong(best);
  const conflicting = candidates.slice(1).some((c) => conflicts(candidates[0], c));

  if (conflicting) {
    return { status: "needs_review", chosen: null, candidates, identifier_key: identifierKey(p), sources_tried, reason: "sources_conflict" };
  }
  if (strong && complete && best.packaged && isAutoApplyHost(best.source_url)) {
    // Two independent agreeing sources, or the manufacturer's own page.
    const corroborated = !composed_from && (candidates.length > 1 || best.score >= 160);
    return {
      status: corroborated ? "confirmed" : "high_confidence",
      chosen: best, candidates, identifier_key: identifierKey(p), sources_tried,
      reason: composed_from
        ? `composed_packaged_specs:${composed_from}`
        : (corroborated ? "strong_identifier_packaged_specs_corroborated" : "strong_identifier_packaged_specs"),
    };
  }
  if (strong && complete && best.packaged) {
    return {
      status: "needs_review", chosen: null, candidates, identifier_key: identifierKey(p),
      sources_tried, reason: "marketplace_source_needs_review",
    };
  }
  return {
    status: "needs_review", chosen: null, candidates, identifier_key: identifierKey(p), sources_tried,
    reason: !strong ? "weak_identifier_match" : (!complete ? "incomplete_specs" : "item_dimensions_only"),
  };
}
