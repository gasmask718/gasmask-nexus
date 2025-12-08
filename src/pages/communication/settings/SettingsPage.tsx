import CommSettingsPanel from "@/components/communication/CommSettingsPanel";

export default function SettingsPage() {
  return (
    <div className="w-full min-h-full space-y-6">
      <h2 className="text-2xl font-bold mb-6">Communication Settings</h2>
      <CommSettingsPanel />
    </div>
  );
}
