/**
 * PRODUCTION WORKER PORTAL (READ-ONLY VIEW)
 * 
 * Simplified view for production workers to see:
 * - Today's progress and targets (from real batches)
 * - Assigned batches
 * - QC notes
 * - Controlled submission form (pending_review)
 * 
 * Workers CANNOT edit batches, inputs, or outputs.
 * All editing is done via the Manufacturing OS (/portals/production).
 */

import { Factory, ClipboardList, AlertTriangle, Eye, Lock, ArrowRight, Send, DollarSign, Flame, User, CheckSquare } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PortalLayout from '@/components/portal/PortalLayout';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { useProductionOffices, useTodayBatches, useDailyKPIs } from '@/hooks/useProductionPortal';
import { useWorkerSubmissions } from '@/hooks/useWorkerSubmissions';
import { WorkerSubmissionForm } from '@/components/production/WorkerSubmissionForm';
import { WorkerPayDashboard } from '@/components/production/WorkerPayDashboard';
import { ConversionIntelligencePanel } from '@/components/production/ConversionIntelligencePanel';
import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';

export default function ProductionPortal() {
  const { data: profileData } = useCurrentUserProfile();
  const { data: offices = [] } = useProductionOffices();
  const [selectedOfficeId, setSelectedOfficeId] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  // OpsBottomNav subpaths → tab values. Tabs without a nav path (submit, my-logs,
  // my-pay, conversion) stay reachable in-page and don't change the URL.
  const SUBPATH_TO_TAB: Record<string, string> = {
    '': 'batches',
    batches: 'batches',
    quality: 'quality',
    profile: 'profile',
  };
  const TAB_TO_PATH: Record<string, string> = {
    batches: '/portal/production',
    quality: '/portal/production/quality',
    profile: '/portal/production/profile',
  };
  const subpath = location.pathname.split('/')[3] || '';
  const activeTab = SUBPATH_TO_TAB[subpath] ?? 'batches';
  const handleTabChange = (value: string) => {
    const path = TAB_TO_PATH[value];
    if (path && path !== location.pathname) navigate(path);
  };

  const productionProfile = profileData?.roleProfile as any;
  const userRole = profileData?.profile?.primary_role;
  const isManager = ['admin', 'ceo', 'production'].includes(userRole || '');

  // Auto-select first office
  useEffect(() => {
    if (offices.length > 0 && !selectedOfficeId) {
      setSelectedOfficeId(offices[0].id);
    }
  }, [offices, selectedOfficeId]);

  const { data: batches = [] } = useTodayBatches(selectedOfficeId);
  const { data: kpis } = useDailyKPIs(selectedOfficeId);
  const { data: mySubmissions = [], isLoading: subsLoading } = useWorkerSubmissions(selectedOfficeId);

  const todayTarget = batches.reduce((sum, b) => sum + (b.tubes_total || 0), 0);
  const todayCompleted = batches.reduce((sum, b) => sum + (b.boxes_produced || 0), 0);
  const progressPct = todayTarget > 0 ? Math.round((todayCompleted / todayTarget) * 100) : 0;

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      roller: 'Roller', packager: 'Packager', qc: 'Quality Control',
      supervisor: 'Supervisor', packer: 'Packer', shredder: 'Shredder',
      machine_operator: 'Machine Operator', laborer: 'Laborer',
    };
    return labels[role] || role;
  };

  return (
    <PortalLayout title="Worker View">
      <div className="space-y-6">
        {/* Read-Only Banner */}
        <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
          <Eye className="h-4 w-4 text-amber-600" />
          <AlertDescription className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="h-3 w-3 text-amber-600" />
              <span className="text-amber-800 dark:text-amber-200">
                This is a <strong>read-only view</strong>. You may submit production logs for manager approval.
              </span>
            </div>
            {isManager && (
              <Button asChild variant="outline" size="sm">
                <Link to="/portals/production">
                  Open Manufacturing OS
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            )}
          </AlertDescription>
        </Alert>

        {/* Office Selector */}
        {offices.length > 1 && (
          <Select value={selectedOfficeId} onValueChange={setSelectedOfficeId}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select office..." />
            </SelectTrigger>
            <SelectContent>
              {offices.filter(o => o.active !== false).map(office => (
                <SelectItem key={office.id} value={office.id}>{office.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Worker Info */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
                <Factory className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{profileData?.profile?.full_name || 'Production Worker'}</h2>
                <p className="text-muted-foreground">
                  {productionProfile?.role && getRoleLabel(productionProfile.role)}
                  {productionProfile?.station && ` • Station ${productionProfile.station}`}
                </p>
                <Badge variant="default">{productionProfile?.shift || 'Day'} Shift</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats (Real Data) */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-muted">
            <CardHeader className="pb-2">
              <CardDescription>Today's Target</CardDescription>
              <CardTitle className="text-3xl">{todayTarget || '—'}</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-sm text-muted-foreground">Units to produce</span>
            </CardContent>
          </Card>
          <Card className="border-muted">
            <CardHeader className="pb-2">
              <CardDescription>Completed</CardDescription>
              <CardTitle className="text-3xl">{todayCompleted}</CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={progressPct} className="h-2" />
            </CardContent>
          </Card>
          <Card className="border-muted">
            <CardHeader className="pb-2">
              <CardDescription>My Submissions</CardDescription>
              <CardTitle className="text-3xl">{!selectedOfficeId || subsLoading ? '—' : mySubmissions.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-sm text-muted-foreground">
                {!selectedOfficeId || subsLoading ? 'Loading…' : `${mySubmissions.filter(s => s.status === 'pending_review').length} pending review`}
              </span>
            </CardContent>
          </Card>
        </div>

        {/* Tabbed: Batches / Submit / My Logs */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="batches" className="flex items-center gap-1">
              <Factory className="h-3 w-3" /> Batches
            </TabsTrigger>
            <TabsTrigger value="submit" className="flex items-center gap-1">
              <Send className="h-3 w-3" /> Submit Log
            </TabsTrigger>
            <TabsTrigger value="my-logs" className="flex items-center gap-1">
              <ClipboardList className="h-3 w-3" /> My Logs
            </TabsTrigger>
            <TabsTrigger value="my-pay" className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" /> My Pay
            </TabsTrigger>
            <TabsTrigger value="quality" className="flex items-center gap-1">
              <CheckSquare className="h-3 w-3" /> Quality
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center gap-1">
              <User className="h-3 w-3" /> Me
            </TabsTrigger>
            {isManager && (
              <TabsTrigger value="conversion" className="flex items-center gap-1">
                <Flame className="h-3 w-3" /> Conversion
              </TabsTrigger>
            )}
          </TabsList>

          {/* Assigned Batches (Read-Only) */}
          <TabsContent value="batches">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Factory className="h-5 w-5 text-primary" />
                      Today's Batches
                    </CardTitle>
                    <CardDescription>Production batches assigned to your office</CardDescription>
                  </div>
                  <Badge variant="outline" className="text-muted-foreground">
                    <Eye className="h-3 w-3 mr-1" />
                    View Only
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {batches.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No batches assigned today.</p>
                ) : (
                  <div className="space-y-4">
                    {batches.map((batch) => {
                      const target = batch.tubes_total || 0;
                      const completed = batch.boxes_produced || 0;
                      const pct = target > 0 ? Math.round((completed / target) * 100) : 0;
                      return (
                        <div key={batch.id} className="p-4 rounded-lg border bg-muted/30">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="font-medium">{batch.brand}</p>
                              <p className="text-sm text-muted-foreground font-mono">{batch.id.slice(0, 8)}</p>
                            </div>
                            <Badge variant={
                              batch.inventory_state === 'boxed' || batch.inventory_state === 'approved' ? 'default' :
                              batch.inventory_state === 'in_production' ? 'secondary' : 'outline'
                            }>
                              {batch.inventory_state || batch.status}
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Progress</span>
                              <span className="font-medium">{completed} / {target}</span>
                            </div>
                            <Progress value={pct} className="h-2" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Submit Production Log */}
          <TabsContent value="submit">
            <WorkerSubmissionForm officeId={selectedOfficeId} workerId={productionProfile?.id} />
          </TabsContent>

          {/* My Submission History */}
          <TabsContent value="my-logs">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  My Submissions
                </CardTitle>
                <CardDescription>Your recent production log submissions and their status</CardDescription>
              </CardHeader>
              <CardContent>
                {mySubmissions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No submissions yet today.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Batch</TableHead>
                        <TableHead className="text-right">Lbs</TableHead>
                        <TableHead className="text-right">Tubes</TableHead>
                        <TableHead className="text-right">Boxes</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mySubmissions.map((sub) => (
                        <TableRow key={sub.id}>
                          <TableCell className="font-mono text-sm">{sub.batch?.brand || '—'}</TableCell>
                          <TableCell className="text-right">{sub.lbs_processed}</TableCell>
                          <TableCell className="text-right">{sub.tubes_produced}</TableCell>
                          <TableCell className="text-right font-medium">{sub.boxes_packed}</TableCell>
                          <TableCell>
                            <Badge variant={
                              sub.status === 'approved' ? 'default' :
                              sub.status === 'rejected' ? 'destructive' : 'outline'
                            }>
                              {sub.status.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(sub.created_at), 'h:mm a')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* My Pay Dashboard */}
          <TabsContent value="my-pay">
            <WorkerPayDashboard workerId={productionProfile?.id} />
          </TabsContent>

          {/* Quality — honest empty state: worker-facing QC history is not wired yet */}
          <TabsContent value="quality">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckSquare className="h-5 w-5 text-primary" />
                  Quality Control
                </CardTitle>
                <CardDescription>QC checkpoints and results for your batches</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground py-8">
                  QC checkpoints are recorded by managers in the Manufacturing OS. A worker-facing
                  QC history will appear here once that feed is wired up — there is nothing to show today.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Profile — real worker record, read-only */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  My Profile
                </CardTitle>
                <CardDescription>Your worker record as managers see it</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3 max-w-md">
                  <div className="flex justify-between gap-4">
                    <dt className="text-sm text-muted-foreground">Name</dt>
                    <dd className="text-sm font-medium">{profileData?.profile?.full_name || '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-sm text-muted-foreground">Role</dt>
                    <dd className="text-sm font-medium">
                      {productionProfile?.role ? getRoleLabel(productionProfile.role) : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-sm text-muted-foreground">Station</dt>
                    <dd className="text-sm font-medium">{productionProfile?.station || '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-sm text-muted-foreground">Shift</dt>
                    <dd className="text-sm font-medium">{productionProfile?.shift || 'Day'}</dd>
                  </div>
                </dl>
                <p className="text-xs text-muted-foreground mt-6">
                  Profile editing isn't available here — ask your manager to update your worker record.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Conversion Intelligence (Manager/Admin only) */}
          {isManager && (
            <TabsContent value="conversion">
              <ConversionIntelligencePanel />
            </TabsContent>
          )}
        </Tabs>

        {/* Manager CTA */}
        {isManager && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Need to manage production?</h3>
                  <p className="text-sm text-muted-foreground">
                    Use the Manufacturing OS to create batches, approve submissions, and close days.
                  </p>
                </div>
                <Button asChild>
                  <Link to="/portals/production">
                    Open Manufacturing OS
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PortalLayout>
  );
}
