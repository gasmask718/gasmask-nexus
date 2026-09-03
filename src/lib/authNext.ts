/**
 * Post-authentication destination handling.
 *
 * An access link may carry `?next=/portal/wholesaler` so a multi-role user
 * (e.g. an owner who is also a Dynasty Direct wholesaler) lands on the portal
 * they were invited to instead of their default role home.
 *
 * The value survives an OAuth round-trip (Google) via sessionStorage, because
 * the provider redirect drops the original query string.
 *
 * Only same-origin relative paths are ever honored — never an absolute or
 * protocol-relative URL, and never /auth itself (which would loop).
 */
const PENDING_NEXT_KEY = 'auth_pending_next';

export function isSafeNextPath(path: string | null | undefined): path is string {
  return (
    !!path &&
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !path.startsWith('/auth')
  );
}

export function storePendingNext(path: string | null | undefined): void {
  if (!isSafeNextPath(path)) return;
  try {
    sessionStorage.setItem(PENDING_NEXT_KEY, path);
  } catch {
    /* storage unavailable — deep link simply falls back to role home */
  }
}

export function peekPendingNext(): string | null {
  try {
    const v = sessionStorage.getItem(PENDING_NEXT_KEY);
    return isSafeNextPath(v) ? v : null;
  } catch {
    return null;
  }
}

export function consumePendingNext(): string | null {
  const v = peekPendingNext();
  try {
    sessionStorage.removeItem(PENDING_NEXT_KEY);
  } catch {
    /* ignore */
  }
  return v;
}
