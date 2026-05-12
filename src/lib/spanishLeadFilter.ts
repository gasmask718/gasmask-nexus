/**
 * spanishLeadFilter — DB-side filtering helpers for Spanish/Mexican leads.
 * Used to narrow brandaro_qualified_leads to Hispanic / Spanish-language records.
 */

const SPANISH_TOKENS = [
  'restaurante', 'taqueria', 'taco', 'plomero', 'electricista', 'mecanico',
  'mecanica', 'salon de belleza', 'peluqueria', 'panaderia', 'carniceria',
  'cocina', 'lavanderia', 'ferreteria', 'jardineria', 'limpieza', 'tienda',
  'mercado', 'pintor', 'construccion', 'zapateria', 'farmacia', 'cafeteria',
  'mueblería', 'muebleria',
  // English markers
  'mexican', 'hispanic', 'latino', 'latina', 'spanish',
  // Business markers
  'mexicano', 'mexicana', 'hispano', 'cantina', 'hacienda',
  'azteca', 'mariachi', 'fiesta', 'taqueria',
];

const COLUMNS = ['industry', 'business_name', 'category', 'subtypes'];

/**
 * Builds a Supabase `.or()` filter string that matches any Spanish/Mexican token
 * across business_name / industry / category / subtypes columns.
 */
export function spanishOrFilter(): string {
  const parts: string[] = [];
  for (const col of COLUMNS) {
    for (const tok of SPANISH_TOKENS) {
      // Escape commas/parens — none in tokens, so safe.
      parts.push(`${col}.ilike.%${tok}%`);
    }
  }
  return parts.join(',');
}
