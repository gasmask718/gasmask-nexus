import EngagementScoresPanel from "@/components/communication/EngagementScoresPanel";

export default function EngagementPage() {
  return (
    <div className="w-full min-h-full space-y-6">
      <h2 className="text-2xl font-bold mb-6">Engagement Scores</h2>
      <EngagementScoresPanel />
    </div>
  );
}
