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
export { BatchCostHistoryPanel } from './BatchCostHistoryPanel';
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
export { ProductionEfficiencyPanel } from './ProductionEfficiencyPanel';
export { StaffingForecast } from './StaffingForecast';
export { DailyCommandView } from './DailyCommandView';

// Phase 1: Raw Material Intake + Inventory State Machine
export { RawMaterialIntake } from './RawMaterialIntake';
export { InventoryPipeline } from './InventoryPipeline';
export { RawAllocationPanel } from './RawAllocationPanel';
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

// Phase 6: Worker Pay System
export { WorkerPayDashboard } from './WorkerPayDashboard';
export { WorkerPayrollAdmin } from './WorkerPayrollAdmin';

// Soft Alert System
export * from './alerts';

// Scenario Planning (What-If Simulation)
export * from './scenario';

// Phase 7: Supplier Yield Intelligence
export { SupplierYieldRankingPanel } from './SupplierYieldRankingPanel';

// Phase 8: Sales Velocity Closed-Loop Engine
export { SalesVelocityPanel } from './SalesVelocityPanel';

// Phase 9: Production Governance Engines
export { OverrideAuditPanel } from './OverrideAuditPanel';
export { AlertHistoryPanel } from './AlertHistoryPanel';

// Phase 10: Worker Task Timer
export { WorkerTaskTimer } from './WorkerTaskTimer';
export { LaborEfficiencyPanel } from './LaborEfficiencyPanel';

// Phase 11: Profit Per Pound Intelligence
export { ProfitPerPoundPanel } from './ProfitPerPoundPanel';

// Brand Yield Analytics (Lbs → Boxes per brand over time)
export { BrandYieldAnalyticsPanel } from './BrandYieldAnalyticsPanel';

// Phase 12: Production Control Hardening
export { MaterialConsumptionPanel } from './MaterialConsumptionPanel';
export { EquipmentAssignmentPanel } from './EquipmentAssignmentPanel';
export { DailyExecutionDashboard } from './DailyExecutionDashboard';
export { SupervisorScorecard } from './SupervisorScorecard';
export { ShipmentsPanel } from './ShipmentsPanel';
