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

  // Already installed — hide
  if (isInstalled) return null;

  // iOS — show manual instructions
  if (isIos) {
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

  // Chrome/Edge/etc — native prompt
  if (canInstall) {
    return (
      <Button variant={variant} size={size} className={className} onClick={triggerInstall}>
        <Download className="h-4 w-4" />
        {showLabel && <span className="ml-1.5">Install App</span>}
      </Button>
    );
  }

  return null;
}
