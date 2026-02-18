/**
 * Surface Guards — Dev-mode verification that noindex meta tags
 * are correctly applied on ops/admin routes and absent on public routes.
 * Console warnings only; never crashes.
 */

const OPS_ADMIN_PREFIXES = ['/portal', '/admin', '/security'];
const PUBLIC_PATHS = ['/shop', '/about', '/contact', '/cart', '/checkout'];

function hasNoindexMeta(): boolean {
  const metas = document.querySelectorAll('meta[name="robots"]');
  return Array.from(metas).some((m) =>
    m.getAttribute('content')?.includes('noindex')
  );
}

/**
 * Run surface guard checks. Call once on route change in dev mode.
 */
export function verifySurfaceGuards(pathname: string) {
  if (import.meta.env.PROD) return;

  const isOpsAdmin = OPS_ADMIN_PREFIXES.some((p) => pathname.startsWith(p));
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // Delay check to let layout effects run
  setTimeout(() => {
    const noindex = hasNoindexMeta();

    if (isOpsAdmin && !noindex) {
      console.warn(
        `[SurfaceGuard] ⚠️ Route "${pathname}" is ops/admin but has NO noindex meta. SEO leakage risk.`
      );
    }

    if (isPublic && noindex) {
      console.warn(
        `[SurfaceGuard] ⚠️ Route "${pathname}" is public but has noindex meta. This page won't be indexed.`
      );
    }
  }, 500);
}
