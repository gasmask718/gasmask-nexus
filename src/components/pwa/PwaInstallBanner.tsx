import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { isRunningAsInstalledPwa } from '@/components/pwa/PwaTelemetry';
import { usePwaInstall } from '@/hooks/usePwaInstall';

interface PwaInstallBannerProps {
  appName?: string;
}

/**
 * Shared PWA install banner for Dashboard + all portals.
 * Navigates to /install page on click.
 */
export function PwaInstallBanner({ appName = 'GASMASK' }: PwaInstallBannerProps) {
  const navigate = useNavigate();
  const { isInstalled } = usePwaInstall();
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (isRunningAsInstalledPwa()) {
      setIsStandalone(true);
    }
  }, []);

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
          onClick={() => navigate('/install')}
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
