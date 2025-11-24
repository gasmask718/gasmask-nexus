import { ReactNode } from 'react';
import { useBusiness } from '@/contexts/BusinessContext';
import { departmentThemes } from '@/config/departmentThemes';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

interface CommunicationLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

const CommunicationLayout = ({ children, title, subtitle }: CommunicationLayoutProps) => {
  const { currentBusiness, loading } = useBusiness();
  const theme = departmentThemes.communication;

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: theme.lightBg }}>
        <div style={{ backgroundColor: theme.color }} className="p-6 text-white">
          <h1 className="text-3xl font-bold">{theme.name}</h1>
          <p className="text-white/80 mt-1">Loading...</p>
        </div>
        <div className="p-6">
          <p className="text-muted-foreground">Loading Communication Center...</p>
        </div>
      </div>
    );
  }

  if (!currentBusiness) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: theme.lightBg }}>
        <div style={{ backgroundColor: theme.color }} className="p-6 text-white">
          <h1 className="text-3xl font-bold">{theme.name}</h1>
        </div>
        <div className="p-6">
          <p className="text-muted-foreground">Please select a business to view communication data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.lightBg }}>
      {/* Header */}
      <div style={{ backgroundColor: theme.color }} className="p-6 text-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 text-sm mb-4 text-white/60">
            <Link to="/" className="hover:text-white transition-colors flex items-center gap-1">
              <Home className="h-3 w-3" />
              Home
            </Link>
            <ChevronRight className="h-3 w-3" />
            <Link to="/communication" className="hover:text-white transition-colors">
              {theme.name}
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-white">{title}</span>
          </div>
          <h1 className="text-3xl font-bold">{title}</h1>
          {subtitle && <p className="text-white/80 mt-1">{subtitle}</p>}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-6">
        {children}
      </div>
    </div>
  );
};

export default CommunicationLayout;
