import { FieldPortalLayout, MyDayDashboard } from '@/components/portal/field';

export default function BikerPortal() {
  return (
    <FieldPortalLayout portalType="biker">
      <MyDayDashboard portalType="biker" />
    </FieldPortalLayout>
  );
}
