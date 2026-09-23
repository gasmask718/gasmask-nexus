/**
 * Entry-context detection by hostname.
 *
 * ONE application, ONE backend, ONE auth system. The hostname the person
 * entered through decides which interface they land in — it never changes
 * roles, permissions or data.
 *
 *   app.gasmaskapproved.com        -> GasMask OS / admin (existing behavior)
 *   ambassador.gasmaskapproved.com -> Ambassador Portal (field mode)
 *
 * An owner/admin who is also an ambassador stays in field mode when they
 * arrive on the ambassador host, instead of being bounced to the OS home.
 */
const AMBASSADOR_HOSTS = ['ambassador.gasmaskapproved.com'];

export function isAmbassadorHost(host?: string): boolean {
  try {
    const h = (host ?? window.location.hostname).toLowerCase();
    return AMBASSADOR_HOSTS.includes(h) || h.startsWith('ambassador.');
  } catch {
    return false;
  }
}

/** Where the ambassador host sends people once authenticated. */
export const AMBASSADOR_PORTAL_HOME = '/ambassador/dashboard';
export const AMBASSADOR_PORTAL_ENTRY = '/ambassador';
export const AMBASSADOR_LOGIN_PATH = '/ambassador/login';
