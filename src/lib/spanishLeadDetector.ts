/**
 * spanishLeadDetector — Heuristic to identify Spanish/Mexican-language leads.
 * Scans business_name, industry, category, subtypes, full_name for
 * Spanish-language tokens or Hispanic business markers.
 */

const SPANISH_TOKENS = [
  // Industry / occupation (Spanish)
  'restaurante', 'taqueria', 'taquería', 'taco', 'tacos',
  'plomero', 'plomeria', 'plomería',
  'electricista', 'mecanico', 'mecánico', 'mecanica', 'mecánica',
  'pintor', 'pintura', 'construccion', 'construcción',
  'salon de belleza', 'salón de belleza', 'peluqueria', 'peluquería',
  'panaderia', 'panadería', 'carniceria', 'carnicería',
  'tienda', 'mercado', 'cocina', 'comida', 'cafeteria', 'cafetería',
  'servicio de limpieza', 'limpieza', 'jardineria', 'jardinería',
  'lavanderia', 'lavandería', 'farmacia', 'zapateria', 'zapatería',
  'ferreteria', 'ferretería', 'mueblería', 'muebleria',
  // Business name markers
  'mexicano', 'mexicana', 'mexicano', 'hacienda', 'cantina',
  'hispano', 'hispana', 'latino', 'latina', 'latinx',
  'azteca', 'maya', 'mariachi', 'fiesta',
  'señor', 'senor', 'señora', 'senora',
];

const SPANISH_NAME_PREFIXES = [
  'el ', 'la ', 'los ', 'las ', 'don ', 'doña ', 'dona ',
  'casa ', 'mi ', 'su ', 'tres ', 'dos ', 'uno ',
];

const SPANISH_KEYWORDS = ['mexican', 'spanish', 'hispanic', 'latino', 'latina'];

export interface SpanishCandidate {
  business_name?: string | null;
  industry?: string | null;
  category?: string | null;
  subtypes?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

export function isSpanishLead(lead: SpanishCandidate | null | undefined): boolean {
  if (!lead) return false;
  const haystack = [
    lead.business_name,
    lead.industry,
    lead.category,
    lead.subtypes,
    lead.full_name,
    lead.first_name,
    lead.last_name,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!haystack) return false;

  if (SPANISH_KEYWORDS.some((k) => haystack.includes(k))) return true;
  if (SPANISH_TOKENS.some((t) => haystack.includes(t))) return true;

  const name = (lead.business_name || '').toLowerCase().trim();
  if (SPANISH_NAME_PREFIXES.some((p) => name.startsWith(p))) return true;

  return false;
}

export function spanishBadge(lead: SpanishCandidate | null | undefined) {
  return isSpanishLead(lead) ? 'ES' : null;
}
