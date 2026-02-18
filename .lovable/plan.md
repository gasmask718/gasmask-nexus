

# Phase 1-3: Layout Separation + Ops Nav + Route Wiring

## Summary

Create three layout components (`PublicLayout`, `OpsLayout`, `AdminLayout`), a role-specific bottom nav config, and wire them into `AppRoutes.tsx` -- all without touching existing components or breaking any current routes.

---

## What Will NOT Change

- `src/components/Layout.tsx` (913-line admin sidebar) -- untouched
- `src/components/security/RequireRole.tsx` -- untouched  
- `src/hooks/useUserRole.ts` -- untouched (reused by OpsLayout)
- `src/config/osNavigation.ts` -- untouched (already has `getRoleRedirectPath`, portal configs)
- All existing portal page components -- untouched
- All RLS policies -- untouched
- `ProtectedRoute` component -- untouched

---

## Phase 1: Create Layout Components (4 new files)

### `src/layouts/PublicLayout.tsx`
- Marketing navbar: GasMask logo, Shop, About, Contact, Login button
- Footer with links and copyright
- SEO-friendly (no noindex)
- Uses `<Outlet />` for child routes
- No sidebar, no admin controls

### `src/layouts/OpsLayout.tsx`
- Minimal sticky top header: GasMask Ops logo, user name badge (from `useCurrentUserProfile`), logout button
- Renders `<Outlet />` with bottom padding to avoid content hidden by nav
- Injects `<meta name="robots" content="noindex, nofollow">` via `useEffect` (cleaned up on unmount)
- Renders `<OpsBottomNav />` at the bottom
- No sidebar, no floor navigation
- Detects user role from `useCurrentUserProfile` and passes to bottom nav

### `src/layouts/AdminLayout.tsx`
- Thin wrapper: imports existing `Layout` from `@/components/Layout`, renders `<Layout><Outlet /></Layout>`
- Pure alias for clarity; zero behavioral change

### `src/layouts/OpsBottomNav.tsx`
- Fixed bottom navigation bar (`fixed bottom-0`)
- Reads current user's `primary_role` from `useCurrentUserProfile` hook
- Looks up nav items from `opsNavigation` config (Phase 2)
- Renders `NavLink` for each item with active state highlighting
- Icons from lucide-react, mobile-optimized touch targets (min 48px)

---

## Phase 2: Navigation Config (1 new file)

### `src/config/opsNavigation.ts`
Role-specific bottom nav configs using lucide icons:

| Role | Tabs |
|------|------|
| **driver** | Home, Route, Stores, Messages, Profile |
| **biker** | Home, Checks, Issues, Route, Profile |
| **ambassador** | Home, Stores, Commissions, Tasks, Profile |
| **influencer** | Home, Campaigns, Content, Analytics, Profile |
| **store** | Dashboard, Products, Orders, Invoices, Settings |
| **wholesaler** | Dashboard, Products, Orders, Finance, Settings |
| **customer** | Home, Orders, Rewards, Support, Profile |
| **production** | Home, Batches, Progress, Quality, Profile |

Each nav item maps `{ label, path, icon }` to existing portal page routes (e.g., driver Home maps to `/portal/driver`, Stores maps to `/portal/driver/stores`).

---

## Phase 3: Route Wiring (modify AppRoutes.tsx)

This is the **surgical** change. We wrap existing route groups in their layout without moving or deleting any routes.

### Strategy: Additive wrapping, not restructuring

The 2,306-line `AppRoutes.tsx` stays intact. We make these targeted changes:

**1. Add layout wrapper for portal/ops routes (lines ~1343-1474)**

The current `ProtectedNoLayout` section (line 1343) contains all portal routes. We wrap the portal route subset inside `OpsLayout`:

```text
Before:
  <Route element={<ProtectedNoLayout />}>
    ...communication routes...
    ...portal routes (lines 1410-1474)...
  </Route>

After:
  <Route element={<ProtectedNoLayout />}>
    ...communication routes (unchanged)...
    ...non-portal routes (unchanged)...
  </Route>

  {/* NEW: Portal/Ops routes wrapped in OpsLayout */}
  <Route element={<ProtectedRoute><OpsLayout><Outlet /></OpsLayout></ProtectedRoute>}>
    <Route path="/portal" element={<RoleRouter />} />
    <Route path="/portal/home" element={<PortalHome />} />
    <Route path="/portal/driver/*" element={<DriverPortal />} />
    <Route path="/portal/biker/*" element={<BikerPortal />} />
    <Route path="/portal/store/*" element={...} />
    <Route path="/portal/wholesaler/*" element={...} />
    ...all portal/* routes moved here...
  </Route>
```

**2. Add public routes with PublicLayout (before line 560)**

Currently public routes (`/shop`, `/cart`, `/checkout`, `/twl-landing`) have no layout wrapper. We wrap them:

```text
{/* Public routes with marketing layout */}
<Route element={<PublicLayout />}>
  <Route path="/shop" element={<Shop />} />
  <Route path="/cart" element={<Cart />} />
  <Route path="/checkout" element={<Checkout />} />
</Route>
```

- `/twl-landing` stays standalone (has its own design)
- Auth routes (`/auth`, `/portal/login`, etc.) stay standalone
- The existing `ProtectedLayout` (line 537) stays as-is -- it already wraps admin routes in `Layout`

**3. Update `/` route for unauthenticated landing**

Currently `/` always renders `<Dashboard />` inside `ProtectedLayout`. We add a conditional:
- Unauthenticated: show a simple `LandingRedirect` component that checks auth state and either redirects to Dashboard or renders a basic public landing
- Authenticated: existing Dashboard behavior preserved

### What moves, what stays

| Route group | Current location | Change |
|------------|-----------------|--------|
| `/portal/*` routes | Inside `ProtectedNoLayout` (line 1343) | Move to new `OpsLayout`-wrapped group |
| `/portals/*` routes | Inside `ProtectedNoLayout` (line 1455) | Move to new `OpsLayout`-wrapped group |
| `/shop`, `/cart`, `/checkout` | Standalone public (line 562) | Wrap in `PublicLayout` |
| `/communication/*` | Inside `ProtectedNoLayout` | Stay as-is (has own `CommunicationHubLayout`) |
| All admin/grabba routes | Inside `ProtectedLayout` or standalone | Stay as-is (use existing `Layout`) |
| `/twl-landing`, `/auth`, login pages | Standalone | Stay as-is |

---

## New Files Summary (6 files)

| File | Purpose |
|------|---------|
| `src/layouts/PublicLayout.tsx` | Marketing nav + footer + `<Outlet />` |
| `src/layouts/OpsLayout.tsx` | Mobile-first header + bottom nav + noindex + `<Outlet />` |
| `src/layouts/AdminLayout.tsx` | Thin wrapper around existing `Layout` + `<Outlet />` |
| `src/layouts/OpsBottomNav.tsx` | Role-driven bottom navigation bar |
| `src/config/opsNavigation.ts` | Nav config per ops/portal role |
| `src/pages/public/LandingPage.tsx` | Simple public marketing landing page |

## Modified Files (1 file)

| File | Change |
|------|--------|
| `src/routes/AppRoutes.tsx` | (1) Extract portal routes from `ProtectedNoLayout` into `OpsLayout` wrapper group. (2) Wrap `/shop`, `/cart`, `/checkout` in `PublicLayout`. (3) Add unauthenticated landing page at `/`. |

---

## Technical Notes

- `OpsLayout` uses existing `useCurrentUserProfile()` hook for user info and role detection -- no new auth logic needed
- `OpsBottomNav` uses `NavLink` from react-router-dom with `end` prop for exact matching
- `PublicLayout` uses `Link` from react-router-dom for navigation links
- `AdminLayout` is a 10-line wrapper file that just re-exports the existing admin experience
- The `noindex` meta tag in `OpsLayout` is injected via `document.createElement` in `useEffect` and removed on unmount to avoid SEO leakage
- No new dependencies required -- everything uses existing packages (react-router-dom, lucide-react, tailwind)

## Risks and Mitigations

- **Risk**: Moving portal routes out of `ProtectedNoLayout` could break if `ProtectedRoute` behavior differs when nested differently
  - **Mitigation**: The new group uses the exact same `<ProtectedRoute>` wrapper; only the layout inside changes
- **Risk**: `OpsLayout`'s `<Outlet />` might not render portal pages that expect to be direct children
  - **Mitigation**: All portal pages are self-contained components; they don't rely on parent layout context
- **Risk**: Bottom nav paths might not match existing portal routes exactly
  - **Mitigation**: Nav config paths are mapped directly from the existing route definitions in `AppRoutes.tsx`

