import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { departmentThemes } from '@/theme/departmentThemes';
import '@/theme/departmentStyles.css';

interface PodLayoutProps {
  children: ReactNode;
  title?: string;
}

export default function PodLayout({ children, title }: PodLayoutProps) {
  const { role, loading } = useUserRole();
  const theme = departmentThemes.pod;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Normalize role for comparison
  const normalizedRole = role?.trim().toLowerCase();

  // Only admin and pod_worker can access POD Department
  if (normalizedRole !== 'admin' && normalizedRole !== 'pod_worker') {
    return <Navigate to="/" replace />;
  }

  return (
    <div 
      className="dept-container dept-tint" 
      style={{ '--color': theme.color, '--color-rgb': theme.colorRgb } as React.CSSProperties}
    >
      <div className="dept-header" style={{ backgroundColor: theme.color }}>
        {theme.name}
      </div>
      <div className="dept-border">
        {title && (
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground">{title}</h2>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
