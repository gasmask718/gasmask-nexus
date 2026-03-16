import { Download, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface PwaInstallButtonProps {
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'icon';
  className?: string;
  showLabel?: boolean;
}

export function PwaInstallButton({ 
  variant = 'outline', 
  size = 'sm', 
  className,
  showLabel = true 
}: PwaInstallButtonProps) {
  const { canInstall, isIos, isInstalled, triggerInstall } = usePwaInstall();

  // iOS — show manual instructions via popover
  if (isIos && !isInstalled) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant={variant} size={size} className={className}>
            <Download className="h-4 w-4" />
            {showLabel && <span className="ml-1.5">Install App</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 text-sm" side="bottom">
          <p className="font-semibold mb-2">Install on iOS</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
            <li>Tap the <Share className="inline h-3 w-3" /> Share button</li>
            <li>Scroll and tap <strong>"Add to Home Screen"</strong></li>
            <li>Tap <strong>"Add"</strong></li>
          </ol>
        </PopoverContent>
      </Popover>
    );
  }

  // Native install — always trigger prompt directly
  const handleClick = async () => {
    if (canInstall) {
      await triggerInstall();
    } else if (isInstalled) {
      // Already installed — no-op or gentle feedback
      return;
    } else {
      // Browser doesn't support beforeinstallprompt (Firefox, some desktop browsers)
      // Try to use the Related Applications API or fall back to manual
      try {
        // Check if we can use getInstalledRelatedApps
        if ('getInstalledRelatedApps' in navigator) {
          const apps = await (navigator as any).getInstalledRelatedApps();
          if (apps.length > 0) {
            return; // Already installed
          }
        }
      } catch {
        // ignore
      }
      // Last resort: show browser-specific instruction
      window.alert('To install this app:\n\n• Chrome/Edge: Click the install icon (⊕) in the address bar\n• Safari: Tap Share → Add to Home Screen\n• Firefox: Not supported for PWA install');
    }
  };

  return (
    <Button variant={variant} size={size} className={className} onClick={handleClick}>
      <Download className="h-4 w-4" />
      {showLabel && <span className="ml-1.5">{isInstalled ? 'Installed ✓' : 'Install App'}</span>}
    </Button>
  );
}
