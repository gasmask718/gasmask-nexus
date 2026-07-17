import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Safety net for rogue Supabase verification links that land on the wrong
 * route (e.g. `/` or `/auth`) instead of `/auth/callback`. If we detect an
 * auth token (`?code=` for PKCE or `#access_token=` for implicit) anywhere
 * other than the callback route, redirect to the canonical handler ASAP,
 * preserving the token in the URL.
 */
export function AuthTokenCatcher() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (location.pathname.startsWith("/auth/callback")) return;

    const search = window.location.search || "";
    const hash = window.location.hash || "";

    const hasPkceCode = /[?&]code=/.test(search);
    const hasImplicitToken =
      /[#&]access_token=/.test(hash) ||
      /[#&]refresh_token=/.test(hash) ||
      /[#&]type=(recovery|signup|invite|magiclink|email_change)/.test(hash);
    const hasError = /[?&#]error=/.test(search + hash);

    if (!hasPkceCode && !hasImplicitToken && !hasError) return;

    navigate(`/auth/callback${search}${hash}`, { replace: true });
  }, [location.pathname, location.search, navigate]);

  return null;
}
