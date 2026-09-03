import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { LogOut, Crown, Download, Boxes } from 'lucide-react';
import { Button } from '@/components/ui/button';
import OpsBottomNav from '@/layouts/OpsBottomNav';
import PwaGate from '@/components/pwa/PwaGate';
import PwaUpdateToast from '@/components/pwa/PwaUpdateToast';
import OpsAccessGate from '@/components/security/OpsAccessGate';
import { usePwaInstall } from '@/hooks/usePwaInstall';

/**
 * OpsLayout — Mobile-first layout for portal/field workers
 * Sticky header + bottom nav + noindex SEO protection
 */
export default function OpsLayout() {
  const { signOut } = useAuth();
  const { data } = useCurrentUserProfile();
  const navigate = useNavigate();
  const { canInstall, triggerInstall } = usePwaInstall();

  // SEO protection: inject noindex meta tag
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  const userName = data?.profile?.full_name || 'User';
  const userRole = data?.profile?.primary_role || '';
  // The wholesaler portal is a Dynasty Direct surface, not a GasMask one —
  // brand the shell by the portal being viewed, not by the hosting project.
  const { pathname } = useLocation();
  const isWholesalerPortal = pathname.startsWith('/portal/wholesaler');

  return (
    <OpsAccessGate>
      <div className="min-h-screen bg-background flex flex-col safe-area-top safe-area-x">
        {/* Sticky Top Header */}
        <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-md safe-area-top">
          <div className="flex items-center justify-between px-3 sm:px-4 h-14">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                {isWholesalerPortal ? (
                  <Boxes className="h-4 w-4 text-primary" />
                ) : (
                  <Crown className="h-4 w-4 text-primary" />
                )}
              </div>
              <span className="font-bold text-sm text-foreground">
                {isWholesalerPortal ? 'Dynasty Direct Wholesaler' : 'GasMask Ops'}
              </span>
            </div>


            <div className="flex items-center gap-1.5 sm:gap-2">
              {canInstall && (
                <Button variant="outline" size="sm" onClick={triggerInstall} className="gap-1.5 h-8 text-xs">
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Install</span>
                </Button>
              )}
              <div className="text-right hidden sm:block">
                <p className="text-xs font-medium text-foreground truncate max-w-[120px]">{userName}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{userRole}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  signOut();
                  navigate('/auth');
                }}
                className="h-10 w-10 touch-target"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* PWA Install Banner + Update Toast */}
        <PwaGate />
        <PwaUpdateToast />

        {/* Main Content — padding-bottom for bottom nav */}
        <main className="flex-1 pb-20 px-3 sm:px-4 md:px-6">
          <Outlet />
        </main>

        {/* Bottom Navigation */}
        <OpsBottomNav />
      </div>
    </OpsAccessGate>
  );
}
