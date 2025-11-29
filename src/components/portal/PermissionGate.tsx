import { ReactNode } from 'react';
import { usePortalPermission } from '@/hooks/usePortalPermission';
import { Permission } from '@/lib/permissions';
import { Lock } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

interface PermissionGateProps {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
  showLocked?: boolean;
}

export function PermissionGate({ 
  permission, 
  children, 
  fallback,
  showLocked = false 
}: PermissionGateProps) {
  const hasAccess = usePortalPermission(permission);
  const { t } = useTranslation();
  
  if (hasAccess) {
    return <>{children}</>;
  }
  
  if (fallback) {
    return <>{fallback}</>;
  }
  
  if (showLocked) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm p-3 bg-muted/30 rounded-md">
        <Lock className="h-4 w-4" />
        <span>{t('no_permission')}</span>
      </div>
    );
  }
  
  return null;
}
