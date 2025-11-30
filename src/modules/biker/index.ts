import { DynastyModule, SidebarItem } from '../types';
import { Bike, Route, DollarSign, CheckCircle, LayoutDashboard } from 'lucide-react';
import BikerDashboard from '@/pages/os/biker/BikerDashboard';

const sidebarItems: SidebarItem[] = [
  { path: '/biker/home', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/biker/route', label: 'My Route', icon: Route },
  { path: '/biker/payouts', label: 'Payouts', icon: DollarSign },
  { path: '/biker/completed', label: 'Completed', icon: CheckCircle },
];

export const BikerModule: DynastyModule = {
  config: {
    id: 'biker',
    name: 'Bikers / Store Checkers OS',
    description: 'Store check routes, inventory verification, payouts',
    basePath: '/biker',
    icon: Bike,
    color: 'red',
    permissions: ['admin', 'employee', 'biker', 'driver'],
    isEnabled: true,
    order: 40,
  },
  routes: [
    { path: '/home', component: BikerDashboard, label: 'Dashboard', icon: LayoutDashboard, requiresAuth: true },
    { path: '/route', component: BikerDashboard, label: 'My Route', icon: Route, requiresAuth: true },
    { path: '/payouts', component: BikerDashboard, label: 'Payouts', icon: DollarSign, requiresAuth: true },
    { path: '/completed', component: BikerDashboard, label: 'Completed', icon: CheckCircle, requiresAuth: true },
  ],
  Dashboard: BikerDashboard,
  sidebarItems,
};

export default BikerModule;
