import { FieldPortalLayout, MyDayDashboard } from '@/components/portal/field';

export default function DriverPortal() {
  return (
    <FieldPortalLayout portalType="driver">
      <MyDayDashboard portalType="driver" />
    </FieldPortalLayout>
  );
}
