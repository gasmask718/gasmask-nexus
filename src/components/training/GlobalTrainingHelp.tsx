import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { TrainingHelp } from './TrainingHelp';
import type { TrainingRole } from './useTrainingData';

/**
 * Detects the active portal role from URL + auth role and mounts the ❓
 * help button + first-day mode automatically. Drop once in App root.
 */
function detectRole(pathname: string, authRole: string | null): TrainingRole | null {
  const p = pathname.toLowerCase();

  // Path-based detection (portal takes priority over role)
  if (p.startsWith('/portal/driver') || p.startsWith('/driver')) return 'driver';
  if (p.startsWith('/portal/biker') || p.startsWith('/biker')) return 'biker';
  if (p.startsWith('/portal/ambassador') || p.startsWith('/ambassador')) return 'ambassador';
  if (p.startsWith('/portal/wholesaler') || p.startsWith('/wholesaler')) return 'wholesaler';
  if (
    p.startsWith('/portal/production') ||
    p.startsWith('/production') ||
    p.startsWith('/portals/production')
  )
    return 'production';

  // Office hub: dashboard, system-health, admin queues
  if (
    p === '/' ||
    p.startsWith('/dashboard') ||
    p.startsWith('/system-health') ||
    p.startsWith('/inbox') ||
    p.startsWith('/admin')
  ) {
    return 'office';
  }

  // Fallback to auth role if it matches a known training role
  const role = (authRole ?? '').toLowerCase();
  if (
    role === 'driver' ||
    role === 'biker' ||
    role === 'ambassador' ||
    role === 'wholesaler' ||
    role === 'production' ||
    role === 'office'
  ) {
    return role as TrainingRole;
  }
  return null;
}

export function GlobalTrainingHelp() {
  const { pathname } = useLocation();
  const { user, userRole } = useAuth();

  // Hide on public/auth screens
  if (!user) return null;
  if (
    pathname.startsWith('/auth') ||
    pathname.startsWith('/install') ||
    pathname === '/sign-in'
  ) {
    return null;
  }

  const role = detectRole(pathname, userRole);
  if (!role) return null;

  return <TrainingHelp role={role} />;
}

export default GlobalTrainingHelp;
