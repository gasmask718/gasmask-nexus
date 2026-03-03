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

  return (
    <PortalAuthGuard allowedRoles={["biker"]} portalType="biker">
      <FieldPortalLayout portalType="biker">
        {/* PWA Install Banner - Persistent across all Biker pages */}
        {canInstall && (
          <div className="px-4 pt-4 mb-2">
            <Card className="bg-primary/5 border-primary/20 shadow-sm">
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-foreground">Install App</p>
                  <p className="text-xs text-muted-foreground">Enable offline mode & maps</p>
                </div>
                <Button size="sm" onClick={triggerInstall} className="h-8 gap-2 shrink-0">
                  <Download className="h-3.5 w-3.5" />
                  Install
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
