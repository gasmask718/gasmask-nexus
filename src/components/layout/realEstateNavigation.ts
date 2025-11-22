import { Building, FileSearch, Target, Users, FileSignature, MapPin } from 'lucide-react';

export const realEstateNavItems = [
  { to: '/realestate', icon: Building, label: 'Real Estate HQ', roles: ['admin', 'realestate_worker'] },
  { to: '/realestate/leads', icon: FileSearch, label: 'Lead Intelligence', roles: ['admin', 'realestate_worker'] },
  { to: '/realestate/pipeline', icon: Target, label: 'Acquisition Pipeline', roles: ['admin', 'realestate_worker'] },
  { to: '/realestate/investors', icon: Users, label: 'Investor Marketplace', roles: ['admin', 'realestate_worker'] },
  { to: '/realestate/closings', icon: FileSignature, label: 'Deal Closings & Payments', roles: ['admin', 'realestate_worker'] },
  { to: '/realestate/expansion', icon: MapPin, label: 'Expansion Engine', roles: ['admin', 'realestate_worker'] },
];
