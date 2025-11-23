import { ReactNode } from 'react';
import { departmentThemes } from '@/theme/departmentThemes';
import '@/theme/departmentStyles.css';

interface CRMLayoutProps {
  children: ReactNode;
  title?: string;
}

export default function CRMLayout({ children, title }: CRMLayoutProps) {
  const theme = departmentThemes.crm;

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
