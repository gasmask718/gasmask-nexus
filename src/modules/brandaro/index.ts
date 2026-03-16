import { DynastyModule, SidebarItem } from '../types';
import { Globe, LayoutDashboard, Search, Database, Target } from 'lucide-react';
import BrandaroDashboard from '@/pages/brandaro/BrandaroDashboard';
import LeadDiscoveryPage from '@/pages/brandaro/LeadDiscoveryPage';
import LeadDatabasePage from '@/pages/brandaro/LeadDatabasePage';
import LeadQualificationPage from '@/pages/brandaro/LeadQualificationPage';

const sidebarItems: SidebarItem[] = [
  { path: '/os/brandaro/dashboard', label: 'Command Center', icon: LayoutDashboard },
  { path: '/os/brandaro/discovery', label: 'Lead Discovery', icon: Search },
  { path: '/os/brandaro/leads', label: 'Lead Database', icon: Database },
  { path: '/os/brandaro/qualification', label: 'Qualification', icon: Target },
];

export const BrandaroModule: DynastyModule = {
  config: {
    id: 'brandaro',
    name: 'Brandaro Digital',
    description: 'Website agency automation — lead discovery to recurring revenue',
    basePath: '/os/brandaro',
    icon: Globe,
    color: 'cyan',
    permissions: ['admin', 'owner', 'va', 'manager'],
    isEnabled: true,
    order: 15,
  },
  routes: [
    { path: '', component: BrandaroDashboard, label: 'Command Center', icon: LayoutDashboard, requiresAuth: true },
    { path: '/dashboard', component: BrandaroDashboard, label: 'Command Center', icon: LayoutDashboard, requiresAuth: true },
    { path: '/discovery', component: LeadDiscoveryPage, label: 'Lead Discovery', icon: Search, requiresAuth: true },
    { path: '/leads', component: LeadDatabasePage, label: 'Lead Database', icon: Database, requiresAuth: true },
    { path: '/qualification', component: LeadQualificationPage, label: 'Qualification', icon: Target, requiresAuth: true },
  ],
  Dashboard: BrandaroDashboard,
  sidebarItems,
};

export default BrandaroModule;
