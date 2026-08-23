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
import { FeedbackFloatingButton } from '@/components/feedback/FeedbackFloatingButton';
import { QuickDialPad } from '@/components/ambassador/QuickDialPad';
import { AmbassadorFieldSession } from '@/components/ambassador/AmbassadorFieldSession';
import InstallAppPrompt from '@/components/pwa/InstallAppPrompt';

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
  return (
    <EnhancedPortalLayout
      title={title}
      subtitle={subtitle}
      portalIcon={portalIcon}
      backPath={backPath}
      backLabel={backLabel}
      showBusinessSelector={showBusinessSelector}
      className={className}
    >
      <AmbassadorPortalNav />
      <AmbassadorFieldSession />
      <div className="md:hidden mb-3">
        <InstallAppPrompt compact />
      </div>
      {/* Mobile-only bottom-pad so fixed nav doesn't cover content */}
      <div className="pb-20 md:pb-0">{children}</div>
      <FeedbackFloatingButton />
      <QuickDialPad />
      <AmbassadorMobileBottomNav />
    </EnhancedPortalLayout>
  );
}

export default AmbassadorLayout;
