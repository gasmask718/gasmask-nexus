/**
 * AppRoutes - Clean nested route structure for Dynasty OS
 * Uses React Router nested routes with Layout wrapper
 * Performance: ALL page components are lazy-loaded
 */
import { lazy, Suspense } from 'react';
import { Routes, Route, Outlet, Navigate } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import { RoleRouteGuard } from '@/components/security/RoleRouteGuard';
import { RequireRole } from '@/components/security/RequireRole';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Layouts — kept static (used as wrappers, always needed)
import PublicLayout from '@/layouts/PublicLayout';
import OpsLayout from '@/layouts/OpsLayout';
import { GrabbaLayout } from '@/components/grabba/GrabbaLayout';

// Suspense fallback spinner
const PageLoader = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

// ═══════════════════════════════════════════════════════════════════════
// LAZY IMPORTS — Every page is code-split
// ═══════════════════════════════════════════════════════════════════════

// Public pages
const LandingPage = lazy(() => import('@/pages/public/LandingPage'));
const AboutPage = lazy(() => import('@/pages/public/AboutPage'));
const ContactPage = lazy(() => import('@/pages/public/ContactPage'));
const Auth = lazy(() => import('@/pages/Auth'));
const Shop = lazy(() => import('@/pages/Shop'));
const ShopifyStore = lazy(() => import('@/pages/ShopifyStore'));
const Cart = lazy(() => import('@/pages/Cart'));
const Checkout = lazy(() => import('@/pages/Checkout'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const TWLLanding = lazy(() => import('@/pages/TWLLanding'));
const PortalLogin = lazy(() => import('@/pages/portal/PortalLogin'));
const PortalRegister = lazy(() => import('@/pages/portal/PortalRegister'));
const DriverLogin = lazy(() => import('@/pages/portal/DriverLogin'));
const BikerLogin = lazy(() => import('@/pages/portal/BikerLogin'));
const InviteSignup = lazy(() => import('@/pages/auth/InviteSignup'));
const UserInvitations = lazy(() => import('@/pages/security/UserInvitations'));
const InviteLanding = lazy(() => import('@/pages/portal/InviteLanding'));
const InstallPwa = lazy(() => import('@/pages/InstallPwa'));

// Protected pages
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Stores = lazy(() => import('@/pages/Stores'));
const StoreDetail = lazy(() => import('@/pages/StoreDetail'));
const RoutesPage = lazy(() => import('@/pages/Routes'));
const RouteDetail = lazy(() => import('@/pages/RouteDetail'));
const MapPage = lazy(() => import('@/pages/Map'));
const BatchImport = lazy(() => import('@/pages/BatchImport'));
const Driver = lazy(() => import('@/pages/Driver'));
const Wholesale = lazy(() => import('@/pages/Wholesale'));
const WholesaleMarketplace = lazy(() => import('@/pages/WholesaleMarketplace'));
const Team = lazy(() => import('@/pages/Team'));
const Products = lazy(() => import('@/pages/Products'));
const Analytics = lazy(() => import('@/pages/Analytics'));
const Influencers = lazy(() => import('@/pages/Influencers'));
const Missions = lazy(() => import('@/pages/Missions'));
const InfluencerCampaigns = lazy(() => import('@/pages/InfluencerCampaigns'));
const ExecutiveReports = lazy(() => import('@/pages/ExecutiveReports'));
const Territories = lazy(() => import('@/pages/Territories'));
const TerritoryOverview = lazy(() => import('@/pages/territory/TerritoryOverview'));
const TerritoryNeighborhoods = lazy(() => import('@/pages/territory/TerritoryNeighborhoods'));
const TerritoryTasks = lazy(() => import('@/pages/territory/TerritoryTasks'));
const TerritoryCandidates = lazy(() => import('@/pages/territory/TerritoryCandidates'));
const ScoutConsole = lazy(() => import('@/pages/territory/ScoutConsole'));
const CallConsole = lazy(() => import('@/pages/territory/CallConsole'));
const VisitConsole = lazy(() => import('@/pages/territory/VisitConsole'));
const PromotionsPending = lazy(() => import('@/pages/territory/PromotionsPending'));
const PromotionsHistory = lazy(() => import('@/pages/territory/PromotionsHistory'));
const TerritoryIngestion = lazy(() => import('@/pages/territory/TerritoryIngestion'));
const TerritoryGapIntelligence = lazy(() => import('@/pages/territory/TerritoryGapIntelligence'));
const TerritoryPlanning = lazy(() => import('@/pages/territory/TerritoryPlanning'));
const CommitmentHistory = lazy(() => import('@/pages/territory/CommitmentHistory'));
const AIPermissionsOverview = lazy(() => import('@/pages/territory/AIPermissionsOverview'));
const AIPermissionsNeighborhoods = lazy(() => import('@/pages/territory/AIPermissionsNeighborhoods'));
const AIPermissionsActions = lazy(() => import('@/pages/territory/AIPermissionsActions'));
const AIViolationsPage = lazy(() => import('@/pages/territory/AIViolationsPage'));
const AIReviewQueuePage = lazy(() => import('@/pages/territory/AIReviewQueuePage'));
const TerritoryPlaybooksPage = lazy(() => import('@/pages/territory/TerritoryPlaybooksPage'));
const RevenueBrain = lazy(() => import('@/pages/RevenueBrain'));
const OpportunityRadar = lazy(() => import('@/pages/OpportunityRadar'));
const MasterOpportunities = lazy(() => import('@/pages/MasterOpportunities'));
const MissionsHQ = lazy(() => import('@/pages/MissionsHQ'));
const Communications = lazy(() => import('@/pages/Communications'));
const Templates = lazy(() => import('@/pages/Templates'));
const Reminders = lazy(() => import('@/pages/Reminders'));
const InfluencerDetail = lazy(() => import('@/pages/InfluencerDetail'));
const InfluencerAnalyticsCenter = lazy(() => import('@/pages/InfluencerAnalyticsCenter'));
const WholesalerDetail = lazy(() => import('@/pages/grabba/WholesalerProfile'));
const WorkerHome = lazy(() => import('@/pages/WorkerHome'));
const AutomationSettings = lazy(() => import('@/pages/AutomationSettings'));
const Training = lazy(() => import('@/pages/Training'));
const Ambassadors = lazy(() => import('@/pages/Ambassadors'));

// Ambassador pages (barrel import → individual lazy)
const AmbassadorDashboard = lazy(() => import('@/pages/ambassador').then(m => ({ default: m.AmbassadorDashboard })));
const AmbassadorStoreProfile = lazy(() => import('@/pages/ambassador').then(m => ({ default: m.AmbassadorStoreProfile })));
const AmbassadorStoresList = lazy(() => import('@/pages/ambassador').then(m => ({ default: m.AmbassadorStoresList })));
const AmbassadorWholesalersList = lazy(() => import('@/pages/ambassador').then(m => ({ default: m.AmbassadorWholesalersList })));
const AmbassadorCommissions = lazy(() => import('@/pages/ambassador').then(m => ({ default: m.AmbassadorCommissions })));
const AmbassadorRoutes = lazy(() => import('@/pages/ambassador').then(m => ({ default: m.AmbassadorRoutes })));
const AmbassadorOrders = lazy(() => import('@/pages/ambassador').then(m => ({ default: m.AmbassadorOrders })));
const AmbassadorCommunications = lazy(() => import('@/pages/ambassador').then(m => ({ default: m.AmbassadorCommunications })));
const AmbassadorLeads = lazy(() => import('@/pages/ambassador').then(m => ({ default: m.AmbassadorLeads })));
const AmbassadorDisputes = lazy(() => import('@/pages/ambassador').then(m => ({ default: m.AmbassadorDisputes })));
const AmbassadorDisputeDetail = lazy(() => import('@/pages/ambassador').then(m => ({ default: m.AmbassadorDisputeDetail })));
const AmbassadorPurchases = lazy(() => import('@/pages/ambassador').then(m => ({ default: m.AmbassadorPurchases })));
const AmbassadorSellThrough = lazy(() => import('@/pages/ambassador').then(m => ({ default: m.AmbassadorSellThrough })));
const AmbassadorProfitDashboard = lazy(() => import('@/pages/ambassador').then(m => ({ default: m.AmbassadorProfitDashboard })));
const AmbassadorInvites = lazy(() => import('@/pages/ambassador').then(m => ({ default: m.AmbassadorInvites })));
const AmbassadorRecruitmentLeads = lazy(() => import('@/pages/ambassador').then(m => ({ default: m.AmbassadorRecruitmentLeads })));
const AmbassadorRequestAmbassador = lazy(() => import('@/pages/ambassador/AmbassadorRequestAmbassador'));
const AmbassadorRequests = lazy(() => import('@/pages/security/AmbassadorRequests'));
const AmbassadorInviteAccept = lazy(() => import('@/pages/invite/AmbassadorInviteAccept'));

// Brandaro pages
const PublicProposalPage = lazy(() => import('@/pages/brandaro/PublicProposalPage'));
const ClientDemoViewPage = lazy(() => import('@/pages/brandaro/ClientDemoViewPage'));
const CEODashboardPage = lazy(() => import('@/pages/brandaro/CEODashboardPage'));
const RetentionDashboardPage = lazy(() => import('@/pages/brandaro/RetentionDashboardPage'));
const VACommandCenterPage = lazy(() => import('@/pages/brandaro/VACommandCenterPage'));
const LeadDatabasePage = lazy(() => import('@/pages/brandaro/LeadDatabasePage'));
const CRMPipelinePage = lazy(() => import('@/pages/brandaro/CRMPipelinePage'));
const BrandaroInboxPage = lazy(() => import('@/pages/brandaro/InboxPage'));
const BrandaroPhoneNumbersPage = lazy(() => import('@/pages/brandaro/PhoneNumbersPage'));
const CallingOpsPage = lazy(() => import('@/pages/brandaro/CallingOpsPage'));
const RevenueAnalyticsPage = lazy(() => import('@/pages/brandaro/RevenueAnalyticsPage'));
const ClientReportingPage = lazy(() => import('@/pages/brandaro/ClientReportingPage'));
const AdsEnginePage = lazy(() => import('@/pages/brandaro/AdsEnginePage'));
const GoogleDominationPage = lazy(() => import('@/pages/brandaro/GoogleDominationPage'));
const OptimizationEnginePage = lazy(() => import('@/pages/brandaro/OptimizationEnginePage'));
const CompetitorTakeoverPage = lazy(() => import('@/pages/brandaro/CompetitorTakeoverPage'));
const CloserAIPage = lazy(() => import('@/pages/brandaro/CloserAIPage'));
const VADashboardPage = lazy(() => import('@/pages/brandaro/VADashboardPage'));
const VAManagerPage = lazy(() => import('@/pages/brandaro/VAManagerPage'));
const VARosterPage = lazy(() => import('@/pages/brandaro/VARosterPage'));
const AIDistributionPage = lazy(() => import('@/pages/brandaro/AIDistributionPage'));
const BrandaroHubLayout = lazy(() => import('@/pages/brandaro/BrandaroHubLayout'));
const BrandaroWarRoom = lazy(() => import('@/pages/brandaro/BrandaroWarRoom'));
const FollowUpEnginePage = lazy(() => import('@/pages/brandaro/FollowUpEnginePage'));
const ProposalBuilderPage = lazy(() => import('@/pages/brandaro/ProposalBuilderPage'));
const BuildPipelinePage = lazy(() => import('@/pages/brandaro/BuildPipelinePage'));
const ResultEnginePage = lazy(() => import('@/pages/brandaro/ResultEnginePage'));
const CampaignManagerPage = lazy(() => import('@/pages/brandaro/CampaignManagerPage'));
const ReviewQueuePage = lazy(() => import('@/pages/brandaro/ReviewQueuePage'));
const VAWorkspacePage = lazy(() => import('@/pages/brandaro/VAWorkspacePage'));
const VAPerformancePage = lazy(() => import('@/pages/brandaro/VAPerformancePage'));
const LeadDiscoveryPage = lazy(() => import('@/pages/brandaro/LeadDiscoveryPage'));
const LeadQualificationPage = lazy(() => import('@/pages/brandaro/LeadQualificationPage'));
const DemoEnginePage = lazy(() => import('@/pages/brandaro/DemoEnginePage'));
const ScoutAgentPage = lazy(() => import('@/pages/brandaro/ScoutAgentPage'));
const ProductionPipelinePage = lazy(() => import('@/pages/brandaro/ProductionPipelinePage'));
const ClientPortalPage = lazy(() => import('@/pages/brandaro/ClientPortalPage'));
const CanvaAssetsPage = lazy(() => import('@/pages/brandaro/CanvaAssetsPage'));
const CanvaTemplatesPage = lazy(() => import('@/pages/brandaro/CanvaTemplatesPage'));
const AmbassadorInviteGovernance = lazy(() => import('@/pages/admin/AmbassadorInviteGovernance'));

// Profile pages
const AmbassadorProfilePage = lazy(() => import('@/pages/profile').then(m => ({ default: m.AmbassadorProfilePage })));
const WholesalerProfilePage = lazy(() => import('@/pages/profile').then(m => ({ default: m.WholesalerProfilePage })));
const StoreProfilePage = lazy(() => import('@/pages/profile').then(m => ({ default: m.StoreProfilePage })));
const InfluencerProfilePage = lazy(() => import('@/pages/profile').then(m => ({ default: m.InfluencerProfilePage })));

// Floor 8
const AmbassadorCommandDashboard = lazy(() => import('@/pages/floor8').then(m => ({ default: m.AmbassadorCommandDashboard })));
const AllAmbassadorsTable = lazy(() => import('@/pages/floor8').then(m => ({ default: m.AllAmbassadorsTable })));
const Floor8AmbassadorProfile = lazy(() => import('@/pages/floor8').then(m => ({ default: m.AmbassadorProfilePage })));
const Floor8PayoutsPage = lazy(() => import('@/pages/floor8').then(m => ({ default: m.AmbassadorPayoutsPage })));
const AmbassadorRegionsPage = lazy(() => import('@/pages/floor8').then(m => ({ default: m.AmbassadorRegionsPage })));
const Floor8InfluencersPage = lazy(() => import('@/pages/floor8').then(m => ({ default: m.InfluencersPage })));

// Admin
const AdminDisputesQueue = lazy(() => import('@/pages/admin/disputes').then(m => ({ default: m.AdminDisputesQueue })));
const AdminDisputeDetail = lazy(() => import('@/pages/admin/disputes').then(m => ({ default: m.AdminDisputeDetail })));
const AdminOverridesPage = lazy(() => import('@/pages/admin/overrides').then(m => ({ default: m.AdminOverridesPage })));
const AdminOverrideDetailPage = lazy(() => import('@/pages/admin/overrides').then(m => ({ default: m.AdminOverrideDetailPage })));
const AdminPayoutsPage = lazy(() => import('@/pages/admin/payouts').then(m => ({ default: m.AdminPayoutsPage })));
const AdminPayoutDetailPage = lazy(() => import('@/pages/admin/payouts').then(m => ({ default: m.AdminPayoutDetailPage })));
const AdminMarketplacePayoutsPage = lazy(() => import('@/pages/admin/marketplace-payouts').then(m => ({ default: m.AdminMarketplacePayoutsPage })));
const MarketplaceControlTowerPage = lazy(() => import('@/pages/admin/marketplace-control').then(m => ({ default: m.MarketplaceControlTowerPage })));
const FinancialReportsPage = lazy(() => import('@/pages/admin/reports').then(m => ({ default: m.FinancialReportsPage })));
const AmbassadorReportsPage = lazy(() => import('@/pages/admin/reports').then(m => ({ default: m.AmbassadorReportsPage })));
const StoreReportsPage = lazy(() => import('@/pages/admin/reports').then(m => ({ default: m.StoreReportsPage })));
const TaxReportsPage = lazy(() => import('@/pages/admin/reports').then(m => ({ default: m.TaxReportsPage })));
const PayoutReportsPage = lazy(() => import('@/pages/admin/reports').then(m => ({ default: m.PayoutReportsPage })));
const DeletedRecords = lazy(() => import('@/pages/admin/DeletedRecords'));
const QACommandCenter = lazy(() => import('@/pages/admin/qa/QACommandCenter'));
const AmbassadorApplications = lazy(() => import('@/pages/admin/AmbassadorApplications'));
const SmsSystemTests = lazy(() => import('@/pages/admin/SmsSystemTests'));
const AmbassadorApplication = lazy(() => import('@/pages/apply/AmbassadorApplication'));

// VA Portal
const VAAuthPage = lazy(() => import('@/pages/va/VAAuthPage'));
const VADashboard = lazy(() => import('@/pages/va/VADashboard'));
const VAProfilePage = lazy(() => import('@/pages/va/VAProfilePage'));
const AdminNumbersPage = lazy(() => import('@/pages/va/AdminNumbersPage'));
const PayInvoicePage = lazy(() => import('@/pages/va/PayInvoicePage'));
const AdminLeaderboardPage = lazy(() => import('@/pages/admin/AdminLeaderboard'));
const AdminCallReviewPage = lazy(() => import('@/pages/admin/AdminCallReview'));
const AdminVAMonitorPage = lazy(() => import('@/pages/admin/AdminVAMonitor'));
const AdminDNCManagerPage = lazy(() => import('@/pages/admin/AdminDNCManager'));
const AmbassadorLogin = lazy(() => import('@/pages/ambassador/AmbassadorLogin'));
const AmbassadorSetPassword = lazy(() => import('@/pages/ambassador/AmbassadorSetPassword'));
const UTAmbassadorDashboard = lazy(() => import('@/pages/ut-ambassador/UTAmbassadorDashboard'));
const AmbassadorEarningsPage = lazy(() => import('@/pages/ambassador/reports').then(m => ({ default: m.AmbassadorEarningsPage })));
const AmbassadorPayoutsPage = lazy(() => import('@/pages/ambassador/payouts').then(m => ({ default: m.AmbassadorPayoutsPage })));
const AmbassadorPayoutStatementPage = lazy(() => import('@/pages/ambassador/payouts').then(m => ({ default: m.AmbassadorPayoutStatementPage })));
const AmbassadorPayoutSettingsPage = lazy(() => import('@/pages/ambassador/payouts').then(m => ({ default: m.AmbassadorPayoutSettingsPage })));

// Misc protected pages
const Expansion = lazy(() => import('@/pages/Expansion'));
const Rewards = lazy(() => import('@/pages/Rewards'));
const LiveMap = lazy(() => import('@/pages/LiveMap'));
const WalletPage = lazy(() => import('@/pages/Wallet'));
const Subscriptions = lazy(() => import('@/pages/Subscriptions'));
const DeliveryCapacity = lazy(() => import('@/pages/DeliveryCapacity'));
const DeliveryCapacityCommand = lazy(() => import('@/pages/delivery').then(m => ({ default: m.DeliveryCapacityCommand })));
const CommunicationAutomation = lazy(() => import('@/pages/CommunicationAutomation'));
const CommunicationsAI = lazy(() => import('@/pages/CommunicationsAI'));
const SecurityConsole = lazy(() => import('@/components/security/SecurityConsole').then(m => ({ default: m.SecurityConsole })));
const RolesPermissionsPage = lazy(() => import('@/components/security/RolesPermissionsPage').then(m => ({ default: m.RolesPermissionsPage })));
const UserManagementPage = lazy(() => import('@/components/security/UserManagementPage'));
const MessagesPage = lazy(() => import('@/pages/Messages'));
const CommunicationInsights = lazy(() => import('@/pages/CommunicationInsights'));
const RouteOptimizer = lazy(() => import('@/pages/RouteOptimizer'));
const RouteOpsCenter = lazy(() => import('@/pages/RouteOpsCenter'));
const RouteOpsCenterEnhanced = lazy(() => import('@/pages/delivery').then(m => ({ default: m.RouteOpsCenterEnhanced })));
const OpsCommandCenter = lazy(() => import('@/pages/delivery').then(m => ({ default: m.OpsCommandCenter })));
const RouteOptimizerPage = lazy(() => import('@/pages/delivery').then(m => ({ default: m.RouteOptimizerPage })));
const MyRoute = lazy(() => import('@/pages/MyRoute'));
const SidebarVisualTest = lazy(() => import('@/pages/SidebarVisualTest'));
const SidebarDebug = lazy(() => import('@/pages/debug/SidebarDebug'));
const Leaderboard = lazy(() => import('@/pages/Leaderboard'));
const Payroll = lazy(() => import('@/pages/Payroll'));
const MetaAI = lazy(() => import('@/pages/MetaAI'));
const ExpansionRegions = lazy(() => import('@/pages/ExpansionRegions'));
const ExpansionHeatmap = lazy(() => import('@/pages/ExpansionHeatmap'));
const AmbassadorRegions = lazy(() => import('@/pages/AmbassadorRegions'));
const Sales = lazy(() => import('@/pages/Sales'));
const SalesProspects = lazy(() => import('@/pages/SalesProspects'));
const SalesProspectNew = lazy(() => import('@/pages/SalesProspectNew'));
const SalesProspectDetail = lazy(() => import('@/pages/SalesProspectDetail'));
const SalesReport = lazy(() => import('@/pages/SalesReport'));
const StorePerformance = lazy(() => import('@/pages/StorePerformance'));
const SellThroughAnalytics = lazy(() => import('@/pages/SellThroughAnalytics'));
const BrandCRMPage = lazy(() => import('@/pages/floor1/BrandCRMPage'));
const StoreOrder = lazy(() => import('@/pages/StoreOrder'));
const WholesaleFulfillment = lazy(() => import('@/pages/WholesaleFulfillment'));
const Billing = lazy(() => import('@/pages/Billing'));
const EconomicAnalytics = lazy(() => import('@/pages/EconomicAnalytics'));
const AmbassadorPayouts = lazy(() => import('@/pages/AmbassadorPayouts'));
const BikerPayouts = lazy(() => import('@/pages/BikerPayouts'));
const CRM = lazy(() => import('@/pages/CRM'));
const CRMContacts = lazy(() => import('@/pages/CRMContacts'));
const CRMContactDetail = lazy(() => import('@/pages/CRMContactDetail'));
const CRMCustomers = lazy(() => import('@/pages/CRMCustomers'));
const ContactProfile = lazy(() => import('@/pages/crm/ContactProfile'));
const GlobalCRM = lazy(() => import('@/pages/crm/GlobalCRM'));
const GlobalCRMDashboard = lazy(() => import('@/pages/crm/GlobalCRMDashboard'));
const BusinessCRMDashboard = lazy(() => import('@/pages/crm/BusinessCRMDashboard'));
const CRMRouter = lazy(() => import('@/pages/crm/CRMRouter'));
const DynamicCRMPage = lazy(() => import('@/pages/crm/DynamicCRMPage'));
const ContactManagementPage = lazy(() => import('@/pages/crm/ContactManagementPage'));

// TopTier CRM
const TopTierPartnerDashboard = lazy(() => import('@/pages/crm/toptier').then(m => ({ default: m.TopTierPartnerDashboard })));
const TopTierPartnerCategoryPage = lazy(() => import('@/pages/crm/toptier').then(m => ({ default: m.TopTierPartnerCategoryPage })));
const TopTierPartnerProfile = lazy(() => import('@/pages/crm/toptier').then(m => ({ default: m.TopTierPartnerProfile })));
const TopTierPartnersByState = lazy(() => import('@/pages/crm/toptier').then(m => ({ default: m.TopTierPartnersByState })));
const TopTierAddPartner = lazy(() => import('@/pages/crm/toptier').then(m => ({ default: m.TopTierAddPartner })));
const TopTierRecentBookings = lazy(() => import('@/pages/crm/toptier').then(m => ({ default: m.TopTierRecentBookings })));
const TopTierCustomerRequests = lazy(() => import('@/pages/crm/toptier').then(m => ({ default: m.TopTierCustomerRequests })));
const TopTierRequestDetail = lazy(() => import('@/pages/crm/toptier').then(m => ({ default: m.TopTierRequestDetail })));
const TopTierPartnerEdit = lazy(() => import('@/pages/crm/toptier').then(m => ({ default: m.TopTierPartnerEdit })));
const TopTierDealDetail = lazy(() => import('@/pages/crm/toptier').then(m => ({ default: m.TopTierDealDetail })));
const TopTierCampaignDetail = lazy(() => import('@/pages/crm/toptier').then(m => ({ default: m.TopTierCampaignDetail })));
const TopTierInteractionDetail = lazy(() => import('@/pages/crm/toptier').then(m => ({ default: m.TopTierInteractionDetail })));
const TopTierContactDetail = lazy(() => import('@/pages/crm/toptier').then(m => ({ default: m.TopTierContactDetail })));
const TopTierAssetDetail = lazy(() => import('@/pages/crm/toptier').then(m => ({ default: m.TopTierAssetDetail })));
const TopTierNoteDetail = lazy(() => import('@/pages/crm/toptier').then(m => ({ default: m.TopTierNoteDetail })));
const TopTierAnalyticsDeals = lazy(() => import('@/pages/crm/toptier').then(m => ({ default: m.TopTierAnalyticsDeals })));
const TopTierAnalyticsRevenue = lazy(() => import('@/pages/crm/toptier').then(m => ({ default: m.TopTierAnalyticsRevenue })));
const TopTierAnalyticsCommissions = lazy(() => import('@/pages/crm/toptier').then(m => ({ default: m.TopTierAnalyticsCommissions })));
const TopTierAllContacts = lazy(() => import('@/pages/crm/toptier').then(m => ({ default: m.TopTierAllContacts })));
const TopTierInteractionsHub = lazy(() => import('@/pages/crm/toptier').then(m => ({ default: m.TopTierInteractionsHub })));
const TopTierCustomers = lazy(() => import('@/pages/crm/toptier').then(m => ({ default: m.TopTierCustomers })));
const TopTierCustomerProfile = lazy(() => import('@/pages/crm/toptier').then(m => ({ default: m.TopTierCustomerProfile })));
const TopTierNewCustomer = lazy(() => import('@/pages/crm/toptier').then(m => ({ default: m.TopTierNewCustomer })));
const TopTierEditCustomer = lazy(() => import('@/pages/crm/toptier').then(m => ({ default: m.TopTierEditCustomer })));
const TopTierVIPCustomers = lazy(() => import('@/pages/crm/toptier').then(m => ({ default: m.TopTierVIPCustomers })));
const TopTierReturningCustomers = lazy(() => import('@/pages/crm/toptier').then(m => ({ default: m.TopTierReturningCustomers })));
const TopTierNewCustomers = lazy(() => import('@/pages/crm/toptier').then(m => ({ default: m.TopTierNewCustomers })));
const TopTierCustomerBookings = lazy(() => import('@/pages/crm/toptier').then(m => ({ default: m.TopTierCustomerBookings })));
const TopTierCustomerValue = lazy(() => import('@/pages/crm/toptier').then(m => ({ default: m.TopTierCustomerValue })));
const TopTierAllPartners = lazy(() => import('@/pages/crm/toptier').then(m => ({ default: m.TopTierAllPartners })));
const TopTierNewDeal = lazy(() => import('@/pages/crm/toptier').then(m => ({ default: m.TopTierNewDeal })));
const TopTierDeals = lazy(() => import('@/pages/crm/toptier').then(m => ({ default: m.TopTierDeals })));
const TopTierKPIManagement = lazy(() => import('@/pages/crm/toptier').then(m => ({ default: m.TopTierKPIManagement })));

const AddBusinessPage = lazy(() => import('@/pages/crm/AddBusinessPage'));
const CRMDataPage = lazy(() => import('@/pages/crm/CRMDataPage'));
const CRMExportPage = lazy(() => import('@/pages/crm/CRMExportPage'));
const CRMImportPage = lazy(() => import('@/pages/crm/CRMImportPage'));
const CRMBackupPage = lazy(() => import('@/pages/crm/CRMBackupPage'));
const EntityListPage = lazy(() => import('@/pages/crm/EntityListPage'));
const EntityProfilePage = lazy(() => import('@/pages/crm/EntityProfilePage'));
const EntityCreatePage = lazy(() => import('@/pages/crm/EntityCreatePage'));
const CRMSettingsPage = lazy(() => import('@/pages/crm/CRMSettingsPage'));
const CRMUserAccessPage = lazy(() => import('@/pages/crm/CRMUserAccessPage'));
const AcceptCRMInvite = lazy(() => import('@/pages/crm/AcceptCRMInvite'));
const CRMBrandPage = lazy(() => import('@/pages/crm/BrandCRM'));
const CRMBrandStoreProfile = lazy(() => import('@/pages/crm/BrandStoreProfile'));
const CRMCustomerNew = lazy(() => import('@/pages/CRMCustomerNew'));
const CRMCustomerDetail = lazy(() => import('@/pages/CRMCustomerDetail'));
const CRMCustomerImport = lazy(() => import('@/pages/CRMCustomerImport'));
const CRMData = lazy(() => import('@/pages/CRMData'));
const CRMDataExport = lazy(() => import('@/pages/CRMDataExport'));
const CRMDataImport = lazy(() => import('@/pages/CRMDataImport'));
const CRMBulkUpload = lazy(() => import('@/pages/CRMBulkUpload'));
const CRMBackupSettings = lazy(() => import('@/pages/CRMBackupSettings'));
const CRMFollowUps = lazy(() => import('@/pages/CRMFollowUps'));
const Companies = lazy(() => import('@/pages/Companies'));
const CompanyProfile = lazy(() => import('@/pages/CompanyProfile'));
const UnpaidAccounts = lazy(() => import('@/pages/UnpaidAccounts'));
const DriverDebtCollection = lazy(() => import('@/pages/DriverDebtCollection'));
const BrandDashboard = lazy(() => import('@/pages/BrandDashboard'));

// Owner pages
const OwnerDashboard = lazy(() => import('@/pages/owner').then(m => ({ default: m.OwnerDashboard })));
const OwnerAIAdvisorPage = lazy(() => import('@/pages/owner').then(m => ({ default: m.OwnerAIAdvisorPage })));
const OwnerClusterDashboard = lazy(() => import('@/pages/owner').then(m => ({ default: m.OwnerClusterDashboard })));
const OwnerAutopilotConsole = lazy(() => import('@/pages/owner').then(m => ({ default: m.OwnerAutopilotConsole })));
const OwnerAICommandConsole = lazy(() => import('@/pages/owner').then(m => ({ default: m.OwnerAICommandConsole })));
const OwnerRiskRadar = lazy(() => import('@/pages/owner').then(m => ({ default: m.OwnerRiskRadar })));
const OwnerDailyBriefing = lazy(() => import('@/pages/owner').then(m => ({ default: m.OwnerDailyBriefing })));
const OwnerHoldingsOverview = lazy(() => import('@/pages/owner').then(m => ({ default: m.OwnerHoldingsOverview })));
const OwnerClusterDetailPage = lazy(() => import('@/pages/owner').then(m => ({ default: m.OwnerClusterDetailPage })));
const OwnerAutomationDetailPage = lazy(() => import('@/pages/owner').then(m => ({ default: m.OwnerAutomationDetailPage })));
const OwnerRiskDetailPage = lazy(() => import('@/pages/owner').then(m => ({ default: m.OwnerRiskDetailPage })));
const OwnerBusinessDetailPage = lazy(() => import('@/pages/owner').then(m => ({ default: m.OwnerBusinessDetailPage })));
const OwnerPropertyDetailPage = lazy(() => import('@/pages/owner').then(m => ({ default: m.OwnerPropertyDetailPage })));
const OwnerFinancialHoldingDetailPage = lazy(() => import('@/pages/owner').then(m => ({ default: m.OwnerFinancialHoldingDetailPage })));
const OwnerAlertDetailPage = lazy(() => import('@/pages/owner').then(m => ({ default: m.OwnerAlertDetailPage })));
const OwnerAutoTradingDetailPage = lazy(() => import('@/pages/owner').then(m => ({ default: m.OwnerAutoTradingDetailPage })));
const OwnerCryptoDetailPage = lazy(() => import('@/pages/owner').then(m => ({ default: m.OwnerCryptoDetailPage })));
const OwnerSportsDetailPage = lazy(() => import('@/pages/owner').then(m => ({ default: m.OwnerSportsDetailPage })));
const OwnerVoiceAI = lazy(() => import('@/pages/owner').then(m => ({ default: m.OwnerVoiceAI })));
const OwnerReports = lazy(() => import('@/pages/owner').then(m => ({ default: m.OwnerReports })));
const OwnerVARouting = lazy(() => import('@/pages/owner').then(m => ({ default: m.OwnerVARouting })));
const OwnerAlertCenter = lazy(() => import('@/pages/owner').then(m => ({ default: m.OwnerAlertCenter })));
const OwnerExecutiveReports = lazy(() => import('@/pages/owner').then(m => ({ default: m.OwnerExecutiveReports })));
const OwnerBroadcastCenter = lazy(() => import('@/pages/owner').then(m => ({ default: m.OwnerBroadcastCenter })));
const OwnerAccountingOS = lazy(() => import('@/pages/owner').then(m => ({ default: m.OwnerAccountingOS })));
const OwnerMissionControl = lazy(() => import('@/pages/owner/OwnerMissionControl'));

// Call Center
const CallCenterDashboard = lazy(() => import('@/pages/callcenter/CallCenterDashboard'));
const PhoneNumbers = lazy(() => import('@/pages/callcenter/PhoneNumbers'));
const CallLogs = lazy(() => import('@/pages/callcenter/CallLogs'));
const AIAgents = lazy(() => import('@/pages/callcenter/AIAgents'));
const LiveMonitoring = lazy(() => import('@/pages/callcenter/LiveMonitoring'));
const CallCenterSettings = lazy(() => import('@/pages/callcenter/CallCenterSettings'));
const CallCenterDialer = lazy(() => import('@/pages/callcenter/CallCenterDialer'));
const CallCenterAnalytics = lazy(() => import('@/pages/callcenter/CallCenterAnalytics'));
const Messages = lazy(() => import('@/pages/callcenter/Messages'));
const Emails = lazy(() => import('@/pages/callcenter/Emails'));

// Dynasty Connect Hub
const DCLayout = lazy(() => import('@/pages/dynasty-connect/DCLayout'));
const DCCommandCenter = lazy(() => import('@/pages/dynasty-connect/DCCommandCenter'));
const DCCampaigns = lazy(() => import('@/pages/dynasty-connect/DCCampaigns'));
const DCCampaignBuilder = lazy(() => import('@/pages/dynasty-connect/DCCampaignBuilder'));
const DCCampaignManager = lazy(() => import('@/pages/dynasty-connect/DCCampaignManager'));
const DCAgents = lazy(() => import('@/pages/dynasty-connect/DCAgents'));
const DCIntelligence = lazy(() => import('@/pages/dynasty-connect/DCIntelligence'));
const DCPipelines = lazy(() => import('@/pages/dynasty-connect/DCPipelines'));
const DCInfrastructure = lazy(() => import('@/pages/dynasty-connect/DCInfrastructure'));
const DCLiveCalls = lazy(() => import('@/pages/dynasty-connect/DCLiveCalls'));
const DCClients = lazy(() => import('@/pages/dynasty-connect/DCClients'));
const DCPhoneSetup = lazy(() => import('@/pages/dynasty-connect/DCPhoneSetup'));
const DCPhoneNumbers = lazy(() => import('@/pages/dynasty-connect/DCPhoneNumbers'));
// Pipeline sub-pages
const SurplusFundsPipeline = lazy(() => import('@/pages/dynasty-connect/pipelines/SurplusFundsPipeline'));
const DCRealEstatePipeline = lazy(() => import('@/pages/dynasty-connect/pipelines/RealEstatePipeline'));
const UnforgettableTimesPipeline = lazy(() => import('@/pages/dynasty-connect/pipelines/UnforgettableTimesPipeline'));
const PlayBoxxxPipeline = lazy(() => import('@/pages/dynasty-connect/pipelines/PlayBoxxxPipeline'));
const BrightSunPipeline = lazy(() => import('@/pages/dynasty-connect/pipelines/BrightSunPipeline'));
const GasMaskNewStoresPipeline = lazy(() => import('@/pages/dynasty-connect/pipelines/GasMaskNewStoresPipeline'));

// Voice Ops Dashboard
const VoiceOpsLayout = lazy(() => import('@/pages/voice-ops/VoiceOpsLayout'));
const VODashboard = lazy(() => import('@/pages/voice-ops/VODashboard'));
const VONumbers = lazy(() => import('@/pages/voice-ops/VONumbers'));
const VOAgents = lazy(() => import('@/pages/voice-ops/VOAgents'));
const VOSecrets = lazy(() => import('@/pages/voice-ops/VOSecrets'));
const VOOutbound = lazy(() => import('@/pages/voice-ops/VOOutbound'));

// Surplus Funds OS
const SFLayout = lazy(() => import('@/pages/surplus-funds/SFLayout'));
const SFCommandCenter = lazy(() => import('@/pages/surplus-funds/SFCommandCenter'));
const SFLeadPipeline = lazy(() => import('@/pages/surplus-funds/SFLeadPipeline'));
const SFDiscovery = lazy(() => import('@/pages/surplus-funds/SFDiscovery'));
const SFCampaigns = lazy(() => import('@/pages/surplus-funds/SFCampaigns'));
const SFCases = lazy(() => import('@/pages/surplus-funds/SFCases'));
const SFAttorneys = lazy(() => import('@/pages/surplus-funds/SFAttorneys'));
const SFDocuments = lazy(() => import('@/pages/surplus-funds/SFDocuments'));
const SFAutomation = lazy(() => import('@/pages/surplus-funds/SFAutomation'));
const SFAnalytics = lazy(() => import('@/pages/surplus-funds/SFAnalytics'));

// BrightSun Solar OS
const SolarLayout = lazy(() => import('@/pages/solar/SolarLayout'));
const SolarCommandCenter = lazy(() => import('@/pages/solar/SolarCommandCenter'));
const SolarLeadIntelligence = lazy(() => import('@/pages/solar/SolarLeadIntelligence'));
const SolarOutreach = lazy(() => import('@/pages/solar/SolarOutreach'));
const SolarQualification = lazy(() => import('@/pages/solar/SolarQualification'));
const SolarAppointments = lazy(() => import('@/pages/solar/SolarAppointments'));
const SolarLiveCallAssist = lazy(() => import('@/pages/solar/SolarLiveCallAssist'));
const SolarDeals = lazy(() => import('@/pages/solar/SolarDeals'));
const SolarPartnersAdvanced = lazy(() => import('@/pages/solar/SolarPartnersAdvanced'));
const SolarAgents = lazy(() => import('@/pages/solar/SolarAgents'));
const SolarAIBrain = lazy(() => import('@/pages/solar/SolarAIBrain'));
const SolarAnalytics = lazy(() => import('@/pages/solar/SolarAnalytics'));
const SolarEstimator = lazy(() => import('@/pages/solar/SolarEstimator'));
const SolarClosingDashboard = lazy(() => import('@/pages/solar/SolarClosingDashboard'));
const SolarFollowUps = lazy(() => import('@/pages/solar/SolarFollowUps'));
const SolarBookings = lazy(() => import('@/pages/solar/SolarBookings'));

// Real Estate OS
const RELayout = lazy(() => import('@/pages/real-estate/RELayout'));
const RECommandCenter = lazy(() => import('@/pages/real-estate/RECommandCenter'));
const RELeadPipeline = lazy(() => import('@/pages/real-estate/RELeadPipeline'));
const RECampaigns = lazy(() => import('@/pages/real-estate/RECampaigns'));
const REDeals = lazy(() => import('@/pages/real-estate/REDeals'));
const REBuyers = lazy(() => import('@/pages/real-estate/REBuyers'));
const REVADesk = lazy(() => import('@/pages/real-estate/REVADesk'));
const REAnalyzer = lazy(() => import('@/pages/real-estate/REAnalyzer'));
const REAutomation = lazy(() => import('@/pages/real-estate/REAutomation'));
const REMarkets = lazy(() => import('@/pages/real-estate/REMarkets'));
const REAnalytics = lazy(() => import('@/pages/real-estate/REAnalytics'));

const CommunicationHubLayout = lazy(() => import('@/pages/communication/CommunicationHubLayout'));
const InboxPage = lazy(() => import('@/pages/communication/inbox/InboxPage'));
const DialerPage = lazy(() => import('@/pages/communication/dialer/DialerPage'));
const LiveCallsPage = lazy(() => import('@/pages/communication/live/LiveCallsPage'));
const EscalationsPage = lazy(() => import('@/pages/communication/escalations/EscalationsPage'));
const EngagementPage = lazy(() => import('@/pages/communication/engagement/EngagementPage'));
const RoutingPage = lazy(() => import('@/pages/communication/routing/RoutingPage'));
const OutreachPage = lazy(() => import('@/pages/communication/outreach/OutreachPage'));
const CampaignsPage = lazy(() => import('@/pages/communication/campaigns/CampaignsPage'));
const PersonasPage = lazy(() => import('@/pages/communication/personas/PersonasPage'));
const CallFlowsPage = lazy(() => import('@/pages/communication/callflows/CallFlowsPage'));
const HeatmapPage = lazy(() => import('@/pages/communication/heatmap/HeatmapPage'));
const CallReasonsPage = lazy(() => import('@/pages/communication/callreasons/CallReasonsPage'));
const PredictionsPage = lazy(() => import('@/pages/communication/predictions/PredictionsPage'));
const AgentsPage = lazy(() => import('@/pages/communication/agents/AgentsPage'));
const LanguagePage = lazy(() => import('@/pages/communication/language/LanguagePage'));
const VoiceMatrixPage = lazy(() => import('@/pages/communication/voicematrix/VoiceMatrixPage'));
const CommSettingsPage = lazy(() => import('@/pages/communication/settings/SettingsPage'));
const PhoneNumbersSettingsPage = lazy(() => import('@/pages/communication/settings/PhoneNumbersPage'));
const BusinessPhoneNumbersPage = lazy(() => import('@/pages/communication/BusinessPhoneNumbers'));
const PhoneProvisioningPage = lazy(() => import('@/pages/communication/PhoneProvisioningPage'));
const UserCallSettingsPage = lazy(() => import('@/pages/communication/call-settings').then(m => ({ default: m.UserCallSettingsPage })));
const BusinessHoursPage = lazy(() => import('@/pages/communication/call-settings').then(m => ({ default: m.BusinessHoursPage })));
const AfterHoursRoutingPage = lazy(() => import('@/pages/communication/call-settings').then(m => ({ default: m.AfterHoursRoutingPage })));
const CallSystemDiagnosticsPage = lazy(() => import('@/pages/communication/call-settings').then(m => ({ default: m.CallSystemDiagnosticsPage })));
const VoicemailInboxPage = lazy(() => import('@/pages/communication/call-intelligence').then(m => ({ default: m.VoicemailInboxPage })));
const MissedCallsDashboardPage = lazy(() => import('@/pages/communication/call-intelligence').then(m => ({ default: m.MissedCallsDashboardPage })));
const CallIntelligencePage = lazy(() => import('@/pages/communication/call-intelligence').then(m => ({ default: m.CallIntelligencePage })));
const UnresolvedCallsQueuePage = lazy(() => import('@/pages/communication/call-intelligence').then(m => ({ default: m.UnresolvedCallsQueuePage })));
const AICallAgentDashboardPage = lazy(() => import('@/pages/communication/call-intelligence/AICallAgentDashboardPage'));
const ManualCallPage = lazy(() => import('@/pages/communication/manual/ManualCallPage'));
const ManualTextPage = lazy(() => import('@/pages/communication/manual/ManualTextPage'));
const AIAutoDialerPage = lazy(() => import('@/pages/communication/ai/AIAutoDialerPage'));
const BulkDialerPage = lazy(() => import('@/pages/communication/dialer/BulkDialerPage'));
const LiveCallPanel = lazy(() => import('@/pages/communication/dialer/LiveCallPanel'));
const DialerSettingsPage = lazy(() => import('@/pages/communication/dialer/DialerSettingsPage'));
const RepPerformancePage = lazy(() => import('@/pages/communication/dialer/RepPerformancePage'));
const CampaignIntelligencePage = lazy(() => import('@/pages/communication/dialer/CampaignIntelligencePage'));
const DialerCostDashboard = lazy(() => import('@/pages/communication/dialer/DialerCostDashboard'));
const DialerHealthPage = lazy(() => import('@/pages/communication/dialer/DialerHealthPage'));
const DialerOptimizationDashboard = lazy(() => import('@/pages/communication/dialer/DialerOptimizationDashboard'));
const DialerRevenueIntelligence = lazy(() => import('@/pages/communication/dialer/DialerRevenueIntelligence'));
const DialerPredictiveTargeting = lazy(() => import('@/pages/communication/dialer/DialerPredictiveTargeting'));
const DialerIntegrityPage = lazy(() => import('@/pages/communication/dialer/DialerIntegrityPage'));
const AutoDialerPage = lazy(() => import('@/pages/communication/dialer/AutoDialerPage'));
const AIAutoTextPage = lazy(() => import('@/pages/communication/ai/AIAutoTextPage'));
const MessagingHubPage = lazy(() => import('@/pages/communication/messaging').then(m => ({ default: m.MessagingHubPage })));
const OutboundEnginePage = lazy(() => import('@/pages/communication/ai/OutboundEnginePage'));
const AutonomousDirectorPage = lazy(() => import('@/pages/communication/ai/AutonomousDirectorPage'));
const VoiceLibraryPage = lazy(() => import('@/pages/communication/voice/VoiceLibraryPage'));
const DealsSalesPage = lazy(() => import('@/pages/communication/deals/DealsSalesPage'));
const FollowUpManagerPage = lazy(() => import('@/pages/communication/followups/FollowUpManagerPage'));
const FieldSubmissionsPage = lazy(() => import('@/pages/communication/FieldSubmissionsPage'));
const UnifiedInboxV3Page = lazy(() => import('@/pages/communication/inbox/UnifiedInboxV3Page'));
const PlaybooksManagement = lazy(() => import('@/pages/communication/playbooks/CommunicationPlaybooksPage'));
const ShadowModePage = lazy(() => import('@/pages/communication/ShadowModePage'));
const OutboundGrowthPage = lazy(() => import('@/pages/communication/OutboundGrowthPage'));
const ExecutiveControlRoomPage = lazy(() => import('@/pages/executive').then(m => ({ default: m.ExecutiveControlRoomPage })));
const ComplianceCenter = lazy(() => import('@/pages/compliance/ComplianceCenter'));
const ColdCallBlastPage = lazy(() => import('@/pages/communication/cold-calls/ColdCallBlastPage'));
const RouteEnginePage = lazy(() => import('@/pages/gasmask/RouteEnginePage'));
const GasmaskDriverRoutePage = lazy(() => import('@/pages/gasmask/DriverRoutePage'));
const AgentCenterPage = lazy(() => import('@/pages/gasmask/AgentCenterPage'));
const NoteCleanerPage = lazy(() => import('@/pages/gasmask/NoteCleanerPage'));
const CommunicationOverview = lazy(() => import('@/pages/communication/CommunicationOverview'));
const CommunicationCampaigns = lazy(() => import('@/pages/communication/CommunicationCampaigns'));
const CommunicationCampaignNew = lazy(() => import('@/pages/communication/CommunicationCampaignNew'));
const CommunicationCampaignDetail = lazy(() => import('@/pages/communication/CommunicationCampaignDetail'));
const CommunicationCalls = lazy(() => import('@/pages/communication/CommunicationCalls'));
const CommunicationSMS = lazy(() => import('@/pages/communication/CommunicationSMS'));
const CommunicationSMSDashboard = lazy(() => import('@/pages/communication/CommunicationSMSDashboard'));
const CommunicationEmail = lazy(() => import('@/pages/communication/CommunicationEmail'));
const CommunicationAIAgents = lazy(() => import('@/pages/communication/CommunicationAIAgents'));
const CommunicationNumbers = lazy(() => import('@/pages/communication/CommunicationNumbers'));
const CommunicationLogs = lazy(() => import('@/pages/communication/CommunicationLogs'));
const CommunicationAnalytics = lazy(() => import('@/pages/communication/CommunicationAnalytics'));
const CommunicationSettings = lazy(() => import('@/pages/communication/CommunicationSettings'));
const CommunicationsCenterOverview = lazy(() => import('@/pages/CommunicationsCenterOverview'));
const CommunicationsCenterLogs = lazy(() => import('@/pages/CommunicationsCenterLogs'));
const CallCenter = lazy(() => import('@/pages/CallCenter'));
const TextCenter = lazy(() => import('@/pages/TextCenter'));
const EmailCenter = lazy(() => import('@/pages/EmailCenter'));

// Comm Systems
const CommSystemsDialerPage = lazy(() => import('@/pages/comm-systems/dialer/DialerPage'));
const CommSystemsCallLogsPage = lazy(() => import('@/pages/comm-systems/call-logs/CallLogsPage'));
const CommSystemsAIAgentsPage = lazy(() => import('@/pages/comm-systems/ai-agents/AIAgentsPage'));
const CommSystemsAnalyticsPage = lazy(() => import('@/pages/comm-systems/analytics/CallAnalyticsPage'));
const CommSystemsMessagesPage = lazy(() => import('@/pages/comm-systems/messages/MessagesPage'));
const CommSystemsEmailsPage = lazy(() => import('@/pages/comm-systems/emails/EmailsPage'));
const CommSystemsCommAIPage = lazy(() => import('@/pages/comm-systems/hub/CommAIPage'));
const CommSystemsAutomationPage = lazy(() => import('@/pages/comm-systems/hub/CommAutomationPage'));
const CommSystemsInsightsPage = lazy(() => import('@/pages/comm-systems/hub/CommInsightsPage'));
const CommunicationHubPage = lazy(() => import('@/pages/comm-systems/hub/CommunicationHubPage'));

const BillingCenter = lazy(() => import('@/pages/BillingCenter'));
const BillingInvoices = lazy(() => import('@/pages/BillingInvoices'));
const BillingInvoiceNew = lazy(() => import('@/pages/BillingInvoiceNew'));
const BillingInvoiceDetail = lazy(() => import('@/pages/BillingInvoiceDetail'));
const Floor5Dashboard = lazy(() => import('@/pages/floor5').then(m => ({ default: m.Floor5Dashboard })));

// Portal
const RoleRouter = lazy(() => import('@/components/portal/RoleRouter'));
const PortalDashboard = lazy(() => import('@/pages/portal/PortalDashboard'));
const PortalInvoices = lazy(() => import('@/pages/portal/PortalInvoices'));
const PortalHome = lazy(() => import('@/pages/portal/PortalHome'));
const PortalOnboarding = lazy(() => import('@/pages/portal/PortalOnboarding'));
const DriverPortal = lazy(() => import('@/pages/portal/DriverPortal'));
const BikerPortal = lazy(() => import('@/pages/portal/BikerPortal'));
const AmbassadorPortal = lazy(() => import('@/pages/portal/AmbassadorPortal'));
const PortalInvoiceDetail = lazy(() => import('@/pages/portal/PortalInvoiceDetail'));
const PortalWholesale = lazy(() => import('@/pages/portal/PortalWholesale'));
const PortalInfluencer = lazy(() => import('@/pages/portal/PortalInfluencer'));
const OpsInboxPage = lazy(() => import('@/pages/portal/OpsInboxPage'));
const OpsInboxThreadPage = lazy(() => import('@/pages/portal/OpsInboxThreadPage'));
const OpsTaskListPage = lazy(() => import('@/pages/portal/OpsTaskListPage'));
const WholesalerDashboard = lazy(() => import('@/pages/portal/wholesaler').then(m => ({ default: m.WholesalerDashboard })));
const WholesalerProducts = lazy(() => import('@/pages/portal/wholesaler').then(m => ({ default: m.WholesalerProducts })));
const WholesalerProductForm = lazy(() => import('@/pages/portal/wholesaler').then(m => ({ default: m.WholesalerProductForm })));
const WholesalerOrders = lazy(() => import('@/pages/portal/wholesaler').then(m => ({ default: m.WholesalerOrders })));
const WholesalerFinance = lazy(() => import('@/pages/portal/wholesaler').then(m => ({ default: m.WholesalerFinance })));
const WholesalerSettings = lazy(() => import('@/pages/portal/wholesaler').then(m => ({ default: m.WholesalerSettings })));
const WholesalerMessages = lazy(() => import('@/pages/portal/wholesaler').then(m => ({ default: m.WholesalerMessages })));
const WholesalerFulfillmentPage = lazy(() => import('@/pages/portal/wholesaler').then(m => ({ default: m.WholesalerFulfillmentPage })));
const WholesalerTransactionHistory = lazy(() => import('@/pages/portal/wholesaler').then(m => ({ default: m.WholesalerTransactionHistory })));
const WholesalerInventoryWorkflow = lazy(() => import('@/pages/portal/wholesaler').then(m => ({ default: m.WholesalerInventoryWorkflow })));
const StoreDashboard = lazy(() => import('@/pages/portal/store').then(m => ({ default: m.StoreDashboard })));
const StoreProducts = lazy(() => import('@/pages/portal/store').then(m => ({ default: m.StoreProducts })));
const StoreCart = lazy(() => import('@/pages/portal/store').then(m => ({ default: m.StoreCart })));
const StoreCheckout = lazy(() => import('@/pages/portal/store').then(m => ({ default: m.StoreCheckout })));
const StoreOrders = lazy(() => import('@/pages/portal/store').then(m => ({ default: m.StoreOrders })));
const StoreOrderDetail = lazy(() => import('@/pages/portal/store').then(m => ({ default: m.StoreOrderDetail })));
const StoreInvoices = lazy(() => import('@/pages/portal/store').then(m => ({ default: m.StoreInvoices })));
const StoreSettings = lazy(() => import('@/pages/portal/store').then(m => ({ default: m.StoreSettings })));
const StoreMessages = lazy(() => import('@/pages/portal/store').then(m => ({ default: m.StoreMessages })));
const StoreTeam = lazy(() => import('@/pages/portal/store/StoreTeam'));
const WholesalerTeam = lazy(() => import('@/pages/portal/wholesaler/WholesalerTeam'));
const JoinOrg = lazy(() => import('@/pages/portal/JoinOrg'));
const ProductionPortal = lazy(() => import('@/pages/portal/ProductionPortal'));
const VAPortal = lazy(() => import('@/pages/portal/VAPortal'));
const CustomerPortal = lazy(() => import('@/pages/portal/CustomerPortal'));
const NationalWholesale = lazy(() => import('@/pages/portal/NationalWholesale'));
const MarketplaceAdmin = lazy(() => import('@/pages/portal/MarketplaceAdmin'));

// New Role Portals
const DriverPortalPage = lazy(() => import('@/pages/portals').then(m => ({ default: m.DriverPortalPage })));
const BikerPortalPage = lazy(() => import('@/pages/portals').then(m => ({ default: m.BikerPortalPage })));
const AmbassadorPortalPage = lazy(() => import('@/pages/portals').then(m => ({ default: m.AmbassadorPortalPage })));
const StorePortalPage = lazy(() => import('@/pages/portals').then(m => ({ default: m.StorePortalPage })));
const WholesalerPortalPage = lazy(() => import('@/pages/portals').then(m => ({ default: m.WholesalerPortalPage })));
const ProductionPortalPage = lazy(() => import('@/pages/portals').then(m => ({ default: m.ProductionPortalPage })));
const VAPortalPage = lazy(() => import('@/pages/portals').then(m => ({ default: m.VAPortalPage })));
const CustomerPortalPage = lazy(() => import('@/pages/portals').then(m => ({ default: m.CustomerPortalPage })));
const NationalWholesalePortalPage = lazy(() => import('@/pages/portals').then(m => ({ default: m.NationalWholesalePortalPage })));
const MarketplaceAdminPortalPage = lazy(() => import('@/pages/portals').then(m => ({ default: m.MarketplaceAdminPortalPage })));
const OfficesManagementPage = lazy(() => import('@/pages/portals/production/OfficesManagementPage'));
const StaffManagementPage = lazy(() => import('@/pages/portals/production/StaffManagementPage'));
const ConversionIntelligencePage = lazy(() => import('@/pages/portals/ConversionIntelligencePage'));
const SupplierYieldPage = lazy(() => import('@/pages/portals/SupplierYieldPage'));
const SalesVelocityPage = lazy(() => import('@/pages/portals/SalesVelocityPage'));
const ProductionWarRoom = lazy(() => import('@/pages/portals/production/ProductionWarRoom'));
const WorkerTaskTimerPage = lazy(() => import('@/pages/portals/production/WorkerTaskTimerPage'));
const CostHistoryPage = lazy(() => import('@/pages/production/CostHistoryPage'));
const SupervisorComparisonPage = lazy(() => import('@/pages/production/SupervisorComparisonPage'));

// HR
const HR = lazy(() => import('@/pages/HR'));
const HRApplicants = lazy(() => import('@/pages/HRApplicants'));
const HRApplicantDetail = lazy(() => import('@/pages/HRApplicantDetail'));
const HREmployees = lazy(() => import('@/pages/HREmployees'));
const HREmployeeDetail = lazy(() => import('@/pages/HREmployeeDetail'));
const HRInterviews = lazy(() => import('@/pages/HRInterviews'));
const HRDocuments = lazy(() => import('@/pages/HRDocuments'));
const HROnboarding = lazy(() => import('@/pages/HROnboarding'));
const HRPayroll = lazy(() => import('@/pages/HRPayroll'));
const MyHR = lazy(() => import('@/pages/MyHR'));

// Real Estate
const RealEstate = lazy(() => import('@/pages/RealEstate'));
const RealEstateLeads = lazy(() => import('@/pages/RealEstateLeads'));
const RealEstatePipeline = lazy(() => import('@/pages/RealEstatePipeline'));
const RealEstateInvestors = lazy(() => import('@/pages/RealEstateInvestors'));
const RealEstateClosings = lazy(() => import('@/pages/RealEstateClosings'));
const RealEstateExpansion = lazy(() => import('@/pages/RealEstateExpansion'));
const RealEstateSubscriptions = lazy(() => import('@/pages/RealEstateSubscriptions'));
const RealEstatePartners = lazy(() => import('@/pages/RealEstatePartners'));
const RealEstatePL = lazy(() => import('@/pages/RealEstatePL'));
const RealEstateLayout = lazy(() => import('@/pages/realestate/RealEstateLayout'));
const LoanProducts = lazy(() => import('@/pages/LoanProducts'));
const LenderDirectory = lazy(() => import('@/pages/LenderDirectory'));
const LoanCalculators = lazy(() => import('@/pages/LoanCalculators'));
const FundingRequests = lazy(() => import('@/pages/FundingRequests'));
const VAPerformance = lazy(() => import('@/pages/VAPerformance'));
const VARanking = lazy(() => import('@/pages/VARanking'));
const VATaskCenter = lazy(() => import('@/pages/VATaskCenter'));
const DealSheetsGenerator = lazy(() => import('@/pages/DealSheetsGenerator'));
const InvestorBlastSystem = lazy(() => import('@/pages/InvestorBlastSystem'));
const OfferAnalyzer = lazy(() => import('@/pages/OfferAnalyzer'));
const AssignmentFeeOptimizer = lazy(() => import('@/pages/AssignmentFeeOptimizer'));

// Holdings
const HoldingsOverview = lazy(() => import('@/pages/HoldingsOverview'));
const HoldingsAssets = lazy(() => import('@/pages/HoldingsAssets'));
const HoldingsAirbnb = lazy(() => import('@/pages/HoldingsAirbnb'));
const HoldingsTenants = lazy(() => import('@/pages/HoldingsTenants'));
const HoldingsLoans = lazy(() => import('@/pages/HoldingsLoans'));
const HoldingsExpenses = lazy(() => import('@/pages/HoldingsExpenses'));
const HoldingsStrategy = lazy(() => import('@/pages/HoldingsStrategy'));

// POD
const PODOverview = lazy(() => import('@/pages/pod/index'));
const PODDesigns = lazy(() => import('@/pages/pod/designs'));
const PODGenerate = lazy(() => import('@/pages/pod/generator'));
const PODMockups = lazy(() => import('@/pages/pod/mockups'));
const PODUpload = lazy(() => import('@/pages/pod/uploads'));
const PODVideos = lazy(() => import('@/pages/pod/videos'));
const PODScheduler = lazy(() => import('@/pages/pod/scheduler'));
const PODAnalytics = lazy(() => import('@/pages/pod/analytics'));
const PODScaling = lazy(() => import('@/pages/pod/winners'));
const PODVAControl = lazy(() => import('@/pages/pod/va'));
const PODSettings = lazy(() => import('@/pages/pod/settings'));
const PodLayout = lazy(() => import('@/pages/pod/PodLayout'));

// OS Modules
const ProcurementDashboard = lazy(() => import('@/pages/os/procurement').then(m => ({ default: m.ProcurementDashboard })));
const ProcurementSuppliersPage = lazy(() => import('@/pages/os/procurement').then(m => ({ default: m.SuppliersPage })));
const ProcurementSupplierDetailPage = lazy(() => import('@/pages/os/procurement').then(m => ({ default: m.SupplierDetailPage })));
const ProcurementPurchaseOrdersPage = lazy(() => import('@/pages/os/procurement').then(m => ({ default: m.PurchaseOrdersPage })));
const ProcurementNewPurchaseOrderPage = lazy(() => import('@/pages/os/procurement').then(m => ({ default: m.NewPurchaseOrderPage })));
const ProcurementPurchaseOrderDetailPage = lazy(() => import('@/pages/os/procurement').then(m => ({ default: m.PurchaseOrderDetailPage })));
const WarehouseDashboard = lazy(() => import('@/pages/os/warehouse').then(m => ({ default: m.WarehouseDashboard })));

// Inventory
const InventoryDashboard = lazy(() => import('@/pages/os/inventory').then(m => ({ default: m.InventoryDashboard })));
const ProductsPage = lazy(() => import('@/pages/os/inventory').then(m => ({ default: m.ProductsPage })));
const ProductDetailPage = lazy(() => import('@/pages/os/inventory').then(m => ({ default: m.ProductDetailPage })));
const ProductInventoryPage = lazy(() => import('@/pages/os/inventory').then(m => ({ default: m.ProductInventoryPage })));
const WarehousesPage = lazy(() => import('@/pages/os/inventory').then(m => ({ default: m.WarehousesPage })));
const WarehouseDetailPage = lazy(() => import('@/pages/os/inventory').then(m => ({ default: m.WarehouseDetailPage })));
const InventorySuppliersPage = lazy(() => import('@/pages/os/inventory').then(m => ({ default: m.SuppliersPage })));
const InventorySupplierDetailPage = lazy(() => import('@/pages/os/inventory').then(m => ({ default: m.SupplierDetailPage })));
const InventoryPurchaseOrdersPage = lazy(() => import('@/pages/os/inventory').then(m => ({ default: m.PurchaseOrdersPage })));
const InventoryNewPurchaseOrderPage = lazy(() => import('@/pages/os/inventory').then(m => ({ default: m.NewPurchaseOrderPage })));
const PurchaseOrderDetailPage = lazy(() => import('@/pages/os/inventory').then(m => ({ default: m.PurchaseOrderDetailPage })));
const StockLevelsPage = lazy(() => import('@/pages/os/inventory').then(m => ({ default: m.StockLevelsPage })));
const MovementsPage = lazy(() => import('@/pages/os/inventory').then(m => ({ default: m.MovementsPage })));
const ProcurementPage = lazy(() => import('@/pages/os/inventory').then(m => ({ default: m.ProcurementPage })));
const InsightsPage = lazy(() => import('@/pages/os/inventory').then(m => ({ default: m.InsightsPage })));
const NeighborhoodIntelligencePage = lazy(() => import('@/pages/os/inventory').then(m => ({ default: m.NeighborhoodIntelligencePage })));
const ProductConversions = lazy(() => import('@/pages/os/ProductConversions'));
const LegacyInvoiceRepair = lazy(() => import('@/pages/admin/LegacyInvoiceRepair'));
const MarketplaceConnectionPage = lazy(() => import('@/pages/admin/dev/MarketplaceConnectionPage'));
const OSLayout = lazy(() => import('@/pages/os/OSLayout'));
const StoreInventoryPage = lazy(() => import('@/pages/os/inventory/StoreInventoryPage'));
const InventoryAuditLogPage = lazy(() => import('@/pages/os/inventory/InventoryAuditLogPage'));
const TubeIntelligencePage = lazy(() => import('@/pages/TubeIntelligencePage'));
const LiveTubesDetailPage = lazy(() => import('@/pages/os/inventory/dashboard').then(m => ({ default: m.LiveTubesDetailPage })));
const BoxesSoldDetailPage = lazy(() => import('@/pages/os/inventory/dashboard').then(m => ({ default: m.BoxesSoldDetailPage })));
const LowStockDetailPage = lazy(() => import('@/pages/os/inventory/dashboard').then(m => ({ default: m.LowStockDetailPage })));
const TopTierDashboard = lazy(() => import('@/pages/os/toptier/TopTierDashboard'));
const TopTierHubLayout = lazy(() => import('@/pages/os/toptier/TopTierHubLayout'));
const TTOverview = lazy(() => import('@/pages/os/toptier/TTOverview'));
const TTBookings = lazy(() => import('@/pages/os/toptier/TTBookings'));
const TTRevenue = lazy(() => import('@/pages/os/toptier/TTRevenue'));
const TTPlaceholder = lazy(() => import('@/pages/os/toptier/TTPlaceholder'));
const TTPartners = lazy(() => import('@/pages/os/toptier/TTPartners'));
const TTItinerary = lazy(() => import('@/pages/os/toptier/TTItinerary'));
const TTAmbassadors = lazy(() => import('@/pages/os/toptier/TTAmbassadors'));
const TTOperations = lazy(() => import('@/pages/os/toptier/TTOperations'));
const TTAIBrain = lazy(() => import('@/pages/os/toptier/TTAIBrain'));
const PenthouseLayout = lazy(() => import('@/pages/os/toptier/penthouse/PenthouseLayout'));
const PenthouseDashboard = lazy(() => import('@/pages/os/toptier/penthouse/PenthouseDashboard'));
const PenthousePartners = lazy(() => import('@/pages/os/toptier/penthouse/PenthousePartners'));
const PenthouseAffiliates = lazy(() => import('@/pages/os/toptier/penthouse/PenthouseAffiliates'));
const PenthouseMarketplace = lazy(() => import('@/pages/os/toptier/penthouse/PenthouseMarketplace'));
const PenthouseFinance = lazy(() => import('@/pages/os/toptier/penthouse/PenthouseFinance'));
const PenthouseRoles = lazy(() => import('@/pages/os/toptier/penthouse/PenthouseRoles'));
const PenthouseSystem = lazy(() => import('@/pages/os/toptier/penthouse/PenthouseSystem'));
const PenthouseAnalytics = lazy(() => import('@/pages/os/toptier/penthouse/PenthouseAnalytics'));
const PenthouseAudit = lazy(() => import('@/pages/os/toptier/penthouse/PenthouseAudit'));
const PenthouseDrivers = lazy(() => import('@/pages/os/toptier/penthouse/PenthouseDrivers'));
const PenthouseConfirmations = lazy(() => import('@/pages/os/toptier/penthouse/PenthouseConfirmations'));
const PenthouseNightlife = lazy(() => import('@/pages/os/toptier/penthouse/PenthouseNightlife'));

// Unforgettable
const UnforgettableDashboard = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UnforgettableDashboard })));
const UnforgettableStaff = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UnforgettableStaff })));
const UnforgettableStaffProfile = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UnforgettableStaffProfile })));
const UnforgettableStaffNew = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UnforgettableStaffNew })));
const UnforgettableStaffEdit = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UnforgettableStaffEdit })));
const UnforgettableStaffCategories = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UnforgettableStaffCategories })));
const UnforgettableStaffVenues = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UnforgettableStaffVenues })));
const UnforgettableStaffNotes = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UnforgettableStaffNotes })));
const UnforgettableStaffCall = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UnforgettableStaffCall })));
const UnforgettableStaffEmail = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UnforgettableStaffEmail })));
const UnforgettableStaffPerformance = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UnforgettableStaffPerformance })));
const UnforgettableScheduling = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UnforgettableScheduling })));
const UnforgettableSchedulingToday = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UnforgettableSchedulingToday })));
const UnforgettableSchedulingUpcoming = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UnforgettableSchedulingUpcoming })));
const UnforgettableSchedulingGaps = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UnforgettableSchedulingGaps })));
const UnforgettablePayroll = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UnforgettablePayroll })));
const UnforgettablePayrollDetail = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UnforgettablePayrollDetail })));
const UnforgettableDocuments = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UnforgettableDocuments })));
const UnforgettableDocumentDetail = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UnforgettableDocumentDetail })));
const UnforgettableAvailability = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UnforgettableAvailability })));
const UnforgettablePerformance = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UnforgettablePerformance })));
const UnforgettableCommunications = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UnforgettableCommunications })));
const UnforgettableAICalling = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UnforgettableAICalling })));
const UnforgettableAICallDetail = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UnforgettableAICallDetail })));
const UnforgettableOnboarding = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UnforgettableOnboarding })));
const UnforgettableCustomerService = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UnforgettableCustomerService })));
const UnforgettableMedia = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UnforgettableMedia })));
const UnforgettableMediaDetail = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UnforgettableMediaDetail })));
const UTOutreachCommand = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UTOutreachCommand })));
const UTTerritoryIntelligence = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UTTerritoryIntelligence })));
const UTTerritoryControl = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UTTerritoryControl })));
const UTIntelligenceCommandCenter = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UTIntelligenceCommandCenter })));
const UTPlacesLeadFinder = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UTPlacesLeadFinder })));
const UTProductEngine = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UTProductEngine })));
const UTSupplierConsole = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UTSupplierConsole })));
const UTEventBuilder = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UTEventBuilder })));
const UTPartnerDashboard = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UTPartnerDashboard })));
const UTHubLayout = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UTHubLayout })));
const UTIntelligence = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UTIntelligence })));
const UTMarketplaceControl = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UTMarketplaceControl })));
const UTAutomation = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UTAutomation })));
const UTAnalytics = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UTAnalytics })));
const UTPenthouse = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UTPenthouse })));
const UTHallOwnerDashboard = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UTHallOwnerDashboard })));
const UTStaffMemberDashboard = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UTStaffMemberDashboard })));
const UTVenuesManagement = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UTVenuesManagement })));
const UTStaffManagement = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UTStaffManagement })));
const UTPlatformStats = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UTPlatformStats })));
const UTAmbassadorManagement = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UTAmbassadorManagement })));
const UTBusinessRequests = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UTBusinessRequests })));
const UTBusinessQuotes = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UTBusinessQuotes })));
const UTBusinessProducts = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UTBusinessProducts })));
const UTBusinessPackages = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UTBusinessPackages })));
const UTEventBookings = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UTEventBookings })));
const UTLeadIntelligence = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UTLeadIntelligence })));
const UTOutreachEngine = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UTOutreachEngine })));
const UTAutomationRuns = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UTAutomationRuns })));
const UTAmbassadorFinder = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UTAmbassadorFinder })));
const UTPricingEngine = lazy(() => import('@/pages/os/unforgettable').then(m => ({ default: m.UTPricingEngine })));
const UTGrowthEngine = lazy(() => import('@/pages/os/unforgettable/UTGrowthEngine'));
const UTBizOwnerOutreach = lazy(() => import('@/pages/os/unforgettable/UTBizOwnerOutreach'));
const UTCustomerAcquisition = lazy(() => import('@/pages/os/unforgettable/UTCustomerAcquisition'));
const UTPricingIntelligence = lazy(() => import('@/pages/os/unforgettable/PricingIntelligence'));
const UTGrowthSimulator = lazy(() => import('@/pages/os/unforgettable/UTGrowthSimulator'));
const UTBrandKitManager = lazy(() => import('@/pages/os/unforgettable/UTBrandKitManager'));
const UTSupplierManager = lazy(() => import('@/pages/os/unforgettable/UTSupplierManager'));
const UTBrandingPipeline = lazy(() => import('@/pages/os/unforgettable/UTBrandingPipeline'));
const UTBizOwnerDashboard = lazy(() => import('@/pages/os/unforgettable/UTBizOwnerDashboard'));
const UTQuizResults = lazy(() => import('@/pages/os/unforgettable/UTQuizResults'));
const UTConsultations = lazy(() => import('@/pages/os/unforgettable/UTConsultations'));
const UTKitOrders = lazy(() => import('@/pages/os/unforgettable/UTKitOrders'));
const UTDailySummary = lazy(() => import('@/pages/os/unforgettable/UTDailySummary'));
const UTEventCalendar = lazy(() => import('@/pages/os/unforgettable/UTEventCalendar'));
const UTVendorPayments = lazy(() => import('@/pages/os/unforgettable/UTVendorPayments'));
const UTAmbassadorLeaderboard = lazy(() => import('@/pages/os/unforgettable/UTAmbassadorLeaderboard'));
const UTCampaignPerformance = lazy(() => import('@/pages/os/unforgettable/UTCampaignPerformance'));
const UTShopDashboard = lazy(() => import('@/pages/os/unforgettable/UTShopDashboard'));
const UTProductOrganizer = lazy(() => import('@/pages/os/unforgettable/UTProductOrganizer'));
const UTEmailSubscribers = lazy(() => import('@/pages/os/unforgettable/UTEmailSubscribers'));
const UTRevenueDashboard = lazy(() => import('@/pages/os/unforgettable/UTRevenueDashboard'));
const UTPayoutManager = lazy(() => import('@/pages/os/unforgettable/UTPayoutManager'));
const UTAIBrain = lazy(() => import('@/pages/os/unforgettable/UTAIBrain'));
const UTPerformanceInsights = lazy(() => import('@/pages/os/unforgettable/UTPerformanceInsights'));
const UTRFQEngine = lazy(() => import('@/pages/os/unforgettable/UTRFQEngine'));
const UTShippingTracker = lazy(() => import('@/pages/os/unforgettable/UTShippingTracker'));
const UTSupplierFinder = lazy(() => import('@/pages/os/unforgettable/UTSupplierFinder'));
const UTSupplierInbox = lazy(() => import('@/pages/os/unforgettable/UTSupplierInbox'));
const UTSupplierDecisionEngine = lazy(() => import('@/pages/os/unforgettable/UTSupplierDecisionEngine'));
const UTSupplierCommandDashboard = lazy(() => import('@/pages/os/unforgettable/UTSupplierCommandDashboard'));
const UTNegotiationAgent = lazy(() => import('@/pages/os/unforgettable/UTNegotiationAgent'));
const UTNegotiationDashboard = lazy(() => import('@/pages/os/unforgettable/UTNegotiationDashboard'));
const UTSupplierInboxV2 = lazy(() => import('@/pages/os/unforgettable/UTSupplierInboxV2'));
const UTAutoOutreach = lazy(() => import('@/pages/os/unforgettable/UTAutoOutreach'));
const UTShippingQuotes = lazy(() => import('@/pages/os/unforgettable/UTShippingQuotes'));
const UTAutoFinder = lazy(() => import('@/pages/os/unforgettable/UTAutoFinder'));
const UTCategoryDomination = lazy(() => import('@/pages/os/unforgettable/UTCategoryDomination'));
const UTGlobalSupplierControl = lazy(() => import('@/pages/os/unforgettable/UTGlobalSupplierControl'));

// Unforgettable CRM
const UnforgettableEventHalls = lazy(() => import('@/pages/crm/unforgettable').then(m => ({ default: m.UnforgettableEventHalls })));
const UnforgettableEventHallDetail = lazy(() => import('@/pages/crm/unforgettable').then(m => ({ default: m.UnforgettableEventHallDetail })));
const UnforgettableRentals = lazy(() => import('@/pages/crm/unforgettable').then(m => ({ default: m.UnforgettableRentals })));
const UnforgettableInfluencers = lazy(() => import('@/pages/crm/unforgettable').then(m => ({ default: m.UnforgettableInfluencers })));
const UnforgettableMediaVault = lazy(() => import('@/pages/crm/unforgettable').then(m => ({ default: m.UnforgettableMediaVault })));
const UnforgettablePartySuppliers = lazy(() => import('@/pages/crm/unforgettable').then(m => ({ default: m.UnforgettablePartySuppliers })));
const UnforgettableGifts = lazy(() => import('@/pages/crm/unforgettable').then(m => ({ default: m.UnforgettableGifts })));

// Other OS modules
const ICleanDashboard = lazy(() => import('@/pages/os/iclean/ICleanDashboard'));
const PlayboxxxDashboard = lazy(() => import('@/pages/os/playboxxx/PlayboxxxDashboard'));
const SpecialNeedsDashboard = lazy(() => import('@/pages/os/specialneeds/SpecialNeedsDashboard'));
const FundingDashboard = lazy(() => import('@/pages/os/funding/FundingDashboard'));
const GrantsDashboard = lazy(() => import('@/pages/os/grants/GrantsDashboard'));
const WealthEngineDashboard = lazy(() => import('@/pages/os/wealth/WealthEngineDashboard'));
// Funding Machine (Floor 10)
const FundingMachineDashboard = lazy(() => import('@/pages/funding-machine/FundingMachineDashboard'));
const FundingMachineIntake = lazy(() => import('@/pages/funding-machine/ClientIntakePage'));
const FundingMachineClientProfile = lazy(() => import('@/pages/funding-machine/ClientProfilePage'));
const FundingMachineCreditRepair = lazy(() => import('@/pages/funding-machine/CreditRepairPage'));
const FundingMachineBusinessBuilder = lazy(() => import('@/pages/funding-machine/BusinessBuilderPage'));
const FundingMachineBureauIntel = lazy(() => import('@/pages/funding-machine/BureauIntelPage'));
const FundingMachineFundingMatrix = lazy(() => import('@/pages/funding-machine/FundingMatrixPage'));
const FundingMachineVelocity = lazy(() => import('@/pages/funding-machine/VelocityCalculatorPage'));
const FundingMachineTradelineVault = lazy(() => import('@/pages/funding-machine/TradelineVaultPage'));
const FundingMachineTaskCards = lazy(() => import('@/pages/funding-machine/TaskCardsPage'));
const FundingMachineMorningBriefing = lazy(() => import('@/pages/funding-machine/MorningBriefingPage'));
const FundingMachineSettings = lazy(() => import('@/pages/funding-machine/FundingMachineSettingsPage'));
const FundingClientPortal = lazy(() => import('@/pages/funding-machine/ClientPortalPage'));
const FundingMachineApplications = lazy(() => import('@/pages/funding-machine/ApplicationsPage'));
const BettingDashboard = lazy(() => import('@/pages/os/betting/BettingDashboard'));
const LineIntake = lazy(() => import('@/pages/os/betting/LineIntake'));
const SimulationPage = lazy(() => import('@/pages/os/betting/SimulationPage'));
const ParlayLab = lazy(() => import('@/pages/os/betting/ParlayLab'));
const HedgeCenter = lazy(() => import('@/pages/os/betting/HedgeCenter'));
const OwnerInternal = lazy(() => import('@/pages/os/betting/OwnerInternal'));
const NBADailyBoard = lazy(() => import('@/pages/os/betting/NBADailyBoard'));
const StatsInspector = lazy(() => import('@/pages/os/betting/StatsInspector'));
const BettingSettings = lazy(() => import('@/pages/os/betting/BettingSettings'));
const BettingWorkflow = lazy(() => import('@/pages/os/betting/BettingWorkflow'));
const PlatformsDashboard = lazy(() => import('@/pages/os/betting/PlatformsDashboard'));
const LineShopping = lazy(() => import('@/pages/os/betting/LineShopping'));
const PickEntryWizard = lazy(() => import('@/pages/os/betting/PickEntryWizard'));
const EntriesList = lazy(() => import('@/pages/os/betting/EntriesList'));
const BettingResultsPage = lazy(() => import('@/pages/os/betting/ResultsPage'));
const SportsBettingOS = lazy(() => import('@/pages/sports-betting/SportsBettingOS'));
const SystemIntegrity = lazy(() => import('@/pages/admin/SystemIntegrity'));
const SBOProfitCenter = lazy(() => import('@/pages/os/betting/SBOProfitCenter'));
const SBOWalletTracker = lazy(() => import('@/pages/os/betting/SBOWalletTracker'));
const SBOCapperTracker = lazy(() => import('@/pages/os/betting/SBOCapperTracker'));
const SBOSignalAlignment = lazy(() => import('@/pages/os/betting/SBOSignalAlignment'));
const SBOTonightPage = lazy(() => import('@/pages/sports-betting/pages/TonightPage'));
const SBOPropsPage = lazy(() => import('@/pages/sports-betting/pages/PropsPage'));
const SBOPropsIntelligencePage = lazy(() => import('@/pages/sports-betting/pages/PropsIntelligencePage'));
const SBOParlayPage = lazy(() => import('@/pages/sports-betting/pages/ParlayPage'));
const SBOValuePage = lazy(() => import('@/pages/sports-betting/pages/ValuePage'));
const SBOAccuracyPage = lazy(() => import('@/pages/sports-betting/pages/AccuracyPage'));
const SBOModelPage = lazy(() => import('@/pages/sports-betting/pages/ModelPage'));
const SBOMyBetsPage = lazy(() => import('@/pages/sports-betting/pages/MyBetsPage'));
const SBOSimulationPage = lazy(() => import('@/pages/sports-betting/pages/SimulationSBOPage'));
const SBOVAEntryPage = lazy(() => import('@/pages/sports-betting/pages/VAEntryPage'));
const SBOPrizePicksPage = lazy(() => import('@/pages/sports-betting/pages/PrizePicksPage'));
const SBOBovadaPage = lazy(() => import('@/pages/sports-betting/pages/BovadaPage'));
const PropIntelligenceHub = lazy(() => import('@/pages/sports-betting/pages/PropIntelligenceHub'));
const SBOSMSPage = lazy(() => import('@/pages/sports-betting/pages/SMSPage'));
const SBOHistoryPage = lazy(() => import('@/pages/sports-betting/pages/HistoryPage'));
const SBOHealthPage = lazy(() => import('@/pages/sports-betting/pages/HealthPage'));
const SBOSyncPage = lazy(() => import('@/pages/sports-betting/pages/SyncPage'));
const BikerDashboard = lazy(() => import('@/pages/os/biker/BikerDashboard'));
const ModuleDiagnosticsPage = lazy(() => import('@/pages/ModuleDiagnosticsPage'));
const InvoiceForensicsConsole = lazy(() => import('@/pages/diagnostics/InvoiceForensicsConsole'));

// Delivery & Logistics
const DeliveryDashboard = lazy(() => import('@/pages/delivery').then(m => ({ default: m.DeliveryDashboard })));
const DeliveriesBoard = lazy(() => import('@/pages/delivery').then(m => ({ default: m.DeliveriesBoard })));
const DriversManagement = lazy(() => import('@/pages/delivery').then(m => ({ default: m.DriversManagement })));
const BikersManagement = lazy(() => import('@/pages/delivery').then(m => ({ default: m.BikersManagement })));
const BikerProfile = lazy(() => import('@/pages/delivery').then(m => ({ default: m.BikerProfile })));
const DriverProfile = lazy(() => import('@/pages/delivery').then(m => ({ default: m.DriverProfile })));
const BikerTasks = lazy(() => import('@/pages/delivery').then(m => ({ default: m.BikerTasks })));
const LocationsManagement = lazy(() => import('@/pages/delivery').then(m => ({ default: m.LocationsManagement })));
const WorkerPayouts = lazy(() => import('@/pages/delivery').then(m => ({ default: m.WorkerPayouts })));
const DebtCollection = lazy(() => import('@/pages/delivery').then(m => ({ default: m.DebtCollection })));
const DriverHome = lazy(() => import('@/pages/delivery').then(m => ({ default: m.DriverHome })));
const DriverOS = lazy(() => import('@/pages/delivery').then(m => ({ default: m.DriverOS })));
const DeliveryMyRoute = lazy(() => import('@/pages/delivery').then(m => ({ default: m.DeliveryMyRoute })));
const DeliveryHeatmapPage = lazy(() => import('@/pages/delivery').then(m => ({ default: m.HeatmapPage })));
const DeliveryIssueDetailPage = lazy(() => import('@/pages/delivery').then(m => ({ default: m.IssueDetailPage })));
const DeliveryRouteSuggestionsPage = lazy(() => import('@/pages/delivery').then(m => ({ default: m.RouteSuggestionsPage })));
const DriverRoutesCompleted = lazy(() => import('@/pages/delivery').then(m => ({ default: m.DriverRoutesCompleted })));
const DriverStopsCompleted = lazy(() => import('@/pages/delivery').then(m => ({ default: m.DriverStopsCompleted })));
const DriverIssuesReported = lazy(() => import('@/pages/delivery').then(m => ({ default: m.DriverIssuesReported })));
const RouteManagerPage = lazy(() => import('@/pages/delivery').then(m => ({ default: m.RouteManagerPage })));
const AllRoutesPage = lazy(() => import('@/pages/delivery').then(m => ({ default: m.AllRoutesPage })));
const MultiBrandDeliveryPage = lazy(() => import('@/pages/delivery').then(m => ({ default: m.MultiBrandDeliveryPage })));
const LiveMapPage = lazy(() => import('@/pages/delivery').then(m => ({ default: m.LiveMapPage })));
const LiveMapCommandCenter = lazy(() => import('@/pages/delivery').then(m => ({ default: m.LiveMapCommandCenter })));
const DeliveryRouteOpsCenter = lazy(() => import('@/pages/delivery').then(m => ({ default: m.RouteOpsCenter })));
const MyRouteToday = lazy(() => import('@/pages/delivery').then(m => ({ default: m.MyRouteToday })));
const AutonomyConsole = lazy(() => import('@/pages/delivery').then(m => ({ default: m.AutonomyConsole })));
const DeliveryDispatchPage = lazy(() => import('@/pages/delivery').then(m => ({ default: m.DeliveryDispatchPage })));
const DeliveryStoreProfile = lazy(() => import('@/pages/delivery/StoreProfile'));
const DeliveryRouteDetailPage = lazy(() => import('@/pages/delivery/DeliveryRouteDetail'));

// Grabba
const GrabbaClusterDashboard = lazy(() => import('@/pages/grabba/GrabbaClusterDashboard'));
const UnifiedUploadCenter = lazy(() => import('@/pages/grabba/UnifiedUploadCenter'));
const MultiBrandDelivery = lazy(() => import('@/pages/grabba/MultiBrandDelivery'));
const StoreMasterProfile = lazy(() => import('@/pages/grabba/StoreMasterProfile'));
const BrandCRM = lazy(() => import('@/pages/grabba/BrandCRM'));
const BrandSelector = lazy(() => import('@/pages/grabba/BrandSelector'));
const BrandCommunications = lazy(() => import('@/pages/grabba/BrandCommunications'));
const AIInsights = lazy(() => import('@/pages/grabba/AIInsights'));
const GrabbaCRM = lazy(() => import('@/pages/grabba/GrabbaCRM'));
const GrabbaCommunication = lazy(() => import('@/pages/grabba/GrabbaCommunication'));
const GrabbaInventory = lazy(() => import('@/pages/grabba/GrabbaInventory'));
const GrabbaProduction = lazy(() => import('@/pages/grabba/GrabbaProduction'));
const GrabbaDeliveries = lazy(() => import('@/pages/grabba/GrabbaDeliveries'));
const GrabbaAssignments = lazy(() => import('@/pages/grabba/GrabbaAssignments'));
const GrabbaAmbassadors = lazy(() => import('@/pages/grabba/GrabbaAmbassadors'));
const AmbassadorProfile = lazy(() => import('@/pages/grabba/AmbassadorProfile'));
const GrabbaWholesalePlatform = lazy(() => import('@/pages/grabba/GrabbaWholesalePlatform'));
const GrabbaFinance = lazy(() => import('@/pages/grabba/GrabbaFinance'));
const GrabbaCommandPenthouse = lazy(() => import('@/pages/grabba/GrabbaCommandPenthouse'));
const GrabbaTextCenter = lazy(() => import('@/pages/grabba/GrabbaTextCenter'));
const GrabbaEmailCenter = lazy(() => import('@/pages/grabba/GrabbaEmailCenter'));
const GrabbaCallCenter = lazy(() => import('@/pages/grabba/GrabbaCallCenter'));
const GrabbaCommunicationLogs = lazy(() => import('@/pages/grabba/GrabbaCommunicationLogs'));
const GrabbaAutopilotConsole = lazy(() => import('@/pages/grabba/GrabbaAutopilotConsole'));
const GrabbaAutopilotDashboard = lazy(() => import('@/pages/grabba/GrabbaAutopilotDashboard'));
const GrabbaCommandConsole = lazy(() => import('@/pages/grabba/GrabbaCommandConsole'));
const GrabbaAICommandConsole = lazy(() => import('@/pages/grabba/GrabbaAICommandConsole'));
const ResultsPage = lazy(() => import('@/pages/grabba/ResultsPage'));
const ActionQueuePage = lazy(() => import('@/pages/grabba/ActionQueuePage'));
const GrabbaRoutesPage = lazy(() => import('@/pages/grabba/RoutesPage'));
const DrillDownPage = lazy(() => import('@/pages/grabba/drilldown/DrillDownPage'));
const AiCommandConsole = lazy(() => import('@/pages/grabba/AiCommandConsole'));
const AiPlaybooks = lazy(() => import('@/pages/grabba/AiPlaybooks'));
const AiRoutines = lazy(() => import('@/pages/grabba/AiRoutines'));
const RiskRadar = lazy(() => import('@/pages/grabba/RiskRadar'));
const FollowUpSettings = lazy(() => import('@/pages/grabba/FollowUpSettings'));
const DailyBriefing = lazy(() => import('@/pages/grabba/DailyBriefing'));
const AIOperationsDashboard = lazy(() => import('@/pages/grabba/ai-operations/AIOperationsDashboard'));
const AITasks = lazy(() => import('@/pages/grabba/ai-operations/AITasks'));
const AIPredictions = lazy(() => import('@/pages/grabba/ai-operations/AIPredictions'));
const AIAlerts = lazy(() => import('@/pages/grabba/ai-operations/AIAlerts'));
const Floor9Hub = lazy(() => import('@/pages/floor9').then(m => ({ default: m.Floor9Hub })));
const Floor9Playbooks = lazy(() => import('@/pages/floor9').then(m => ({ default: m.Floor9Playbooks })));
const Floor9ActionQueue = lazy(() => import('@/pages/floor9').then(m => ({ default: m.Floor9ActionQueue })));
const Floor9InstinctLog = lazy(() => import('@/pages/floor9').then(m => ({ default: m.Floor9InstinctLog })));
const Floor9Results = lazy(() => import('@/pages/floor9').then(m => ({ default: m.Floor9Results })));
const Floor9Router = lazy(() => import('@/routes/Floor9Router'));
const BackupControlPage = lazy(() => import('@/pages/grabba/BackupControlPage'));
const CommandExport = lazy(() => import('@/pages/floor-exports').then(m => ({ default: m.CommandExport })));
const Floor1Export = lazy(() => import('@/pages/floor-exports').then(m => ({ default: m.Floor1Export })));
const Floor2Export = lazy(() => import('@/pages/floor-exports').then(m => ({ default: m.Floor2Export })));
const Floor3Export = lazy(() => import('@/pages/floor-exports').then(m => ({ default: m.Floor3Export })));
const Floor4Export = lazy(() => import('@/pages/floor-exports').then(m => ({ default: m.Floor4Export })));
const Floor5Export = lazy(() => import('@/pages/floor-exports').then(m => ({ default: m.Floor5Export })));
const Floor6Export = lazy(() => import('@/pages/floor-exports').then(m => ({ default: m.Floor6Export })));
const Floor7Export = lazy(() => import('@/pages/floor-exports').then(m => ({ default: m.Floor7Export })));
const Floor8Export = lazy(() => import('@/pages/floor-exports').then(m => ({ default: m.Floor8Export })));
const Floor9Export = lazy(() => import('@/pages/floor-exports').then(m => ({ default: m.Floor9Export })));
const FinancialDashboard = lazy(() => import('@/pages/grabba/FinancialDashboard'));
const PersonalFinance = lazy(() => import('@/pages/grabba/PersonalFinance'));
const PayrollManager = lazy(() => import('@/pages/grabba/PayrollManager'));
const AdvisorPenthouse = lazy(() => import('@/pages/grabba/AdvisorPenthouse'));
const AuditEnginePage = lazy(() => import('@/pages/penthouse/AuditEnginePage'));
const FloorBlueprint = lazy(() => import('@/pages/penthouse/FloorBlueprint'));
const InstinctLog = lazy(() => import('@/pages/grabba/InstinctLog'));
const GrabbaNeighborhoodPerformance = lazy(() => import('@/pages/grabba/GrabbaNeighborhoodPerformance'));
const GrabbaClusterCommunications = lazy(() => import('@/pages/grabba/GrabbaClusterCommunications'));
const GrabbaClusterAnalytics = lazy(() => import('@/pages/grabba/GrabbaClusterAnalytics'));
const MemoryBackfill = lazy(() => import('@/pages/grabba/MemoryBackfill'));
const ChangeControlCenter = lazy(() => import('@/pages/grabba/ChangeControlCenter'));
const ChangeControlAudit = lazy(() => import('@/pages/grabba/ChangeControlAudit'));

// AI
const AIWorkforce = lazy(() => import('@/pages/ai/Workforce'));

// System
const DynastyAutomations = lazy(() => import('@/pages/DynastyAutomations'));
const AICEOControlRoom = lazy(() => import('@/pages/AICEOControlRoom'));
const BrandPlaceholder = lazy(() => import('@/pages/BrandPlaceholder'));

// Governance
const GovernanceCommandCenter = lazy(() => import('@/pages/admin/GovernanceCommandCenter'));
const Floor9Observation = lazy(() => import('@/pages/floor9/Floor9Observation'));

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
    <RoleRouteGuard>
      <Outlet />
    </RoleRouteGuard>
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
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* PUBLIC ROUTES (No authentication required)                                   */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      
      {/* Public routes wrapped in PublicLayout (marketing nav + footer) */}
      <Route element={<PublicLayout />}>
        <Route path="/public" element={<LandingRedirect />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/store" element={<ShopifyStore />} />
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
      <Route path="/portal" element={<FundingClientPortal />} />
      <Route path="/portal/register" element={<PortalRegister />} />
      <Route path="/portal/driver/login" element={<DriverLogin />} />
      <Route path="/portal/biker/login" element={<BikerLogin />} />
      {/* Public Ambassador Application Form */}
      <Route path="/apply/ambassador" element={<AmbassadorApplication />} />
      <Route path="/ambassador/login" element={<AmbassadorLogin />} />
      <Route path="/ambassador/set-password" element={<AmbassadorSetPassword />} />
      <Route path="/ut/ambassador/dashboard" element={<UTAmbassadorDashboard />} />
      {/* Public Invite Signup - Primary and fallback routes */}
      <Route path="/signup" element={<InviteSignup />} />
      <Route path="/invite/accept" element={<InviteSignup />} />
      <Route path="/invite/ambassador/:token" element={<AmbassadorInviteAccept />} />
      <Route path="/accept-invite" element={<Navigate to="/signup" replace />} />
      {/* Brandaro Public Proposal Viewer */}
      <Route path="/proposal/:token" element={<PublicProposalPage />} />
      {/* Brandaro Public Client Demo View */}
      <Route path="/client/:token" element={<ClientDemoViewPage />} />

      {/* VA Portal — Public routes */}
      <Route path="/va/auth" element={<VAAuthPage />} />
      <Route path="/pay/:invoiceId" element={<PayInvoicePage />} />

      {/* VA Portal — Protected routes */}
      <Route path="/va/dashboard" element={<ProtectedRoute><VADashboard /></ProtectedRoute>} />
      <Route path="/va/profile" element={<ProtectedRoute><VAProfilePage /></ProtectedRoute>} />
      <Route path="/va/lead-discovery" element={<ProtectedRoute><VADashboard /></ProtectedRoute>} />
      <Route path="/admin/numbers" element={<ProtectedRoute><RequireRole allowedRoles={['admin', 'owner']} fallbackPath="/va/dashboard"><AdminNumbersPage /></RequireRole></ProtectedRoute>} />
      <Route path="/admin/leaderboard" element={<ProtectedRoute><RequireRole allowedRoles={['admin', 'owner']} fallbackPath="/va/dashboard"><AdminLeaderboardPage /></RequireRole></ProtectedRoute>} />
      <Route path="/admin/call-review" element={<ProtectedRoute><RequireRole allowedRoles={['admin', 'owner']} fallbackPath="/va/dashboard"><AdminCallReviewPage /></RequireRole></ProtectedRoute>} />
      <Route path="/admin/monitor" element={<ProtectedRoute><RequireRole allowedRoles={['admin', 'owner']} fallbackPath="/va/dashboard"><AdminVAMonitorPage /></RequireRole></ProtectedRoute>} />
      <Route path="/admin/dnc" element={<ProtectedRoute><RequireRole allowedRoles={['admin', 'owner']} fallbackPath="/va/dashboard"><AdminDNCManagerPage /></RequireRole></ProtectedRoute>} />

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
        <Route path="/gasmask/route-engine" element={<RouteEnginePage />} />
        <Route path="/gasmask/driver-route" element={<GasmaskDriverRoutePage />} />
        <Route path="/gasmask/agent-center" element={<AgentCenterPage />} />
        <Route path="/dynasty/agents" element={<AgentCenterPage />} />
        <Route path="/gasmask/note-cleaner" element={<NoteCleanerPage />} />

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

        {/* 📞 Dynasty Connect Hub */}
        <Route path="/dynasty-connect" element={<DCLayout />}>
          <Route index element={<DCCommandCenter />} />
          <Route path="live" element={<DCLiveCalls />} />
          <Route path="campaigns" element={<DCCampaigns />} />
          <Route path="campaigns/builder" element={<DCCampaignBuilder />} />
          <Route path="campaigns/outbound" element={<DCCampaignManager />} />
          <Route path="agents" element={<DCAgents />} />
          <Route path="agents/playbooks" element={<DCAgents />} />
          <Route path="intelligence" element={<DCIntelligence />} />
          <Route path="intelligence/self-learn" element={<DCAgents />} />
          <Route path="pipelines" element={<DCPipelines />} />
          <Route path="pipelines/surplus-funds" element={<SurplusFundsPipeline />} />
          <Route path="pipelines/real-estate" element={<DCRealEstatePipeline />} />
          <Route path="pipelines/unforgettable-times" element={<UnforgettableTimesPipeline />} />
          <Route path="pipelines/playboxxx" element={<PlayBoxxxPipeline />} />
          <Route path="pipelines/brightsun-energy" element={<BrightSunPipeline />} />
          <Route path="pipelines/gasmask-new-stores" element={<GasMaskNewStoresPipeline />} />
          <Route path="infrastructure" element={<DCInfrastructure />} />
          <Route path="infrastructure/numbers" element={<DCInfrastructure />} />
          <Route path="infrastructure/phone-setup" element={<DCPhoneSetup />} />
          <Route path="phone-numbers" element={<DCPhoneNumbers />} />
          <Route path="clients" element={<DCClients />} />
        </Route>

        {/* 🎙️ Voice Ops Dashboard */}
        <Route path="/voice-ops" element={<VoiceOpsLayout />}>
          <Route index element={<VODashboard />} />
          <Route path="numbers" element={<VONumbers />} />
          <Route path="agents" element={<VOAgents />} />
          <Route path="secrets" element={<VOSecrets />} />
          <Route path="outbound" element={<VOOutbound />} />
        </Route>

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
        <Route path="/crm/contact-management" element={<ContactManagementPage />} />
        
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

        {/* Legacy Real Estate routes (kept under legacy paths to avoid overriding new Real Estate OS hub) */}
        <Route path="/real-estate-legacy" element={<RealEstateLayout><RealEstate /></RealEstateLayout>} />
        <Route path="/real-estate-legacy/leads" element={<RealEstateLayout><RealEstateLeads /></RealEstateLayout>} />
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

        {/* Dynasty OS — TopTier Hub */}
        <Route path="/os/toptier" element={<TopTierHubLayout />}>
          <Route index element={<TTOverview />} />
          <Route path="bookings" element={<TTBookings />} />
          <Route path="revenue" element={<TTRevenue />} />
          <Route path="partners" element={<TTPartners />} />
          <Route path="itinerary" element={<TTItinerary />} />
          <Route path="ambassadors" element={<TTAmbassadors />} />
          <Route path="operations" element={<TTOperations />} />
          <Route path="ai" element={<TTAIBrain />} />
          <Route path="settings" element={<TTPlaceholder />} />
        </Route>

        {/* Penthouse Control System — Admin/Owner Only */}
        <Route path="/os/toptier/penthouse" element={
          <ProtectedRoute>
            <RequireRole allowedRoles={['owner', 'admin']} showLocked>
              <PenthouseLayout />
            </RequireRole>
          </ProtectedRoute>
        }>
          <Route index element={<PenthouseDashboard />} />
          <Route path="partners" element={<PenthousePartners />} />
          <Route path="affiliates" element={<PenthouseAffiliates />} />
          <Route path="marketplace" element={<PenthouseMarketplace />} />
          <Route path="drivers" element={<PenthouseDrivers />} />
          <Route path="confirmations" element={<PenthouseConfirmations />} />
          <Route path="nightlife" element={<PenthouseNightlife />} />
          <Route path="finance" element={<PenthouseFinance />} />
          <Route path="roles" element={<PenthouseRoles />} />
          <Route path="system" element={<PenthouseSystem />} />
          <Route path="analytics" element={<PenthouseAnalytics />} />
          <Route path="audit" element={<PenthouseAudit />} />
        </Route>
        
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
        {/* Floor 10 — Dynasty Funding Machine */}
        <Route path="/funding-machine" element={<FundingMachineDashboard />} />
        <Route path="/funding-machine/intake" element={<FundingMachineIntake />} />
        <Route path="/funding-machine/client/:clientId" element={<FundingMachineClientProfile />} />
        <Route path="/funding-machine/credit-repair" element={<FundingMachineCreditRepair />} />
        <Route path="/funding-machine/business-builder" element={<FundingMachineBusinessBuilder />} />
        <Route path="/funding-machine/bureau-intel" element={<FundingMachineBureauIntel />} />
        <Route path="/funding-machine/funding-matrix" element={<FundingMachineFundingMatrix />} />
        <Route path="/funding-machine/applications" element={<FundingMachineApplications />} />
        <Route path="/funding-machine/velocity" element={<FundingMachineVelocity />} />
        <Route path="/funding-machine/tradeline-vault" element={<FundingMachineTradelineVault />} />
        <Route path="/funding-machine/tasks" element={<FundingMachineTaskCards />} />
        <Route path="/funding-machine/morning-briefing" element={<FundingMachineMorningBriefing />} />
        <Route path="/funding-machine/settings" element={<FundingMachineSettings />} />
        <Route path="/os/sports-betting" element={<Navigate to="/os/sports-betting/dashboard" replace />} />
        <Route path="/os/sports-betting/analytics" element={<Navigate to="/os/sports-betting/dashboard" replace />} />
        <Route path="/os/sports-betting/dashboard" element={<BettingDashboard />} />
        <Route path="/os/sports-betting/ai-os" element={<SportsBettingOS />} />
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
        <Route path="/os/sports-betting/profit-center" element={<SBOProfitCenter />} />
        <Route path="/sbo-ai-engine/wallet-intelligence" element={<SBOWalletTracker />} />
        <Route path="/sbo-ai-engine/capper-intelligence" element={<SBOCapperTracker />} />
        <Route path="/sbo-ai-engine/signal-alignment" element={<SBOSignalAlignment />} />
        <Route path="/sbo-ai-engine/tonight" element={<SBOTonightPage />} />
        <Route path="/sbo-ai-engine/props" element={<Navigate to="/sbo-ai-engine/prop-hub" replace />} />
        <Route path="/sbo-ai-engine/props-intelligence" element={<Navigate to="/sbo-ai-engine/prop-hub" replace />} />
        <Route path="/sbo-ai-engine/parlay" element={<Navigate to="/sbo-ai-engine/prop-hub" replace />} />
        <Route path="/sbo-ai-engine/value" element={<SBOValuePage />} />
        <Route path="/sbo-ai-engine/accuracy" element={<SBOAccuracyPage />} />
        <Route path="/sbo-ai-engine/model" element={<SBOModelPage />} />
        <Route path="/sbo-ai-engine/my-bets" element={<SBOMyBetsPage />} />
        <Route path="/sbo-ai-engine/simulation" element={<SBOSimulationPage />} />
        <Route path="/sbo-ai-engine/va-entry" element={<SBOVAEntryPage />} />
        <Route path="/sbo-ai-engine/prizepicks" element={<Navigate to="/sbo-ai-engine/prop-hub" replace />} />
        <Route path="/sbo-ai-engine/bovada" element={<Navigate to="/sbo-ai-engine/prop-hub" replace />} />
        <Route path="/sbo-ai-engine/prop-hub" element={<PropIntelligenceHub />} />
        <Route path="/sbo-ai-engine/sms" element={<SBOSMSPage />} />
        <Route path="/sbo-ai-engine/history" element={<SBOHistoryPage />} />
        <Route path="/sbo-ai-engine/health" element={<SBOHealthPage />} />
        <Route path="/sbo-ai-engine/sync" element={<SBOSyncPage />} />
        <Route path="/admin/system-integrity" element={<SystemIntegrity />} />
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
        <Route path="/system/invoice-forensics" element={
          <RequireRole allowedRoles={['admin']} showLocked>
            <InvoiceForensicsConsole />
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

        {/* ═══ PENTHOUSE — Floor Blueprint (Operating Manual) ═══ */}
        <Route path="/penthouse/blueprint" element={
          <RequireRole allowedRoles={['admin']} showLocked>
            <FloorBlueprint />
          </RequireRole>
        } />


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
          <Route path="ai-auto-text" element={<Navigate to="/communication/messaging-hub" replace />} />
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
          <Route path="provision-numbers" element={<PhoneProvisioningPage />} />
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
      <Route element={<ProtectedRoute><RoleRouteGuard><OpsLayout /></RoleRouteGuard></ProtectedRoute>}>
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
      <Route path="/grabba/export/backup" element={
        <ProtectedRoute><RequireRole allowedRoles={['admin', 'owner']} showLocked><Layout><GrabbaLayout><BackupControlPage /></GrabbaLayout></Layout></RequireRole></ProtectedRoute>
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

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* SURPLUS FUNDS OS                                                              */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      <Route element={<ProtectedLayout />}>
        <Route path="/surplus-funds" element={<SFLayout />}>
          <Route index element={<SFCommandCenter />} />
          <Route path="leads" element={<SFLeadPipeline />} />
          <Route path="discovery" element={<SFDiscovery />} />
          <Route path="campaigns" element={<SFCampaigns />} />
          <Route path="cases" element={<SFCases />} />
          <Route path="attorneys" element={<SFAttorneys />} />
          <Route path="documents" element={<SFDocuments />} />
          <Route path="automation" element={<SFAutomation />} />
          <Route path="analytics" element={<SFAnalytics />} />
        </Route>
      </Route>

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* BRIGHTSUN SOLAR OS                                                         */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      <Route element={<ProtectedLayout />}>
        <Route path="/solar" element={<SolarLayout />}>
          <Route index element={<SolarCommandCenter />} />
          <Route path="leads" element={<SolarLeadIntelligence />} />
          <Route path="outreach" element={<SolarOutreach />} />
          <Route path="qualification" element={<SolarQualification />} />
          <Route path="appointments" element={<SolarAppointments />} />
          <Route path="live-calls" element={<SolarLiveCallAssist />} />
          <Route path="deals" element={<SolarDeals />} />
          <Route path="partners" element={<SolarPartnersAdvanced />} />
          <Route path="agents" element={<SolarAgents />} />
          <Route path="ai-brain" element={<SolarAIBrain />} />
          <Route path="analytics" element={<SolarAnalytics />} />
          <Route path="estimator" element={<SolarEstimator />} />
          <Route path="closing" element={<SolarClosingDashboard />} />
          <Route path="followups" element={<SolarFollowUps />} />
          <Route path="bookings" element={<SolarBookings />} />
        </Route>
      </Route>

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* REAL ESTATE OS                                                             */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      <Route element={<ProtectedLayout />}>
        <Route path="/real-estate" element={<RELayout />}>
          <Route index element={<RECommandCenter />} />
          <Route path="leads" element={<RELeadPipeline />} />
          <Route path="campaigns" element={<RECampaigns />} />
          <Route path="deals" element={<REDeals />} />
          <Route path="buyers" element={<REBuyers />} />
          <Route path="va-desk" element={<REVADesk />} />
          <Route path="analyzer" element={<REAnalyzer />} />
          <Route path="automation" element={<REAutomation />} />
          <Route path="markets" element={<REMarkets />} />
          <Route path="analytics" element={<REAnalytics />} />
        </Route>
      </Route>

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      <Route element={<ProtectedLayout />}>
        <Route path="/brandaro" element={<BrandaroHubLayout />}>
          {/* ── Command ── */}
          <Route index element={<BrandaroWarRoom />} />
          <Route path="ceo" element={<CEODashboardPage />} />

          {/* ── Sales Floor ── */}
          <Route path="calling" element={<CallingOpsPage />} />
          <Route path="va-dashboard" element={<VADashboardPage />} />
          <Route path="va-command" element={<VACommandCenterPage />} />
          <Route path="va-manager" element={<VAManagerPage />} />
          <Route path="va-workspace" element={<VAWorkspacePage />} />
          <Route path="va-performance" element={<VAPerformancePage />} />
          <Route path="va-roster" element={<VARosterPage />} />
          <Route path="ai-distribution" element={<AIDistributionPage />} />
          <Route path="closer-ai" element={<CloserAIPage />} />

          {/* ── Pipeline ── */}
          <Route path="leads" element={<LeadDatabasePage />} />
          <Route path="crm-pipeline" element={<CRMPipelinePage />} />
          <Route path="inbox" element={<BrandaroInboxPage />} />
          <Route path="lead-discovery" element={<LeadDiscoveryPage />} />
          <Route path="scout-agent" element={<ScoutAgentPage />} />
          <Route path="lead-qualification" element={<LeadQualificationPage />} />
          <Route path="follow-ups" element={<FollowUpEnginePage />} />
          <Route path="proposals" element={<ProposalBuilderPage />} />
          <Route path="build-pipeline" element={<BuildPipelinePage />} />
          <Route path="demo-engine" element={<DemoEnginePage />} />

          {/* ── Execution ── */}
          <Route path="production-pipeline" element={<ProductionPipelinePage />} />
          <Route path="callbacks" element={<FollowUpEnginePage />} />
          <Route path="tasks" element={<ProductionPipelinePage />} />
          <Route path="alerts" element={<BrandaroWarRoom />} />

          {/* ── Intelligence ── */}
          <Route path="ai-brain" element={<CloserAIPage />} />
          <Route path="personalities" element={<VAManagerPage />} />
          <Route path="emotion-engine" element={<CloserAIPage />} />
          <Route path="learning" element={<OptimizationEnginePage />} />
          <Route path="patterns" element={<ResultEnginePage />} />

          {/* ── Domination ── */}
          <Route path="domination" element={<OptimizationEnginePage />} />
          <Route path="competitors" element={<CompetitorTakeoverPage />} />
          <Route path="offers" element={<OptimizationEnginePage />} />
          <Route path="positioning" element={<OptimizationEnginePage />} />

          {/* ── Growth ── */}
          <Route path="revenue" element={<RevenueAnalyticsPage />} />
          <Route path="ads-engine" element={<AdsEnginePage />} />
          <Route path="google-domination" element={<GoogleDominationPage />} />
          <Route path="optimization" element={<OptimizationEnginePage />} />
          <Route path="result-engine" element={<ResultEnginePage />} />

          {/* ── Clients ── */}
          <Route path="clients" element={<ClientPortalPage />} />
          <Route path="retention" element={<RetentionDashboardPage />} />
          <Route path="reporting" element={<ClientReportingPage />} />
          <Route path="campaigns" element={<CampaignManagerPage />} />
          <Route path="reviews" element={<ReviewQueuePage />} />
          <Route path="phone-numbers" element={<BrandaroPhoneNumbersPage />} />
          <Route path="canva-assets" element={<CanvaAssetsPage />} />
          <Route path="canva-templates" element={<CanvaTemplatesPage />} />
        </Route>
      </Route>

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* UNFORGETTABLE TIMES HUB                                                    */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      <Route element={<ProtectedLayout />}>
        <Route path="/os/unforgettable" element={<UTHubLayout />}>
          <Route index element={<UTPenthouse />} />
          <Route path="intelligence" element={<UTIntelligenceCommandCenter />} />
          <Route path="territory" element={<UTTerritoryControl />} />
          <Route path="territory-heatmap" element={<UTTerritoryIntelligence />} />
          <Route path="places" element={<UTPlacesLeadFinder />} />
          <Route path="outreach" element={<UTOutreachCommand />} />
          <Route path="communications" element={<UnforgettableCommunications />} />
          <Route path="onboarding" element={<UnforgettableOnboarding />} />
          <Route path="partners" element={<UTPartnerDashboard />} />
          <Route path="marketplace" element={<UTMarketplaceControl />} />
          <Route path="events" element={<UTEventBuilder />} />
          <Route path="products" element={<UTProductEngine />} />
          <Route path="suppliers" element={<UTSupplierConsole />} />
          <Route path="automation" element={<UTAutomation />} />
          <Route path="pricing-intelligence" element={<UTPricingIntelligence />} />
          <Route path="staff" element={<UnforgettableStaff />} />
          <Route path="staff/new" element={<UnforgettableStaffNew />} />
          <Route path="staff/categories" element={<UnforgettableStaffCategories />} />
          <Route path="staff/:staffId" element={<UnforgettableStaffProfile />} />
          <Route path="staff/:staffId/edit" element={<UnforgettableStaffEdit />} />
          <Route path="staff/:staffId/venues" element={<UnforgettableStaffVenues />} />
          <Route path="staff/:staffId/notes" element={<UnforgettableStaffNotes />} />
          <Route path="staff/:staffId/call" element={<UnforgettableStaffCall />} />
          <Route path="staff/:staffId/email" element={<UnforgettableStaffEmail />} />
          <Route path="staff/:staffId/performance" element={<UnforgettableStaffPerformance />} />
          <Route path="scheduling" element={<UnforgettableScheduling />} />
          <Route path="scheduling/today" element={<UnforgettableSchedulingToday />} />
          <Route path="scheduling/upcoming" element={<UnforgettableSchedulingUpcoming />} />
          <Route path="scheduling/gaps" element={<UnforgettableSchedulingGaps />} />
          <Route path="payroll" element={<UnforgettablePayroll />} />
          <Route path="payroll/:staffId" element={<UnforgettablePayrollDetail />} />
          <Route path="documents" element={<UnforgettableDocuments />} />
          <Route path="documents/:documentId" element={<UnforgettableDocumentDetail />} />
          <Route path="availability" element={<UnforgettableAvailability />} />
          <Route path="performance" element={<UnforgettablePerformance />} />
          <Route path="analytics" element={<UTAnalytics />} />
          <Route path="ai-calling" element={<UnforgettableAICalling />} />
          <Route path="ai-calling/:callId" element={<UnforgettableAICallDetail />} />
          <Route path="dashboard" element={<UnforgettableDashboard />} />
          <Route path="customer-service" element={<UnforgettableCustomerService />} />
          <Route path="media" element={<UnforgettableMedia />} />
          <Route path="media/:mediaId" element={<UnforgettableMediaDetail />} />
          <Route path="hall-dashboard" element={<UTHallOwnerDashboard />} />
          <Route path="staff-dashboard" element={<UTStaffMemberDashboard />} />
          <Route path="venues" element={<UTVenuesManagement />} />
          <Route path="event-bookings" element={<UTEventBookings />} />
          <Route path="leads" element={<UTLeadIntelligence />} />
          <Route path="outreach-engine" element={<UTOutreachEngine />} />
          <Route path="automation-runs" element={<UTAutomationRuns />} />
          <Route path="ambassador-finder" element={<UTAmbassadorFinder />} />
          <Route path="growth-engine" element={<UTGrowthEngine />} />
          <Route path="biz-owner-outreach" element={<UTBizOwnerOutreach />} />
          <Route path="customer-acquisition" element={<UTCustomerAcquisition />} />
          <Route path="pricing-engine" element={<UTPricingEngine />} />
           <Route path="growth-simulator" element={<UTGrowthSimulator />} />
           <Route path="brand-kit" element={<UTBrandKitManager />} />
           <Route path="supplier-manager" element={<UTSupplierManager />} />
           <Route path="branding-pipeline" element={<UTBrandingPipeline />} />
           <Route path="biz-owner-dashboard" element={<UTBizOwnerDashboard />} />
           <Route path="quiz-results" element={<UTQuizResults />} />
           <Route path="consultations" element={<UTConsultations />} />
           <Route path="kit-orders" element={<UTKitOrders />} />
           <Route path="daily-summary" element={<UTDailySummary />} />
           <Route path="event-calendar" element={<UTEventCalendar />} />
           <Route path="vendor-payments" element={<UTVendorPayments />} />
           <Route path="ambassador-leaderboard" element={<UTAmbassadorLeaderboard />} />
           <Route path="campaign-performance" element={<UTCampaignPerformance />} />
           <Route path="shop-dashboard" element={<UTShopDashboard />} />
           <Route path="product-organizer" element={<UTProductOrganizer />} />
           <Route path="email-subscribers" element={<UTEmailSubscribers />} />
           <Route path="revenue-dashboard" element={<UTRevenueDashboard />} />
           <Route path="payout-manager" element={<UTPayoutManager />} />
           <Route path="ai-brain" element={<UTAIBrain />} />
           <Route path="performance-insights" element={<UTPerformanceInsights />} />
            <Route path="rfq-engine" element={<UTRFQEngine />} />
            <Route path="shipping-tracker" element={<UTShippingTracker />} />
            <Route path="supplier-finder" element={<UTSupplierFinder />} />
            <Route path="supplier-inbox" element={<UTSupplierInbox />} />
            <Route path="supplier-decision" element={<UTSupplierDecisionEngine />} />
            <Route path="supplier-command" element={<UTSupplierCommandDashboard />} />
            <Route path="negotiation-agent" element={<UTNegotiationAgent />} />
            <Route path="negotiation-dashboard" element={<UTNegotiationDashboard />} />
            <Route path="supplier-inbox-v2" element={<UTSupplierInboxV2 />} />
            <Route path="auto-outreach" element={<UTAutoOutreach />} />
            <Route path="shipping-quotes" element={<UTShippingQuotes />} />
            <Route path="auto-finder" element={<UTAutoFinder />} />
            <Route path="category-domination" element={<UTCategoryDomination />} />
            <Route path="global-supplier-control" element={<UTGlobalSupplierControl />} />
          <Route path="halls" element={<Navigate to="/os/unforgettable/venues" replace />} />
          <Route path="vendors" element={<Navigate to="/os/unforgettable/staff-management" replace />} />
          <Route path="rentals" element={<Navigate to="/os/unforgettable/venues" replace />} />
          <Route path="party-bags" element={<Navigate to="/os/unforgettable/venues" replace />} />
          <Route path="ai-builder" element={<Navigate to="/os/unforgettable/venues" replace />} />
          <Route path="platform-stats" element={<UTPlatformStats />} />
          <Route path="ambassadors" element={<UTAmbassadorManagement />} />
          <Route path="business-requests" element={<UTBusinessRequests />} />
          <Route path="business-quotes" element={<UTBusinessQuotes />} />
          <Route path="business-products" element={<UTBusinessProducts />} />
          <Route path="business-packages" element={<UTBusinessPackages />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
