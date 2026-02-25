import { useEffect, useState, useCallback } from 'react';
import { logPwaEvent, isRunningAsInstalledPwa } from '@/components/pwa/PwaTelemetry';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * usePwaInstall — Shared hook for PWA install prompt.
 * Returns { canInstall, triggerInstall } for use in any navbar.
 */
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  // Detect iOS Safari for manual install guidance
  const isIos = typeof navigator !== 'undefined' &&
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !(navigator as any).standalone;

  useEffect(() => {
    if (isRunningAsInstalledPwa()) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      logPwaEvent('pwa_install_prompt_shown');
    };

    window.addEventListener('beforeinstallprompt', handler);

    const installedHandler = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      logPwaEvent('pwa_install_prompt_accepted');
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const triggerInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setIsInstalled(true);
      logPwaEvent('pwa_install_prompt_accepted');
    } else {
      logPwaEvent('pwa_install_prompt_dismissed');
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  return {
    canInstall: !isInstalled && !!deferredPrompt,
    isIos,
    isInstalled,
    triggerInstall,
  };
}
