import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { departmentThemes } from '@/theme/departmentThemes';
import '@/theme/departmentStyles.css';

interface CallCenterLayoutProps {
  children: ReactNode;
  title?: string;
}

export default function CallCenterLayout({ children, title }: CallCenterLayoutProps) {
  const { role, loading } = useUserRole();
  const theme = departmentThemes.callcenter;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  const normalizedRole = role?.trim().toLowerCase();

  if (normalizedRole !== 'admin' && normalizedRole !== 'callcenter_worker') {
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
