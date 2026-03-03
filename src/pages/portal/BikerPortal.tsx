import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import {
  FieldPortalLayout,
  MyDayDashboard,
  StoreListPage,
  StoreVisitEngine,
  ChangeListsPage,
  HistoryPage,
  MakeDeliveryPage,
  MessagesPage,
  ProfilePage,
  BikerDeliveryTasks,
} from "@/components/portal/field";
import { AssignedOrdersPage } from "@/components/portal/field/AssignedOrdersPage";
import { PortalAuthGuard } from "@/components/portal/PortalAuthGuard";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Share, X } from "lucide-react";

export default function BikerPortal() {
  const { canInstall, triggerInstall } = usePwaInstall();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if the app is already running in "App Mode" (PWA)
    const isInStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
    setIsStandalone(isInStandaloneMode);
  }, []);

  // If already installed (standalone) or user clicked X, hide the banner
  const showBanner = !isStandalone && !isDismissed;

  return (
    <PortalAuthGuard allowedRoles={["biker"]} portalType="biker">
      <FieldPortalLayout portalType="biker">
        {/* PWA Install Banner - Always visible unless dismissed/installed */}
        {showBanner && (
          <div className="px-4 pt-4 mb-2">
            <Card className="bg-primary/5 border-primary/20 shadow-sm relative">
              <button
                onClick={() => setIsDismissed(true)}
                className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>

              <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1 pr-6">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Download className="h-4 w-4 text-primary" />
                    Install App
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {canInstall
                      ? "Install for offline maps & better battery life."
                      : "To install: Tap browser menu (Share/Dots) → 'Add to Home Screen'."}
                  </p>
                </div>

                <Button
                  size="sm"
                  onClick={canInstall ? triggerInstall : undefined}
                  variant={canInstall ? "default" : "outline"}
                  disabled={!canInstall} // Disabled if browser doesn't support auto-trigger
                  className="w-full sm:w-auto gap-2 shrink-0"
                >
                  {canInstall ? (
                    <>
                      <Download className="h-3.5 w-3.5" />
                      Install Now
                    </>
                  ) : (
                    <>
                      <Share className="h-3.5 w-3.5" />
                      Follow Instructions
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        <Routes>
          <Route index element={<MyDayDashboard portalType="biker" />} />
          <Route path="stores" element={<StoreListPage portalType="biker" />} />
          <Route path="visit" element={<StoreListPage portalType="biker" />} />
          <Route path="visit/:storeId" element={<StoreVisitEngine portalType="biker" />} />
          <Route path="delivery" element={<MakeDeliveryPage portalType="biker" />} />
          <Route path="delivery/:deliveryId" element={<MakeDeliveryPage portalType="biker" />} />
          <Route path="delivery-tasks" element={<BikerDeliveryTasks />} />
          <Route path="assigned-orders" element={<AssignedOrdersPage portalType="biker" />} />
          <Route path="changes" element={<ChangeListsPage portalType="biker" />} />
          <Route path="history" element={<HistoryPage portalType="biker" />} />
          <Route path="messages" element={<MessagesPage portalType="biker" />} />
          <Route path="messages/:threadId" element={<MessagesPage portalType="biker" />} />
          <Route path="profile" element={<ProfilePage portalType="biker" />} />
          <Route path="*" element={<Navigate to="/portal/biker" replace />} />
        </Routes>
      </FieldPortalLayout>
    </PortalAuthGuard>
  );
}
