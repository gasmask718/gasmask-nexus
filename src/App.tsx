import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AuthTokenCatcher } from "./components/auth/AuthTokenCatcher";
import { AuthProvider } from "./contexts/AuthContext";
import { BusinessProvider } from "./contexts/BusinessContext";
import { SimulationModeProvider } from "./contexts/SimulationModeContext";
import { SimulationModeBanner } from "./components/simulation/SimulationModeBanner";
import { DialerModeBanner } from "./components/communication/DialerModeBanner";
import { VoiceDeviceProvider } from "./contexts/VoiceDeviceProvider";
import { CallProvider } from "./components/communication/CallProvider";
import { MessageProvider } from "./components/communication/MessageProvider";
import { ViewAsProvider } from "./contexts/ViewAsContext";
import { ViewAsBanner } from "./components/admin/ViewAsBanner";
import { BackendFingerprint, BackendMismatchGuard } from "./components/dev/BackendFingerprint";
import { SchemaSanityChecker } from "./components/dev/SchemaSanityChecker";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { MaintenanceGuard } from "./components/MaintenanceGuard";
import { VACallWidget } from "./components/va/VACallWidget";
import { GlobalTrainingHelp } from "./components/training/GlobalTrainingHelp";
import { RefCapture } from "./components/dynasty-direct/RefCapture";
import { AgeGate } from "./components/dynasty-direct/AgeGate";
import { FlashSaleBanner } from "./components/FlashSaleBanner";

import './modules';
import AppRoutes from './routes/AppRoutes';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

import { IdeaBoxLauncher } from '@/components/idea/IdeaBoxLauncher';

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ErrorBoundary>
          <AuthTokenCatcher />
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
                          <AgeGate />
                          <RefCapture />
                          <FlashSaleBanner />
                          <ViewAsBanner />
                          <SimulationModeBanner />
                          <DialerModeBanner />
                          <VACallWidget />
                          <GlobalTrainingHelp />
                          <IdeaBoxLauncher />
                          <MaintenanceGuard>
                            <AppRoutes />
                          </MaintenanceGuard>
                        </MessageProvider>
                      </CallProvider>
                    </VoiceDeviceProvider>
                  </ViewAsProvider>
                </SimulationModeProvider>
              </BusinessProvider>
            </AuthProvider>
          </BackendMismatchGuard>
        </ErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

