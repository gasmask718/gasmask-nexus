import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import {
  RecruitingPageHeader, OutreachDisabledBanner, STAFF_ROLE_LABELS, STAFF_SOURCE,
  MOCK_STAFF_ASSIGNMENTS, EmptyState,
} from './shared';

export default function StaffSourcing() {
  const [open, setOpen] = useState(false);
  const rows = MOCK_STAFF_ASSIGNMENTS;

  return (
    <div className="p-6 space-y-6">
      <RecruitingPageHeader
        title="Staff Sourcing"
        subtitle="Discover local service professionals and businesses for Playboxxx."
        badge="Search + Ingestion Only"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Create Search Assignment</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Search Assignment</DialogTitle>
                <DialogDescription>
                  Staff lane · Source: {STAFF_SOURCE}. Scheduling is not connected yet.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="staff-location">Location</Label>
                  <Input id="staff-location" placeholder="e.g. Davao City" />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
                    <SelectContent>
                      {STAFF_ROLE_LABELS.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Source</Label>
                  <Input value={STAFF_SOURCE} readOnly />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => {
                    setOpen(false);
                    toast.info('UI only — search assignments are not saved during the current phase.');
                  }}
                >
                  Save Assignment
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <OutreachDisabledBanner />

      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Source: {STAFF_SOURCE}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {STAFF_ROLE_LABELS.map((r) => <Badge key={r} variant="secondary">{r}</Badge>)}
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          title="No Search Assignments Yet"
          description="Create your first search assignment to organize recruiting research."
        />
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">Search Assignments</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Search</TableHead>
                  <TableHead className="text-right">Candidates</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.location}</TableCell>
                    <TableCell>{r.role}</TableCell>
                    <TableCell>{r.source}</TableCell>
                    <TableCell><Badge variant="secondary">{r.status}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{r.lastSearch}</TableCell>
                    <TableCell className="text-right">{r.candidates}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toast.info('UI only — the recruiting engine is not connected yet.')}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
