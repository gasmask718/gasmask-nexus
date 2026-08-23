/**
 * PRODUCTION PORTAL PAGE (MANUFACTURING OS)
 * 
 * The authoritative Production Portal for office managers.
 * - Office selection
 * - Daily KPI dashboard with day status
 * - First-time wizard for new managers
 * - Daily checklist enforcement
 * - Batch management
 * - Worker management & attendance
 * - Tools inventory
 * - Variance tracking
 * - Day closeouts
 * - Activity history
 * - Training mode
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { EnhancedPortalLayout } from '@/components/portal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  useProductionOffices, 
  useDailyKPIs,
  useDailyCloseout,
  useTodayBatches,
  useCloseDay,
  useMyOfficeAssignments,
} from '@/hooks/useProductionPortal';
import {
  ProductionKPICards,
  WorkerManagement,
  DailyBatchEntry,
  ToolsInventory,
  ProductionHistoryPanel,
  BatchHistoryPanel,
  VariancePanel,
  DayClosePanel,
  WorkerAttendance,
  CommunicationsLog,
  FirstTimeWizard,
  DailyChecklist,
  TrainingModeBanner,
  TrainingModeToggle,
  ActiveBatchBanner,
  WorkerPerformance,
  DailyCycleTimeSummary,
  StaffingForecast,
  DailyCommandView,
  RawMaterialIntake,
  InventoryPipeline,
  CostBreakdownPanel,
  MarginAnalytics,
  SubmissionApprovalQueue,
  SupplyPredictionPanel,
  LeadTimeConfig,
  ProductionRBACGate,
  WorkerPayrollAdmin,
  RawAllocationPanel,
  MaterialConsumptionPanel,
  EquipmentAssignmentPanel,
  DailyExecutionDashboard,
  SupervisorScorecard,
  BrandYieldAnalyticsPanel,
  ShipmentsPanel,
  MaterialBalanceCard,
  ProductionLogsTable,
} from '@/components/production';
import { WorkerTaskTimer } from '@/components/production/WorkerTaskTimer';
import { LaborEfficiencyPanel } from '@/components/production/LaborEfficiencyPanel';
import { usePendingSubmissionCount } from '@/hooks/useWorkerSubmissions';
import { useProductionRBAC } from '@/hooks/useProductionRBAC';
import { 
  Factory, 
  Building2, 
  Boxes, 
  Users, 
  Wrench, 
  History,
  MapPin,
  Clock,
  CheckCircle,
  AlertTriangle,
  MessageSquare,
  Scale,
  Settings,
  UserPlus,
  Target,
  Activity,
  Package,
  DollarSign,
  ClipboardCheck,
  Brain,
  Wallet,
  Timer,
  Leaf,
  BarChart3,
  Award,
  Truck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useTranslation } from '@/hooks/useTranslation';

/** Renders a label; in ES learn-mode, shows the English string as a small subtitle. */
function BilingualLabel({ tKey, en }: { tKey: string; en: string }) {
  const { t, language } = useTranslation();
  const translated = t(tKey);
  if (language === 'es' && translated !== en) {
    return (
      <span className="flex flex-col leading-tight items-start">
        <span>{translated}</span>
        <span className="text-[9px] opacity-60">{en}</span>
      </span>
    );
  }
  return <span>{translated}</span>;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  active: { label: 'Active', color: 'bg-emerald-100 text-emerald-800', icon: <CheckCircle className="h-3 w-3" /> },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-800', icon: null },
  maintenance: { label: 'Maintenance', color: 'bg-amber-100 text-amber-800', icon: <AlertTriangle className="h-3 w-3" /> },
};

// Local storage key for tracking wizard completion
const WIZARD_COMPLETE_KEY = 'production-wizard-complete';

export default function ProductionPortalPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: offices = [], isLoading: officesLoading } = useProductionOffices();
  const [selectedOfficeId, setSelectedOfficeId] = useState<string>('');
  const [isTrainingMode, setIsTrainingMode] = useState(false);
  const [wizardDismissed, setWizardDismissed] = useState(false);
  const [varianceAcknowledged, setVarianceAcknowledged] = useState(false);
  
  const selectedOffice = offices.find(o => o.id === selectedOfficeId);
  const { data: kpis, isLoading: kpisLoading } = useDailyKPIs(selectedOfficeId);
  const { data: closeout } = useDailyCloseout(selectedOfficeId);
  const { data: batches = [] } = useTodayBatches(selectedOfficeId);
  const closeDay = useCloseDay();
  const { data: pendingSubmissionCount = 0 } = usePendingSubmissionCount(selectedOfficeId);
  const rbac = useProductionRBAC();
  const { data: myAssignments = [] } = useMyOfficeAssignments();

  // Office leaders (production role with an assignment) only see their own
  // office(s). Core staff (admin tier) and unassigned managers see all.
  const isOfficeScoped = rbac.tier !== 'admin' && myAssignments.length > 0;
  const visibleOffices = isOfficeScoped
    ? offices.filter(o => myAssignments.some(a => a.office_id === o.id))
    : offices;
  const singleOffice = visibleOffices.length === 1;
  // Check if wizard was completed for this office
  useEffect(() => {
    if (selectedOfficeId) {
      const completedOffices = JSON.parse(localStorage.getItem(WIZARD_COMPLETE_KEY) || '[]');
      setWizardDismissed(completedOffices.includes(selectedOfficeId));
    }
  }, [selectedOfficeId]);

  // Auto-select first visible office when loaded (for an office leader this
  // is their assigned office — the selector is hidden below when there's one).
  useEffect(() => {
    if (visibleOffices.length > 0 && !visibleOffices.some(o => o.id === selectedOfficeId)) {
      setSelectedOfficeId(visibleOffices[0].id);
    }
  }, [visibleOffices, selectedOfficeId]);

  const handleWizardDismiss = () => {
    const completedOffices = JSON.parse(localStorage.getItem(WIZARD_COMPLETE_KEY) || '[]');
    if (!completedOffices.includes(selectedOfficeId)) {
      completedOffices.push(selectedOfficeId);
      localStorage.setItem(WIZARD_COMPLETE_KEY, JSON.stringify(completedOffices));
    }
    setWizardDismissed(true);
  };

  const handleCloseDay = async () => {
    if (!selectedOfficeId) return;
    await closeDay.mutateAsync({ 
      officeId: selectedOfficeId,
      summary: {
        totalBoxes: kpis?.totalBoxes || 0,
        totalTobaccoLbs: kpis?.tobaccoUsed || 0,
        totalTubesUsed: kpis?.tubesUsed || 0,
        totalDefects: kpis?.totalDefects || 0,
        varianceSummary: {
          tubes: kpis?.tubesVariance || 0,
        },
      },
    });
  };

  // Derive checklist state from actual data
  const hasBatch = batches.length > 0;
  const hasOutput = batches.some(b => (b.boxes_produced || 0) > 0);
  const isDayClosed = closeout?.is_locked || kpis?.isDayClosed || false;
  const varianceAmount = kpis?.tubesVariance || 0;

  // Show wizard if not dismissed and office is selected
  const showWizard = selectedOfficeId && !wizardDismissed && !isDayClosed;

  const activeOffices = visibleOffices.filter(o => o.active !== false);

  return (
    <EnhancedPortalLayout
      title={t('production.title')}
      subtitle={t('production.subtitle')}
      portalIcon={<Factory className="h-4 w-4 text-primary-foreground" />}
      quickActions={[
        { label: 'All Offices', href: '/portals/production/offices' },
        { label: t('production.staff'), href: '/portals/production/staff' },
        { label: 'Reports', href: '/portals/production/war-room' },
      ]}
    >
      {/* Training Mode Banner */}
      <TrainingModeBanner 
        isTrainingMode={isTrainingMode}
        onToggle={setIsTrainingMode}
      />

      {/* Office Selector */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">{t('production.select_office')}</p>
                {singleOffice ? (
                  <p className="text-lg font-semibold mt-1">{visibleOffices[0].name}</p>
                ) : (
                <Select
                  value={selectedOfficeId}
                  onValueChange={setSelectedOfficeId}
                >
                  <SelectTrigger className="w-[280px] mt-1">
                    <SelectValue placeholder={t('production.choose_office')} />
                  </SelectTrigger>
                  <SelectContent>
                    {activeOffices.map(office => {
                      const status = STATUS_CONFIG[office.status] || STATUS_CONFIG.active;
                      return (
                        <SelectItem key={office.id} value={office.id}>
                          <div className="flex items-center gap-2">
                            <span>{office.name}</span>
                            {office.status !== 'active' && (
                              <Badge className={cn('text-xs ml-2', status.color)}>
                                {status.label}
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                )}
              </div>
            </div>

            {selectedOffice && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  {selectedOffice.location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      <span>{selectedOffice.location}</span>
                    </div>
                  )}
                  {selectedOffice.operating_hours && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>
                        {(selectedOffice.operating_hours as any).start} - {(selectedOffice.operating_hours as any).end}
                      </span>
                    </div>
                  )}
                  <Badge className={cn(STATUS_CONFIG[selectedOffice.status]?.color)}>
                    {STATUS_CONFIG[selectedOffice.status]?.icon}
                    <span className="ml-1">{STATUS_CONFIG[selectedOffice.status]?.label}</span>
                  </Badge>
                </div>
                
                {/* Quick Actions — training mode lives here, out of the daily
                    entry view, so it can't be confused with real data. */}
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate('/portals/production/staff')}
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    {t('production.staff')}
                  </Button>
                  <TrainingModeToggle 
                    isTrainingMode={isTrainingMode}
                    onToggle={setIsTrainingMode}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {!selectedOfficeId ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Building2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">Select an Office</h3>
            <p className="text-muted-foreground">
              Choose a production office to view its dashboard, manage batches, and track output.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* First Time Wizard */}
          {showWizard && (
            <FirstTimeWizard
              officeId={selectedOfficeId}
              officeName={selectedOffice?.name || 'Production Office'}
              hasBatch={hasBatch}
              hasOutput={hasOutput}
              isClosed={isDayClosed}
              onDismiss={handleWizardDismiss}
            />
          )}

          {/* Active Batch Banner */}
          <ActiveBatchBanner 
            batches={batches}
            onCreateBatch={() => {
              // Jump to the TODAY → Enter Output view, where batch creation lives
              const entryTab = document.querySelector('[value="entry"]') as HTMLElement;
              entryTab?.click();
            }}
          />

          {/* Daily KPIs */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Factory className="h-5 w-5" />
                {t('production.todays_production')} — {format(new Date(), 'EEEE, MMMM d')}
              </h2>
            </div>
            <ProductionKPICards 
              kpis={kpis || {
                totalBoxes: 0,
                boxesByBrand: {},
                tobaccoUsed: 0,
                tubesIssued: 0,
                tubesUsed: 0,
                tubesVariance: 0,
                efficiencyPct: 0,
                workersPresent: 0,
                toolsOperational: 0,
                toolsTotal: 0,
                totalDefects: 0,
                defectRate: 0,
                isDayClosed: isDayClosed,
              }} 
              isLoading={kpisLoading}
              closedAt={closeout?.closed_at ? format(new Date(closeout.closed_at), 'h:mm a') : undefined}
            />
          </div>

          {/* Grouped sections — 5 top-level tabs, everything else nested.
              Everyone lands on TODAY → Enter Output: the office leader's whole
              daily job (enter numbers, see variance, see what they hold, close
              the day) on one screen with no tab-hunting. */}
          <Tabs key={rbac.tier} defaultValue="today" className="space-y-4">
            <TabsList className="flex flex-wrap gap-1 h-auto">
              <TabsTrigger value="today" className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4" />
                <span className="hidden sm:inline"><BilingualLabel tKey="production.section.today" en="Today" /></span>
              </TabsTrigger>
              <TabsTrigger value="people" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline"><BilingualLabel tKey="production.section.people" en="People" /></span>
              </TabsTrigger>
              <TabsTrigger value="materials" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                <span className="hidden sm:inline"><BilingualLabel tKey="production.section.materials" en="Materials" /></span>
              </TabsTrigger>
              <TabsTrigger value="insight" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline"><BilingualLabel tKey="production.section.insight" en="Insight" /></span>
              </TabsTrigger>
              <TabsTrigger value="messages" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline"><BilingualLabel tKey="production.section.messages" en="Messages" /></span>
              </TabsTrigger>
            </TabsList>

            {/* ── TODAY: enter output · command · submissions · close day ── */}
            <TabsContent value="today">
              <Tabs defaultValue="entry" className="space-y-4">
                <TabsList className="h-auto">
                  <TabsTrigger value="entry" className="flex items-center gap-2">
                    <Boxes className="h-4 w-4" />
                    <BilingualLabel tKey="production.enter_output" en="Enter Output" />
                  </TabsTrigger>
                  <TabsTrigger value="command" className="flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    <BilingualLabel tKey="production.command" en="Command" />
                  </TabsTrigger>
                  {rbac.canApproveSubmissions && (
                    <TabsTrigger value="submissions" className="flex items-center gap-2 relative">
                      <ClipboardCheck className="h-4 w-4" />
                      <BilingualLabel tKey="production.submissions" en="Submissions" />
                      {pendingSubmissionCount > 0 && (
                        <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                          {pendingSubmissionCount}
                        </Badge>
                      )}
                    </TabsTrigger>
                  )}
                </TabsList>

                {/* The office leader's landing view — one screen, no tabs:
                    today's batch entry, checklist/close day, variance, and
                    what the office still holds. */}
                <TabsContent value="entry">
                  <div className="grid lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2">
                      <DailyBatchEntry officeId={selectedOfficeId} />
                    </div>
                    <div className="space-y-4">
                      <DailyChecklist
                        hasBatch={hasBatch}
                        hasOutput={hasOutput}
                        hasVarianceReview={varianceAcknowledged || varianceAmount === 0}
                        varianceAmount={varianceAmount}
                        boxCount={kpis?.totalBoxes || 0}
                        onCloseDay={handleCloseDay}
                        isClosing={closeDay.isPending}
                        isDayClosed={isDayClosed}
                      />
                      <VariancePanel officeId={selectedOfficeId} />
                      <MaterialBalanceCard officeId={selectedOfficeId} />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="command">
                  <DailyCommandView officeId={selectedOfficeId} targetBoxes={selectedOffice?.daily_box_goal || 100} />
                </TabsContent>

                <TabsContent value="submissions">
                  <ProductionRBACGate currentTier={rbac.tier} requiredTier="manager" resourceName="Submission Approvals">
                    <SubmissionApprovalQueue officeId={selectedOfficeId} />
                  </ProductionRBACGate>
                </TabsContent>
              </Tabs>
            </TabsContent>

            {/* ── PEOPLE: workers · attendance · timer · performance · supervisor · payroll ── */}
            <TabsContent value="people">
              <Tabs defaultValue="workers" className="space-y-4">
                <TabsList className="flex flex-wrap h-auto">
                  <TabsTrigger value="workers" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <BilingualLabel tKey="production.workers" en="Workers" />
                  </TabsTrigger>
                  <TabsTrigger value="attendance" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <BilingualLabel tKey="production.attendance" en="Attendance" />
                  </TabsTrigger>
                  <TabsTrigger value="timer" className="flex items-center gap-2">
                    <Timer className="h-4 w-4" />
                    <BilingualLabel tKey="production.task_timer" en="Task Timer" />
                  </TabsTrigger>
                  <TabsTrigger value="performance" className="flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    <BilingualLabel tKey="production.performance" en="Performance" />
                  </TabsTrigger>
                  <TabsTrigger value="supervisor" className="flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    <BilingualLabel tKey="production.supervisor" en="Supervisor" />
                  </TabsTrigger>
                  {rbac.canManagePayroll && (
                    <TabsTrigger value="payroll" className="flex items-center gap-2">
                      <Wallet className="h-4 w-4" />
                      <BilingualLabel tKey="production.payroll" en="Payroll" />
                    </TabsTrigger>
                  )}
                </TabsList>

                <TabsContent value="workers">
                  <WorkerManagement officeId={selectedOfficeId} />
                </TabsContent>
                <TabsContent value="attendance">
                  <WorkerAttendance officeId={selectedOfficeId} isDayLocked={isDayClosed} />
                </TabsContent>
                <TabsContent value="timer">
                  <div className="grid lg:grid-cols-2 gap-4">
                    <WorkerTaskTimer officeId={selectedOfficeId} />
                    <LaborEfficiencyPanel officeId={selectedOfficeId} />
                  </div>
                </TabsContent>
                <TabsContent value="performance">
                  <div className="grid lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2">
                      <WorkerPerformance officeId={selectedOfficeId} />
                    </div>
                    <div className="space-y-4">
                      <DailyCycleTimeSummary batches={batches} officeId={selectedOfficeId} />
                      <StaffingForecast officeId={selectedOfficeId} />
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="supervisor">
                  <SupervisorScorecard officeId={selectedOfficeId} />
                </TabsContent>
                <TabsContent value="payroll">
                  <ProductionRBACGate currentTier={rbac.tier} requiredTier="manager" resourceName="Worker Payroll">
                    <WorkerPayrollAdmin officeId={selectedOfficeId} />
                  </ProductionRBACGate>
                </TabsContent>
              </Tabs>
            </TabsContent>

            {/* ── MATERIALS: inventory · consumption · shipments · equipment · tools ── */}
            <TabsContent value="materials">
              <Tabs defaultValue="inventory" className="space-y-4">
                <TabsList className="flex flex-wrap h-auto">
                  <TabsTrigger value="inventory" className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    <BilingualLabel tKey="production.inventory" en="Inventory" />
                  </TabsTrigger>
                  <TabsTrigger value="consumption" className="flex items-center gap-2">
                    <Leaf className="h-4 w-4" />
                    <BilingualLabel tKey="production.materials" en="Materials" />
                  </TabsTrigger>
                  <TabsTrigger value="shipments" className="flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    <BilingualLabel tKey="production.shipments" en="Shipments" />
                  </TabsTrigger>
                  <TabsTrigger value="equipment" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    <BilingualLabel tKey="production.equipment" en="Equipment" />
                  </TabsTrigger>
                  <TabsTrigger value="tools" className="flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    <BilingualLabel tKey="production.tools_tab" en="Tools" />
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="inventory">
                  <div className="space-y-4">
                    <RawAllocationPanel officeId={selectedOfficeId} />
                    <InventoryPipeline officeId={selectedOfficeId} />
                    <RawMaterialIntake officeId={selectedOfficeId} />
                  </div>
                </TabsContent>
                <TabsContent value="consumption">
                  <MaterialConsumptionPanel officeId={selectedOfficeId} />
                </TabsContent>
                <TabsContent value="shipments">
                  <ShipmentsPanel officeId={selectedOfficeId} />
                </TabsContent>
                <TabsContent value="equipment">
                  <EquipmentAssignmentPanel officeId={selectedOfficeId} />
                </TabsContent>
                <TabsContent value="tools">
                  <ToolsInventory officeId={selectedOfficeId} />
                </TabsContent>
              </Tabs>
            </TabsContent>

            {/* ── INSIGHT: logs · costs · yield · forecast · history · daily exec ──
                Costs/margins stay manager-gated; an office leader never sees
                cost per box or unit costs. */}
            <TabsContent value="insight">
              <Tabs defaultValue="logs" className="space-y-4">
                <TabsList className="flex flex-wrap h-auto">
                  <TabsTrigger value="logs" className="flex items-center gap-2">
                    <Boxes className="h-4 w-4" />
                    <BilingualLabel tKey="production.production_logs" en="Production Logs" />
                  </TabsTrigger>
                  {rbac.canViewCosts && (
                    <TabsTrigger value="costs" className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      <BilingualLabel tKey="production.costs" en="Costs" />
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="yield" className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    <BilingualLabel tKey="production.yield" en="Yield" />
                  </TabsTrigger>
                  {rbac.canViewForecasts && (
                    <TabsTrigger value="forecast" className="flex items-center gap-2">
                      <Brain className="h-4 w-4" />
                      <BilingualLabel tKey="production.ai_forecast" en="AI Forecast" />
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="history" className="flex items-center gap-2">
                    <History className="h-4 w-4" />
                    <BilingualLabel tKey="production.history" en="History" />
                  </TabsTrigger>
                  <TabsTrigger value="daily-exec" className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    <BilingualLabel tKey="production.daily_exec" en="Daily Exec" />
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="logs">
                  <ProductionLogsTable officeId={selectedOfficeId} />
                </TabsContent>
                <TabsContent value="costs">
                  <ProductionRBACGate currentTier={rbac.tier} requiredTier="manager" resourceName="Cost & Margin Analytics">
                    <div className="grid lg:grid-cols-3 gap-4">
                      <div className="lg:col-span-1">
                        <CostBreakdownPanel officeId={selectedOfficeId} />
                      </div>
                      <div className="lg:col-span-2">
                        <MarginAnalytics officeId={selectedOfficeId} />
                      </div>
                    </div>
                  </ProductionRBACGate>
                </TabsContent>
                <TabsContent value="yield">
                  <BrandYieldAnalyticsPanel officeId={selectedOfficeId} />
                </TabsContent>
                <TabsContent value="forecast">
                  <ProductionRBACGate currentTier={rbac.tier} requiredTier="manager" resourceName="AI Supply Forecast">
                    <div className="grid lg:grid-cols-2 gap-4">
                      <SupplyPredictionPanel officeId={selectedOfficeId} />
                      <LeadTimeConfig officeId={selectedOfficeId} />
                    </div>
                  </ProductionRBACGate>
                </TabsContent>
                <TabsContent value="history">
                  <div className="grid lg:grid-cols-2 gap-4">
                    <BatchHistoryPanel officeId={selectedOfficeId} />
                    <ProductionHistoryPanel officeId={selectedOfficeId} />
                  </div>
                </TabsContent>
                <TabsContent value="daily-exec">
                  <DailyExecutionDashboard officeId={selectedOfficeId} dailyGoal={(selectedOffice as any)?.daily_box_goal || 100} />
                </TabsContent>
              </Tabs>
            </TabsContent>

            {/* ── MESSAGES ── */}
            <TabsContent value="messages">
              <CommunicationsLog officeId={selectedOfficeId} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </EnhancedPortalLayout>
  );
}
