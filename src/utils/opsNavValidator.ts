/**
 * OpsNav Validator — Dev-mode check that all opsNavigation paths
 * have corresponding routes. Warns on drift.
 */

import { opsNavigation, type OpsRole } from '@/config/opsNavigation';

/**
 * Validate that every path in opsNavigation appears somewhere in the
 * rendered route tree. Call once on app boot in dev mode.
 *
 * @param registeredPaths — Array of known route path patterns from AppRoutes
 */
export function validateOpsNavigation(registeredPaths?: string[]) {
  if (import.meta.env.PROD) return;

  const allNavPaths: { role: string; path: string; label: string }[] = [];

  for (const [role, items] of Object.entries(opsNavigation)) {
    for (const item of items) {
      allNavPaths.push({ role, path: item.path, label: item.label });
    }
  }

  if (!registeredPaths || registeredPaths.length === 0) {
    // Basic self-check: warn on duplicate paths within a role
    const seen = new Map<string, string>();
    for (const { role, path, label } of allNavPaths) {
      const key = `${role}:${path}`;
      if (seen.has(key)) {
        console.warn(
          `[OpsNavValidator] Duplicate path "${path}" in role "${role}" (labels: "${seen.get(key)}", "${label}")`
        );
      }
      seen.set(key, label);
    }

    // Check for empty roles
    for (const [role, items] of Object.entries(opsNavigation)) {
      if (items.length === 0) {
        console.warn(`[OpsNavValidator] Role "${role}" has zero nav items`);
      }
      if (items.length > 5) {
        console.warn(
          `[OpsNavValidator] Role "${role}" has ${items.length} nav items (max recommended: 5)`
        );
      }
    }

    console.info(
      `[OpsNavValidator] ✅ Validated ${allNavPaths.length} nav items across ${Object.keys(opsNavigation).length} roles`
    );
    return;
  }

  // Deep check against registered routes
  for (const { role, path, label } of allNavPaths) {
    const matched = registeredPaths.some(
      (rp) => path === rp || path.startsWith(rp.replace('/*', ''))
    );
    if (!matched) {
      console.warn(
        `[OpsNavValidator] ⚠️ Nav item "${label}" (role: ${role}) points to "${path}" which has no matching route`
      );
    }
  }
}
