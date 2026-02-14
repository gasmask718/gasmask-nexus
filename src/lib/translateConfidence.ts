// Phase 8: Confidence Translation Function
// Apply approved corrections to display confidence
// This is a pure, stateless function for translating raw → displayed confidence

export interface ConfidenceCorrectionRule {
  id: string;
  scope_type: 'global' | 'sla' | 'risk' | 'territory';
  scope_value: string | null;
  confidence_min: number;
  confidence_max: number;
  display_offset: number;
}

export interface TranslatedConfidenceResult {
  raw: number;
  displayed: number;
  corrected: boolean;
  appliedCorrectionId?: string;
}

/**
 * Translate raw confidence to displayed confidence using approved correction rules
 * Deterministic matching: exact scope first, then global, then smallest range wins
 * @param raw Raw confidence value (0–100)
 * @param ctx Context for matching (sla, risk, territory)
 * @param corrections Approved correction rules
 * @returns Translated confidence with metadata
 */
export function translateConfidence(
  raw: number,
  ctx: { sla?: string; risk?: string; territory?: string } | undefined,
  corrections: ConfidenceCorrectionRule[]
): TranslatedConfidenceResult {
  // Clamp raw to 0–100
  const clampedRaw = Math.max(0, Math.min(100, raw));

  // Find best matching correction rule
  let bestMatch: ConfidenceCorrectionRule | null = null;
  let matchPriority = -1;

  for (const correction of corrections) {
    // Skip if raw is not in range
    if (clampedRaw < correction.confidence_min || clampedRaw > correction.confidence_max) {
      continue;
    }

    let priority = 0;

    // Exact scope matches get highest priority
    if (correction.scope_type === 'sla' && ctx?.sla === correction.scope_value) {
      priority = 100;
    } else if (correction.scope_type === 'risk' && ctx?.risk === correction.scope_value) {
      priority = 100;
    } else if (correction.scope_type === 'territory' && ctx?.territory === correction.scope_value) {
      priority = 100;
    } else if (correction.scope_type === 'global') {
      // Global matches are fallback
      priority = 50;
    }

    // Within same priority, prefer smaller range (more specific)
    const rangeSize = correction.confidence_max - correction.confidence_min;

    if (priority > matchPriority || (priority === matchPriority && (!bestMatch || rangeSize < (bestMatch.confidence_max - bestMatch.confidence_min)))) {
      matchPriority = priority;
      bestMatch = correction;
    }
  }

  // No correction applied
  if (!bestMatch) {
    return {
      raw: clampedRaw,
      displayed: clampedRaw,
      corrected: false,
    };
  }

  // Apply offset and clamp to 0–100
  const displayed = Math.max(0, Math.min(100, clampedRaw + bestMatch.display_offset));

  return {
    raw: clampedRaw,
    displayed,
    corrected: true,
    appliedCorrectionId: bestMatch.id,
  };
}
