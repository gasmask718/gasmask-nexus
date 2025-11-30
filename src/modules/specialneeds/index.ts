import { DynastyModule, SidebarItem } from '../types';
import { Accessibility, Heart, Users, BookOpen, Calendar, LayoutDashboard } from 'lucide-react';
import SpecialNeedsDashboard from '@/pages/os/specialneeds/SpecialNeedsDashboard';

const sidebarItems: SidebarItem[] = [
  { path: '/os/special-needs', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/os/special-needs/providers', label: 'Providers', icon: Heart },
  { path: '/os/special-needs/families', label: 'Families', icon: Users },
  { path: '/os/special-needs/resources', label: 'Resources', icon: BookOpen },
  { path: '/os/special-needs/scheduling', label: 'Scheduling', icon: Calendar },
];

export const SpecialNeedsModule: DynastyModule = {
  config: {
    id: 'specialneeds',
    name: 'Special Needs App OS',
    description: 'Compassionate care coordination & support services',
    basePath: '/os/special-needs',
    icon: Accessibility,
    color: 'blue',
    permissions: ['admin', 'employee', 'manager', 'csr'],
    isEnabled: true,
    order: 14,
  },
  routes: [
    { path: '', component: SpecialNeedsDashboard, label: 'Dashboard', icon: LayoutDashboard, requiresAuth: true },
    { path: '/providers', component: SpecialNeedsDashboard, label: 'Providers', icon: Heart, requiresAuth: true },
    { path: '/families', component: SpecialNeedsDashboard, label: 'Families', icon: Users, requiresAuth: true },
    { path: '/resources', component: SpecialNeedsDashboard, label: 'Resources', icon: BookOpen, requiresAuth: true },
    { path: '/scheduling', component: SpecialNeedsDashboard, label: 'Scheduling', icon: Calendar, requiresAuth: true },
  ],
  Dashboard: SpecialNeedsDashboard,
  sidebarItems,
};

export default SpecialNeedsModule;
