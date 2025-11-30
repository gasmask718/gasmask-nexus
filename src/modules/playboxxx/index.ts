import { DynastyModule, SidebarItem } from '../types';
import { Sparkles, Users, CreditCard, DollarSign, ShoppingCart, BarChart3, LayoutDashboard } from 'lucide-react';
import PlayboxxxDashboard from '@/pages/os/playboxxx/PlayboxxxDashboard';

const sidebarItems: SidebarItem[] = [
  { path: '/os/playboxxx', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/os/playboxxx/models', label: 'Models', icon: Users },
  { path: '/os/playboxxx/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { path: '/os/playboxxx/payouts', label: 'Payouts', icon: DollarSign },
  { path: '/os/playboxxx/store', label: 'Store', icon: ShoppingCart },
  { path: '/os/playboxxx/analytics', label: 'Analytics', icon: BarChart3 },
];

export const PlayboxxxModule: DynastyModule = {
  config: {
    id: 'playboxxx',
    name: 'PlayBoxxx OS',
    description: 'Creator economy, subscriber metrics, payouts, celebration gifts',
    basePath: '/os/playboxxx',
    icon: Sparkles,
    color: 'purple',
    permissions: ['admin', 'employee', 'manager'],
    isEnabled: true,
    order: 13,
  },
  routes: [
    { path: '', component: PlayboxxxDashboard, label: 'Dashboard', icon: LayoutDashboard, requiresAuth: true },
    { path: '/models', component: PlayboxxxDashboard, label: 'Models', icon: Users, requiresAuth: true },
    { path: '/subscriptions', component: PlayboxxxDashboard, label: 'Subscriptions', icon: CreditCard, requiresAuth: true },
    { path: '/payouts', component: PlayboxxxDashboard, label: 'Payouts', icon: DollarSign, requiresAuth: true },
    { path: '/store', component: PlayboxxxDashboard, label: 'Store', icon: ShoppingCart, requiresAuth: true },
    { path: '/analytics', component: PlayboxxxDashboard, label: 'Analytics', icon: BarChart3, requiresAuth: true },
  ],
  Dashboard: PlayboxxxDashboard,
  sidebarItems,
};

export default PlayboxxxModule;
