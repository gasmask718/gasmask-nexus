import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Safe "go back to where I came from" navigation.
 *
 * Resolution order:
 *   1. router state `from` (set by the surface that opened this page)
 *   2. `?returnTo=` query param
 *   3. in-app history entry (preserves the originating list's filters/scroll)
 *   4. the supplied fallback path
 *
 * Only same-origin, absolute in-app paths are honoured — never an external URL.
 */
export function isSafeInternalPath(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  // must be a rooted app path; reject protocol-relative (//evil.com) and any scheme
  return v.startsWith('/') && !v.startsWith('//') && !/^\/\\/.test(v) && !v.includes('://');
}

export function useReturnNavigation(fallback = '/') {
  const navigate = useNavigate();
  const location = useLocation();

  const stateFrom = (location.state as { from?: unknown } | null)?.from;
  const queryReturn = new URLSearchParams(location.search).get('returnTo');

  const explicitTarget = isSafeInternalPath(stateFrom)
    ? stateFrom
    : isSafeInternalPath(queryReturn)
      ? queryReturn
      : null;

  // A router-generated key means we arrived through in-app navigation, so the
  // previous history entry is the originating context (with its own state).
  const hasInAppHistory = location.key !== 'default';

  const goBack = useCallback(() => {
    if (explicitTarget) {
      navigate(explicitTarget);
      return;
    }
    if (hasInAppHistory) {
      navigate(-1);
      return;
    }
    navigate(fallback);
  }, [explicitTarget, hasInAppHistory, navigate, fallback]);

  return { goBack, returnTarget: explicitTarget, hasInAppHistory };
}

/**
 * Router state to attach when opening a detail page, so the detail page can
 * return to this exact surface (path + filters/search) afterwards.
 */
export function fromHere(location: { pathname: string; search?: string }) {
  return { from: `${location.pathname}${location.search ?? ''}` };
}
