import CallFlowBuilder from "@/components/communication/CallFlowBuilder";

export default function CallFlowsPage() {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Call Flows</h2>
      <CallFlowBuilder />
    </div>
  );
}
