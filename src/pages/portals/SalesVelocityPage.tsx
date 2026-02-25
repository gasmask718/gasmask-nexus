import { SalesVelocityPanel } from '@/components/production/SalesVelocityPanel';
import PortalLayout from '@/components/portal/PortalLayout';

export default function SalesVelocityPage() {
  return (
    <PortalLayout title="Sales Velocity Intelligence">
      <SalesVelocityPanel />
    </PortalLayout>
  );
}
