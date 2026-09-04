import { ReactNode, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useCurrentUserProfile } from "@/hooks/useCurrentUserProfile";
import { useBusinessRoles, useBusinessMemberships } from "@/hooks/useBusinessMembership";
import { useBusiness } from "@/contexts/BusinessContext";
import { Shield } from "lucide-react";

/**
 * RoleRouteGuard — Global path-based role enforcement
 *
 * Rules:
 * - owner / admin → full access to all pages
 * - Field roles → restricted to their allowed path prefixes
 * - Checks BOTH user_profiles.primary_role AND user_roles table (system roles)
 */

// Elevated roles that bypass all path restrictions
const ELEVATED_ROLES = ["owner", "admin", "ceo"];

// Path prefixes each role is allowed to access
const ROLE_ALLOWED_PATHS: Record<string, string[]> = {
  biker: [
    "/portal/biker",
    "/portal/onboarding",
    "/portal/home",
    "/portal/inbox",
    "/portal/tasks",
    "/portal/join",
    "/portals/biker",
    "/install",
  ],
  driver: [
    "/portal/driver",
    "/portal/onboarding",
    "/portal/home",
    "/portal/inbox",
    "/portal/tasks",
    "/portal/join",
    "/portals/driver",
    "/install",
  ],
  ambassador: [
    "/portal/ambassador",
    "/ambassador",
    "/portal/onboarding",
    "/portal/home",
    "/portal/inbox",
    "/portal/tasks",
    "/portal/join",
    "/portals/ambassador",
    "/install",
  ],
  customer: [
    "/portal/customer",
    "/portal/onboarding",
    "/portal/home",
    "/portal/inbox",
    "/portal/tasks",
    "/portal/join",
    "/portals/customer",
    "/shop",
    "/cart",
    "/checkout",
    "/install",
  ],
  wholesaler: [
    "/portal/wholesaler",
    "/portal/wholesale",
    "/portal/onboarding",
    "/portal/home",
    "/portal/inbox",
    "/portal/tasks",
    "/portal/join",
    "/portals/wholesaler",
    "/portals/national-wholesale",
    "/install",
  ],
  wholesale: [
    "/portal/wholesaler",
    "/portal/wholesale",
    "/portal/onboarding",
    "/portal/home",
    "/portal/inbox",
    "/portal/tasks",
    "/portal/join",
    "/portals/wholesaler",
    "/portals/national-wholesale",
    "/install",
  ],
  store: [
    "/portal/store",
    "/portal/onboarding",
    "/portal/home",
    "/portal/inbox",
    "/portal/tasks",
    "/portal/join",
    "/portals/store",
    "/install",
  ],
  store_owner: [
    "/portal/store",
    "/portal/onboarding",
    "/portal/home",
    "/portal/inbox",
    "/portal/tasks",
    "/portal/join",
    "/portals/store",
    "/install",
  ],
  va: [
    "/portal/va",
    "/portal/onboarding",
    "/portal/home",
    "/portal/inbox",
    "/portal/tasks",
    "/portal/join",
    "/portals/va",
    "/install",
    // VAs are operational staff: they get the operational floor/category
    // pages (Floors 0-9). Everything not listed here stays denied by default —
    // that is what keeps finance-sensitive surfaces (accounting, payroll,
    // billing, payouts, funding, analytics/revenue, HR, security, admin,
    // penthouse) out of reach without touching global role protection.
    "/",
    "/va",
    // Floor 0 — Territory intelligence
    "/territory",
    // CRM / store master / store intelligence
    "/stores",
    "/store",
    "/crm",
    "/accounts",
    "/opportunities",
    "/leads",
    // Communication hub
    "/communication",
    "/communications",
    "/messages",
    "/inbox",
    "/calls",
    "/os/brandaro",
    // Inventory
    "/inventory",
    // Delivery / routing (operational)
    "/delivery",
    "/routes",
    "/route-ops-center",
    "/live-map",
    "/grabba",
    // Operational order views
    "/orders",
    // Production
    "/production",
    // Wholesale
    "/wholesale",
    "/wholesaler",
    // Ambassadors (operational roster/tasks; payouts stay denied)
    "/ambassadors",
    // AI operations
    "/ai-operations",
    "/ai",
    "/tasks",
    "/reminders",
    "/notifications",
    "/search",
    "/settings/profile",
  ],
  production: [
    "/portal/production",
    "/portal/onboarding",
    "/portal/home",
    "/portal/inbox",
    "/portal/tasks",
    "/portal/join",
    "/portals/production",
    "/production",
    "/install",
  ],
  influencer: [
    "/portal/influencer",
    "/portal/onboarding",
    "/portal/home",
    "/portal/inbox",
    "/portal/tasks",
    "/portal/join",
    "/install",
  ],
  // Developers are NOT elevated. They only get the generic authenticated
  // surfaces here; module access is granted per-business below via
  // DEVELOPER_BUSINESS_PATHS + business_members membership.
  developer: [
    "/portal/onboarding",
    "/portal/home",
    "/portal/inbox",
    "/portal/join",
    "/install",
  ],
};

/**
 * Per-business developer surface map.
 * key   = businesses.slug the user must be a member of (public.business_members)
 * value = OS path prefixes that membership unlocks for the `developer` role.
 * Membership is required — a developer with no matching membership gets nothing here.
 */
const DEVELOPER_BUSINESS_PATHS: Record<string, string[]> = {
  iclean_weclean: ["/os/icw"],
};

// Default redirect per role
const ROLE_HOME: Record<string, string> = {
  biker: "/portal/biker",
  driver: "/portal/driver",
  ambassador: "/ambassador/dashboard",
  customer: "/portal/customer",
  wholesaler: "/portal/wholesaler",
  wholesale: "/portal/wholesaler",
  store: "/portal/store",
  store_owner: "/portal/store",
  va: "/va/dashboard",
  production: "/portal/production",
  influencer: "/portal/influencer",
  developer: "/portal/home",
};

// Public paths that all authenticated users can access
const UNIVERSAL_PATHS = [
  "/portal",
  "/portal/onboarding",
  "/portal/home",
  "/portal/invoices",
  "/wallet",
  "/install",
  "/messages",
  "/me",
];

interface RoleRouteGuardProps {
  children: ReactNode;
}

export function RoleRouteGuard({ children }: RoleRouteGuardProps) {
  const location = useLocation();
  const { currentBusiness, loading: businessLoading } = useBusiness();
  const activeBusinessId = businessLoading ? null : (currentBusiness?.id ?? null);
  const { roles, loading: rolesLoading } = useUserRole(activeBusinessId);
  const { data: profileData, isLoading: profileLoading } = useCurrentUserProfile();
  const { roles: businessRoles, isLoading: membershipLoading } = useBusinessRoles(activeBusinessId);
  const { data: memberships, isLoading: membershipsLoading } = useBusinessMemberships();

  // Remembers the last path this guard actually authorized, so a background
  // refresh of identity data does not re-show "Verifying access..." or bounce
  // an already-authorized user off the page they are working on.
  const lastGrantedPath = useRef<string | null>(null);

  const isResolving =
    rolesLoading || profileLoading || businessLoading || membershipLoading || membershipsLoading;

  // Identity data is unresolved but we already granted THIS exact path in this
  // session → keep rendering it (state A: loading, not state C/D).
  if (isResolving && lastGrantedPath.current === location.pathname) {
    return <>{children}</>;
  }

  // Don't block (and never redirect) while loading
  if (isResolving) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Shield className="h-12 w-12 text-primary animate-pulse mx-auto" />
          <p className="text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Collect all roles from both sources
  const allRoles: string[] = [...roles];

  // Add profile role
  const profileRole = profileData?.profile?.primary_role;
  if (profileRole && !allRoles.includes(profileRole)) {
    allRoles.push(profileRole);
  }

  // Tenancy: the global `va` role only unlocks operational paths inside the
  // business the user is actually a member of (business_members / has_business_role).
  const isVAScoped =
    !activeBusinessId || businessRoles.length > 0;
  const effectiveRoles = isVAScoped ? allRoles : allRoles.filter((r) => r !== "va");

  const currentPath = location.pathname;
  const grant = () => {
    lastGrantedPath.current = currentPath;
    return <>{children}</>;
  };

  // If user has any elevated role → full access
  const hasElevatedAccess = effectiveRoles.some((r) => ELEVATED_ROLES.includes(r));
  if (hasElevatedAccess) {
    return grant();
  }

  // Check universal paths
  if (UNIVERSAL_PATHS.some((p) => currentPath === p || currentPath.startsWith(p + "/"))) {
    return grant();
  }

  // Exact match for portal root (role router)
  if (currentPath === "/portal") {
    return grant();
  }

  // No roles at all. Distinguish "genuinely unassigned" from "identity data has
  // not materialized yet" — only the former is an authorization decision.
  if (effectiveRoles.length === 0) {
    if (!profileData) {
      // Profile fetch resolved without data (e.g. transient error) — hold,
      // never redirect a signed-in user off their page on missing data.
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center space-y-4">
            <Shield className="h-12 w-12 text-primary animate-pulse mx-auto" />
            <p className="text-muted-foreground">Verifying access...</p>
          </div>
        </div>
      );
    }
    return <Navigate to="/pending-approval" replace />;
  }

  // Developer: business-scoped OS module access.
  // Requires BOTH the `developer` role AND a public.business_members row for the
  // business that owns the module. No membership → no module access (never global).
  if (effectiveRoles.includes("developer")) {
    const memberSlugs = (memberships || [])
      .map((m) => m.slug)
      .filter((s): s is string => !!s);
    const devPaths = memberSlugs.flatMap((slug) => DEVELOPER_BUSINESS_PATHS[slug] || []);
    if (devPaths.some((prefix) => currentPath === prefix || currentPath.startsWith(prefix + "/"))) {
      return grant();
    }
  }

  // Check if any of the user's roles grant access to the current path
  const hasPathAccess = effectiveRoles.some((role) => {
    const allowedPaths = ROLE_ALLOWED_PATHS[role];
    if (!allowedPaths) return false;
    return allowedPaths.some((prefix) => currentPath === prefix || currentPath.startsWith(prefix + "/"));
  });

  if (hasPathAccess) {
    return grant();
  }

  // Genuinely unauthorized for this path → clear the sticky grant so a real
  // permission change still redirects on subsequent renders.
  lastGrantedPath.current = null;

  // Denied — redirect to the user's primary portal home
  const primaryRole = profileRole || effectiveRoles[0];
  const redirectTo = ROLE_HOME[primaryRole] || "/portal";

  console.warn(
    `🔐 [RoleRouteGuard] DENIED: path="${currentPath}", roles=[${effectiveRoles.join(",")}], redirecting to "${redirectTo}"`,
  );

  return <Navigate to={redirectTo} replace />;
}

export default RoleRouteGuard;
