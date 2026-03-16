import { DynastyModule, SidebarItem } from '../types';
import { Globe, LayoutDashboard, Search, Database, Target, Phone, Headset, BarChart3, FolderOpen } from 'lucide-react';
import BrandaroDashboard from '@/pages/brandaro/BrandaroDashboard';
import LeadDiscoveryPage from '@/pages/brandaro/LeadDiscoveryPage';
import LeadDatabasePage from '@/pages/brandaro/LeadDatabasePage';
import LeadQualificationPage from '@/pages/brandaro/LeadQualificationPage';
import CallingOpsPage from '@/pages/brandaro/CallingOpsPage';
import VAWorkspacePage from '@/pages/brandaro/VAWorkspacePage';
import VAPerformancePage from '@/pages/brandaro/VAPerformancePage';
import CampaignManagerPage from '@/pages/brandaro/CampaignManagerPage';

const sidebarItems: SidebarItem[] = [
  { path: '/os/brandaro/dashboard', label: 'Command Center', icon: LayoutDashboard },
  { path: '/os/brandaro/discovery', label: 'Lead Discovery', icon: Search },
  { path: '/os/brandaro/leads', label: 'Lead Database', icon: Database },
  { path: '/os/brandaro/qualification', label: 'Qualification', icon: Target },
  { path: '/os/brandaro/calling', label: 'Calling Ops', icon: Phone },
  { path: '/os/brandaro/workspace', label: 'VA Workspace', icon: Headset },
  { path: '/os/brandaro/performance', label: 'VA Performance', icon: BarChart3 },
  { path: '/os/brandaro/campaigns', label: 'Campaigns', icon: FolderOpen },
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
    { path: '/calling', component: CallingOpsPage, label: 'Calling Ops', icon: Phone, requiresAuth: true },
    { path: '/workspace', component: VAWorkspacePage, label: 'VA Workspace', icon: Headset, requiresAuth: true },
    { path: '/performance', component: VAPerformancePage, label: 'VA Performance', icon: BarChart3, requiresAuth: true },
    { path: '/campaigns', component: CampaignManagerPage, label: 'Campaigns', icon: FolderOpen, requiresAuth: true },
  ],
  Dashboard: BrandaroDashboard,
  sidebarItems,
};

export default BrandaroModule;
