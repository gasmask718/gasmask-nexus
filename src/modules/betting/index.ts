import { DynastyModule, SidebarItem } from '../types';
import { Trophy, Target, BarChart3, Shield, LayoutDashboard, Search, FileInput, Settings, Building2, ClipboardList, Activity, Calculator, Layers, Monitor, CheckCircle, Lock, ArrowRightLeft } from 'lucide-react';
import BettingDashboard from '@/pages/os/betting/BettingDashboard';
import StatsInspector from '@/pages/os/betting/StatsInspector';
import LineIntake from '@/pages/os/betting/LineIntake';
import BettingSettings from '@/pages/os/betting/BettingSettings';
import PlatformsDashboard from '@/pages/os/betting/PlatformsDashboard';
import LineShopping from '@/pages/os/betting/LineShopping';
import PickEntryWizard from '@/pages/os/betting/PickEntryWizard';
import EntriesList from '@/pages/os/betting/EntriesList';
import BettingWorkflow from '@/pages/os/betting/BettingWorkflow';
import BettingAnalytics from '@/pages/os/betting/BettingAnalytics';
import HedgeCenter from '@/pages/os/betting/HedgeCenter';
import ParlayLab from '@/pages/os/betting/ParlayLab';
import NBADailyBoard from '@/pages/os/betting/NBADailyBoard';
import ResultsPage from '@/pages/os/betting/ResultsPage';
import SimulationPage from '@/pages/os/betting/SimulationPage';
import OwnerInternal from '@/pages/os/betting/OwnerInternal';
import CrossPlatformLines from '@/pages/os/betting/CrossPlatformLines';

const sidebarItems: SidebarItem[] = [
  { path: '/os/sports-betting/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/os/sports-betting/workflow', label: 'Workflow', icon: Activity },
  { path: '/os/sports-betting/entries', label: 'Entries', icon: ClipboardList },
  { path: '/os/sports-betting/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/os/sports-betting/nba-board', label: 'NBA Board', icon: Monitor },
  { path: '/os/sports-betting/parlay-lab', label: 'Parlay Lab', icon: Layers },
  { path: '/os/sports-betting/hedge', label: 'Hedge Center', icon: Calculator },
  { path: '/os/sports-betting/simulation', label: 'Simulation', icon: Target },
  { path: '/os/sports-betting/results', label: 'Results', icon: CheckCircle },
  { path: '/os/sports-betting/platforms', label: 'Platforms', icon: Building2 },
  { path: '/os/sports-betting/line-intake', label: 'Line Intake', icon: FileInput },
  { path: '/os/sports-betting/line-shopping', label: 'Line Shopping', icon: Search },
  { path: '/os/sports-betting/settings', label: 'Settings', icon: Settings },
];

export const BettingModule: DynastyModule = {
  config: {
    id: 'betting',
    name: 'Sports Betting AI OS',
    description: 'AI predictions, analytics, hedge calculations',
    basePath: '/os/sports-betting',
    icon: Trophy,
    color: 'orange',
    permissions: ['admin', 'user', 'employee', 'manager'],
    isEnabled: true,
    order: 30,
  },
  routes: [
    { path: '', component: BettingDashboard, label: 'Dashboard', icon: LayoutDashboard, requiresAuth: true },
    { path: '/workflow', component: BettingWorkflow, label: 'Workflow', icon: Activity, requiresAuth: true },
    { path: '/entries', component: EntriesList, label: 'Entries', icon: ClipboardList, requiresAuth: true },
    { path: '/entries/new', component: PickEntryWizard, label: 'New Entry', icon: ClipboardList, requiresAuth: true },
    { path: '/analytics', component: BettingAnalytics, label: 'Analytics', icon: BarChart3, requiresAuth: true },
    { path: '/nba-board', component: NBADailyBoard, label: 'NBA Board', icon: Monitor, requiresAuth: true },
    { path: '/parlay-lab', component: ParlayLab, label: 'Parlay Lab', icon: Layers, requiresAuth: true },
    { path: '/hedge', component: HedgeCenter, label: 'Hedge Center', icon: Calculator, requiresAuth: true },
    { path: '/simulation', component: SimulationPage, label: 'Simulation', icon: Target, requiresAuth: true },
    { path: '/results', component: ResultsPage, label: 'Results', icon: CheckCircle, requiresAuth: true },
    { path: '/platforms', component: PlatformsDashboard, label: 'Platforms', icon: Building2, requiresAuth: true },
    { path: '/line-intake', component: LineIntake, label: 'Line Intake', icon: FileInput, requiresAuth: true },
    { path: '/line-shopping', component: LineShopping, label: 'Line Shopping', icon: Search, requiresAuth: true },
    { path: '/settings', component: BettingSettings, label: 'Settings', icon: Settings, requiresAuth: true },
    { path: '/stats-inspector', component: StatsInspector, label: 'Stats Inspector', icon: Search, requiresAuth: true },
    { path: '/owner-internal', component: OwnerInternal, label: 'Internal', icon: Lock, requiresAuth: true },
  ],
  Dashboard: BettingDashboard,
  sidebarItems,
};

export default BettingModule;
