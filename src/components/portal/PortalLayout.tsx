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
    <div className={`min-h-screen bg-background ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/portal/home" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">OS</span>
              </div>
              <span className="font-semibold text-foreground hidden sm:block">Dynasty</span>
            </Link>
            <div className="h-6 w-px bg-border" />
            <h1 className="text-lg font-medium text-foreground">{title}</h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Language Selector */}
            <LanguageSelector />

            {/* Role Badge */}
            {profile?.primary_role && (
              <Badge variant="secondary" className="hidden sm:flex">
                {getRoleDisplayName(profile.primary_role)}
              </Badge>
            )}

            {/* User Menu */}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" asChild>
                <Link to="/portal/home">
                  <Home className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
