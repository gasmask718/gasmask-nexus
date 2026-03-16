/**
 * AppRoutes - Clean nested route structure for Dynasty OS
 * Uses React Router nested routes with Layout wrapper
 */
import { Routes, Route, Outlet, Navigate } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import { RoleRouteGuard } from '@/components/security/RoleRouteGuard';
import { RequireRole } from '@/components/security/RequireRole';
import Layout from '@/components/Layout';

// Multi-Surface Layouts
import PublicLayout from '@/layouts/PublicLayout';
import OpsLayout from '@/layouts/OpsLayout';
import LandingPage from '@/pages/public/LandingPage';
import AboutPage from '@/pages/public/AboutPage';
import ContactPage from '@/pages/public/ContactPage';
import { useAuth } from '@/contexts/AuthContext';

// Public pages
import Auth from '@/pages/Auth';
import Shop from '@/pages/Shop';
import Cart from '@/pages/Cart';
import Checkout from '@/pages/Checkout';
import NotFound from '@/pages/NotFound';
import TWLLanding from '@/pages/TWLLanding';
import PortalLogin from '@/pages/portal/PortalLogin';
import PortalRegister from '@/pages/portal/PortalRegister';
import DriverLogin from '@/pages/portal/DriverLogin';
import BikerLogin from '@/pages/portal/BikerLogin';
import InviteSignup from '@/pages/auth/InviteSignup';
import UserInvitations from '@/pages/security/UserInvitations';
import InviteLanding from '@/pages/portal/InviteLanding';
import InstallPwa from '@/pages/InstallPwa';

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
import TerritoryOverview from '@/pages/territory/TerritoryOverview';
import TerritoryNeighborhoods from '@/pages/territory/TerritoryNeighborhoods';
import TerritoryTasks from '@/pages/territory/TerritoryTasks';
import TerritoryCandidates from '@/pages/territory/TerritoryCandidates';
import ScoutConsole from '@/pages/territory/ScoutConsole';
import CallConsole from '@/pages/territory/CallConsole';
import VisitConsole from '@/pages/territory/VisitConsole';
import PromotionsPending from '@/pages/territory/PromotionsPending';
import PromotionsHistory from '@/pages/territory/PromotionsHistory';
import TerritoryIngestion from '@/pages/territory/TerritoryIngestion';
import TerritoryGapIntelligence from '@/pages/territory/TerritoryGapIntelligence';
import TerritoryPlanning from '@/pages/territory/TerritoryPlanning';
import CommitmentHistory from '@/pages/territory/CommitmentHistory';
import AIPermissionsOverview from '@/pages/territory/AIPermissionsOverview';
import AIPermissionsNeighborhoods from '@/pages/territory/AIPermissionsNeighborhoods';
import AIPermissionsActions from '@/pages/territory/AIPermissionsActions';
import AIViolationsPage from '@/pages/territory/AIViolationsPage';
import AIReviewQueuePage from '@/pages/territory/AIReviewQueuePage';
import TerritoryPlaybooksPage from '@/pages/territory/TerritoryPlaybooksPage';
import RevenueBrain from '@/pages/RevenueBrain';
import OpportunityRadar from '@/pages/OpportunityRadar';
import MasterOpportunities from '@/pages/MasterOpportunities';
import MissionsHQ from '@/pages/MissionsHQ';
import Communications from '@/pages/Communications';
import Templates from '@/pages/Templates';
import Reminders from '@/pages/Reminders';
import InfluencerDetail from '@/pages/InfluencerDetail';
import InfluencerAnalyticsCenter from '@/pages/InfluencerAnalyticsCenter';
import WholesalerDetail from '@/pages/grabba/WholesalerProfile';
import WorkerHome from '@/pages/WorkerHome';
import AutomationSettings from '@/pages/AutomationSettings';
import Training from '@/pages/Training';
import Ambassadors from '@/pages/Ambassadors';
import { AmbassadorDashboard, AmbassadorStoreProfile, AmbassadorStoresList, AmbassadorWholesalersList, AmbassadorCommissions, AmbassadorRoutes, AmbassadorOrders, AmbassadorCommunications, AmbassadorLeads, AmbassadorDisputes, AmbassadorDisputeDetail, AmbassadorPurchases, AmbassadorSellThrough, AmbassadorProfitDashboard, AmbassadorInvites, AmbassadorRecruitmentLeads } from '@/pages/ambassador';
import AmbassadorRequestAmbassador from '@/pages/ambassador/AmbassadorRequestAmbassador';
import AmbassadorRequests from '@/pages/security/AmbassadorRequests';
import AmbassadorInviteAccept from '@/pages/invite/AmbassadorInviteAccept';
import AmbassadorInviteGovernance from '@/pages/admin/AmbassadorInviteGovernance';
import { AmbassadorProfilePage, WholesalerProfilePage, StoreProfilePage, InfluencerProfilePage } from '@/pages/profile';
import { AmbassadorCommandDashboard, AllAmbassadorsTable, AmbassadorProfilePage as Floor8AmbassadorProfile, AmbassadorPayoutsPage as Floor8PayoutsPage, AmbassadorRegionsPage, InfluencersPage as Floor8InfluencersPage } from '@/pages/floor8';
import { AdminDisputesQueue, AdminDisputeDetail } from '@/pages/admin/disputes';
import { AdminOverridesPage, AdminOverrideDetailPage } from '@/pages/admin/overrides';
import { AdminPayoutsPage, AdminPayoutDetailPage } from '@/pages/admin/payouts';
import { AdminMarketplacePayoutsPage } from '@/pages/admin/marketplace-payouts';
import { MarketplaceControlTowerPage } from '@/pages/admin/marketplace-control';
import { FinancialReportsPage, AmbassadorReportsPage, StoreReportsPage, TaxReportsPage, PayoutReportsPage } from '@/pages/admin/reports';
import DeletedRecords from '@/pages/admin/DeletedRecords';
import QACommandCenter from '@/pages/admin/qa/QACommandCenter';
import AmbassadorApplications from '@/pages/admin/AmbassadorApplications';
import SmsSystemTests from '@/pages/admin/SmsSystemTests';
import AmbassadorApplication from '@/pages/apply/AmbassadorApplication';
import { AmbassadorEarningsPage } from '@/pages/ambassador/reports';
import { AmbassadorPayoutsPage, AmbassadorPayoutStatementPage, AmbassadorPayoutSettingsPage } from '@/pages/ambassador/payouts';
import Expansion from '@/pages/Expansion';
import Rewards from '@/pages/Rewards';
import LiveMap from '@/pages/LiveMap';
import WalletPage from '@/pages/Wallet';
import Subscriptions from '@/pages/Subscriptions';
import DeliveryCapacity from '@/pages/DeliveryCapacity';
import { DeliveryCapacityCommand } from '@/pages/delivery';
import CommunicationAutomation from '@/pages/CommunicationAutomation';
import CommunicationsAI from '@/pages/CommunicationsAI';
import { SecurityConsole } from '@/components/security/SecurityConsole';
import { RolesPermissionsPage } from '@/components/security/RolesPermissionsPage';
import UserManagementPage from '@/components/security/UserManagementPage';
import MessagesPage from '@/pages/Messages';
import CommunicationInsights from '@/pages/CommunicationInsights';
import RouteOptimizer from '@/pages/RouteOptimizer';
import RouteOpsCenter from '@/pages/RouteOpsCenter';
import { RouteOpsCenterEnhanced, OpsCommandCenter, RouteOptimizerPage } from '@/pages/delivery';
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
import SellThroughAnalytics from '@/pages/SellThroughAnalytics';
import BrandCRMPage from '@/pages/floor1/BrandCRMPage';
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
import GlobalCRMDashboard from '@/pages/crm/GlobalCRMDashboard';
import BusinessCRMDashboard from '@/pages/crm/BusinessCRMDashboard';
import CRMRouter from '@/pages/crm/CRMRouter';
import DynamicCRMPage from '@/pages/crm/DynamicCRMPage';
import { TopTierPartnerDashboard, TopTierPartnerCategoryPage, TopTierPartnerProfile, TopTierPartnersByState, TopTierAddPartner, TopTierRecentBookings, TopTierCustomerRequests, TopTierRequestDetail, TopTierPartnerEdit, TopTierDealDetail, TopTierCampaignDetail, TopTierInteractionDetail, TopTierContactDetail, TopTierAssetDetail, TopTierNoteDetail, TopTierAnalyticsDeals, TopTierAnalyticsRevenue, TopTierAnalyticsCommissions, TopTierAllContacts, TopTierInteractionsHub, TopTierCustomers, TopTierCustomerProfile, TopTierNewCustomer, TopTierEditCustomer, TopTierVIPCustomers, TopTierReturningCustomers, TopTierNewCustomers, TopTierCustomerBookings, TopTierCustomerValue, TopTierAllPartners, TopTierNewDeal, TopTierDeals, TopTierKPIManagement } from '@/pages/crm/toptier';
import AddBusinessPage from '@/pages/crm/AddBusinessPage';
import CRMDataPage from '@/pages/crm/CRMDataPage';
import CRMExportPage from '@/pages/crm/CRMExportPage';
import CRMImportPage from '@/pages/crm/CRMImportPage';
import CRMBackupPage from '@/pages/crm/CRMBackupPage';
import EntityListPage from '@/pages/crm/EntityListPage';
import EntityProfilePage from '@/pages/crm/EntityProfilePage';
import EntityCreatePage from '@/pages/crm/EntityCreatePage';
import CRMSettingsPage from '@/pages/crm/CRMSettingsPage';
import CRMUserAccessPage from '@/pages/crm/CRMUserAccessPage';
import AcceptCRMInvite from '@/pages/crm/AcceptCRMInvite';
import CRMBrandPage from '@/pages/crm/BrandCRM';
import CRMBrandStoreProfile from '@/pages/crm/BrandStoreProfile';
import CRMCustomerNew from '@/pages/CRMCustomerNew';
import CRMCustomerDetail from '@/pages/CRMCustomerDetail';
import CRMCustomerImport from '@/pages/CRMCustomerImport';
import CRMData from '@/pages/CRMData';
import CRMDataExport from '@/pages/CRMDataExport';
import CRMDataImport from '@/pages/CRMDataImport';
import CRMBulkUpload from '@/pages/CRMBulkUpload';
import CRMBackupSettings from '@/pages/CRMBackupSettings';
import CRMFollowUps from '@/pages/CRMFollowUps';
import Companies from '@/pages/Companies';
import CompanyProfile from '@/pages/CompanyProfile';
import UnpaidAccounts from '@/pages/UnpaidAccounts';
import DriverDebtCollection from '@/pages/DriverDebtCollection';
import BrandDashboard from '@/pages/BrandDashboard';
import { OwnerDashboard, OwnerAIAdvisorPage, OwnerClusterDashboard, OwnerAutopilotConsole, OwnerAICommandConsole, OwnerRiskRadar, OwnerDailyBriefing, OwnerHoldingsOverview, OwnerClusterDetailPage, OwnerAutomationDetailPage, OwnerRiskDetailPage, OwnerBusinessDetailPage, OwnerPropertyDetailPage, OwnerFinancialHoldingDetailPage, OwnerAlertDetailPage, OwnerAutoTradingDetailPage, OwnerCryptoDetailPage, OwnerSportsDetailPage, OwnerVoiceAI, OwnerReports, OwnerVARouting, OwnerAlertCenter, OwnerExecutiveReports, OwnerBroadcastCenter, OwnerAccountingOS } from '@/pages/owner';
import OwnerMissionControl from '@/pages/owner/OwnerMissionControl';

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
import BusinessPhoneNumbersPage from '@/pages/communication/BusinessPhoneNumbers';
import { UserCallSettingsPage, BusinessHoursPage, AfterHoursRoutingPage, CallSystemDiagnosticsPage } from '@/pages/communication/call-settings';
import { VoicemailInboxPage, MissedCallsDashboardPage, CallIntelligencePage, UnresolvedCallsQueuePage } from '@/pages/communication/call-intelligence';
import AICallAgentDashboardPage from '@/pages/communication/call-intelligence/AICallAgentDashboardPage';
import ManualCallPage from '@/pages/communication/manual/ManualCallPage';
import ManualTextPage from '@/pages/communication/manual/ManualTextPage';
import AIAutoDialerPage from '@/pages/communication/ai/AIAutoDialerPage';
import BulkDialerPage from '@/pages/communication/dialer/BulkDialerPage';
import LiveCallPanel from '@/pages/communication/dialer/LiveCallPanel';
import DialerSettingsPage from '@/pages/communication/dialer/DialerSettingsPage';
import RepPerformancePage from '@/pages/communication/dialer/RepPerformancePage';
import CampaignIntelligencePage from '@/pages/communication/dialer/CampaignIntelligencePage';
import DialerCostDashboard from '@/pages/communication/dialer/DialerCostDashboard';
import DialerHealthPage from '@/pages/communication/dialer/DialerHealthPage';
import DialerOptimizationDashboard from '@/pages/communication/dialer/DialerOptimizationDashboard';
import DialerRevenueIntelligence from '@/pages/communication/dialer/DialerRevenueIntelligence';
import DialerPredictiveTargeting from '@/pages/communication/dialer/DialerPredictiveTargeting';
import DialerIntegrityPage from '@/pages/communication/dialer/DialerIntegrityPage';
import AutoDialerPage from '@/pages/communication/dialer/AutoDialerPage';
import AIAutoTextPage from '@/pages/communication/ai/AIAutoTextPage';
import { MessagingHubPage } from '@/pages/communication/messaging';
import OutboundEnginePage from '@/pages/communication/ai/OutboundEnginePage';
import AutonomousDirectorPage from '@/pages/communication/ai/AutonomousDirectorPage';
import VoiceLibraryPage from '@/pages/communication/voice/VoiceLibraryPage';
import DealsSalesPage from '@/pages/communication/deals/DealsSalesPage';
import FollowUpManagerPage from '@/pages/communication/followups/FollowUpManagerPage';
import FieldSubmissionsPage from '@/pages/communication/FieldSubmissionsPage';
import UnifiedInboxV3Page from '@/pages/communication/inbox/UnifiedInboxV3Page';
import PlaybooksManagement from '@/pages/communication/PlaybooksManagement';
import ShadowModePage from '@/pages/communication/ShadowModePage';
import OutboundGrowthPage from '@/pages/communication/OutboundGrowthPage';
import { ExecutiveControlRoomPage } from '@/pages/executive';
import ComplianceCenter from '@/pages/compliance/ComplianceCenter';
import ColdCallBlastPage from '@/pages/communication/cold-calls/ColdCallBlastPage';
// Legacy Communication imports (kept for other routes)
import CommunicationOverview from '@/pages/communication/CommunicationOverview';
import CommunicationCampaigns from '@/pages/communication/CommunicationCampaigns';
import CommunicationCampaignNew from '@/pages/communication/CommunicationCampaignNew';
import CommunicationCampaignDetail from '@/pages/communication/CommunicationCampaignDetail';
import CommunicationCalls from '@/pages/communication/CommunicationCalls';
import CommunicationSMS from '@/pages/communication/CommunicationSMS';
import CommunicationSMSDashboard from '@/pages/communication/CommunicationSMSDashboard';
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
import CommunicationHubPage from '@/pages/comm-systems/hub/CommunicationHubPage';

import BillingCenter from '@/pages/BillingCenter';
import BillingInvoices from '@/pages/BillingInvoices';
import BillingInvoiceNew from '@/pages/BillingInvoiceNew';
import BillingInvoiceDetail from '@/pages/BillingInvoiceDetail';
import { Floor5Dashboard } from '@/pages/floor5';

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
import OpsInboxPage from '@/pages/portal/OpsInboxPage';
import OpsInboxThreadPage from '@/pages/portal/OpsInboxThreadPage';
import OpsTaskListPage from '@/pages/portal/OpsTaskListPage';
import { WholesalerDashboard, WholesalerProducts, WholesalerProductForm, WholesalerOrders, WholesalerFinance, WholesalerSettings, WholesalerMessages, WholesalerFulfillmentPage, WholesalerTransactionHistory, WholesalerInventoryWorkflow } from '@/pages/portal/wholesaler';
import { StoreDashboard, StoreProducts, StoreCart, StoreCheckout, StoreOrders, StoreOrderDetail, StoreInvoices, StoreSettings, StoreMessages } from '@/pages/portal/store';
import StoreTeam from '@/pages/portal/store/StoreTeam';
import WholesalerTeam from '@/pages/portal/wholesaler/WholesalerTeam';
import JoinOrg from '@/pages/portal/JoinOrg';
import ProductionPortal from '@/pages/portal/ProductionPortal';
import VAPortal from '@/pages/portal/VAPortal';
import CustomerPortal from '@/pages/portal/CustomerPortal';
import NationalWholesale from '@/pages/portal/NationalWholesale';
import MarketplaceAdmin from '@/pages/portal/MarketplaceAdmin';

// New Role Portals (Enterprise-grade)
import {
  DriverPortalPage,
  BikerPortalPage,
  AmbassadorPortalPage,
  StorePortalPage,
  WholesalerPortalPage,
  ProductionPortalPage,
  VAPortalPage,
  CustomerPortalPage,
  NationalWholesalePortalPage,
  MarketplaceAdminPortalPage,
} from '@/pages/portals';
import OfficesManagementPage from '@/pages/portals/production/OfficesManagementPage';
import StaffManagementPage from '@/pages/portals/production/StaffManagementPage';
import ConversionIntelligencePage from '@/pages/portals/ConversionIntelligencePage';
import SupplierYieldPage from '@/pages/portals/SupplierYieldPage';
import SalesVelocityPage from '@/pages/portals/SalesVelocityPage';
import ProductionWarRoom from '@/pages/portals/production/ProductionWarRoom';
import WorkerTaskTimerPage from '@/pages/portals/production/WorkerTaskTimerPage';
import CostHistoryPage from '@/pages/production/CostHistoryPage';
import SupervisorComparisonPage from '@/pages/production/SupervisorComparisonPage';

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
import { InventoryDashboard, ProductsPage, ProductDetailPage, ProductInventoryPage, WarehousesPage, WarehouseDetailPage, SuppliersPage as InventorySuppliersPage, SupplierDetailPage as InventorySupplierDetailPage, PurchaseOrdersPage as InventoryPurchaseOrdersPage, NewPurchaseOrderPage as InventoryNewPurchaseOrderPage, PurchaseOrderDetailPage, StockLevelsPage, MovementsPage, ProcurementPage, InsightsPage, NeighborhoodIntelligencePage } from '@/pages/os/inventory';
import ProductConversions from '@/pages/os/ProductConversions';
import LegacyInvoiceRepair from '@/pages/admin/LegacyInvoiceRepair';
import MarketplaceConnectionPage from '@/pages/admin/dev/MarketplaceConnectionPage';
import OSLayout from '@/pages/os/OSLayout';
import StoreInventoryPage from '@/pages/os/inventory/StoreInventoryPage';
import InventoryAuditLogPage from '@/pages/os/inventory/InventoryAuditLogPage';
import TubeIntelligencePage from '@/pages/TubeIntelligencePage';
import { LiveTubesDetailPage, BoxesSoldDetailPage, LowStockDetailPage } from '@/pages/os/inventory/dashboard';
import TopTierDashboard from '@/pages/os/toptier/TopTierDashboard';
import {
  UnforgettableDashboard,
  UnforgettableStaff,
  UnforgettableStaffProfile,
  UnforgettableStaffNew,
  UnforgettableStaffEdit,
  UnforgettableStaffCategories,
  UnforgettableStaffVenues,
  UnforgettableStaffNotes,
  UnforgettableStaffCall,
  UnforgettableStaffEmail,
  UnforgettableStaffPerformance,
  UnforgettableScheduling,
  UnforgettableSchedulingToday,
  UnforgettableSchedulingUpcoming,
  UnforgettableSchedulingGaps,
  UnforgettablePayroll,
  UnforgettablePayrollDetail,
  UnforgettableDocuments,
  UnforgettableDocumentDetail,
  UnforgettableAvailability,
  UnforgettablePerformance,
  UnforgettableCommunications,
  UnforgettableAICalling,
  UnforgettableAICallDetail,
  UnforgettableOnboarding,
  UnforgettableCustomerService,
  UnforgettableMedia,
  UnforgettableMediaDetail,
} from '@/pages/os/unforgettable';
import {
  UnforgettableEventHalls,
  UnforgettableEventHallDetail,
  UnforgettableRentals,
  UnforgettableInfluencers,
  UnforgettableMediaVault,
  UnforgettablePartySuppliers,
  UnforgettableGifts,
} from '@/pages/crm/unforgettable';
import ICleanDashboard from '@/pages/os/iclean/ICleanDashboard';
import PlayboxxxDashboard from '@/pages/os/playboxxx/PlayboxxxDashboard';
import SpecialNeedsDashboard from '@/pages/os/specialneeds/SpecialNeedsDashboard';
import FundingDashboard from '@/pages/os/funding/FundingDashboard';
import GrantsDashboard from '@/pages/os/grants/GrantsDashboard';
import WealthEngineDashboard from '@/pages/os/wealth/WealthEngineDashboard';
import BettingDashboard from '@/pages/os/betting/BettingDashboard';
import LineIntake from '@/pages/os/betting/LineIntake';
import SimulationPage from '@/pages/os/betting/SimulationPage';
import ParlayLab from '@/pages/os/betting/ParlayLab';
import HedgeCenter from '@/pages/os/betting/HedgeCenter';
import OwnerInternal from '@/pages/os/betting/OwnerInternal';
import NBADailyBoard from '@/pages/os/betting/NBADailyBoard';
import StatsInspector from '@/pages/os/betting/StatsInspector';
import BettingSettings from '@/pages/os/betting/BettingSettings';
import BettingWorkflow from '@/pages/os/betting/BettingWorkflow';
import PlatformsDashboard from '@/pages/os/betting/PlatformsDashboard';
import LineShopping from '@/pages/os/betting/LineShopping';
import PickEntryWizard from '@/pages/os/betting/PickEntryWizard';
import EntriesList from '@/pages/os/betting/EntriesList';
import BettingResultsPage from '@/pages/os/betting/ResultsPage';
import BikerDashboard from '@/pages/os/biker/BikerDashboard';
import ModuleDiagnosticsPage from '@/pages/ModuleDiagnosticsPage';

// Delivery & Logistics
import { 
  DeliveryDashboard, 
  DeliveriesBoard, 
  DriversManagement, 
  BikersManagement, 
  BikerProfile,
  DriverProfile,
  BikerTasks, 
  LocationsManagement, 
  WorkerPayouts, 
  DebtCollection, 
  DriverHome,
  DriverOS,
  DeliveryMyRoute,
  HeatmapPage as DeliveryHeatmapPage,
  IssueDetailPage as DeliveryIssueDetailPage,
  RouteSuggestionsPage as DeliveryRouteSuggestionsPage,
  DriverRoutesCompleted,
  DriverStopsCompleted,
  DriverIssuesReported,
  RouteManagerPage,
  AllRoutesPage,
  MultiBrandDeliveryPage,
  LiveMapPage,
  LiveMapCommandCenter,
  RouteOpsCenter as DeliveryRouteOpsCenter,
  MyRouteToday,
  AutonomyConsole,
  DeliveryDispatchPage
} from '@/pages/delivery';
import DeliveryStoreProfile from '@/pages/delivery/StoreProfile';
import DeliveryRouteDetailPage from '@/pages/delivery/DeliveryRouteDetail';

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
import GrabbaAssignments from '@/pages/grabba/GrabbaAssignments';
import GrabbaAmbassadors from '@/pages/grabba/GrabbaAmbassadors';
import AmbassadorProfile from '@/pages/grabba/AmbassadorProfile';
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
import { Floor9Hub, Floor9Playbooks, Floor9ActionQueue, Floor9InstinctLog, Floor9Results } from '@/pages/floor9';
import Floor9Router from '@/routes/Floor9Router';
import { CommandExport, Floor1Export, Floor2Export, Floor3Export, Floor4Export, Floor5Export, Floor6Export, Floor7Export, Floor8Export, Floor9Export } from '@/pages/floor-exports';
import FinancialDashboard from '@/pages/grabba/FinancialDashboard';
import PersonalFinance from '@/pages/grabba/PersonalFinance';
import PayrollManager from '@/pages/grabba/PayrollManager';
import AdvisorPenthouse from '@/pages/grabba/AdvisorPenthouse';
import AuditEnginePage from '@/pages/penthouse/AuditEnginePage';
import InstinctLog from '@/pages/grabba/InstinctLog';
import GrabbaNeighborhoodPerformance from '@/pages/grabba/GrabbaNeighborhoodPerformance';
import GrabbaClusterCommunications from '@/pages/grabba/GrabbaClusterCommunications';
import GrabbaClusterAnalytics from '@/pages/grabba/GrabbaClusterAnalytics';
import MemoryBackfill from '@/pages/grabba/MemoryBackfill';
import ChangeControlCenter from '@/pages/grabba/ChangeControlCenter';
import ChangeControlAudit from '@/pages/grabba/ChangeControlAudit';

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
    <RoleRouteGuard>
      <Layout>
        <Outlet />
      </Layout>
    </RoleRouteGuard>
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

/**
 * LandingRedirect — Shows public landing for unauthenticated, Dashboard for authenticated
 */
function LandingRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <LandingPage />;
  return <Navigate to="/" replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* PUBLIC ROUTES (No authentication required)                                   */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      
      {/* Public routes wrapped in PublicLayout (marketing nav + footer) */}
      <Route element={<PublicLayout />}>
        <Route path="/public" element={<LandingRedirect />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
      </Route>

      {/* Standalone public routes (own layouts) */}
      <Route path="/install" element={<InstallPwa />} />
      <Route path="/twl-landing" element={<TWLLanding />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/portal/login" element={<PortalLogin />} />
      <Route path="/portal/register" element={<PortalRegister />} />
      <Route path="/portal/driver/login" element={<DriverLogin />} />
      <Route path="/portal/biker/login" element={<BikerLogin />} />
      {/* Public Ambassador Application Form */}
      <Route path="/apply/ambassador" element={<AmbassadorApplication />} />
      {/* Public Invite Signup - Primary and fallback routes */}
      <Route path="/signup" element={<InviteSignup />} />
      <Route path="/invite/accept" element={<InviteSignup />} />
      <Route path="/invite/ambassador/:token" element={<AmbassadorInviteAccept />} />
      <Route path="/accept-invite" element={<Navigate to="/signup" replace />} />

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* PROTECTED ROUTES (Authentication required)                                   */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      <Route element={<ProtectedLayout />}>
        {/* Dashboard */}
        <Route path="/" element={<Dashboard />} />
        <Route path="/sidebar-test" element={<SidebarVisualTest />} />
        <Route path="/sidebar-debug" element={<SidebarDebug />} />

        {/* Security & Governance (Phase 2 - Military-Grade Hardening) */}
        <Route path="/security/console" element={<RequireRole allowedRoles={['owner', 'admin']} showLocked><SecurityConsole /></RequireRole>} />
        <Route path="/security/devices" element={<RequireRole allowedRoles={['owner', 'admin']} showLocked><SecurityConsole /></RequireRole>} />
        <Route path="/security/sessions" element={<RequireRole allowedRoles={['owner', 'admin']} showLocked><SecurityConsole /></RequireRole>} />
        <Route path="/security/users" element={<RequireRole allowedRoles={['owner', 'admin']} showLocked><UserManagementPage /></RequireRole>} />
        <Route path="/security/invitations" element={<RequireRole allowedRoles={['owner', 'admin']} showLocked><UserInvitations /></RequireRole>} />
        <Route path="/security/roles" element={<RequireRole allowedRoles={['owner', 'admin']} showLocked><RolesPermissionsPage /></RequireRole>} />
        <Route path="/security/audit" element={<RequireRole allowedRoles={['owner', 'admin']} showLocked><SecurityConsole /></RequireRole>} />
        <Route path="/security/ambassador-requests" element={<RequireRole allowedRoles={['owner', 'admin']} showLocked><AmbassadorRequests /></RequireRole>} />

        {/* Territory Control Center (Floor 0-2 visibility — read-only) */}
        <Route path="/territory" element={<RequireRole allowedRoles={['owner', 'admin', 'staff']} showLocked><TerritoryOverview /></RequireRole>} />
        <Route path="/territory/neighborhoods" element={<RequireRole allowedRoles={['owner', 'admin', 'staff']} showLocked><TerritoryNeighborhoods /></RequireRole>} />
        <Route path="/territory/tasks" element={<RequireRole allowedRoles={['owner', 'admin', 'staff']} showLocked><TerritoryTasks /></RequireRole>} />
        <Route path="/territory/candidates" element={<RequireRole allowedRoles={['owner', 'admin', 'staff']} showLocked><TerritoryCandidates /></RequireRole>} />
        <Route path="/territory/execute/scout" element={<RequireRole allowedRoles={['owner', 'admin', 'staff']} showLocked><ScoutConsole /></RequireRole>} />
        <Route path="/territory/execute/call" element={<RequireRole allowedRoles={['owner', 'admin', 'staff']} showLocked><CallConsole /></RequireRole>} />
        <Route path="/territory/execute/visit" element={<RequireRole allowedRoles={['owner', 'admin', 'staff']} showLocked><VisitConsole /></RequireRole>} />
        <Route path="/territory/promotions/pending" element={<RequireRole allowedRoles={['owner', 'admin']} showLocked><PromotionsPending /></RequireRole>} />
        <Route path="/territory/promotions/history" element={<RequireRole allowedRoles={['owner', 'admin']} showLocked><PromotionsHistory /></RequireRole>} />
        <Route path="/territory/ingestion" element={<RequireRole allowedRoles={['owner', 'admin']} showLocked><TerritoryIngestion /></RequireRole>} />
        <Route path="/territory/gap-intelligence" element={<RequireRole allowedRoles={['owner', 'admin', 'staff']} showLocked><TerritoryGapIntelligence /></RequireRole>} />
        <Route path="/territory/planning" element={<RequireRole allowedRoles={['owner', 'admin', 'staff']} showLocked><TerritoryPlanning /></RequireRole>} />
        <Route path="/territory/planning/history" element={<RequireRole allowedRoles={['owner', 'admin', 'staff']} showLocked><CommitmentHistory /></RequireRole>} />
        <Route path="/territory/ai-permissions" element={<RequireRole allowedRoles={['owner', 'admin', 'staff']} showLocked><AIPermissionsOverview /></RequireRole>} />
        <Route path="/territory/ai-permissions/neighborhoods" element={<RequireRole allowedRoles={['owner', 'admin', 'staff']} showLocked><AIPermissionsNeighborhoods /></RequireRole>} />
        <Route path="/territory/ai-permissions/actions" element={<RequireRole allowedRoles={['owner', 'admin', 'staff']} showLocked><AIPermissionsActions /></RequireRole>} />

        {/* Floor 9.4 — AI Violation & Denial Monitor */}
        <Route path="/territory/ai-violations" element={<RequireRole allowedRoles={['owner', 'admin']} showLocked><AIViolationsPage /></RequireRole>} />
        {/* Floor 10.1 — Human Review Queue */}
        <Route path="/territory/ai-review-queue" element={<RequireRole allowedRoles={['owner', 'admin']} showLocked><AIReviewQueuePage /></RequireRole>} />
        {/* Floor 11 — Territory Playbooks */}
        <Route path="/territory/playbooks" element={<RequireRole allowedRoles={['owner', 'admin']} showLocked><TerritoryPlaybooksPage /></RequireRole>} />

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
        <Route path="/comm-systems/comm-hub" element={<CommunicationHubPage />} />
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
        <Route path="/sell-through-analytics" element={<SellThroughAnalytics />} />
        <Route path="/brand-crm" element={<BrandCRMPage />} />
        <Route path="/stores/performance" element={<StorePerformance />} />
        <Route path="/stores/order" element={<StoreOrder />} />
        <Route path="/routes" element={<RoutesPage />} />
        <Route path="/routes/optimizer" element={<RouteOptimizer />} />
        <Route path="/routes/ops-center" element={<RouteOpsCenterEnhanced />} />
        <Route path="/routes/command-center" element={<OpsCommandCenter />} />
        <Route path="/route-ops-center" element={<RouteOpsCenterEnhanced />} />
        <Route path="/ops-command-center" element={<OpsCommandCenter />} />
        {/* Route Optimizer - Floor 4 Planning Intelligence */}
        <Route path="/route-optimizer" element={<RouteOptimizerPage />} />
        <Route path="/routes/:id" element={<RouteDetail />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/wholesale" element={<Wholesale />} />
        <Route path="/wholesale/marketplace" element={<WholesaleMarketplace />} />
        <Route path="/wholesale/fulfillment" element={<WholesaleFulfillment />} />
        <Route path="/wholesale/:id" element={<WholesalerDetail />} />
        <Route path="/wholesaler/:id" element={<WholesalerDetail />} />
        <Route path="/team" element={<Team />} />
        <Route path="/products" element={<Products />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/analytics/economics" element={<EconomicAnalytics />} />
        <Route path="/analytics/revenue-brain" element={<RevenueBrain />} />
        <Route path="/influencers" element={<Influencers />} />
        <Route path="/influencers/analytics" element={<InfluencerAnalyticsCenter />} />
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
        <Route path="/ambassadors" element={<AllAmbassadorsTable />} />
        <Route path="/ambassadors/command" element={<AmbassadorCommandDashboard />} />
        <Route path="/ambassador-regions" element={<AmbassadorRegionsPage />} />
        <Route path="/ambassador-payouts" element={<Floor8PayoutsPage />} />
        <Route path="/ambassadors/regions" element={<AmbassadorRegionsPage />} />
        <Route path="/ambassadors/payouts" element={<Floor8PayoutsPage />} />
        <Route path="/expansion" element={<Expansion />} />
        <Route path="/expansion/regions" element={<ExpansionRegions />} />
        <Route path="/expansion/heatmap" element={<ExpansionHeatmap />} />
        <Route path="/rewards" element={<Rewards />} />
        <Route path="/driver" element={<Navigate to="/delivery/driver" replace />} />
        <Route path="/drivers/leaderboard" element={<Leaderboard />} />
        <Route path="/drivers/payroll" element={<Payroll />} />
        <Route path="/ai/meta" element={<MetaAI />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/sales/prospects" element={<SalesProspects />} />
        <Route path="/sales/prospects/new" element={<SalesProspectNew />} />
        <Route path="/sales/prospects/:id" element={<SalesProspectDetail />} />
        <Route path="/sales/report" element={<SalesReport />} />
        <Route path="/ops/opportunity-radar" element={<OpportunityRadar />} />
        <Route path="/opportunities" element={<MasterOpportunities />} />
        <Route path="/payouts/ambassadors" element={<AmbassadorPayouts />} />
        <Route path="/payouts/bikers" element={<BikerPayouts />} />
        {/* Floor 5 - Finance & Orders */}
        <Route path="/floor5" element={<Floor5Dashboard />} />
        <Route path="/floor5/dashboard" element={<Floor5Dashboard />} />
        <Route path="/floor5/invoices" element={<BillingInvoices />} />
        <Route path="/floor5/billing" element={<BillingCenter />} />
        <Route path="/floor5/payroll" element={<Payroll />} />
        <Route path="/floor5/unpaid" element={<UnpaidAccounts />} />
        <Route path="/floor5/fulfillment" element={<WholesaleFulfillment />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/billing/center" element={<BillingCenter />} />
        <Route path="/billing-center" element={<BillingCenter />} />
        <Route path="/billing/invoices" element={<BillingInvoices />} />
        <Route path="/billing/invoices/new" element={<BillingInvoiceNew />} />
        <Route path="/billing/invoices/:id" element={<BillingInvoiceDetail />} />
        <Route path="/payroll" element={<Payroll />} />
        <Route path="/unpaid-accounts" element={<UnpaidAccounts />} />
        {/* Communication Center - Redirect to modular hub */}
        <Route path="/communication-center" element={<CommunicationHubLayout />} />

        {/* CRM - Global CRM with Blueprint System */}
        {/* Floor 1: Global CRM Hub - shows all businesses */}
        <Route path="/crm" element={<GlobalCRMDashboard />} />
        <Route path="/crm/add-business" element={<AddBusinessPage />} />
        <Route path="/crm/data" element={<CRMDataPage />} />
        <Route path="/crm/data/export" element={<CRMExportPage />} />
        <Route path="/crm/data/import" element={<CRMImportPage />} />
        <Route path="/crm/data/bulk-upload" element={<CRMBulkUpload />} />
        <Route path="/crm/data/backup" element={<CRMBackupPage />} />
        <Route path="/crm/settings" element={<CRMSettingsPage />} />
        <Route path="/crm/user-access" element={<CRMUserAccessPage />} />
        <Route path="/crm/accept-invite" element={<AcceptCRMInvite />} />
        <Route path="/crm/global" element={<GlobalCRMDashboard />} />
        <Route path="/crm/legacy" element={<GlobalCRM />} />
        
        {/* Business-scoped CRM routes - CANONICAL PATTERN: /crm/:businessSlug/* */}
        {/* CRMRouter handles legacy vs new CRM routing: Grabba → Legacy, Others → Blueprint */}
        <Route path="/crm/:businessSlug" element={<CRMRouter />} />
        
        {/* TopTier Partner CRM Routes */}
        <Route path="/crm/toptier-experience/partners" element={<TopTierPartnerDashboard />} />
        <Route path="/crm/toptier-experience/partners/all" element={<TopTierAllPartners />} />
        <Route path="/crm/toptier-experience/partners/new" element={<TopTierAddPartner />} />
        <Route path="/crm/toptier-experience/partner/new" element={<TopTierAddPartner />} />
        <Route path="/crm/toptier-experience/partners/states" element={<TopTierPartnersByState />} />
        <Route path="/crm/toptier-experience/partners/profile/:partnerId" element={<TopTierPartnerProfile />} />
        <Route path="/crm/toptier-experience/partners/profile/:partnerId/edit" element={<TopTierPartnerEdit />} />
        <Route path="/crm/toptier-experience/partners/profile/:partnerId/deals" element={<TopTierPartnerProfile />} />
        <Route path="/crm/toptier-experience/partners/profile/:partnerId/campaigns" element={<TopTierPartnerProfile />} />
        <Route path="/crm/toptier-experience/partners/profile/:partnerId/commissions" element={<TopTierPartnerProfile />} />
        <Route path="/crm/toptier-experience/partners/profile/:partnerId/interactions" element={<TopTierPartnerProfile />} />
        <Route path="/crm/toptier-experience/partners/profile/:partnerId/interactions/:interactionId" element={<TopTierInteractionDetail />} />
        <Route path="/crm/toptier-experience/partners/profile/:partnerId/contacts" element={<TopTierPartnerProfile />} />
        <Route path="/crm/toptier-experience/partners/profile/:partnerId/contacts/:contactId" element={<TopTierContactDetail />} />
        <Route path="/crm/toptier-experience/partners/profile/:partnerId/assets" element={<TopTierPartnerProfile />} />
        <Route path="/crm/toptier-experience/partners/profile/:partnerId/assets/:assetId" element={<TopTierAssetDetail />} />
        <Route path="/crm/toptier-experience/partners/profile/:partnerId/notes" element={<TopTierPartnerProfile />} />
        <Route path="/crm/toptier-experience/partners/profile/:partnerId/notes/:noteId" element={<TopTierNoteDetail />} />
        <Route path="/crm/toptier-experience/partners/profile/:partnerId/media" element={<TopTierPartnerProfile />} />
        <Route path="/crm/toptier-experience/partners/profile/:partnerId/media/:assetId" element={<TopTierAssetDetail />} />
        <Route path="/crm/toptier-experience/partners/:category" element={<TopTierPartnerCategoryPage />} />
        <Route path="/crm/toptier-experience/deals" element={<TopTierDeals />} />
        <Route path="/crm/toptier-experience/deals/new" element={<TopTierNewDeal />} />
        <Route path="/crm/toptier-experience/deals/:dealId" element={<TopTierDealDetail />} />
        <Route path="/crm/toptier-experience/campaigns/:campaignId" element={<TopTierCampaignDetail />} />
        <Route path="/crm/toptier-experience/bookings" element={<TopTierRecentBookings />} />
        <Route path="/crm/toptier-experience/bookings/new" element={<TopTierNewDeal />} />
        <Route path="/crm/toptier-experience/bookings/recent" element={<TopTierRecentBookings />} />
        <Route path="/crm/toptier-experience/requests" element={<TopTierCustomerRequests />} />
        <Route path="/crm/toptier-experience/requests/new" element={<TopTierCustomerRequests />} />
        <Route path="/crm/toptier-experience/requests/:requestId" element={<TopTierRequestDetail />} />
        <Route path="/crm/toptier-experience/assets/:assetId" element={<TopTierAssetDetail />} />
        
        {/* TopTier Analytics Pages */}
        <Route path="/crm/toptier-experience/analytics/deals" element={<TopTierAnalyticsDeals />} />
        <Route path="/crm/toptier-experience/analytics/revenue" element={<TopTierAnalyticsRevenue />} />
        <Route path="/crm/toptier-experience/analytics/commissions" element={<TopTierAnalyticsCommissions />} />
        
        {/* TopTier Company-wide Contacts */}
        <Route path="/crm/toptier-experience/contacts" element={<TopTierAllContacts />} />
        
        {/* TopTier Interactions Hub */}
        <Route path="/crm/toptier-experience/interactions" element={<TopTierInteractionsHub />} />
        <Route path="/crm/toptier-experience/interactions/:interactionId" element={<TopTierInteractionsHub />} />
        
        {/* TopTier Customer Module */}
        <Route path="/crm/toptier-experience/customers" element={<TopTierCustomers />} />
        <Route path="/crm/toptier-experience/customers/new" element={<TopTierNewCustomer />} />
        <Route path="/crm/toptier-experience/customers/vip" element={<TopTierVIPCustomers />} />
        <Route path="/crm/toptier-experience/customers/returning" element={<TopTierReturningCustomers />} />
        <Route path="/crm/toptier-experience/customers/newly-added" element={<TopTierNewCustomers />} />
        <Route path="/crm/toptier-experience/customers/bookings" element={<TopTierCustomerBookings />} />
        <Route path="/crm/toptier-experience/customers/value" element={<TopTierCustomerValue />} />
        <Route path="/crm/toptier-experience/customers/:customerId" element={<TopTierCustomerProfile />} />
        <Route path="/crm/toptier-experience/customers/:customerId/edit" element={<TopTierEditCustomer />} />
        
        {/* TopTier KPI Management */}
        <Route path="/crm/toptier-experience/kpis/manage" element={<TopTierKPIManagement />} />
        
        <Route path="/crm/:businessSlug/:entityType" element={<EntityListPage />} />
        <Route path="/crm/:businessSlug/:entityType/new" element={<EntityCreatePage />} />
        <Route path="/crm/:businessSlug/:entityType/:recordId" element={<EntityProfilePage />} />
        
        {/* Legacy/store-based CRM routes (redirect to business-scoped) */}
        <Route path="/crm/dashboard" element={<Navigate to="/crm" replace />} />
        <Route path="/crm/brand/:brandId" element={<CRMBrandPage />} />
        <Route path="/crm/brand/:brandId/store/:storeId" element={<CRMBrandStoreProfile />} />
        <Route path="/crm/business/:businessSlug" element={<Navigate to="/crm/:businessSlug" replace />} />
        
        {/* Legacy customer/contact routes */}
        <Route path="/crm/customers" element={<CRMCustomers />} />
        <Route path="/crm/customers/new" element={<CRMCustomerNew />} />
        <Route path="/crm/customers/import" element={<CRMCustomerImport />} />
        <Route path="/crm/customers/:id" element={<CRMCustomerDetail />} />
        <Route path="/crm/contacts" element={<CRMContacts />} />
        <Route path="/crm/contacts/:id" element={<CRMContactDetail />} />
        <Route path="/crm/store-contact/:id" element={<ContactProfile />} />
        <Route path="/crm/follow-ups" element={<CRMFollowUps />} />

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
        <Route path="/os/inventory/product-inventory" element={<ProductInventoryPage />} />
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
        <Route path="/os/inventory/tube-intelligence" element={<TubeIntelligencePage />} />

        <Route path="/os" element={<OSLayout />}>
          <Route
            path="product-conversions"
            element={
              <RequireRole allowedRoles={['admin']} showLocked>
                <ProductConversions />
              </RequireRole>
            }
          />
        </Route>

        {/* Legacy Invoice Repair - Admin Only, One-Time Tool */}
        <Route
          path="/admin/legacy-invoice-repair"
          element={
            <RequireRole allowedRoles={['admin']} showLocked>
              <LegacyInvoiceRepair />
            </RequireRole>
          }
        />

        {/* Marketplace Connection Pack - Dev Only, Admin/Owner */}
        <Route
          path="/admin/dev/marketplace-connection"
          element={
            <RequireRole allowedRoles={['admin', 'owner']} showLocked>
              <MarketplaceConnectionPage />
            </RequireRole>
          }
        />

        {/* Dynasty OS Business Units */}
        <Route path="/os/toptier" element={<TopTierDashboard />} />
        <Route path="/os/unforgettable" element={<UnforgettableDashboard />} />
        <Route path="/os/unforgettable/staff" element={<UnforgettableStaff />} />
        <Route path="/os/unforgettable/staff/new" element={<UnforgettableStaffNew />} />
        <Route path="/os/unforgettable/staff/categories" element={<UnforgettableStaffCategories />} />
        <Route path="/os/unforgettable/staff/:staffId" element={<UnforgettableStaffProfile />} />
        <Route path="/os/unforgettable/staff/:staffId/edit" element={<UnforgettableStaffEdit />} />
        <Route path="/os/unforgettable/staff/:staffId/venues" element={<UnforgettableStaffVenues />} />
        <Route path="/os/unforgettable/staff/:staffId/notes" element={<UnforgettableStaffNotes />} />
        <Route path="/os/unforgettable/staff/:staffId/call" element={<UnforgettableStaffCall />} />
        <Route path="/os/unforgettable/staff/:staffId/email" element={<UnforgettableStaffEmail />} />
        <Route path="/os/unforgettable/scheduling" element={<UnforgettableScheduling />} />
        <Route path="/os/unforgettable/scheduling/today" element={<UnforgettableSchedulingToday />} />
        <Route path="/os/unforgettable/scheduling/upcoming" element={<UnforgettableSchedulingUpcoming />} />
        <Route path="/os/unforgettable/scheduling/gaps" element={<UnforgettableSchedulingGaps />} />
        <Route path="/os/unforgettable/payroll" element={<UnforgettablePayroll />} />
        <Route path="/os/unforgettable/payroll/:staffId" element={<UnforgettablePayrollDetail />} />
        <Route path="/os/unforgettable/documents" element={<UnforgettableDocuments />} />
        <Route path="/os/unforgettable/documents/:documentId" element={<UnforgettableDocumentDetail />} />
        <Route path="/os/unforgettable/availability" element={<UnforgettableAvailability />} />
        <Route path="/os/unforgettable/performance" element={<UnforgettablePerformance />} />
        <Route path="/os/unforgettable/communications" element={<UnforgettableCommunications />} />
        <Route path="/os/unforgettable/ai-calling" element={<UnforgettableAICalling />} />
        <Route path="/os/unforgettable/ai-calling/:callId" element={<UnforgettableAICallDetail />} />
        <Route path="/os/unforgettable/onboarding" element={<UnforgettableOnboarding />} />
        <Route path="/os/unforgettable/customer-service" element={<UnforgettableCustomerService />} />
        <Route path="/os/unforgettable/media" element={<UnforgettableMedia />} />
        <Route path="/os/unforgettable/media/:mediaId" element={<UnforgettableMediaDetail />} />
        <Route path="/os/unforgettable/staff/:staffId/performance" element={<UnforgettableStaffPerformance />} />
        
        {/* Unforgettable Times CRM Routes */}
        <Route path="/crm/unforgettable_times_usa/event-halls" element={<UnforgettableEventHalls />} />
        <Route path="/crm/unforgettable_times_usa/event-halls/:hallId" element={<UnforgettableEventHallDetail />} />
        <Route path="/crm/unforgettable_times_usa/rentals" element={<UnforgettableRentals />} />
        <Route path="/crm/unforgettable_times_usa/influencers" element={<UnforgettableInfluencers />} />
        <Route path="/crm/unforgettable_times_usa/media" element={<UnforgettableMediaVault />} />
        <Route path="/crm/unforgettable_times_usa/party-suppliers" element={<UnforgettablePartySuppliers />} />
        <Route path="/crm/unforgettable_times_usa/gifts" element={<UnforgettableGifts />} />
        <Route path="/os/iclean" element={<ICleanDashboard />} />
        <Route path="/os/playboxxx" element={<PlayboxxxDashboard />} />
        <Route path="/os/special-needs" element={<SpecialNeedsDashboard />} />
        <Route path="/os/funding" element={<FundingDashboard />} />
        <Route path="/os/grants" element={<GrantsDashboard />} />
        <Route path="/os/wealth-engine" element={<WealthEngineDashboard />} />
        <Route path="/os/sports-betting" element={<Navigate to="/os/sports-betting/dashboard" replace />} />
        <Route path="/os/sports-betting/analytics" element={<Navigate to="/os/sports-betting/dashboard" replace />} />
        <Route path="/os/sports-betting/dashboard" element={<BettingDashboard />} />
        <Route path="/os/sports-betting/nba" element={<NBADailyBoard />} />
        <Route path="/os/sports-betting/line-intake" element={<LineIntake />} />
        <Route path="/os/sports-betting/simulation" element={<SimulationPage />} />
        <Route path="/os/sports-betting/parlay-lab" element={<ParlayLab />} />
        <Route path="/os/sports-betting/hedge-center" element={<HedgeCenter />} />
        <Route path="/os/sports-betting/internal" element={<OwnerInternal />} />
        <Route path="/os/sports-betting/stats-inspector" element={<StatsInspector />} />
        <Route path="/os/sports-betting/settings" element={<BettingSettings />} />
        <Route path="/os/sports-betting/workflow" element={<BettingWorkflow />} />
        <Route path="/os/sports-betting/platforms" element={<PlatformsDashboard />} />
        <Route path="/os/sports-betting/line-shopping" element={<LineShopping />} />
        <Route path="/os/sports-betting/entries" element={<EntriesList />} />
        <Route path="/os/sports-betting/entries/new" element={<PickEntryWizard />} />
        <Route path="/os/sports-betting/results" element={<BettingResultsPage />} />
        <Route path="/biker/home" element={<BikerDashboard />} />

        {/* Legacy payouts aliases (keep old links working) */}
        <Route path="/biker-payouts" element={<Navigate to="/delivery/payouts" replace />} />
        <Route path="/driver-payouts" element={<Navigate to="/delivery/payouts" replace />} />

        {/* Delivery & Logistics Department */}
        <Route path="/delivery" element={<DeliveryDashboard />} />
        <Route path="/delivery/dashboard" element={<DeliveryDashboard />} />
        <Route path="/delivery/deliveries" element={<DeliveriesBoard />} />
        <Route path="/delivery/multi-brand" element={<MultiBrandDeliveryPage />} />
        <Route path="/delivery/route-manager" element={<RouteManagerPage />} />
        <Route path="/delivery/routes/all" element={<AllRoutesPage />} />
        <Route path="/delivery/route-optimizer" element={<RouteOptimizerPage />} />
        <Route path="/delivery/route-ops" element={<DeliveryRouteOpsCenter />} />
        <Route path="/delivery/live-map" element={<LiveMapCommandCenter />} />
        <Route path="/delivery/autonomy-console" element={<AutonomyConsole />} />
        <Route path="/delivery/capacity" element={<DeliveryCapacityCommand />} />
        <Route path="/delivery-capacity" element={<Navigate to="/delivery/capacity" replace />} />
        <Route path="/delivery/drivers" element={<DriversManagement />} />
        <Route path="/delivery/drivers/:driverId" element={<DriverProfile />} />
        <Route path="/delivery/bikers" element={<BikersManagement />} />
        <Route path="/delivery/bikers/:bikerId" element={<BikerProfile />} />
        <Route path="/delivery/biker-tasks" element={<BikerTasks />} />
        <Route path="/delivery/locations" element={<LocationsManagement />} />
        <Route path="/delivery/payouts" element={<WorkerPayouts />} />
        <Route path="/delivery/debt" element={<DebtCollection />} />
        <Route path="/delivery/driver" element={<DriverOS />} />
        <Route path="/delivery/driver-home" element={<DriverHome />} />
        <Route path="/delivery/driver/routes-completed" element={<DriverRoutesCompleted />} />
        <Route path="/delivery/driver/stops-completed" element={<DriverStopsCompleted />} />
        <Route path="/delivery/driver/issues-reported" element={<DriverIssuesReported />} />
        <Route path="/delivery/my-route" element={<DeliveryMyRoute />} />
        <Route path="/delivery/my-route/:deliveryId" element={<DeliveryMyRoute />} />
        <Route path="/delivery/my-route-today" element={<MyRouteToday />} />
        <Route path="/delivery/dispatch" element={<DeliveryDispatchPage />} />
        <Route path="/delivery/store/:storeId" element={<DeliveryStoreProfile />} />
        <Route path="/delivery/routes/:routeId" element={<DeliveryRouteDetailPage />} />
        <Route path="/delivery/heatmap" element={<DeliveryHeatmapPage />} />
        <Route path="/delivery/issues/:issueId" element={<DeliveryIssueDetailPage />} />
        <Route path="/delivery/route-suggestions" element={<DeliveryRouteSuggestionsPage />} />
        {/* Catch-all for unknown /delivery/* paths - redirect to delivery dashboard */}
        <Route path="/delivery/*" element={<Navigate to="/delivery" replace />} />
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
        {/* Legacy route → redirect to canonical Penthouse location */}
        <Route path="/os/owner/accounting" element={<Navigate to="/penthouse/accounting" replace />} />

        {/* ═══ PENTHOUSE — Accounting OS (CANONICAL LOCATION) ═══ */}
        <Route path="/penthouse/accounting" element={
          <RequireRole allowedRoles={['admin']} showLocked>
            <OwnerAccountingOS />
          </RequireRole>
        } />

        {/* ═══ PENTHOUSE — Mission Control (Task OS) ═══ */}
        <Route path="/penthouse/missions" element={
          <RequireRole allowedRoles={['admin']} showLocked>
            <OwnerMissionControl />
          </RequireRole>
        } />

        {/* ═══ PENTHOUSE — Intelligent Audit Engine ═══ */}
        <Route path="/penthouse/audit-engine" element={
          <RequireRole allowedRoles={['admin']} showLocked>
            <AuditEnginePage />
          </RequireRole>
        } />

        {/* Legacy accounting routes → redirect to Penthouse */}
        <Route path="/grabba/personal-finance" element={<Navigate to="/penthouse/accounting" replace />} />
        <Route path="/grabba/financial-dashboard" element={<Navigate to="/penthouse/accounting" replace />} />
        <Route path="/accounting-os" element={<Navigate to="/penthouse/accounting" replace />} />

        {/* AI Workforce */}
        <Route path="/ai/workforce" element={<AIWorkforce />} />
      </Route>

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* PROTECTED ROUTES WITHOUT LAYOUT (Portal, special pages)                      */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      <Route element={<ProtectedNoLayout />}>
        {/* Communication Center - Full-screen floor with own layout (no main Layout wrapper) */}
        <Route path="/communication" element={<CommunicationHubLayout />}>
          {/* Default → Unified Inbox */}
          <Route index element={<Navigate to="/communication/unified-inbox" replace />} />
          
          {/* ═══ FLOOR 1: OPERATIONS HUB ═══ */}
          <Route path="unified-inbox" element={<UnifiedInboxV3Page />} />
          <Route path="auto-dialer" element={<AutoDialerPage />} />
          <Route path="manual-calls" element={<ManualCallPage />} />
          <Route path="manual-text" element={<ManualTextPage />} />
          <Route path="escalations" element={<EscalationsPage />} />
          <Route path="deals" element={<DealsSalesPage />} />
          <Route path="follow-ups" element={<FollowUpManagerPage />} />
          <Route path="voicemail-inbox" element={<VoicemailInboxPage />} />
          <Route path="missed-calls" element={<MissedCallsDashboardPage />} />
          <Route path="unresolved-queue" element={<UnresolvedCallsQueuePage />} />
          <Route path="field-submissions" element={<FieldSubmissionsPage />} />

          {/* ═══ FLOOR 2: AUTOMATION ENGINE ═══ */}
          <Route path="outbound-growth" element={<OutboundGrowthPage />} />
          <Route path="campaigns" element={<CampaignsPage />} />
          <Route path="ai-auto-text" element={<AIAutoTextPage />} />
          <Route path="messaging-hub" element={<MessagingHubPage />} />
          <Route path="personas" element={<PersonasPage />} />
          <Route path="call-flows" element={<CallFlowsPage />} />
          <Route path="playbooks" element={<PlaybooksManagement />} />

          {/* ═══ FLOOR 3: INTELLIGENCE ═══ */}
          <Route path="call-intelligence" element={<CallIntelligencePage />} />
          <Route path="heatmap" element={<HeatmapPage />} />
          <Route path="predictions" element={<PredictionsPage />} />
          <Route path="rep-performance" element={<RepPerformancePage />} />
          <Route path="revenue-intelligence" element={<DialerRevenueIntelligence />} />
          <Route path="optimization" element={<DialerOptimizationDashboard />} />
          <Route path="predictive-targeting" element={<DialerPredictiveTargeting />} />
          <Route path="engagement" element={<EngagementPage />} />
          <Route path="cost-dashboard" element={<DialerCostDashboard />} />
          <Route path="call-reasons" element={<CallReasonsPage />} />
          <Route path="dialer-integrity" element={<DialerIntegrityPage />} />
          <Route path="campaign-intelligence" element={<CampaignIntelligencePage />} />

          {/* ═══ FLOOR 4: VOICE SYSTEM ═══ */}
          <Route path="agents" element={<AgentsPage />} />
          <Route path="voice-matrix" element={<VoiceMatrixPage />} />
          <Route path="language" element={<LanguagePage />} />

          {/* ═══ FLOOR 5: SYSTEM CONTROL ═══ */}
          <Route path="settings" element={<CommSettingsPage />} />
          <Route path="phone-numbers" element={<PhoneNumbersSettingsPage />} />
          <Route path="business-numbers" element={<BusinessPhoneNumbersPage />} />
          <Route path="routing" element={<RoutingPage />} />
          <Route path="call-diagnostics" element={<CallSystemDiagnosticsPage />} />
          <Route path="dialer-health" element={<DialerHealthPage />} />
          <Route path="shadow-mode" element={<ShadowModePage />} />

          {/* ═══ LEGACY REDIRECTS — Safe, no broken links ═══ */}
          <Route path="inbox" element={<Navigate to="/communication/unified-inbox" replace />} />
          <Route path="bulk-dialer" element={<Navigate to="/communication/auto-dialer" replace />} />
          <Route path="ai-auto-dialer" element={<Navigate to="/communication/auto-dialer" replace />} />
          <Route path="live" element={<Navigate to="/communication/auto-dialer" replace />} />
          <Route path="live-panel" element={<Navigate to="/communication/auto-dialer" replace />} />
          <Route path="dialer" element={<Navigate to="/communication/auto-dialer" replace />} />
          <Route path="outbound-engine" element={<Navigate to="/communication/outbound-growth?tab=engine" replace />} />
          <Route path="outreach" element={<Navigate to="/communication/outbound-growth?tab=ai-outreach" replace />} />
          <Route path="autonomous-director" element={<Navigate to="/communication/outbound-growth?tab=director" replace />} />
          <Route path="cold-call-blast" element={<Navigate to="/communication/campaigns?tab=cold-blast" replace />} />
          <Route path="dialer-settings" element={<Navigate to="/communication/settings?tab=dialer" replace />} />
          <Route path="user-call-settings" element={<Navigate to="/communication/settings?tab=user" replace />} />
          <Route path="business-hours" element={<Navigate to="/communication/settings?tab=hours" replace />} />
          <Route path="after-hours" element={<Navigate to="/communication/settings?tab=afterhours" replace />} />
          <Route path="ai-call-agent" element={<Navigate to="/communication/agents?tab=ai-call-agent" replace />} />
          <Route path="dialer-start" element={<Navigate to="/communication/auto-dialer" replace />} />
          <Route path="dialer-stores" element={<Navigate to="/communication/auto-dialer" replace />} />
          <Route path="dialer-prospects" element={<Navigate to="/communication/auto-dialer" replace />} />
          <Route path="dialer-audience" element={<Navigate to="/communication/auto-dialer" replace />} />
          <Route path="dialer-console" element={<Navigate to="/communication/auto-dialer" replace />} />
          <Route path="dialer-history" element={<Navigate to="/communication/auto-dialer" replace />} />
          <Route path="campaign-wizard" element={<Navigate to="/communication/auto-dialer" replace />} />

          {/* Kept for now but not in sidebar */}
          <Route path="voice-library" element={<VoiceLibraryPage />} />
          <Route path="sms-dashboard" element={<CommunicationSMSDashboard />} />
          <Route path="executive-ai" element={<ExecutiveControlRoomPage />} />
        </Route>

        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/messages/:threadId" element={<MessagesPage />} />
        {/* Legacy route redirect to new delivery system */}
        <Route path="/routes/my-route" element={<Navigate to="/delivery/my-route" replace />} />
        <Route path="/my-route" element={<Navigate to="/delivery/my-route" replace />} />
        <Route path="/my-route/:deliveryId" element={<Navigate to="/delivery/my-route/:deliveryId" replace />} />
        {/* Driver OS redirects to delivery department */}
        <Route path="/driver/home" element={<Navigate to="/delivery/driver-home" replace />} />
        <Route path="/driver/my-route" element={<Navigate to="/delivery/my-route" replace />} />
        <Route path="/driver/my-route/:deliveryId" element={<Navigate to="/delivery/my-route/:deliveryId" replace />} />
        <Route path="/me/home" element={<WorkerHome />} />
        <Route path="/me/driver" element={<WorkerHome />} />
        <Route path="/operations/live-map" element={<LiveMapCommandCenter />} />
        <Route path="/live-map" element={<LiveMapCommandCenter />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/subscriptions" element={<Subscriptions />} />
        <Route path="/expansion/capacity" element={<DeliveryCapacity />} />

        {/* Grabba Financial (no layout, stays in ProtectedNoLayout) */}
        <Route path="/grabba/financial-dashboard" element={<FinancialDashboard />} />
        <Route path="/grabba/personal-finance" element={<PersonalFinance />} />
        <Route path="/grabba/payroll-manager" element={<PayrollManager />} />
        <Route path="/grabba/advisor-penthouse" element={<AdvisorPenthouse />} />
        <Route path="/grabba/instinct-log" element={<InstinctLog />} />
      </Route>

      {/* Portal Invite Landing — standalone, no layout, auth optional */}
      <Route path="/portal/invite/:token" element={<InviteLanding />} />

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* OPS/PORTAL ROUTES — Wrapped in OpsLayout (mobile-first + bottom nav)         */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      <Route element={<ProtectedRoute><OpsLayout /></ProtectedRoute>}>
        {/* Portal Routes */}
        <Route path="/portal" element={<RoleRouter />} />
        <Route path="/portal/home" element={<PortalHome />} />
        <Route path="/portal/onboarding" element={<PortalOnboarding />} />
        <Route path="/portal/driver/*" element={<DriverPortal />} />
        <Route path="/portal/biker/*" element={<BikerPortal />} />
        {/* Legacy ambassador route - redirect to new UI */}
        <Route path="/portal/ambassador" element={<Navigate to="/ambassador/dashboard" replace />} />
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
        <Route path="/portal/wholesaler/fulfillment" element={<WholesalerFulfillmentPage />} />
        <Route path="/portal/wholesaler/finance" element={<WholesalerFinance />} />
        <Route path="/portal/wholesaler/settings" element={<WholesalerSettings />} />
        <Route path="/portal/wholesaler/messages" element={<WholesalerMessages />} />
        <Route path="/portal/wholesaler/messages/:threadId" element={<WholesalerMessages />} />
        <Route path="/portal/wholesaler/team" element={<WholesalerTeam />} />
        <Route path="/portal/wholesaler/transactions" element={<WholesalerTransactionHistory />} />
        <Route path="/portal/wholesaler/inventory" element={<WholesalerInventoryWorkflow />} />
        <Route path="/portal/production" element={<ProductionPortal />} />
        <Route path="/portal/va" element={<VAPortal />} />
        <Route path="/portal/customer" element={<CustomerPortal />} />
        <Route path="/portal/invoices" element={<PortalInvoices />} />
        <Route path="/portal/invoices/:id" element={<PortalInvoiceDetail />} />
        <Route path="/portal/wholesale" element={<PortalWholesale />} />
        <Route path="/portal/influencer" element={<PortalInfluencer />} />
         <Route path="/portal/inbox" element={<OpsInboxPage />} />
         <Route path="/portal/inbox/:threadId" element={<OpsInboxThreadPage />} />
         <Route path="/portal/tasks" element={<OpsTaskListPage />} />
        <Route path="/portal/dashboard" element={<PortalDashboard />} />

        {/* NEW ROLE PORTALS - Enterprise-grade (/portals/*) */}
        <Route path="/portals/driver" element={<DriverPortalPage />} />
        <Route path="/portals/biker" element={<BikerPortalPage />} />
        <Route path="/portals/ambassador" element={<AmbassadorPortalPage />} />
        <Route path="/portals/store" element={<StorePortalPage />} />
        <Route path="/portals/wholesaler" element={<WholesalerPortalPage />} />
        <Route path="/portals/production" element={<ProductionPortalPage />} />
        <Route path="/portals/production/offices" element={<OfficesManagementPage />} />
        <Route path="/portals/production/staff" element={<StaffManagementPage />} />
        <Route path="/portals/production/conversion" element={<ConversionIntelligencePage />} />
        <Route path="/portals/production/supplier-yield" element={<SupplierYieldPage />} />
        <Route path="/portals/production/sales-velocity" element={<SalesVelocityPage />} />
        <Route path="/portals/production/war-room" element={<ProductionWarRoom />} />
        <Route path="/portals/production/task-timer" element={<WorkerTaskTimerPage />} />
        <Route path="/production/cost-history" element={<CostHistoryPage />} />
        <Route path="/production/supervisor-comparison" element={<SupervisorComparisonPage />} />
        <Route path="/portals/va" element={<VAPortalPage />} />
        <Route path="/portals/customer" element={<CustomerPortalPage />} />
        <Route path="/portals/national-wholesale" element={<NationalWholesalePortalPage />} />
        <Route path="/portals/admin" element={<MarketplaceAdminPortalPage />} />
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

      {/* Floor 9 — Change Control Center */}
      <Route path="/grabba/change-control" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee']}>
            <Layout><ChangeControlCenter /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/change-control/audit" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee']}>
            <Layout><ChangeControlAudit /></Layout>
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

      {/* Regulatory Compliance Center */}
      <Route path="/compliance" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin']}>
            <Layout><ComplianceCenter /></Layout>
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
      {/* Multi-Brand Delivery canonical route */}
      <Route path="/grabba/multi-brand-delivery" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee', 'driver', 'biker']}>
            <Layout><GrabbaLayout><MultiBrandDelivery /></GrabbaLayout></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/assignments" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee', 'driver', 'biker', 'warehouse', 'csr']}>
            <Layout><GrabbaLayout><GrabbaAssignments /></GrabbaLayout></Layout>
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
      <Route path="/grabba/ambassadors/:ambassadorId" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee', 'ambassador', 'csr', 'accountant']}>
            <Layout><GrabbaLayout><Floor8AmbassadorProfile /></GrabbaLayout></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassadors/:ambassadorId" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee', 'ambassador', 'csr', 'accountant']}>
            <Layout><GrabbaLayout><Floor8AmbassadorProfile /></GrabbaLayout></Layout>
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
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* FLOOR 9 - ENTERPRISE AI OPERATIONS                                          */}
      {/* Canonical route: /grabba/floor9                                              */}
      {/* Anti-404 shield: All unknown Floor 9 routes redirect to hub                  */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* LEGACY ROUTE HEALING - Redirect ALL old AI routes to Floor 9 canonical paths */}
      {/* No AI route may 404 - all redirect to /grabba/floor9 or appropriate subpage   */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      
      {/* Direct Floor 9 legacy paths */}
      <Route path="/grabba/ai-operations" element={<Navigate to="/grabba/floor9" replace />} />
      <Route path="/grabba/ai-operations/*" element={<Navigate to="/grabba/floor9" replace />} />
      <Route path="/floor9" element={<Navigate to="/grabba/floor9" replace />} />
      <Route path="/floor9/*" element={<Navigate to="/grabba/floor9" replace />} />
      <Route path="/ai-operations" element={<Navigate to="/grabba/floor9" replace />} />
      <Route path="/ai-operations/*" element={<Navigate to="/grabba/floor9" replace />} />
      
      {/* Legacy AI routes - redirect to Floor 9 canonical structure */}
      <Route path="/grabba/ai-routines" element={<Navigate to="/grabba/floor9/playbooks" replace />} />
      <Route path="/grabba/ai-playbooks" element={<Navigate to="/grabba/floor9/playbooks" replace />} />
      <Route path="/grabba/ai-insights" element={<Navigate to="/grabba/floor9/results" replace />} />
      <Route path="/grabba/routines" element={<Navigate to="/grabba/floor9/playbooks" replace />} />
      <Route path="/grabba/instinct-log" element={<Navigate to="/grabba/floor9/instinct-log" replace />} />
      <Route path="/grabba/action-queue" element={<Navigate to="/grabba/floor9/action-queue" replace />} />
      <Route path="/grabba/ai-predictions" element={<Navigate to="/grabba/floor9/predictions" replace />} />
      <Route path="/ai-predictions" element={<Navigate to="/grabba/floor9/predictions" replace />} />
      <Route path="/predictions" element={<Navigate to="/grabba/floor9/predictions" replace />} />
      <Route path="/grabba/ai-alerts" element={<Navigate to="/grabba/floor9/alerts" replace />} />
      <Route path="/ai-alerts" element={<Navigate to="/grabba/floor9/alerts" replace />} />
      <Route path="/alerts" element={<Navigate to="/grabba/floor9/alerts" replace />} />
      <Route path="/grabba/ai-tasks" element={<Navigate to="/grabba/floor9/tasks" replace />} />
      <Route path="/ai-tasks" element={<Navigate to="/grabba/floor9/tasks" replace />} />
      <Route path="/tasks" element={<Navigate to="/grabba/floor9/tasks" replace />} />
      
      {/* Deep legacy paths - comprehensive healing */}
      <Route path="/ai/*" element={<Navigate to="/grabba/floor9" replace />} />
      <Route path="/operations/ai" element={<Navigate to="/grabba/floor9" replace />} />
      <Route path="/operations/ai/*" element={<Navigate to="/grabba/floor9" replace />} />
      
      {/* Floor 9 - Canonical Hub Route */}
      <Route path="/grabba/floor9" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'owner']} showLocked>
            <Layout><GrabbaLayout><Floor9Hub /></GrabbaLayout></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      
      {/* Floor 9 - Subpages with Anti-404 Router */}
      <Route path="/grabba/floor9/*" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'owner']} showLocked>
            <Layout><GrabbaLayout><Floor9Router /></GrabbaLayout></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />

      {/* Floor Export & Analytics Pages */}
      <Route path="/grabba/export/command" element={
        <ProtectedRoute><RequireRole allowedRoles={['admin', 'owner']} showLocked><Layout><GrabbaLayout><CommandExport /></GrabbaLayout></Layout></RequireRole></ProtectedRoute>
      } />
      <Route path="/grabba/export/floor1" element={
        <ProtectedRoute><RequireRole allowedRoles={['admin', 'owner', 'employee']} showLocked><Layout><GrabbaLayout><Floor1Export /></GrabbaLayout></Layout></RequireRole></ProtectedRoute>
      } />
      <Route path="/grabba/export/floor2" element={
        <ProtectedRoute><RequireRole allowedRoles={['admin', 'owner', 'employee']} showLocked><Layout><GrabbaLayout><Floor2Export /></GrabbaLayout></Layout></RequireRole></ProtectedRoute>
      } />
      <Route path="/grabba/export/floor3" element={
        <ProtectedRoute><RequireRole allowedRoles={['admin', 'owner', 'employee']} showLocked><Layout><GrabbaLayout><Floor3Export /></GrabbaLayout></Layout></RequireRole></ProtectedRoute>
      } />
      <Route path="/grabba/export/floor4" element={
        <ProtectedRoute><RequireRole allowedRoles={['admin', 'owner', 'employee']} showLocked><Layout><GrabbaLayout><Floor4Export /></GrabbaLayout></Layout></RequireRole></ProtectedRoute>
      } />
      <Route path="/grabba/export/floor5" element={
        <ProtectedRoute><RequireRole allowedRoles={['admin', 'owner', 'employee']} showLocked><Layout><GrabbaLayout><Floor5Export /></GrabbaLayout></Layout></RequireRole></ProtectedRoute>
      } />
      <Route path="/grabba/export/floor6" element={
        <ProtectedRoute><RequireRole allowedRoles={['admin', 'owner', 'employee']} showLocked><Layout><GrabbaLayout><Floor6Export /></GrabbaLayout></Layout></RequireRole></ProtectedRoute>
      } />
      <Route path="/grabba/export/floor7" element={
        <ProtectedRoute><RequireRole allowedRoles={['admin', 'owner', 'employee']} showLocked><Layout><GrabbaLayout><Floor7Export /></GrabbaLayout></Layout></RequireRole></ProtectedRoute>
      } />
      <Route path="/grabba/export/floor8" element={
        <ProtectedRoute><RequireRole allowedRoles={['admin', 'owner', 'employee']} showLocked><Layout><GrabbaLayout><Floor8Export /></GrabbaLayout></Layout></RequireRole></ProtectedRoute>
      } />
      <Route path="/grabba/export/floor9" element={
        <ProtectedRoute><RequireRole allowedRoles={['admin', 'owner']} showLocked><Layout><GrabbaLayout><Floor9Export /></GrabbaLayout></Layout></RequireRole></ProtectedRoute>
      } />

      {/* Ambassador Portal OS */}
      <Route path="/ambassador/dashboard" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <Layout><AmbassadorDashboard /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/stores" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <Layout><AmbassadorStoresList /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/wholesalers" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <Layout><AmbassadorWholesalersList /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/stores/:id" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <Layout><StoreDetail /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/wholesalers/:id" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <Layout><WholesalerProfilePage /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/influencers/:id" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <Layout><InfluencerProfilePage /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/ambassadors/:id" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <Layout><AmbassadorProfilePage /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/orders" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <Layout><AmbassadorOrders /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/purchases" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <Layout><AmbassadorPurchases /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/sell-through" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <Layout><AmbassadorSellThrough /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/profit" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <Layout><AmbassadorProfitDashboard /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/routes" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <Layout><AmbassadorRoutes /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/leads" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <Layout><AmbassadorLeads /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      {/* Scoped pipeline route - view another ambassador's pipeline */}
      <Route path="/ambassador/:ambassadorId/leads" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <Layout><AmbassadorLeads /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/communications" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <Layout><AmbassadorCommunications /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/invites" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <Layout><AmbassadorInvites /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/recruitment" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <Layout><AmbassadorRecruitmentLeads /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/request-ambassador" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <Layout><AmbassadorRequestAmbassador /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/commissions" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <Layout><AmbassadorCommissions /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/disputes" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <Layout><AmbassadorDisputes /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/disputes/:id" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <Layout><AmbassadorDisputeDetail /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />

      {/* Connected Profile Pages */}
      <Route path="/profile/ambassador/:id" element={<ProtectedRoute><Layout><AmbassadorProfilePage /></Layout></ProtectedRoute>} />
      <Route path="/profile/wholesaler/:id" element={<ProtectedRoute><Layout><WholesalerProfilePage /></Layout></ProtectedRoute>} />
      <Route path="/profile/store/:id" element={<ProtectedRoute><Layout><StoreDetail /></Layout></ProtectedRoute>} />
      <Route path="/profile/influencer/:id" element={<ProtectedRoute><Layout><InfluencerProfilePage /></Layout></ProtectedRoute>} />

      {/* Admin Disputes */}
      <Route path="/admin/disputes" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin']}>
            <Layout><AdminDisputesQueue /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/admin/disputes/:id" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin']}>
            <Layout><AdminDisputeDetail /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />

      {/* Admin Overrides */}
      <Route path="/admin/overrides" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin']}>
            <AdminOverridesPage />
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/admin/overrides/:id" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin']}>
            <AdminOverrideDetailPage />
          </RequireRole>
        </ProtectedRoute>
      } />

      {/* Admin Ambassador Invite Governance */}
      <Route path="/admin/ambassador-invites" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'owner']}>
            <Layout><AmbassadorInviteGovernance /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />

      {/* Admin Payouts */}
      <Route path="/admin/payouts" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin']}>
            <Layout><AdminPayoutsPage /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/admin/payouts/:batchId" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin']}>
            <Layout><AdminPayoutDetailPage /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />

      {/* Marketplace Vendor Payouts */}
      <Route path="/admin/marketplace-payouts" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['owner', 'admin']}>
            <Layout><AdminMarketplacePayoutsPage /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />

      {/* Marketplace Control Tower */}
      <Route path="/admin/marketplace-control" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['owner', 'admin']}>
            <Layout><MarketplaceControlTowerPage /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />

      {/* SMS System Tests - Admin Only */}
      <Route path="/admin/sms-system-tests" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'owner']}>
            <Layout><SmsSystemTests /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />

      {/* Ambassador Payouts */}
      <Route path="/ambassador/payouts" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <Layout><AmbassadorPayoutsPage /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/payouts/:itemId" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <Layout><AmbassadorPayoutStatementPage /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/settings/payouts" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <Layout><AmbassadorPayoutSettingsPage /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      {/* Admin Reports */}
      <Route path="/admin/reports/financial" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin']}>
            <Layout><FinancialReportsPage /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/admin/reports/ambassadors" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin']}>
            <Layout><AmbassadorReportsPage /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/admin/reports/stores" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin']}>
            <Layout><StoreReportsPage /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/admin/reports/tax" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin']}>
            <Layout><TaxReportsPage /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/admin/reports/payouts" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin']}>
            <Layout><PayoutReportsPage /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />

      {/* Admin Deleted Records OS */}
      <Route path="/admin/deleted-records" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'owner']}>
            <Layout><DeletedRecords /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />

      {/* QA Command Center - Production Readiness */}
      <Route path="/admin/qa-command-center" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'owner']}>
            <Layout><QACommandCenter /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />

      {/* Admin Ambassador Applications */}
      <Route path="/admin/ambassador-applications" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'owner']}>
            <Layout><AmbassadorApplications /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />

      {/* Ambassador Reports */}
      <Route path="/ambassador/reports/earnings" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <Layout><AmbassadorEarningsPage /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
