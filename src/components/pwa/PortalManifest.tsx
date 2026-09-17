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
const DEFAULT_IOS_TITLE = 'GasMask';
const AMBASSADOR_IOS_TITLE = 'Ambassador Portal';

function isAmbassadorSurface(pathname: string) {
  return (
    pathname === '/ambassador' ||
    pathname.startsWith('/ambassador/') ||
    pathname.startsWith('/invite/ambassador/')
  );
}

export default function PortalManifest() {
  const { pathname } = useLocation();

  useEffect(() => {
    const ambassador = isAmbassadorSurface(pathname);

    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (link) {
      const href = ambassador ? AMBASSADOR_MANIFEST : DEFAULT_MANIFEST;
      if (!link.href.endsWith(href)) link.href = href;
    }

    const iosTitle = document.querySelector<HTMLMetaElement>(
      'meta[name="apple-mobile-web-app-title"]',
    );
    if (iosTitle) {
      iosTitle.content = ambassador ? AMBASSADOR_IOS_TITLE : DEFAULT_IOS_TITLE;
    }
  }, [pathname]);

  return null;
}
