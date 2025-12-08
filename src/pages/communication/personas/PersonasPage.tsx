import VoicePersonaBuilder from "@/components/communication/VoicePersonaBuilder";

export default function PersonasPage() {
  return (
    <div className="w-full min-h-full space-y-6">
      <h2 className="text-2xl font-bold mb-6">Voice Personas</h2>
      <VoicePersonaBuilder />
    </div>
  );
}
