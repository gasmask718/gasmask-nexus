import { useState } from 'react';
import { useProductionOffices } from '@/hooks/useProductionPortal';
import { 
  useOfficeStaff, 
  useAssignStaff, 
  useUpdateStaffRole, 
  useRemoveStaff,
  getRoleDisplayName,
  getRoleBadgeColor,
  type ProductionRole 
} from '@/hooks/useProductionStaff';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  UserPlus, 
  Building2, 
  Shield, 
  HardHat, 
  Wrench,
  MoreVertical,
  Trash2,
  ArrowLeft,
  Eye
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

export default function StaffManagementPage() {
  const { data: offices = [] } = useProductionOffices();
  const [selectedOfficeId, setSelectedOfficeId] = useState<string | null>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  
  // Auto-select first office if only one
  const effectiveOfficeId = selectedOfficeId || (offices.length === 1 ? offices[0].id : null);
  
  const { data: staff = [], isLoading: staffLoading } = useOfficeStaff(effectiveOfficeId);
  const assignStaff = useAssignStaff();
  const updateRole = useUpdateStaffRole();
  const removeStaff = useRemoveStaff();

  // Get available users to assign
  const { data: availableUsers = [] } = useQuery({
    queryKey: ['available-users-for-production'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const [newAssignment, setNewAssignment] = useState({
    user_id: '',
    role: 'worker' as ProductionRole,
  });

  const handleAssign = async () => {
    if (!effectiveOfficeId || !newAssignment.user_id) return;
    
    await assignStaff.mutateAsync({
      user_id: newAssignment.user_id,
      office_id: effectiveOfficeId,
      role: newAssignment.role,
    });
    
    setIsAssignDialogOpen(false);
    setNewAssignment({ user_id: '', role: 'worker' });
  };

  const roleIcon = (role: ProductionRole) => {
    switch (role) {
      case 'office_manager': return <Shield className="h-4 w-4" />;
      case 'supervisor': return <HardHat className="h-4 w-4" />;
      case 'worker': return <Wrench className="h-4 w-4" />;
    }
  };

  const groupedStaff = {
    office_manager: staff.filter(s => s.role === 'office_manager'),
    supervisor: staff.filter(s => s.role === 'supervisor'),
    worker: staff.filter(s => s.role === 'worker'),
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/portals/production">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Staff Management
            </h1>
            <p className="text-muted-foreground">Assign and manage production office staff</p>
          </div>
        </div>
        
        <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={!effectiveOfficeId}>
              <UserPlus className="h-4 w-4 mr-2" />
              Assign Staff
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Staff to Office</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Select User</Label>
                <Select 
                  value={newAssignment.user_id} 
                  onValueChange={(v) => setNewAssignment(prev => ({ ...prev, user_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a user..." />
                  </SelectTrigger>
                  <SelectContent>
                  {availableUsers.map((user: { id: string; name: string | null; email: string | null }) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name || user.email || 'Unknown User'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Role</Label>
                <Select 
                  value={newAssignment.role} 
                  onValueChange={(v) => setNewAssignment(prev => ({ ...prev, role: v as ProductionRole }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="office_manager">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Office Manager
                      </div>
                    </SelectItem>
                    <SelectItem value="supervisor">
                      <div className="flex items-center gap-2">
                        <HardHat className="h-4 w-4" />
                        Supervisor
                      </div>
                    </SelectItem>
                    <SelectItem value="worker">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-4 w-4" />
                        Worker
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAssign} 
                disabled={!newAssignment.user_id || assignStaff.isPending}
              >
                {assignStaff.isPending ? 'Assigning...' : 'Assign'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Office Selector */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Select Office</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Select 
            value={effectiveOfficeId || ''} 
            onValueChange={setSelectedOfficeId}
          >
            <SelectTrigger className="w-full max-w-sm">
              <SelectValue placeholder="Choose an office..." />
            </SelectTrigger>
            <SelectContent>
              {offices.map(office => (
                <SelectItem key={office.id} value={office.id}>
                  {office.name} — {office.location}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Staff by Role */}
      {effectiveOfficeId ? (
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All Staff ({staff.length})</TabsTrigger>
            <TabsTrigger value="managers">Managers ({groupedStaff.office_manager.length})</TabsTrigger>
            <TabsTrigger value="supervisors">Supervisors ({groupedStaff.supervisor.length})</TabsTrigger>
            <TabsTrigger value="workers">Workers ({groupedStaff.worker.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <StaffGrid 
              staff={staff} 
              roleIcon={roleIcon}
              onUpdateRole={(id, role) => updateRole.mutate({ id, role })}
              onRemove={(id) => removeStaff.mutate(id)}
              isLoading={staffLoading}
            />
          </TabsContent>

          <TabsContent value="managers">
            <StaffGrid 
              staff={groupedStaff.office_manager} 
              roleIcon={roleIcon}
              onUpdateRole={(id, role) => updateRole.mutate({ id, role })}
              onRemove={(id) => removeStaff.mutate(id)}
              isLoading={staffLoading}
            />
          </TabsContent>

          <TabsContent value="supervisors">
            <StaffGrid 
              staff={groupedStaff.supervisor} 
              roleIcon={roleIcon}
              onUpdateRole={(id, role) => updateRole.mutate({ id, role })}
              onRemove={(id) => removeStaff.mutate(id)}
              isLoading={staffLoading}
            />
          </TabsContent>

          <TabsContent value="workers">
            <StaffGrid 
              staff={groupedStaff.worker} 
              roleIcon={roleIcon}
              onUpdateRole={(id, role) => updateRole.mutate({ id, role })}
              onRemove={(id) => removeStaff.mutate(id)}
              isLoading={staffLoading}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No Office Selected</h3>
            <p className="text-muted-foreground">
              Select an office above to view and manage its staff
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface StaffGridProps {
  staff: any[];
  roleIcon: (role: ProductionRole) => React.ReactNode;
  onUpdateRole: (id: string, role: ProductionRole) => void;
  onRemove: (id: string) => void;
  isLoading: boolean;
}

function StaffGrid({ staff, roleIcon, onUpdateRole, onRemove, isLoading }: StaffGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="py-6">
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (staff.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">No staff members in this category</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {staff.map(member => (
        <Card key={member.id} className="relative">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center',
                  getRoleBadgeColor(member.role)
                )}>
                  {roleIcon(member.role)}
                </div>
                <div>
                  <h4 className="font-medium">
                    {member.user_name || member.user_email || 'Unknown'}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {member.user_email}
                  </p>
                </div>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onUpdateRole(member.id, 'office_manager')}>
                    <Shield className="h-4 w-4 mr-2" />
                    Make Office Manager
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onUpdateRole(member.id, 'supervisor')}>
                    <HardHat className="h-4 w-4 mr-2" />
                    Make Supervisor
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onUpdateRole(member.id, 'worker')}>
                    <Wrench className="h-4 w-4 mr-2" />
                    Make Worker
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onRemove(member.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove from Office
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className={cn('text-xs', getRoleBadgeColor(member.role))}>
                  {getRoleDisplayName(member.role)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Since {new Date(member.assigned_at).toLocaleDateString()}
                </span>
              </div>
              {/* Staff detail route does not exist — link removed until it is built. */}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
