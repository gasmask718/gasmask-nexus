import CommSystemsLayout from "./CommSystemsLayout";
import { GlobalQueueDashboard } from "@/components/comm-systems/GlobalQueueDashboard";

export default function QueueDashboardPage() {
  return (
    <CommSystemsLayout 
      title="Queue Dashboard" 
      subtitle="Monitor workload across all channels and businesses"
    >
      <GlobalQueueDashboard />
    </CommSystemsLayout>
  );
}
