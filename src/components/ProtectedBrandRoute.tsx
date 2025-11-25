import { ReactNode } from 'react';
import { Shield } from 'lucide-react';
import { useVAPermissions } from '@/hooks/useVAPermissions';

interface ProtectedBrandRouteProps {
  children: ReactNode;
  requiredBrand: string;
}

export function ProtectedBrandRoute({ children, requiredBrand }: ProtectedBrandRouteProps) {
  const { canAccessBrand, isLoading } = useVAPermissions();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Shield className="w-12 h-12 mx-auto mb-4 animate-pulse" />
          <p>Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!canAccessBrand(requiredBrand)) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Shield className="w-12 h-12 mx-auto mb-4 text-red-600" />
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">
            You don't have permission to access {requiredBrand} data.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
