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
    <div className={cn('min-h-screen bg-background', isRTL && 'rtl')}>
      {/* Top HUD Bar */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left: Title */}
          <div className="flex items-center gap-4">
            <div className={cn(
              'px-3 py-1 border rounded-md text-xs uppercase tracking-widest font-bold',
              roleColorStyles[roleColor]
            )}>
              {title}
            </div>
            {subtitle && (
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {subtitle}
              </span>
            )}
          </div>
          
          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <LanguageSelector />
            
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
            </Button>
            
            <Button variant="ghost" size="icon">
              <MessageSquare className="h-4 w-4" />
            </Button>
            
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-md bg-muted/50">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {profileData?.profile?.full_name || 'User'}
              </span>
            </div>
            
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Scan line effect */}
        <div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      </header>
      
      {/* Main Content */}
      <main className="p-4 md:p-6 max-w-7xl mx-auto">
        {children}
      </main>
      
      {/* AI Assistant Toggle (floating) */}
      {showAiAssistant && (
        <button 
          className={cn(
            'fixed bottom-6 right-6 w-14 h-14 rounded-full',
            'bg-card border-2 flex items-center justify-center',
            'transition-all hover:scale-110',
            roleColorStyles[roleColor]
          )}
        >
          <MessageSquare className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
