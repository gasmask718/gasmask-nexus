import { DynastyModule, SidebarItem } from '../types';
import { Globe, LayoutDashboard, Search, Database, Target, Phone, Headset, BarChart3, FolderOpen, Wand2, FileText, Bell, Hammer, Users, TrendingUp, Factory, ShieldCheck, Brain, Megaphone, Crown, Cpu, Activity, Smartphone, Zap } from 'lucide-react';
import BrandaroDashboard from '@/pages/brandaro/BrandaroDashboard';
import LeadDiscoveryPage from '@/pages/brandaro/LeadDiscoveryPage';
import LeadDatabasePage from '@/pages/brandaro/LeadDatabasePage';
import LeadQualificationPage from '@/pages/brandaro/LeadQualificationPage';
import CallingOpsPage from '@/pages/brandaro/CallingOpsPage';
import VAWorkspacePage from '@/pages/brandaro/VAWorkspacePage';
import VAPerformancePage from '@/pages/brandaro/VAPerformancePage';
import VACommandCenterPage from '@/pages/brandaro/VACommandCenterPage';
import CampaignManagerPage from '@/pages/brandaro/CampaignManagerPage';
import DemoEnginePage from '@/pages/brandaro/DemoEnginePage';
import ProposalBuilderPage from '@/pages/brandaro/ProposalBuilderPage';
import FollowUpEnginePage from '@/pages/brandaro/FollowUpEnginePage';
import ProductionPipelinePage from '@/pages/brandaro/ProductionPipelinePage';
import ClientPortalPage from '@/pages/brandaro/ClientPortalPage';
import RevenueAnalyticsPage from '@/pages/brandaro/RevenueAnalyticsPage';
import BuildPipelinePage from '@/pages/brandaro/BuildPipelinePage';
import ResultEnginePage from '@/pages/brandaro/ResultEnginePage';
import ReviewQueuePage from '@/pages/brandaro/ReviewQueuePage';
import CloserAIPage from '@/pages/brandaro/CloserAIPage';
import SystemStatusPage from '@/pages/brandaro/SystemStatusPage';
import BrandaroActivationCenter from '@/pages/brandaro/BrandaroActivationCenter';
import SpanishVADashboard from '@/pages/brandaro/SpanishVADashboard';
import SpanishManagerDashboard from '@/pages/brandaro/SpanishManagerDashboard';
import BrandaroGlobalControl from '@/pages/brandaro/BrandaroGlobalControl';

const sidebarItems: SidebarItem[] = [
  { path: '/os/brandaro/dashboard', label: 'Command Center', icon: LayoutDashboard },
  { path: '/os/brandaro/activation', label: 'Activation Center', icon: Zap },
  { path: '/os/brandaro/discovery', label: 'Lead Discovery', icon: Search },
  { path: '/os/brandaro/leads', label: 'Lead Database', icon: Database },
  { path: '/os/brandaro/qualification', label: 'Qualification', icon: Target },
  { path: '/os/brandaro/calling', label: 'Calling Ops', icon: Phone },
  { path: '/os/brandaro/workspace', label: 'VA Workspace', icon: Headset },
  { path: '/os/brandaro/command-center', label: 'VA Command Center', icon: Brain },
  { path: '/os/brandaro/campaigns', label: 'Campaigns', icon: FolderOpen },
  { path: '/os/brandaro/demos', label: 'Demo Engine', icon: Wand2 },
  { path: '/os/brandaro/proposals', label: 'Proposals', icon: FileText },
  { path: '/os/brandaro/followups', label: 'Follow-Ups', icon: Bell },
  { path: '/os/brandaro/production', label: 'Production', icon: Hammer },
  { path: '/os/brandaro/build-pipeline', label: 'Build Pipeline', icon: Factory },
  { path: '/os/brandaro/results', label: 'Result Engine', icon: TrendingUp },
  { path: '/os/brandaro/review-queue', label: 'Quality Review', icon: ShieldCheck },
  { path: '/os/brandaro/clients', label: 'Client Portal', icon: Users },
  { path: '/os/brandaro/revenue', label: 'Revenue Analytics', icon: TrendingUp },
  { path: '/os/brandaro/performance', label: 'VA Performance', icon: BarChart3 },
  { path: '/os/brandaro/ads-engine', label: 'Ads Engine', icon: Megaphone },
  { path: '/os/brandaro/google-domination', label: 'Google Domination', icon: Crown },
  { path: '/os/brandaro/optimization', label: 'Optimization Engine', icon: Cpu },
  { path: '/os/brandaro/closer-ai', label: 'Closer AI', icon: Brain },
  { path: '/os/brandaro/system-status', label: 'System Status', icon: Activity },
  { path: '/os/brandaro/va-espanol', label: 'Panel VA Español', icon: Globe },
  { path: '/os/brandaro/manager-espanol', label: 'Gerente Español', icon: Users },
  { path: '/brandaro/phone-numbers', label: 'Phone Numbers', icon: Smartphone },
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
    { path: '/activation', component: BrandaroActivationCenter, label: 'Activation Center', icon: Zap, requiresAuth: true },
    { path: '/discovery', component: LeadDiscoveryPage, label: 'Lead Discovery', icon: Search, requiresAuth: true },
    { path: '/leads', component: LeadDatabasePage, label: 'Lead Database', icon: Database, requiresAuth: true },
    { path: '/qualification', component: LeadQualificationPage, label: 'Qualification', icon: Target, requiresAuth: true },
    { path: '/calling', component: CallingOpsPage, label: 'Calling Ops', icon: Phone, requiresAuth: true },
    { path: '/workspace', component: VAWorkspacePage, label: 'VA Workspace', icon: Headset, requiresAuth: true },
    { path: '/command-center', component: VACommandCenterPage, label: 'VA Command Center', icon: Brain, requiresAuth: true },
    { path: '/performance', component: VAPerformancePage, label: 'VA Performance', icon: BarChart3, requiresAuth: true },
    { path: '/campaigns', component: CampaignManagerPage, label: 'Campaigns', icon: FolderOpen, requiresAuth: true },
    { path: '/demos', component: DemoEnginePage, label: 'Demo Engine', icon: Wand2, requiresAuth: true },
    { path: '/proposals', component: ProposalBuilderPage, label: 'Proposals', icon: FileText, requiresAuth: true },
    { path: '/followups', component: FollowUpEnginePage, label: 'Follow-Ups', icon: Bell, requiresAuth: true },
    { path: '/production', component: ProductionPipelinePage, label: 'Production', icon: Hammer, requiresAuth: true },
    { path: '/build-pipeline', component: BuildPipelinePage, label: 'Build Pipeline', icon: Factory, requiresAuth: true },
    { path: '/results', component: ResultEnginePage, label: 'Result Engine', icon: TrendingUp, requiresAuth: true },
    { path: '/review-queue', component: ReviewQueuePage, label: 'Quality Review', icon: ShieldCheck, requiresAuth: true },
    { path: '/clients', component: ClientPortalPage, label: 'Client Portal', icon: Users, requiresAuth: true },
    { path: '/revenue', component: RevenueAnalyticsPage, label: 'Revenue Analytics', icon: TrendingUp, requiresAuth: true },
    { path: '/closer-ai', component: CloserAIPage, label: 'Closer AI', icon: Brain, requiresAuth: true },
    { path: '/system-status', component: SystemStatusPage, label: 'System Status', icon: Activity, requiresAuth: true },
    { path: '/va-espanol', component: SpanishVADashboard, label: 'Panel VA Español', icon: Globe, requiresAuth: true },
    { path: '/manager-espanol', component: SpanishManagerDashboard, label: 'Gerente Español', icon: Users, requiresAuth: true },
  ],
  Dashboard: BrandaroDashboard,
  sidebarItems,
};

export default BrandaroModule;
