/**
 * AppRoutes - Clean nested route structure for Dynasty OS
 * Uses React Router nested routes with Layout wrapper
 */
import { Routes, Route, Outlet } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import { RequireRole } from '@/components/security/RequireRole';
import Layout from '@/components/Layout';

// Public pages
import Auth from '@/pages/Auth';
import Shop from '@/pages/Shop';
import Cart from '@/pages/Cart';
import Checkout from '@/pages/Checkout';
import NotFound from '@/pages/NotFound';
import PortalLogin from '@/pages/portal/PortalLogin';
import PortalRegister from '@/pages/portal/PortalRegister';

// Protected page imports
import Dashboard from '@/pages/Dashboard';
import Stores from '@/pages/Stores';
import StoreDetail from '@/pages/StoreDetail';
import RoutesPage from '@/pages/Routes';
import RouteDetail from '@/pages/RouteDetail';
import MapPage from '@/pages/Map';
import BatchImport from '@/pages/BatchImport';
import Driver from '@/pages/Driver';
import Wholesale from '@/pages/Wholesale';
import WholesaleMarketplace from '@/pages/WholesaleMarketplace';
import Team from '@/pages/Team';
import Products from '@/pages/Products';
import Analytics from '@/pages/Analytics';
import Influencers from '@/pages/Influencers';
import Missions from '@/pages/Missions';
import InfluencerCampaigns from '@/pages/InfluencerCampaigns';
import ExecutiveReports from '@/pages/ExecutiveReports';
import Territories from '@/pages/Territories';
import RevenueBrain from '@/pages/RevenueBrain';
import OpportunityRadar from '@/pages/OpportunityRadar';
import MissionsHQ from '@/pages/MissionsHQ';
import Communications from '@/pages/Communications';
import Templates from '@/pages/Templates';
import Reminders from '@/pages/Reminders';
import InfluencerDetail from '@/pages/InfluencerDetail';
import WholesalerDetail from '@/pages/WholesalerDetail';
import WorkerHome from '@/pages/WorkerHome';
import AutomationSettings from '@/pages/AutomationSettings';
import Training from '@/pages/Training';
import Ambassadors from '@/pages/Ambassadors';
import Expansion from '@/pages/Expansion';
import Rewards from '@/pages/Rewards';
import LiveMap from '@/pages/LiveMap';
import WalletPage from '@/pages/Wallet';
import Subscriptions from '@/pages/Subscriptions';
import DeliveryCapacity from '@/pages/DeliveryCapacity';
import CommunicationAutomation from '@/pages/CommunicationAutomation';
import CommunicationsAI from '@/pages/CommunicationsAI';
import MessagesPage from '@/pages/Messages';
import CommunicationInsights from '@/pages/CommunicationInsights';
import RouteOptimizer from '@/pages/RouteOptimizer';
import RouteOpsCenter from '@/pages/RouteOpsCenter';
import MyRoute from '@/pages/MyRoute';
import SidebarVisualTest from '@/pages/SidebarVisualTest';
import SidebarDebug from '@/pages/debug/SidebarDebug';
import Leaderboard from '@/pages/Leaderboard';
import Payroll from '@/pages/Payroll';
import MetaAI from '@/pages/MetaAI';
import ExpansionRegions from '@/pages/ExpansionRegions';
import ExpansionHeatmap from '@/pages/ExpansionHeatmap';
import AmbassadorRegions from '@/pages/AmbassadorRegions';
import Sales from '@/pages/Sales';
import SalesProspects from '@/pages/SalesProspects';
import SalesProspectNew from '@/pages/SalesProspectNew';
import SalesProspectDetail from '@/pages/SalesProspectDetail';
import SalesReport from '@/pages/SalesReport';
import StorePerformance from '@/pages/StorePerformance';
import StoreOrder from '@/pages/StoreOrder';
import WholesaleFulfillment from '@/pages/WholesaleFulfillment';
import Billing from '@/pages/Billing';
import EconomicAnalytics from '@/pages/EconomicAnalytics';
import AmbassadorPayouts from '@/pages/AmbassadorPayouts';
import BikerPayouts from '@/pages/BikerPayouts';
import CRM from '@/pages/CRM';
import CRMContacts from '@/pages/CRMContacts';
import CRMContactDetail from '@/pages/CRMContactDetail';
import CRMCustomers from '@/pages/CRMCustomers';
import ContactProfile from '@/pages/crm/ContactProfile';
import GlobalCRM from '@/pages/crm/GlobalCRM';
import DynamicCRMPage from '@/pages/crm/DynamicCRMPage';
import AddBusinessPage from '@/pages/crm/AddBusinessPage';
import CRMBrandPage from '@/pages/crm/BrandCRM';
import CRMBrandStoreProfile from '@/pages/crm/BrandStoreProfile';
import CRMCustomerNew from '@/pages/CRMCustomerNew';
import CRMCustomerDetail from '@/pages/CRMCustomerDetail';
import CRMCustomerImport from '@/pages/CRMCustomerImport';
import CRMData from '@/pages/CRMData';
import CRMDataExport from '@/pages/CRMDataExport';
import CRMDataImport from '@/pages/CRMDataImport';
import CRMBackupSettings from '@/pages/CRMBackupSettings';
import CRMFollowUps from '@/pages/CRMFollowUps';
import Companies from '@/pages/Companies';
import CompanyProfile from '@/pages/CompanyProfile';
import UnpaidAccounts from '@/pages/UnpaidAccounts';
import DriverDebtCollection from '@/pages/DriverDebtCollection';
import BrandDashboard from '@/pages/BrandDashboard';
import { OwnerDashboard, OwnerAIAdvisorPage, OwnerClusterDashboard, OwnerAutopilotConsole, OwnerAICommandConsole, OwnerRiskRadar, OwnerDailyBriefing, OwnerHoldingsOverview, OwnerClusterDetailPage, OwnerAutomationDetailPage, OwnerRiskDetailPage, OwnerBusinessDetailPage, OwnerPropertyDetailPage, OwnerFinancialHoldingDetailPage, OwnerAlertDetailPage, OwnerAutoTradingDetailPage, OwnerCryptoDetailPage, OwnerSportsDetailPage, OwnerVoiceAI, OwnerReports, OwnerVARouting, OwnerAlertCenter, OwnerExecutiveReports, OwnerBroadcastCenter } from '@/pages/owner';

// Call Center
import CallCenterDashboard from '@/pages/callcenter/CallCenterDashboard';
import PhoneNumbers from '@/pages/callcenter/PhoneNumbers';
import CallLogs from '@/pages/callcenter/CallLogs';
import AIAgents from '@/pages/callcenter/AIAgents';
import LiveMonitoring from '@/pages/callcenter/LiveMonitoring';
import CallCenterSettings from '@/pages/callcenter/CallCenterSettings';
import CallCenterDialer from '@/pages/callcenter/CallCenterDialer';
import CallCenterAnalytics from '@/pages/callcenter/CallCenterAnalytics';
import Messages from '@/pages/callcenter/Messages';
import Emails from '@/pages/callcenter/Emails';

// Communication Center - Modular V2-V8 Pages
import CommunicationHubLayout from '@/pages/communication/CommunicationHubLayout';
import InboxPage from '@/pages/communication/inbox/InboxPage';
import DialerPage from '@/pages/communication/dialer/DialerPage';
import LiveCallsPage from '@/pages/communication/live/LiveCallsPage';
import EscalationsPage from '@/pages/communication/escalations/EscalationsPage';
import EngagementPage from '@/pages/communication/engagement/EngagementPage';
import RoutingPage from '@/pages/communication/routing/RoutingPage';
import OutreachPage from '@/pages/communication/outreach/OutreachPage';
import CampaignsPage from '@/pages/communication/campaigns/CampaignsPage';
import PersonasPage from '@/pages/communication/personas/PersonasPage';
import CallFlowsPage from '@/pages/communication/callflows/CallFlowsPage';
import HeatmapPage from '@/pages/communication/heatmap/HeatmapPage';
import CallReasonsPage from '@/pages/communication/callreasons/CallReasonsPage';
import PredictionsPage from '@/pages/communication/predictions/PredictionsPage';
import AgentsPage from '@/pages/communication/agents/AgentsPage';
import LanguagePage from '@/pages/communication/language/LanguagePage';
import VoiceMatrixPage from '@/pages/communication/voicematrix/VoiceMatrixPage';
import CommSettingsPage from '@/pages/communication/settings/SettingsPage';
import PhoneNumbersSettingsPage from '@/pages/communication/settings/PhoneNumbersPage';
import ManualCallPage from '@/pages/communication/manual/ManualCallPage';
import ManualTextPage from '@/pages/communication/manual/ManualTextPage';
import AIAutoDialerPage from '@/pages/communication/ai/AIAutoDialerPage';
import AIAutoTextPage from '@/pages/communication/ai/AIAutoTextPage';
import OutboundEnginePage from '@/pages/communication/ai/OutboundEnginePage';
import AutonomousDirectorPage from '@/pages/communication/ai/AutonomousDirectorPage';
import VoiceLibraryPage from '@/pages/communication/voice/VoiceLibraryPage';
import DealsSalesPage from '@/pages/communication/deals/DealsSalesPage';
import FollowUpManagerPage from '@/pages/communication/followups/FollowUpManagerPage';
import UnifiedInboxV3Page from '@/pages/communication/inbox/UnifiedInboxV3Page';
// Legacy Communication imports (kept for other routes)
import CommunicationOverview from '@/pages/communication/CommunicationOverview';
import CommunicationCampaigns from '@/pages/communication/CommunicationCampaigns';
import CommunicationCampaignNew from '@/pages/communication/CommunicationCampaignNew';
import CommunicationCampaignDetail from '@/pages/communication/CommunicationCampaignDetail';
import CommunicationCalls from '@/pages/communication/CommunicationCalls';
import CommunicationSMS from '@/pages/communication/CommunicationSMS';
import CommunicationEmail from '@/pages/communication/CommunicationEmail';
import CommunicationAIAgents from '@/pages/communication/CommunicationAIAgents';
import CommunicationNumbers from '@/pages/communication/CommunicationNumbers';
import CommunicationLogs from '@/pages/communication/CommunicationLogs';
import CommunicationAnalytics from '@/pages/communication/CommunicationAnalytics';
import CommunicationSettings from '@/pages/communication/CommunicationSettings';
import CommunicationsCenterOverview from '@/pages/CommunicationsCenterOverview';
import CommunicationsCenterLogs from '@/pages/CommunicationsCenterLogs';
import CallCenter from '@/pages/CallCenter';
import TextCenter from '@/pages/TextCenter';
import EmailCenter from '@/pages/EmailCenter';

// Communication Systems - New Unified Module
import CommSystemsDialerPage from '@/pages/comm-systems/dialer/DialerPage';
import CommSystemsCallLogsPage from '@/pages/comm-systems/call-logs/CallLogsPage';
import CommSystemsAIAgentsPage from '@/pages/comm-systems/ai-agents/AIAgentsPage';
import CommSystemsAnalyticsPage from '@/pages/comm-systems/analytics/CallAnalyticsPage';
import CommSystemsMessagesPage from '@/pages/comm-systems/messages/MessagesPage';
import CommSystemsEmailsPage from '@/pages/comm-systems/emails/EmailsPage';
import CommSystemsCommAIPage from '@/pages/comm-systems/hub/CommAIPage';
import CommSystemsAutomationPage from '@/pages/comm-systems/hub/CommAutomationPage';
import CommSystemsInsightsPage from '@/pages/comm-systems/hub/CommInsightsPage';

import BillingCenter from '@/pages/BillingCenter';
import BillingInvoices from '@/pages/BillingInvoices';
import BillingInvoiceNew from '@/pages/BillingInvoiceNew';
import BillingInvoiceDetail from '@/pages/BillingInvoiceDetail';

// Portal
import RoleRouter from '@/components/portal/RoleRouter';
import PortalDashboard from '@/pages/portal/PortalDashboard';
import PortalInvoices from '@/pages/portal/PortalInvoices';
import PortalHome from '@/pages/portal/PortalHome';
import PortalOnboarding from '@/pages/portal/PortalOnboarding';
import DriverPortal from '@/pages/portal/DriverPortal';
import BikerPortal from '@/pages/portal/BikerPortal';
import AmbassadorPortal from '@/pages/portal/AmbassadorPortal';
import PortalInvoiceDetail from '@/pages/portal/PortalInvoiceDetail';
import PortalWholesale from '@/pages/portal/PortalWholesale';
import PortalInfluencer from '@/pages/portal/PortalInfluencer';
import { WholesalerDashboard, WholesalerProducts, WholesalerProductForm, WholesalerOrders, WholesalerFinance, WholesalerSettings, WholesalerMessages } from '@/pages/portal/wholesaler';
import { StoreDashboard, StoreProducts, StoreCart, StoreCheckout, StoreOrders, StoreOrderDetail, StoreInvoices, StoreSettings, StoreMessages } from '@/pages/portal/store';
import StoreTeam from '@/pages/portal/store/StoreTeam';
import WholesalerTeam from '@/pages/portal/wholesaler/WholesalerTeam';
import JoinOrg from '@/pages/portal/JoinOrg';
import ProductionPortal from '@/pages/portal/ProductionPortal';
import VAPortal from '@/pages/portal/VAPortal';
import CustomerPortal from '@/pages/portal/CustomerPortal';
import NationalWholesale from '@/pages/portal/NationalWholesale';
import MarketplaceAdmin from '@/pages/portal/MarketplaceAdmin';

// HR
import HR from '@/pages/HR';
import HRApplicants from '@/pages/HRApplicants';
import HRApplicantDetail from '@/pages/HRApplicantDetail';
import HREmployees from '@/pages/HREmployees';
import HREmployeeDetail from '@/pages/HREmployeeDetail';
import HRInterviews from '@/pages/HRInterviews';
import HRDocuments from '@/pages/HRDocuments';
import HROnboarding from '@/pages/HROnboarding';
import HRPayroll from '@/pages/HRPayroll';
import MyHR from '@/pages/MyHR';

// Real Estate
import RealEstate from '@/pages/RealEstate';
import RealEstateLeads from '@/pages/RealEstateLeads';
import RealEstatePipeline from '@/pages/RealEstatePipeline';
import RealEstateInvestors from '@/pages/RealEstateInvestors';
import RealEstateClosings from '@/pages/RealEstateClosings';
import RealEstateExpansion from '@/pages/RealEstateExpansion';
import RealEstateSubscriptions from '@/pages/RealEstateSubscriptions';
import RealEstatePartners from '@/pages/RealEstatePartners';
import RealEstatePL from '@/pages/RealEstatePL';
import RealEstateLayout from '@/pages/realestate/RealEstateLayout';
import LoanProducts from '@/pages/LoanProducts';
import LenderDirectory from '@/pages/LenderDirectory';
import LoanCalculators from '@/pages/LoanCalculators';
import FundingRequests from '@/pages/FundingRequests';
import VAPerformance from '@/pages/VAPerformance';
import VARanking from '@/pages/VARanking';
import VATaskCenter from '@/pages/VATaskCenter';
import DealSheetsGenerator from '@/pages/DealSheetsGenerator';
import InvestorBlastSystem from '@/pages/InvestorBlastSystem';
import OfferAnalyzer from '@/pages/OfferAnalyzer';
import AssignmentFeeOptimizer from '@/pages/AssignmentFeeOptimizer';

// Holdings
import HoldingsOverview from '@/pages/HoldingsOverview';
import HoldingsAssets from '@/pages/HoldingsAssets';
import HoldingsAirbnb from '@/pages/HoldingsAirbnb';
import HoldingsTenants from '@/pages/HoldingsTenants';
import HoldingsLoans from '@/pages/HoldingsLoans';
import HoldingsExpenses from '@/pages/HoldingsExpenses';
import HoldingsStrategy from '@/pages/HoldingsStrategy';

// POD
import PODOverview from '@/pages/pod/index';
import PODDesigns from '@/pages/pod/designs';
import PODGenerate from '@/pages/pod/generator';
import PODMockups from '@/pages/pod/mockups';
import PODUpload from '@/pages/pod/uploads';
import PODVideos from '@/pages/pod/videos';
import PODScheduler from '@/pages/pod/scheduler';
import PODAnalytics from '@/pages/pod/analytics';
import PODScaling from '@/pages/pod/winners';
import PODVAControl from '@/pages/pod/va';
import PODSettings from '@/pages/pod/settings';
import PodLayout from '@/pages/pod/PodLayout';

// OS Modules
import { ProcurementDashboard, SuppliersPage as ProcurementSuppliersPage, SupplierDetailPage as ProcurementSupplierDetailPage, PurchaseOrdersPage as ProcurementPurchaseOrdersPage, NewPurchaseOrderPage as ProcurementNewPurchaseOrderPage, PurchaseOrderDetailPage as ProcurementPurchaseOrderDetailPage } from '@/pages/os/procurement';
import { WarehouseDashboard } from '@/pages/os/warehouse';
import { InventoryDashboard, ProductsPage, ProductDetailPage, WarehousesPage, WarehouseDetailPage, SuppliersPage as InventorySuppliersPage, SupplierDetailPage as InventorySupplierDetailPage, PurchaseOrdersPage as InventoryPurchaseOrdersPage, NewPurchaseOrderPage as InventoryNewPurchaseOrderPage, PurchaseOrderDetailPage, StockLevelsPage, MovementsPage, ProcurementPage, InsightsPage, NeighborhoodIntelligencePage } from '@/pages/os/inventory';
import StoreInventoryPage from '@/pages/os/inventory/StoreInventoryPage';
import InventoryAuditLogPage from '@/pages/os/inventory/InventoryAuditLogPage';
import { LiveTubesDetailPage, BoxesSoldDetailPage, LowStockDetailPage } from '@/pages/os/inventory/dashboard';
import TopTierDashboard from '@/pages/os/toptier/TopTierDashboard';
import UnforgettableDashboard from '@/pages/os/unforgettable/UnforgettableDashboard';
import ICleanDashboard from '@/pages/os/iclean/ICleanDashboard';
import PlayboxxxDashboard from '@/pages/os/playboxxx/PlayboxxxDashboard';
import SpecialNeedsDashboard from '@/pages/os/specialneeds/SpecialNeedsDashboard';
import FundingDashboard from '@/pages/os/funding/FundingDashboard';
import GrantsDashboard from '@/pages/os/grants/GrantsDashboard';
import WealthEngineDashboard from '@/pages/os/wealth/WealthEngineDashboard';
import BettingDashboard from '@/pages/os/betting/BettingDashboard';
import BikerDashboard from '@/pages/os/biker/BikerDashboard';
import ModuleDiagnosticsPage from '@/pages/ModuleDiagnosticsPage';

// Delivery & Logistics
import { 
  DeliveryDashboard, 
  DeliveriesBoard, 
  DriversManagement, 
  BikersManagement, 
  BikerTasks, 
  LocationsManagement, 
  WorkerPayouts, 
  DebtCollection, 
  DriverHome,
  DeliveryMyRoute 
} from '@/pages/delivery';

// Grabba
import { GrabbaLayout } from '@/components/grabba/GrabbaLayout';
import GrabbaClusterDashboard from '@/pages/grabba/GrabbaClusterDashboard';
import UnifiedUploadCenter from '@/pages/grabba/UnifiedUploadCenter';
import MultiBrandDelivery from '@/pages/grabba/MultiBrandDelivery';
import StoreMasterProfile from '@/pages/grabba/StoreMasterProfile';
import BrandCRM from '@/pages/grabba/BrandCRM';
import BrandSelector from '@/pages/grabba/BrandSelector';
import BrandCommunications from '@/pages/grabba/BrandCommunications';
import AIInsights from '@/pages/grabba/AIInsights';
import GrabbaCRM from '@/pages/grabba/GrabbaCRM';
import GrabbaCommunication from '@/pages/grabba/GrabbaCommunication';
import GrabbaInventory from '@/pages/grabba/GrabbaInventory';
import GrabbaProduction from '@/pages/grabba/GrabbaProduction';
import GrabbaDeliveries from '@/pages/grabba/GrabbaDeliveries';
import GrabbaAmbassadors from '@/pages/grabba/GrabbaAmbassadors';
import GrabbaWholesalePlatform from '@/pages/grabba/GrabbaWholesalePlatform';
import GrabbaFinance from '@/pages/grabba/GrabbaFinance';
import GrabbaCommandPenthouse from '@/pages/grabba/GrabbaCommandPenthouse';
import GrabbaTextCenter from '@/pages/grabba/GrabbaTextCenter';
import GrabbaEmailCenter from '@/pages/grabba/GrabbaEmailCenter';
import GrabbaCallCenter from '@/pages/grabba/GrabbaCallCenter';
import GrabbaCommunicationLogs from '@/pages/grabba/GrabbaCommunicationLogs';
import GrabbaAutopilotConsole from '@/pages/grabba/GrabbaAutopilotConsole';
import GrabbaAutopilotDashboard from '@/pages/grabba/GrabbaAutopilotDashboard';
import GrabbaCommandConsole from '@/pages/grabba/GrabbaCommandConsole';
import GrabbaAICommandConsole from '@/pages/grabba/GrabbaAICommandConsole';
import ResultsPage from '@/pages/grabba/ResultsPage';
import ActionQueuePage from '@/pages/grabba/ActionQueuePage';
import GrabbaRoutesPage from '@/pages/grabba/RoutesPage';
import DrillDownPage from '@/pages/grabba/drilldown/DrillDownPage';
import AiCommandConsole from '@/pages/grabba/AiCommandConsole';
import AiPlaybooks from '@/pages/grabba/AiPlaybooks';
import AiRoutines from '@/pages/grabba/AiRoutines';
import RiskRadar from '@/pages/grabba/RiskRadar';
import FollowUpSettings from '@/pages/grabba/FollowUpSettings';
import DailyBriefing from '@/pages/grabba/DailyBriefing';
import AIOperationsDashboard from '@/pages/grabba/ai-operations/AIOperationsDashboard';
import AITasks from '@/pages/grabba/ai-operations/AITasks';
import AIPredictions from '@/pages/grabba/ai-operations/AIPredictions';
import AIAlerts from '@/pages/grabba/ai-operations/AIAlerts';
import FinancialDashboard from '@/pages/grabba/FinancialDashboard';
import PersonalFinance from '@/pages/grabba/PersonalFinance';
import PayrollManager from '@/pages/grabba/PayrollManager';
import AdvisorPenthouse from '@/pages/grabba/AdvisorPenthouse';
import InstinctLog from '@/pages/grabba/InstinctLog';
import GrabbaNeighborhoodPerformance from '@/pages/grabba/GrabbaNeighborhoodPerformance';
import GrabbaClusterCommunications from '@/pages/grabba/GrabbaClusterCommunications';
import GrabbaClusterAnalytics from '@/pages/grabba/GrabbaClusterAnalytics';
import MemoryBackfill from '@/pages/grabba/MemoryBackfill';

// AI
import AIWorkforce from '@/pages/ai/Workforce';

// System
import DynastyAutomations from '@/pages/DynastyAutomations';
import AICEOControlRoom from '@/pages/AICEOControlRoom';
import BrandPlaceholder from '@/pages/BrandPlaceholder';

/**
 * ProtectedLayout - Wraps all protected routes with auth and layout
 */
const ProtectedLayout = () => (
  <ProtectedRoute>
    <Layout>
      <Outlet />
    </Layout>
  </ProtectedRoute>
);

/**
 * ProtectedNoLayout - Protected routes without main layout (portal pages)
 */
const ProtectedNoLayout = () => (
  <ProtectedRoute>
    <Outlet />
  </ProtectedRoute>
);

export default function AppRoutes() {
  return (
    <Routes>
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* PUBLIC ROUTES (No authentication required)                                   */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      <Route path="/auth" element={<Auth />} />
      <Route path="/shop" element={<Shop />} />
      <Route path="/cart" element={<Cart />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/portal/login" element={<PortalLogin />} />
      <Route path="/portal/register" element={<PortalRegister />} />

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* PROTECTED ROUTES (Authentication required)                                   */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      <Route element={<ProtectedLayout />}>
        {/* Dashboard */}
        <Route path="/" element={<Dashboard />} />
        <Route path="/sidebar-test" element={<SidebarVisualTest />} />
        <Route path="/sidebar-debug" element={<SidebarDebug />} />

        {/* GasMask Brand Routes */}
        <Route path="/gasmask" element={<Dashboard />} />
        <Route path="/gasmask/driver" element={<Driver />} />
        <Route path="/gasmask/team" element={<Team />} />
        <Route path="/gasmask/training" element={<Training />} />
        <Route path="/gasmask/missions" element={<Missions />} />
        <Route path="/gasmask/leaderboard" element={<Leaderboard />} />
        <Route path="/gasmask/rewards" element={<Rewards />} />
        <Route path="/gasmask/territories" element={<Territories />} />
        <Route path="/gasmask/expansion" element={<Expansion />} />
        <Route path="/gasmask/expansion/regions" element={<ExpansionRegions />} />
        <Route path="/gasmask/expansion/heatmap" element={<ExpansionHeatmap />} />
        <Route path="/gasmask/templates" element={<Templates />} />
        <Route path="/gasmask/reminders" element={<Reminders />} />
        <Route path="/gasmask/sales" element={<Sales />} />
        <Route path="/gasmask/sales/prospects" element={<SalesProspects />} />
        <Route path="/gasmask/sales/prospects/new" element={<SalesProspectNew />} />
        <Route path="/gasmask/sales/prospects/:id" element={<SalesProspectDetail />} />
        <Route path="/gasmask/sales/report" element={<SalesReport />} />
        <Route path="/gasmask/billing" element={<Billing />} />
        <Route path="/gasmask/billing-center" element={<BillingCenter />} />
        <Route path="/gasmask/billing/invoices" element={<BillingInvoices />} />
        <Route path="/gasmask/billing/invoices/new" element={<BillingInvoiceNew />} />
        <Route path="/gasmask/payroll" element={<Payroll />} />
        <Route path="/gasmask/biker-payouts" element={<BikerPayouts />} />
        <Route path="/gasmask/delivery-capacity" element={<DeliveryCapacity />} />
        <Route path="/gasmask/subscriptions" element={<Subscriptions />} />
        <Route path="/gasmask/wallet" element={<WalletPage />} />
        <Route path="/gasmask/analytics" element={<Analytics />} />
        <Route path="/gasmask/routes" element={<RoutesPage />} />
        <Route path="/gasmask/routes/optimizer" element={<RouteOptimizer />} />
        <Route path="/gasmask/routes/ops-center" element={<RouteOpsCenter />} />
        <Route path="/gasmask/routes/:id" element={<RouteDetail />} />
        <Route path="/gasmask/stores" element={<Stores />} />
        <Route path="/gasmask/stores/:id" element={<StoreDetail />} />
        <Route path="/gasmask/stores/:id/order" element={<StoreOrder />} />
        <Route path="/gasmask/store-performance" element={<StorePerformance />} />
        <Route path="/gasmask/products" element={<Products />} />
        <Route path="/gasmask/inventory" element={<Products />} />
        <Route path="/gasmask/map" element={<MapPage />} />
        <Route path="/gasmask/live-map" element={<LiveMap />} />
        <Route path="/gasmask/ambassadors" element={<Ambassadors />} />
        <Route path="/gasmask/ambassador-payouts" element={<AmbassadorPayouts />} />
        <Route path="/gasmask/ambassador-regions" element={<AmbassadorRegions />} />
        <Route path="/gasmask/wholesale" element={<Wholesale />} />
        <Route path="/gasmask/wholesale/marketplace" element={<WholesaleMarketplace />} />
        <Route path="/gasmask/wholesale/fulfillment" element={<WholesaleFulfillment />} />
        <Route path="/gasmask/wholesale/:id" element={<WholesalerDetail />} />
        <Route path="/gasmask/communications" element={<Communications />} />
        <Route path="/gasmask/settings" element={<BrandPlaceholder />} />

        {/* HotMama Routes */}
        <Route path="/hotmama/*" element={<BrandPlaceholder />} />

        {/* Finance & Real Estate */}
        <Route path="/finance" element={<FundingDashboard />} />
        <Route path="/finance/funding" element={<FundingDashboard />} />
        <Route path="/finance/funding-requests" element={<FundingRequests />} />
        <Route path="/finance/grants" element={<GrantsDashboard />} />
        <Route path="/finance/credit-repair" element={<FundingDashboard />} />
        <Route path="/finance/chexsystems" element={<FundingDashboard />} />
        <Route path="/finance/investment" element={<WealthEngineDashboard />} />
        <Route path="/finance/trading" element={<WealthEngineDashboard />} />
        <Route path="/finance/economic-analytics" element={<EconomicAnalytics />} />
        <Route path="/finance/revenue-brain" element={<RevenueBrain />} />
        <Route path="/finance/opportunity-radar" element={<OpportunityRadar />} />
        <Route path="/finance/*" element={<BrandPlaceholder />} />
        <Route path="/loan-products" element={<LoanProducts />} />
        <Route path="/lender-directory" element={<LenderDirectory />} />
        <Route path="/loan-calculators" element={<LoanCalculators />} />
        <Route path="/deal-sheets-generator" element={<DealSheetsGenerator />} />
        <Route path="/investor-blast-system" element={<InvestorBlastSystem />} />
        <Route path="/offer-analyzer" element={<OfferAnalyzer />} />
        <Route path="/assignment-fee-optimizer" element={<AssignmentFeeOptimizer />} />

        {/* Holdings */}
        <Route path="/holdings" element={<HoldingsOverview />} />
        <Route path="/holdings/overview" element={<HoldingsOverview />} />
        <Route path="/holdings/assets" element={<HoldingsAssets />} />
        <Route path="/holdings/airbnb" element={<HoldingsAirbnb />} />
        <Route path="/holdings/tenants" element={<HoldingsTenants />} />
        <Route path="/holdings/loans" element={<HoldingsLoans />} />
        <Route path="/holdings/expenses" element={<HoldingsExpenses />} />
        <Route path="/holdings/strategy" element={<HoldingsStrategy />} />

        {/* Systems & Engine Room */}
        <Route path="/systems" element={<BrandPlaceholder />} />
        <Route path="/systems/*" element={<BrandPlaceholder />} />
        <Route path="/system-operations/ai-ceo-control-room" element={<AICEOControlRoom />} />
        <Route path="/meta-ai" element={<MetaAI />} />
        <Route path="/executive-reports" element={<ExecutiveReports />} />
        <Route path="/missions-hq" element={<MissionsHQ />} />
        <Route path="/communication-automation" element={<CommunicationAutomation />} />
        <Route path="/communications-ai" element={<CommunicationsAI />} />
        <Route path="/communication-insights" element={<CommunicationInsights />} />
        <Route path="/dynasty-automations" element={<DynastyAutomations />} />

        {/* Communications Center - All redirect to unified V8 Communication Hub */}
        <Route path="/communications-center" element={<CommunicationHubLayout />} />
        <Route path="/communications-center/*" element={<CommunicationHubLayout />} />

        {/* Call Center */}
        <Route path="/call-center" element={<CallCenterDashboard />} />
        <Route path="/call-center/dashboard" element={<CallCenterDashboard />} />
        <Route path="/call-center/dialer" element={<CallCenterDialer />} />
        <Route path="/call-center/logs" element={<CallLogs />} />
        <Route path="/call-center/analytics" element={<CallCenterAnalytics />} />
        <Route path="/call-center/ai-agents" element={<AIAgents />} />
        <Route path="/call-center/phone-numbers" element={<PhoneNumbers />} />
        <Route path="/call-center/numbers" element={<PhoneNumbers />} />
        <Route path="/call-center/monitoring" element={<LiveMonitoring />} />
        <Route path="/call-center/live-monitoring" element={<LiveMonitoring />} />
        <Route path="/call-center/messages" element={<Messages />} />
        <Route path="/call-center/emails" element={<Emails />} />
        <Route path="/call-center/settings" element={<CallCenterSettings />} />
        <Route path="/text-center" element={<TextCenter />} />
        <Route path="/email-center" element={<EmailCenter />} />

        {/* Legacy callcenter routes */}
        <Route path="/callcenter" element={<CallCenterDashboard />} />
        <Route path="/callcenter/dashboard" element={<CallCenterDashboard />} />
        <Route path="/callcenter/numbers" element={<PhoneNumbers />} />
        <Route path="/callcenter/logs" element={<CallLogs />} />
        <Route path="/callcenter/ai" element={<AIAgents />} />
        <Route path="/callcenter/ai-agents" element={<AIAgents />} />
        <Route path="/callcenter/live-monitoring" element={<LiveMonitoring />} />
        <Route path="/callcenter/messages" element={<Messages />} />
        <Route path="/callcenter/emails" element={<Emails />} />
        <Route path="/callcenter/settings" element={<CallCenterSettings />} />

        {/* 📡 Communication Systems - New Unified Module */}
        <Route path="/comm-systems" element={<CommSystemsDialerPage />} />
        <Route path="/comm-systems/dialer" element={<CommSystemsDialerPage />} />
        <Route path="/comm-systems/call-logs" element={<CommSystemsCallLogsPage />} />
        <Route path="/comm-systems/ai-agents" element={<CommSystemsAIAgentsPage />} />
        <Route path="/comm-systems/call-analytics" element={<CommSystemsAnalyticsPage />} />
        <Route path="/comm-systems/messages" element={<CommSystemsMessagesPage />} />
        <Route path="/comm-systems/emails" element={<CommSystemsEmailsPage />} />
        <Route path="/comm-systems/comm-ai" element={<CommSystemsCommAIPage />} />
        <Route path="/comm-systems/automation" element={<CommSystemsAutomationPage />} />
        <Route path="/comm-systems/insights" element={<CommSystemsInsightsPage />} />

        <Route path="/va-performance" element={<VAPerformance />} />
        <Route path="/va-ranking" element={<VARanking />} />
        <Route path="/va-task-center" element={<VATaskCenter />} />
        <Route path="/batch-import" element={<BatchImport />} />
        <Route path="/hr" element={<HR />} />
        <Route path="/hr/applicants" element={<HRApplicants />} />
        <Route path="/hr/applicants/:id" element={<HRApplicantDetail />} />
        <Route path="/hr/employees" element={<HREmployees />} />
        <Route path="/hr/employees/:id" element={<HREmployeeDetail />} />
        <Route path="/hr/interviews" element={<HRInterviews />} />
        <Route path="/hr/documents" element={<HRDocuments />} />
        <Route path="/hr/onboarding" element={<HROnboarding />} />
        <Route path="/hr/payroll" element={<HRPayroll />} />
        <Route path="/my-hr" element={<MyHR />} />
        <Route path="/me/hr" element={<MyHR />} />

        {/* Legacy Routes */}
        <Route path="/stores" element={<Stores />} />
        <Route path="/stores/:id" element={<StoreDetail />} />
        <Route path="/stores/performance" element={<StorePerformance />} />
        <Route path="/stores/order" element={<StoreOrder />} />
        <Route path="/routes" element={<RoutesPage />} />
        <Route path="/routes/optimizer" element={<RouteOptimizer />} />
        <Route path="/routes/ops-center" element={<RouteOpsCenter />} />
        <Route path="/route-ops-center" element={<RouteOpsCenter />} />
        <Route path="/routes/:id" element={<RouteDetail />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/wholesale" element={<Wholesale />} />
        <Route path="/wholesale/marketplace" element={<WholesaleMarketplace />} />
        <Route path="/wholesale/fulfillment" element={<WholesaleFulfillment />} />
        <Route path="/wholesale/:id" element={<WholesalerDetail />} />
        <Route path="/team" element={<Team />} />
        <Route path="/products" element={<Products />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/analytics/economics" element={<EconomicAnalytics />} />
        <Route path="/analytics/revenue-brain" element={<RevenueBrain />} />
        <Route path="/influencers" element={<Influencers />} />
        <Route path="/influencers/:id" element={<InfluencerDetail />} />
        <Route path="/influencers/campaigns" element={<InfluencerCampaigns />} />
        <Route path="/missions" element={<Missions />} />
        <Route path="/communications" element={<Communications />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/communications/reminders" element={<Reminders />} />
        <Route path="/communications/ai-insights" element={<CommunicationsAI />} />
        <Route path="/communications/insights" element={<CommunicationInsights />} />
        <Route path="/settings/automation" element={<AutomationSettings />} />
        <Route path="/settings/automation/communications" element={<CommunicationAutomation />} />
        <Route path="/training" element={<Training />} />
        <Route path="/ambassadors" element={<Ambassadors />} />
        <Route path="/ambassadors/regions" element={<AmbassadorRegions />} />
        <Route path="/expansion" element={<Expansion />} />
        <Route path="/expansion/regions" element={<ExpansionRegions />} />
        <Route path="/expansion/heatmap" element={<ExpansionHeatmap />} />
        <Route path="/rewards" element={<Rewards />} />
        <Route path="/driver" element={<Driver />} />
        <Route path="/drivers/leaderboard" element={<Leaderboard />} />
        <Route path="/drivers/payroll" element={<Payroll />} />
        <Route path="/ai/meta" element={<MetaAI />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/sales/prospects" element={<SalesProspects />} />
        <Route path="/sales/prospects/new" element={<SalesProspectNew />} />
        <Route path="/sales/prospects/:id" element={<SalesProspectDetail />} />
        <Route path="/sales/report" element={<SalesReport />} />
        <Route path="/ops/opportunity-radar" element={<OpportunityRadar />} />
        <Route path="/payouts/ambassadors" element={<AmbassadorPayouts />} />
        <Route path="/payouts/bikers" element={<BikerPayouts />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/billing/center" element={<BillingCenter />} />
        <Route path="/billing/invoices" element={<BillingInvoices />} />
        <Route path="/billing/invoices/new" element={<BillingInvoiceNew />} />
        <Route path="/billing/invoices/:id" element={<BillingInvoiceDetail />} />
        {/* Communication Center - Redirect to modular hub */}
        <Route path="/communication-center" element={<CommunicationHubLayout />} />

        {/* CRM - Global CRM is now the main entry point */}
        <Route path="/crm" element={<GlobalCRM />} />
        <Route path="/crm/add-business" element={<AddBusinessPage />} />
        <Route path="/crm/dashboard" element={<CRM />} />
        <Route path="/crm/global" element={<GlobalCRM />} />
        <Route path="/crm/brand/:brandId" element={<CRMBrandPage />} />
        <Route path="/crm/brand/:brandId/store/:storeId" element={<CRMBrandStoreProfile />} />
        <Route path="/crm/business/:businessSlug" element={<DynamicCRMPage />} />
        <Route path="/crm/customers" element={<CRMCustomers />} />
        <Route path="/crm/customers/new" element={<CRMCustomerNew />} />
        <Route path="/crm/customers/import" element={<CRMCustomerImport />} />
        <Route path="/crm/customers/:id" element={<CRMCustomerDetail />} />
        <Route path="/crm/contacts" element={<CRMContacts />} />
        <Route path="/crm/contacts/:id" element={<CRMContactDetail />} />
        <Route path="/crm/store-contact/:id" element={<ContactProfile />} />
        <Route path="/crm/follow-ups" element={<CRMFollowUps />} />
        <Route path="/crm/data" element={<CRMData />} />
        <Route path="/crm/data/export" element={<CRMDataExport />} />
        <Route path="/crm/data/import" element={<CRMDataImport />} />
        <Route path="/crm/data/backup" element={<CRMBackupSettings />} />

        {/* Communication Center - MOVED to ProtectedNoLayout to prevent double nav */}

        {/* Companies */}
        <Route path="/companies" element={<Companies />} />
        <Route path="/companies/:id" element={<CompanyProfile />} />
        <Route path="/unpaid-accounts" element={<UnpaidAccounts />} />
        <Route path="/driver-debt-collection" element={<DriverDebtCollection />} />
        <Route path="/brand/:brand" element={<BrandDashboard />} />

        {/* Real Estate with Layout */}
        <Route path="/real-estate" element={<RealEstateLayout><RealEstate /></RealEstateLayout>} />
        <Route path="/real-estate/leads" element={<RealEstateLayout><RealEstateLeads /></RealEstateLayout>} />
        <Route path="/real-estate/pipeline" element={<RealEstateLayout><RealEstatePipeline /></RealEstateLayout>} />
        <Route path="/real-estate/investors" element={<RealEstateLayout><RealEstateInvestors /></RealEstateLayout>} />
        <Route path="/real-estate/investors/blast" element={<RealEstateLayout><InvestorBlastSystem /></RealEstateLayout>} />
        <Route path="/real-estate/closings" element={<RealEstateLayout><RealEstateClosings /></RealEstateLayout>} />
        <Route path="/real-estate/expansion" element={<RealEstateLayout><RealEstateExpansion /></RealEstateLayout>} />
        <Route path="/real-estate/subscriptions" element={<RealEstateLayout><RealEstateSubscriptions /></RealEstateLayout>} />
        <Route path="/real-estate/partners" element={<RealEstateLayout><RealEstatePartners /></RealEstateLayout>} />
        <Route path="/real-estate/pl" element={<RealEstateLayout><RealEstatePL /></RealEstateLayout>} />
        <Route path="/real-estate/loans" element={<RealEstateLayout><LoanProducts /></RealEstateLayout>} />
        <Route path="/real-estate/lenders" element={<RealEstateLayout><LenderDirectory /></RealEstateLayout>} />
        <Route path="/real-estate/calculators" element={<RealEstateLayout><LoanCalculators /></RealEstateLayout>} />
        <Route path="/real-estate/funding" element={<RealEstateLayout><FundingRequests /></RealEstateLayout>} />
        <Route path="/real-estate/va/performance" element={<RealEstateLayout><VAPerformance /></RealEstateLayout>} />
        <Route path="/real-estate/va/ranking" element={<RealEstateLayout><VARanking /></RealEstateLayout>} />
        <Route path="/real-estate/va/tasks" element={<RealEstateLayout><VATaskCenter /></RealEstateLayout>} />
        <Route path="/real-estate/deal-sheets" element={<RealEstateLayout><DealSheetsGenerator /></RealEstateLayout>} />
        <Route path="/real-estate/offers/analyzer" element={<RealEstateLayout><OfferAnalyzer /></RealEstateLayout>} />
        <Route path="/real-estate/assignment-optimizer" element={<RealEstateLayout><AssignmentFeeOptimizer /></RealEstateLayout>} />
        <Route path="/real-estate/ceo" element={<RealEstateLayout><AICEOControlRoom /></RealEstateLayout>} />

        {/* POD Routes */}
        <Route path="/pod" element={<PodLayout title="POD Dashboard"><PODOverview /></PodLayout>} />
        <Route path="/pod/designs" element={<PodLayout title="Design Library"><PODDesigns /></PodLayout>} />
        <Route path="/pod/generate" element={<PodLayout title="AI Design Generator"><PODGenerate /></PodLayout>} />
        <Route path="/pod/mockups" element={<PodLayout title="Product Mockups"><PODMockups /></PodLayout>} />
        <Route path="/pod/upload" element={<PodLayout title="Upload Designs"><PODUpload /></PodLayout>} />
        <Route path="/pod/videos" element={<PodLayout title="Video Content"><PODVideos /></PodLayout>} />
        <Route path="/pod/scheduler" element={<PodLayout title="Social Media Scheduler"><PODScheduler /></PodLayout>} />
        <Route path="/pod/analytics" element={<PodLayout title="Performance Analytics"><PODAnalytics /></PodLayout>} />
        <Route path="/pod/winners" element={<PodLayout title="Winning Products"><PODScaling /></PodLayout>} />
        <Route path="/pod/va" element={<PodLayout title="VA Control Panel"><PODVAControl /></PodLayout>} />
        <Route path="/pod/settings" element={<PodLayout title="POD Settings"><PODSettings /></PodLayout>} />

        {/* OS Procurement & Warehouse */}
        <Route path="/os/procurement" element={<ProcurementDashboard />} />
        <Route path="/os/procurement/dashboard" element={<ProcurementDashboard />} />
        <Route path="/os/procurement/suppliers" element={<ProcurementSuppliersPage />} />
        <Route path="/os/procurement/suppliers/:id" element={<ProcurementSupplierDetailPage />} />
        <Route path="/os/procurement/purchase-orders" element={<ProcurementPurchaseOrdersPage />} />
        <Route path="/os/procurement/purchase-orders/new" element={<ProcurementNewPurchaseOrderPage />} />
        <Route path="/os/procurement/purchase-orders/:id" element={<ProcurementPurchaseOrderDetailPage />} />
        <Route path="/os/warehouse" element={<WarehouseDashboard />} />

        {/* OS Inventory */}
        <Route path="/os/inventory" element={<InventoryDashboard />} />
        <Route path="/os/inventory/dashboard" element={<InventoryDashboard />} />
        <Route path="/os/inventory/products" element={<ProductsPage />} />
        <Route path="/os/inventory/products/:productId" element={<ProductDetailPage />} />
        <Route path="/os/inventory/warehouses" element={<WarehousesPage />} />
        <Route path="/os/inventory/warehouses/:warehouseId" element={<WarehouseDetailPage />} />
        <Route path="/os/inventory/suppliers" element={<InventorySuppliersPage />} />
        <Route path="/os/inventory/suppliers/:supplierId" element={<InventorySupplierDetailPage />} />
        <Route path="/os/inventory/purchase-orders" element={<InventoryPurchaseOrdersPage />} />
        <Route path="/os/inventory/purchase-orders/new" element={<InventoryNewPurchaseOrderPage />} />
        <Route path="/os/inventory/purchase-orders/:poId" element={<PurchaseOrderDetailPage />} />
        <Route path="/os/inventory/stock" element={<StockLevelsPage />} />
        <Route path="/os/inventory/movements" element={<MovementsPage />} />
        <Route path="/os/inventory/procurement" element={<ProcurementPage />} />
        <Route path="/os/inventory/insights" element={<InsightsPage />} />
        <Route path="/os/inventory/neighborhood" element={<NeighborhoodIntelligencePage />} />
        <Route path="/os/inventory/dashboard/live-tubes" element={<LiveTubesDetailPage />} />
        <Route path="/os/inventory/dashboard/boxes-sold" element={<BoxesSoldDetailPage />} />
        <Route path="/os/inventory/dashboard/low-stock" element={<LowStockDetailPage />} />
        <Route path="/os/inventory/store-inventory" element={<StoreInventoryPage />} />
        <Route path="/os/inventory/audit" element={<InventoryAuditLogPage />} />

        {/* Dynasty OS Business Units */}
        <Route path="/os/toptier" element={<TopTierDashboard />} />
        <Route path="/os/unforgettable" element={<UnforgettableDashboard />} />
        <Route path="/os/iclean" element={<ICleanDashboard />} />
        <Route path="/os/playboxxx" element={<PlayboxxxDashboard />} />
        <Route path="/os/special-needs" element={<SpecialNeedsDashboard />} />
        <Route path="/os/funding" element={<FundingDashboard />} />
        <Route path="/os/grants" element={<GrantsDashboard />} />
        <Route path="/os/wealth-engine" element={<WealthEngineDashboard />} />
        <Route path="/os/sports-betting" element={<BettingDashboard />} />
        <Route path="/biker/home" element={<BikerDashboard />} />

        {/* Delivery & Logistics Department */}
        <Route path="/delivery" element={<DeliveryDashboard />} />
        <Route path="/delivery/dashboard" element={<DeliveryDashboard />} />
        <Route path="/delivery/deliveries" element={<DeliveriesBoard />} />
        <Route path="/delivery/drivers" element={<DriversManagement />} />
        <Route path="/delivery/bikers" element={<BikersManagement />} />
        <Route path="/delivery/biker-tasks" element={<BikerTasks />} />
        <Route path="/delivery/locations" element={<LocationsManagement />} />
        <Route path="/delivery/payouts" element={<WorkerPayouts />} />
        <Route path="/delivery/debt" element={<DebtCollection />} />
        <Route path="/delivery/driver-home" element={<DriverHome />} />
        <Route path="/delivery/my-route" element={<DeliveryMyRoute />} />
        <Route path="/delivery/my-route/:deliveryId" element={<DeliveryMyRoute />} />
        <Route path="/toptier" element={<TopTierDashboard />} />
        <Route path="/toptier/*" element={<TopTierDashboard />} />
        <Route path="/unforgettable" element={<UnforgettableDashboard />} />
        <Route path="/unforgettable/*" element={<UnforgettableDashboard />} />
        <Route path="/iclean" element={<ICleanDashboard />} />
        <Route path="/iclean/*" element={<ICleanDashboard />} />
        <Route path="/playboxxx" element={<PlayboxxxDashboard />} />
        <Route path="/playboxxx/*" element={<PlayboxxxDashboard />} />
        <Route path="/specialneeds" element={<SpecialNeedsDashboard />} />
        <Route path="/specialneeds/*" element={<SpecialNeedsDashboard />} />
        <Route path="/scalati/*" element={<BrandPlaceholder />} />
        <Route path="/ecommerce/*" element={<BrandPlaceholder />} />

        {/* Module Diagnostics - Admin Only */}
        <Route path="/system/modules" element={
          <RequireRole allowedRoles={['admin']} showLocked>
            <ModuleDiagnosticsPage />
          </RequireRole>
        } />

        {/* Owner Dashboard - Admin Only */}
        <Route path="/owner" element={
          <RequireRole allowedRoles={['admin']} showLocked>
            <OwnerDashboard />
          </RequireRole>
        } />
        <Route path="/os/owner" element={
          <RequireRole allowedRoles={['admin']} showLocked>
            <OwnerDashboard />
          </RequireRole>
        } />
        <Route path="/os/owner/ai-advisor" element={
          <RequireRole allowedRoles={['admin']} showLocked>
            <OwnerAIAdvisorPage />
          </RequireRole>
        } />
        <Route path="/os/owner/cluster" element={
          <RequireRole allowedRoles={['admin']} showLocked>
            <OwnerClusterDashboard />
          </RequireRole>
        } />
        <Route path="/os/owner/autopilot" element={
          <RequireRole allowedRoles={['admin']} showLocked>
            <OwnerAutopilotConsole />
          </RequireRole>
        } />
        <Route path="/os/owner/ai-command" element={
          <RequireRole allowedRoles={['admin']} showLocked>
            <OwnerAICommandConsole />
          </RequireRole>
        } />
        <Route path="/os/owner/risk-radar" element={
          <RequireRole allowedRoles={['admin']} showLocked>
            <OwnerRiskRadar />
          </RequireRole>
        } />
        <Route path="/os/owner/briefing" element={
          <RequireRole allowedRoles={['admin']} showLocked>
            <OwnerDailyBriefing />
          </RequireRole>
        } />
        <Route path="/os/owner/holdings" element={
          <RequireRole allowedRoles={['admin']} showLocked>
            <OwnerHoldingsOverview />
          </RequireRole>
        } />

        {/* Owner Detail Pages */}
        <Route path="/os/owner/cluster/:clusterId" element={
          <RequireRole allowedRoles={['admin']} showLocked>
            <OwnerClusterDetailPage />
          </RequireRole>
        } />
        <Route path="/os/owner/autopilot/:automationId" element={
          <RequireRole allowedRoles={['admin']} showLocked>
            <OwnerAutomationDetailPage />
          </RequireRole>
        } />
        <Route path="/os/owner/risk/:riskId" element={
          <RequireRole allowedRoles={['admin']} showLocked>
            <OwnerRiskDetailPage />
          </RequireRole>
        } />
        <Route path="/os/owner/business/:businessId" element={
          <RequireRole allowedRoles={['admin']} showLocked>
            <OwnerBusinessDetailPage />
          </RequireRole>
        } />
        <Route path="/os/owner/holdings/property/:propertyId" element={
          <RequireRole allowedRoles={['admin']} showLocked>
            <OwnerPropertyDetailPage />
          </RequireRole>
        } />
        <Route path="/os/owner/holdings/financial/:allocationId" element={
          <RequireRole allowedRoles={['admin']} showLocked>
            <OwnerFinancialHoldingDetailPage />
          </RequireRole>
        } />
        <Route path="/os/owner/alert/:alertId" element={
          <RequireRole allowedRoles={['admin']} showLocked>
            <OwnerAlertDetailPage />
          </RequireRole>
        } />
        <Route path="/os/owner/holdings/auto-trading" element={
          <RequireRole allowedRoles={['admin']} showLocked>
            <OwnerAutoTradingDetailPage />
          </RequireRole>
        } />
        <Route path="/os/owner/holdings/crypto" element={
          <RequireRole allowedRoles={['admin']} showLocked>
            <OwnerCryptoDetailPage />
          </RequireRole>
        } />
        <Route path="/os/owner/holdings/sports" element={
          <RequireRole allowedRoles={['admin']} showLocked>
            <OwnerSportsDetailPage />
          </RequireRole>
        } />
        <Route path="/os/owner/voice-ai" element={
          <RequireRole allowedRoles={['admin']} showLocked>
            <OwnerVoiceAI />
          </RequireRole>
        } />
        <Route path="/os/owner/reports" element={
          <RequireRole allowedRoles={['admin']} showLocked>
            <OwnerReports />
          </RequireRole>
        } />
        <Route path="/os/owner/va-routing" element={
          <RequireRole allowedRoles={['admin']} showLocked>
            <OwnerVARouting />
          </RequireRole>
        } />
        <Route path="/os/owner/alert-center" element={
          <RequireRole allowedRoles={['admin']} showLocked>
            <OwnerAlertCenter />
          </RequireRole>
        } />
        <Route path="/os/owner/executive-reports" element={
          <RequireRole allowedRoles={['admin']} showLocked>
            <OwnerExecutiveReports />
          </RequireRole>
        } />
        <Route path="/os/owner/broadcast" element={
          <RequireRole allowedRoles={['admin']} showLocked>
            <OwnerBroadcastCenter />
          </RequireRole>
        } />

        {/* AI Workforce */}
        <Route path="/ai/workforce" element={<AIWorkforce />} />
      </Route>

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* PROTECTED ROUTES WITHOUT LAYOUT (Portal, special pages)                      */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      <Route element={<ProtectedNoLayout />}>
        {/* Communication Center - Full-screen floor with own layout (no main Layout wrapper) */}
        <Route path="/communication" element={<CommunicationHubLayout />}>
          <Route index element={<InboxPage />} />
          <Route path="inbox" element={<InboxPage />} />
          <Route path="dialer" element={<DialerPage />} />
          <Route path="manual-calls" element={<ManualCallPage />} />
          <Route path="manual-text" element={<ManualTextPage />} />
          <Route path="ai-auto-dialer" element={<AIAutoDialerPage />} />
          <Route path="ai-auto-text" element={<AIAutoTextPage />} />
          <Route path="outbound-engine" element={<OutboundEnginePage />} />
          <Route path="autonomous-director" element={<AutonomousDirectorPage />} />
          <Route path="voice-library" element={<VoiceLibraryPage />} />
          <Route path="deals" element={<DealsSalesPage />} />
          <Route path="live" element={<LiveCallsPage />} />
          <Route path="escalations" element={<EscalationsPage />} />
          <Route path="engagement" element={<EngagementPage />} />
          <Route path="routing" element={<RoutingPage />} />
          <Route path="outreach" element={<OutreachPage />} />
          <Route path="campaigns" element={<CampaignsPage />} />
          <Route path="personas" element={<PersonasPage />} />
          <Route path="call-flows" element={<CallFlowsPage />} />
          <Route path="heatmap" element={<HeatmapPage />} />
          <Route path="call-reasons" element={<CallReasonsPage />} />
          <Route path="predictions" element={<PredictionsPage />} />
          <Route path="agents" element={<AgentsPage />} />
          <Route path="language" element={<LanguagePage />} />
          <Route path="voice-matrix" element={<VoiceMatrixPage />} />
          <Route path="settings" element={<CommSettingsPage />} />
          <Route path="phone-numbers" element={<PhoneNumbersSettingsPage />} />
          <Route path="follow-ups" element={<FollowUpManagerPage />} />
          <Route path="unified-inbox" element={<UnifiedInboxV3Page />} />
        </Route>

        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/messages/:threadId" element={<MessagesPage />} />
        <Route path="/routes/my-route" element={<MyRoute />} />
        <Route path="/me/home" element={<WorkerHome />} />
        <Route path="/me/driver" element={<WorkerHome />} />
        <Route path="/operations/live-map" element={<LiveMap />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/subscriptions" element={<Subscriptions />} />
        <Route path="/expansion/capacity" element={<DeliveryCapacity />} />

        {/* Portal Routes */}
        <Route path="/portal" element={<RoleRouter />} />
        <Route path="/portal/home" element={<PortalHome />} />
        <Route path="/portal/onboarding" element={<PortalOnboarding />} />
        <Route path="/portal/driver" element={<DriverPortal />} />
        <Route path="/portal/biker" element={<BikerPortal />} />
        <Route path="/portal/ambassador" element={<AmbassadorPortal />} />
        <Route path="/portal/store" element={<StoreDashboard />} />
        <Route path="/portal/store/dashboard" element={<StoreDashboard />} />
        <Route path="/portal/store/products" element={<StoreProducts />} />
        <Route path="/portal/store/products/:productId" element={<StoreProducts />} />
        <Route path="/portal/store/cart" element={<StoreCart />} />
        <Route path="/portal/store/checkout" element={<StoreCheckout />} />
        <Route path="/portal/store/orders" element={<StoreOrders />} />
        <Route path="/portal/store/orders/:orderId" element={<StoreOrderDetail />} />
        <Route path="/portal/store/invoices" element={<StoreInvoices />} />
        <Route path="/portal/store/settings" element={<StoreSettings />} />
        <Route path="/portal/store/messages" element={<StoreMessages />} />
        <Route path="/portal/store/messages/:threadId" element={<StoreMessages />} />
        <Route path="/portal/store/team" element={<StoreTeam />} />
        <Route path="/portal/join" element={<JoinOrg />} />
        <Route path="/portal/wholesaler" element={<WholesalerDashboard />} />
        <Route path="/portal/wholesaler/products" element={<WholesalerProducts />} />
        <Route path="/portal/wholesaler/products/new" element={<WholesalerProductForm />} />
        <Route path="/portal/wholesaler/products/:productId" element={<WholesalerProductForm />} />
        <Route path="/portal/wholesaler/products/:productId/edit" element={<WholesalerProductForm />} />
        <Route path="/portal/wholesaler/orders" element={<WholesalerOrders />} />
        <Route path="/portal/wholesaler/finance" element={<WholesalerFinance />} />
        <Route path="/portal/wholesaler/settings" element={<WholesalerSettings />} />
        <Route path="/portal/wholesaler/messages" element={<WholesalerMessages />} />
        <Route path="/portal/wholesaler/messages/:threadId" element={<WholesalerMessages />} />
        <Route path="/portal/wholesaler/team" element={<WholesalerTeam />} />
        <Route path="/portal/production" element={<ProductionPortal />} />
        <Route path="/portal/va" element={<VAPortal />} />
        <Route path="/portal/customer" element={<CustomerPortal />} />
        <Route path="/portal/invoices" element={<PortalInvoices />} />
        <Route path="/portal/invoices/:id" element={<PortalInvoiceDetail />} />
        <Route path="/portal/wholesale" element={<PortalWholesale />} />
        <Route path="/portal/influencer" element={<PortalInfluencer />} />
        <Route path="/portal/dashboard" element={<PortalDashboard />} />

        {/* Grabba Financial (no layout) */}
        <Route path="/grabba/financial-dashboard" element={<FinancialDashboard />} />
        <Route path="/grabba/personal-finance" element={<PersonalFinance />} />
        <Route path="/grabba/payroll-manager" element={<PayrollManager />} />
        <Route path="/grabba/advisor-penthouse" element={<AdvisorPenthouse />} />
        <Route path="/grabba/instinct-log" element={<InstinctLog />} />
      </Route>

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* PROTECTED WITH LAYOUT (Portal admin pages)                                   */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      <Route element={<ProtectedLayout />}>
        <Route path="/portal/national-wholesale" element={<NationalWholesale />} />
        <Route path="/portal/marketplace-admin" element={<MarketplaceAdmin />} />
      </Route>

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* GRABBA EMPIRE — Role-Protected Routes                                        */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      
      {/* Penthouse - Admin Only */}
      <Route path="/grabba/command-penthouse" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee', 'accountant']} showLocked>
            <Layout><GrabbaLayout><GrabbaCommandPenthouse /></GrabbaLayout></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/cluster" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee']} showLocked>
            <Layout><GrabbaLayout><GrabbaClusterDashboard /></GrabbaLayout></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/analytics" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee']} showLocked>
            <Layout><GrabbaLayout><GrabbaClusterAnalytics /></GrabbaLayout></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/analytics/neighborhoods" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee']} showLocked>
            <Layout><GrabbaLayout><GrabbaNeighborhoodPerformance /></GrabbaLayout></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/communications" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee']} showLocked>
            <Layout><CommunicationHubLayout /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/unified-upload" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee']} showLocked>
            <Layout><GrabbaLayout><UnifiedUploadCenter /></GrabbaLayout></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/ai-insights" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee']} showLocked>
            <Layout><GrabbaLayout><AIInsights /></GrabbaLayout></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/autopilot-console" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin']} showLocked>
            <Layout><GrabbaLayout><GrabbaAutopilotConsole /></GrabbaLayout></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/autopilot" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee']} showLocked>
            <Layout><GrabbaAutopilotDashboard /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/command-console" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee']} showLocked>
            <Layout><GrabbaCommandConsole /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/ai-command-console" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee']} showLocked>
            <Layout><GrabbaAICommandConsole /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/results" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee', 'csr', 'driver', 'warehouse', 'accountant']}>
            <Layout><ResultsPage /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/action-queue" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee', 'csr', 'warehouse']}>
            <Layout><ActionQueuePage /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/routes" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee', 'csr', 'driver', 'warehouse']}>
            <Layout><GrabbaRoutesPage /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/drilldown/:type" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee', 'csr', 'driver', 'warehouse', 'accountant']}>
            <Layout><GrabbaLayout><DrillDownPage /></GrabbaLayout></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/ai-console" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee', 'csr']}>
            <Layout><AiCommandConsole /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/ai-playbooks" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee']}>
            <Layout><AiPlaybooks /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/routines" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee']}>
            <Layout><AiRoutines /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/risk-radar" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee']}>
            <Layout><RiskRadar /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/follow-up-settings" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee']}>
            <Layout><FollowUpSettings /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/daily-briefing" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee']}>
            <Layout><DailyBriefing /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />

      {/* Floor 1 — CRM & Store Control */}
      <Route path="/grabba/crm" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee', 'driver', 'csr', 'ambassador', 'accountant']}>
            <Layout><GrabbaLayout><GrabbaCRM /></GrabbaLayout></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/crm/:id" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee', 'driver', 'csr']}>
            <Layout><GrabbaLayout><StoreMasterProfile /></GrabbaLayout></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/store-master/:id" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee', 'driver', 'csr']}>
            <Layout><GrabbaLayout><StoreMasterProfile /></GrabbaLayout></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/store/:id" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee', 'driver', 'csr']}>
            <Layout><GrabbaLayout><StoreMasterProfile /></GrabbaLayout></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/store-master" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee', 'driver', 'csr']}>
            <Layout><GrabbaLayout><GrabbaCRM /></GrabbaLayout></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/brand" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee', 'csr']}>
            <Layout><GrabbaLayout><BrandSelector /></GrabbaLayout></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/brand-crm" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee', 'csr']}>
            <Layout><GrabbaLayout><BrandSelector /></GrabbaLayout></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/brand/:brand" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee', 'csr']}>
            <Layout><GrabbaLayout><BrandCRM /></GrabbaLayout></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/memory-backfill" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin']}>
            <Layout><GrabbaLayout><MemoryBackfill /></GrabbaLayout></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />

      {/* Floor 2 — Communication Center V8 (Modular with nested routes) */}
      <Route path="/grabba/communication/*" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee', 'csr', 'driver']}>
            <Layout><CommunicationHubLayout /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/communication" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee', 'csr']}>
            <Layout><CommunicationHubLayout /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/text-center" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee', 'csr']}>
            <Layout><CommunicationHubLayout /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/email-center" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee', 'csr']}>
            <Layout><CommunicationHubLayout /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/call-center" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee', 'csr']}>
            <Layout><CommunicationHubLayout /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/communication-logs" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee', 'csr']}>
            <Layout><CommunicationHubLayout /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/brand/:brand/communications" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee', 'csr']}>
            <Layout><CommunicationHubLayout /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />

      {/* Floor 3 — Inventory */}
      <Route path="/grabba/inventory" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee', 'warehouse', 'driver', 'csr', 'accountant']}>
            <Layout><GrabbaLayout><GrabbaInventory /></GrabbaLayout></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />

      {/* Floor 4 — Delivery & Drivers */}
      <Route path="/grabba/deliveries" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee', 'driver', 'biker', 'warehouse', 'csr']}>
            <Layout><GrabbaLayout><GrabbaDeliveries /></GrabbaLayout></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/delivery-runs" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee', 'driver', 'biker']}>
            <Layout><GrabbaLayout><MultiBrandDelivery /></GrabbaLayout></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />

      {/* Floor 5 — Finance & Orders */}
      <Route path="/grabba/finance" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee', 'accountant', 'store', 'wholesale', 'wholesaler', 'warehouse', 'customer', 'csr']}>
            <Layout><GrabbaLayout><GrabbaFinance /></GrabbaLayout></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />

      {/* Floor 6 — Production */}
      <Route path="/grabba/production" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee', 'warehouse', 'accountant']}>
            <Layout><GrabbaLayout><GrabbaProduction /></GrabbaLayout></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />

      {/* Floor 7 — Wholesale */}
      <Route path="/grabba/wholesale-platform" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee', 'wholesale', 'wholesaler', 'warehouse', 'csr', 'accountant']}>
            <Layout><GrabbaLayout><GrabbaWholesalePlatform /></GrabbaLayout></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/upload-center" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee', 'wholesale', 'wholesaler']}>
            <Layout><GrabbaLayout><UnifiedUploadCenter /></GrabbaLayout></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />

      {/* Floor 8 — Ambassadors */}
      <Route path="/grabba/ambassadors" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee', 'ambassador', 'csr', 'accountant']}>
            <Layout><GrabbaLayout><GrabbaAmbassadors /></GrabbaLayout></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />

      {/* AI Operations Floor */}
      <Route path="/grabba/ai" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee']} showLocked>
            <Layout><GrabbaLayout><AIOperationsDashboard /></GrabbaLayout></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/ai/tasks" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee']} showLocked>
            <Layout><GrabbaLayout><AITasks /></GrabbaLayout></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/ai/predict" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee']} showLocked>
            <Layout><GrabbaLayout><AIPredictions /></GrabbaLayout></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/ai/alerts" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee']} showLocked>
            <Layout><GrabbaLayout><AIAlerts /></GrabbaLayout></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
