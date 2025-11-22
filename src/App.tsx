import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Stores from "./pages/Stores";
import StoreDetail from "./pages/StoreDetail";
import RoutesPage from "./pages/Routes";
import RouteDetail from "./pages/RouteDetail";
import MapPage from "./pages/Map";
import BatchImport from "./pages/BatchImport";
import Driver from "./pages/Driver";
import Wholesale from "./pages/Wholesale";
import WholesaleMarketplace from "./pages/WholesaleMarketplace";
import Team from "./pages/Team";
import Products from "./pages/Products";
import Analytics from "./pages/Analytics";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Influencers from "./pages/Influencers";
import Missions from "./pages/Missions";
import InfluencerCampaigns from "./pages/InfluencerCampaigns";
import ExecutiveReports from "./pages/ExecutiveReports";
import Territories from "./pages/Territories";
import RevenueBrain from "./pages/RevenueBrain";
import OpportunityRadar from "./pages/OpportunityRadar";
import MissionsHQ from "./pages/MissionsHQ";
import Communications from './pages/Communications';
import Templates from './pages/Templates';
import Reminders from './pages/Reminders';
import InfluencerDetail from './pages/InfluencerDetail';
import WholesalerDetail from './pages/WholesalerDetail';
import WorkerHome from './pages/WorkerHome';
import AutomationSettings from './pages/AutomationSettings';
import Training from './pages/Training';
import Ambassadors from './pages/Ambassadors';
import Expansion from './pages/Expansion';
import Rewards from './pages/Rewards';
import LiveMap from './pages/LiveMap';
import WalletPage from './pages/Wallet';
import Subscriptions from './pages/Subscriptions';
import DeliveryCapacity from './pages/DeliveryCapacity';
import CommunicationAutomation from './pages/CommunicationAutomation';
import CommunicationsAI from './pages/CommunicationsAI';
import CommunicationInsights from "./pages/CommunicationInsights";
import RouteOptimizer from "./pages/RouteOptimizer";
import RouteOpsCenter from "./pages/RouteOpsCenter";
import MyRoute from "./pages/MyRoute";
import Leaderboard from "./pages/Leaderboard";
import Payroll from "./pages/Payroll";
import MetaAI from "./pages/MetaAI";
import ExpansionRegions from "./pages/ExpansionRegions";
import ExpansionHeatmap from "./pages/ExpansionHeatmap";
import AmbassadorRegions from "./pages/AmbassadorRegions";
import Sales from "./pages/Sales";
import SalesProspects from "./pages/SalesProspects";
import SalesProspectNew from "./pages/SalesProspectNew";
import SalesProspectDetail from "./pages/SalesProspectDetail";
import SalesReport from "./pages/SalesReport";
import StorePerformance from "./pages/StorePerformance";
import StoreOrder from "./pages/StoreOrder";
import WholesaleFulfillment from "./pages/WholesaleFulfillment";
import Billing from "./pages/Billing";
import EconomicAnalytics from "./pages/EconomicAnalytics";
import AmbassadorPayouts from "./pages/AmbassadorPayouts";
import BikerPayouts from "./pages/BikerPayouts";
import CRM from "./pages/CRM";
import CRMContacts from "./pages/CRMContacts";
import CRMContactDetail from "./pages/CRMContactDetail";
import CRMCustomers from "./pages/CRMCustomers";
import CRMCustomerNew from "./pages/CRMCustomerNew";
import CRMCustomerDetail from "./pages/CRMCustomerDetail";
import CRMCustomerImport from "./pages/CRMCustomerImport";
import CallCenter from "./pages/CallCenter";
import TextCenter from "./pages/TextCenter";
import EmailCenter from "./pages/EmailCenter";
import CRMFollowUps from "./pages/CRMFollowUps";
import BillingCenter from "./pages/BillingCenter";
import BillingInvoices from "./pages/BillingInvoices";
import BillingInvoiceNew from "./pages/BillingInvoiceNew";
import PortalLogin from "./pages/portal/PortalLogin";
import PortalDashboard from "./pages/portal/PortalDashboard";
import PortalInvoices from "./pages/portal/PortalInvoices";
import PortalInvoiceDetail from "./pages/portal/PortalInvoiceDetail";
import PortalStore from "./pages/portal/PortalStore";
import PortalWholesale from "./pages/portal/PortalWholesale";
import PortalInfluencer from "./pages/portal/PortalInfluencer";
import PortalBiker from "./pages/portal/PortalBiker";
import PortalAmbassador from "./pages/portal/PortalAmbassador";
import HR from "./pages/HR";
import HRApplicants from "./pages/HRApplicants";
import HRApplicantDetail from "./pages/HRApplicantDetail";
import HREmployees from "./pages/HREmployees";
import HREmployeeDetail from "./pages/HREmployeeDetail";
import HRInterviews from "./pages/HRInterviews";
import HRDocuments from "./pages/HRDocuments";
import HROnboarding from "./pages/HROnboarding";
import HRPayroll from "./pages/HRPayroll";
import MyHR from "./pages/MyHR";
import RealEstate from "./pages/RealEstate";
import RealEstateLeads from "./pages/RealEstateLeads";
import RealEstatePipeline from "./pages/RealEstatePipeline";
import RealEstateInvestors from "./pages/RealEstateInvestors";
import RealEstateClosings from "./pages/RealEstateClosings";
import RealEstateExpansion from "./pages/RealEstateExpansion";
import RealEstateSubscriptions from "./pages/RealEstateSubscriptions";
import RealEstatePartners from "./pages/RealEstatePartners";
import RealEstatePL from "./pages/RealEstatePL";
import LoanProducts from "./pages/LoanProducts";
import LenderDirectory from "./pages/LenderDirectory";
import LoanCalculators from "./pages/LoanCalculators";
import FundingRequests from "./pages/FundingRequests";
import VAPerformance from "./pages/VAPerformance";
import VARanking from "./pages/VARanking";
import VATaskCenter from "./pages/VATaskCenter";
import DealSheetsGenerator from "./pages/DealSheetsGenerator";
import InvestorBlastSystem from "./pages/InvestorBlastSystem";
import OfferAnalyzer from "./pages/OfferAnalyzer";
import AssignmentFeeOptimizer from "./pages/AssignmentFeeOptimizer";
import AICEOControlRoom from "./pages/AICEOControlRoom";
import HoldingsOverview from "./pages/HoldingsOverview";
import HoldingsAssets from "./pages/HoldingsAssets";
import HoldingsAirbnb from "./pages/HoldingsAirbnb";
import HoldingsTenants from "./pages/HoldingsTenants";
import HoldingsLoans from "./pages/HoldingsLoans";
import HoldingsExpenses from "./pages/HoldingsExpenses";
import HoldingsStrategy from "./pages/HoldingsStrategy";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/stores"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Stores />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/stores/:id"
              element={
                <ProtectedRoute>
                  <Layout>
                    <StoreDetail />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/routes"
              element={
                <ProtectedRoute>
                  <Layout>
                    <RoutesPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/routes/optimizer"
              element={
                <ProtectedRoute>
                  <Layout>
                    <RouteOptimizer />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/routes/ops-center"
              element={
                <ProtectedRoute>
                  <Layout>
                    <RouteOpsCenter />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/routes/my-route"
              element={
                <ProtectedRoute>
                  <MyRoute />
                </ProtectedRoute>
              }
            />
            <Route
              path="/routes/:id"
              element={
                <ProtectedRoute>
                  <Layout>
                    <RouteDetail />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/map"
              element={
                <ProtectedRoute>
                  <Layout>
                    <MapPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/batch-import"
              element={
                <ProtectedRoute>
                  <Layout>
                    <BatchImport />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/data/import"
              element={
                <ProtectedRoute>
                  <Layout>
                    <BatchImport />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/driver"
              element={
                <ProtectedRoute>
                  <Driver />
                </ProtectedRoute>
              }
            />
            <Route
              path="/wholesale"
              element={
                <ProtectedRoute>
                  <Wholesale />
                </ProtectedRoute>
              }
            />
            <Route
              path="/wholesale/marketplace"
              element={
                <ProtectedRoute>
                  <WholesaleMarketplace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/team"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Team />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/products"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Products />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Analytics />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/influencers"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Influencers />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/missions/today"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Missions />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/influencers/campaigns"
              element={
                <ProtectedRoute>
                  <Layout>
                    <InfluencerCampaigns />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports/executive"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ExecutiveReports />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/missions"
              element={
                <ProtectedRoute>
                  <Layout>
                    <MissionsHQ />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/territories"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Territories />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics/revenue-brain"
              element={
                <ProtectedRoute>
                  <Layout>
                    <RevenueBrain />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/ops/opportunity-radar"
              element={
                <ProtectedRoute>
                  <Layout>
                    <OpportunityRadar />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/me/home"
              element={
                <ProtectedRoute>
                  <WorkerHome />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/automation"
              element={
                <ProtectedRoute>
                  <Layout>
                    <AutomationSettings />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/communications"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Communications />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/templates"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Templates />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/communications/reminders"
              element={
                <ProtectedRoute>
                  <Reminders />
                </ProtectedRoute>
              }
            />
            <Route
              path="/influencers/:id"
              element={
                <ProtectedRoute>
                  <InfluencerDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/wholesale/:id"
              element={
                <ProtectedRoute>
                  <WholesalerDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/training"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Training />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/ambassadors"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Ambassadors />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/expansion"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Expansion />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/rewards"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Rewards />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/operations/live-map"
              element={
                <ProtectedRoute>
                  <LiveMap />
                </ProtectedRoute>
              }
            />
            <Route
              path="/wallet"
              element={
                <ProtectedRoute>
                  <WalletPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/subscriptions"
              element={
                <ProtectedRoute>
                  <Subscriptions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/expansion/capacity"
              element={
                <ProtectedRoute>
                  <DeliveryCapacity />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/automation/communications"
              element={
                <ProtectedRoute>
                  <CommunicationAutomation />
                </ProtectedRoute>
              }
            />
            <Route
              path="/communications/ai-insights"
              element={
                <ProtectedRoute>
                  <Layout>
                    <CommunicationsAI />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/communication/ai-center"
              element={
                <ProtectedRoute>
                  <Layout>
                    <CommunicationsAI />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/communications/insights"
              element={
                <ProtectedRoute>
                  <Layout>
                    <CommunicationInsights />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/drivers/leaderboard"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Leaderboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/drivers/payroll"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Payroll />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/me/driver"
              element={
                <ProtectedRoute>
                  <WorkerHome />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ai/meta"
              element={
                <ProtectedRoute>
                  <Layout>
                    <MetaAI />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/expansion/regions"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ExpansionRegions />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/expansion/heatmap"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ExpansionHeatmap />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/ambassadors/regions"
              element={
                <ProtectedRoute>
                  <Layout>
                    <AmbassadorRegions />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/stores/order"
              element={
                <ProtectedRoute>
                  <Layout>
                    <StoreOrder />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/wholesale/fulfillment"
              element={
                <ProtectedRoute>
                  <Layout>
                    <WholesaleFulfillment />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/billing"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Billing />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics/economics"
              element={
                <ProtectedRoute>
                  <Layout>
                    <EconomicAnalytics />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/payouts/ambassadors"
              element={
                <ProtectedRoute>
                  <Layout>
                    <AmbassadorPayouts />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/payouts/bikers"
              element={
                <ProtectedRoute>
                  <Layout>
                    <BikerPayouts />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/sales"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Sales />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/sales/prospects"
              element={
                <ProtectedRoute>
                  <Layout>
                    <SalesProspects />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/sales/prospects/new"
              element={
                <ProtectedRoute>
                  <Layout>
                    <SalesProspectNew />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/sales/prospects/:id"
              element={
                <ProtectedRoute>
                  <Layout>
                    <SalesProspectDetail />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/sales/report"
              element={
                <ProtectedRoute>
                  <Layout>
                    <SalesReport />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/stores/performance"
              element={
                <ProtectedRoute>
                  <Layout>
                    <StorePerformance />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/crm"
              element={
                <ProtectedRoute>
                  <Layout>
                    <CRM />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/crm/customers"
              element={
                <ProtectedRoute>
                  <Layout>
                    <CRMCustomers />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/crm/customers/new"
              element={
                <ProtectedRoute>
                  <Layout>
                    <CRMCustomerNew />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/crm/customers/import"
              element={
                <ProtectedRoute>
                  <Layout>
                    <CRMCustomerImport />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/crm/customers/:id"
              element={
                <ProtectedRoute>
                  <Layout>
                    <CRMCustomerDetail />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/crm/contacts"
              element={
                <ProtectedRoute>
                  <Layout>
                    <CRMContacts />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/crm/contacts/:id"
              element={
                <ProtectedRoute>
                  <Layout>
                    <CRMContactDetail />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/crm/follow-ups"
              element={
                <ProtectedRoute>
                  <Layout>
                    <CRMFollowUps />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/communication/calls"
              element={
                <ProtectedRoute>
                  <Layout>
                    <CallCenter />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/communication/texts"
              element={
                <ProtectedRoute>
                  <Layout>
                    <TextCenter />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/communication/email"
              element={
                <ProtectedRoute>
                  <Layout>
                    <EmailCenter />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/billing"
              element={
                <ProtectedRoute>
                  <Layout>
                    <BillingCenter />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/billing/invoices"
              element={
                <ProtectedRoute>
                  <Layout>
                    <BillingInvoices />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/billing/invoices/new"
              element={
                <ProtectedRoute>
                  <Layout>
                    <BillingInvoiceNew />
                  </Layout>
                </ProtectedRoute>
              }
            />
          <Route path="/portal/login" element={<PortalLogin />} />
          <Route path="/portal/dashboard" element={<PortalDashboard />} />
          <Route path="/portal/invoices" element={<PortalInvoices />} />
          <Route path="/portal/invoices/:id" element={<PortalInvoiceDetail />} />
          <Route path="/portal/store" element={<PortalStore />} />
          <Route path="/portal/wholesale" element={<PortalWholesale />} />
          <Route path="/portal/influencer" element={<PortalInfluencer />} />
          <Route path="/portal/biker" element={<PortalBiker />} />
          <Route path="/portal/ambassador" element={<PortalAmbassador />} />
            
            {/* HR OS Routes */}
            <Route
              path="/hr"
              element={
                <ProtectedRoute>
                  <Layout>
                    <HR />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr/applicants"
              element={
                <ProtectedRoute>
                  <Layout>
                    <HRApplicants />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr/applicants/:id"
              element={
                <ProtectedRoute>
                  <Layout>
                    <HRApplicantDetail />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr/employees"
              element={
                <ProtectedRoute>
                  <Layout>
                    <HREmployees />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr/employees/:id"
              element={
                <ProtectedRoute>
                  <Layout>
                    <HREmployeeDetail />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr/interviews"
              element={
                <ProtectedRoute>
                  <Layout>
                    <HRInterviews />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr/documents"
              element={
                <ProtectedRoute>
                  <Layout>
                    <HRDocuments />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr/onboarding"
              element={
                <ProtectedRoute>
                  <Layout>
                    <HROnboarding />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/hr/payroll"
              element={
                <ProtectedRoute>
                  <Layout>
                    <HRPayroll />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/my/hr"
              element={
                <ProtectedRoute>
                  <MyHR />
                </ProtectedRoute>
              }
            />
            <Route
              path="/real-estate"
              element={
                <ProtectedRoute>
                  <Layout>
                    <RealEstate />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/real-estate/leads"
              element={
                <ProtectedRoute>
                  <Layout>
                    <RealEstateLeads />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/real-estate/pipeline"
              element={
                <ProtectedRoute>
                  <Layout>
                    <RealEstatePipeline />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/real-estate/investors"
              element={
                <ProtectedRoute>
                  <Layout>
                    <RealEstateInvestors />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/real-estate/closings"
              element={
                <ProtectedRoute>
                  <Layout>
                    <RealEstateClosings />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/real-estate/expansion"
              element={
                <ProtectedRoute>
                  <Layout>
                    <RealEstateExpansion />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/real-estate/subscriptions"
              element={
                <ProtectedRoute>
                  <Layout>
                    <RealEstateSubscriptions />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/real-estate/partners"
              element={
                <ProtectedRoute>
                  <Layout>
                    <RealEstatePartners />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/real-estate/pl"
              element={
                <ProtectedRoute>
                  <Layout>
                    <RealEstatePL />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/funding/products"
              element={
                <ProtectedRoute>
                  <Layout>
                    <LoanProducts />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/funding/lenders"
              element={
                <ProtectedRoute>
                  <Layout>
                    <LenderDirectory />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/funding/calculators"
              element={
                <ProtectedRoute>
                  <Layout>
                    <LoanCalculators />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/funding/requests"
              element={
                <ProtectedRoute>
                  <Layout>
                    <FundingRequests />
                  </Layout>
                </ProtectedRoute>
              }
            />
            
            {/* VA Academy Routes */}
            <Route
              path="/training"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Training />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/va/performance"
              element={
                <ProtectedRoute>
                  <Layout>
                    <VAPerformance />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/va/ranking"
              element={
                <ProtectedRoute>
                  <Layout>
                    <VARanking />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/va/tasks"
              element={
                <ProtectedRoute>
                  <Layout>
                    <VATaskCenter />
                  </Layout>
                </ProtectedRoute>
              }
            />
            
            {/* Deal Marketing Hub Routes */}
            <Route
              path="/marketing/deal-sheets"
              element={
                <ProtectedRoute>
                  <Layout>
                    <DealSheetsGenerator />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/marketing/investor-blast"
              element={
                <ProtectedRoute>
                  <Layout>
                    <InvestorBlastSystem />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/marketing/offer-analyzer"
              element={
                <ProtectedRoute>
                  <Layout>
                    <OfferAnalyzer />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/marketing/assignment-fee-optimizer"
              element={
                <ProtectedRoute>
                  <Layout>
                    <AssignmentFeeOptimizer />
                  </Layout>
                </ProtectedRoute>
              }
            />
            
            {/* AI CEO Control Room */}
            <Route
              path="/ai-ceo/control-room"
              element={
                <ProtectedRoute>
                  <Layout>
                    <AICEOControlRoom />
                  </Layout>
                </ProtectedRoute>
              }
            />
            
            {/* GMA Holdings OS Routes */}
            <Route
              path="/holdings/overview"
              element={
                <ProtectedRoute>
                  <Layout>
                    <HoldingsOverview />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/holdings/assets"
              element={
                <ProtectedRoute>
                  <Layout>
                    <HoldingsAssets />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/holdings/airbnb"
              element={
                <ProtectedRoute>
                  <Layout>
                    <HoldingsAirbnb />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/holdings/tenants"
              element={
                <ProtectedRoute>
                  <Layout>
                    <HoldingsTenants />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/holdings/loans"
              element={
                <ProtectedRoute>
                  <Layout>
                    <HoldingsLoans />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/holdings/expenses"
              element={
                <ProtectedRoute>
                  <Layout>
                    <HoldingsExpenses />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/holdings/strategy"
              element={
                <ProtectedRoute>
                  <Layout>
                    <HoldingsStrategy />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
