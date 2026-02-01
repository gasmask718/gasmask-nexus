/**
 * SCENARIO PLANNING TYPES
 * 
 * Type definitions for what-if simulation layer.
 * All data is session-only, non-persistent.
 */

import { WorkerSkillProfile } from '@/hooks/useWorkerPerformance';
import { ProductionWorker } from '@/hooks/useProductionPortal';

// Worker adjustment state
export interface WorkerAdjustment {
  workerId: string;
  isPresent: boolean;
  boxesPerHourOverride: number | null;
  defectRateOverride: number | null;
}

// Scenario input controls
export interface ScenarioInputs {
  // Staffing adjustments (worker ID -> adjustment)
  workerAdjustments: Map<string, WorkerAdjustment>;
  
  // Time constraints
  hoursRemaining: number;
  includeOvertime: boolean;
  
  // Performance assumptions
  globalSpeedModifier: number; // percentage (-50 to +50)
  globalDefectModifier: number; // percentage (-50 to +50)
}

// Calculated scenario output
export interface ScenarioOutput {
  // Capacity metrics
  totalCapacity: number; // boxes/hour
  timeToComplete: number; // hours
  minutesToComplete: number;
  
  // Risk assessment
  confidenceLevel: 'high' | 'medium' | 'low';
  avgPredictability: number;
  
  // Comparison to baseline
  capacityDelta: number; // percentage change
  timeDelta: number; // hours change
  confidenceDelta: 'higher' | 'same' | 'lower';
  
  // Delay risk
  delayRisk: 'none' | 'possible' | 'likely' | 'certain';
  delayRiskReason: string | null;
  
  // Can complete within constraints?
  canComplete: boolean;
}

// Worker impact under scenario
export interface WorkerImpact {
  workerId: string;
  workerName: string;
  
  // Baseline (from current reality)
  baselineContribution: number;
  baselineBoxesPerHour: number;
  
  // Simulated
  simulatedContribution: number;
  simulatedBoxesPerHour: number;
  
  // Changes
  contributionDelta: number;
  loadChange: 'increased' | 'same' | 'decreased' | 'removed';
  
  // Risk notes
  riskNote: string | null;
}

// Named scenario for comparison
export interface NamedScenario {
  id: string;
  name: string;
  inputs: ScenarioInputs;
  output: ScenarioOutput;
  workerImpacts: WorkerImpact[];
  createdAt: Date;
}

// Enriched worker for simulation
export interface SimulationWorker {
  profile: WorkerSkillProfile;
  worker: ProductionWorker;
  predictability: number;
  isPresent: boolean; // In baseline reality
  adjustment: WorkerAdjustment | null;
}

// Default scenario inputs factory
export function createDefaultInputs(
  workerIds: string[],
  hoursRemaining: number = 8
): ScenarioInputs {
  const adjustments = new Map<string, WorkerAdjustment>();
  
  workerIds.forEach(id => {
    adjustments.set(id, {
      workerId: id,
      isPresent: true,
      boxesPerHourOverride: null,
      defectRateOverride: null,
    });
  });
  
  return {
    workerAdjustments: adjustments,
    hoursRemaining,
    includeOvertime: false,
    globalSpeedModifier: 0,
    globalDefectModifier: 0,
  };
}
