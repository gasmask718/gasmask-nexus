import { SupplierYieldRankingPanel } from '@/components/production/SupplierYieldRankingPanel';
import PortalLayout from '@/components/portal/PortalLayout';

export default function SupplierYieldPage() {
  return (
    <PortalLayout title="Supplier Yield Intelligence">
      <SupplierYieldRankingPanel />
    </PortalLayout>
  );
}
