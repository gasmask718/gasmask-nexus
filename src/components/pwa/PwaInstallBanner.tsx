import { useEffect, useState } from 'react';
import { Download, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { isRunningAsInstalledPwa } from '@/components/pwa/PwaTelemetry';

interface PwaInstallBannerProps {
  appName?: string;
}

/**
 * Shared PWA install banner for Dashboard + all portals.
 * Auto-triggers native install on mount when available.
 * No extra dialogs or disabled states — one tap installs.
 */
export function PwaInstallBanner({ appName = 'GASMASK' }: PwaInstallBannerProps) {
  const { canInstall, isInstalled, triggerInstall } = usePwaInstall();
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (isRunningAsInstalledPwa()) {
      setIsStandalone(true);
    }
  }, []);

  // No auto-trigger — wait for user to click "Install Now"

  // Don't show banner if installed or running as PWA
  if (isInstalled || isStandalone) {
    return null;
  }

  return (
    <Card className="glass-card border-primary/30 bg-primary/5">
      <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6">
        <div className="space-y-1 text-center sm:text-left">
          <h3 className="text-lg font-bold text-foreground">Install {appName} PWA</h3>
          <p className="text-sm text-muted-foreground">
            Add to your home screen for quick access &amp; offline support.
          </p>
        </div>
        <Button
          onClick={() => triggerInstall()}
          size="lg"
          className="gap-2 shrink-0 min-w-[200px]"
        >
          <Download className="h-5 w-5" />
          Install Now
        </Button>
      </CardContent>
    </Card>
  );
}
