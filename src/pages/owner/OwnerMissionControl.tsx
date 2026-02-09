/**
 * 🎯 Mission Control — Founder Execution OS
 * 
 * Owner Penthouse: Cross-business, cross-floor task intelligence.
 * This is NOT a to-do list. This is a Founder Operating Rhythm.
 */

import { Target, Rocket } from 'lucide-react';
import { useMissionControl } from '@/hooks/useMissionControl';
import { useFinanceSignal } from '@/hooks/useFinanceSignal';
import { useCRMSignal } from '@/hooks/useCRMSignal';
import { useMarginSignal } from '@/hooks/useMarginSignal';
import { MomentumPanel } from '@/components/missionControl/MomentumPanel';
import { MissionListView } from '@/components/missionControl/MissionListView';
import { CreateMissionDialog } from '@/components/missionControl/CreateMissionDialog';
import { SignalScannerPanel } from '@/components/missionControl/SignalScannerPanel';
import { Skeleton } from '@/components/ui/skeleton';

export default function OwnerMissionControl() {
  const {
    missions,
    isLoading,
    createMission,
    updateStatus,
    deleteMission,
    momentum,
  } = useMissionControl();

  const {
    runScan: runFinanceScan,
    isScanning: isFinanceScanning,
    lastScanResult: financeResult,
  } = useFinanceSignal();

  const {
    runScan: runCRMScan,
    isScanning: isCRMScanning,
    lastScanResult: crmResult,
  } = useCRMSignal();

  const {
    runScan: runMarginScan,
    isScanning: isMarginScanning,
    lastScanResult: marginResult,
  } = useMarginSignal();

  if (isLoading) {
    return (
      <div className="space-y-6 p-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Target className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              Mission Control
              <Rocket className="h-5 w-5 text-muted-foreground" />
            </h1>
            <p className="text-sm text-muted-foreground">
              Founder Execution OS — Cross-business task intelligence
            </p>
          </div>
        </div>
        <CreateMissionDialog
          onSubmit={(input) => createMission.mutate(input)}
          isLoading={createMission.isPending}
        />
      </div>

      {/* Momentum Panel */}
      <MomentumPanel
        completedThisWeek={momentum.completedThisWeek}
        totalActive={momentum.totalActive}
        totalOverdue={momentum.totalOverdue}
        completionRate={momentum.completionRate}
        totalDeferred={momentum.totalDeferred}
      />

      {/* Floor Signal Scanner */}
      <SignalScannerPanel
        onRunFinanceScan={() => runFinanceScan()}
        isFinanceScanning={isFinanceScanning}
        financeResult={financeResult}
        onRunCRMScan={() => runCRMScan()}
        isCRMScanning={isCRMScanning}
        crmResult={crmResult}
        onRunMarginScan={() => runMarginScan()}
        isMarginScanning={isMarginScanning}
        marginResult={marginResult}
      />

      {/* Mission List */}
      <MissionListView
        missions={missions}
        onStatusChange={(id, status) => updateStatus.mutate({ id, status })}
        onDelete={(id) => deleteMission.mutate(id)}
      />
    </div>
  );
}
