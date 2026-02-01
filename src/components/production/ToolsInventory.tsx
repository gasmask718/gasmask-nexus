/**
 * TOOLS INVENTORY COMPONENT
 * 
 * Manage production tools for an office.
 * Track operational status, service dates, repairs.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useOfficeTools, useCreateTool, useUpdateTool, ProductionOfficeTool } from '@/hooks/useProductionPortal';
import { Wrench, Plus, AlertTriangle, CheckCircle, XCircle, Edit, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface ToolsInventoryProps {
  officeId: string;
}

const TOOL_TYPES = [
  { value: 'heat_gun', label: 'Heat Gun', icon: '🔥' },
  { value: 'tobacco_shredder', label: 'Tobacco Shredder', icon: '🌿' },
  { value: 'label_printer', label: 'Label Printer', icon: '🏷️' },
  { value: 'scale', label: 'Scale', icon: '⚖️' },
  { value: 'packaging_machine', label: 'Packaging Machine', icon: '📦' },
  { value: 'other', label: 'Other', icon: '🔧' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  operational: { label: 'Operational', color: 'bg-emerald-100 text-emerald-800', icon: <CheckCircle className="h-4 w-4" /> },
  needs_repair: { label: 'Needs Repair', color: 'bg-amber-100 text-amber-800', icon: <AlertTriangle className="h-4 w-4" /> },
  out_of_service: { label: 'Out of Service', color: 'bg-red-100 text-red-800', icon: <XCircle className="h-4 w-4" /> },
};

export function ToolsInventory({ officeId }: ToolsInventoryProps) {
  const { data: tools = [], isLoading } = useOfficeTools(officeId);
  const createTool = useCreateTool();
  const updateTool = useUpdateTool();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<ProductionOfficeTool | null>(null);
  const [formData, setFormData] = useState({
    tool_type: 'heat_gun' as ProductionOfficeTool['tool_type'],
    tool_name: '',
    quantity: '1',
    operational_count: '1',
    status: 'operational' as ProductionOfficeTool['status'],
    last_service_date: '',
    next_service_date: '',
    notes: '',
  });

  const operationalCount = tools.reduce((sum, t) => sum + (t.operational_count || 0), 0);
  const totalCount = tools.reduce((sum, t) => sum + (t.quantity || 0), 0);
  const needsAttention = tools.filter(t => t.status !== 'operational').length;

  const handleOpenModal = (tool?: ProductionOfficeTool) => {
    if (tool) {
      setEditingTool(tool);
      setFormData({
        tool_type: tool.tool_type,
        tool_name: tool.tool_name,
        quantity: String(tool.quantity),
        operational_count: String(tool.operational_count),
        status: tool.status,
        last_service_date: tool.last_service_date || '',
        next_service_date: tool.next_service_date || '',
        notes: tool.notes || '',
      });
    } else {
      setEditingTool(null);
      setFormData({
        tool_type: 'heat_gun',
        tool_name: '',
        quantity: '1',
        operational_count: '1',
        status: 'operational',
        last_service_date: '',
        next_service_date: '',
        notes: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    const payload = {
      office_id: officeId,
      tool_type: formData.tool_type,
      tool_name: formData.tool_name,
      quantity: parseInt(formData.quantity) || 1,
      operational_count: parseInt(formData.operational_count) || 1,
      status: formData.status,
      last_service_date: formData.last_service_date || null,
      next_service_date: formData.next_service_date || null,
      notes: formData.notes || null,
    };

    if (editingTool) {
      await updateTool.mutateAsync({ id: editingTool.id, ...payload });
    } else {
      await createTool.mutateAsync(payload as any);
    }
    setIsModalOpen(false);
  };

  const handleQuickStatusChange = async (tool: ProductionOfficeTool, newStatus: ProductionOfficeTool['status']) => {
    await updateTool.mutateAsync({
      id: tool.id,
      status: newStatus,
      operational_count: newStatus === 'operational' ? tool.quantity : 0,
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Tools & Equipment
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {operationalCount}/{totalCount} operational
              {needsAttention > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {needsAttention} need attention
                </Badge>
              )}
            </p>
          </div>
          <Button size="sm" onClick={() => handleOpenModal()}>
            <Plus className="h-4 w-4 mr-1" />
            Add Tool
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : tools.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Wrench className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No tools registered for this office.</p>
              <Button variant="link" onClick={() => handleOpenModal()}>
                Add your first tool
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {tools.map(tool => {
                const typeConfig = TOOL_TYPES.find(t => t.value === tool.tool_type);
                const statusConfig = STATUS_CONFIG[tool.status];
                
                return (
                  <div 
                    key={tool.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{typeConfig?.icon || '🔧'}</span>
                      <div>
                        <p className="font-medium">{tool.tool_name}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{typeConfig?.label}</span>
                          <span>•</span>
                          <span>{tool.operational_count}/{tool.quantity} operational</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge className={cn('text-xs', statusConfig.color)}>
                        {statusConfig.icon}
                        <span className="ml-1">{statusConfig.label}</span>
                      </Badge>
                      
                      {/* Quick status change buttons */}
                      {tool.status !== 'operational' && (
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleQuickStatusChange(tool, 'operational')}
                          title="Mark as operational"
                        >
                          <CheckCircle className="h-4 w-4 text-emerald-600" />
                        </Button>
                      )}
                      {tool.status === 'operational' && (
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleQuickStatusChange(tool, 'needs_repair')}
                          title="Mark as needs repair"
                        >
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                        </Button>
                      )}
                      
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => handleOpenModal(tool)}
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTool ? 'Edit Tool' : 'Add Tool'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Tool Type *</Label>
                <Select
                  value={formData.tool_type}
                  onValueChange={(value) => setFormData({ ...formData, tool_type: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TOOL_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        <span className="mr-2">{type.icon}</span>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="tool_name">Tool Name *</Label>
                <Input
                  id="tool_name"
                  value={formData.tool_name}
                  onChange={(e) => setFormData({ ...formData, tool_name: e.target.value })}
                  placeholder="e.g., Heat Gun #1"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="quantity">Total Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="operational">Operational</Label>
                <Input
                  id="operational"
                  type="number"
                  min="0"
                  max={formData.quantity}
                  value={formData.operational_count}
                  onChange={(e) => setFormData({ ...formData, operational_count: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operational">Operational</SelectItem>
                    <SelectItem value="needs_repair">Needs Repair</SelectItem>
                    <SelectItem value="out_of_service">Out of Service</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="last_service">Last Service Date</Label>
                <Input
                  id="last_service"
                  type="date"
                  value={formData.last_service_date}
                  onChange={(e) => setFormData({ ...formData, last_service_date: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="next_service">Next Service Date</Label>
                <Input
                  id="next_service"
                  type="date"
                  value={formData.next_service_date}
                  onChange={(e) => setFormData({ ...formData, next_service_date: e.target.value })}
                />
              </div>
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
              disabled={!formData.tool_name || createTool.isPending || updateTool.isPending}
            >
              {editingTool ? 'Save Changes' : 'Add Tool'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
