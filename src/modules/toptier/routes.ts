import { ModuleRoute } from '../types';
import { Calendar, Car, MapPin, Gift, LayoutDashboard } from 'lucide-react';
import TopTierDashboard from '@/pages/os/toptier/TopTierDashboard';

export const topTierRoutes: ModuleRoute[] = [
  {
    path: '',
    component: TopTierDashboard,
    label: 'Dashboard',
    icon: LayoutDashboard,
    requiresAuth: true,
    allowedRoles: ['admin', 'employee', 'manager'],
  },
  {
    path: '/bookings',
    component: TopTierDashboard,
    label: 'Bookings',
    icon: Calendar,
    requiresAuth: true,
    allowedRoles: ['admin', 'employee', 'manager'],
  },
  {
    path: '/vehicles',
    component: TopTierDashboard,
    label: 'Vehicles',
    icon: Car,
    requiresAuth: true,
    allowedRoles: ['admin', 'employee'],
  },
  {
    path: '/zones',
    component: TopTierDashboard,
    label: 'Zones',
    icon: MapPin,
    requiresAuth: true,
    allowedRoles: ['admin', 'employee'],
  },
  {
    path: '/gifts',
    component: TopTierDashboard,
    label: 'Gift Packages',
    icon: Gift,
    requiresAuth: true,
    allowedRoles: ['admin', 'employee', 'manager'],
  },
];
