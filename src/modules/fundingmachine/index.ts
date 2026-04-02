import { DynastyModule, SidebarItem } from '../types';
import {
  Landmark, Users, Shield, Building2, CreditCard,
  TrendingUp, FileText, ClipboardList, LayoutDashboard, Plus
} from 'lucide-react';
import FundingMachineDashboard from '@/pages/funding-machine/FundingMachineDashboard';
import ClientIntakePage from '@/pages/funding-machine/ClientIntakePage';
import ClientProfilePage from '@/pages/funding-machine/ClientProfilePage';
import CreditRepairPage from '@/pages/funding-machine/CreditRepairPage';
import BusinessBuilderPage from '@/pages/funding-machine/BusinessBuilderPage';
import BureauIntelPage from '@/pages/funding-machine/BureauIntelPage';
import FundingMatrixPage from '@/pages/funding-machine/FundingMatrixPage';
import VelocityCalculatorPage from '@/pages/funding-machine/VelocityCalculatorPage';
import TradelineVaultPage from '@/pages/funding-machine/TradelineVaultPage';

const sidebarItems: SidebarItem[] = [
  { path: '/funding-machine', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/funding-machine/intake', label: 'New Client', icon: Plus },
  { path: '/funding-machine/credit-repair', label: 'Credit Repair', icon: Shield },
  { path: '/funding-machine/business-builder', label: 'Business Builder', icon: Building2 },
  { path: '/funding-machine/bureau-intel', label: 'Bureau Intelligence', icon: CreditCard },
  { path: '/funding-machine/funding-matrix', label: 'Funding Matrix', icon: Landmark },
  { path: '/funding-machine/velocity', label: 'Velocity Calculator', icon: TrendingUp },
  { path: '/funding-machine/tradeline-vault', label: 'Tradeline Vault', icon: FileText },
  { path: '/funding-machine/tasks', label: 'Task Cards', icon: ClipboardList },
];

export const FundingMachineModule: DynastyModule = {
  config: {
    id: 'funding-machine',
    name: 'Dynasty Funding Machine',
    description: 'End-to-end credit optimization & funding acquisition pipeline',
    basePath: '/funding-machine',
    icon: Landmark,
    color: 'amber',
    permissions: ['admin', 'employee', 'accountant'],
    isEnabled: true,
    order: 10,
  },
  routes: [
    { path: '', component: FundingMachineDashboard, label: 'Dashboard', icon: LayoutDashboard, requiresAuth: true },
    { path: '/intake', component: ClientIntakePage, label: 'New Client', icon: Plus, requiresAuth: true },
    { path: '/client/:clientId', component: ClientProfilePage, label: 'Client Profile', icon: Users, requiresAuth: true },
    // Placeholder routes for future session builds
    { path: '/credit-repair', component: CreditRepairPage, label: 'Credit Repair', icon: Shield, requiresAuth: true },
    { path: '/business-builder', component: BusinessBuilderPage, label: 'Business Builder', icon: Building2, requiresAuth: true },
    { path: '/bureau-intel', component: BureauIntelPage, label: 'Bureau Intelligence', icon: CreditCard, requiresAuth: true },
    { path: '/funding-matrix', component: FundingMatrixPage, label: 'Funding Matrix', icon: Landmark, requiresAuth: true },
    { path: '/velocity', component: FundingMachineDashboard, label: 'Velocity Calculator', icon: TrendingUp, requiresAuth: true },
    { path: '/tradeline-vault', component: FundingMachineDashboard, label: 'Tradeline Vault', icon: FileText, requiresAuth: true },
    { path: '/tasks', component: FundingMachineDashboard, label: 'Task Cards', icon: ClipboardList, requiresAuth: true },
  ],
  Dashboard: FundingMachineDashboard,
  sidebarItems,
};

export default FundingMachineModule;
