import EscalationsPanel from "@/components/communication/EscalationsPanel";

export default function EscalationsPage() {
  return (
    <div className="w-full min-h-full space-y-6">
      <h2 className="text-2xl font-bold mb-6">Escalations</h2>
      <EscalationsPanel />
    </div>
  );
}
