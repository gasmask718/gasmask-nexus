import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  RecruitingPageHeader, OutreachDisabledBanner, EmptyState, LaneBadge,
  MOCK_STAFF_ASSIGNMENTS, MOCK_CREATOR_ASSIGNMENTS, STAFF_ROLE_LABELS, CREATOR_CATEGORY_LABELS,
  STAFF_SOURCE, CREATOR_SOURCE,
} from './shared';

type Row = {
  id: string; lane: 'staff' | 'creator'; role: string; location: string;
  source: string; status: string; lastSearch: string; nextSearch: string; candidates: number;
};

const ROWS: Row[] = [
  ...MOCK_STAFF_ASSIGNMENTS.map((r) => ({ ...r, lane: 'staff' as const })),
  ...MOCK_CREATOR_ASSIGNMENTS.map((r) => ({ ...r, lane: 'creator' as const })),
];

function AssignmentTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No Search Assignments Yet"
        description="Create your first search assignment to organize recruiting research."
      />
    );
  }
  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Geography</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Searched</TableHead>
              <TableHead>Next Search</TableHead>
              <TableHead className="text-right">Candidates</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell><LaneBadge lane={r.lane} /></TableCell>
                <TableCell className="font-medium">{r.role}</TableCell>
                <TableCell>{r.location}</TableCell>
                <TableCell>{r.source}</TableCell>
                <TableCell><Badge variant="secondary">{r.status}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{r.lastSearch}</TableCell>
                <TableCell className="text-muted-foreground">{r.nextSearch}</TableCell>
                <TableCell className="text-right">{r.candidates}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function SearchAssignments() {
  const [open, setOpen] = useState(false);
  const [lane, setLane] = useState<'staff' | 'creator'>('staff');

  return (
    <div className="p-6 space-y-6">
      <RecruitingPageHeader
        title="Search Assignments"
        subtitle="Manage the locations and categories that the Recruiting Engine is expected to research."
        badge="Search + Ingestion Only"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New Search Assignment</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Search Assignment</DialogTitle>
                <DialogDescription>
                  Scheduling and automation are not connected during the current phase.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Lane</Label>
                  <Select value={lane} onValueChange={(v) => setLane(v as 'staff' | 'creator')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">Staff / Service Roles</SelectItem>
                      <SelectItem value="creator">Creator / Model</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                    <SelectContent>
                      {(lane === 'staff' ? STAFF_ROLE_LABELS : CREATOR_CATEGORY_LABELS).map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="geo">Geography</Label>
                  <Input id="geo" placeholder="e.g. Manila" />
                </div>
                <div className="space-y-2">
                  <Label>Source</Label>
                  <Input readOnly value={lane === 'staff' ? STAFF_SOURCE : CREATOR_SOURCE} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => { setOpen(false); toast.info('UI only — assignments are not persisted yet.'); }}>
                  Save Assignment
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <OutreachDisabledBanner />

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="creator">Creator / Model</TabsTrigger>
        </TabsList>
        <TabsContent value="all"><AssignmentTable rows={ROWS} /></TabsContent>
        <TabsContent value="staff"><AssignmentTable rows={ROWS.filter((r) => r.lane === 'staff')} /></TabsContent>
        <TabsContent value="creator"><AssignmentTable rows={ROWS.filter((r) => r.lane === 'creator')} /></TabsContent>
      </Tabs>
    </div>
  );
}
