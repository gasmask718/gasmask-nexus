/**
 * WORKER MANAGEMENT COMPONENT
 * 
 * Manage production workers for an office.
 * Add, edit, activate/deactivate workers.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useProductionWorkers, useCreateWorker, useUpdateWorker, ProductionWorker } from '@/hooks/useProductionPortal';
import { useMessage } from '@/components/communication/MessageProvider';
import { Users, Plus, Phone, MessageSquare, UserCheck, UserX, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkerManagementProps {
  officeId: string;
}

const WORKER_ROLES = [
  { value: 'packer', label: 'Packer' },
  { value: 'shredder', label: 'Shredder' },
  { value: 'qc', label: 'QC Inspector' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'machine_operator', label: 'Machine Operator' },
  { value: 'laborer', label: 'Laborer' },
];

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  inactive: 'bg-gray-100 text-gray-800',
  on_leave: 'bg-amber-100 text-amber-800',
};

export function WorkerManagement({ officeId }: WorkerManagementProps) {
  const { data: workers = [], isLoading } = useProductionWorkers(officeId);
  const createWorker = useCreateWorker();
  const updateWorker = useUpdateWorker();
  const { initiateMessage } = useMessage();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<ProductionWorker | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    role: 'packer' as ProductionWorker['role'],
    phone: '',
    whatsapp: '',
    email: '',
    status: 'active' as ProductionWorker['status'],
    notes: '',
  });

  const activeWorkers = workers.filter(w => w.status === 'active');
  const inactiveWorkers = workers.filter(w => w.status !== 'active');

  const handleOpenModal = (worker?: ProductionWorker) => {
    if (worker) {
      setEditingWorker(worker);
      setFormData({
        full_name: worker.full_name,
        role: worker.role,
        phone: worker.phone || '',
        whatsapp: worker.whatsapp || '',
        email: worker.email || '',
        status: worker.status,
        notes: worker.notes || '',
      });
    } else {
      setEditingWorker(null);
      setFormData({
        full_name: '',
        role: 'packer',
        phone: '',
        whatsapp: '',
        email: '',
        status: 'active',
        notes: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (editingWorker) {
      await updateWorker.mutateAsync({
        id: editingWorker.id,
        ...formData,
      });
    } else {
      await createWorker.mutateAsync({
        office_id: officeId,
        ...formData,
      } as any);
    }
    setIsModalOpen(false);
  };

  const handleToggleStatus = async (worker: ProductionWorker) => {
    const newStatus = worker.status === 'active' ? 'inactive' : 'active';
    await updateWorker.mutateAsync({
      id: worker.id,
      status: newStatus,
    });
  };

  const handleMessage = (worker: ProductionWorker, channel: 'sms' | 'whatsapp') => {
    const phone = channel === 'whatsapp' ? worker.whatsapp : worker.phone;
    if (phone) {
      initiateMessage({
        destinationPhone: phone,
        entityType: 'other',
        entityName: worker.full_name,
        channel,
        source: 'production-portal',
      });
    }
  };

  const WorkerCard = ({ worker }: { worker: ProductionWorker }) => (
    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-3">
        <div className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center',
          worker.status === 'active' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
        )}>
          <Users className="h-5 w-5" />
        </div>
        <div>
          <p className="font-medium">{worker.full_name}</p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline" className="text-xs">
              {WORKER_ROLES.find(r => r.value === worker.role)?.label || worker.role}
            </Badge>
            <Badge className={cn('text-xs', STATUS_COLORS[worker.status])}>
              {worker.status}
            </Badge>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-1">
        {worker.phone && (
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={() => handleMessage(worker, 'sms')}
            title="Send SMS"
          >
            <Phone className="h-4 w-4" />
          </Button>
        )}
        {worker.whatsapp && (
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={() => handleMessage(worker, 'whatsapp')}
            title="Send WhatsApp"
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
        )}
        <Button 
          size="icon" 
          variant="ghost" 
          onClick={() => handleOpenModal(worker)}
          title="Edit"
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button 
          size="icon" 
          variant="ghost" 
          onClick={() => handleToggleStatus(worker)}
          title={worker.status === 'active' ? 'Deactivate' : 'Activate'}
        >
          {worker.status === 'active' ? (
            <UserX className="h-4 w-4 text-destructive" />
          ) : (
            <UserCheck className="h-4 w-4 text-emerald-600" />
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Workers ({activeWorkers.length} active)
          </CardTitle>
          <Button size="sm" onClick={() => handleOpenModal()}>
            <Plus className="h-4 w-4 mr-1" />
            Add Worker
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : workers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No workers assigned to this office yet.</p>
              <Button variant="link" onClick={() => handleOpenModal()}>
                Add your first worker
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Active Workers */}
              {activeWorkers.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Active</h4>
                  {activeWorkers.map(worker => (
                    <WorkerCard key={worker.id} worker={worker} />
                  ))}
                </div>
              )}

              {/* Inactive Workers */}
              {inactiveWorkers.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Inactive / On Leave</h4>
                  {inactiveWorkers.map(worker => (
                    <WorkerCard key={worker.id} worker={worker} />
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingWorker ? 'Edit Worker' : 'Add Worker'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="full_name">Full Name *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="John Doe"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="role">Role *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WORKER_ROLES.map(role => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="on_leave">On Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1 555-123-4567"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  value={formData.whatsapp}
                  onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  placeholder="+1 555-123-4567"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="worker@example.com"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Optional notes..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!formData.full_name || createWorker.isPending || updateWorker.isPending}
            >
              {editingWorker ? 'Save Changes' : 'Add Worker'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
