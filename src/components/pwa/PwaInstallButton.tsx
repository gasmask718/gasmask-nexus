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

  // Always show — trigger native prompt if available, otherwise guide user
  const handleClick = () => {
    if (canInstall) {
      triggerInstall();
    } else {
      window.alert('To install, use your browser menu → "Add to Home Screen" or "Install App".');
    }
  };

  return (
    <Button variant={variant} size={size} className={className} onClick={handleClick}>
      <Download className="h-4 w-4" />
      {showLabel && <span className="ml-1.5">{isInstalled ? 'Installed' : 'Install App'}</span>}
    </Button>
  );
}
