import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import { logPwaEvent, isRunningAsInstalledPwa } from './PwaTelemetry';

const THROTTLE_KEY = 'gasmask_pwa_prompt_dismissed_at';
const THROTTLE_DAYS = 7;

function isThrottled(): boolean {
  try {
    const dismissed = localStorage.getItem(THROTTLE_KEY);
    if (!dismissed) return false;
    const diff = Date.now() - parseInt(dismissed, 10);
    return diff < THROTTLE_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function setThrottled() {
  try {
    localStorage.setItem(THROTTLE_KEY, Date.now().toString());
  } catch {
    // localStorage not available
  }
}

/**
 * PwaGate — Registers SW, exposes install prompt with throttling.
 * Only mounted inside OpsLayout (portal routes).
 */
export default function PwaGate() {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (isRunningAsInstalledPwa()) {
      setIsInstalled(true);
      logPwaEvent('pwa_installed_detected');
      return;
    }

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then(() => logPwaEvent('sw_registered'))
        .catch((err) => console.warn('SW registration failed:', err));
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);

      if (!isThrottled()) {
        setShowInstall(true);
        logPwaEvent('pwa_install_prompt_shown');
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    (deferredPrompt as any).prompt();
    const result = await (deferredPrompt as any).userChoice;
    if (result.outcome === 'accepted') {
      setIsInstalled(true);
      logPwaEvent('pwa_install_prompt_accepted');
    } else {
      logPwaEvent('pwa_install_prompt_dismissed');
    }
    setShowInstall(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowInstall(false);
    setThrottled();
    logPwaEvent('pwa_install_prompt_dismissed');
  };

  if (isInstalled || !showInstall) return null;

  return (
    <div className="fixed top-16 left-4 right-4 z-50 animate-in slide-in-from-top-2">
      <div className="bg-card border border-border rounded-xl p-3 shadow-lg flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Install <span className="font-semibold text-foreground">GasMask Ops</span> for quick access
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button size="sm" onClick={handleInstall} className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Install
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDismiss} className="h-8 w-8 p-0">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
