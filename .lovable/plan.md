

# Multi-Surface Architecture Plan for GasMask OS

## Current State Assessment

This is a **massive, mature codebase** (~2,300 lines of routes, 200+ pages, extensive RBAC). Most of what the Master Prompt asks for **already exists** in some form:

- **RBAC**: `RequireRole` component with elevated role bypass, business-scoped driver/biker assignment checks
- **Permission System**: `ROLE_PERMISSION_MATRIX` in `src/security/permissions.ts` with wildcard support
- **Portal Pages**: Full portal pages exist at `/portal/driver`, `/portal/biker`, `/portal/ambassador`, `/portal/store`, `/portal/wholesaler`, `/portal/customer`
- **Protected Routes**: `ProtectedRoute` + `RequireRole` pattern used consistently
- **Layout**: Single `Layout` component (913 lines) with full admin sidebar used for everything
- **Portal Login**: Separate login pages exist (`PortalLogin`, `DriverLogin`, `BikerLogin`)

What is **missing or needs improvement**:

1. **Layout Separation** -- The biggest gap. Portal/Ops pages currently use the same heavy admin `Layout` or no layout at all. There is no `PublicLayout`, `OpsLayout`, or dedicated `AdminLayout`.
2. **Public Marketing Site** -- Only `/twl-landing` exists as a public page. No proper public layout with marketing nav/footer.
3. **PWA Support** -- No manifest.json, no service worker, no install prompts.
4. **Route Organization** -- All 2,300 lines in one flat file. No route grouping by surface.
5. **noindex for Portal Routes** -- Not implemented.

## What We Will NOT Do (to avoid breaking things)

- We will NOT restructure the existing 2,300-line route file in one pass -- too risky
- We will NOT change existing RBAC logic -- it works and is battle-tested
- We will NOT move routes to subdomains -- staying on same domain with path prefixes
- We will NOT duplicate hooks/services -- they already live in shared locations
- We will NOT touch RLS policies -- they are already governed by the security constitution

## Implementation Plan (Incremental, Safe)

### Phase 1: Layout Separation (The Core Change)

Create three new layout components that enforce visual boundaries between surfaces:

**`src/layouts/PublicLayout.tsx`**
- Marketing navbar (logo, About, Shop, Careers, Contact, Login)
- Footer with links
- SEO-friendly (no noindex)
- No sidebar, no admin controls

**`src/layouts/OpsLayout.tsx`**
- Minimal top header (logo, user name, logout)
- Bottom navigation bar (mobile-first, role-specific tabs)
- `noindex` meta tag injected via `useEffect`
- No sidebar, no floor navigation
- Receives `role` prop to show correct bottom nav items

**`src/layouts/AdminLayout.tsx`**
- Wrapper around existing `Layout` component (reuse as-is)
- This is essentially what exists today -- the full sidebar + header
- No changes needed initially; just aliased for clarity

### Phase 2: Wire Layouts to Route Groups

Modify `AppRoutes.tsx` to use the correct layout per surface:

**Public routes** (`/`, `/about`, `/contact`, `/shop`, etc.):
```
<Route element={<PublicLayout><Outlet /></PublicLayout>}>
  <Route path="/" element={<LandingPage />} />
  <Route path="/shop" element={<Shop />} />
  ...
</Route>
```

**Portal/Ops routes** (`/portal/*`, `/driver/*`, `/biker/*`):
```
<Route element={<ProtectedRoute><OpsLayout role="driver"><Outlet /></OpsLayout></ProtectedRoute>}>
  <Route path="/portal/driver/*" element={...} />
</Route>
```

**Admin routes** (everything else that uses `Layout` today):
- Keep existing `ProtectedLayout` wrapper unchanged

### Phase 3: OpsLayout Bottom Navigation (Role-Specific)

Create nav configs per role:

**Driver**: Home, Today's Route, Stores, Messages, Profile
**Biker**: Home, Store Checks, Issues, Route, Profile
**Ambassador**: Home, Stores, Commissions, Content, Profile
**Influencer**: Home, Campaigns, Content, Analytics, Profile

These configs drive the `OpsLayout` bottom nav bar.

### Phase 4: PWA Support (Scoped to Portal)

- Create `public/manifest.json` with name "GasMask Ops", icons, display: standalone
- Create a minimal service worker (`public/sw.js`) that caches shell assets
- Add `<link rel="manifest">` conditionally only for `/portal/*` routes
- Create `src/components/pwa/InstallPrompt.tsx` for the "Add to Home Screen" banner
- Register service worker only when on portal routes

### Phase 5: Public Landing Page

- Create `src/pages/public/LandingPage.tsx` -- marketing hero page
- Update `/` route: authenticated users go to Dashboard, unauthenticated see LandingPage
- This replaces the current behavior where `/` always goes to Dashboard

### Phase 6: SEO and Indexing Protection

- OpsLayout injects `<meta name="robots" content="noindex, nofollow">` on mount
- Public routes remain indexable
- No changes needed for admin (already behind auth)

---

## File Changes Summary

### New Files
| File | Purpose |
|------|---------|
| `src/layouts/PublicLayout.tsx` | Marketing nav + footer wrapper |
| `src/layouts/OpsLayout.tsx` | Mobile-first portal layout with bottom nav |
| `src/layouts/AdminLayout.tsx` | Alias for existing Layout (future separation) |
| `src/layouts/OpsBottomNav.tsx` | Role-driven bottom navigation component |
| `src/config/opsNavigation.ts` | Nav configs per portal role |
| `src/components/pwa/InstallPrompt.tsx` | PWA install banner |
| `src/components/pwa/usePWA.ts` | PWA registration hook |
| `public/manifest.json` | PWA manifest |
| `public/sw.js` | Service worker (cache shell) |
| `src/pages/public/LandingPage.tsx` | Public marketing landing page |

### Modified Files
| File | Change |
|------|--------|
| `src/routes/AppRoutes.tsx` | Wire public routes to PublicLayout, portal routes to OpsLayout |
| `index.html` | Add manifest link (conditional via JS) |

### Unchanged (Explicitly Preserved)
- `src/components/Layout.tsx` -- untouched, still used for all admin/floor routes
- `src/components/security/RequireRole.tsx` -- untouched
- `src/security/permissions.ts` -- untouched
- All existing portal page components -- untouched
- All RLS policies -- untouched
- All existing hooks/services -- untouched

---

## RBAC Matrix (Confirming Existing + New Guards)

| Route Pattern | Allowed Roles | Layout |
|--------------|---------------|--------|
| `/` (unauth) | Public | PublicLayout |
| `/` (auth) | All authenticated | AdminLayout |
| `/shop`, `/about`, `/contact` | Public | PublicLayout |
| `/portal/driver/*` | driver, admin, owner | OpsLayout |
| `/portal/biker/*` | biker, admin, owner | OpsLayout |
| `/portal/ambassador/*` | ambassador, admin, owner | OpsLayout |
| `/portal/influencer/*` | influencer, admin, owner | OpsLayout |
| `/portal/store/*` | store, admin, owner | OpsLayout |
| `/portal/wholesaler/*` | wholesaler, admin, owner | OpsLayout |
| `/admin/*` | admin, owner | AdminLayout |
| `/admin/executive/*` | owner | AdminLayout |
| `/grabba/*` (Floors) | Varies per floor | AdminLayout |
| `/security/*` | owner, admin | AdminLayout |

## Sequencing

1. **Phase 1** first (layouts) -- foundation for everything
2. **Phase 2** immediately after (wiring) -- makes layouts live
3. **Phase 3** follows (bottom nav) -- completes the ops experience
4. **Phase 4** next (PWA) -- installability for field workers
5. **Phase 5-6** last (public page, SEO) -- polish

Each phase is independently deployable and reversible. No existing functionality is removed or broken at any phase.

