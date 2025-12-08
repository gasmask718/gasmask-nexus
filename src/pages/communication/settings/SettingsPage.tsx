import CommSettingsPanel from "@/components/communication/CommSettingsPanel";

export default function SettingsPage() {
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Communication Settings</h2>
      <CommSettingsPanel />
    </div>
  );
}
