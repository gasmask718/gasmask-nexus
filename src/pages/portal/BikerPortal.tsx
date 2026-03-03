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
import { Download } from "lucide-react";

export default function BikerPortal() {
  const { canInstall, triggerInstall } = usePwaInstall();
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if the app is already running in "App Mode" (PWA)
    // This prevents the banner from showing if the user is already using the installed app.
    const isInStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
    setIsStandalone(isInStandaloneMode);
  }, []);

  return (
    <PortalAuthGuard allowedRoles={["biker"]} portalType="biker">
      <FieldPortalLayout portalType="biker">
        {/* PWA Install Button — Matched to Dashboard Reference */}
        {!isStandalone && (
          <div className="px-4 pt-4 mb-2">
            <Card className="glass-card border-primary/30 bg-primary/5">
              <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6">
                <div className="space-y-1 text-center sm:text-left">
                  <h3 className="text-lg font-bold text-foreground">Install Biker App</h3>
                  <p className="text-sm text-muted-foreground">
                    {canInstall
                      ? "Add to your home screen for quick access & offline support."
                      : 'Open this page in Safari (iOS) or Chrome (Android) and use "Add to Home Screen" to install.'}
                  </p>
                </div>
                <Button
                  onClick={canInstall ? triggerInstall : undefined}
                  disabled={!canInstall}
                  size="lg"
                  className="gap-2 shrink-0 min-w-[200px]"
                >
                  <Download className="h-5 w-5" />
                  {canInstall ? "Install Now" : "Install via Browser Menu"}
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
