import { Factory, ClipboardList, CheckSquare, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PortalLayout from '@/components/portal/PortalLayout';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';

// Mock data
const todayBatches = [
  { id: 'B-001', product: 'GasMask Tubes', target: 500, completed: 320, status: 'in_progress' },
  { id: 'B-002', product: 'Hot Mama Boxes', target: 200, completed: 200, status: 'complete' },
  { id: 'B-003', product: 'Grabba R Us', target: 150, completed: 0, status: 'pending' },
];

const todayTasks = [
  { id: 1, task: 'Roll 500 GasMask Tubes', priority: 'high', status: 'in_progress' },
  { id: 2, task: 'QC Check - Batch B-002', priority: 'medium', status: 'pending' },
  { id: 3, task: 'Package completed boxes', priority: 'low', status: 'pending' },
];

const qcNotes = [
  { batch: 'B-002', result: 'passed', notes: 'All units meet quality standards', date: '10:30 AM' },
  { batch: 'B-001', result: 'review', notes: '5 units set aside for review', date: '9:15 AM' },
];

export default function ProductionPortal() {
  const { data: profileData } = useCurrentUserProfile();
  const productionProfile = profileData?.roleProfile as any;

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      roller: 'Roller',
      packager: 'Packager',
      qc: 'Quality Control',
      supervisor: 'Supervisor'
    };
    return labels[role] || role;
  };

  return (
    <PortalLayout title="Production Portal">
      <div className="space-y-6">
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

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Today's Target</CardDescription>
              <CardTitle className="text-3xl">850</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-sm text-muted-foreground">Units to produce</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Completed</CardDescription>
              <CardTitle className="text-3xl text-green-500">520</CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={61} className="h-2" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>QC Issues</CardDescription>
              <CardTitle className="text-3xl text-yellow-500">5</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-sm text-muted-foreground">Units under review</span>
            </CardContent>
          </Card>
        </div>

        {/* Assigned Batches */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Factory className="h-5 w-5 text-primary" />
              Today's Batches
            </CardTitle>
            <CardDescription>Production batches assigned to you</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {todayBatches.map((batch) => (
                <div key={batch.id} className="p-4 rounded-lg border">
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

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Tasks */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Today's Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {todayTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg border">
                    <Button variant="ghost" size="icon" className="shrink-0">
                      <CheckSquare className="h-5 w-5" />
                    </Button>
                    <div className="flex-1">
                      <p className="font-medium">{task.task}</p>
                    </div>
                    <Badge variant={
                      task.priority === 'high' ? 'destructive' :
                      task.priority === 'medium' ? 'secondary' : 'outline'
                    }>
                      {task.priority}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* QC Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-primary" />
                QC Notes
              </CardTitle>
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
        </div>
      </div>
    </PortalLayout>
  );
}
