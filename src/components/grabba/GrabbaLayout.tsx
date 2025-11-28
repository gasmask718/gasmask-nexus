import { ReactNode } from 'react';
import { GrabbaBrandProvider } from '@/contexts/GrabbaBrandContext';

// ═══════════════════════════════════════════════════════════════════════════════
// GRABBA LAYOUT WRAPPER
// Wraps all Grabba pages with unified brand context
// ═══════════════════════════════════════════════════════════════════════════════

interface GrabbaLayoutProps {
  children: ReactNode;
}

export function GrabbaLayout({ children }: GrabbaLayoutProps) {
  return (
    <GrabbaBrandProvider>
      {children}
    </GrabbaBrandProvider>
  );
}

export default GrabbaLayout;
