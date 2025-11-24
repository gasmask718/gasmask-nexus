import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { useBusiness } from '@/contexts/BusinessContext';
import { departmentThemes } from '@/config/departmentThemes';
import '@/theme/departmentStyles.css';

interface CallCenterLayoutProps {
  children: ReactNode;
  title?: string;
}

export default function CallCenterLayout({ children, title }: CallCenterLayoutProps) {
  const { role, loading } = useUserRole();
  const { currentBusiness, loading: businessLoading } = useBusiness();
  const theme = departmentThemes.callCenter;

  if (loading || businessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: theme.lightBg }}>
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 mx-auto" style={{ borderColor: theme.color }}></div>
          <p className="text-muted-foreground">Loading Call Center Cloud...</p>
        </div>
      </div>
    );
  }

  const normalizedRole = role?.trim().toLowerCase();

  if (normalizedRole !== 'admin' && normalizedRole !== 'callcenter_worker') {
    return <Navigate to="/" replace />;
  }

  return (
    <div 
      className="min-h-screen"
      style={{ backgroundColor: theme.lightBg }}
    >
      <div 
        className="dept-header" 
        style={{ backgroundColor: theme.color }}
      >
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-white">{theme.name}</h1>
          <p className="text-white/90 text-sm">Multi-business AI telephony command center</p>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto p-6">
        <div 
          className="dept-container"
          style={{ 
            '--color': theme.color, 
            '--color-rgb': theme.colorRgb,
            borderLeft: `4px solid ${theme.accent}`
          } as React.CSSProperties}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
