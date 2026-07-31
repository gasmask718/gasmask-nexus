import { SBOHealthDashboard } from '@/components/sbo/SBOHealthDashboard';
import { ClampReadinessCard } from '@/components/sbo/ClampReadinessCard';

export default function HealthPage() {
  return (
    <div className="p-4 max-w-5xl mx-auto space-y-6">
      <SBOHealthDashboard />
      <ClampReadinessCard />
    </div>
  );
}

