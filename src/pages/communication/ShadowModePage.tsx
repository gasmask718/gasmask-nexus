import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBusinessStore } from "@/stores/businessStore";
import { Eye, Scale, Shield, GraduationCap } from "lucide-react";

import { ShadowModeDashboard } from "@/components/communication/shadow-mode/ShadowModeDashboard";
import { AIVsHumanDiffViewer } from "@/components/communication/shadow-mode/AIVsHumanDiffViewer";
import { TrustScorecard } from "@/components/communication/shadow-mode/TrustScorecard";
import { GraduationReadinessPanel } from "@/components/communication/shadow-mode/GraduationReadinessPanel";

export default function ShadowModePage() {
  const { selectedBusiness } = useBusinessStore();
  const businessId = selectedBusiness?.id || null;

  return (
    <div className="w-full min-h-full space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">AI Trust & Graduation</h1>
        <p className="text-muted-foreground mt-1">
          Monitor AI performance, compare decisions, and manage mode progression
        </p>
      </div>

      <Tabs defaultValue="shadow" className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="shadow" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Shadow Mode
          </TabsTrigger>
          <TabsTrigger value="comparison" className="flex items-center gap-2">
            <Scale className="h-4 w-4" />
            AI vs Human
          </TabsTrigger>
          <TabsTrigger value="trust" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Trust Score
          </TabsTrigger>
          <TabsTrigger value="graduation" className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            Graduation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="shadow">
          <ShadowModeDashboard businessId={businessId} />
        </TabsContent>

        <TabsContent value="comparison">
          <AIVsHumanDiffViewer businessId={businessId} />
        </TabsContent>

        <TabsContent value="trust">
          <TrustScorecard businessId={businessId} />
        </TabsContent>

        <TabsContent value="graduation">
          <GraduationReadinessPanel businessId={businessId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
