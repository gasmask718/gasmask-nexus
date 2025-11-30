import { DynastyModule, SidebarItem } from '../types';
import { TrendingUp, LineChart, BarChart3, Wallet, Brain, LayoutDashboard } from 'lucide-react';
import WealthEngineDashboard from '@/pages/os/wealth/WealthEngineDashboard';

const sidebarItems: SidebarItem[] = [
  { path: '/os/wealth-engine', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/os/wealth-engine/portfolio', label: 'Portfolio', icon: Wallet },
  { path: '/os/wealth-engine/stocks', label: 'Stocks', icon: LineChart },
  { path: '/os/wealth-engine/crypto', label: 'Crypto', icon: TrendingUp },
  { path: '/os/wealth-engine/trading', label: 'Trading Bots', icon: Brain },
  { path: '/os/wealth-engine/analytics', label: 'Analytics', icon: BarChart3 },
];

export const WealthModule: DynastyModule = {
  config: {
    id: 'wealth',
    name: 'Wealth Engine OS',
    description: 'Investment portfolio, trading bots, stocks & crypto',
    basePath: '/os/wealth-engine',
    icon: TrendingUp,
    color: 'emerald',
    permissions: ['admin', 'accountant'],
    isEnabled: true,
    order: 22,
  },
  routes: [
    { path: '', component: WealthEngineDashboard, label: 'Dashboard', icon: LayoutDashboard, requiresAuth: true },
    { path: '/portfolio', component: WealthEngineDashboard, label: 'Portfolio', icon: Wallet, requiresAuth: true },
    { path: '/stocks', component: WealthEngineDashboard, label: 'Stocks', icon: LineChart, requiresAuth: true },
    { path: '/crypto', component: WealthEngineDashboard, label: 'Crypto', icon: TrendingUp, requiresAuth: true },
    { path: '/trading', component: WealthEngineDashboard, label: 'Trading Bots', icon: Brain, requiresAuth: true },
    { path: '/analytics', component: WealthEngineDashboard, label: 'Analytics', icon: BarChart3, requiresAuth: true },
  ],
  Dashboard: WealthEngineDashboard,
  sidebarItems,
};

export default WealthModule;
