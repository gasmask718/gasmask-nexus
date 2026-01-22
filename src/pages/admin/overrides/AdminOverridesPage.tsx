import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
  Plus, 
  Users, 
  Percent, 
  DollarSign, 
  TrendingUp,
  Settings,
  ArrowRight,
  Search
} from 'lucide-react';
import { 
  useOverridePlans, 
  useOverrideSummary,
  useCreateOverridePlan,
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

const CHANNEL_LABELS: Record<string, string> = {
  store_order: 'Store Orders',
  wholesale: 'Wholesale',
  affiliate: 'Affiliate',
};

export default function AdminOverridesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: plans, isLoading: plansLoading } = useOverridePlans();
  const { data: summary, isLoading: summaryLoading } = useOverrideSummary();
  const createPlan = useCreateOverridePlan();

  // Form state for new plan
  const [newPlan, setNewPlan] = useState({
    name: '',
    description: '',
    role_type: 'team_lead' as OverridePlan['role_type'],
    override_type: 'percentage' as OverridePlan['override_type'],
    override_value: 2,
    applies_to_channel: null as string | null,
    priority: 100,
    active: true,
  });

  const filteredPlans = plans?.filter(plan =>
    plan.name.toLowerCase().includes(search.toLowerCase()) ||
    plan.role_type.toLowerCase().includes(search.toLowerCase())
  );

  // Calculate KPIs
  const activePlans = plans?.filter(p => p.active).length || 0;
  const totalAssignments = summary?.reduce((acc, s) => acc + Number(s.assignment_count), 0) || 0;
  const totalCommissions = summary?.reduce((acc, s) => acc + Number(s.commissions_generated), 0) || 0;
  const totalPaidOut = summary?.reduce((acc, s) => acc + Number(s.total_paid_out), 0) || 0;

  const handleCreatePlan = async () => {
    await createPlan.mutateAsync(newPlan);
    setShowCreateDialog(false);
    setNewPlan({
      name: '',
      description: '',
      role_type: 'team_lead',
      override_type: 'percentage',
      override_value: 2,
      applies_to_channel: null,
      priority: 100,
      active: true,
    });
  };

  return (
    <Layout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Commission Overrides</h1>
            <p className="text-muted-foreground">
              Manage team leads, managers, and hierarchy-based commission splits
            </p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create Override Plan
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Override Plan</DialogTitle>
                <DialogDescription>
                  Define how team leads, managers, or other roles earn overrides on commissions.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Plan Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Team Lead 2%"
                    value={newPlan.name}
                    onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Optional description..."
                    value={newPlan.description}
                    onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Role Type</Label>
                    <Select
                      value={newPlan.role_type}
                      onValueChange={(v) => setNewPlan({ ...newPlan, role_type: v as OverridePlan['role_type'] })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="team_lead">Team Lead</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="regional_manager">Regional Manager</SelectItem>
                        <SelectItem value="recruiter">Recruiter</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Override Type</Label>
                    <Select
                      value={newPlan.override_type}
                      onValueChange={(v) => setNewPlan({ ...newPlan, override_type: v as OverridePlan['override_type'] })}
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
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>
                      Override Value {newPlan.override_type === 'percentage' ? '(%)' : '($)'}
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step={newPlan.override_type === 'percentage' ? '0.5' : '1'}
                      value={newPlan.override_value}
                      onChange={(e) => setNewPlan({ ...newPlan, override_value: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Priority (lower = first)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={newPlan.priority}
                      onChange={(e) => setNewPlan({ ...newPlan, priority: parseInt(e.target.value) || 100 })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Applies to Channel</Label>
                  <Select
                    value={newPlan.applies_to_channel || 'all'}
                    onValueChange={(v) => setNewPlan({ ...newPlan, applies_to_channel: v === 'all' ? null : v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Channels</SelectItem>
                      <SelectItem value="store_order">Store Orders Only</SelectItem>
                      <SelectItem value="wholesale">Wholesale Only</SelectItem>
                      <SelectItem value="affiliate">Affiliate Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={newPlan.active}
                    onCheckedChange={(checked) => setNewPlan({ ...newPlan, active: checked })}
                  />
                  <Label>Active</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreatePlan} disabled={!newPlan.name || createPlan.isPending}>
                  {createPlan.isPending ? 'Creating...' : 'Create Plan'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-primary">
                <Settings className="h-5 w-5" />
                <span className="text-sm font-medium">Active Plans</span>
              </div>
              <div className="text-2xl font-bold mt-2">{activePlans}</div>
              <div className="text-xs text-muted-foreground">of {plans?.length || 0} total</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-900/5 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-400">
                <Users className="h-5 w-5" />
                <span className="text-sm font-medium">Assignments</span>
              </div>
              <div className="text-2xl font-bold mt-2">{totalAssignments}</div>
              <div className="text-xs text-muted-foreground">active override recipients</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-900/5 border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-green-400">
                <TrendingUp className="h-5 w-5" />
                <span className="text-sm font-medium">Overrides Generated</span>
              </div>
              <div className="text-2xl font-bold mt-2">{totalCommissions.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">commission entries</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-900/5 border-amber-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-amber-400">
                <DollarSign className="h-5 w-5" />
                <span className="text-sm font-medium">Total Paid Out</span>
              </div>
              <div className="text-2xl font-bold mt-2">${totalPaidOut.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">in override commissions</div>
            </CardContent>
          </Card>
        </div>

        {/* Plans Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Override Plans</CardTitle>
                <CardDescription>Configure commission override rules and assignments</CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search plans..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {plansLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading plans...</div>
            ) : filteredPlans?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No override plans found. Create your first plan to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan Name</TableHead>
                    <TableHead>Role Type</TableHead>
                    <TableHead>Override</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Assignments</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlans?.map((plan) => {
                    const planSummary = summary?.find(s => s.plan_id === plan.id);
                    return (
                      <TableRow 
                        key={plan.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/admin/overrides/${plan.id}`)}
                      >
                        <TableCell>
                          <div>
                            <div className="font-medium">{plan.name}</div>
                            {plan.description && (
                              <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {plan.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {ROLE_TYPE_LABELS[plan.role_type] || plan.role_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {plan.override_type === 'percentage' ? (
                              <>
                                <Percent className="h-3 w-3 text-muted-foreground" />
                                <span>{plan.override_value}%</span>
                              </>
                            ) : (
                              <>
                                <DollarSign className="h-3 w-3 text-muted-foreground" />
                                <span>${plan.override_value}</span>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {plan.applies_to_channel 
                            ? CHANNEL_LABELS[plan.applies_to_channel] || plan.applies_to_channel
                            : 'All'
                          }
                        </TableCell>
                        <TableCell>
                          {planSummary?.assignment_count || 0}
                        </TableCell>
                        <TableCell>
                          <Badge variant={plan.active ? 'default' : 'secondary'}>
                            {plan.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
