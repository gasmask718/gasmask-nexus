import { DynastyModule, SidebarItem } from '../types';
import { Home, Briefcase, Users, FileText, Calendar, CreditCard, LayoutDashboard } from 'lucide-react';
import ICleanDashboard from '@/pages/os/iclean/ICleanDashboard';

const sidebarItems: SidebarItem[] = [
  { path: '/os/iclean', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/os/iclean/jobs', label: 'Jobs', icon: Briefcase },
  { path: '/os/iclean/staff', label: 'Staff', icon: Users },
  { path: '/os/iclean/contracts', label: 'Contracts', icon: FileText },
  { path: '/os/iclean/schedules', label: 'Schedules', icon: Calendar },
  { path: '/os/iclean/billing', label: 'Billing', icon: CreditCard },
];

export const ICleanModule: DynastyModule = {
  config: {
    id: 'iclean',
    name: 'iClean WeClean OS',
    description: 'Commercial + residential cleaning, routes, contracts, invoices',
    basePath: '/os/iclean',
    icon: Home,
    color: 'cyan',
    permissions: ['admin', 'employee', 'manager'],
    isEnabled: true,
    order: 12,
  },
  routes: [
    { path: '', component: ICleanDashboard, label: 'Dashboard', icon: LayoutDashboard, requiresAuth: true },
    { path: '/jobs', component: ICleanDashboard, label: 'Jobs', icon: Briefcase, requiresAuth: true },
    { path: '/staff', component: ICleanDashboard, label: 'Staff', icon: Users, requiresAuth: true },
    { path: '/contracts', component: ICleanDashboard, label: 'Contracts', icon: FileText, requiresAuth: true },
    { path: '/schedules', component: ICleanDashboard, label: 'Schedules', icon: Calendar, requiresAuth: true },
    { path: '/billing', component: ICleanDashboard, label: 'Billing', icon: CreditCard, requiresAuth: true },
  ],
  Dashboard: ICleanDashboard,
  sidebarItems,
};

export default ICleanModule;
