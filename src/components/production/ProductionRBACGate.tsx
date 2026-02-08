/**
 * Production RBAC Gate Component
 * 
 * Wraps production portal sections with role-tier checks.
 * Shows a locked state with audit logging for unauthorized access attempts.
 */

import { ReactNode, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ProductionRoleTier, useLogAccessDenial } from '@/hooks/useProductionRBAC';

interface ProductionRBACGateProps {
  children: ReactNode;
  /** Current user's tier */
  currentTier: ProductionRoleTier;
  /** Minimum tier required */
  requiredTier: 'admin' | 'manager' | 'worker';
  /** Resource being gated (for audit) */
  resourceName: string;
  /** Fallback content when access denied */
  fallback?: ReactNode;
}

const TIER_LEVELS: Record<ProductionRoleTier, number> = {
  none: 0,
  worker: 1,
  manager: 2,
  admin: 3,
};

export function ProductionRBACGate({
  children,
  currentTier,
  requiredTier,
  resourceName,
  fallback,
}: ProductionRBACGateProps) {
  const logDenial = useLogAccessDenial();
  
  const hasAccess = TIER_LEVELS[currentTier] >= TIER_LEVELS[requiredTier];
  
  // Log denial on mount if access is denied
  useEffect(() => {
    if (!hasAccess && currentTier !== 'none') {
      logDenial.mutate({
        resource: resourceName,
        action: 'view',
        userRole: currentTier,
        requiredRole: requiredTier,
      });
    }
  }, [hasAccess, currentTier, requiredTier, resourceName]);
  
  if (hasAccess) return <>{children}</>;
  
  if (fallback) return <>{fallback}</>;
  
  return (
    <Card className="border-dashed border-muted-foreground/30">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-2">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
        <CardTitle className="text-base text-muted-foreground">
          Restricted Access
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          <strong>{resourceName}</strong> requires{' '}
          <Badge variant="outline" className="mx-1">
            {requiredTier}
          </Badge>{' '}
          access or higher.
        </p>
        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground/60">
          <ShieldAlert className="h-3 w-3" />
          <span>This access attempt has been logged.</span>
        </div>
      </CardContent>
    </Card>
  );
}
