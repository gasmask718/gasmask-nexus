import { DynastyModule, SidebarItem } from '../types';
import { CreditCard, FileText, Users, CheckCircle, LayoutDashboard } from 'lucide-react';
import FundingDashboard from '@/pages/os/funding/FundingDashboard';

const sidebarItems: SidebarItem[] = [
  { path: '/os/funding', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/os/funding/applications', label: 'Applications', icon: FileText },
  { path: '/os/funding/approvals', label: 'Approvals', icon: CheckCircle },
  { path: '/os/funding/clients', label: 'Clients', icon: Users },
  { path: '/os/funding/credit-repair', label: 'Credit Repair', icon: CreditCard },
];

export const FundingModule: DynastyModule = {
  config: {
    id: 'funding',
    name: 'Funding Company OS',
    description: 'Business funding, credit repair, financial services',
    basePath: '/os/funding',
    icon: CreditCard,
    color: 'green',
    permissions: ['admin', 'employee', 'accountant'],
    isEnabled: true,
    order: 20,
  },
  routes: [
    { path: '', component: FundingDashboard, label: 'Dashboard', icon: LayoutDashboard, requiresAuth: true },
    { path: '/applications', component: FundingDashboard, label: 'Applications', icon: FileText, requiresAuth: true },
    { path: '/approvals', component: FundingDashboard, label: 'Approvals', icon: CheckCircle, requiresAuth: true },
    { path: '/clients', component: FundingDashboard, label: 'Clients', icon: Users, requiresAuth: true },
    { path: '/credit-repair', component: FundingDashboard, label: 'Credit Repair', icon: CreditCard, requiresAuth: true },
  ],
  Dashboard: FundingDashboard,
  sidebarItems,
};

export default FundingModule;
