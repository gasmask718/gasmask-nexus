/**
 * 🔐 SBO AI ENGINE — SYSTEM IDENTITY LOCK
 * 
 * This file defines the canonical identity for the sports intelligence system.
 * NO duplicate sports engines may exist in Dynasty OS.
 * All sports-related modules MUST reference this config.
 */

export const SBO_IDENTITY = {
  name: 'SBO AI Engine',
  emoji: '🧠',
  routePrefix: '/os/sports-betting',
  moduleId: 'betting',
  
  // Canonical tables — no parallel sports tables allowed
  allowedTables: [
    'sbo_games',
    'sbo_player_props',
    'sbo_predictions',
    'sbo_prop_stat_context',
    'sbo_results_verification',
    'sbo_saved_picks',
    'sbo_team_stats',
    'sbo_model_performance',
    'sbo_book_props',
  ] as const,

  // Blocked name patterns for new modules
  blockedPatterns: [
    'sports os',
    'sports ai os',
    'sports betting ai os',
    'sportsbook os',
    'betting os',
  ] as const,
} as const;

/**
 * Validates that a proposed module name doesn't conflict with SBO AI Engine.
 * Returns error string if conflict detected, null if safe.
 */
export function validateModuleName(name: string): string | null {
  const lower = name.toLowerCase().trim();
  
  // Exact match to SBO is fine
  if (lower === 'sbo ai engine') return null;
  
  for (const pattern of SBO_IDENTITY.blockedPatterns) {
    if (lower.includes(pattern)) {
      return `⚠️ SBO Identity Violation: "${name}" conflicts with SBO AI Engine. Use the existing SBO AI Engine module instead.`;
    }
  }
  return null;
}

/**
 * Validates that a proposed route doesn't create a parallel sports system.
 */
export function validateSportsRoute(path: string): string | null {
  const blockedPrefixes = ['/sports-os', '/sports-ai', '/sportsbook'];
  for (const prefix of blockedPrefixes) {
    if (path.startsWith(prefix)) {
      return `⚠️ SBO Route Violation: "${path}" would create a parallel sports system. Use ${SBO_IDENTITY.routePrefix} instead.`;
    }
  }
  return null;
}

export type SBOTable = typeof SBO_IDENTITY.allowedTables[number];
