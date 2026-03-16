

## Plan: PWA Install Landing Page

### What changes

1. **New page: `src/pages/InstallPwa.tsx`**
   - Hero section with GASMASK branding and a prominent "Install Now" button that triggers the native `beforeinstallprompt`
   - Feature showcase grid highlighting key capabilities (Dashboard, Routes, CRM, Communication, Analytics, PWA offline support)
   - Manual install instructions section (accordion/collapsible) covering Chrome desktop, Android Chrome, iOS Safari, and Edge — shown as fallback when the native prompt is unavailable
   - Uses the existing `usePwaInstall` hook for install logic

2. **New route: `/install`** (public, no auth required)
   - Added to `AppRoutes.tsx` as a top-level public route

3. **Update `PwaInstallBanner.tsx`**
   - Instead of directly triggering install, the "Install Now" button navigates to `/install`

4. **Update `PwaInstallButton.tsx`**
   - Same change — clicking navigates to `/install` instead of calling `triggerInstall()` directly

5. **Portal layouts untouched structurally** — they already use `PwaInstallBanner` or `PwaInstallButton`, so the redirect will propagate automatically to Dashboard, Driver, Biker, Customer, and Wholesaler portals.

### Install page layout

```text
┌─────────────────────────────────────────────┐
│  ← Back to Dashboard                       │
├─────────────────────────────────────────────┤
│                                             │
│   GASMASK logo / icon                       │
│   "Install GASMASK on your device"          │
│   Subtitle about offline + quick access     │
│                                             │
│   [ ⬇ Install GASMASK ]  (primary CTA)     │
│                                             │
├─────────────────────────────────────────────┤
│  FEATURES GRID (2x3)                        │
│  ┌───────┐ ┌───────┐ ┌───────┐             │
│  │Command│ │Routes │ │Comms  │             │
│  │Center │ │& Maps │ │Hub    │             │
│  └───────┘ └───────┘ └───────┘             │
│  ┌───────┐ ┌───────┐ ┌───────┐             │
│  │CRM    │ │Analyt.│ │Offline│             │
│  │       │ │       │ │Access │             │
│  └───────┘ └───────┘ └───────┘             │
├─────────────────────────────────────────────┤
│  MANUAL INSTALL INSTRUCTIONS                │
│  "Can't see the install button?"            │
│  ▸ Chrome (Desktop)                         │
│  ▸ Chrome (Android)                         │
│  ▸ Safari (iOS)                             │
│  ▸ Microsoft Edge                           │
└─────────────────────────────────────────────┘
```

### Files to create/edit
- **Create**: `src/pages/InstallPwa.tsx`
- **Edit**: `src/routes/AppRoutes.tsx` — add `/install` route
- **Edit**: `src/components/pwa/PwaInstallBanner.tsx` — navigate to `/install`
- **Edit**: `src/components/pwa/PwaInstallButton.tsx` — navigate to `/install`

