import CommSystemsLayout from "./CommSystemsLayout";
import { TemplatesLibrary } from "@/components/comm-systems/TemplatesLibrary";

export default function TemplatesPage() {
  return (
    <CommSystemsLayout 
      title="Templates" 
      subtitle="Manage communication templates for SMS, email, and calls"
    >
      <TemplatesLibrary />
    </CommSystemsLayout>
  );
}
