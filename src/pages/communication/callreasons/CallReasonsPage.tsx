import { CallReasonsPanel } from "@/components/communication/CallReasonsPanel";

export default function CallReasonsPage() {
  return (
    <div className="w-full min-h-full space-y-6">
      <h2 className="text-2xl font-bold mb-6">Call Reasons</h2>
      <CallReasonsPanel />
    </div>
  );
}
