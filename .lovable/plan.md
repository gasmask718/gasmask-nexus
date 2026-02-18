

# Multi-Surface Architecture Implementation Plan

## Summary

Transform GasMask OS from a single-layout application into a three-surface system: **Public** (marketing), **Ops PWA** (field workers), and **Admin** (existing floor system). This is done incrementally without breaking existing functionality.

---

## What Already Exists (Will NOT Be Changed)

- RBAC system (`RequireRole`, `ROLE_PERMISSION_MATRIX`) -- battle-tested, untouched
- All existing portal page components -- untouched
- `Layout.tsx` (913-line admin sidebar) -- untouched, reused as AdminLayout
- All RLS policies -- untouched
- All hooks/services -- untouched
- `ProtectedRoute` component -- untouched

---

## Phase 1: Create Layout Components

### 1a. `src/layouts/PublicLayout.tsx`
- Marketing navbar: Logo, Shop, About, Contact, Login button
- Footer with links and social media
- SEO-friendly (no noindex tags)
- No sidebar, no admin controls
- Clean, brand-focused design matching TWL Landing aesthetic

### 1b. `src/layouts/OpsLayout.tsx`
- Minimal sticky top header: logo, user name, role badge, logout
- Role-specific bottom navigation bar (mobile-first)
- Injects `<meta name="robots" content="noindex, nofollow">` via useEffect
- No sidebar, no floor navigation, no admin features
- Receives role context from current user profile
- Padding for bottom nav so content is not hidden

### 1c. `src/layouts/AdminLayout.tsx`
- Thin wrapper around existing `Layout` component
- Alias for clarity and future separation
- No functional changes to existing admin experience

### 1d. `src/layouts/OpsBottomNav.tsx`
- Fixed bottom navigation bar component
- Renders role-specific nav items from config
- Active tab highlighting based on current route
- Icons + labels, mobile-optimized touch targets

---

## Phase 2: Navigation Configuration

### `src/config/opsNavigation.ts`
Role-specific bottom nav configs:

**Driver:** Home, Today's Route, Stores, Messages, Profile
**Biker:** Home, Store Checks, Issues, Route, Profile
**Ambassador:** Home, Stores, Commissions, Content, Profile
**Influencer:** Home, Campaigns, Content, Analytics, Profile
**Store:** Dashboard, Products, Orders, Invoices, Settings
**Wholesaler:** Dashboard, Products, Orders, Finance, Settings

Each config maps to existing portal page routes.

---

## Phase 3: Wire Routes to Layouts

Modify `src/routes/AppRoutes.tsx` to wrap route groups in their correct layout:

**Public routes** (no auth required):
- `/` (unauthenticated) -- new public landing page
- `/shop`, `/cart`, `/checkout` -- wrapped in PublicLayout
- `/twl-landing` -- kept as-is (already has its own design)
- `/auth`, `/portal/login`, `/portal/register` -- kept outside layouts

**Portal/Ops routes** (currently under `ProtectedNoLayout`):
- `/portal/driver/*`, `/portal/biker/*`, `/portal/store/*`, `/portal/wholesaler/*`, `/portal/ambassador/*`, `/portal/influencer/*` -- wrapped in OpsLayout
- Each portal group gets `RequireRole` guard matching existing role rules

**Admin routes** (currently under `ProtectedLayout`):
- All `/grabba/*`, `/security/*`, `/admin/*`, `/territory/*`, Floor routes -- unchanged, keep using existing `Layout` via `ProtectedLayout`

**Key change to `/` route:**
- Unauthenticated visitors see PublicLayout + new LandingPage
- Authenticated users see Dashboard (existing behavior preserved)

---

## Phase 4: PWA Support (Portal Only)

### `public/manifest.json`
- App name: "GasMask Ops"
- Display: standalone
- Theme color matching brand
- Icons (placeholder, can be updated later)

### `public/sw.js`
- Minimal service worker caching shell assets
- Cache-first strategy for static assets
- Network-first for API calls

### `src/components/pwa/usePWA.ts`
- Hook that registers service worker only on `/portal/*` routes
- Captures `beforeinstallprompt` event for install banner

### `src/components/pwa/InstallPrompt.tsx`
- "Add to Home Screen" banner/button
- Only shown on portal routes
- Dismissible, remembers user preference

### `index.html`
- Add manifest link (service worker registration handled via JS, scoped to portal)

---

## Phase 5: Public Landing Page

### `src/pages/public/LandingPage.tsx`
- Marketing hero page with GasMask brand aesthetic
- Sections: Hero, Featured Products, Store Locator CTA, Ambassador CTA, Footer
- Links to `/shop`, `/auth`, `/apply/ambassador`
- Uses framer-motion for animations (already installed)

---

## Phase 6: SEO Protection

- `OpsLayout` injects `<meta name="robots" content="noindex, nofollow">` on mount and removes on unmount
- Public routes remain fully indexable
- Admin routes already behind auth (no additional action needed)

---

## File Changes Summary

### New Files (10)
| File | Purpose |
|------|---------|
| `src/layouts/PublicLayout.tsx` | Marketing nav + footer wrapper |
| `src/layouts/OpsLayout.tsx` | Mobile-first portal layout with bottom nav + noindex |
| `src/layouts/AdminLayout.tsx` | Thin wrapper around existing Layout |
| `src/layouts/OpsBottomNav.tsx` | Role-driven bottom navigation component |
| `src/config/opsNavigation.ts` | Nav configs per portal role |
| `src/components/pwa/InstallPrompt.tsx` | PWA install banner |
| `src/components/pwa/usePWA.ts` | PWA registration hook (portal-scoped) |
| `public/manifest.json` | PWA manifest for GasMask Ops |
| `public/sw.js` | Service worker (cache shell assets) |
| `src/pages/public/LandingPage.tsx` | Public marketing landing page |

### Modified Files (2)
| File | Change |
|------|--------|
| `src/routes/AppRoutes.tsx` | Wrap public routes in PublicLayout, portal routes in OpsLayout, update `/` for auth-gated redirect |
| `index.html` | Add `<link rel="manifest">` tag |

### Explicitly Unchanged
- `src/components/Layout.tsx`
- `src/components/security/RequireRole.tsx`
- `src/security/permissions.ts`
- All existing portal page components
- All RLS policies
- All existing hooks and services

---

## Implementation Order

1. Create all layout files (PublicLayout, OpsLayout, AdminLayout, OpsBottomNav)
2. Create opsNavigation config
3. Create PWA files (manifest.json, sw.js, usePWA hook, InstallPrompt)
4. Create public LandingPage
5. Wire everything in AppRoutes.tsx (the final integration step)
6. Update index.html with manifest link

Each step is independently testable and reversible.

