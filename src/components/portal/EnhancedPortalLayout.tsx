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
    <div className={cn('min-h-screen bg-background', isRTL ? 'rtl' : 'ltr')} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Back button */}
              {backPath && (
                <Button variant="ghost" size="sm" asChild className="gap-1.5">
                  <Link to={backPath}>
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">{backLabel}</span>
                  </Link>
                </Button>
              )}

              {/* Logo */}
              <Link to="/portal/home" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  {portalIcon || <span className="text-primary-foreground font-bold text-sm">OS</span>}
                </div>
                <span className="font-semibold text-foreground hidden sm:block">Dynasty</span>
              </Link>

              <div className="h-6 w-px bg-border hidden sm:block" />

              {/* Title */}
              <div>
                <h1 className="text-lg font-medium text-foreground flex items-center gap-2">
                  {title}
                  {simulationMode && <SimulationBadge text="Demo" className="text-[10px]" />}
                </h1>
                {subtitle && (
                  <p className="text-xs text-muted-foreground">{subtitle}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Business Selector */}
              {showBusinessSelector && businesses && businesses.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 max-w-[180px]">
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
                        className={cn(currentBusiness?.id === b.id && 'bg-accent')}
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
                    <Button variant="ghost" size="icon">
                      <Menu className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {quickActions.map((action, i) => (
                      <DropdownMenuItem key={i} asChild>
                        <Link to={action.href} className="flex items-center gap-2">
                          {action.icon}
                          {action.label}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Language Selector */}
              <LanguageSelector />

              {/* Role Badge */}
              {profile?.primary_role && (
                <Badge variant="secondary" className="hidden md:flex">
                  {getRoleDisplayName(profile.primary_role)}
                </Badge>
              )}

              {/* User Menu */}
              <div className="flex items-center gap-1">
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
        </div>
      </header>

      {/* Main Content */}
      <main className={cn('container mx-auto px-4 py-6', className)}>
        {children}
      </main>
    </div>
  );
}

export default EnhancedPortalLayout;
