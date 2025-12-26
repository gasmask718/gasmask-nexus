import { DynastyModule, SidebarItem } from '../types';
import { PartyPopper, Building, Users, Package, ShoppingBag, Sparkles, LayoutDashboard, UserCog, CalendarDays, DollarSign, Clock, Star, FileText, MessageSquare } from 'lucide-react';
import UnforgettableDashboard from '@/pages/os/unforgettable/UnforgettableDashboard';
import UnforgettableStaff from '@/pages/os/unforgettable/UnforgettableStaff';
import UnforgettableStaffProfile from '@/pages/os/unforgettable/UnforgettableStaffProfile';
import UnforgettableScheduling from '@/pages/os/unforgettable/UnforgettableScheduling';
import UnforgettablePayroll from '@/pages/os/unforgettable/UnforgettablePayroll';
import UnforgettableAvailability from '@/pages/os/unforgettable/UnforgettableAvailability';
import UnforgettablePerformance from '@/pages/os/unforgettable/UnforgettablePerformance';
import UnforgettableDocuments from '@/pages/os/unforgettable/UnforgettableDocuments';
import UnforgettableCommunications from '@/pages/os/unforgettable/UnforgettableCommunications';

const sidebarItems: SidebarItem[] = [
  { path: '/os/unforgettable', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/os/unforgettable/staff', label: 'Staff', icon: UserCog },
  { path: '/os/unforgettable/scheduling', label: 'Scheduling', icon: CalendarDays },
  { path: '/os/unforgettable/payroll', label: 'Payroll', icon: DollarSign },
  { path: '/os/unforgettable/availability', label: 'Availability', icon: Clock },
  { path: '/os/unforgettable/performance', label: 'Performance', icon: Star },
  { path: '/os/unforgettable/documents', label: 'Documents', icon: FileText },
  { path: '/os/unforgettable/communications', label: 'Communications', icon: MessageSquare },
  { path: '/os/unforgettable/halls', label: 'Event Halls', icon: Building },
  { path: '/os/unforgettable/vendors', label: 'Vendors', icon: Users },
  { path: '/os/unforgettable/rentals', label: 'Rentals', icon: Package },
  { path: '/os/unforgettable/party-bags', label: 'Party Bags', icon: ShoppingBag },
  { path: '/os/unforgettable/ai-builder', label: 'AI Party Builder', icon: Sparkles },
];

export const UnforgettableModule: DynastyModule = {
  config: {
    id: 'unforgettable',
    name: 'Unforgettable Times USA OS',
    description: 'Event halls, party planning, 3D setups, staff, rentals',
    basePath: '/os/unforgettable',
    icon: PartyPopper,
    color: 'pink',
    permissions: ['admin', 'employee', 'manager'],
    isEnabled: true,
    order: 11,
  },
  routes: [
    { path: '', component: UnforgettableDashboard, label: 'Dashboard', icon: LayoutDashboard, requiresAuth: true },
    { path: '/staff', component: UnforgettableStaff, label: 'Staff', icon: UserCog, requiresAuth: true },
    { path: '/staff/:staffId', component: UnforgettableStaffProfile, label: 'Staff Profile', icon: UserCog, requiresAuth: true },
    { path: '/scheduling', component: UnforgettableScheduling, label: 'Scheduling', icon: CalendarDays, requiresAuth: true },
    { path: '/payroll', component: UnforgettablePayroll, label: 'Payroll', icon: DollarSign, requiresAuth: true },
    { path: '/availability', component: UnforgettableAvailability, label: 'Availability', icon: Clock, requiresAuth: true },
    { path: '/performance', component: UnforgettablePerformance, label: 'Performance', icon: Star, requiresAuth: true },
    { path: '/documents', component: UnforgettableDocuments, label: 'Documents', icon: FileText, requiresAuth: true },
    { path: '/communications', component: UnforgettableCommunications, label: 'Communications', icon: MessageSquare, requiresAuth: true },
    { path: '/halls', component: UnforgettableDashboard, label: 'Event Halls', icon: Building, requiresAuth: true },
    { path: '/vendors', component: UnforgettableDashboard, label: 'Vendors', icon: Users, requiresAuth: true },
    { path: '/rentals', component: UnforgettableDashboard, label: 'Rentals', icon: Package, requiresAuth: true },
    { path: '/party-bags', component: UnforgettableDashboard, label: 'Party Bags', icon: ShoppingBag, requiresAuth: true },
    { path: '/ai-builder', component: UnforgettableDashboard, label: 'AI Party Builder', icon: Sparkles, requiresAuth: true },
  ],
  Dashboard: UnforgettableDashboard,
  sidebarItems,
};

export default UnforgettableModule;
