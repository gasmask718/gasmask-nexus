import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

/**
 * PwaGate — Registers SW and exposes install prompt
 * Only mounted inside OpsLayout (portal routes).
 */
export default function PwaGate() {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/portal' })
        .catch((err) => console.warn('SW registration failed:', err));
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
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
    }
    setShowInstall(false);
    setDeferredPrompt(null);
  };

  if (isInstalled || !showInstall) return null;

  return (
    <div className="fixed top-16 left-4 right-4 z-50 animate-in slide-in-from-top-2">
      <div className="bg-card border border-border rounded-xl p-3 shadow-lg flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Install <span className="font-semibold text-foreground">GasMask Ops</span> for quick access
        </p>
        <Button size="sm" onClick={handleInstall} className="gap-1.5 shrink-0">
          <Download className="h-3.5 w-3.5" />
          Install
        </Button>
      </div>
    </div>
  );
}
