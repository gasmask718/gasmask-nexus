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
...
      <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
