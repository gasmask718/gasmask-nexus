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
import MyRoute from "./pages/MyRoute";
import Leaderboard from "./pages/Leaderboard";
import Payroll from "./pages/Payroll";
import MetaAI from "./pages/MetaAI";
import StoreOrder from "./pages/StoreOrder";
import WholesaleFulfillment from "./pages/WholesaleFulfillment";
import Billing from "./pages/Billing";
import EconomicAnalytics from "./pages/EconomicAnalytics";
import AmbassadorPayouts from "./pages/AmbassadorPayouts";
import BikerPayouts from "./pages/BikerPayouts";

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
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
