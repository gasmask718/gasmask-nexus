/**
 * AppRoutes - Clean nested route structure for Dynasty OS
 * Uses React Router nested routes with Layout wrapper
 * Performance: ALL page components are lazy-loaded
 */
import { lazy, Suspense } from 'react';
import { Routes, Route, Outlet, Navigate, useParams } from 'react-router-dom';

// Param-preserving redirect: /gasmask/routes/:id -> /routes/:id (Floor 4 route dedupe)
const GasMaskRouteIdRedirect = () => {
  const { id } = useParams();
  return <Navigate to={`/routes/${id}`} replace />;
};
import ProtectedRoute from '@/components/ProtectedRoute';
import { RoleRouteGuard } from '@/components/security/RoleRouteGuard';
import { RequireRole } from '@/components/security/RequireRole';
import Layout from '@/components/Layout';
import { AmbassadorLayout } from '@/components/ambassador/AmbassadorLayout';
import { useAuth } from '@/contexts/AuthContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Layouts — kept static (used as wrappers, always needed)
import PublicLayout from '@/layouts/PublicLayout';
const GasMaskStoreLocator = lazy(() => import('@/pages/public/GasMaskStoreLocator'));
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
const PrivacyPolicyPage = lazy(() => import('@/pages/public/PrivacyPolicyPage'));
const AffiliateProgramPage = lazy(() => import('@/pages/public/AffiliateProgramPage'));

const Auth = lazy(() => import('@/pages/Auth'));
const AuthCallback = lazy(() => import('@/pages/auth/AuthCallback'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const PendingApproval = lazy(() => import('@/pages/PendingApproval'));
const Shop = lazy(() => import('@/pages/Shop'));
const PublicProductPage = lazy(() => import('@/pages/shop/PublicProductPage'));
const CheckoutSuccess = lazy(() => import('@/pages/shop/CheckoutSuccess'));
const TrackOrder = lazy(() => import('@/pages/shop/TrackOrder'));
// Dynasty Direct customer account area (D2C, /account/*)
const AccountLayout = lazy(() => import('@/pages/account/AccountLayout'));
const AccountOrders = lazy(() => import('@/pages/account/AccountOrders'));
const AccountOrderDetail = lazy(() => import('@/pages/account/AccountOrderDetail'));
const AccountAddresses = lazy(() => import('@/pages/account/AccountAddresses'));
const AccountPaymentMethods = lazy(() => import('@/pages/account/AccountPaymentMethods'));
const AccountProfile = lazy(() => import('@/pages/account/AccountProfile'));

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
const PublicIntakePage = lazy(() => import('@/pages/auth/PublicIntakePage'));
const StoreSignupPage = lazy(() => import('@/pages/auth/StoreSignupPage'));
const InstallPwa = lazy(() => import('@/pages/InstallPwa'));
const DeveloperPortal = lazy(() => import('@/pages/developer/DeveloperPortal'));

// Protected pages
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Stores = lazy(() => import('@/pages/Stores'));
const StoreDetail = lazy(() => import('@/pages/StoreDetail'));
const NewArrivals = lazy(() => import('@/pages/NewArrivals'));
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
const SamplesByBrandReport = lazy(() => import('@/pages/reports/SamplesByBrandReport'));
const SamplesByStoreReport = lazy(() => import('@/pages/reports/SamplesByStoreReport'));
const AccountActivityReport = lazy(() => import('@/pages/reports/AccountActivityReport'));
const Influencers = lazy(() => import('@/pages/Influencers'));
const Missions = lazy(() => import('@/pages/Missions'));
const InfluencerCampaigns = lazy(() => import('@/pages/InfluencerCampaigns'));
const ExecutiveReports = lazy(() => import('@/pages/ExecutiveReports'));
const Territories = lazy(() => import('@/pages/Territories'));
const TerritoryOverview = lazy(() => import('@/pages/territory/TerritoryOverview'));
const TubeTerritoryPage = lazy(() => import('@/pages/territory/TubeTerritoryPage'));
const NeighborhoodDetailPage = lazy(() => import('@/pages/territory/NeighborhoodDetailPage'));
const TerritoryNeighborhoods = lazy(() => import('@/pages/territory/TerritoryNeighborhoods'));
const NeighborhoodCoverage = lazy(() => import('@/pages/territory/NeighborhoodCoverage'));
const CityCoveragePage = lazy(() => import('@/pages/territory/CityCoveragePage'));
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
const AmbassadorStoreVisit = lazy(() => import('@/components/portal/field').then(m => ({ default: m.StoreVisitEngine })));
const AmbassadorEndOfDay = lazy(() => import('@/components/portal/field').then(m => ({ default: m.EndOfDayNotes })));
const FieldDayNotesAdmin = lazy(() => import('@/pages/admin/FieldDayNotesAdmin'));
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
const AmbassadorTasks = lazy(() => import('@/pages/ambassador').then(m => ({ default: m.AmbassadorTasks })));
const AmbassadorTasksAdmin = lazy(() => import('@/pages/floor8').then(m => ({ default: m.AmbassadorTasksAdmin })));
const AmbassadorBoxRequests = lazy(() => import('@/pages/admin/AmbassadorBoxRequests'));
const AmbassadorReferralPage = lazy(() => import('@/pages/public/AmbassadorReferralPage'));
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
const BuilderHubPage = lazy(() => import('@/pages/brandaro/BuilderHubPage'));
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
const ReceptionistClientPortal = lazy(() => import('@/pages/client-portal/ClientPortalPage'));
const ClientPortalDashboard = lazy(() => import('@/pages/client-portal/ClientDashboard'));
const ClientPortalCalls = lazy(() => import('@/pages/client-portal/ClientCalls'));
const ClientPortalSettings = lazy(() => import('@/pages/client-portal/ClientSettings'));
const ClientPortalBilling = lazy(() => import('@/pages/client-portal/ClientBilling'));
const CanvaAssetsPage = lazy(() => import('@/pages/brandaro/CanvaAssetsPage'));
const CanvaTemplatesPage = lazy(() => import('@/pages/brandaro/CanvaTemplatesPage'));

// Profile pages
const AmbassadorProfilePage = lazy(() => import('@/pages/profile').then(m => ({ default: m.AmbassadorProfilePage })));
const WholesalerProfilePage = lazy(() => import('@/pages/profile').then(m => ({ default: m.WholesalerProfilePage })));
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
const PendingUsers = lazy(() => import('@/pages/admin/PendingUsers'));
const TwilioTestConsole = lazy(() => import('@/pages/admin/TwilioTestConsole'));
const AdminNotificationSettings = lazy(() => import('@/pages/admin/AdminNotificationSettings'));
const AdminNotificationLog = lazy(() => import('@/pages/admin/AdminNotificationLog'));
const AdminDailyReports = lazy(() => import('@/pages/admin/AdminDailyReports'));
const AdminPartnerPerformance = lazy(() => import('@/pages/admin/AdminPartnerPerformance'));
const AdminOpsDashboard = lazy(() => import('@/pages/admin/AdminOpsDashboard'));
const FieldAssignments = lazy(() => import('@/pages/admin/FieldAssignments'));
const AmbassadorApplication = lazy(() => import('@/pages/apply/AmbassadorApplication'));
const ClipperApplication = lazy(() => import('@/pages/apply/ClipperApplication'));
const ClipperLogin = lazy(() => import('@/pages/clipper/ClipperLogin'));
const ClipperPortal = lazy(() => import('@/pages/clipper/ClipperPortal'));

// VA Portal
const VAAuthPage = lazy(() => import('@/pages/va/VAAuthPage'));
const VAResetPasswordPage = lazy(() => import('@/pages/va/VAResetPasswordPage'));
const VAAcceptInvitePage = lazy(() => import('@/pages/va/VAAcceptInvitePage'));
const VADashboard = lazy(() => import('@/pages/va/VADashboard'));
const VAProfilePage = lazy(() => import('@/pages/va/VAProfilePage'));
const VAManagementPage = lazy(() => import('@/pages/penthouse/VAManagementPage'));
const AdminNumbersPage = lazy(() => import('@/pages/va/AdminNumbersPage'));
const BlandDialHubPage = lazy(() => import('@/pages/bland-dial/BlandDialHubPage'));
const PayInvoicePage = lazy(() => import('@/pages/va/PayInvoicePage'));
const ShortLinkRedirect = lazy(() => import('@/pages/ShortLinkRedirect'));
const AdminLeaderboardPage = lazy(() => import('@/pages/admin/AdminLeaderboard'));
const AdminCallReviewPage = lazy(() => import('@/pages/admin/AdminCallReview'));
const AdminVAMonitorPage = lazy(() => import('@/pages/admin/AdminVAMonitor'));
const AdminDNCManagerPage = lazy(() => import('@/pages/admin/AdminDNCManager'));
const BrandaroScriptsAdminPage = lazy(() => import('@/pages/admin/BrandaroScriptsAdminPage'));
const AmbassadorLogin = lazy(() => import('@/pages/ambassador/AmbassadorLogin'));
const AmbassadorSetPassword = lazy(() => import('@/pages/ambassador/AmbassadorSetPassword'));
const UTAmbassadorDashboard = lazy(() => import('@/pages/ut-ambassador/UTAmbassadorDashboard'));
const AmbassadorEarningsPage = lazy(() => import('@/pages/ambassador/reports').then(m => ({ default: m.AmbassadorEarningsPage })));
const AmbassadorPayoutsPage = lazy(() => import('@/pages/ambassador/payouts').then(m => ({ default: m.AmbassadorPayoutsPage })));
const AmbassadorPayoutStatementPage = lazy(() => import('@/pages/ambassador/payouts').then(m => ({ default: m.AmbassadorPayoutStatementPage })));
const AmbassadorPayoutSettingsPage = lazy(() => import('@/pages/ambassador/payouts').then(m => ({ default: m.AmbassadorPayoutSettingsPage })));
const AmbassadorCatalog = lazy(() => import('@/pages/ambassador/AmbassadorCatalog'));
const AmbassadorDDOrder = lazy(() => import('@/pages/ambassador/AmbassadorDDOrder'));
const AmbassadorFeedback = lazy(() => import('@/pages/ambassador/AmbassadorFeedback'));
const FeedbackInbox = lazy(() => import('@/pages/admin/FeedbackInbox'));

// Misc protected pages
const Expansion = lazy(() => import('@/pages/Expansion'));
const Rewards = lazy(() => import('@/pages/Rewards'));
const LiveMap = lazy(() => import('@/pages/LiveMap'));
const WalletPage = lazy(() => import('@/pages/Wallet'));
const Subscriptions = lazy(() => import('@/pages/Subscriptions'));
const DeliveryCapacityCommand = lazy(() => import('@/pages/delivery').then(m => ({ default: m.DeliveryCapacityCommand })));
const SecurityConsole = lazy(() => import('@/components/security/SecurityConsole').then(m => ({ default: m.SecurityConsole })));
const RolesPermissionsPage = lazy(() => import('@/components/security/RolesPermissionsPage').then(m => ({ default: m.RolesPermissionsPage })));
const StoreDeduplicationPage = lazy(() => import('@/pages/admin/StoreDeduplicationPage'));
const StoreMergePreview = lazy(() => import('@/pages/admin/StoreMergePreview'));
const MergeDryRun = lazy(() => import('@/pages/admin/MergeDryRun'));
const RecentlyAddedStores = lazy(() => import('@/pages/admin/RecentlyAddedStores'));
const DispatchMap = lazy(() => import('@/pages/admin/DispatchMap'));
const UserManagementPage = lazy(() => import('@/components/security/UserManagementPage'));
const UserInvitations = lazy(() => import('@/pages/security/UserInvitations'));
const MessagesPage = lazy(() => import('@/pages/Messages'));
const RouteOpsCenter = lazy(() => import('@/pages/RouteOpsCenter'));
const RouteOpsCenterEnhanced = lazy(() => import('@/pages/delivery').then(m => ({ default: m.RouteOpsCenterEnhanced })));
const OpsCommandCenter = lazy(() => import('@/pages/delivery').then(m => ({ default: m.OpsCommandCenter })));
const PendingRouteStopsPage = lazy(() => import('@/pages/dispatch/PendingRouteStopsPage'));
const RouteCommandCenter = lazy(() => import('@/pages/RouteCommandCenter'));
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
const CollectionsPage = lazy(() => import('@/pages/CollectionsPage'));
const EconomicAnalytics = lazy(() => import('@/pages/EconomicAnalytics'));
const AmbassadorPayouts = lazy(() => import('@/pages/AmbassadorPayouts'));
const BikerPayouts = lazy(() => import('@/pages/BikerPayouts'));
const CRM = lazy(() => import('@/pages/CRM'));
const CRMContacts = lazy(() => import('@/pages/CRMContacts'));
const CRMContactDetail = lazy(() => import('@/pages/CRMContactDetail'));
const ContactProfile = lazy(() => import('@/pages/crm/ContactProfile'));
const GlobalCRM = lazy(() => import('@/pages/crm/GlobalCRM'));
const RelationshipHealthRollup = lazy(() => import('@/pages/crm/RelationshipHealthRollup'));
const GlobalCRMDashboard = lazy(() => import('@/pages/crm/GlobalCRMDashboard'));
const BusinessCRMDashboard = lazy(() => import('@/pages/crm/BusinessCRMDashboard'));
const CRMRouter = lazy(() => import('@/pages/crm/CRMRouter'));
const BrandaroLeadProfile = lazy(() => import('@/pages/crm/brandaro/BrandaroLeadProfile'));
const BrandaroProductsPage = lazy(() => import('@/pages/products/ProductsPage'));
const MaintenanceListPage = lazy(() => import('@/pages/maintenance/MaintenanceListPage'));
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
const TopTierSupplyMap = lazy(() => import('@/pages/crm/toptier/TopTierSupplyMap'));
const TopTierAllPartners = lazy(() => import('@/pages/crm/toptier').then(m => ({ default: m.TopTierAllPartners })));
const TopTierNewDeal = lazy(() => import('@/pages/crm/toptier').then(m => ({ default: m.TopTierNewDeal })));
const TopTierDeals = lazy(() => import('@/pages/crm/toptier').then(m => ({ default: m.TopTierDeals })));
const TopTierKPIManagement = lazy(() => import('@/pages/crm/toptier').then(m => ({ default: m.TopTierKPIManagement })));

const AddBusinessPage = lazy(() => import('@/pages/crm/AddBusinessPage'));
const CRMDataPage = lazy(() => import('@/pages/crm/CRMDataPage'));
const CRMExportPage = lazy(() => import('@/pages/crm/CRMExportPage'));
const CRMImportPage = lazy(() => import('@/pages/crm/CRMImportPage'));
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
const CRMFollowUps = lazy(() => import('@/pages/CRMFollowUps'));
const Companies = lazy(() => import('@/pages/Companies'));
const CompanyProfile = lazy(() => import('@/pages/CompanyProfile'));
const UnpaidAccounts = lazy(() => import('@/pages/UnpaidAccounts'));
const DriverDebtCollection = lazy(() => import('@/pages/DriverDebtCollection'));
const BrandDashboard = lazy(() => import('@/pages/BrandDashboard'));

const OSDirectory = lazy(() => import('@/pages/OSDirectory'));

// Owner pages
const OwnerDashboard = lazy(() => import('@/pages/owner').then(m => ({ default: m.OwnerDashboard })));
const OwnerAIAdvisorPage = lazy(() => import('@/pages/owner').then(m => ({ default: m.OwnerAIAdvisorPage })));
const OwnerClusterDashboard = lazy(() => import('@/pages/owner').then(m => ({ default: m.OwnerClusterDashboard })));
const OwnerAutopilotConsole = lazy(() => import('@/pages/owner').then(m => ({ default: m.OwnerAutopilotConsole })));
const OwnerAICommandConsole = lazy(() => import('@/pages/owner').then(m => ({ default: m.OwnerAICommandConsole })));
const OwnerRiskRadar = lazy(() => import('@/pages/owner').then(m => ({ default: m.OwnerRiskRadar })));
// T6 cleanup: OwnerDailyBriefing deleted — /os/owner/briefing redirects to /penthouse/accounting
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
// T6 cleanup: OwnerExecutiveReports deleted — /os/owner/executive-reports redirects to /os/owner/reports
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
const DCPhoneNumbersManager = lazy(() => import('@/pages/dynasty-connect/DCPhoneNumbersManager'));
const DCCallDispatch = lazy(() => import('@/pages/dynasty-connect/DCCallDispatch'));
const DCCallResults = lazy(() => import('@/pages/dynasty-connect/DCCallResults'));
const DCAnalyticsDashboard = lazy(() => import('@/pages/dynasty-connect/DCAnalyticsDashboard'));
const DCLeadPipeline = lazy(() => import('@/pages/dynasty-connect/DCLeadPipeline'));
const DCBulkLaunch = lazy(() => import('@/pages/dynasty-connect/DCBulkLaunch'));
const DCLiveCallsBoard = lazy(() => import('@/pages/dynasty-connect/DCLiveCallsBoard'));
const DCFinishedCallsPage = lazy(() => import('@/pages/dynasty-connect/DCFinishedCallsPage'));
const DCLeadInbox = lazy(() => import('@/pages/dynasty-connect/DCLeadInbox'));
const DCRecordingsPage = lazy(() => import('@/pages/dynasty-connect/DCRecordingsPage'));
const DCDispositionManager = lazy(() => import('@/pages/dynasty-connect/DCDispositionManager'));
const DCDNCManager = lazy(() => import('@/pages/dynasty-connect/DCDNCManager'));
const DCComplianceDashboard = lazy(() => import('@/pages/dynasty-connect/DCComplianceDashboard'));
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
const SFAttorneyCRM = lazy(() => import('@/pages/surplus-funds/SFAttorneyCRM'));
const SFCoverageMap = lazy(() => import('@/pages/surplus-funds/SFCoverageMap'));
const SFDocuments = lazy(() => import('@/pages/surplus-funds/SFDocuments'));
const SFContracts = lazy(() => import('@/pages/surplus-funds/SFContracts'));
const SFAutomation = lazy(() => import('@/pages/surplus-funds/SFAutomation'));
const SFAnalytics = lazy(() => import('@/pages/surplus-funds/SFAnalytics'));
const SFHumanQueue = lazy(() => import('@/pages/surplus-funds/SFHumanQueue').then(m => ({ default: m.SFHumanQueue })));


// BrightSun Solar OS
const SolarLayout = lazy(() => import('@/pages/solar/SolarLayout'));
const SolarCommandCenter = lazy(() => import('@/pages/solar/SolarCommandCenter'));
const SolarLeadIntelligence = lazy(() => import('@/pages/solar/SolarLeadIntelligence'));
const SolarCRM = lazy(() => import('@/pages/solar/SolarCRM'));
const SolarInstallerMap = lazy(() => import('@/pages/solar/SolarInstallerMap'));

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
const REContracts = lazy(() => import('@/pages/real-estate/REContracts'));

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
const CommsHealthDashboard = lazy(() => import('@/pages/communication/CommsHealthDashboard'));
const SystemHealthPage = lazy(() => import('@/pages/SystemHealthPage'));
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
const PowerDialerConsole = lazy(() => import('@/pages/communication/dialer/PowerDialerConsole'));
const OutreachSwitchboard = lazy(() => import('@/pages/admin/OutreachSwitchboard'));
const CampaignDialPage = lazy(() => import('@/pages/communication/dialer/CampaignDialPage'));
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
// T6 cleanup: AgentCenterPage deleted — both routes redirect to /grabba/floor9
const NoteCleanerPage = lazy(() => import('@/pages/gasmask/NoteCleanerPage'));
const StoreIntelligencePage = lazy(() => import('@/pages/gasmask/StoreIntelligencePage'));
const GasMaskInventoryOps = lazy(() => import('@/pages/gasmask/GasMaskInventoryOps'));
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
const CallCenter = lazy(() => import('@/pages/CallCenter'));
const TextCenter = lazy(() => import('@/pages/TextCenter'));
const PhoneLog = lazy(() => import('@/pages/PhoneLog'));
const EmailCenter = lazy(() => import('@/pages/EmailCenter'));

// Comm Systems

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
const TrainingAdminPage = lazy(() => import('@/pages/admin/TrainingAdminPage'));
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
const WholesalerOrderGrabba = lazy(() => import('@/pages/portal/wholesaler').then(m => ({ default: m.WholesalerOrderGrabba })));
const WholesalerCatalogOnboard = lazy(() => import('@/pages/portal/wholesaler/WholesalerCatalogOnboard'));
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
const CustomerPortal = lazy(() => import('@/pages/portal/CustomerPortal'));
const NationalWholesale = lazy(() => import('@/pages/portal/NationalWholesale'));
const MarketplaceAdmin = lazy(() => import('@/pages/portal/MarketplaceAdmin'));

// New Role Portals
const DriverPortalPage = lazy(() => import('@/pages/portals').then(m => ({ default: m.DriverPortalPage })));
const BikerPortalPage = lazy(() => import('@/pages/portals').then(m => ({ default: m.BikerPortalPage })));
// AmbassadorPortalPage (mock simulation) removed — /portals/ambassador redirects to /ambassador/dashboard
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
const YieldWatchPage = lazy(() => import('@/pages/production/YieldWatchPage'));
const OwnerIntelligencePage = lazy(() => import('@/pages/production/OwnerIntelligencePage'));
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
// T6 cleanup: HRPayroll deleted — /hr/payroll redirects to /grabba/payroll-manager
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
const HistoricalImportReview = lazy(() => import('@/pages/admin/HistoricalImportReview'));
const DynastyDirectOps = lazy(() => import('@/pages/admin/DynastyDirectOps'));
// Dynasty Direct Hub — Sprint 2
const DynastyDirectHubHome = lazy(() => import('@/pages/dynasty-direct/DynastyDirectHubHome'));
const DynastyDirectOrders = lazy(() => import('@/pages/dynasty-direct/DynastyDirectOrders'));
const DynastyDirectSupplierNetwork = lazy(() => import('@/pages/dynasty-direct/DynastyDirectSupplierNetwork'));
const DynastyDirectCatalogOnboard = lazy(() => import('@/pages/dynasty-direct/DynastyDirectCatalogOnboard'));
const DynastyDirectCatalogReview = lazy(() => import('@/pages/dynasty-direct/DynastyDirectCatalogReview'));
const DynastyDirectContentLibrary = lazy(() => import('@/pages/dynasty-direct/DynastyDirectContentLibrary'));
const DynastyDirectInvites = lazy(() => import('@/pages/dynasty-direct/DynastyDirectInvites'));
const DynastyDirectStoreApplications = lazy(() => import('@/pages/dynasty-direct/DynastyDirectStoreApplications'));
const DynastyDirectFulfillmentConsole = lazy(() => import('@/pages/dynasty-direct/DynastyDirectFulfillmentConsole'));
const DynastyDirectSplitConsole = lazy(() => import('@/pages/dynasty-direct/DynastyDirectSplitConsole'));
const DynastyDirectGrabbaBridge = lazy(() => import('@/pages/dynasty-direct/DynastyDirectGrabbaBridge'));
const DynastyDirectAffiliates = lazy(() => import('@/pages/dynasty-direct/DynastyDirectAffiliates'));
const DDPartnerCampaigns = lazy(() => import('@/pages/dynasty-direct/DDPartnerCampaigns'));
const DynastyDirectMessages = lazy(() => import('@/pages/dynasty-direct/DynastyDirectMessages'));
const DynastyDirectInventory = lazy(() => import('@/pages/dynasty-direct/DynastyDirectInventory'));
const DDStoreAccounts = lazy(() => import('@/pages/dynasty-direct/DDStoreAccounts'));
const DDOrderDetail = lazy(() => import('@/pages/dynasty-direct/DDOrderDetail'));
const DDAnalytics = lazy(() => import('@/pages/dynasty-direct/DDAnalytics'));
const DDSettings = lazy(() => import('@/pages/dynasty-direct/DDSettings'));
const DDReadiness = lazy(() => import('@/pages/dynasty-direct/DDReadiness'));
const DDReturnsQueue = lazy(() => import('@/pages/dynasty-direct/DDReturnsQueue'));
const DDInrQueue = lazy(() => import('@/pages/dynasty-direct/DDInrQueue'));
const DDSupportTickets = lazy(() => import('@/pages/dynasty-direct/DDSupportTickets'));
const DDCommissionRates = lazy(() => import('@/pages/dynasty-direct/DDCommissionRates'));
const DDSupplierPerformance = lazy(() => import('@/pages/dynasty-direct/DDSupplierPerformance'));
const DDPurchaseOrders = lazy(() => import('@/pages/dynasty-direct/DDPurchaseOrders'));
const DDProductQA = lazy(() => import('@/pages/dynasty-direct/DDProductQA'));
const DDReviews = lazy(() => import('@/pages/dynasty-direct/DDReviews'));
const DDFlashSales = lazy(() => import('@/pages/dynasty-direct/DDFlashSales'));
const DDInventoryForecast = lazy(() => import('@/pages/dynasty-direct/DDInventoryForecast'));
const DDBundles = lazy(() => import('@/pages/dynasty-direct/DDBundles'));
const DDLocalDelivery = lazy(() => import('@/pages/dynasty-direct/DDLocalDelivery'));
const DDSupplierInstructions = lazy(() => import('@/pages/dynasty-direct/DDSupplierInstructions'));
const DDShippingPage = lazy(() => import('@/pages/dynasty-direct/ShippingPage'));
const DDProductManagementPage = lazy(() => import('@/pages/dynasty-direct/ProductManagementPage'));
const DDPricingPage = lazy(() => import('@/pages/dynasty-direct/PricingPage'));
const WholesalerMarketplaceInventory = lazy(() => import('@/pages/portal/wholesaler/WholesalerMarketplaceInventory'));
const UniversalInviteAccept = lazy(() => import('@/pages/invite/UniversalInviteAccept'));
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
const TTPricing = lazy(() => import('@/pages/os/toptier/TTPricing'));
const TTDispatch = lazy(() => import('@/pages/os/toptier/TTDispatch'));
const TTPayments = lazy(() => import('@/pages/os/toptier/TTPayments'));
const TTReviews = lazy(() => import('@/pages/os/toptier/TTReviews'));
const TTSettings = lazy(() => import('@/pages/os/toptier/TTSettings'));
const TTCorporate = lazy(() => import('@/pages/os/toptier/TTCorporate'));
const TTPartnersMgmt = lazy(() => import('@/pages/os/toptier/TTPartnersMgmt'));
const TTFleet = lazy(() => import('@/pages/os/toptier/TTFleet'));
const TTPayouts = lazy(() => import('@/pages/os/toptier/TTPayouts'));
const TTCommissions = lazy(() => import('@/pages/os/toptier/TTCommissions'));
const TTAffiliates = lazy(() => import('@/pages/os/toptier/TTAffiliates'));
const TTPackages = lazy(() => import('@/pages/os/toptier/TTPackages'));
const TTPromoCodes = lazy(() => import('@/pages/os/toptier/TTPromoCodes'));
const TTDispatchRequests = lazy(() => import('@/pages/os/toptier/TTDispatchRequests'));
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
const PenthouseHotels = lazy(() => import('@/pages/os/toptier/penthouse/PenthouseHotels'));
const PenthouseSecurity = lazy(() => import('@/pages/os/toptier/penthouse/PenthouseSecurity'));
const PenthouseCorporateEvents = lazy(() => import('@/pages/os/toptier/penthouse/PenthouseCorporateEvents'));
const PenthouseVehicleDecor = lazy(() => import('@/pages/os/toptier/penthouse/PenthouseVehicleDecor'));
const DecorExperienceWizard = lazy(() => import('@/pages/os/toptier/DecorExperienceWizard'));
const PenthouseFleet = lazy(() => import('@/pages/os/toptier/penthouse/PenthouseFleet'));
const PenthouseAddons = lazy(() => import('@/pages/os/toptier/penthouse/PenthouseAddons'));
const PenthouseGiftExperiences = lazy(() => import('@/pages/os/toptier/penthouse/PenthouseGiftExperiences'));
const PenthouseBeautyProviders = lazy(() => import('@/pages/os/toptier/penthouse/PenthouseBeautyProviders'));
const PenthouseCoachBusDispatch = lazy(() => import('@/pages/os/toptier/penthouse/PenthouseCoachBusDispatch'));
const PenthousePrivateJetDispatch = lazy(() => import('@/pages/os/toptier/penthouse/PenthousePrivateJetDispatch'));
const PenthouseYachtOps = lazy(() => import('@/pages/os/toptier/penthouse/PenthouseYachtOps'));
const PenthouseExoticCarOps = lazy(() => import('@/pages/os/toptier/penthouse/PenthouseExoticCarOps'));
const DynastyRevenueOrchestrator = lazy(() => import('@/pages/os/dynasty-sales/DynastyRevenueOrchestrator'));
const PartnerRespond = lazy(() => import('@/pages/partner/PartnerRespond'));
const TTPartnerAccept = lazy(() => import('@/pages/toptier/PartnerAccept'));
const PartnerClaim = lazy(() => import('@/pages/partner/PartnerClaim'));
const PartnerPortal = lazy(() => import('@/pages/partner/PartnerPortal'));
const PartnersImport = lazy(() => import('@/pages/admin/PartnersImport'));
const BeautyProviderSignup = lazy(() => import('@/pages/public/BeautyProviderSignup'));
const BrandaroIntakePage = lazy(() => import('@/pages/public/BrandaroIntakePage'));
const ThingsToDoExperiences = lazy(() => import('@/pages/os/toptier/ThingsToDoExperiences'));
const ThingsToDoBookings = lazy(() => import('@/pages/os/toptier/ThingsToDoBookings'));
const ThingsToDoAnalytics = lazy(() => import('@/pages/os/toptier/ThingsToDoAnalytics'));
const ThingsToDoMarkup = lazy(() => import('@/pages/os/toptier/ThingsToDoMarkup'));
const ThingsToDoAddons = lazy(() => import('@/pages/os/toptier/ThingsToDoAddons'));
const ThingsToDoProfitDashboard = lazy(() => import('@/pages/os/toptier/ThingsToDoProfitDashboard'));
const KidsFamilyExperiences = lazy(() => import('@/pages/os/toptier/KidsFamilyExperiences'));
const KidsFamilyVendors = lazy(() => import('@/pages/os/toptier/KidsFamilyVendors'));
const KidsFamilyBundles = lazy(() => import('@/pages/os/toptier/KidsFamilyBundles'));
const KidsFamilyPerformance = lazy(() => import('@/pages/os/toptier/KidsFamilyPerformance'));
const KidsFamilyApiPanel = lazy(() => import('@/pages/os/toptier/KidsFamilyApiPanel'));
const KidsFamilyVendorLeads = lazy(() => import('@/pages/os/toptier/KidsFamilyVendorLeads'));

// UFT Platform Command Center
const UFTDashboard = lazy(() => import('@/pages/uft/UFTDashboard'));
const UFTRevenue = lazy(() => import('@/pages/uft/UFTRevenue'));
const UFTVendors = lazy(() => import('@/pages/uft/UFTVendors'));
const UFTAmbassadors = lazy(() => import('@/pages/uft/UFTAmbassadors'));
const UFTLaunchChecklist = lazy(() => import('@/pages/uft/UFTLaunchChecklist'));
const UFTVerification = lazy(() => import('@/pages/uft/UFTVerification'));
const UFTPayouts = lazy(() => import('@/pages/uft/UFTPayouts'));
const UFTSuppliers = lazy(() => import('@/pages/uft/UFTSuppliers'));
const UFTRecruiting = lazy(() => import('@/pages/uft/UFTRecruiting'));
const UFTAmbassadorRecruiting = lazy(() => import('@/pages/uft/UFTAmbassadorRecruiting'));

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
const UTPartnerMap = lazy(() => import('@/pages/os/unforgettable/UTPartnerMap'));
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
const UTEventSpaces = lazy(() => import('@/pages/os/unforgettable/UTEventSpaces'));
const UTVirtualTours = lazy(() => import('@/pages/os/unforgettable/UTVirtualTours'));
const UTCoverageMap = lazy(() => import('@/pages/os/unforgettable/UTCoverageMap'));

// Unforgettable CRM
const UnforgettableEventHalls = lazy(() => import('@/pages/crm/unforgettable').then(m => ({ default: m.UnforgettableEventHalls })));
const UnforgettableEventHallDetail = lazy(() => import('@/pages/crm/unforgettable').then(m => ({ default: m.UnforgettableEventHallDetail })));
const UnforgettableRentals = lazy(() => import('@/pages/crm/unforgettable').then(m => ({ default: m.UnforgettableRentals })));
const UnforgettableInfluencers = lazy(() => import('@/pages/crm/unforgettable').then(m => ({ default: m.UnforgettableInfluencers })));
const UnforgettableMediaVault = lazy(() => import('@/pages/crm/unforgettable').then(m => ({ default: m.UnforgettableMediaVault })));
const UnforgettablePartySuppliers = lazy(() => import('@/pages/crm/unforgettable').then(m => ({ default: m.UnforgettablePartySuppliers })));
const UnforgettableGifts = lazy(() => import('@/pages/crm/unforgettable').then(m => ({ default: m.UnforgettableGifts })));
const UnforgettableCRMDashboard = lazy(() => import('@/pages/crm/unforgettable').then(m => ({ default: m.UnforgettableCRMDashboard })));

// Other OS modules
const ICleanDashboard = lazy(() => import('@/pages/os/iclean/ICleanDashboard'));
const ICWCommandDashboard = lazy(() => import('@/pages/os/iclean/ICWCommandDashboard'));
const ICWWorkerRoster = lazy(() => import('@/pages/os/iclean/ICWWorkerRoster'));
const ICWLeadMap = lazy(() => import('@/pages/os/iclean/ICWLeadMap'));
const ICWCrm = lazy(() => import('@/pages/os/iclean/ICWCrm'));
const PlayboxxxDashboard = lazy(() => import('@/pages/os/playboxxx/PlayboxxxDashboard'));
const PbxRecruitingDashboard = lazy(() => import('@/pages/os/playboxxx/recruiting/RecruitingDashboard'));
const PbxStaffSourcing = lazy(() => import('@/pages/os/playboxxx/recruiting/StaffSourcing'));
const PbxCreatorSourcing = lazy(() => import('@/pages/os/playboxxx/recruiting/CreatorSourcing'));
const PbxSearchAssignments = lazy(() => import('@/pages/os/playboxxx/recruiting/SearchAssignments'));
const PbxCandidates = lazy(() => import('@/pages/os/playboxxx/recruiting/Candidates'));
const PbxAutomationRuns = lazy(() => import('@/pages/os/playboxxx/recruiting/AutomationRuns'));
const PbxAuditLogs = lazy(() => import('@/pages/os/playboxxx/recruiting/AuditLogs'));
const PbxRecruitingSettings = lazy(() => import('@/pages/os/playboxxx/recruiting/RecruitingSettings'));
const SpecialNeedsDashboard = lazy(() => import('@/pages/os/specialneeds/SpecialNeedsDashboard'));
// FundingDashboard (orphan /os/funding) — REMOVED, use /funding-machine instead
const GrantsDashboard = lazy(() => import('@/pages/os/grants/GrantsDashboard'));
const GrantOpportunities = lazy(() => import('@/pages/os/grants/GrantOpportunities'));
const GrantApplicationDetail = lazy(() => import('@/pages/os/grants/GrantApplicationDetail'));
const GrantBusinessProfiles = lazy(() => import('@/pages/os/grants/BusinessProfiles'));
const GrantBusinessProfileDetail = lazy(() => import('@/pages/os/grants/BusinessProfileDetail'));
const GrantEligibilityMatrix = lazy(() => import('@/pages/os/grants/EligibilityMatrix'));
const GrantApplicationPackage = lazy(() => import('@/pages/os/grants/ApplicationPackage'));
const GrantApplicationsPage = lazy(() => import('@/pages/os/grants/GrantApplicationsPage'));
const GrantFunderCRMPage = lazy(() => import('@/pages/funding-machine/grants/GrantFunderCRMPage'));
const WealthEngineDashboard = lazy(() => import('@/pages/os/wealth/WealthEngineDashboard'));
// Funding Machine (Floor 10)
const DynastyCapitalPage = lazy(() => import('@/pages/dynasty-capital/DynastyCapitalPage'));
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
const FundingMachineBillGuardian = lazy(() => import('@/pages/funding-machine/BillGuardianPage'));
const FundingMachineDeletionLetterEngine = lazy(() => import('@/pages/funding-machine/DeletionLetterEnginePage'));
const FundingMachineSecureIntake = lazy(() => import('@/pages/funding-machine/SecureClientIntakePage'));
const FundingMachineCreditUnionIntel = lazy(() => import('@/pages/funding-machine/CreditUnionIntelPage'));
const FundingMachineAutoFinancing = lazy(() => import('@/pages/funding-machine/AutoFinancingPage'));
const FundingMachineShelfCorp = lazy(() => import('@/pages/funding-machine/ShelfCorpPage'));
const FundingMachineRevenue = lazy(() => import('@/pages/funding-machine/RevenueDashboardPage'));
const FundingMachineClientsList = lazy(() => import('@/pages/funding-machine/ClientsListPage'));
const FundingInvitesPage = lazy(() => import('@/pages/funding-machine/FundingInvitesPage'));
const FundingModuleStub = lazy(() => import('@/pages/funding-machine/FundingModuleStub'));
const FundingApplicationAutomation = lazy(() => import('@/pages/funding-machine/ApplicationAutomationPage'));
const UbenHQ = lazy(() => import('@/pages/os/uben/UbenHQ'));
const UbenGrantTracker = lazy(() => import('@/pages/os/uben/UbenGrantTracker'));
const UbenApplications = lazy(() => import('@/pages/os/uben/UbenApplications'));
const UbenPrograms = lazy(() => import('@/pages/os/uben/UbenPrograms'));
const UbenImpact = lazy(() => import('@/pages/os/uben/UbenImpact'));
const UbenDonors = lazy(() => import('@/pages/os/uben/UbenDonors'));
const UbenCompliance = lazy(() => import('@/pages/os/uben/UbenCompliance'));
const UbenDocuments = lazy(() => import('@/pages/os/uben/UbenDocuments'));
const UbenCommissions = lazy(() => import('@/pages/os/uben/UbenCommissions'));
const DynastyEarn = lazy(() => import('@/pages/os/dynasty-earn/DynastyEarn'));
const EarnEarners = lazy(() => import('@/pages/os/dynasty-earn/EarnEarners'));
const EarnBrands = lazy(() => import('@/pages/os/dynasty-earn/EarnBrands'));
const EarnPrograms = lazy(() => import('@/pages/os/dynasty-earn/EarnPrograms'));
const EarnCommissions = lazy(() => import('@/pages/os/dynasty-earn/EarnCommissions'));
const EarnCampaigns = lazy(() => import('@/pages/os/dynasty-earn/EarnCampaigns'));
const EarnPayouts = lazy(() => import('@/pages/os/dynasty-earn/EarnPayouts'));
const EarnSettings = lazy(() => import('@/pages/os/dynasty-earn/EarnSettings'));
const BrandAcquisitionSystem = lazy(() => import('@/pages/os/brand-acquisition/BrandAcquisitionSystem'));
const DynastySalesNetwork = lazy(() => import('@/pages/os/dynasty-sales/DynastySalesNetwork'));
const ClipperDashboard = lazy(() => import('@/pages/os/clipper/ClipperDashboard'));
const ClipperClippers = lazy(() => import('@/pages/os/clipper/ClipperClippers'));
const ClipperApplications = lazy(() => import('@/pages/os/clipper/ClipperApplications'));
const ClipperCampaigns = lazy(() => import('@/pages/os/clipper/ClipperCampaigns'));
const ClipperSubmissions = lazy(() => import('@/pages/os/clipper/ClipperSubmissions'));
const ClipperAnalytics = lazy(() => import('@/pages/os/clipper/ClipperAnalytics'));
const ClipperConversions = lazy(() => import('@/pages/os/clipper/ClipperConversions'));
const ClipperPayouts = lazy(() => import('@/pages/os/clipper/ClipperPayouts'));
const ClipperSettings = lazy(() => import('@/pages/os/clipper/ClipperSettings'));
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
// BUG-09: these three exist in the BettingModule registry (src/modules/betting)
// but that registry is never mounted by the router, so they were unreachable.
const SBOCommandCenter = lazy(() => import('@/pages/os/betting/SBOCommandCenter'));
const CrossPlatformLines = lazy(() => import('@/pages/os/betting/CrossPlatformLines'));
const BettingAnalytics = lazy(() => import('@/pages/os/betting/BettingAnalytics'));
const SBOWalletTracker = lazy(() => import('@/pages/os/betting/SBOWalletTracker'));
const SBOCapperTracker = lazy(() => import('@/pages/os/betting/SBOCapperTracker'));
const SBOSignalAlignment = lazy(() => import('@/pages/os/betting/SBOSignalAlignment'));
const SBOTonightPage = lazy(() => import('@/pages/sports-betting/pages/TonightPage'));
const SBONightlyBoardPage = lazy(() => import('@/pages/sports-betting/pages/NightlyBoardPage'));
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
const SBOSignalsPage = lazy(() => import('@/pages/sports-betting/pages/SignalsPage'));
const SBODashboard = lazy(() => import('@/pages/os/sbo/SBODashboard'));
const SBOAllPicks = lazy(() => import('@/pages/os/sbo/SBOAllPicks'));
const BikerDashboard = lazy(() => import('@/pages/os/biker/BikerDashboard'));
const BikerTodaysRoutesPage = lazy(() => import('@/pages/delivery/biker/TodaysRoutesPage'));
const ModuleDiagnosticsPage = lazy(() => import('@/pages/ModuleDiagnosticsPage'));
const InvoiceForensicsConsole = lazy(() => import('@/pages/diagnostics/InvoiceForensicsConsole'));

// Delivery & Logistics
const DeliveryDashboard = lazy(() => import('@/pages/delivery').then(m => ({ default: m.DeliveryDashboard })));
const DeliveriesBoard = lazy(() => import('@/pages/delivery').then(m => ({ default: m.DeliveriesBoard })));
const OrdersDeliveriesPage = lazy(() => import('@/pages/delivery/OrdersDeliveriesPage'));
const LiveDeliveryPool = lazy(() => import('@/pages/delivery/LiveDeliveryPool'));
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
const FlowerCustomersPage = lazy(() => import('@/pages/grabba/FlowerCustomersPage'));
const IdeaDashboard = lazy(() => import('@/pages/ideas/IdeaDashboard'));
const BrandCRM = lazy(() => import('@/pages/grabba/BrandCRM'));
const BrandSelector = lazy(() => import('@/pages/grabba/BrandSelector'));
const BrandCommunications = lazy(() => import('@/pages/grabba/BrandCommunications'));
const AIInsights = lazy(() => import('@/pages/grabba/AIInsights'));
const GrabbaCRM = lazy(() => import('@/pages/grabba/GrabbaCRM'));
const GrabbaCommunication = lazy(() => import('@/pages/grabba/GrabbaCommunication'));
const GrabbaInventory = lazy(() => import('@/pages/grabba/GrabbaInventory'));
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

// Dynasty Partners Admin
const DPAdminLayout = lazy(() => import('@/components/admin/dp/DPAdminLayout'));
const DPDashboard = lazy(() => import('@/pages/admin/dp/DPDashboard'));
const DPPartners = lazy(() => import('@/pages/admin/dp/DPPartners'));
const DPMrr = lazy(() => import('@/pages/admin/dp/DPMrr'));
const DPPlatforms = lazy(() => import('@/pages/admin/dp/DPPlatforms'));
const DPRecruitment = lazy(() => import('@/pages/admin/dp/DPRecruitment'));
const DPFinancials = lazy(() => import('@/pages/admin/dp/DPFinancials'));
const DPControls = lazy(() => import('@/pages/admin/dp/DPControls'));
const DPActivity = lazy(() => import('@/pages/admin/dp/DPActivity'));
const DPManual = lazy(() => import('@/pages/admin/dp/DPManual'));
const DPNotifications = lazy(() => import('@/pages/admin/dp/DPNotifications'));
const AdminDebug = lazy(() => import('@/pages/admin/dp/AdminDebug'));
const DPCreatePartner = lazy(() => import('@/pages/admin/dp/CreatePartner'));


/**
 * ProtectedLayout - Wraps all protected routes with auth and layout
 */
const ProtectedLayout = () => {
  const { userRole, loading } = useAuth();
  // VAs must never see the Dynasty OS admin layout/sidebar — bounce to their portal.
  if (!loading && userRole === 'va') {
    return <Navigate to="/va/dashboard" replace />;
  }
  return (
    <ProtectedRoute>
      <RoleRouteGuard>
        <Layout>
          <Outlet />
        </Layout>
      </RoleRouteGuard>
    </ProtectedRoute>
  );
};

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
        {/* /shop IS the public D2C storefront grid (no auth, crawlable). */}
        <Route path="/shop" element={<Shop />} />
        {/* Public, crawlable product detail page (schema.org Product JSON-LD) */}
        <Route path="/shop/product/:productId" element={<PublicProductPage />} />
        {/* Stripe redirect target + guest order tracking */}
        <Route path="/checkout/success" element={<CheckoutSuccess />} />
        <Route path="/track" element={<TrackOrder />} />

        {/* Customer account area — optional, guest checkout still works without it */}
        <Route path="/account" element={<AccountLayout />}>
          <Route index element={<Navigate to="/account/orders" replace />} />
          <Route path="orders" element={<AccountOrders />} />
          <Route path="orders/:orderId" element={<AccountOrderDetail />} />
          <Route path="addresses" element={<AccountAddresses />} />
          <Route path="payment" element={<AccountPaymentMethods />} />
          <Route path="profile" element={<AccountProfile />} />
        </Route>

        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/affiliates" element={<AffiliateProgramPage />} />
        <Route path="/affiliates/dashboard" element={<Navigate to="/affiliates" replace />} />

        <Route path="/gasmask/locations" element={<Navigate to="/locations" replace />} />
        <Route path="/locations" element={<GasMaskStoreLocator />} />
      </Route>

      {/* T1 M2: /store = UT Shopify — standalone, has its own UT chrome (no GasMask wrap) */}
      <Route path="/store" element={<ShopifyStore />} />

      {/* Standalone public routes (own layouts) */}
      {/* Developer Portal - standalone, self-authenticated */}
      <Route path="/developer" element={<DeveloperPortal />} />

      {/* Brandaro AI Receptionist client portal - standalone, self-authenticated */}
      <Route path="/client-portal" element={<ReceptionistClientPortal />}>
        <Route index element={<ClientPortalDashboard />} />
        <Route path="calls" element={<ClientPortalCalls />} />
        <Route path="settings" element={<ClientPortalSettings />} />
        <Route path="billing" element={<ClientPortalBilling />} />
      </Route>

      <Route path="/install" element={<InstallPwa />} />
      <Route path="/system-health" element={<ProtectedRoute><RequireRole allowedRoles={['admin', 'owner']} strict><SystemHealthPage /></RequireRole></ProtectedRoute>} />
      <Route path="/admin/training" element={<ProtectedRoute><RequireRole allowedRoles={['owner','admin']} showLocked><TrainingAdminPage /></RequireRole></ProtectedRoute>} />
      <Route path="/admin/notification-settings" element={<ProtectedRoute><RequireRole allowedRoles={['owner','admin']} showLocked><AdminNotificationSettings /></RequireRole></ProtectedRoute>} />
      <Route path="/admin/notification-log" element={<ProtectedRoute><RequireRole allowedRoles={['owner','admin']} showLocked><AdminNotificationLog /></RequireRole></ProtectedRoute>} />
      <Route path="/admin/daily-reports" element={<ProtectedRoute><RequireRole allowedRoles={['owner','admin']} showLocked><AdminDailyReports /></RequireRole></ProtectedRoute>} />
      <Route path="/admin/partner-performance" element={<ProtectedRoute><RequireRole allowedRoles={['owner','admin']} showLocked><AdminPartnerPerformance /></RequireRole></ProtectedRoute>} />
      <Route path="/admin/ops-dashboard" element={<ProtectedRoute><RequireRole allowedRoles={['owner','admin']} showLocked><AdminOpsDashboard /></RequireRole></ProtectedRoute>} />
      <Route path="/admin/field-assignments" element={<ProtectedRoute><RequireRole allowedRoles={['owner','admin']} showLocked><FieldAssignments /></RequireRole></ProtectedRoute>} />
      <Route path="/twl-landing" element={<TWLLanding />} />
      <Route path="/partner/respond/:token" element={<PartnerRespond />} />
      <Route path="/tt/partner/accept/:token" element={<TTPartnerAccept />} />
      <Route path="/partner/claim" element={<PartnerClaim />} />
      <Route path="/partner/portal" element={<ProtectedRoute><PartnerPortal /></ProtectedRoute>} />
      <Route path="/admin/partners/import" element={<PartnersImport />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/pending-approval" element={<ProtectedRoute><PendingApproval /></ProtectedRoute>} />
      <Route path="/store-signup" element={<StoreSignupPage />} />
      <Route path="/auth/intake" element={<PublicIntakePage />} />
      <Route path="/auth/intake/:token" element={<PublicIntakePage />} />
      <Route path="/portal/login" element={<PortalLogin />} />
      {/* Client-facing portal: intentionally NOT staff-guarded — clients authenticate here and RLS scopes them to their own row */}
      <Route path="/funding-machine/portal" element={<FundingClientPortal />} />
      <Route path="/funding-portal" element={<Navigate to="/funding-machine/portal" replace />} />
      <Route path="/portal/register" element={<PortalRegister />} />
      <Route path="/portal/driver/login" element={<DriverLogin />} />
      <Route path="/portal/biker/login" element={<BikerLogin />} />
      {/* Public Ambassador Application Form */}
      <Route path="/apply" element={<ClipperApplication />} />
      <Route path="/apply/clipper" element={<Navigate to="/apply" replace />} />
      {/* Clipper Nation portal (approved clippers only — gated inside ClipperPortal) */}
      <Route path="/clipper/login" element={<ClipperLogin />} />
      <Route path="/clipper/portal" element={<ClipperPortal />} />
      <Route path="/apply/ambassador" element={<AmbassadorApplication />} />
      {/* Public GasMask ambassador referral form (shared by ambassadors, no login) */}
      <Route path="/ambassador-referral/:code" element={<AmbassadorReferralPage />} />
      <Route path="/apply/beauty-specialist" element={<BeautyProviderSignup />} />
      {/* Brandaro paid-client intake (public, no login) */}
      <Route path="/intake" element={<BrandaroIntakePage />} />
      <Route path="/ambassador/login" element={<AmbassadorLogin />} />
      <Route path="/ambassador/set-password" element={<AmbassadorSetPassword />} />
      <Route path="/ut/ambassador/dashboard" element={<UTAmbassadorDashboard />} />
      {/* Public Invite Signup - Primary and fallback routes */}
      <Route path="/signup" element={<InviteSignup />} />
      <Route path="/invite/accept" element={<InviteSignup />} />
      <Route path="/invite/ambassador/:token" element={<AmbassadorInviteAccept />} />
      <Route path="/invite/:token" element={<UniversalInviteAccept />} />
      <Route path="/accept-invite" element={<Navigate to="/signup" replace />} />
      {/* Brandaro Public Proposal Viewer */}
      <Route path="/proposal/:token" element={<PublicProposalPage />} />
      {/* Brandaro Public Client Demo View */}
      <Route path="/client/:token" element={<ClientDemoViewPage />} />

      {/* VA Portal — Public routes */}
      <Route path="/va/auth" element={<VAAuthPage />} />
      <Route path="/va/auth/:businessSlug" element={<VAAuthPage />} />
      <Route path="/va/reset-password" element={<VAResetPasswordPage />} />
      <Route path="/va/accept-invite/:token" element={<VAAcceptInvitePage />} />
      <Route path="/pay/:invoiceId" element={<PayInvoicePage />} />
      <Route path="/p/:code" element={<ShortLinkRedirect />} />
      <Route path="/brandaro/pay/:code" element={<ShortLinkRedirect />} />

      {/* VA Portal — Protected routes */}
      <Route path="/va/dashboard" element={<ProtectedRoute><RequireRole allowedRoles={['va','admin','owner']}><VADashboard /></RequireRole></ProtectedRoute>} />
      <Route path="/va/profile" element={<ProtectedRoute><RequireRole allowedRoles={['va','admin','owner']}><VAProfilePage /></RequireRole></ProtectedRoute>} />
      <Route path="/va/lead-discovery" element={<ProtectedRoute><RequireRole allowedRoles={['va','admin','owner']}><VADashboard /></RequireRole></ProtectedRoute>} />

      {/* Penthouse VA Management (admin only) */}
      <Route path="/penthouse/va-management" element={
        <ProtectedRoute><RequireRole allowedRoles={['admin']}><VAManagementPage /></RequireRole></ProtectedRoute>
      } />
      {/* Legacy admin paths → redirect into Brandaro hub */}
      <Route path="/admin/numbers" element={<Navigate to="/brandaro/admin-numbers" replace />} />
      <Route path="/admin/leaderboard" element={<Navigate to="/brandaro/admin-leaderboard" replace />} />
      <Route path="/admin/call-review" element={<Navigate to="/brandaro/admin-call-review" replace />} />
      <Route path="/admin/monitor" element={<Navigate to="/brandaro/admin-monitor" replace />} />
      <Route path="/admin/dnc" element={<Navigate to="/brandaro/admin-dnc" replace />} />

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* DYNASTY PARTNERS — ADMIN PANEL (David's view, RLS-gated by partner_admins)   */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      <Route path="/admin-debug" element={<AdminDebug />} />
      <Route path="/admin" element={<DPAdminLayout />}>
        <Route index element={<DPDashboard />} />
        <Route path="partners" element={<DPPartners />} />
        <Route path="create-partner" element={<DPCreatePartner />} />

        <Route path="mrr" element={<DPMrr />} />
        <Route path="platforms" element={<DPPlatforms />} />
        <Route path="recruitment" element={<DPRecruitment />} />
        <Route path="financials" element={<DPFinancials />} />
        <Route path="controls" element={<DPControls />} />
        <Route path="activity" element={<DPActivity />} />
        <Route path="manual" element={<DPManual />} />
        <Route path="notifications" element={<DPNotifications />} />
      </Route>

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
        <Route path="/admin/pending-users" element={<RequireRole allowedRoles={['owner', 'admin']} showLocked><PendingUsers /></RequireRole>} />
        <Route path="/security/pending-users" element={<Navigate to="/admin/pending-users" replace />} />

        {/* Territory Control Center (Floor 0-2 visibility — read-only) */}
        <Route path="/territory" element={<RequireRole allowedRoles={['owner', 'admin', 'staff']} showLocked><TerritoryOverview /></RequireRole>} />
        <Route path="/territory/tube-intelligence" element={<RequireRole allowedRoles={['owner', 'admin', 'staff']} showLocked><TubeTerritoryPage /></RequireRole>} />
        <Route path="/territory/tube-intelligence/:neighborhood" element={<RequireRole allowedRoles={['owner', 'admin', 'staff']} showLocked><NeighborhoodDetailPage /></RequireRole>} />
        <Route path="/territory/neighborhoods" element={<RequireRole allowedRoles={['owner', 'admin', 'staff']} showLocked><TerritoryNeighborhoods /></RequireRole>} />
        <Route path="/territory/coverage" element={<RequireRole allowedRoles={['owner', 'admin', 'staff']} showLocked><NeighborhoodCoverage /></RequireRole>} />
        <Route path="/territory/city-coverage/:city/:state" element={<RequireRole allowedRoles={['owner', 'admin', 'staff']} showLocked><CityCoveragePage /></RequireRole>} />

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
        <Route path="/gasmask/team" element={<Navigate to="/team" replace />} />
        <Route path="/gasmask/training" element={<Navigate to="/training" replace />} />
        <Route path="/gasmask/missions" element={<Navigate to="/missions" replace />} />
        <Route path="/gasmask/leaderboard" element={<Leaderboard />} />
        <Route path="/gasmask/rewards" element={<Navigate to="/rewards" replace />} />
        <Route path="/gasmask/territories" element={<Territories />} />
        <Route path="/gasmask/expansion" element={<Navigate to="/expansion" replace />} />
        <Route path="/gasmask/expansion/regions" element={<Navigate to="/expansion/regions" replace />} />
        <Route path="/gasmask/expansion/heatmap" element={<Navigate to="/expansion/heatmap" replace />} />
        <Route path="/gasmask/templates" element={<Navigate to="/templates" replace />} />
        <Route path="/gasmask/reminders" element={<Navigate to="/communications/reminders" replace />} />
        <Route path="/gasmask/sales" element={<Navigate to="/sales" replace />} />
        <Route path="/gasmask/sales/prospects" element={<Navigate to="/sales/prospects" replace />} />
        <Route path="/gasmask/sales/prospects/new" element={<Navigate to="/sales/prospects/new" replace />} />
        <Route path="/gasmask/sales/prospects/:id" element={<Navigate to="/sales/prospects" replace />} />
        <Route path="/gasmask/sales/report" element={<Navigate to="/sales/report" replace />} />
        <Route path="/gasmask/billing" element={<Navigate to="/billing" replace />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/collections" element={<CollectionsPage />} />
        <Route path="/gasmask/billing-center" element={<Navigate to="/billing-center" replace />} />
        <Route path="/gasmask/billing/invoices" element={<Navigate to="/billing/invoices" replace />} />
        <Route path="/gasmask/billing/invoices/new" element={<Navigate to="/billing/invoices/new" replace />} />
        <Route path="/gasmask/payroll" element={<Navigate to="/payroll" replace />} />
        <Route path="/gasmask/biker-payouts" element={<Navigate to="/payouts/bikers" replace />} />
        <Route path="/gasmask/delivery-capacity" element={<Navigate to="/delivery/capacity" replace />} />
        <Route path="/gasmask/subscriptions" element={<Navigate to="/subscriptions" replace />} />
        <Route path="/gasmask/wallet" element={<Navigate to="/wallet" replace />} />
        <Route path="/gasmask/analytics" element={<Navigate to="/analytics" replace />} />
        <Route path="/gasmask/routes" element={<RoutesPage />} />
        <Route path="/gasmask/routes/optimizer" element={<Navigate to="/routes/command-center" replace />} />
        <Route path="/gasmask/routes/ops-center" element={<RouteOpsCenter />} />
        <Route path="/gasmask/routes/:id" element={<GasMaskRouteIdRedirect />} />
        <Route path="/gasmask/stores" element={<Navigate to="/stores" replace />} />
        <Route path="/gasmask/stores/:id" element={<Navigate to="/stores" replace />} />
        <Route path="/gasmask/stores/:id/order" element={<Navigate to="/stores/order" replace />} />
        <Route path="/gasmask/store-performance" element={<Navigate to="/stores/performance" replace />} />
        <Route path="/gasmask/store-intelligence" element={<StoreIntelligencePage />} />
        <Route path="/gasmask/products" element={<Navigate to="/products" replace />} />
        <Route path="/gasmask/inventory" element={<Navigate to="/products" replace />} />
        <Route path="/gasmask/inventory-ops" element={<GasMaskInventoryOps />} />
        <Route path="/gasmask/map" element={<Navigate to="/map" replace />} />
        <Route path="/gasmask/live-map" element={<LiveMap />} />
        <Route path="/gasmask/ambassadors" element={<Ambassadors />} />
        <Route path="/gasmask/ambassador-payouts" element={<Navigate to="/payouts/ambassadors" replace />} />
        <Route path="/gasmask/ambassador-regions" element={<AmbassadorRegions />} />
        <Route path="/gasmask/wholesale" element={<Navigate to="/wholesale" replace />} />
        <Route path="/gasmask/wholesale/marketplace" element={<Navigate to="/wholesale/marketplace" replace />} />
        <Route path="/gasmask/wholesale/fulfillment" element={<Navigate to="/wholesale/fulfillment" replace />} />
        <Route path="/gasmask/wholesale/:id" element={<Navigate to="/wholesale" replace />} />
        <Route path="/gasmask/communications" element={<Navigate to="/communications" replace />} />
        <Route path="/gasmask/route-engine" element={<RouteEnginePage />} />
        <Route path="/gasmask/driver-route" element={<GasmaskDriverRoutePage />} />
        {/* T3 K2: Agent Center merged into Floor 9 intelligence suite */}
        <Route path="/gasmask/agent-center" element={<Navigate to="/grabba/floor9" replace />} />
        <Route path="/dynasty/agents" element={<Navigate to="/grabba/floor9" replace />} />
        <Route path="/gasmask/note-cleaner" element={<NoteCleanerPage />} />

        {/* HotMama — merged into the working brand dashboard */}
        <Route path="/hotmama/*" element={<Navigate to="/brand/hotmama" replace />} />

        {/* Finance & Real Estate */}
        <Route path="/finance" element={<Navigate to="/funding-machine" replace />} />
        <Route path="/finance/funding" element={<Navigate to="/funding-machine" replace />} />
        <Route path="/finance/funding-requests" element={<FundingRequests />} />
        <Route path="/finance/grants" element={<Navigate to="/os/grants" replace />} />
        <Route path="/finance/credit-repair" element={<Navigate to="/funding-machine/credit-repair" replace />} />
        <Route path="/finance/chexsystems" element={<Navigate to="/funding-machine" replace />} />
        <Route path="/finance/investment" element={<Navigate to="/os/wealth-engine" replace />} />
        <Route path="/finance/trading" element={<Navigate to="/os/wealth-engine" replace />} />
        <Route path="/finance/economic-analytics" element={<Navigate to="/analytics/economics" replace />} />
        <Route path="/finance/revenue-brain" element={<Navigate to="/analytics/revenue-brain" replace />} />
        <Route path="/finance/opportunity-radar" element={<Navigate to="/opportunities" replace />} />
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
        <Route path="/holdings/overview" element={<Navigate to="/holdings" replace />} />
        <Route path="/holdings/assets" element={<HoldingsAssets />} />
        <Route path="/holdings/airbnb" element={<HoldingsAirbnb />} />
        <Route path="/holdings/tenants" element={<HoldingsTenants />} />
        <Route path="/holdings/loans" element={<HoldingsLoans />} />
        <Route path="/holdings/expenses" element={<HoldingsExpenses />} />
        <Route path="/holdings/strategy" element={<HoldingsStrategy />} />

        {/* Systems & Engine Room */}
        <Route path="/system-operations/ai-ceo-control-room" element={<AICEOControlRoom />} />
        <Route path="/meta-ai" element={<MetaAI />} />
        <Route path="/executive-reports" element={<ExecutiveReports />} />
        {/* T3 K10: Missions HQ shell → real Penthouse Mission Control */}
        <Route path="/missions-hq" element={<Navigate to="/penthouse/missions" replace />} />
        {/* T3 K11: orphan comm pages — redirect to canonical hub */}
        <Route path="/communication-automation" element={<Navigate to="/settings/automation" replace />} />
        <Route path="/communications-ai" element={<Navigate to="/communication/agents" replace />} />
        <Route path="/communication-insights" element={<Navigate to="/communication/analytics" replace />} />
        <Route path="/dynasty-automations" element={<DynastyAutomations />} />

        {/* T3 K4: /communications-center ghost — collapse to Floor 2 Comm Hub */}
        <Route path="/communications-center" element={<Navigate to="/communication" replace />} />
        <Route path="/communications-center/*" element={<Navigate to="/communication" replace />} />

        {/* Call Center */}
        <Route path="/call-center" element={<CallCenterDashboard />} />
        <Route path="/call-center/dashboard" element={<Navigate to="/call-center" replace />} />
        <Route path="/call-center/dialer" element={<CallCenterDialer />} />
        <Route path="/call-center/logs" element={<CallLogs />} />
        <Route path="/call-center/analytics" element={<CallCenterAnalytics />} />
        <Route path="/call-center/ai-agents" element={<AIAgents />} />
        <Route path="/call-center/phone-numbers" element={<Navigate to="/call-center/numbers" replace />} />
        <Route path="/call-center/numbers" element={<PhoneNumbers />} />
        <Route path="/call-center/monitoring" element={<Navigate to="/call-center/live-monitoring" replace />} />
        <Route path="/call-center/live-monitoring" element={<LiveMonitoring />} />
        <Route path="/call-center/messages" element={<Messages />} />
        <Route path="/call-center/emails" element={<Emails />} />
        <Route path="/call-center/settings" element={<CallCenterSettings />} />
        <Route path="/text-center" element={<TextCenter />} />
        <Route path="/phone-log" element={<PhoneLog />} />
        <Route path="/email-center" element={<EmailCenter />} />

        {/* Legacy /callcenter/* → canonical /call-center/* (Pass 1B redirects; bookmarks preserved) */}
        <Route path="/callcenter" element={<Navigate to="/call-center" replace />} />
        <Route path="/callcenter/dashboard" element={<Navigate to="/call-center" replace />} />
        <Route path="/callcenter/numbers" element={<Navigate to="/call-center/numbers" replace />} />
        <Route path="/callcenter/logs" element={<Navigate to="/call-center/logs" replace />} />
        <Route path="/callcenter/ai" element={<Navigate to="/call-center/ai-agents" replace />} />
        <Route path="/callcenter/ai-agents" element={<Navigate to="/call-center/ai-agents" replace />} />
        <Route path="/callcenter/live-monitoring" element={<Navigate to="/call-center/live-monitoring" replace />} />
        <Route path="/callcenter/live" element={<Navigate to="/call-center/monitoring" replace />} />
        <Route path="/callcenter/dialer" element={<Navigate to="/call-center/dialer" replace />} />
        <Route path="/callcenter/analytics" element={<Navigate to="/call-center/analytics" replace />} />
        <Route path="/callcenter/messages" element={<Navigate to="/call-center/messages" replace />} />
        <Route path="/callcenter/emails" element={<Navigate to="/call-center/emails" replace />} />
        <Route path="/callcenter/settings" element={<Navigate to="/call-center/settings" replace />} />

        {/* 📞 Dynasty Connect Hub */}
        <Route path="/dynasty-connect" element={<DCLayout />}>
          <Route index element={<DCCommandCenter />} />
          <Route path="live" element={<DCLiveCalls />} />
          <Route path="campaigns" element={<DCCampaigns />} />
          <Route path="campaigns/builder" element={<DCCampaignBuilder />} />
          <Route path="campaigns/outbound" element={<DCCampaignManager />} />
          <Route path="agents" element={<DCAgents />} />
          <Route path="agents/playbooks" element={<Navigate to="/dynasty-connect/agents" replace />} />
          <Route path="intelligence" element={<DCIntelligence />} />
          <Route path="intelligence/self-learn" element={<Navigate to="/dynasty-connect/agents" replace />} />
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
          <Route path="phone-manager" element={<DCPhoneNumbersManager />} />
          <Route path="dispatch" element={<DCCallDispatch />} />
          <Route path="results" element={<DCCallResults />} />
          <Route path="analytics-dashboard" element={<DCAnalyticsDashboard />} />
          <Route path="lead-pipeline" element={<DCLeadPipeline />} />
          <Route path="clients" element={<DCClients />} />
          <Route path="bulk-launch" element={<DCBulkLaunch />} />
          <Route path="live" element={<DCLiveCallsBoard />} />
          <Route path="finished" element={<DCFinishedCallsPage />} />
          <Route path="leads" element={<DCLeadInbox />} />
          <Route path="recordings" element={<DCRecordingsPage />} />
          <Route path="dispositions" element={<DCDispositionManager />} />
          <Route path="dnc" element={<DCDNCManager />} />
          <Route path="compliance" element={<DCComplianceDashboard />} />
        </Route>

        {/* 🎙️ Voice Ops Dashboard */}
        <Route path="/voice-ops" element={<VoiceOpsLayout />}>
          <Route index element={<VODashboard />} />
          <Route path="numbers" element={<VONumbers />} />
          <Route path="agents" element={<VOAgents />} />
          <Route path="secrets" element={<VOSecrets />} />
          <Route path="outbound" element={<VOOutbound />} />
        </Route>

        {/* /comm-systems/* removed (Coherence Pass 1A). Canonical hub: /communication/*. */}


        <Route path="/va-performance" element={<VAPerformance />} />
        <Route path="/va-ranking" element={<VARanking />} />
        <Route path="/va-task-center" element={<VATaskCenter />} />
        <Route path="/batch-import" element={<BatchImport />} />
        <Route path="/hr" element={<RequireRole allowedRoles={['owner','admin']} showLocked><HR /></RequireRole>} />
        <Route path="/hr/applicants" element={<RequireRole allowedRoles={['owner','admin']} showLocked><HRApplicants /></RequireRole>} />
        <Route path="/hr/applicants/:id" element={<RequireRole allowedRoles={['owner','admin']} showLocked><HRApplicantDetail /></RequireRole>} />
        <Route path="/hr/employees" element={<RequireRole allowedRoles={['owner','admin']} showLocked><HREmployees /></RequireRole>} />
        <Route path="/hr/employees/:id" element={<RequireRole allowedRoles={['owner','admin']} showLocked><HREmployeeDetail /></RequireRole>} />
        <Route path="/hr/interviews" element={<RequireRole allowedRoles={['owner','admin']} showLocked><HRInterviews /></RequireRole>} />
        <Route path="/hr/documents" element={<RequireRole allowedRoles={['owner','admin']} showLocked><HRDocuments /></RequireRole>} />
        <Route path="/hr/onboarding" element={<RequireRole allowedRoles={['owner','admin']} showLocked><HROnboarding /></RequireRole>} />
        {/* T3 K6: HR Payroll merged into Floor 5 Payroll Manager */}
        <Route path="/hr/payroll" element={<Navigate to="/grabba/payroll-manager" replace />} />
        <Route path="/my-hr" element={<MyHR />} />
        <Route path="/me/hr" element={<Navigate to="/my-hr" replace />} />

        {/* Legacy Routes */}
        <Route path="/stores" element={<Stores />} />
        <Route path="/new-arrivals" element={<RequireRole allowedRoles={['owner','admin','employee','staff']} showLocked><NewArrivals /></RequireRole>} />
        <Route path="/stores/:id" element={<StoreDetail />} />
        <Route path="/sell-through-analytics" element={<SellThroughAnalytics />} />
        <Route path="/brand-crm" element={<BrandCRMPage />} />
        <Route path="/stores/performance" element={<StorePerformance />} />
        <Route path="/stores/order" element={<StoreOrder />} />
        {/* T3 K1: All Routes redirected to Route Manager (canonical) */}
        <Route path="/routes" element={<Navigate to="/grabba/routes" replace />} />
        <Route path="/routes/optimizer" element={<Navigate to="/routes/command-center" replace />} />
        <Route path="/routes/ops-center" element={<Navigate to="/route-ops-center" replace />} />
        <Route path="/routes/command-center" element={<RouteCommandCenter />} />
        <Route path="/routes/command" element={<Navigate to="/routes/command-center" replace />} />
        <Route path="/gasmask/routes/command" element={<Navigate to="/routes/command-center" replace />} />
        <Route path="/dispatch/command" element={<Navigate to="/routes/command-center" replace />} />
        <Route path="/route-ops-center" element={<RouteOpsCenterEnhanced />} />
        <Route path="/ops-command-center" element={<OpsCommandCenter />} />
        {/* Route Optimizer - Floor 4 Planning Intelligence */}
        {/* T3 M1: standalone Route Optimizer killed — Optimize action lives in /routes/command-center */}
        <Route path="/route-optimizer" element={<Navigate to="/routes/command-center" replace />} />
        <Route path="/dispatch/pending-stops" element={<PendingRouteStopsPage />} />
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
        <Route path="/reports/samples-by-brand" element={<SamplesByBrandReport />} />
        <Route path="/reports/samples-by-store" element={<SamplesByStoreReport />} />
        <Route path="/reports/account-activity" element={<AccountActivityReport />} />
        <Route path="/influencers" element={<Influencers />} />
        <Route path="/influencers/analytics" element={<InfluencerAnalyticsCenter />} />
        <Route path="/influencers/:id" element={<InfluencerDetail />} />
        <Route path="/influencers/campaigns" element={<InfluencerCampaigns />} />
        <Route path="/missions" element={<Missions />} />
        <Route path="/communications" element={<Communications />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/communications/reminders" element={<Reminders />} />
        {/* T3 K11: orphan comm pages → canonical hub redirects */}
        <Route path="/communications/ai-insights" element={<Navigate to="/communication/agents" replace />} />
        <Route path="/communications/insights" element={<Navigate to="/communication/analytics" replace />} />
        <Route path="/settings/automation" element={<RequireRole allowedRoles={['owner','admin']} showLocked><AutomationSettings /></RequireRole>} />
        <Route path="/settings/automation/communications" element={<Navigate to="/settings/automation" replace />} />
        <Route path="/training" element={<Training />} />
        <Route path="/ambassadors" element={<AllAmbassadorsTable />} />
        <Route path="/ambassadors/command" element={<AmbassadorCommandDashboard />} />
        <Route path="/ambassadors/tasks" element={<AmbassadorTasksAdmin />} />
        <Route path="/ambassadors/box-requests" element={<AmbassadorBoxRequests />} />
        <Route path="/ambassador-regions" element={<AmbassadorRegionsPage />} />
        <Route path="/ambassador-payouts" element={<Floor8PayoutsPage />} />
        <Route path="/ambassadors/regions" element={<Navigate to="/ambassador-regions" replace />} />
        <Route path="/ambassadors/payouts" element={<Navigate to="/ambassador-payouts" replace />} />
        <Route path="/expansion" element={<Expansion />} />
        <Route path="/expansion/regions" element={<ExpansionRegions />} />
        <Route path="/expansion/heatmap" element={<ExpansionHeatmap />} />
        <Route path="/rewards" element={<Rewards />} />
        <Route path="/driver" element={<Navigate to="/delivery/driver" replace />} />
        <Route path="/drivers/leaderboard" element={<Navigate to="/gasmask/leaderboard" replace />} />
        <Route path="/drivers/payroll" element={<Navigate to="/payroll" replace />} />
        {/* T2: de-dup Meta AI; /meta-ai is canonical (line 1448). Legacy /ai/meta redirects. */}
        <Route path="/ai/meta" element={<Navigate to="/meta-ai" replace />} />
        {/* T2 legacy sidebar redirects (kept so old bookmarks still resolve) */}
        <Route path="/revenue-brain" element={<Navigate to="/analytics/revenue-brain" replace />} />
        <Route path="/leaderboard" element={<Navigate to="/gasmask/leaderboard" replace />} />
        <Route path="/territories" element={<Navigate to="/gasmask/territories" replace />} />
        <Route path="/brand-dashboard" element={<Navigate to="/brand/gasmask" replace />} />
        <Route path="/ai-ceo" element={<Navigate to="/system-operations/ai-ceo-control-room" replace />} />
        <Route path="/automation-settings" element={<Navigate to="/settings/automation" replace />} />
        <Route path="/crm/backup" element={<Navigate to="/crm/data" replace />} />
        <Route path="/pod/generator" element={<Navigate to="/pod/generate" replace />} />
        <Route path="/communication/follow-up" element={<Navigate to="/communication/follow-ups" replace />} />
        <Route path="/influencer-campaigns" element={<Navigate to="/influencers/campaigns" replace />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/sales/prospects" element={<SalesProspects />} />
        <Route path="/sales/prospects/new" element={<SalesProspectNew />} />
        <Route path="/sales/prospects/:id" element={<SalesProspectDetail />} />
        <Route path="/sales/report" element={<SalesReport />} />
        <Route path="/ops/opportunity-radar" element={<Navigate to="/opportunities" replace />} />
        <Route path="/opportunity-radar" element={<Navigate to="/opportunities" replace />} />
        <Route path="/opportunities" element={<MasterOpportunities />} />
        <Route path="/payouts/ambassadors" element={<AmbassadorPayouts />} />
        <Route path="/payouts/bikers" element={<BikerPayouts />} />
        {/* Floor 5 - Finance & Orders */}
        <Route path="/floor5" element={<Floor5Dashboard />} />
        <Route path="/floor5/dashboard" element={<Navigate to="/floor5" replace />} />
        <Route path="/floor5/invoices" element={<Navigate to="/billing/invoices" replace />} />
        <Route path="/floor5/billing" element={<Navigate to="/billing-center" replace />} />
        <Route path="/floor5/payroll" element={<Navigate to="/payroll" replace />} />
        <Route path="/floor5/unpaid" element={<Navigate to="/unpaid-accounts" replace />} />
        <Route path="/floor5/fulfillment" element={<Navigate to="/wholesale/fulfillment" replace />} />
        <Route path="/billing" element={<RequireRole allowedRoles={['owner','admin']} showLocked><Billing /></RequireRole>} />
        <Route path="/billing/center" element={<Navigate to="/billing-center" replace />} />
        <Route path="/billing-center" element={<RequireRole allowedRoles={['owner','admin']} showLocked><BillingCenter /></RequireRole>} />
        <Route path="/billing/invoices" element={<RequireRole allowedRoles={['owner','admin']} showLocked><BillingInvoices /></RequireRole>} />
        <Route path="/billing/invoices/new" element={<RequireRole allowedRoles={['owner','admin']} showLocked><BillingInvoiceNew /></RequireRole>} />
        <Route path="/billing/invoices/:id" element={<RequireRole allowedRoles={['owner','admin']} showLocked><BillingInvoiceDetail /></RequireRole>} />
        <Route path="/payroll" element={<RequireRole allowedRoles={['owner','admin']} showLocked><Payroll /></RequireRole>} />
        <Route path="/unpaid-accounts" element={<UnpaidAccounts />} />
        {/* Communication Center - Redirect to modular hub */}
        <Route path="/communication-center" element={<Navigate to="/communication" replace />} />

        {/* CRM - Global CRM with Blueprint System */}
        {/* Floor 1: Global CRM Hub - shows all businesses */}
        <Route path="/crm" element={<GlobalCRMDashboard />} />
        <Route path="/crm/add-business" element={<AddBusinessPage />} />
        <Route path="/crm/data" element={<CRMDataPage />} />
        <Route path="/crm/data/export" element={<CRMExportPage />} />
        <Route path="/crm/data/import" element={<CRMImportPage />} />
        <Route path="/crm/data/bulk-upload" element={<CRMBulkUpload />} />
        {/* T3 K5: CRM Backup page killed — redirect to CRM Data hub */}
        <Route path="/crm/data/backup" element={<Navigate to="/crm/data" replace />} />
        <Route path="/crm/settings" element={<CRMSettingsPage />} />
        <Route path="/crm/user-access" element={<CRMUserAccessPage />} />
        <Route path="/crm/accept-invite" element={<AcceptCRMInvite />} />
        <Route path="/crm/global" element={<Navigate to="/crm" replace />} />
        <Route path="/crm/legacy" element={<GlobalCRM />} />
        <Route path="/crm/contact-management" element={<ContactManagementPage />} />
        <Route path="/crm/relationship-health" element={<RelationshipHealthRollup />} />
        
        {/* Business-scoped CRM routes - CANONICAL PATTERN: /crm/:businessSlug/* */}
        {/* CRMRouter handles legacy vs new CRM routing: Grabba → Legacy, Others → Blueprint */}
        <Route path="/crm/:businessSlug" element={<CRMRouter />} />
        <Route path="/crm/brandaro/:leadId" element={<BrandaroLeadProfile />} />
        <Route path="/products" element={<BrandaroProductsPage />} />
        <Route path="/maintenance-list" element={<MaintenanceListPage />} />
        
        {/* TopTier Partner CRM Routes */}
        <Route path="/crm/toptier-experience/supply-map" element={<TopTierSupplyMap />} />
        <Route path="/crm/toptier-experience/partners" element={<TopTierPartnerDashboard />} />
        <Route path="/crm/toptier-experience/partners/all" element={<TopTierAllPartners />} />
        <Route path="/crm/toptier-experience/partners/new" element={<Navigate to="/crm/toptier-experience/partner/new" replace />} />
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
        <Route path="/crm/toptier-experience/bookings/new" element={<Navigate to={'/crm/toptier-experience/deals/new' + window.location.search} replace />} />
        <Route path="/crm/toptier-experience/bookings/recent" element={<Navigate to="/crm/toptier-experience/bookings" replace />} />
        <Route path="/crm/toptier-experience/requests" element={<TopTierCustomerRequests />} />
        <Route path="/crm/toptier-experience/requests/new" element={<Navigate to="/crm/toptier-experience/requests" replace />} />
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
        {/* T3 M4: customers becomes a tab inside Global CRM */}
        <Route path="/crm/customers" element={<Navigate to="/crm?tab=customers" replace />} />
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
        <Route path="/driver-debt-collection" element={<DriverDebtCollection />} />
        <Route path="/brand/:brand" element={<BrandDashboard />} />

        {/* Legacy Real Estate routes removed — see Real Estate OS hub at /real-estate (RELayout) */}


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
        <Route path="/os/procurement/dashboard" element={<Navigate to="/os/procurement" replace />} />
        <Route path="/os/procurement/suppliers" element={<ProcurementSuppliersPage />} />
        <Route path="/os/procurement/suppliers/:id" element={<ProcurementSupplierDetailPage />} />
        <Route path="/os/procurement/purchase-orders" element={<ProcurementPurchaseOrdersPage />} />
        <Route path="/os/procurement/purchase-orders/new" element={<ProcurementNewPurchaseOrderPage />} />
        <Route path="/os/procurement/purchase-orders/:id" element={<ProcurementPurchaseOrderDetailPage />} />
        <Route path="/os/warehouse" element={<WarehouseDashboard />} />

        {/* OS Inventory */}
        <Route path="/os/inventory" element={<InventoryDashboard />} />
        <Route path="/os/inventory/dashboard" element={<Navigate to="/os/inventory" replace />} />
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

        {/* Historical Import — staging review & commit (David's Excels/notepads) */}
        <Route
          path="/admin/historical-import"
          element={
            <RequireRole allowedRoles={['admin', 'owner']} showLocked>
              <HistoricalImportReview />
            </RequireRole>
          }
        />

        {/* Dynasty Direct Ops — Sprint 1 unification + geocoding console */}
        <Route
          path="/admin/dynasty-direct-ops"
          element={
            <RequireRole allowedRoles={['admin', 'owner']} showLocked>
              <DynastyDirectOps />
            </RequireRole>
          }
        />

        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        {/* DYNASTY DIRECT HUB — Sprint 2 (unified shell for all DD surfaces)          */}
        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        <Route
          path="/dynasty-direct"
          element={
            <RequireRole allowedRoles={['admin', 'owner', 'employee']} showLocked>
              <DynastyDirectHubHome />
            </RequireRole>
          }
        />
        <Route
          path="/dynasty-direct/messages"
          element={
            <RequireRole allowedRoles={['admin', 'owner', 'employee']} showLocked>
              <DynastyDirectMessages />
            </RequireRole>
          }
        />
        <Route
          path="/dynasty-direct/orders"
          element={
            <RequireRole allowedRoles={['admin', 'owner', 'employee']} showLocked>
              <DynastyDirectOrders />
            </RequireRole>
          }
        />
        <Route
          path="/dynasty-direct/suppliers/network"
          element={
            <RequireRole allowedRoles={['admin', 'owner', 'employee']} showLocked>
              <DynastyDirectSupplierNetwork />
            </RequireRole>
          }
        />
        {/* Aliases — route DD sub-paths into the existing scattered pages */}
        <Route
          path="/dynasty-direct/catalog/onboard"
          element={
            <RequireRole allowedRoles={['admin', 'owner', 'employee']} showLocked>
              <DynastyDirectCatalogOnboard />
            </RequireRole>
          }
        />
        <Route
          path="/dynasty-direct/catalog/review"
          element={
            <RequireRole allowedRoles={['admin', 'owner']} showLocked>
              <DynastyDirectCatalogReview />
            </RequireRole>
          }
        />
        <Route
          path="/dynasty-direct/content-library"
          element={
            <RequireRole allowedRoles={['admin', 'owner', 'employee']} showLocked>
              <DynastyDirectContentLibrary />
            </RequireRole>
          }
        />
        <Route
          path="/dynasty-direct/invites"
          element={
            <RequireRole allowedRoles={['admin', 'owner', 'employee']} showLocked>
              <DynastyDirectInvites />
            </RequireRole>
          }
        />
        <Route
          path="/dynasty-direct/store-applications"
          element={
            <RequireRole allowedRoles={['admin', 'owner', 'employee']} showLocked>
              <DynastyDirectStoreApplications />
            </RequireRole>
          }
        />
        <Route path="/dynasty-direct/catalog" element={<RequireRole allowedRoles={['admin', 'owner']} showLocked><MarketplaceAdminPortalPage /></RequireRole>} />
        <Route path="/dynasty-direct/store-storefront" element={<RequireRole allowedRoles={['admin', 'owner', 'store']} showLocked><StorePortalPage /></RequireRole>} />
        {/* Legacy alias — the storefront is public at /shop. */}
        <Route path="/dynasty-direct/d2c-storefront" element={<Navigate to="/shop" replace />} />
        <Route path="/dynasty-direct/fulfillment" element={<RequireRole allowedRoles={['admin', 'owner']} showLocked><DynastyDirectFulfillmentConsole /></RequireRole>} />
        <Route path="/dynasty-direct/shipping" element={<RequireRole allowedRoles={['admin', 'owner']} showLocked><DDShippingPage /></RequireRole>} />
        <Route path="/dynasty-direct/products" element={<RequireRole allowedRoles={['admin', 'owner', 'wholesaler']} showLocked><DDProductManagementPage /></RequireRole>} />
        <Route path="/dynasty-direct/pricing" element={<RequireRole allowedRoles={['admin', 'owner']} showLocked><DDPricingPage /></RequireRole>} />
        <Route path="/dynasty-direct/delivery" element={<RequireRole allowedRoles={['admin', 'owner', 'employee']} showLocked><DDLocalDelivery /></RequireRole>} />
        <Route path="/dynasty-direct/suppliers/instructions" element={<RequireRole allowedRoles={['admin', 'owner', 'wholesaler']} showLocked><DDSupplierInstructions /></RequireRole>} />
        <Route path="/dynasty-direct/splits" element={<RequireRole allowedRoles={['admin', 'owner']} showLocked><DynastyDirectSplitConsole /></RequireRole>} />
        <Route
          path="/dynasty-direct/inventory"
          element={
            <RequireRole allowedRoles={['admin', 'owner', 'employee']} showLocked>
              <DynastyDirectInventory />
            </RequireRole>
          }
        />
        <Route path="/dynasty-direct/inventory/forecast" element={<RequireRole allowedRoles={['admin', 'owner', 'employee']} showLocked><DDInventoryForecast /></RequireRole>} />
        <Route path="/dynasty-direct/suppliers/portal" element={<RequireRole allowedRoles={['admin', 'owner', 'wholesaler']} showLocked><WholesalerPortalPage /></RequireRole>} />
        <Route path="/dynasty-direct/suppliers/inventory" element={<RequireRole allowedRoles={['admin', 'owner', 'wholesaler']} showLocked><WholesalerPortalPage /></RequireRole>} />
        <Route path="/dynasty-direct/suppliers/performance" element={<RequireRole allowedRoles={['admin', 'owner']} showLocked><DDSupplierPerformance /></RequireRole>} />
        <Route path="/dynasty-direct/purchase-orders" element={<RequireRole allowedRoles={['admin', 'owner']} showLocked><DDPurchaseOrders /></RequireRole>} />
        <Route path="/dynasty-direct/qa" element={<RequireRole allowedRoles={['admin', 'owner']} showLocked><DDProductQA /></RequireRole>} />
        <Route path="/dynasty-direct/reviews" element={<RequireRole allowedRoles={['admin', 'owner']} showLocked><DDReviews /></RequireRole>} />
        <Route path="/dynasty-direct/flash-sales" element={<RequireRole allowedRoles={['admin', 'owner']} showLocked><DDFlashSales /></RequireRole>} />
        <Route path="/dynasty-direct/catalog/bundles" element={<RequireRole allowedRoles={['admin', 'owner']} showLocked><DDBundles /></RequireRole>} />
        <Route path="/dynasty-direct/grabba-bridge" element={<RequireRole allowedRoles={['admin', 'owner']} showLocked><DynastyDirectGrabbaBridge /></RequireRole>} />
        <Route
          path="/dynasty-direct/affiliates"
          element={
            <RequireRole allowedRoles={['admin', 'owner', 'employee']} showLocked>
              <DynastyDirectAffiliates />
            </RequireRole>
          }
        />
        <Route
          path="/dynasty-direct/partners"
          element={
            <RequireRole allowedRoles={['admin', 'owner']} showLocked>
              <DDPartnerCampaigns />
            </RequireRole>
          }
        />

        <Route path="/dynasty-direct/analytics" element={<RequireRole allowedRoles={['admin', 'owner', 'employee']} showLocked><DDAnalytics /></RequireRole>} />
        <Route path="/dynasty-direct/stores" element={<RequireRole allowedRoles={['admin', 'owner']} showLocked><DDStoreAccounts /></RequireRole>} />
        <Route path="/dynasty-direct/settings" element={<RequireRole allowedRoles={['admin', 'owner']} showLocked><DDSettings /></RequireRole>} />
        <Route path="/dynasty-direct/readiness" element={<RequireRole allowedRoles={['admin', 'owner']} showLocked><DDReadiness /></RequireRole>} />
        <Route path="/dynasty-direct/returns" element={<RequireRole allowedRoles={['admin', 'owner', 'employee']} showLocked><DDReturnsQueue /></RequireRole>} />
        <Route path="/dynasty-direct/inr-claims" element={<RequireRole allowedRoles={['admin', 'owner', 'employee']} showLocked><DDInrQueue /></RequireRole>} />
        <Route path="/dynasty-direct/support" element={<RequireRole allowedRoles={['admin', 'owner', 'employee']} showLocked><DDSupportTickets /></RequireRole>} />
        <Route path="/dynasty-direct/commission-rates" element={<RequireRole allowedRoles={['admin', 'owner']} showLocked><DDCommissionRates /></RequireRole>} />
        <Route path="/dynasty-direct/orders/:orderId" element={<RequireRole allowedRoles={['admin', 'owner', 'employee']} showLocked><DDOrderDetail /></RequireRole>} />

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
          <Route path="ai-brain" element={<TTAIBrain />} />
          <Route path="drivers" element={<TTFleet />} />
          <Route path="settings" element={<TTSettings />} />
          <Route path="pricing" element={<TTPricing />} />
          <Route path="dispatch" element={<TTDispatch />} />
          <Route path="payments" element={<TTPayments />} />
          <Route path="reviews" element={<TTReviews />} />
          <Route path="corporate" element={<TTCorporate />} />
          <Route path="decor-experience" element={<DecorExperienceWizard />} />
          <Route path="things-to-do" element={<ThingsToDoExperiences />} />
          <Route path="things-to-do/bookings" element={<ThingsToDoBookings />} />
          <Route path="things-to-do/analytics" element={<ThingsToDoAnalytics />} />
          <Route path="things-to-do/markup" element={<ThingsToDoMarkup />} />
          <Route path="things-to-do/addons" element={<ThingsToDoAddons />} />
          <Route path="things-to-do/profit" element={<ThingsToDoProfitDashboard />} />
          <Route path="kids-family" element={<KidsFamilyExperiences />} />
          <Route path="kids-family/vendors" element={<KidsFamilyVendors />} />
          <Route path="kids-family/bundles" element={<KidsFamilyBundles />} />
          <Route path="kids-family/performance" element={<KidsFamilyPerformance />} />
          <Route path="kids-family/api" element={<KidsFamilyApiPanel />} />
          <Route path="kids-family/leads" element={<KidsFamilyVendorLeads />} />
          <Route path="partners-mgmt" element={<TTPartnersMgmt />} />
          <Route path="fleet" element={<TTFleet />} />
          <Route path="payouts" element={<TTPayouts />} />
          <Route path="commissions" element={<TTCommissions />} />
          <Route path="affiliates" element={<TTAffiliates />} />
          <Route path="packages" element={<TTPackages />} />
          <Route path="promo-codes" element={<TTPromoCodes />} />
          <Route path="dispatch-requests" element={<TTDispatchRequests />} />
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
          <Route path="hotels" element={<PenthouseHotels />} />
          <Route path="security" element={<PenthouseSecurity />} />
          <Route path="corporate-events" element={<PenthouseCorporateEvents />} />
          <Route path="vehicle-decor" element={<PenthouseVehicleDecor />} />
          <Route path="fleet" element={<PenthouseFleet />} />
          <Route path="addons" element={<PenthouseAddons />} />
          <Route path="gift-experiences" element={<PenthouseGiftExperiences />} />
          <Route path="beauty-providers" element={<PenthouseBeautyProviders />} />
          <Route path="coach-bus-dispatch" element={<PenthouseCoachBusDispatch />} />
          <Route path="private-jet-dispatch" element={<PenthousePrivateJetDispatch />} />
          <Route path="yacht-ops" element={<PenthouseYachtOps />} />
          <Route path="exotic-car-ops" element={<PenthouseExoticCarOps />} />
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
        <Route path="/crm/unforgettable_times_usa/partner-leads" element={<UnforgettableCRMDashboard />} />
        <Route path="/os/iclean" element={<ICleanDashboard />} />
        <Route path="/os/icw" element={<ICWCommandDashboard />} />
        <Route path="/os/icw/workers" element={<ICWWorkerRoster />} />
        <Route path="/os/icw/map" element={<ICWLeadMap />} />
        <Route path="/os/icw/crm" element={<ICWCrm />} />
        <Route path="/os/playboxxx" element={<PlayboxxxDashboard />} />
        <Route path="/os/playboxxx/recruiting" element={<PbxRecruitingDashboard />} />
        <Route path="/os/playboxxx/recruiting/staff-sourcing" element={<PbxStaffSourcing />} />
        <Route path="/os/playboxxx/recruiting/creator-sourcing" element={<PbxCreatorSourcing />} />
        <Route path="/os/playboxxx/recruiting/search-assignments" element={<PbxSearchAssignments />} />
        <Route path="/os/playboxxx/recruiting/candidates" element={<PbxCandidates />} />
        <Route path="/os/playboxxx/recruiting/automation-runs" element={<PbxAutomationRuns />} />
        <Route path="/os/playboxxx/recruiting/audit-logs" element={<PbxAuditLogs />} />
        <Route path="/os/playboxxx/recruiting/settings" element={<PbxRecruitingSettings />} />
        <Route path="/os/special-needs" element={<SpecialNeedsDashboard />} />
        {/* /os/funding removed — orphan mock page, real system is /funding-machine */}
        <Route path="/os/grants" element={<RequireRole allowedRoles={['admin','owner']} showLocked><GrantsDashboard /></RequireRole>} />
        <Route path="/os/grants/dashboard" element={<Navigate to="/os/grants" replace />} />
        <Route path="/os/grants/opportunities" element={<RequireRole allowedRoles={['admin','owner']} showLocked><GrantOpportunities /></RequireRole>} />
        <Route path="/os/grants/applications" element={<RequireRole allowedRoles={['admin','owner']} showLocked><GrantApplicationsPage /></RequireRole>} />
        <Route path="/os/grants/approved" element={<RequireRole allowedRoles={['admin','owner']} showLocked><GrantApplicationsPage /></RequireRole>} />
        <Route path="/os/grants/pending" element={<RequireRole allowedRoles={['admin','owner']} showLocked><GrantApplicationsPage /></RequireRole>} />
        <Route path="/os/grants/funder-crm" element={<RequireRole allowedRoles={['admin','owner']} showLocked><GrantFunderCRMPage /></RequireRole>} />
        <Route path="/os/grants/businesses" element={<RequireRole allowedRoles={['admin','owner']} showLocked><GrantBusinessProfiles /></RequireRole>} />
        <Route path="/os/grants/businesses/:id" element={<RequireRole allowedRoles={['admin','owner']} showLocked><GrantBusinessProfileDetail /></RequireRole>} />
        <Route path="/os/grants/eligibility" element={<RequireRole allowedRoles={['admin','owner']} showLocked><GrantEligibilityMatrix /></RequireRole>} />
        <Route path="/os/grants/eligibility-matrix" element={<Navigate to="/os/grants/eligibility" replace />} />
        <Route path="/os/grants/apply/:packageId" element={<RequireRole allowedRoles={['admin','owner']} showLocked><GrantApplicationPackage /></RequireRole>} />
        <Route path="/os/grants/:id" element={<RequireRole allowedRoles={['admin','owner']} showLocked><GrantApplicationDetail /></RequireRole>} />
        <Route path="/os/wealth-engine" element={<WealthEngineDashboard />} />
        {/* Dynasty Capital — unified funding + grant capital view */}
        <Route path="/dynasty-capital" element={<RequireRole allowedRoles={['owner','admin','employee','accountant']} showLocked><DynastyCapitalPage /></RequireRole>} />
        {/* Floor 10 — Dynasty Funding Machine */}
        <Route path="/funding-machine" element={<RequireRole allowedRoles={['owner','admin','employee','accountant']} showLocked><FundingMachineDashboard /></RequireRole>} />

        <Route path="/funding-machine/intake" element={<RequireRole allowedRoles={['owner','admin','employee','accountant']} showLocked><FundingMachineIntake /></RequireRole>} />
        <Route path="/funding-machine/client/:clientId" element={<RequireRole allowedRoles={['owner','admin','employee','accountant']} showLocked><FundingMachineClientProfile /></RequireRole>} />
        <Route path="/funding-machine/credit-repair" element={<RequireRole allowedRoles={['owner','admin','employee','accountant']} showLocked><FundingMachineCreditRepair /></RequireRole>} />
        <Route path="/funding-machine/business-builder" element={<RequireRole allowedRoles={['owner','admin','employee','accountant']} showLocked><FundingMachineBusinessBuilder /></RequireRole>} />
        <Route path="/funding-machine/bureau-intel" element={<RequireRole allowedRoles={['owner','admin','employee','accountant']} showLocked><FundingMachineBureauIntel /></RequireRole>} />
        <Route path="/funding-machine/funding-matrix" element={<RequireRole allowedRoles={['owner','admin','employee','accountant']} showLocked><FundingMachineFundingMatrix /></RequireRole>} />
        <Route path="/funding-machine/applications" element={<RequireRole allowedRoles={['owner','admin','employee','accountant']} showLocked><FundingMachineApplications /></RequireRole>} />
        <Route path="/funding-machine/velocity" element={<RequireRole allowedRoles={['owner','admin','employee','accountant']} showLocked><FundingMachineVelocity /></RequireRole>} />
        <Route path="/funding-machine/tradeline-vault" element={<RequireRole allowedRoles={['owner','admin','employee','accountant']} showLocked><FundingMachineTradelineVault /></RequireRole>} />
        <Route path="/funding-machine/tasks" element={<RequireRole allowedRoles={['owner','admin','employee','accountant']} showLocked><FundingMachineTaskCards /></RequireRole>} />
        <Route path="/funding-machine/morning-briefing" element={<Navigate to="/funding-machine/briefing" replace />} />
        <Route path="/funding-machine/bill-guardian" element={<RequireRole allowedRoles={['owner','admin','employee','accountant']} showLocked><FundingMachineBillGuardian /></RequireRole>} />
        <Route path="/funding-machine/deletion-letters" element={<RequireRole allowedRoles={['owner','admin','employee','accountant']} showLocked><FundingMachineDeletionLetterEngine /></RequireRole>} />
        <Route path="/funding-machine/secure-intake" element={<RequireRole allowedRoles={['owner','admin','employee','accountant']} showLocked><FundingMachineSecureIntake /></RequireRole>} />
        <Route path="/funding-machine/credit-union-intel" element={<RequireRole allowedRoles={['owner','admin','employee','accountant']} showLocked><FundingMachineCreditUnionIntel /></RequireRole>} />
        <Route path="/funding-machine/auto-financing" element={<RequireRole allowedRoles={['owner','admin','employee','accountant']} showLocked><FundingMachineAutoFinancing /></RequireRole>} />
        <Route path="/funding-machine/shelf-corp" element={<RequireRole allowedRoles={['owner','admin','employee','accountant']} showLocked><FundingMachineShelfCorp /></RequireRole>} />
        <Route path="/funding-machine/settings" element={<RequireRole allowedRoles={['owner','admin','employee','accountant']} showLocked><FundingMachineSettings /></RequireRole>} />
        <Route path="/funding-machine/revenue" element={<RequireRole allowedRoles={['owner','admin','employee','accountant']} showLocked><FundingMachineRevenue /></RequireRole>} />
        <Route path="/funding-machine/automation" element={<RequireRole allowedRoles={['owner','admin','employee','accountant']} showLocked><FundingApplicationAutomation /></RequireRole>} />
        {/* Validation-aligned route aliases + new module registrations */}
        <Route path="/funding-machine/lenders" element={<Navigate to="/funding-machine/funding-matrix" replace />} />
        <Route path="/funding-machine/tradelines" element={<Navigate to="/funding-machine/tradeline-vault" replace />} />
        <Route path="/funding-machine/credit-unions" element={<Navigate to="/funding-machine/credit-union-intel" replace />} />
        <Route path="/funding-machine/briefing" element={<RequireRole allowedRoles={['owner','admin','employee','accountant']} showLocked><FundingMachineMorningBriefing /></RequireRole>} />
        <Route path="/funding-machine/grants" element={<Navigate to="/os/grants/funder-crm" replace />} />
        <Route path="/funding-machine/clients" element={<RequireRole allowedRoles={['owner','admin','employee','accountant']} showLocked><FundingMachineClientsList /></RequireRole>} />
        <Route path="/funding-machine/funding-invites" element={<RequireRole allowedRoles={['owner','admin']} showLocked><FundingInvitesPage /></RequireRole>} />
        <Route path="/funding-machine/credit-stacking" element={<RequireRole allowedRoles={['owner','admin','employee','accountant']} showLocked><FundingModuleStub title="Credit Stacking" description="Sequenced multi-lender credit stacking playbook" /></RequireRole>} />
        <Route path="/funding-machine/sba" element={<RequireRole allowedRoles={['owner','admin','employee','accountant']} showLocked><FundingModuleStub title="SBA Loans" description="SBA 7(a), 504, and microloan pipeline" /></RequireRole>} />
        <Route path="/funding-machine/cdfi" element={<RequireRole allowedRoles={['owner','admin','employee','accountant']} showLocked><FundingModuleStub title="CDFI Network" description="Community Development Financial Institution partners" /></RequireRole>} />
        <Route path="/funding-machine/playbook" element={<RequireRole allowedRoles={['owner','admin','employee','accountant']} showLocked><FundingModuleStub title="Funding Playbook" description="Full Dynasty funding strategy playbook" /></RequireRole>} />
        <Route path="/funding-machine/pg-rotation" element={<RequireRole allowedRoles={['owner','admin','employee','accountant']} showLocked><FundingModuleStub title="PG Rotation" description="Personal guarantor rotation and utilization tracking" /></RequireRole>} />
        <Route path="/funding-machine/entities" element={<RequireRole allowedRoles={['owner','admin','employee','accountant']} showLocked><FundingModuleStub title="Entities" description="Business entity registry and structure" /></RequireRole>} />
        <Route path="/funding-machine/analytics" element={<RequireRole allowedRoles={['owner','admin','employee','accountant']} showLocked><FundingModuleStub title="Funding Analytics" description="Approval rates, velocity, and funnel analytics" /></RequireRole>} />
        <Route path="/funding-machine/compliance" element={<RequireRole allowedRoles={['owner','admin','employee','accountant']} showLocked><FundingModuleStub title="Compliance" description="Funding Machine compliance and audit trail" /></RequireRole>} />
        {/* UBEN HQ — Non-Profit Operations Tracker */}
        <Route path="/os/uben" element={<RequireRole allowedRoles={['admin','owner']} showLocked><UbenHQ /></RequireRole>} />
        <Route path="/os/uben/grants" element={<RequireRole allowedRoles={['admin','owner']} showLocked><UbenGrantTracker /></RequireRole>} />
        <Route path="/os/uben/applications" element={<RequireRole allowedRoles={['admin','owner']} showLocked><UbenApplications /></RequireRole>} />
        <Route path="/os/uben/programs" element={<RequireRole allowedRoles={['admin','owner']} showLocked><UbenPrograms /></RequireRole>} />
        <Route path="/os/uben/impact" element={<RequireRole allowedRoles={['admin','owner']} showLocked><UbenImpact /></RequireRole>} />
        <Route path="/os/uben/donors" element={<RequireRole allowedRoles={['admin','owner']} showLocked><UbenDonors /></RequireRole>} />
        <Route path="/os/uben/compliance" element={<RequireRole allowedRoles={['admin','owner']} showLocked><UbenCompliance /></RequireRole>} />
        <Route path="/os/uben/documents" element={<RequireRole allowedRoles={['admin','owner']} showLocked><UbenDocuments /></RequireRole>} />
        <Route path="/os/uben/commissions" element={<RequireRole allowedRoles={['admin','owner']} showLocked><UbenCommissions /></RequireRole>} />

        <Route path="/os/dynasty-earn" element={<DynastyEarn />} />
        <Route path="/os/dynasty-earn/earners" element={<EarnEarners />} />
        <Route path="/os/dynasty-earn/brands" element={<EarnBrands />} />
        <Route path="/os/dynasty-earn/programs" element={<EarnPrograms />} />
        <Route path="/os/dynasty-earn/commissions" element={<EarnCommissions />} />
        <Route path="/os/dynasty-earn/campaigns" element={<EarnCampaigns />} />
        <Route path="/os/dynasty-earn/payouts" element={<EarnPayouts />} />
        <Route path="/os/dynasty-earn/settings" element={<EarnSettings />} />
        <Route path="/os/brand-acquisition" element={<BrandAcquisitionSystem />} />
        <Route path="/os/dynasty-sales" element={<DynastySalesNetwork />} />
        {/* Clipper Nation — admin/owner only (payouts included) */}
        <Route path="/os/clipper-nation" element={<RequireRole allowedRoles={['admin', 'owner']} strict showLocked><ClipperDashboard /></RequireRole>} />
        <Route path="/os/clipper-nation/applications" element={<RequireRole allowedRoles={['admin', 'owner']} strict showLocked><ClipperApplications /></RequireRole>} />
        <Route path="/os/clipper-nation/clippers" element={<RequireRole allowedRoles={['admin', 'owner']} strict showLocked><ClipperClippers /></RequireRole>} />
        <Route path="/os/clipper-nation/campaigns" element={<RequireRole allowedRoles={['admin', 'owner']} strict showLocked><ClipperCampaigns /></RequireRole>} />
        <Route path="/os/clipper-nation/submissions" element={<RequireRole allowedRoles={['admin', 'owner']} strict showLocked><ClipperSubmissions /></RequireRole>} />
        <Route path="/os/clipper-nation/analytics" element={<RequireRole allowedRoles={['admin', 'owner']} strict showLocked><ClipperAnalytics /></RequireRole>} />
        <Route path="/os/clipper-nation/conversions" element={<RequireRole allowedRoles={['admin', 'owner']} strict showLocked><ClipperConversions /></RequireRole>} />
        <Route path="/os/clipper-nation/payouts" element={<RequireRole allowedRoles={['admin', 'owner']} strict showLocked><ClipperPayouts /></RequireRole>} />
        <Route path="/os/clipper-nation/settings" element={<RequireRole allowedRoles={['admin', 'owner']} strict showLocked><ClipperSettings /></RequireRole>} />
        {/* Catch-all: any future/unlisted clipper-nation path is also gated */}
        <Route path="/os/clipper-nation/*" element={<RequireRole allowedRoles={['admin', 'owner']} strict showLocked><Navigate to="/os/clipper-nation" replace /></RequireRole>} />

        <Route path="/os/revenue-orchestrator" element={<DynastyRevenueOrchestrator />} />
        <Route path="/os/sports-betting" element={<Navigate to="/os/sports-betting/dashboard" replace />} />
        <Route path="/os/sports-betting/analytics" element={<BettingAnalytics />} />
        <Route path="/os/sports-betting/command-center" element={<SBOCommandCenter />} />
        <Route path="/os/sports-betting/cross-platform" element={<CrossPlatformLines />} />
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
        <Route path="/sbo-ai-engine/nightly" element={<SBONightlyBoardPage />} />
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
        {/* PHASE 3 / ITEM 9 — SignalsPage.tsx existed but was never registered; /sbo-ai-engine/signals 404'd in a signed-in render. */}
        <Route path="/sbo-ai-engine/signals" element={<SBOSignalsPage />} />
        <Route path="/os/sbo" element={<SBODashboard />} />
        <Route path="/os/sbo/picks" element={<SBOAllPicks />} />
        <Route path="/admin/system-integrity" element={<SystemIntegrity />} />
        <Route path="/biker/home" element={<Navigate to="/portal/biker" replace />} />
        <Route path="/biker/admin" element={<BikerDashboard />} />
        <Route path="/biker/route" element={<Navigate to="/biker/routes" replace />} />
        <Route path="/biker/routes" element={<BikerTodaysRoutesPage />} />

        {/* Legacy payouts aliases (keep old links working) */}
        <Route path="/biker-payouts" element={<Navigate to="/delivery/payouts" replace />} />
        <Route path="/driver-payouts" element={<Navigate to="/delivery/payouts" replace />} />

        {/* Delivery & Logistics Department */}
        <Route path="/delivery" element={<DeliveryDashboard />} />
        <Route path="/delivery/dashboard" element={<Navigate to="/delivery" replace />} />
        <Route path="/delivery/deliveries" element={<DeliveriesBoard />} />
        <Route path="/delivery/orders" element={<OrdersDeliveriesPage />} />
        <Route path="/delivery/pool" element={<LiveDeliveryPool />} />
        <Route path="/delivery/multi-brand" element={<MultiBrandDeliveryPage />} />
        <Route path="/delivery/route-manager" element={<RouteManagerPage />} />
        <Route path="/delivery/routes/all" element={<AllRoutesPage />} />
        <Route path="/delivery/route-optimizer" element={<Navigate to="/routes/command-center" replace />} />
        <Route path="/delivery/route-ops" element={<DeliveryRouteOpsCenter />} />
        <Route path="/delivery/live-map" element={<Navigate to="/live-map" replace />} />
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
        <Route path="/scalati/*" element={<Navigate to="/brand/scalati" replace />} />

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
        {/* T3 K13: OwnerDailyBriefing merged into Accounting OS */}
        <Route path="/os/owner/briefing" element={<Navigate to="/penthouse/accounting" replace />} />
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
        {/* T3 K12: OwnerExecutiveReports merged into OwnerReports (canonical) */}
        <Route path="/os/owner/executive-reports" element={<Navigate to="/os/owner/reports" replace />} />
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

        {/* ═══ PENTHOUSE — OS Directory (Floor Map) ═══ */}
        <Route path="/directory" element={
          <RequireRole allowedRoles={['admin']} showLocked>
            <OSDirectory />
          </RequireRole>
        } />

        {/* ═══ PENTHOUSE — Intelligent Audit Engine ═══ */}
        <Route path="/penthouse/audit-engine" element={
          <RequireRole allowedRoles={['admin']} showLocked>
            <AuditEnginePage />
          </RequireRole>
        } />

        {/* ═══ OUTREACH SWITCHBOARD — human gate for every customer-contacting automation ═══ */}
        <Route path="/outreach-switchboard" element={
          <RequireRole allowedRoles={['admin', 'owner']} showLocked>
            <OutreachSwitchboard />
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
          <Route path="power-dialer" element={<PowerDialerConsole />} />
          <Route path="campaign-dial" element={<CampaignDialPage />} />
          <Route path="manual-calls" element={<ManualCallPage />} />
          <Route path="manual-text" element={<ManualTextPage />} />
          <Route path="escalations" element={<EscalationsPage />} />
          <Route path="deals" element={<DealsSalesPage />} />
          <Route path="follow-ups" element={<FollowUpManagerPage />} />
          <Route path="voicemail-inbox" element={<VoicemailInboxPage />} />
          <Route path="missed-calls" element={<MissedCallsDashboardPage />} />
          <Route path="unresolved-queue" element={<UnresolvedCallsQueuePage />} />
          <Route path="field-submissions" element={<FieldSubmissionsPage />} />
          <Route path="bland-dial" element={<BlandDialHubPage />} />

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
          <Route path="comms-health" element={<CommsHealthDashboard />} />
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
        <Route path="/operations/live-map" element={<Navigate to="/live-map" replace />} />
        <Route path="/live-map" element={<LiveMapCommandCenter />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/subscriptions" element={<Subscriptions />} />
        <Route path="/expansion/capacity" element={<Navigate to="/delivery/capacity" replace />} />

        {/* Grabba Financial (no layout, stays in ProtectedNoLayout) */}
        <Route path="/grabba/financial-dashboard" element={<FinancialDashboard />} />
        <Route path="/grabba/personal-finance" element={<PersonalFinance />} />
        <Route path="/grabba/payroll-manager" element={<PayrollManager />} />
        <Route path="/grabba/advisor-penthouse" element={<AdvisorPenthouse />} />
        <Route path="/grabba/instinct-log" element={<InstinctLog />} />
      </Route>

      {/* Portal Invite Landing — standalone, no layout, auth optional */}
      <Route path="/portal/invite/:token" element={<UniversalInviteAccept />} />

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
        <Route path="/portal/store/dashboard" element={<Navigate to="/portal/store" replace />} />
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
        {/* ONE supplier-facing path to add products: the camera-first onboard flow. */}
        <Route path="/portal/wholesaler/products/new" element={<Navigate to="/portal/wholesaler/catalog/onboard" replace />} />
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
        <Route path="/portal/wholesaler/marketplace-inventory" element={<Navigate to="/portal/wholesaler/catalog/onboard" replace />} />
        <Route path="/portal/wholesaler/order-grabba" element={<WholesalerOrderGrabba />} />
        <Route path="/portal/wholesaler/catalog/onboard" element={<WholesalerCatalogOnboard />} />
        <Route path="/portal/production/*" element={<ProductionPortal />} />
        {/* Retired hardcoded VA shell — canonical portal is /va/dashboard */}
        <Route path="/portal/va" element={<Navigate to="/va/dashboard" replace />} />
        <Route path="/portal/customer/*" element={<CustomerPortal />} />
        <Route path="/portal/invoices" element={<PortalInvoices />} />
        <Route path="/portal/invoices/:id" element={<PortalInvoiceDetail />} />
        <Route path="/portal/wholesale" element={<PortalWholesale />} />
        <Route path="/portal/influencer/*" element={<PortalInfluencer />} />
         <Route path="/portal/inbox" element={<OpsInboxPage />} />
         <Route path="/portal/inbox/:threadId" element={<OpsInboxThreadPage />} />
         <Route path="/portal/tasks" element={<OpsTaskListPage />} />
        <Route path="/portal/dashboard" element={<PortalDashboard />} />

        {/* NEW ROLE PORTALS - Enterprise-grade (/portals/*) */}
        <Route path="/portals/driver" element={<DriverPortalPage />} />
        <Route path="/portals/biker" element={<BikerPortalPage />} />
        {/* /portals/ambassador was a mock simulation page with hardcoded data — the real portal is /ambassador/dashboard */}
        <Route path="/portals/ambassador" element={<Navigate to="/ambassador/dashboard" replace />} />
        <Route path="/portals/store" element={<StorePortalPage />} />
        <Route path="/portals/wholesaler" element={<WholesalerPortalPage />} />
        <Route path="/portals/production" element={<ProductionPortalPage />} />
        <Route path="/portals/production/offices" element={<OfficesManagementPage />} />
        <Route path="/portals/production/staff" element={<StaffManagementPage />} />
        <Route path="/portals/production/conversion" element={<ConversionIntelligencePage />} />
        <Route path="/portals/production/supplier-yield" element={<SupplierYieldPage />} />
        <Route path="/portals/production/yield-watch" element={<YieldWatchPage />} />
        <Route path="/portals/production/intelligence" element={<OwnerIntelligencePage />} />
        <Route path="/portals/production/sales-velocity" element={<SalesVelocityPage />} />
        <Route path="/portals/production/war-room" element={<ProductionWarRoom />} />
        <Route path="/portals/production/task-timer" element={<WorkerTaskTimerPage />} />
        <Route path="/production/cost-history" element={<CostHistoryPage />} />
        <Route path="/production/supervisor-comparison" element={<SupervisorComparisonPage />} />
        {/* Retired duplicate — canonical VA portal is /va/dashboard */}
        <Route path="/portals/va" element={<Navigate to="/va/dashboard" replace />} />
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
      <Route path="/grabba/communications" element={<Navigate to="/grabba/communication" replace />} />
      <Route path="/grabba/unified-upload" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee', 'wholesale', 'wholesaler']} showLocked>
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
      <Route path="/grabba/flower-customers" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee', 'driver', 'csr']}>
            <Layout><GrabbaLayout><FlowerCustomersPage /></GrabbaLayout></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/flower-customers" element={<Navigate to="/grabba/flower-customers" replace />} />
      <Route path="/ideas" element={
        <ProtectedRoute>
          <Layout><IdeaDashboard /></Layout>
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
      <Route path="/grabba/store-master" element={<Navigate to="/grabba/crm" replace />} />
      <Route path="/grabba/brand" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee', 'csr']}>
            <Layout><GrabbaLayout><BrandSelector /></GrabbaLayout></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/brand-crm" element={<Navigate to="/grabba/brand" replace />} />
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

      {/* Floor 2 — Communication hub. Canonical mount is /communication (full-screen
          floor with its own layout + child routes). The old /grabba/communication
          mounts rendered the hub shell with NO child routes — a blank page whose
          sidebar links looked dead. Redirect to the canonical mount. */}
      <Route path="/grabba/communication" element={<Navigate to="/communication" replace />} />
      <Route path="/grabba/communication/*" element={<Navigate to="/communication" replace />} />
      {/* Legacy grabba comm aliases → canonical /grabba/communication (Pass 1B redirects) */}
      <Route path="/grabba/text-center" element={<Navigate to="/grabba/communication" replace />} />
      <Route path="/grabba/email-center" element={<Navigate to="/grabba/communication" replace />} />
      <Route path="/grabba/call-center" element={<Navigate to="/grabba/communication" replace />} />
      <Route path="/grabba/communication-logs" element={<Navigate to="/grabba/communication" replace />} />
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
      <Route path="/grabba/delivery-runs" element={<Navigate to="/grabba/multi-brand-delivery" replace />} />
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

      {/* Floor 6 — Production: retired duplicate surface; the Manufacturing OS
          at /portals/production now carries the batch ledger (Production Logs). */}
      <Route path="/grabba/production" element={<Navigate to="/portals/production" replace />} />

      {/* Floor 7 — Wholesale */}
      <Route path="/grabba/wholesale-platform" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'employee', 'wholesale', 'wholesaler', 'warehouse', 'csr', 'accountant']}>
            <Layout><GrabbaLayout><GrabbaWholesalePlatform /></GrabbaLayout></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/grabba/upload-center" element={<Navigate to="/grabba/unified-upload" replace />} />

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
            <AmbassadorDashboard />
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/end-of-day" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <AmbassadorLayout title="End-of-Day Notes" subtitle="Log today's observations and flag wrong addresses">
              <AmbassadorEndOfDay role="ambassador" />
            </AmbassadorLayout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/admin/field-day-notes" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'owner']} showLocked>
            <Layout><FieldDayNotesAdmin /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/catalog" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <AmbassadorCatalog />
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/dd-order" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <AmbassadorDDOrder />
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/stores" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <AmbassadorStoresList />
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/wholesalers" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <AmbassadorWholesalersList />
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/stores/:id" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <StoreDetail />
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/visit/:storeId" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <AmbassadorStoreVisit portalType="ambassador" />
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/wholesalers/:id" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <WholesalerProfilePage />
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/influencers/:id" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <InfluencerProfilePage />
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/ambassadors/:id" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <AmbassadorProfilePage />
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/orders" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <AmbassadorOrders />
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/purchases" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <AmbassadorPurchases />
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/sell-through" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <AmbassadorSellThrough />
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/profit" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <AmbassadorProfitDashboard />
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/routes" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <AmbassadorRoutes />
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/tasks" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <AmbassadorTasks />
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/leads" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <AmbassadorLeads />
          </RequireRole>
        </ProtectedRoute>
      } />
      {/* Scoped pipeline route - view another ambassador's pipeline */}
      <Route path="/ambassador/:ambassadorId/leads" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <AmbassadorLeads />
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/communications" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <AmbassadorCommunications />
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/invites" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <AmbassadorInvites />
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/recruitment" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <AmbassadorRecruitmentLeads />
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/request-ambassador" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <AmbassadorRequestAmbassador />
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/commissions" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <AmbassadorCommissions />
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/disputes" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <AmbassadorDisputes />
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/disputes/:id" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <AmbassadorDisputeDetail />
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/feedback" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador', 'driver', 'biker']}>
            <AmbassadorFeedback />
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/admin/feedback" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'staff']}>
            <FeedbackInbox />
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
      <Route path="/admin/ambassador-invites" element={<Navigate to="/admin/field-assignments" replace />} />

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

      {/* Twilio / Toll-Free Test Console - Admin Only */}
      <Route path="/admin/twilio-test" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'owner']}>
            <Layout><TwilioTestConsole /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />


      {/* Ambassador Payouts */}
      <Route path="/ambassador/payouts" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <AmbassadorLayout title="My Payouts" subtitle="Track your commission payments">
              <AmbassadorPayoutsPage />
            </AmbassadorLayout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/payouts/:itemId" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <AmbassadorLayout title="Payout Statement" backPath="/ambassador/payouts" backLabel="Back to Payouts">
              <AmbassadorPayoutStatementPage />
            </AmbassadorLayout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/ambassador/settings/payouts" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'ambassador']}>
            <AmbassadorLayout title="Payout Settings" subtitle="Configure how you get paid">
              <AmbassadorPayoutSettingsPage />
            </AmbassadorLayout>
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

      {/* Data Quality — Store Deduplication Detection (read-only) */}
      <Route path="/admin/store-deduplication" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'owner']}>
            <Layout><StoreDeduplicationPage /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />

      {/* Data Quality — Store Merge Preview (read-only analysis + override/skiplist) */}
      <Route path="/admin/store-merge-preview" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'owner']}>
            <Layout><StoreMergePreview /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />

      {/* Data Quality — Merge Dry-Run (read-only Phase A-F preview + feedback) */}
      <Route path="/admin/merge-dry-run" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'owner']}>
            <Layout><MergeDryRun /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />

      {/* Recently Added Stores — owner visibility surface (auto-approved captures) */}
      <Route path="/admin/captures" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'owner']}>
            <Layout><RecentlyAddedStores /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />
      <Route path="/admin/recently-added" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'owner']}>
            <Layout><RecentlyAddedStores /></Layout>
          </RequireRole>
        </ProtectedRoute>
      } />

      {/* Dispatch Map — reference of dispatch wiring across floors */}
      <Route path="/admin/dispatch-map" element={
        <ProtectedRoute>
          <RequireRole allowedRoles={['admin', 'owner']}>
            <Layout><DispatchMap /></Layout>
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
            <AmbassadorLayout title="Earnings Report" subtitle="Your earnings breakdown and history">
              <AmbassadorEarningsPage />
            </AmbassadorLayout>
          </RequireRole>
        </ProtectedRoute>
      } />

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* SURPLUS FUNDS OS                                                              */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      <Route element={<ProtectedLayout />}>
        <Route path="/surplus-funds" element={<RequireRole allowedRoles={['owner','admin','va','employee','staff']} showLocked><SFLayout /></RequireRole>}>
          <Route index element={<SFCommandCenter />} />
          <Route path="leads" element={<SFLeadPipeline />} />
          <Route path="discovery" element={<SFDiscovery />} />
          <Route path="human-queue" element={<SFHumanQueue />} />
          <Route path="campaigns" element={<SFCampaigns />} />
          <Route path="cases" element={<SFCases />} />
          <Route path="attorneys" element={<SFAttorneys />} />
          <Route path="attorney-crm" element={<SFAttorneyCRM />} />
          <Route path="coverage-map" element={<SFCoverageMap />} />
          <Route path="documents" element={<SFDocuments />} />
          <Route path="contracts" element={<SFContracts />} />
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
          <Route path="crm" element={<SolarCRM />} />
          <Route path="installer-map" element={<SolarInstallerMap />} />
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
        <Route path="/real-estate" element={<RequireRole allowedRoles={['owner','admin','va','employee','staff','realestate_worker']} showLocked><RELayout /></RequireRole>}>
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
          <Route path="contracts" element={<REContracts />} />
        </Route>
      </Route>

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* REAL ESTATE HQ — legacy department pages (/realestate/*).                     */}
      {/* RealEstateLayout enforces admin / realestate_worker.                          */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      <Route element={<ProtectedLayout />}>
        <Route path="/realestate" element={<RealEstateLayout><RealEstate /></RealEstateLayout>} />
        <Route path="/realestate/leads" element={<RealEstateLayout><RealEstateLeads /></RealEstateLayout>} />
        <Route path="/realestate/pipeline" element={<RealEstateLayout><RealEstatePipeline /></RealEstateLayout>} />
        <Route path="/realestate/investors" element={<RealEstateLayout><RealEstateInvestors /></RealEstateLayout>} />
        <Route path="/realestate/closings" element={<RealEstateLayout><RealEstateClosings /></RealEstateLayout>} />
        <Route path="/realestate/expansion" element={<RealEstateLayout><RealEstateExpansion /></RealEstateLayout>} />
        <Route path="/realestate/subscriptions" element={<RealEstateLayout><RealEstateSubscriptions /></RealEstateLayout>} />
        <Route path="/realestate/partners" element={<RealEstateLayout><RealEstatePartners /></RealEstateLayout>} />
        <Route path="/realestate/pl" element={<RealEstateLayout><RealEstatePL /></RealEstateLayout>} />
      </Route>


      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      <Route element={<ProtectedLayout />}>
        <Route path="/brandaro" element={<RequireRole allowedRoles={['admin','owner']} showLocked><BrandaroHubLayout /></RequireRole>}>
          {/* ── Command ── */}
          <Route index element={<BrandaroWarRoom />} />
          <Route path="ceo" element={<CEODashboardPage />} />
          <Route path="pm" element={<Navigate to="/brandaro/ceo" replace />} />


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
          <Route path="builder" element={<BuilderHubPage />} />
          <Route path="demo-engine" element={<DemoEnginePage />} />

          {/* ── Execution ── */}
          <Route path="production-pipeline" element={<ProductionPipelinePage />} />
          <Route path="callbacks" element={<Navigate to="/brandaro/follow-ups" replace />} />
          <Route path="tasks" element={<Navigate to="/brandaro/production-pipeline" replace />} />
          <Route path="alerts" element={<Navigate to="/brandaro" replace />} />

          {/* ── Intelligence ── */}
          <Route path="ai-brain" element={<Navigate to="/brandaro/closer-ai" replace />} />
          <Route path="personalities" element={<Navigate to="/brandaro/va-manager" replace />} />
          <Route path="emotion-engine" element={<Navigate to="/brandaro/closer-ai" replace />} />
          <Route path="learning" element={<Navigate to="/brandaro/optimization" replace />} />
          <Route path="patterns" element={<ResultEnginePage />} />

          {/* ── Domination ── */}
          <Route path="domination" element={<Navigate to="/brandaro/optimization" replace />} />
          <Route path="competitors" element={<CompetitorTakeoverPage />} />
          <Route path="offers" element={<Navigate to="/brandaro/optimization" replace />} />
          <Route path="positioning" element={<Navigate to="/brandaro/optimization" replace />} />

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

          {/* ── Admin / Operations ── */}
          <Route path="admin-numbers" element={<AdminNumbersPage />} />
          <Route path="bland-dial" element={<BlandDialHubPage />} />
          <Route path="admin-leaderboard" element={<AdminLeaderboardPage />} />
          <Route path="admin-call-review" element={<AdminCallReviewPage />} />
          <Route path="admin-monitor" element={<AdminVAMonitorPage />} />
          <Route path="admin-dnc" element={<AdminDNCManagerPage />} />
          <Route path="admin-scripts" element={<BrandaroScriptsAdminPage />} />
        </Route>
      </Route>

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* UFT PLATFORM COMMAND CENTER                                                */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      <Route element={<ProtectedLayout />}>
        <Route path="/uft" element={<Navigate to="/uft/dashboard" replace />} />
        <Route path="/uft/dashboard" element={<UFTDashboard />} />
        <Route path="/uft/revenue" element={<UFTRevenue />} />
        <Route path="/uft/vendors" element={<UFTVendors />} />
        <Route path="/uft/ambassadors" element={<UFTAmbassadors />} />
        <Route path="/uft/launch" element={<UFTLaunchChecklist />} />
        <Route path="/uft/verification" element={<UFTVerification />} />
        <Route path="/uft/payouts" element={<UFTPayouts />} />
        <Route path="/uft/suppliers" element={<UFTSuppliers />} />
        <Route path="/uft/recruiting" element={<UFTRecruiting />} />
        <Route path="/uft/ambassador-recruiting" element={<UFTAmbassadorRecruiting />} />
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
          <Route path="dashboard" element={<Navigate to="/os/unforgettable" replace />} />
          <Route path="customer-service" element={<UnforgettableCustomerService />} />
          <Route path="media" element={<UnforgettableMedia />} />
          <Route path="media/:mediaId" element={<UnforgettableMediaDetail />} />
          <Route path="hall-dashboard" element={<UTHallOwnerDashboard />} />
          <Route path="staff-dashboard" element={<UTStaffMemberDashboard />} />
          <Route path="venues" element={<UTVenuesManagement />} />
          <Route path="event-bookings" element={<UTEventBookings />} />
          <Route path="leads" element={<UTLeadIntelligence />} />
          <Route path="partner-map" element={<UTPartnerMap />} />
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
             <Route path="event-spaces" element={<UTEventSpaces />} />
             <Route path="virtual-tours" element={<UTVirtualTours />} />
             <Route path="coverage-map" element={<UTCoverageMap />} />
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
