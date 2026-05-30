/**
 * Dispatch Registry — single source of truth for which app surfaces
 * have RouteAssignmentDialog / dispatch wiring.
 *
 * Consumed by:
 *   • src/pages/admin/DispatchMap.tsx (reference table)
 *   • src/components/Layout.tsx (green dot in sidebar)
 *
 * When a new surface is dispatch-wired, add it ONCE here and both
 * the DispatchMap reference and the sidebar marker update automatically.
 */

export type DispatchStatus = 'wired' | 'unwired';

export interface DispatchRow {
  /** Display label */
  floor: string;
  /** Route path; may include :params like /stores/:id */
  path?: string;
  /** Plain-English description of what the surface lists */
  shows: string;
  status: DispatchStatus;
  note?: string;
}

export const DISPATCH_REGISTRY: DispatchRow[] = [
  // GREEN — dispatch wired
  { floor: 'Ambassador Profile', path: '/ambassadors/:id', shows: 'Stores owned/managed by an ambassador', status: 'wired' },
  { floor: 'Stores (master list)', path: '/stores', shows: 'All approved stores', status: 'wired' },
  { floor: 'Neighborhood Coverage', path: '/territory/neighborhoods', shows: 'Stores grouped by neighborhood', status: 'wired' },
  { floor: 'Sell-Through', path: '/grabba/sell-through', shows: 'Stores ranked by inventory velocity', status: 'wired' },
  { floor: 'All Opportunities', path: '/crm/opportunities', shows: 'Merged high-intent store signals', status: 'wired' },
  { floor: 'Store Detail', path: '/stores/:id', shows: 'Single store dispatch action', status: 'wired' },
  { floor: 'CRM Follow-Ups', path: '/crm/followups', shows: 'Stores with pending follow-up', status: 'wired' },
  { floor: 'Manual Call console', path: '/communication/manual-call', shows: 'Stores queued for outbound', status: 'wired' },
  { floor: 'Pending Route Stops', path: '/routes/pending-stops', shows: 'Stops awaiting assignment', status: 'wired' },
  { floor: 'Territory Map', path: '/territory/map', shows: 'Geospatial store view', status: 'wired' },

  // Additional wired surfaces (previously labelled RED, now wired)
  { floor: 'Store Intelligence', path: '/grabba/store-intelligence', shows: 'AI-scored stores (0-100)', status: 'wired' },
  { floor: 'Grabba StoreMasterProfile', path: '/grabba/stores/:id', shows: 'Master profile of a single store', status: 'wired' },
  { floor: 'OS NeighborhoodIntelligence', path: '/os/neighborhood-intelligence', shows: 'Neighborhood-level signals + stores', status: 'wired' },
  { floor: 'Floor9 Predictions', path: '/grabba/floor9/predictions', shows: 'Stores predicted to need visit', status: 'wired', note: 'Multi-select + Dispatch Selected + Dispatch All Flagged + per-row Add-to-Route' },
  { floor: 'Grabba ClusterDashboard', path: '/grabba/clusters', shows: 'Stores grouped into clusters', status: 'wired', note: 'Dispatch by Brand panel: brand filter + multi-select + per-row Add-to-Route' },
  { floor: 'Floor1 BrandCRM', path: '/floor1/brand-crm', shows: 'Brand-level CRM store roster', status: 'wired', note: 'Roster: multi-select + Dispatch Selected + per-row Add-to-Route' },
  { floor: 'Ambassador StoresList', path: '/ambassador/stores', shows: 'Ambassador-portal store list', status: 'wired', note: 'Pre-filled assignee = self (ambassador role), RLS-scoped' },
];

/** Strip `:param` segments and trailing slashes so dynamic paths match static sidebar paths. */
const normalizePath = (p?: string): string => {
  if (!p) return '';
  return p.replace(/\/:[^/]+/g, '').replace(/\/+$/, '') || '/';
};

const WIRED_PATHS: Set<string> = new Set(
  DISPATCH_REGISTRY
    .filter(r => r.status === 'wired' && r.path)
    .map(r => normalizePath(r.path)),
);

/** True if the given sidebar path corresponds to a dispatch-wired surface. */
export const isDispatchWired = (path?: string | null): boolean => {
  if (!path) return false;
  return WIRED_PATHS.has(normalizePath(path));
};

/** True if any of the given child paths is dispatch-wired (use for floor/section headers). */
export const sectionHasDispatch = (paths: Array<string | undefined | null>): boolean =>
  paths.some(p => isDispatchWired(p));

export const DISPATCH_TOOLTIP = 'Dispatch-enabled — can plan/assign routes from here';
