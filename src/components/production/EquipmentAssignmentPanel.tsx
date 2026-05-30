/**
 * EQUIPMENT ASSIGNMENT PANEL
 * Tracks equipment assignment to workers with history.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useActiveEquipmentAssignments,
  useEquipmentAssignments,
  useAssignEquipment,
  useUnassignEquipment,
} from '@/hooks/useEquipmentAssignments';
import { Wrench, Plus, UserMinus, Clock } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

interface EquipmentAssignmentPanelProps {
  officeId: string;
}

export function EquipmentAssignmentPanel({ officeId }: EquipmentAssignmentPanelProps) {
  const { data: active = [], isLoading } = useActiveEquipmentAssignments(officeId);
  const { data: allHistory = [] } = useEquipmentAssignments(officeId);
  const assign = useAssignEquipment();
  const unassign = useUnassignEquipment();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ equipmentName: '', equipmentSerial: '', notes: '' });

  const handleAssign = async () => {
    await assign.mutateAsync({
      officeId,
      equipmentName: form.equipmentName,
      equipmentSerial: form.equipmentSerial || undefined,
      notes: form.notes || undefined,
    });
    setShowModal(false);
    setForm({ equipmentName: '', equipmentSerial: '', notes: '' });
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wrench className="h-5 w-5 text-primary" />
                Equipment Assignments
              </CardTitle>
              <CardDescription>{active.length} active assignments</CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowModal(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Assign
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="active">
            <TabsList className="mb-3">
              <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
              <TabsTrigger value="history">History ({allHistory.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="active">
              {isLoading ? (
                <div className="py-6 text-center text-muted-foreground text-sm">Loading...</div>
              ) : active.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground text-sm">No active assignments.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Equipment</TableHead>
                      <TableHead className="text-xs">Serial</TableHead>
                      <TableHead className="text-xs">Assigned</TableHead>
                      <TableHead className="text-xs">Duration</TableHead>
                      <TableHead className="text-xs"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {active.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="text-xs font-medium">{a.equipment_name}</TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{a.equipment_serial || '—'}</TableCell>
                        <TableCell className="text-xs">{format(new Date(a.assigned_at), 'MMM d, yyyy')}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="text-[10px]">
                            <Clock className="h-3 w-3 mr-1" />
                            {differenceInDays(new Date(), new Date(a.assigned_at))}d
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => unassign.mutate(a.id)}
                            disabled={unassign.isPending}
                          >
                            <UserMinus className="h-3 w-3 mr-1" />
                            Return
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="history">
              {allHistory.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground text-sm">No history.</div>
              ) : (
                <div className="overflow-auto max-h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Equipment</TableHead>
                        <TableHead className="text-xs">Serial</TableHead>
                        <TableHead className="text-xs">Assigned</TableHead>
                        <TableHead className="text-xs">Returned</TableHead>
                        <TableHead className="text-xs">Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allHistory.map(a => (
                        <TableRow key={a.id}>
                          <TableCell className="text-xs">{a.equipment_name}</TableCell>
                          <TableCell className="text-xs font-mono">{a.equipment_serial || '—'}</TableCell>
                          <TableCell className="text-xs">{format(new Date(a.assigned_at), 'MMM d, yyyy')}</TableCell>
                          <TableCell className="text-xs">
                            {a.unassigned_at ? format(new Date(a.unassigned_at), 'MMM d, yyyy') : (
                              <Badge variant="default" className="text-[9px]">Active</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]">{a.assignment_notes || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Equipment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Equipment Name *</Label>
              <Input
                value={form.equipmentName}
                onChange={e => setForm({ ...form, equipmentName: e.target.value })}
                placeholder="e.g., Heat Gun #3"
              />
            </div>
            <div className="grid gap-2">
              <Label>Serial Number</Label>
              <Input
                value={form.equipmentSerial}
                onChange={e => setForm({ ...form, equipmentSerial: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Input
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={!form.equipmentName || assign.isPending}>
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
