import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { BusinessProvider } from "./contexts/BusinessContext";
import { SimulationModeProvider } from "./contexts/SimulationModeContext";
import { SimulationModeBanner } from "./components/simulation/SimulationModeBanner";
import { CallProvider } from "./components/communication/CallProvider";
import { MessageProvider } from "./components/communication/MessageProvider";
import { ViewAsProvider } from "./contexts/ViewAsContext";
import { ViewAsBanner } from "./components/admin/ViewAsBanner";

// Initialize Dynasty OS Module System - Auto-registers all modules
import './modules';

// Import the new clean routes
import AppRoutes from './routes/AppRoutes';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <BusinessProvider>
            <SimulationModeProvider>
              <ViewAsProvider>
                <CallProvider>
                  <MessageProvider>
                    <ViewAsBanner />
                    <SimulationModeBanner />
                    <AppRoutes />
                  </MessageProvider>
                </CallProvider>
              </ViewAsProvider>
            </SimulationModeProvider>
          </BusinessProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
