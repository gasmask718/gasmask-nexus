import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { logPwaEvent } from './PwaTelemetry';

/**
 * PwaUpdateToast — Non-intrusive toast when a new SW version is available.
 * Ops-only (mounted inside OpsLayout).
 */
export default function PwaUpdateToast() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const checkForWaiting = async () => {
      const reg = await navigator.serviceWorker.getRegistration('/portal');
      if (!reg) return;

      // Already waiting
      if (reg.waiting) {
        logPwaEvent('sw_update_found');
        setWaitingWorker(reg.waiting);
        setShow(true);
      }

      // Future updates
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            logPwaEvent('sw_update_found');
            setWaitingWorker(newWorker);
            setShow(true);
          }
        });
      });
    };

    checkForWaiting();
  }, []);

  const handleUpdate = () => {
    if (!waitingWorker) return;
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    logPwaEvent('sw_update_applied');
    setShow(false);
    window.location.reload();
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-2">
      <div className="bg-card border border-border rounded-xl p-3 shadow-lg flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          A new version of <span className="font-semibold text-foreground">GasMask Ops</span> is available
        </p>
        <Button size="sm" onClick={handleUpdate} className="gap-1.5 shrink-0">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>
    </div>
  );
}
