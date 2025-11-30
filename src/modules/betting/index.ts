import { DynastyModule, SidebarItem } from '../types';
import { Trophy, Target, BarChart3, Shield, LayoutDashboard } from 'lucide-react';
import BettingDashboard from '@/pages/os/betting/BettingDashboard';

const sidebarItems: SidebarItem[] = [
  { path: '/os/sports-betting', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/os/sports-betting/predictions', label: 'Predictions', icon: Target },
  { path: '/os/sports-betting/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/os/sports-betting/hedge', label: 'Hedge Calculator', icon: Shield },
];

export const BettingModule: DynastyModule = {
  config: {
    id: 'betting',
    name: 'Sports Betting AI OS',
    description: 'AI predictions, analytics, hedge calculations',
    basePath: '/os/sports-betting',
    icon: Trophy,
    color: 'orange',
    permissions: ['admin'],
    isEnabled: true,
    order: 30,
  },
  routes: [
    { path: '', component: BettingDashboard, label: 'Dashboard', icon: LayoutDashboard, requiresAuth: true },
    { path: '/predictions', component: BettingDashboard, label: 'Predictions', icon: Target, requiresAuth: true },
    { path: '/analytics', component: BettingDashboard, label: 'Analytics', icon: BarChart3, requiresAuth: true },
    { path: '/hedge', component: BettingDashboard, label: 'Hedge Calculator', icon: Shield, requiresAuth: true },
  ],
  Dashboard: BettingDashboard,
  sidebarItems,
};

export default BettingModule;
