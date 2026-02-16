import { Routes, Route, Navigate } from 'react-router-dom';
import { FieldPortalLayout, MyDayDashboard, StoreListPage, StoreVisitEngine, ChangeListsPage, HistoryPage, MakeDeliveryPage, MessagesPage, ProfilePage, BikerDeliveryTasks } from '@/components/portal/field';
import { AssignedOrdersPage } from '@/components/portal/field/AssignedOrdersPage';
import { PortalAuthGuard } from '@/components/portal/PortalAuthGuard';

export default function BikerPortal() {
  return (
    <PortalAuthGuard allowedRoles={['biker']} portalType="biker">
      <FieldPortalLayout portalType="biker">
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
