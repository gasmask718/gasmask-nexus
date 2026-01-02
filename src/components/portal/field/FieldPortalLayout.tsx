import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Bell, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { PortalSidebar } from './PortalSidebar';

interface FieldPortalLayoutProps {
  children: ReactNode;
  portalType: 'driver' | 'biker';
}

export function FieldPortalLayout({ children, portalType }: FieldPortalLayoutProps) {
  const navigate = useNavigate();
  const { data: profileData } = useCurrentUserProfile();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const accentColor = portalType === 'driver' ? 'hud-cyan' : 'hud-green';

  return (
    <div className="min-h-screen bg-background flex w-full">
      {/* Sidebar */}
      <PortalSidebar portalType={portalType} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-sm">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className={cn(
                'px-3 py-1 border rounded-md text-xs uppercase tracking-widest font-bold',
                portalType === 'driver' 
                  ? 'text-hud-cyan border-hud-cyan/30' 
                  : 'text-hud-green border-hud-green/30'
              )}>
                {portalType === 'driver' ? 'DRIVER PORTAL' : 'BIKER PORTAL'}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-4 w-4" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
              </Button>

              <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-md bg-muted/50">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {profileData?.profile?.full_name || 'Field User'}
                </span>
              </div>

              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className={cn(
            'h-px bg-gradient-to-r from-transparent to-transparent',
            portalType === 'driver' ? 'via-hud-cyan/50' : 'via-hud-green/50'
          )} />
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
