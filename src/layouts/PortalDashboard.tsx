import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Bell, MessageSquare, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LanguageSelector } from '@/components/portal/LanguageSelector';
import { useTranslation } from '@/hooks/useTranslation';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

interface PortalDashboardProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  roleColor?: 'cyan' | 'green' | 'amber' | 'purple' | 'red';
  showAiAssistant?: boolean;
}

const roleColorStyles = {
  cyan: 'text-hud-cyan border-hud-cyan/30',
  green: 'text-hud-green border-hud-green/30',
  amber: 'text-hud-amber border-hud-amber/30',
  purple: 'text-hud-purple border-hud-purple/30',
  red: 'text-primary border-primary/30',
};

export default function PortalDashboard({
  children,
  title,
  subtitle,
  roleColor = 'cyan',
  showAiAssistant = true
}: PortalDashboardProps) {
  const navigate = useNavigate();
  const { t, isRTL } = useTranslation();
  const { data: profileData } = useCurrentUserProfile();
  
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <div className={cn('min-h-screen bg-background safe-area-top safe-area-x', isRTL && 'rtl')}>
      {/* Top HUD Bar */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md safe-area-top">
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3">
          {/* Left: Title */}
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <div className={cn(
              'px-2 sm:px-3 py-1 border rounded-md text-[10px] sm:text-xs uppercase tracking-widest font-bold shrink-0',
              roleColorStyles[roleColor]
            )}>
              {title}
            </div>
            {subtitle && (
              <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline truncate">
                {subtitle}
              </span>
            )}
          </div>
          
          {/* Right: Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <LanguageSelector />
            
            <Button variant="ghost" size="icon" className="relative touch-target">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
            </Button>
            
            <Button variant="ghost" size="icon" className="touch-target">
              <MessageSquare className="h-4 w-4" />
            </Button>
            
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-md bg-muted/50">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm truncate max-w-[100px]">
                {profileData?.profile?.full_name || 'User'}
              </span>
            </div>
            
            <Button variant="ghost" size="icon" onClick={handleLogout} className="touch-target">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Scan line effect */}
        <div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      </header>
      
      {/* Main Content */}
      <main className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
        {children}
      </main>
      
      {/* AI Assistant Toggle (floating) */}
      {showAiAssistant && (
        <button 
          className={cn(
            'fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-12 h-12 sm:w-14 sm:h-14 rounded-full',
            'bg-card border-2 flex items-center justify-center',
            'transition-all hover:scale-110 touch-target safe-area-bottom',
            roleColorStyles[roleColor]
          )}
        >
          <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6" />
        </button>
      )}
    </div>
  );
}
