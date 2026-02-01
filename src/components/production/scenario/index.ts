/**
 * SCENARIO PLANNING MODULE
 * 
 * Read-only what-if simulation layer for production planning.
 * All data is session-only, non-persistent, advisory only.
 */

export * from './types';
export { useScenarioSimulation } from './useScenarioSimulation';
export { ScenarioToggle, ScenarioBanner, SimulatedBadge } from './ScenarioToggle';
export { ScenarioControlsPanel } from './ScenarioControlsPanel';
export { ScenarioOutputPanel } from './ScenarioOutputPanel';
export { WorkerImpactPanel } from './WorkerImpactPanel';
export { ScenarioComparison } from './ScenarioComparison';
