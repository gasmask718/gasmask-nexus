import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { BusinessProvider } from "./contexts/BusinessContext";
import { SimulationModeProvider } from "./contexts/SimulationModeContext";
import { SimulationModeBanner } from "./components/simulation/SimulationModeBanner";
import { VoiceDeviceProvider } from "./contexts/VoiceDeviceProvider";
import { CallProvider } from "./components/communication/CallProvider";
import { MessageProvider } from "./components/communication/MessageProvider";
import { ViewAsProvider } from "./contexts/ViewAsContext";
import { ViewAsBanner } from "./components/admin/ViewAsBanner";
import { BackendFingerprint, BackendMismatchGuard } from "./components/dev/BackendFingerprint";
import { SchemaSanityChecker } from "./components/dev/SchemaSanityChecker";

// Initialize Dynasty OS Module System - Auto-registers all modules
import './modules';

// Import the new clean routes
import AppRoutes from './routes/AppRoutes';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5 minutes
      gcTime: 10 * 60 * 1000,         // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <BackendMismatchGuard>
          <AuthProvider>
            <BusinessProvider>
              <SimulationModeProvider>
                <ViewAsProvider>
                  <VoiceDeviceProvider>
                    <CallProvider>
                      <MessageProvider>
                        <BackendFingerprint />
                        <SchemaSanityChecker />
                        <ViewAsBanner />
                        <SimulationModeBanner />
                        <AppRoutes />
                      </MessageProvider>
                    </CallProvider>
                  </VoiceDeviceProvider>
                </ViewAsProvider>
              </SimulationModeProvider>
            </BusinessProvider>
          </AuthProvider>
        </BackendMismatchGuard>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

