import CallFlowBuilder from "@/components/communication/CallFlowBuilder";

export default function CallFlowsPage() {
  return (
    <div className="w-full min-h-full space-y-6">
      <h2 className="text-2xl font-bold mb-6">Call Flows</h2>
      <CallFlowBuilder />
    </div>
  );
}
