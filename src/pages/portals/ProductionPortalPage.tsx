/**
 * PRODUCTION PORTAL PAGE
 * 
 * Office-based manufacturing OS with:
 * - Office selection
 * - Daily KPI dashboard
 * - Batch management
 * - Worker management  
 * - Tools inventory
 * - Activity history
 */

import { useState } from 'react';
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
} from '@/hooks/useProductionPortal';
import {
  ProductionKPICards,
  WorkerManagement,
  DailyBatchEntry,
  ToolsInventory,
  ProductionHistoryPanel,
  VariancePanel,
  DayClosePanel,
  WorkerAttendance,
  CommunicationsLog,
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  active: { label: 'Active', color: 'bg-emerald-100 text-emerald-800', icon: <CheckCircle className="h-3 w-3" /> },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-800', icon: null },
  maintenance: { label: 'Maintenance', color: 'bg-amber-100 text-amber-800', icon: <AlertTriangle className="h-3 w-3" /> },
};

export default function ProductionPortalPage() {
  const navigate = useNavigate();
  const { data: offices = [], isLoading: officesLoading } = useProductionOffices();
  const [selectedOfficeId, setSelectedOfficeId] = useState<string>('');
  
  const selectedOffice = offices.find(o => o.id === selectedOfficeId);
  const { data: kpis, isLoading: kpisLoading } = useDailyKPIs(selectedOfficeId);

  // Auto-select first office when loaded
  if (offices.length > 0 && !selectedOfficeId) {
    setSelectedOfficeId(offices[0].id);
  }

  const activeOffices = offices.filter(o => o.active !== false);

  return (
    <EnhancedPortalLayout
      title="Production Portal"
      subtitle="Manufacturing operations & output tracking"
      portalIcon={<Factory className="h-4 w-4 text-primary-foreground" />}
      quickActions={[
        { label: 'All Offices', href: '/portals/production/offices' },
        { label: 'Reports', href: '/portals/production/reports' },
      ]}
    >
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
          {/* Daily KPIs */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Factory className="h-5 w-5" />
                Today's Production — {format(new Date(), 'EEEE, MMMM d')}
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
                isDayClosed: false,
              }} 
              isLoading={kpisLoading}
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
                  <DayClosePanel officeId={selectedOfficeId} isAdmin={true} />
                  <VariancePanel officeId={selectedOfficeId} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="attendance">
              <WorkerAttendance officeId={selectedOfficeId} isDayLocked={kpis?.isDayClosed} />
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
              <ProductionHistoryPanel officeId={selectedOfficeId} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </EnhancedPortalLayout>
  );
}
