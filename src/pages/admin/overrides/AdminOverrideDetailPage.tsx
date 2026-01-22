import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Users, 
  Store,
  Calendar,
  Percent,
  DollarSign,
  Edit
} from 'lucide-react';
import { format } from 'date-fns';
import { 
  useOverridePlan,
  useOverrideAssignments,
  useUpdateOverridePlan,
  useDeleteOverridePlan,
  useCreateOverrideAssignment,
  useDeleteOverrideAssignment,
  useAmbassadorsForOverrides,
  useStoresForOverrides,
  type OverridePlan
} from '@/hooks/useOverrides';
import Layout from '@/components/Layout';

const ROLE_TYPE_LABELS: Record<string, string> = {
  team_lead: 'Team Lead',
  manager: 'Manager',
  regional_manager: 'Regional Manager',
  recruiter: 'Recruiter',
  custom: 'Custom',
};

export default function AdminOverrideDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);

  const { data: plan, isLoading: planLoading } = useOverridePlan(id);
  const { data: assignments, isLoading: assignmentsLoading } = useOverrideAssignments(id);
  const { data: ambassadors } = useAmbassadorsForOverrides();
  const { data: stores } = useStoresForOverrides();

  const updatePlan = useUpdateOverridePlan();
  const deletePlan = useDeleteOverridePlan();
  const createAssignment = useCreateOverrideAssignment();
  const deleteAssignment = useDeleteOverrideAssignment();

  // Edit form state
  const [editForm, setEditForm] = useState<Partial<OverridePlan>>({});

  // Assignment form state
  const [assignmentForm, setAssignmentForm] = useState({
    beneficiary_ambassador_id: '',
    source_ambassador_id: null as string | null,
    source_store_id: null as string | null,
    start_date: new Date().toISOString().split('T')[0],
    end_date: null as string | null,
  });

  const handleEditOpen = () => {
    if (plan) {
      setEditForm({
        name: plan.name,
        description: plan.description,
        role_type: plan.role_type,
        override_type: plan.override_type,
        override_value: plan.override_value,
        applies_to_channel: plan.applies_to_channel,
        priority: plan.priority,
        active: plan.active,
      });
      setShowEditDialog(true);
    }
  };

  const handleUpdatePlan = async () => {
    if (!id) return;
    await updatePlan.mutateAsync({ id, ...editForm });
    setShowEditDialog(false);
  };

  const handleDeletePlan = async () => {
    if (!id) return;
    await deletePlan.mutateAsync(id);
    navigate('/admin/overrides');
  };

  const handleCreateAssignment = async () => {
    if (!id || !assignmentForm.beneficiary_ambassador_id) return;
    await createAssignment.mutateAsync({
      override_plan_id: id,
      beneficiary_ambassador_id: assignmentForm.beneficiary_ambassador_id,
      source_ambassador_id: assignmentForm.source_ambassador_id,
      source_store_id: assignmentForm.source_store_id,
      start_date: assignmentForm.start_date,
      end_date: assignmentForm.end_date,
    });
    setShowAssignDialog(false);
    setAssignmentForm({
      beneficiary_ambassador_id: '',
      source_ambassador_id: null,
      source_store_id: null,
      start_date: new Date().toISOString().split('T')[0],
      end_date: null,
    });
  };

  if (planLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </Layout>
    );
  }

  if (!plan) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="text-muted-foreground">Override plan not found</div>
          <Button onClick={() => navigate('/admin/overrides')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Overrides
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin/overrides')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{plan.name}</h1>
                <Badge variant={plan.active ? 'default' : 'secondary'}>
                  {plan.active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {ROLE_TYPE_LABELS[plan.role_type]} • {plan.override_type === 'percentage' ? `${plan.override_value}%` : `$${plan.override_value}`}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleEditOpen}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Plan
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Override Plan?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this override plan and all its assignments.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeletePlan}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Plan Details */}
        <Card>
          <CardHeader>
            <CardTitle>Plan Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Override Type</div>
                <div className="font-medium flex items-center gap-1">
                  {plan.override_type === 'percentage' ? (
                    <>
                      <Percent className="h-4 w-4" />
                      {plan.override_value}%
                    </>
                  ) : (
                    <>
                      <DollarSign className="h-4 w-4" />
                      ${plan.override_value}
                    </>
                  )}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Applies To</div>
                <div className="font-medium">
                  {plan.applies_to_channel || 'All Channels'}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Priority</div>
                <div className="font-medium">{plan.priority}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Created</div>
                <div className="font-medium">
                  {format(new Date(plan.created_at), 'MMM d, yyyy')}
                </div>
              </div>
            </div>
            {plan.description && (
              <div className="mt-4">
                <div className="text-sm text-muted-foreground">Description</div>
                <div className="mt-1">{plan.description}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assignments */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Assignments</CardTitle>
                <CardDescription>
                  Who receives this override and from whose activity
                </CardDescription>
              </div>
              <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Assignment
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Create Assignment</DialogTitle>
                    <DialogDescription>
                      Assign an ambassador to receive this override from a specific source.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Beneficiary (Who receives the override)</Label>
                      <Select
                        value={assignmentForm.beneficiary_ambassador_id}
                        onValueChange={(v) => setAssignmentForm({ ...assignmentForm, beneficiary_ambassador_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select ambassador..." />
                        </SelectTrigger>
                        <SelectContent>
                          {ambassadors?.map((amb: any) => (
                            <SelectItem key={amb.id} value={amb.id}>
                              {amb.profiles?.full_name || amb.profiles?.email || 'Unknown'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Source Ambassador (optional)</Label>
                      <Select
                        value={assignmentForm.source_ambassador_id || 'none'}
                        onValueChange={(v) => setAssignmentForm({ 
                          ...assignmentForm, 
                          source_ambassador_id: v === 'none' ? null : v 
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Any ambassador..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Any Ambassador</SelectItem>
                          {ambassadors?.map((amb: any) => (
                            <SelectItem key={amb.id} value={amb.id}>
                              {amb.profiles?.full_name || amb.profiles?.email || 'Unknown'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        If set, only commissions from this ambassador trigger the override.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Source Store (optional)</Label>
                      <Select
                        value={assignmentForm.source_store_id || 'none'}
                        onValueChange={(v) => setAssignmentForm({ 
                          ...assignmentForm, 
                          source_store_id: v === 'none' ? null : v 
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Any store..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Any Store</SelectItem>
                          {stores?.map((store) => (
                            <SelectItem key={store.id} value={store.id}>
                              {store.store_name} ({store.city}, {store.state})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        If set, only commissions from this store trigger the override.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Start Date</Label>
                        <Input
                          type="date"
                          value={assignmentForm.start_date}
                          onChange={(e) => setAssignmentForm({ ...assignmentForm, start_date: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>End Date (optional)</Label>
                        <Input
                          type="date"
                          value={assignmentForm.end_date || ''}
                          onChange={(e) => setAssignmentForm({ 
                            ...assignmentForm, 
                            end_date: e.target.value || null 
                          })}
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleCreateAssignment} 
                      disabled={!assignmentForm.beneficiary_ambassador_id || createAssignment.isPending}
                    >
                      {createAssignment.isPending ? 'Creating...' : 'Create Assignment'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {assignmentsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading assignments...</div>
            ) : assignments?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No assignments yet. Add an assignment to start generating overrides.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Beneficiary</TableHead>
                    <TableHead>Source Filter</TableHead>
                    <TableHead>Date Range</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments?.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {(assignment.beneficiary as any)?.profiles?.full_name || 'Unknown'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          {assignment.source_ambassador_id ? (
                            <div className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {(assignment.source_ambassador as any)?.profiles?.full_name || 'Specific Ambassador'}
                            </div>
                          ) : null}
                          {assignment.source_store_id ? (
                            <div className="flex items-center gap-1">
                              <Store className="h-3 w-3" />
                              {assignment.source_store?.store_name || 'Specific Store'}
                            </div>
                          ) : null}
                          {!assignment.source_ambassador_id && !assignment.source_store_id && (
                            <span className="text-muted-foreground">All sources</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {format(new Date(assignment.start_date), 'MMM d, yyyy')}
                          {assignment.end_date && (
                            <> — {format(new Date(assignment.end_date), 'MMM d, yyyy')}</>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={assignment.active ? 'default' : 'secondary'}>
                          {assignment.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Assignment?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will remove this override assignment. Future commissions will
                                no longer generate overrides for this beneficiary.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => deleteAssignment.mutate(assignment.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit Plan Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Override Plan</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Plan Name</Label>
                <Input
                  value={editForm.name || ''}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editForm.description || ''}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Override Type</Label>
                  <Select
                    value={editForm.override_type}
                    onValueChange={(v) => setEditForm({ ...editForm, override_type: v as OverridePlan['override_type'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="flat">Flat Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>
                    Value {editForm.override_type === 'percentage' ? '(%)' : '($)'}
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step={editForm.override_type === 'percentage' ? '0.5' : '1'}
                    value={editForm.override_value || 0}
                    onChange={(e) => setEditForm({ ...editForm, override_value: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={editForm.active}
                  onCheckedChange={(checked) => setEditForm({ ...editForm, active: checked })}
                />
                <Label>Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdatePlan} disabled={updatePlan.isPending}>
                {updatePlan.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
