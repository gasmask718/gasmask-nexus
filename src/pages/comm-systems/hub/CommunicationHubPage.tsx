import CommSystemsLayout from "../CommSystemsLayout";
import { TemplatesLibrary } from "@/components/comm-systems/TemplatesLibrary";

export default function CommunicationHubPage() {
  return (
    <CommSystemsLayout
      title="Communication Hub"
      subtitle="Template CRUD and Bulk SMS operations dashboard"
    >
      <TemplatesLibrary />
    </CommSystemsLayout>
  );
}
