import { Routes, Route, Navigate } from 'react-router-dom';
import { FieldPortalLayout, MyDayDashboard, StoreListPage, StoreVisitEngine, ChangeListsPage, HistoryPage, MessagesPage, ProfilePage } from '@/components/portal/field';

export default function BikerPortal() {
  return (
    <FieldPortalLayout portalType="biker">
      <Routes>
        <Route index element={<MyDayDashboard portalType="biker" />} />
        <Route path="stores" element={<StoreListPage portalType="biker" />} />
        <Route path="visit" element={<StoreListPage portalType="biker" />} />
        <Route path="visit/:storeId" element={<StoreVisitEngine portalType="biker" />} />
        <Route path="changes" element={<ChangeListsPage portalType="biker" />} />
        <Route path="history" element={<HistoryPage portalType="biker" />} />
        <Route path="messages" element={<MessagesPage portalType="biker" />} />
        <Route path="messages/:threadId" element={<MessagesPage portalType="biker" />} />
        <Route path="profile" element={<ProfilePage portalType="biker" />} />
        <Route path="*" element={<Navigate to="/portal/biker" replace />} />
      </Routes>
    </FieldPortalLayout>
  );
}
