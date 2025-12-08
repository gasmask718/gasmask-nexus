import { PredictionsTab } from "@/components/communication/PredictionsTab";

export default function PredictionsPage() {
  return (
    <div className="w-full min-h-full space-y-6">
      <h2 className="text-2xl font-bold mb-6">Predictions (V5)</h2>
      <PredictionsTab />
    </div>
  );
}
