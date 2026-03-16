import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePwaInstall } from '@/hooks/usePwaInstall';

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
  const { canInstall, isInstalled, triggerInstall } = usePwaInstall();

  // Don't show if already installed or can't install
  if (isInstalled || !canInstall) return null;

  return (
    <Button variant={variant} size={size} className={className} onClick={triggerInstall}>
      <Download className="h-4 w-4" />
      {showLabel && <span className="ml-1.5">Install App</span>}
    </Button>
  );
}
