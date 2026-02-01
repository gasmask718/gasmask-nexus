/**
 * PRODUCTION PORTAL COMPONENTS
 * 
 * Manufacturing OS for office-based production tracking.
 */

export { ProductionKPICards } from './ProductionKPICards';
export { WorkerManagement } from './WorkerManagement';
export { DailyBatchEntry } from './DailyBatchEntry';
export { ToolsInventory } from './ToolsInventory';
export { ProductionHistoryPanel } from './ProductionHistory';
export { BatchHistoryPanel } from './BatchHistoryPanel';
export { VariancePanel } from './VariancePanel';
export { DayClosePanel } from './DayClosePanel';
export { WorkerAttendance } from './WorkerAttendance';
export { CommunicationsLog } from './CommunicationsLog';
export { FirstTimeWizard } from './FirstTimeWizard';
export { DailyChecklist } from './DailyChecklist';
export { TrainingModeBanner, TrainingModeToggle } from './TrainingMode';
export { ActiveBatchBanner } from './ActiveBatchBanner';
export { WorkerPerformance } from './WorkerPerformance';
export { CycleTimePanel, DailyCycleTimeSummary } from './CycleTimePanel';
export { StaffingForecast } from './StaffingForecast';
export { DailyCommandView } from './DailyCommandView';

// Soft Alert System
export * from './alerts';

// Scenario Planning (What-If Simulation)
export * from './scenario';
