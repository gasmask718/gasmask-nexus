import { Routes, Route, Navigate } from 'react-router-dom';
import { FieldPortalLayout, MyDayDashboard, StoreListPage, StoreVisitEngine, ChangeListsPage, HistoryPage, MakeDeliveryPage, MessagesPage, ProfilePage } from '@/components/portal/field';

export default function DriverPortal() {
  return (
    <FieldPortalLayout portalType="driver">
      <Routes>
        <Route index element={<MyDayDashboard portalType="driver" />} />
        <Route path="stores" element={<StoreListPage portalType="driver" />} />
        <Route path="visit" element={<StoreListPage portalType="driver" />} />
        <Route path="visit/:storeId" element={<StoreVisitEngine portalType="driver" />} />
        <Route path="delivery" element={<MakeDeliveryPage portalType="driver" />} />
        <Route path="delivery/:deliveryId" element={<MakeDeliveryPage portalType="driver" />} />
        <Route path="changes" element={<ChangeListsPage portalType="driver" />} />
        <Route path="history" element={<HistoryPage portalType="driver" />} />
        <Route path="messages" element={<MessagesPage portalType="driver" />} />
        <Route path="messages/:threadId" element={<MessagesPage portalType="driver" />} />
        <Route path="profile" element={<ProfilePage portalType="driver" />} />
        <Route path="*" element={<Navigate to="/portal/driver" replace />} />
      </Routes>
    </FieldPortalLayout>
  );
}
