import { DynastyModule, SidebarItem } from '../types';
import { topTierConfig } from './module.config';
import { topTierRoutes } from './routes';
import TopTierDashboard from '@/pages/os/toptier/TopTierDashboard';
import { Calendar, Car, MapPin, Gift, LayoutDashboard, Users, UserPlus, Building2 } from 'lucide-react';

const sidebarItems: SidebarItem[] = [
  { path: '/os/toptier', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/crm/toptier-experience/partners', label: 'Partner CRM', icon: Building2 },
  { path: '/crm/toptier-experience/customers', label: 'Customers', icon: Users },
  { path: '/crm/toptier-experience/customers/new', label: 'Add Customer', icon: UserPlus },
  { path: '/crm/toptier-experience/bookings', label: 'Bookings', icon: Calendar },
  { path: '/os/toptier/vehicles', label: 'Vehicles', icon: Car },
  { path: '/os/toptier/zones', label: 'Zones', icon: MapPin },
  { path: '/os/toptier/gifts', label: 'Gift Packages', icon: Gift },
];

export const TopTierModule: DynastyModule = {
  config: topTierConfig,
  routes: topTierRoutes,
  Dashboard: TopTierDashboard,
  sidebarItems,
};

export default TopTierModule;
