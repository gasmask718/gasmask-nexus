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

// Phase 1: Raw Material Intake + Inventory State Machine
export { RawMaterialIntake } from './RawMaterialIntake';
export { InventoryPipeline } from './InventoryPipeline';
export { BatchStateControls } from './BatchStateControls';

// Phase 2: Cost Engine + Margin Tracking
export { CostBreakdownPanel } from './CostBreakdownPanel';
export { MarginAnalytics } from './MarginAnalytics';

// Phase 3: Worker Submission Flow
export { WorkerSubmissionForm } from './WorkerSubmissionForm';
export { SubmissionApprovalQueue } from './SubmissionApprovalQueue';

// Phase 4: AI Supply Prediction
export { SupplyPredictionPanel } from './SupplyPredictionPanel';
export { LeadTimeConfig } from './LeadTimeConfig';

// Phase 5: Production RBAC
export { ProductionRBACGate } from './ProductionRBACGate';

// Soft Alert System
export * from './alerts';

// Scenario Planning (What-If Simulation)
export * from './scenario';
