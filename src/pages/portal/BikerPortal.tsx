import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Camera } from "lucide-react";
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
  EndOfDayNotes,
  AssignedRoutesPage,
} from "@/components/portal/field";
import { AssignedOrdersPage } from "@/components/portal/field/AssignedOrdersPage";
import { PortalAuthGuard } from "@/components/portal/PortalAuthGuard";
import { PwaInstallBanner } from "@/components/pwa/PwaInstallBanner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { StoreCaptureForm } from "@/components/store/StoreCaptureForm";

export default function BikerPortal() {
  const [captureOpen, setCaptureOpen] = useState(false);

  return (
    <PortalAuthGuard allowedRoles={["biker"]} portalType="biker">
      <FieldPortalLayout portalType="biker">
        <div className="px-4 pt-4 mb-2">
          <PwaInstallBanner appName="Biker" />
        </div>

        <Routes>
          <Route index element={<MyDayDashboard portalType="biker" />} />
          <Route path="stores" element={<StoreListPage portalType="biker" />} />
          <Route path="visit" element={<StoreListPage portalType="biker" />} />
          <Route path="visit/:storeId" element={<StoreVisitEngine portalType="biker" />} />
          <Route path="delivery" element={<MakeDeliveryPage portalType="biker" />} />
          <Route path="delivery/:deliveryId" element={<MakeDeliveryPage portalType="biker" />} />
          <Route path="delivery-tasks" element={<BikerDeliveryTasks />} />
          <Route path="route" element={<AssignedRoutesPage portalType="biker" />} />
          <Route path="routes" element={<AssignedRoutesPage portalType="biker" />} />
          <Route path="assigned-orders" element={<AssignedOrdersPage portalType="biker" />} />
          <Route path="changes" element={<ChangeListsPage portalType="biker" />} />
          <Route path="history" element={<HistoryPage portalType="biker" />} />
          <Route path="messages" element={<MessagesPage portalType="biker" />} />
          <Route path="messages/:threadId" element={<MessagesPage portalType="biker" />} />
          <Route path="profile" element={<ProfilePage portalType="biker" />} />
          <Route path="end-of-day" element={<EndOfDayNotes role="biker" />} />
          <Route path="*" element={<Navigate to="/portal/biker" replace />} />
        </Routes>
      </FieldPortalLayout>

      {/* Capture New Store FAB — sibling of layout to avoid clipping by ancestor containers */}
      <Sheet open={captureOpen} onOpenChange={setCaptureOpen}>
        <SheetTrigger asChild>
          <Button
            aria-label="Capture new store"
            className="fixed bottom-6 right-6 h-14 min-w-14 rounded-full shadow-lg gap-2 z-[100] px-5"
          >
            <Camera className="h-5 w-5" />
            <span className="hidden sm:inline">Capture New Store</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[90vh] sm:h-auto sm:max-h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Capture New Store</SheetTitle>
            <SheetDescription>
              Found a new shop? Add it here. It goes live instantly and the owner reviews it post-hoc.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <StoreCaptureForm
              onCaptured={() => setCaptureOpen(false)}
              onCancel={() => setCaptureOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </PortalAuthGuard>
  );
}
