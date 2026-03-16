import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const { isInstalled } = usePwaInstall();

  if (isInstalled) {
    return (
      <Button variant={variant} size={size} className={className} disabled>
        <Download className="h-4 w-4" />
        {showLabel && <span className="ml-1.5">Installed ✓</span>}
      </Button>
    );
  }

  return (
    <Button variant={variant} size={size} className={className} onClick={() => navigate('/install')}>
      <Download className="h-4 w-4" />
      {showLabel && <span className="ml-1.5">Install App</span>}
    </Button>
  );
}
