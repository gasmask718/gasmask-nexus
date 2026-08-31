import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useCurrentUserProfile } from "@/hooks/useCurrentUserProfile";
import { useBusinessRoles } from "@/hooks/useBusinessMembership";
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
    // VAs get broader access as operational staff
    "/",
    "/stores",
    "/crm",
    "/communication",
    "/messages",
    "/delivery",
    "/os/brandaro",
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

  // Don't block while loading
  if (rolesLoading || profileLoading || businessLoading || membershipLoading) {
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

  // If user has any elevated role → full access
  const hasElevatedAccess = effectiveRoles.some((r) => ELEVATED_ROLES.includes(r));
  if (hasElevatedAccess) {
    return <>{children}</>;
  }


  const currentPath = location.pathname;

  // Check universal paths
  if (UNIVERSAL_PATHS.some((p) => currentPath === p || currentPath.startsWith(p + "/"))) {
    return <>{children}</>;
  }

  // Exact match for portal root (role router)
  if (currentPath === "/portal") {
    return <>{children}</>;
  }

  // Authenticated users with no assigned OS role should not fall through into
  // protected workspaces. Send them to the explicit approval state instead.
  if (effectiveRoles.length === 0) {
    return <Navigate to="/pending-approval" replace />;
  }

  // Check if any of the user's roles grant access to the current path
  const hasPathAccess = effectiveRoles.some((role) => {
    const allowedPaths = ROLE_ALLOWED_PATHS[role];
    if (!allowedPaths) return false;
    return allowedPaths.some((prefix) => currentPath === prefix || currentPath.startsWith(prefix + "/"));
  });

  if (hasPathAccess) {
    return <>{children}</>;
  }

  // Denied — redirect to the user's primary portal home
  const primaryRole = profileRole || effectiveRoles[0];
  const redirectTo = ROLE_HOME[primaryRole] || "/portal";

  console.warn(
    `🔐 [RoleRouteGuard] DENIED: path="${currentPath}", roles=[${effectiveRoles.join(",")}], redirecting to "${redirectTo}"`,
  );

  return <Navigate to={redirectTo} replace />;
}

export default RoleRouteGuard;
