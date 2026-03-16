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
  DriverDeliveryTasks,
} from "@/components/portal/field";
import { AssignedOrdersPage } from "@/components/portal/field/AssignedOrdersPage";
import { PortalAuthGuard } from "@/components/portal/PortalAuthGuard";
import { PwaInstallBanner } from "@/components/pwa/PwaInstallBanner";

export default function DriverPortal() {
  return (
    <PortalAuthGuard allowedRoles={["driver"]} portalType="driver">
      <FieldPortalLayout portalType="driver">
        <div className="px-4 pt-4 mb-2">
          <PwaInstallBanner appName="Driver" />
        </div>

        <Routes>
          <Route index element={<MyDayDashboard portalType="driver" />} />
          <Route path="stores" element={<StoreListPage portalType="driver" />} />
          <Route path="visit" element={<StoreListPage portalType="driver" />} />
          <Route path="visit/:storeId" element={<StoreVisitEngine portalType="driver" />} />
          <Route path="delivery" element={<MakeDeliveryPage portalType="driver" />} />
          <Route path="delivery/:deliveryId" element={<MakeDeliveryPage portalType="driver" />} />
          <Route path="delivery-tasks" element={<DriverDeliveryTasks />} />
          <Route path="assigned-orders" element={<AssignedOrdersPage portalType="driver" />} />
          <Route path="changes" element={<ChangeListsPage portalType="driver" />} />
          <Route path="history" element={<HistoryPage portalType="driver" />} />
          <Route path="messages" element={<MessagesPage portalType="driver" />} />
          <Route path="messages/:threadId" element={<MessagesPage portalType="driver" />} />
          <Route path="profile" element={<ProfilePage portalType="driver" />} />
          <Route path="*" element={<Navigate to="/portal/driver" replace />} />
        </Routes>
      </FieldPortalLayout>
    </PortalAuthGuard>
  );
}
