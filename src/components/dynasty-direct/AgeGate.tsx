import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

/**
 * Dynasty Direct 21+ site-entry gate.
 *
 * Shown on the public storefront surfaces only (the internal OS is staff-only
 * and already behind auth). Confirmation is stored in localStorage with a
 * 30-day expiry so returning visitors re-affirm periodically.
 */
const STORAGE_KEY = "dd_age_verified_until";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const GATED_PREFIXES = [
  "/shop",
  "/cart",
  "/checkout",
  "/dynasty-direct/d2c-storefront",
];

export function isAgeVerified(): boolean {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  const until = Number(raw);
  if (!Number.isFinite(until) || until < Date.now()) {
    window.localStorage.removeItem(STORAGE_KEY);
    return false;
  }
  return true;
}

export function AgeGate() {
  const location = useLocation();
  const gatedPath = GATED_PREFIXES.some((p) => location.pathname.startsWith(p));
  const [verified, setVerified] = useState(() => isAgeVerified());

  useEffect(() => {
    if (gatedPath) setVerified(isAgeVerified());
  }, [gatedPath, location.pathname]);

  // Lock background scroll while the gate is up
  useEffect(() => {
    if (gatedPath && !verified) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [gatedPath, verified]);

  if (!gatedPath || verified) return null;

  const confirm = () => {
    window.localStorage.setItem(STORAGE_KEY, String(Date.now() + THIRTY_DAYS_MS));
    setVerified(true);
  };

  const exit = () => {
    window.location.href = "https://www.google.com";
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      data-testid="age-gate"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-md p-4"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-2xl">
        <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-primary" />
        <h1 id="age-gate-title" className="text-2xl font-bold text-foreground">
          Are you 21 or older?
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Dynasty Direct sells tobacco, vape and nicotine products. You must be at
          least 21 years of age to enter this site.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Button size="lg" onClick={confirm} data-testid="age-gate-confirm">
            Yes, I am 21 or older
          </Button>
          <Button size="lg" variant="outline" onClick={exit}>
            No, take me away
          </Button>
        </div>
        <p className="mt-5 text-xs text-muted-foreground">
          By entering you confirm your age is accurate. This confirmation is
          remembered for 30 days.
        </p>
      </div>
    </div>
  );
}

export default AgeGate;
