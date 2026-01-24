import { AssistedModeOperatorPanel } from "@/components/communication/AssistedModeOperatorPanel";
import { useBusinessStore } from "@/stores/businessStore";

export default function LiveCallsPage() {
  const { selectedBusiness } = useBusinessStore();

  return (
    <div className="w-full min-h-full space-y-6">
      <h2 className="text-2xl font-bold mb-6">Live Calls</h2>
      {selectedBusiness ? (
        <AssistedModeOperatorPanel businessId={selectedBusiness.id} />
      ) : (
        <p className="text-muted-foreground">Select a business to view live calls</p>
      )}
    </div>
  );
}
