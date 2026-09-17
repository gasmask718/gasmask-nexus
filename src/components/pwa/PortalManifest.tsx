import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * PortalManifest — swaps the installable app identity per surface.
 *
 * On ambassador-facing routes (/ambassador/*, /invite/ambassador/*) the page
 * advertises the dedicated "Ambassador Portal" manifest (own id + scope +
 * start_url), so it installs as a SEPARATE phone entry from the full
 * "GasMask Ops" app. Everywhere else the original manifest is restored
 * untouched.
 *
 * Presentation/metadata only — no auth, routing or role behavior.
 */
const DEFAULT_MANIFEST = '/manifest.json';
const AMBASSADOR_MANIFEST = '/ambassador.webmanifest';
const ROUTE_PLANNER_MANIFEST = '/route-planner.webmanifest';
const DEFAULT_IOS_TITLE = 'GasMask';
const AMBASSADOR_IOS_TITLE = 'Ambassador Portal';
const ROUTE_PLANNER_IOS_TITLE = 'Route Planner';

function isAmbassadorSurface(pathname: string) {
  return (
    pathname === '/ambassador' ||
    pathname.startsWith('/ambassador/') ||
    pathname.startsWith('/invite/ambassador/')
  );
}

function isRoutePlannerSurface(pathname: string) {
  return pathname === '/route-planner' || pathname.startsWith('/route-planner/');
}

export default function PortalManifest() {
  const { pathname } = useLocation();

  useEffect(() => {
    const ambassador = isAmbassadorSurface(pathname);
    const routePlanner = isRoutePlannerSurface(pathname);

    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (link) {
      const href = ambassador
        ? AMBASSADOR_MANIFEST
        : routePlanner
          ? ROUTE_PLANNER_MANIFEST
          : DEFAULT_MANIFEST;
      if (!link.href.endsWith(href)) link.href = href;
    }

    const iosTitle = document.querySelector<HTMLMetaElement>(
      'meta[name="apple-mobile-web-app-title"]',
    );
    if (iosTitle) {
      iosTitle.content = ambassador
        ? AMBASSADOR_IOS_TITLE
        : routePlanner
          ? ROUTE_PLANNER_IOS_TITLE
          : DEFAULT_IOS_TITLE;
    }
  }, [pathname]);


  return null;
}
