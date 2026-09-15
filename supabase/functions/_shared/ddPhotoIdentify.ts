// Dynasty Direct — photo → product identity.
//
// This module ONLY reads what is visibly printed on a product photo and decides
// whether that is enough to name the exact product. It never guesses identity
// from a logo or a package shape, and it never produces shipping numbers: the
// existing sourcing service (_shared/ddSpecSourcing.ts) stays the single place
// where weight and dimensions come from.

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const VISION_MODEL = "google/gemini-2.5-pro";

export type PhotoIdStatus =
  | "identified"
  | "likely_match"
  | "needs_more_photos"
  | "not_identified";

export interface PhotoIdentifiers {
  barcode_digits: string | null;
  barcode_symbology: string | null;
  brand: string | null;
  product_name: string | null;
  model_mpn: string | null;
  sku: string | null;
  size_or_count: string | null;
  pack_count: number | null;
  flavor_or_variant: string | null;
  package_text: string | null;
}

export interface PhotoIdResult {
  status: PhotoIdStatus;
  reason: string;
  /** What the admin should photograph next when evidence is thin. */
  next_photo_hint: string | null;
  identifiers: PhotoIdentifiers;
  gtin_valid: boolean;
  text_legible: boolean;
  vision_confidence: "low" | "medium" | "high";
  method: string[];
  photos_read: number;
  read_at: string;
  raw: Record<string, unknown>;
}

/** GS1 check digit — the difference between a read barcode and a guessed one. */
export function gtinCheckDigitValid(raw: string | null | undefined): boolean {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (![8, 12, 13, 14].includes(d.length)) return false;
  const digits = d.split("").map(Number);
  const check = digits.pop()!;
  let sum = 0;
  // Weight 3 applies to the right-most body digit, alternating outward.
  for (let i = digits.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) {
    sum += digits[i] * w;
  }
  return (10 - (sum % 10)) % 10 === check;
}

function firstPackCount(text: string | null | undefined): number | null {
  const m = String(text ?? "").match(/(\d{1,4})\s*(?:ct|count|pack|pk|pcs|pieces)\b/i);
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

const PROMPT = `You are reading PRINTED TEXT AND BARCODES on a retail product photo in order to identify the EXACT product.

Rules you must obey:
- Report ONLY what is actually legible in the image. Never use product knowledge, never infer from a logo, colour or package shape.
- If a barcode is visible, read its digits exactly. If the digits are blurred or partially hidden, set barcode_digits to null and say so in notes.
- size/count, flavour/variant and pack count must come from printed text. A 10-count and a 20-count of the same product are DIFFERENT products.
- If the photo is a generic/unbranded item or the text is unreadable, say so rather than naming a product.

Return STRICT JSON only:
{
  "product_visible": true|false,
  "text_legible": true|false,
  "barcode_visible": true|false,
  "barcode_digits": "<digits only|null>",
  "barcode_symbology": "UPC-A|EAN-13|EAN-8|ITF-14|other|null",
  "brand": "<exactly as printed|null>",
  "product_name": "<exactly as printed|null>",
  "model_mpn": "<model or MPN printed on the package|null>",
  "sku": "<SKU/item number printed on the package|null>",
  "size_or_count": "<e.g. '12 oz', '20 ct'|null>",
  "pack_count": <number|null>,
  "flavor_or_variant": "<null if none printed>",
  "package_text": "<other distinctive printed text|null>",
  "confidence": "low|medium|high",
  "notes": "<one short sentence on what you could and could not read>"
}`;

function parseJson(text: string): Record<string, unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1) return {};
  try { return JSON.parse(body.slice(start, end + 1)); } catch { return {}; }
}

function str(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s && s.toLowerCase() !== "null" && s.toLowerCase() !== "none" ? s : null;
}

/**
 * Read one or more photos of the SAME product and decide how confidently it is
 * identified. Extra photos (back label, barcode) only ever add evidence.
 */
export async function identifyProductFromPhotos(
  photoUrls: string[],
  apiKey: string,
): Promise<PhotoIdResult> {
  const urls = photoUrls.filter(Boolean).slice(0, 4);
  const read_at = new Date().toISOString();
  const empty: PhotoIdentifiers = {
    barcode_digits: null, barcode_symbology: null, brand: null, product_name: null,
    model_mpn: null, sku: null, size_or_count: null, pack_count: null,
    flavor_or_variant: null, package_text: null,
  };

  if (urls.length === 0) {
    return {
      status: "needs_more_photos", reason: "no_photo",
      next_photo_hint: "Take a photo of the product front, then the barcode.",
      identifiers: empty, gtin_valid: false, text_legible: false,
      vision_confidence: "low", method: [], photos_read: 0, read_at, raw: {},
    };
  }

  const content: unknown[] = [{ type: "text", text: PROMPT }];
  for (const u of urls) content.push({ type: "image_url", image_url: { url: u } });

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: VISION_MODEL, messages: [{ role: "user", content }] }),
  });
  if (res.status === 429) throw new Error("rate_limited_by_ai_gateway");
  if (res.status === 402) throw new Error("ai_credits_exhausted");
  if (!res.ok) throw new Error(`vision_${res.status}: ${(await res.text()).slice(0, 300)}`);

  const j = await res.json();
  const p = parseJson(String(j?.choices?.[0]?.message?.content ?? ""));

  const barcode = str(p.barcode_digits)?.replace(/\D/g, "") ?? null;
  const gtin_valid = gtinCheckDigitValid(barcode);
  const identifiers: PhotoIdentifiers = {
    barcode_digits: barcode,
    barcode_symbology: str(p.barcode_symbology),
    brand: str(p.brand),
    product_name: str(p.product_name),
    model_mpn: str(p.model_mpn),
    sku: str(p.sku),
    size_or_count: str(p.size_or_count),
    pack_count: Number.isFinite(Number(p.pack_count)) && Number(p.pack_count) > 0
      ? Number(p.pack_count)
      : firstPackCount(str(p.size_or_count)),
    flavor_or_variant: str(p.flavor_or_variant),
    package_text: str(p.package_text),
  };

  const text_legible = p.text_legible !== false;
  const vision_confidence = (["low", "medium", "high"].includes(String(p.confidence))
    ? String(p.confidence)
    : "low") as "low" | "medium" | "high";

  const method: string[] = [];
  if (gtin_valid) method.push("barcode");
  if (identifiers.model_mpn || identifiers.sku) method.push("printed_model");
  if (identifiers.brand && identifiers.product_name) method.push("printed_name");
  if (identifiers.size_or_count || identifiers.pack_count) method.push("printed_size");

  // ---- confidence gate -------------------------------------------------
  let status: PhotoIdStatus;
  let reason: string;
  let next_photo_hint: string | null = null;

  const namedProduct = !!(identifiers.brand && identifiers.product_name);
  const sizeKnown = !!(identifiers.size_or_count || identifiers.pack_count);

  if (p.product_visible === false || (!namedProduct && !gtin_valid && !identifiers.model_mpn)) {
    status = "not_identified";
    reason = !text_legible ? "package_text_not_legible" : "no_identifying_text";
    next_photo_hint = "Take a clear photo of the barcode or back label.";
  } else if (gtin_valid) {
    // A checksum-valid barcode is the strongest evidence there is.
    status = "identified";
    reason = "barcode_read_and_checksum_valid";
  } else if (namedProduct && identifiers.model_mpn && sizeKnown && vision_confidence !== "low") {
    status = "identified";
    reason = "brand_model_and_package_size_printed";
  } else if (namedProduct && sizeKnown && vision_confidence === "high") {
    status = "likely_match";
    reason = "brand_name_and_size_printed_but_no_barcode_or_model";
    next_photo_hint = "Photograph the barcode to confirm automatically.";
  } else if (namedProduct || identifiers.model_mpn) {
    status = "needs_more_photos";
    reason = barcode && !gtin_valid
      ? "barcode_digits_unreadable_or_invalid"
      : sizeKnown ? "identity_evidence_too_thin" : "package_size_or_count_not_visible";
    next_photo_hint = "Take a clear photo of the barcode or the back label (size / count panel).";
  } else {
    status = "not_identified";
    reason = "no_trustworthy_identifiers";
    next_photo_hint = "Take a clear photo of the barcode or back label.";
  }

  return {
    status, reason, next_photo_hint, identifiers, gtin_valid, text_legible,
    vision_confidence, method, photos_read: urls.length, read_at,
    raw: { notes: str(p.notes), barcode_visible: p.barcode_visible === true, photo_urls: urls },
  };
}
