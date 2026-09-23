/**
 * AmbassadorLayout — Constitutional shell for ALL Ambassador portal pages
 * 
 * ARCHITECTURAL INVARIANT: Every Ambassador portal page MUST use this layout.
 * It guarantees the persistent navigation bar (including My Purchases) is always visible.
 * 
 * This wraps EnhancedPortalLayout and injects AmbassadorPortalNav between
 * the header and the page content. No page can "forget" to include navigation.
 */
import { ReactNode } from 'react';
import { EnhancedPortalLayout } from '@/components/portal/EnhancedPortalLayout';
import { AmbassadorPortalNav } from '@/components/ambassador/AmbassadorPortalNav';
import { AmbassadorMobileBottomNav } from '@/components/ambassador/AmbassadorMobileBottomNav';
import { AmbassadorHelpMenu } from '@/components/ambassador/AmbassadorHelpMenu';
import { QuickDialPad } from '@/components/ambassador/QuickDialPad';
import { AmbassadorFieldSession } from '@/components/ambassador/AmbassadorFieldSession';
import InstallAppPrompt from '@/components/pwa/InstallAppPrompt';
import { useReturnScrollRestoration } from '@/hooks/useReturnNavigation';

interface AmbassadorLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  portalIcon?: ReactNode;
  backPath?: string;
  backLabel?: string;
  showBusinessSelector?: boolean;
  className?: string;
}

export function AmbassadorLayout({
  children,
  title,
  subtitle,
  portalIcon,
  backPath,
  backLabel,
  showBusinessSelector,
  className,
}: AmbassadorLayoutProps) {
  useReturnScrollRestoration();

  return (
    <EnhancedPortalLayout
      title={title}
      subtitle={subtitle}
      portalIcon={portalIcon}
      backPath={backPath}
      backLabel={backLabel}
      showBusinessSelector={showBusinessSelector}
      className={className}
      homePath="/ambassador/dashboard"
    >
      <AmbassadorPortalNav />
      <AmbassadorFieldSession />
      <div className="md:hidden mb-3">
        <InstallAppPrompt compact />
      </div>
      {/* Keep page content above the mobile nav, floating controls, and iPhone home indicator. */}
      <div className="min-w-0 max-w-full overflow-x-hidden pb-[calc(9rem+env(safe-area-inset-bottom,0px))] md:overflow-x-visible md:pb-0">
        {children}
      </div>
      <AmbassadorHelpMenu />
      <QuickDialPad />
      <AmbassadorMobileBottomNav />
    </EnhancedPortalLayout>
  );
}

export default AmbassadorLayout;
