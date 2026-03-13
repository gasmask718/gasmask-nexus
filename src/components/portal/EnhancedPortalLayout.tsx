import { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Home, Menu, ChevronLeft, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { getRoleDisplayName } from '@/services/roleService';
import { LanguageSelector } from './LanguageSelector';
import { useTranslation } from '@/hooks/useTranslation';
import { SimulationBadge, useSimulationMode } from '@/contexts/SimulationModeContext';
import { PwaInstallButton } from '@/components/pwa/PwaInstallButton';
import { useBusiness } from '@/contexts/BusinessContext';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface QuickAction {
  label: string;
  href: string;
  icon?: ReactNode;
}

interface EnhancedPortalLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  portalIcon?: ReactNode;
  backPath?: string;
  backLabel?: string;
  quickActions?: QuickAction[];
  showBusinessSelector?: boolean;
  className?: string;
}

export function EnhancedPortalLayout({ 
  children, 
  title,
  subtitle,
  portalIcon,
  backPath,
  backLabel = 'Back',
  quickActions = [],
  showBusinessSelector = true,
  className,
}: EnhancedPortalLayoutProps) {
  const navigate = useNavigate();
  const { data: profileData } = useCurrentUserProfile();
  const profile = profileData?.profile;
  const { isRTL } = useTranslation();
  const { simulationMode } = useSimulationMode();
  const { currentBusiness, businesses, switchBusiness } = useBusiness();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  return (
    <div className={cn('min-h-screen bg-background safe-area-top safe-area-x', isRTL ? 'rtl' : 'ltr')} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50 safe-area-top">
        <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              {/* Back button */}
              {backPath && (
                <Button variant="ghost" size="sm" asChild className="gap-1 shrink-0 touch-target">
                  <Link to={backPath}>
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">{backLabel}</span>
                  </Link>
                </Button>
              )}

              {/* Logo */}
              <Link to="/portal/home" className="flex items-center gap-2 shrink-0">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  {portalIcon || <span className="text-primary-foreground font-bold text-sm">OS</span>}
                </div>
                <span className="font-semibold text-foreground hidden sm:block">Dynasty</span>
              </Link>

              <div className="h-6 w-px bg-border hidden sm:block" />

              {/* Title */}
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-medium text-foreground flex items-center gap-2 truncate">
                  {title}
                  {simulationMode && <SimulationBadge text="Demo" className="text-[10px]" />}
                </h1>
                {subtitle && (
                  <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              {/* Business Selector */}
              {showBusinessSelector && businesses && businesses.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5 max-w-[140px] sm:max-w-[180px] touch-target">
                      <Building2 className="h-4 w-4 shrink-0" />
                      <span className="truncate hidden sm:inline">
                        {currentBusiness?.name || 'All Businesses'}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Select Business</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {businesses.map((b) => (
                      <DropdownMenuItem 
                        key={b.id} 
                        onClick={() => switchBusiness(b.id)}
                        className={cn(currentBusiness?.id === b.id && 'bg-accent', 'min-h-[40px]')}
                      >
                        {b.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Quick Actions */}
              {quickActions.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="touch-target">
                      <Menu className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {quickActions.map((action, i) => (
                      <DropdownMenuItem key={i} asChild className="min-h-[40px]">
                        <Link to={action.href} className="flex items-center gap-2">
                          {action.icon}
                          {action.label}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* PWA Install */}
              <PwaInstallButton variant="ghost" size="sm" showLabel={false} />

              {/* Language Selector */}
              <LanguageSelector />

              {/* Role Badge */}
              {profile?.primary_role && (
                <Badge variant="secondary" className="hidden md:flex">
                  {getRoleDisplayName(profile.primary_role)}
                </Badge>
              )}

              {/* User Menu */}
              <div className="flex items-center gap-0.5">
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
        </div>
      </header>

      {/* Main Content */}
      <main className={cn('container mx-auto px-3 sm:px-4 py-4 sm:py-6', className)}>
        {children}
      </main>
    </div>
  );
}

export default EnhancedPortalLayout;
