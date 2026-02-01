/**
 * SCENARIO SIMULATION HOOK
 * 
 * All calculations for what-if scenarios.
 * UI-only, non-persistent, no backend writes.
 */

import { useMemo, useState, useCallback } from 'react';
import { WorkerSkillProfile } from '@/hooks/useWorkerPerformance';
import { ProductionWorker } from '@/hooks/useProductionPortal';
import {
  ScenarioInputs,
  ScenarioOutput,
  WorkerImpact,
  NamedScenario,
  SimulationWorker,
  WorkerAdjustment,
  createDefaultInputs,
} from './types';

interface UseScenarioSimulationProps {
  profiles: WorkerSkillProfile[];
  workers: ProductionWorker[];
  presentWorkerIds: string[];
  targetBoxes: number;
  boxesCompleted: number;
  defaultBoxesPerHour: number;
}

function calculatePredictability(profile: WorkerSkillProfile): number {
  const consistencyVariance = profile.rolling_7_day_boxes > 0 
    ? Math.abs((profile.rolling_7_day_defects || 0) / profile.rolling_7_day_boxes) 
    : 0.25;
  
  return Math.round(
    (profile.reliability_score * 0.4) +
    ((1 - Math.min(consistencyVariance, 1)) * 100 * 0.3) +
    ((profile.trend_speed === 'stable' ? 75 : profile.trend_speed === 'improving' ? 100 : 50) * 0.15) +
    ((profile.trend_quality === 'stable' ? 75 : profile.trend_quality === 'improving' ? 100 : 50) * 0.15)
  );
}

export function useScenarioSimulation({
  profiles,
  workers,
  presentWorkerIds,
  targetBoxes,
  boxesCompleted,
  defaultBoxesPerHour,
}: UseScenarioSimulationProps) {
  // Scenario mode state
  const [isScenarioMode, setIsScenarioMode] = useState(false);
  const [inputs, setInputs] = useState<ScenarioInputs>(() => 
    createDefaultInputs(presentWorkerIds, 8)
  );
  const [savedScenarios, setSavedScenarios] = useState<NamedScenario[]>([]);

  // Worker lookup maps
  const workerMap = useMemo(() => new Map(workers.map(w => [w.id, w])), [workers]);
  const profileMap = useMemo(() => new Map(profiles.map(p => [p.worker_id, p])), [profiles]);

  // Build simulation workers
  const simulationWorkers = useMemo<SimulationWorker[]>(() => {
    return profiles.map(profile => {
      const worker = workerMap.get(profile.worker_id);
      const isPresent = presentWorkerIds.includes(profile.worker_id);
      const adjustment = inputs.workerAdjustments.get(profile.worker_id) || null;
      
      return {
        profile,
        worker: worker || { id: profile.worker_id, full_name: 'Unknown' } as ProductionWorker,
        predictability: calculatePredictability(profile),
        isPresent,
        adjustment,
      };
    });
  }, [profiles, workerMap, presentWorkerIds, inputs.workerAdjustments]);

  // Calculate baseline (current reality)
  const baseline = useMemo<ScenarioOutput>(() => {
    const presentProfiles = profiles.filter(p => presentWorkerIds.includes(p.worker_id));
    
    const totalCapacity = presentProfiles.reduce(
      (sum, p) => sum + (p.boxes_per_hour || defaultBoxesPerHour), 
      0
    );
    
    const boxesRemaining = Math.max(0, targetBoxes - boxesCompleted);
    const hoursToComplete = totalCapacity > 0 ? boxesRemaining / totalCapacity : Infinity;
    
    const avgPredictability = presentProfiles.length > 0
      ? Math.round(presentProfiles.reduce((sum, p) => sum + calculatePredictability(p), 0) / presentProfiles.length)
      : 0;
    
    const confidenceLevel = avgPredictability >= 70 ? 'high' : avgPredictability >= 50 ? 'medium' : 'low';
    
    return {
      totalCapacity,
      timeToComplete: hoursToComplete,
      minutesToComplete: Math.round((hoursToComplete % 1) * 60),
      confidenceLevel,
      avgPredictability,
      capacityDelta: 0,
      timeDelta: 0,
      confidenceDelta: 'same',
      delayRisk: hoursToComplete > 8 ? 'likely' : hoursToComplete > 6 ? 'possible' : 'none',
      delayRiskReason: hoursToComplete > 8 ? 'Exceeds standard 8-hour shift' : null,
      canComplete: hoursToComplete <= 8,
    };
  }, [profiles, presentWorkerIds, targetBoxes, boxesCompleted, defaultBoxesPerHour]);

  // Calculate simulated output based on inputs
  const simulatedOutput = useMemo<ScenarioOutput>(() => {
    if (!isScenarioMode) return baseline;

    // Get active workers under simulation
    const activeWorkers = simulationWorkers.filter(sw => {
      const adj = inputs.workerAdjustments.get(sw.profile.worker_id);
      return adj?.isPresent !== false; // Include if not explicitly removed
    });

    // Calculate capacity with modifiers
    const totalCapacity = activeWorkers.reduce((sum, sw) => {
      const adj = inputs.workerAdjustments.get(sw.profile.worker_id);
      const baseRate = adj?.boxesPerHourOverride ?? sw.profile.boxes_per_hour ?? defaultBoxesPerHour;
      const modifiedRate = baseRate * (1 + inputs.globalSpeedModifier / 100);
      return sum + modifiedRate;
    }, 0);

    const boxesRemaining = Math.max(0, targetBoxes - boxesCompleted);
    const hoursToComplete = totalCapacity > 0 ? boxesRemaining / totalCapacity : Infinity;
    
    // Adjust for overtime
    const effectiveHoursAvailable = inputs.includeOvertime ? inputs.hoursRemaining + 2 : inputs.hoursRemaining;
    const canComplete = hoursToComplete <= effectiveHoursAvailable;

    // Predictability with adjustments
    const activePredictabilities = activeWorkers.map(sw => sw.predictability);
    const avgPredictability = activePredictabilities.length > 0
      ? Math.round(activePredictabilities.reduce((a, b) => a + b, 0) / activePredictabilities.length)
      : 0;
    
    const confidenceLevel = avgPredictability >= 70 ? 'high' : avgPredictability >= 50 ? 'medium' : 'low';

    // Calculate deltas vs baseline
    const capacityDelta = baseline.totalCapacity > 0 
      ? Math.round(((totalCapacity - baseline.totalCapacity) / baseline.totalCapacity) * 100)
      : 0;
    
    const timeDelta = hoursToComplete - baseline.timeToComplete;
    
    const confidenceDelta = avgPredictability > baseline.avgPredictability ? 'higher' 
      : avgPredictability < baseline.avgPredictability ? 'lower' 
      : 'same';

    // Delay risk assessment
    let delayRisk: ScenarioOutput['delayRisk'] = 'none';
    let delayRiskReason: string | null = null;
    
    if (!canComplete) {
      delayRisk = 'certain';
      delayRiskReason = 'Cannot complete within available hours';
    } else if (hoursToComplete > inputs.hoursRemaining * 0.9) {
      delayRisk = 'likely';
      delayRiskReason = 'Cutting very close to time limit';
    } else if (confidenceLevel === 'low') {
      delayRisk = 'possible';
      delayRiskReason = 'Low team predictability increases uncertainty';
    } else if (activeWorkers.some(w => w.predictability < 40)) {
      delayRisk = 'possible';
      delayRiskReason = 'Some workers have low predictability';
    }

    return {
      totalCapacity,
      timeToComplete: hoursToComplete,
      minutesToComplete: Math.round((hoursToComplete % 1) * 60),
      confidenceLevel,
      avgPredictability,
      capacityDelta,
      timeDelta,
      confidenceDelta,
      delayRisk,
      delayRiskReason,
      canComplete,
    };
  }, [isScenarioMode, simulationWorkers, inputs, baseline, targetBoxes, boxesCompleted, defaultBoxesPerHour]);

  // Calculate worker impacts
  const workerImpacts = useMemo<WorkerImpact[]>(() => {
    if (!isScenarioMode) return [];

    return simulationWorkers.map(sw => {
      const adj = inputs.workerAdjustments.get(sw.profile.worker_id);
      const isActive = adj?.isPresent !== false;
      
      // Baseline contribution
      const baselineRate = sw.profile.boxes_per_hour || defaultBoxesPerHour;
      const baselineContribution = baseline.totalCapacity > 0 
        ? Math.round((baselineRate / baseline.totalCapacity) * 100)
        : 0;

      // Simulated contribution
      const simulatedRate = adj?.boxesPerHourOverride ?? baselineRate;
      const modifiedRate = isActive ? simulatedRate * (1 + inputs.globalSpeedModifier / 100) : 0;
      const simulatedContribution = simulatedOutput.totalCapacity > 0
        ? Math.round((modifiedRate / simulatedOutput.totalCapacity) * 100)
        : 0;

      // Determine load change
      let loadChange: WorkerImpact['loadChange'] = 'same';
      if (!isActive) {
        loadChange = 'removed';
      } else if (simulatedContribution > baselineContribution + 5) {
        loadChange = 'increased';
      } else if (simulatedContribution < baselineContribution - 5) {
        loadChange = 'decreased';
      }

      // Risk notes
      let riskNote: string | null = null;
      if (!isActive) {
        riskNote = 'Removed from scenario';
      } else if (sw.predictability < 40 && loadChange === 'increased') {
        riskNote = 'Low predictability under increased load';
      } else if (sw.profile.trend_speed === 'declining' && loadChange === 'increased') {
        riskNote = 'Declining trend with increased responsibility';
      } else if (simulatedContribution > 25) {
        riskNote = 'High dependency on single worker';
      }

      return {
        workerId: sw.profile.worker_id,
        workerName: sw.worker.full_name || 'Unknown',
        baselineContribution,
        baselineBoxesPerHour: baselineRate,
        simulatedContribution,
        simulatedBoxesPerHour: modifiedRate,
        contributionDelta: simulatedContribution - baselineContribution,
        loadChange,
        riskNote,
      };
    }).filter(impact => impact.baselineContribution > 0 || impact.simulatedContribution > 0);
  }, [isScenarioMode, simulationWorkers, inputs, baseline, simulatedOutput, defaultBoxesPerHour]);

  // Actions
  const enterScenarioMode = useCallback(() => {
    setInputs(createDefaultInputs(presentWorkerIds, 8));
    setIsScenarioMode(true);
  }, [presentWorkerIds]);

  const exitScenarioMode = useCallback(() => {
    setIsScenarioMode(false);
    setInputs(createDefaultInputs(presentWorkerIds, 8));
    setSavedScenarios([]);
  }, [presentWorkerIds]);

  const updateWorkerPresence = useCallback((workerId: string, isPresent: boolean) => {
    setInputs(prev => {
      const newAdjustments = new Map(prev.workerAdjustments);
      const existing = newAdjustments.get(workerId) || {
        workerId,
        isPresent: true,
        boxesPerHourOverride: null,
        defectRateOverride: null,
      };
      newAdjustments.set(workerId, { ...existing, isPresent });
      return { ...prev, workerAdjustments: newAdjustments };
    });
  }, []);

  const updateWorkerRate = useCallback((workerId: string, boxesPerHour: number | null) => {
    setInputs(prev => {
      const newAdjustments = new Map(prev.workerAdjustments);
      const existing = newAdjustments.get(workerId) || {
        workerId,
        isPresent: true,
        boxesPerHourOverride: null,
        defectRateOverride: null,
      };
      newAdjustments.set(workerId, { ...existing, boxesPerHourOverride: boxesPerHour });
      return { ...prev, workerAdjustments: newAdjustments };
    });
  }, []);

  const updateGlobalModifiers = useCallback((speedMod: number, defectMod: number) => {
    setInputs(prev => ({
      ...prev,
      globalSpeedModifier: speedMod,
      globalDefectModifier: defectMod,
    }));
  }, []);

  const updateTimeConstraints = useCallback((hoursRemaining: number, includeOvertime: boolean) => {
    setInputs(prev => ({
      ...prev,
      hoursRemaining,
      includeOvertime,
    }));
  }, []);

  const saveScenario = useCallback((name: string) => {
    const scenario: NamedScenario = {
      id: `scenario-${Date.now()}`,
      name,
      inputs: { ...inputs, workerAdjustments: new Map(inputs.workerAdjustments) },
      output: { ...simulatedOutput },
      workerImpacts: [...workerImpacts],
      createdAt: new Date(),
    };
    setSavedScenarios(prev => [...prev, scenario]);
    return scenario;
  }, [inputs, simulatedOutput, workerImpacts]);

  const deleteScenario = useCallback((id: string) => {
    setSavedScenarios(prev => prev.filter(s => s.id !== id));
  }, []);

  const loadScenario = useCallback((scenario: NamedScenario) => {
    setInputs({
      ...scenario.inputs,
      workerAdjustments: new Map(scenario.inputs.workerAdjustments),
    });
  }, []);

  return {
    // State
    isScenarioMode,
    inputs,
    simulationWorkers,
    
    // Outputs
    baseline,
    simulatedOutput,
    workerImpacts,
    savedScenarios,
    
    // Actions
    enterScenarioMode,
    exitScenarioMode,
    updateWorkerPresence,
    updateWorkerRate,
    updateGlobalModifiers,
    updateTimeConstraints,
    saveScenario,
    deleteScenario,
    loadScenario,
  };
}
