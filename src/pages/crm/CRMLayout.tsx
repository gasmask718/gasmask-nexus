import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { useBusiness } from '@/contexts/BusinessContext';

interface CRMLayoutProps {
  children: ReactNode;
  title?: string;
}

export default function CRMLayout({ children, title }: CRMLayoutProps) {
  const { role, loading } = useUserRole();
  const { currentBusiness, loading: businessLoading } = useBusiness();

  if (loading || businessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading CRM...</p>
        </div>
      </div>
    );
  }

  const normalizedRole = role?.trim().toLowerCase();

  if (normalizedRole !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6">
        {children}
      </div>
    </div>
  );
}
