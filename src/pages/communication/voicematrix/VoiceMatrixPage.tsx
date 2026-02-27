import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Radio, Settings, Mic, Volume2 } from "lucide-react";
import { VoiceMatrixManager } from "@/components/communication/VoiceMatrixManager";
import { LiveVoiceMatrix } from "@/components/communication/LiveVoiceMatrix";
import { VoiceBrowserTest } from "@/components/communication/VoiceBrowserTest";
import { VoiceTestConsole } from "@/components/communication/VoiceTestConsole";

export default function VoiceMatrixPage() {
  return (
    <div className="w-full min-h-full space-y-6">
      <Tabs defaultValue="personas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="personas" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Personas & Providers
          </TabsTrigger>
          <TabsTrigger value="test-console" className="flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            Voice Test Console
          </TabsTrigger>
          <TabsTrigger value="test" className="flex items-center gap-2">
            <Mic className="h-4 w-4" />
            Browser Voice Test
          </TabsTrigger>
          <TabsTrigger value="live" className="flex items-center gap-2">
            <Radio className="h-4 w-4" />
            Live Voice Matrix
          </TabsTrigger>
        </TabsList>
        <TabsContent value="personas">
          <VoiceMatrixManager />
        </TabsContent>
        <TabsContent value="test-console">
          <VoiceTestConsole />
        </TabsContent>
        <TabsContent value="test">
          <VoiceBrowserTest />
        </TabsContent>
        <TabsContent value="live">
          <LiveVoiceMatrix />
        </TabsContent>
      </Tabs>
    </div>
  );
}
