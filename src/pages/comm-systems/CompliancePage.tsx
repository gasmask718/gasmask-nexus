import CommSystemsLayout from "./CommSystemsLayout";
import { ComplianceCenter } from "@/components/comm-systems/ComplianceCenter";

export default function CompliancePage() {
  return (
    <CommSystemsLayout 
      title="Compliance" 
      subtitle="Manage opt-ins, consents, and data retention"
    >
      <ComplianceCenter />
    </CommSystemsLayout>
  );
}
