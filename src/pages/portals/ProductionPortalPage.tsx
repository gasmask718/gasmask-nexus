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
} from '@/components/production';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  active: { label: 'Active', color: 'bg-emerald-100 text-emerald-800', icon: <CheckCircle className="h-3 w-3" /> },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-800', icon: null },
  maintenance: { label: 'Maintenance', color: 'bg-amber-100 text-amber-800', icon: <AlertTriangle className="h-3 w-3" /> },
};

// Local storage key for tracking wizard completion
const WIZARD_COMPLETE_KEY = 'production-wizard-complete';

export default function ProductionPortalPage() {
  const navigate = useNavigate();
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

  // Check if wizard was completed for this office
  useEffect(() => {
    if (selectedOfficeId) {
      const completedOffices = JSON.parse(localStorage.getItem(WIZARD_COMPLETE_KEY) || '[]');
      setWizardDismissed(completedOffices.includes(selectedOfficeId));
    }
  }, [selectedOfficeId]);

  // Auto-select first office when loaded
  useEffect(() => {
    if (offices.length > 0 && !selectedOfficeId) {
      setSelectedOfficeId(offices[0].id);
    }
  }, [offices, selectedOfficeId]);

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

  const activeOffices = offices.filter(o => o.active !== false);

  return (
    <EnhancedPortalLayout
      title="Manufacturing OS"
      subtitle="Office production, variance, and daily closeouts"
      portalIcon={<Factory className="h-4 w-4 text-primary-foreground" />}
      quickActions={[
        { label: 'All Offices', href: '/portals/production/offices' },
        { label: 'Staff', href: '/portals/production/staff' },
        { label: 'Reports', href: '/portals/production/reports' },
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
                <p className="text-sm text-muted-foreground">Select Office</p>
                <Select
                  value={selectedOfficeId}
                  onValueChange={setSelectedOfficeId}
                >
                  <SelectTrigger className="w-[280px] mt-1">
                    <SelectValue placeholder="Choose an office..." />
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
                
                {/* Quick Actions */}
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate('/portals/production/staff')}
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Staff
                  </Button>
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
              // Navigate to batches tab and trigger create
              const batchesTab = document.querySelector('[value="batches"]') as HTMLElement;
              batchesTab?.click();
            }}
          />

          {/* Daily KPIs */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Factory className="h-5 w-5" />
                Today's Production — {format(new Date(), 'EEEE, MMMM d')}
              </h2>
              <TrainingModeToggle 
                isTrainingMode={isTrainingMode}
                onToggle={setIsTrainingMode}
              />
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

          {/* Tabbed Sections */}
          <Tabs defaultValue="batches" className="space-y-4">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="batches" className="flex items-center gap-2">
                <Boxes className="h-4 w-4" />
                <span className="hidden sm:inline">Batches</span>
              </TabsTrigger>
              <TabsTrigger value="attendance" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span className="hidden sm:inline">Attendance</span>
              </TabsTrigger>
              <TabsTrigger value="workers" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Workers</span>
              </TabsTrigger>
              <TabsTrigger value="tools" className="flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                <span className="hidden sm:inline">Tools</span>
              </TabsTrigger>
              <TabsTrigger value="messages" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Messages</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">History</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="batches">
              <div className="grid lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  <DailyBatchEntry officeId={selectedOfficeId} />
                </div>
                <div className="space-y-4">
                  {/* Daily Checklist replaces simple close panel */}
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
                </div>
              </div>
            </TabsContent>

            <TabsContent value="attendance">
              <WorkerAttendance officeId={selectedOfficeId} isDayLocked={isDayClosed} />
            </TabsContent>

            <TabsContent value="workers">
              <WorkerManagement officeId={selectedOfficeId} />
            </TabsContent>

            <TabsContent value="tools">
              <ToolsInventory officeId={selectedOfficeId} />
            </TabsContent>

            <TabsContent value="messages">
              <CommunicationsLog officeId={selectedOfficeId} />
            </TabsContent>

            <TabsContent value="history">
              <div className="grid lg:grid-cols-2 gap-4">
                <BatchHistoryPanel officeId={selectedOfficeId} />
                <ProductionHistoryPanel officeId={selectedOfficeId} />
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </EnhancedPortalLayout>
  );
}
