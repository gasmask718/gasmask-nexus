import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';

interface RealEstateLayoutProps {
  children: ReactNode;
  title?: string;
}

export default function RealEstateLayout({ children, title }: RealEstateLayoutProps) {
  const { hasRole, isAdmin, loading, role } = useUserRole();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Normalize role for comparison
  const normalizedRole = role?.trim().toLowerCase();

  // Only admin and realestate_worker can access Real Estate Department
  if (normalizedRole !== 'admin' && normalizedRole !== 'realestate_worker') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      {title && (
        <div className="border-b border-border/50 pb-4">
          <h1 className="text-3xl font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground mt-1">Real Estate Department</p>
        </div>
      )}
      {children}
    </div>
  );
}
