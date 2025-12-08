import { OperatorViewPanel } from "@/components/communication/OperatorViewPanel";

export default function LiveCallsPage() {
  return (
    <div className="w-full min-h-full space-y-6">
      <h2 className="text-2xl font-bold mb-6">Live Calls</h2>
      <OperatorViewPanel />
    </div>
  );
}
