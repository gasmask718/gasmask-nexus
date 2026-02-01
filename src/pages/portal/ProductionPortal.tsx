/**
 * PRODUCTION WORKER PORTAL (READ-ONLY VIEW)
 * 
 * Simplified view for production workers to see:
 * - Today's progress and targets
 * - Assigned batches
 * - QC notes
 * 
 * Workers CANNOT edit batches, inputs, or outputs.
 * All editing is done via the Manufacturing OS (/portals/production).
 */

import { Factory, ClipboardList, AlertTriangle, Eye, Lock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PortalLayout from '@/components/portal/PortalLayout';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';

// Mock data - in real app this would come from useProductionPortal hooks
const todayBatches = [
  { id: 'B-001', product: 'GasMask Tubes', target: 500, completed: 320, status: 'in_progress' },
  { id: 'B-002', product: 'Hot Mama Boxes', target: 200, completed: 200, status: 'complete' },
  { id: 'B-003', product: 'Grabba R Us', target: 150, completed: 0, status: 'pending' },
];

const qcNotes = [
  { batch: 'B-002', result: 'passed', notes: 'All units meet quality standards', date: '10:30 AM' },
  { batch: 'B-001', result: 'review', notes: '5 units set aside for review', date: '9:15 AM' },
];

export default function ProductionPortal() {
  const { data: profileData } = useCurrentUserProfile();
  const productionProfile = profileData?.roleProfile as any;
  const userRole = profileData?.profile?.primary_role;
  const isManager = ['admin', 'ceo', 'production'].includes(userRole || '');

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      roller: 'Roller',
      packager: 'Packager',
      qc: 'Quality Control',
      supervisor: 'Supervisor',
      packer: 'Packer',
      shredder: 'Shredder',
      machine_operator: 'Machine Operator',
      laborer: 'Laborer',
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
                This is a <strong>read-only view</strong> for production workers.
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

        {/* Stats (Read-Only) */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-muted">
            <CardHeader className="pb-2">
              <CardDescription>Today's Target</CardDescription>
              <CardTitle className="text-3xl">850</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-sm text-muted-foreground">Units to produce</span>
            </CardContent>
          </Card>
          <Card className="border-muted">
            <CardHeader className="pb-2">
              <CardDescription>Completed</CardDescription>
              <CardTitle className="text-3xl text-emerald-600">520</CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={61} className="h-2" />
            </CardContent>
          </Card>
          <Card className="border-muted">
            <CardHeader className="pb-2">
              <CardDescription>QC Issues</CardDescription>
              <CardTitle className="text-3xl text-amber-600">5</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-sm text-muted-foreground">Units under review</span>
            </CardContent>
          </Card>
        </div>

        {/* Assigned Batches (Read-Only) */}
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
            <div className="space-y-4">
              {todayBatches.map((batch) => (
                <div key={batch.id} className="p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-medium">{batch.product}</p>
                      <p className="text-sm text-muted-foreground">Batch {batch.id}</p>
                    </div>
                    <Badge variant={
                      batch.status === 'complete' ? 'default' :
                      batch.status === 'in_progress' ? 'secondary' : 'outline'
                    }>
                      {batch.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{batch.completed} / {batch.target}</span>
                    </div>
                    <Progress value={(batch.completed / batch.target) * 100} className="h-2" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* QC Notes (Read-Only) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-primary" />
                QC Notes
              </CardTitle>
              <Badge variant="outline" className="text-muted-foreground">
                <Eye className="h-3 w-3 mr-1" />
                View Only
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {qcNotes.map((note, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono">{note.batch}</TableCell>
                    <TableCell>
                      <Badge variant={note.result === 'passed' ? 'default' : 'secondary'}>
                        {note.result}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{note.notes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Manager CTA */}
        {isManager && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Need to manage production?</h3>
                  <p className="text-sm text-muted-foreground">
                    Use the Manufacturing OS to create batches, record outputs, and close days.
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