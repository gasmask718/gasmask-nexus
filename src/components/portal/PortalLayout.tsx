import { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { getRoleDisplayName } from '@/services/roleService';
import { LanguageSelector } from './LanguageSelector';
import { useTranslation } from '@/hooks/useTranslation';
import { PwaInstallButton } from '@/components/pwa/PwaInstallButton';

interface PortalLayoutProps {
  children: ReactNode;
  title: string;
}

export default function PortalLayout({ children, title }: PortalLayoutProps) {
  const navigate = useNavigate();
  const { data: profileData } = useCurrentUserProfile();
  const profile = profileData?.profile;
  const { isRTL } = useTranslation();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  return (
    <div className={`min-h-screen bg-background safe-area-top safe-area-x ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50 safe-area-top">
        <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Link to="/portal/home" className="flex items-center gap-2 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">OS</span>
              </div>
              <span className="font-semibold text-foreground hidden sm:block">Dynasty</span>
            </Link>
            <div className="h-6 w-px bg-border hidden sm:block" />
            <h1 className="text-base sm:text-lg font-medium text-foreground truncate">{title}</h1>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Language Selector */}
            <LanguageSelector />

            {/* Role Badge */}
            {profile?.primary_role && (
              <Badge variant="secondary" className="hidden sm:flex">
                {getRoleDisplayName(profile.primary_role)}
              </Badge>
            )}

            {/* User Menu */}
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" asChild className="touch-target">
                <Link to="/portal/home">
                  <Home className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="ghost" size="icon" onClick={handleLogout} className="touch-target">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {children}
      </main>
    </div>
  );
}
