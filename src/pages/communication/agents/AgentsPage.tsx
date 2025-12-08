import { AIAgentsTab } from "@/components/communication/AIAgentsTab";

export default function AgentsPage() {
  return (
    <div className="w-full min-h-full space-y-6">
      <h2 className="text-2xl font-bold mb-6">AI Agents (V6)</h2>
      <AIAgentsTab />
    </div>
  );
}
