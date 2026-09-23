import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface PortalReturnState {
  from?: unknown;
  returnScrollY?: unknown;
  returnAnchor?: unknown;
  restoreScrollY?: unknown;
  restoreAnchor?: unknown;
}

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

  const returnState = location.state as PortalReturnState | null;
  const stateFrom = returnState?.from;
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
      navigate(explicitTarget, {
        replace: true,
        state: {
          restoreScrollY: typeof returnState?.returnScrollY === 'number' ? returnState.returnScrollY : undefined,
          restoreAnchor: typeof returnState?.returnAnchor === 'string' ? returnState.returnAnchor : undefined,
        },
      });
      return;
    }
    if (hasInAppHistory) {
      navigate(-1);
      return;
    }
    navigate(fallback);
  }, [explicitTarget, hasInAppHistory, navigate, fallback, returnState?.returnAnchor, returnState?.returnScrollY]);

  return { goBack, returnTarget: explicitTarget, hasInAppHistory };
}

/**
 * Router state to attach when opening a detail page, so the detail page can
 * return to this exact surface (path + filters/search) afterwards.
 */
export function fromHere(location: { pathname: string; search?: string }, anchor?: string) {
  return {
    from: `${location.pathname}${location.search ?? ''}`,
    returnScrollY: typeof window === 'undefined' ? 0 : window.scrollY,
    returnAnchor: anchor,
  };
}

/** Restores a portal list/card after a detail page navigates back to it. */
export function useReturnScrollRestoration() {
  const location = useLocation();
  const restoredKey = useRef<string | null>(null);

  useEffect(() => {
    const state = location.state as PortalReturnState | null;
    const y = typeof state?.restoreScrollY === 'number' ? state.restoreScrollY : null;
    const anchor = typeof state?.restoreAnchor === 'string' ? state.restoreAnchor : null;
    if (y === null || restoredKey.current === location.key) return;
    restoredKey.current = location.key;

    let timer = 0;
    let attempts = 0;
    const restore = () => {
      const target = anchor ? document.getElementById(anchor) : null;
      const nextY = target ? Math.max(0, target.getBoundingClientRect().top + window.scrollY - 88) : y;
      window.scrollTo({ top: nextY, behavior: 'auto' });
      attempts += 1;
      if (attempts < 30 && ((anchor && !target) || document.documentElement.scrollHeight < y + window.innerHeight)) {
        timer = window.setTimeout(restore, 100);
      }
    };
    timer = window.setTimeout(restore, 0);
    return () => window.clearTimeout(timer);
  }, [location.key, location.state]);
}
