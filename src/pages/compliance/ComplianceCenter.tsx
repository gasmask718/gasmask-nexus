import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBusinessStore } from "@/stores/businessStore";
import { FlaskConical, Film, FileCheck, Siren, ShieldCheck, Eye, Brain } from "lucide-react";

import { IncidentSimulationDashboard } from "@/components/compliance/IncidentSimulationDashboard";
import { ForensicReplayViewer } from "@/components/compliance/ForensicReplayViewer";
import { RegulatoryEvidencePanel } from "@/components/compliance/RegulatoryEvidencePanel";
import { IncidentDrillPanel } from "@/components/compliance/IncidentDrillPanel";
import { ComplianceDashboard } from "@/components/compliance/ComplianceDashboard";
import { SentinelDashboard } from "@/components/compliance/SentinelDashboard";
import { AILearningDashboard } from "@/components/compliance/AILearningDashboard";

export default function ComplianceCenter() {
  const { selectedBusiness } = useBusinessStore();
  const businessId = selectedBusiness?.id || null;

  return (
    <div className="w-full min-h-full space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Regulatory Compliance Center</h1>
        <p className="text-muted-foreground mt-1">
          Incident simulation, forensic replay, and regulatory evidence generation
        </p>
      </div>

      <Tabs defaultValue="sentinel" className="space-y-6">
        <TabsList className="grid grid-cols-7 w-full max-w-6xl">
          <TabsTrigger value="sentinel" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Sentinel
          </TabsTrigger>
          <TabsTrigger value="learning" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            AI Learning
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="simulation" className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            Simulation
          </TabsTrigger>
          <TabsTrigger value="replay" className="flex items-center gap-2">
            <Film className="h-4 w-4" />
            Replay
          </TabsTrigger>
          <TabsTrigger value="evidence" className="flex items-center gap-2">
            <FileCheck className="h-4 w-4" />
            Evidence
          </TabsTrigger>
          <TabsTrigger value="drills" className="flex items-center gap-2">
            <Siren className="h-4 w-4" />
            Drills
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sentinel">
          <SentinelDashboard businessId={businessId} />
        </TabsContent>

        <TabsContent value="learning">
          <AILearningDashboard />
        </TabsContent>

        <TabsContent value="dashboard">
          <ComplianceDashboard businessId={businessId} />
        </TabsContent>

        <TabsContent value="simulation">
          <IncidentSimulationDashboard businessId={businessId} />
        </TabsContent>

        <TabsContent value="replay">
          <ForensicReplayViewer businessId={businessId} />
        </TabsContent>

        <TabsContent value="evidence">
          <RegulatoryEvidencePanel businessId={businessId} />
        </TabsContent>

        <TabsContent value="drills">
          <IncidentDrillPanel businessId={businessId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}