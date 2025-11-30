import { DynastyModule, SidebarItem } from '../types';
import { Trophy, FileText, CheckCircle, Clock, LayoutDashboard } from 'lucide-react';
import GrantsDashboard from '@/pages/os/grants/GrantsDashboard';

const sidebarItems: SidebarItem[] = [
  { path: '/os/grants', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/os/grants/applications', label: 'Applications', icon: FileText },
  { path: '/os/grants/approved', label: 'Approved', icon: CheckCircle },
  { path: '/os/grants/pending', label: 'Pending', icon: Clock },
];

export const GrantsModule: DynastyModule = {
  config: {
    id: 'grants',
    name: 'Grant Company OS',
    description: 'Grant applications, approvals, and tracking',
    basePath: '/os/grants',
    icon: Trophy,
    color: 'yellow',
    permissions: ['admin', 'employee', 'accountant'],
    isEnabled: true,
    order: 21,
  },
  routes: [
    { path: '', component: GrantsDashboard, label: 'Dashboard', icon: LayoutDashboard, requiresAuth: true },
    { path: '/applications', component: GrantsDashboard, label: 'Applications', icon: FileText, requiresAuth: true },
    { path: '/approved', component: GrantsDashboard, label: 'Approved', icon: CheckCircle, requiresAuth: true },
    { path: '/pending', component: GrantsDashboard, label: 'Pending', icon: Clock, requiresAuth: true },
  ],
  Dashboard: GrantsDashboard,
  sidebarItems,
};

export default GrantsModule;
