import { useState, useEffect } from 'react';
import { X, History, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { EditableField, FieldType } from './EditableField';
import { QuickActions } from './QuickActions';
import { AuditHistory } from './AuditHistory';
import { useEditableEntity } from '@/hooks/useEditableEntity';
import { useAuth } from '@/contexts/AuthContext';
import { DrillDownEntity, getEntityTitle } from '@/lib/drilldown';
import { canEditField, UserRole } from '@/lib/editPermissions';
import { cn } from '@/lib/utils';

interface FieldConfig {
  key: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
}

interface EntityDrawerProps {
  open: boolean;
  onClose: () => void;
  entity: DrillDownEntity;
  entityId: string;
  data: Record<string, any>;
  onSave?: () => void;
}

// Field configurations per entity
const entityFieldConfigs: Record<DrillDownEntity, FieldConfig[]> = {
  stores: [
    { key: 'name', label: 'Store Name', type: 'text' },
    { key: 'address', label: 'Address', type: 'text' },
    { key: 'phone', label: 'Phone', type: 'text' },
    { key: 'email', label: 'Email', type: 'text' },
    { key: 'status', label: 'Status', type: 'dropdown', options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'new', label: 'New' },
      { value: 'churned', label: 'Churned' },
    ]},
    { key: 'owner_name', label: 'Owner Name', type: 'text' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
  invoices: [
    { key: 'invoice_number', label: 'Invoice #', type: 'text' },
    { key: 'status', label: 'Status', type: 'dropdown', options: [
      { value: 'draft', label: 'Draft' },
      { value: 'sent', label: 'Sent' },
      { value: 'paid', label: 'Paid' },
      { value: 'overdue', label: 'Overdue' },
    ]},
    { key: 'payment_status', label: 'Payment', type: 'dropdown', options: [
      { value: 'unpaid', label: 'Unpaid' },
      { value: 'partial', label: 'Partial' },
      { value: 'paid', label: 'Paid' },
    ]},
    { key: 'amount', label: 'Amount', type: 'number' },
    { key: 'due_date', label: 'Due Date', type: 'date' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
  deliveries: [
    { key: 'status', label: 'Status', type: 'dropdown', options: [
      { value: 'pending', label: 'Pending' },
      { value: 'in_progress', label: 'In Progress' },
      { value: 'completed', label: 'Completed' },
      { value: 'skipped', label: 'Skipped' },
    ]},
    { key: 'scheduled_time', label: 'Scheduled', type: 'text' },
    { key: 'delivery_notes', label: 'Delivery Notes', type: 'textarea' },
    { key: 'notes', label: 'Internal Notes', type: 'textarea' },
  ],
  inventory: [
    { key: 'product_type', label: 'Product', type: 'text' },
    { key: 'quantity', label: 'Quantity', type: 'number' },
    { key: 'reorder_point', label: 'Reorder Point', type: 'number' },
    { key: 'location', label: 'Location', type: 'text' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
  drivers: [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'phone', label: 'Phone', type: 'text' },
    { key: 'status', label: 'Status', type: 'dropdown', options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'on_route', label: 'On Route' },
    ]},
    { key: 'vehicle_info', label: 'Vehicle', type: 'text' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
  orders: [
    { key: 'order_number', label: 'Order #', type: 'text' },
    { key: 'status', label: 'Status', type: 'dropdown', options: [
      { value: 'pending', label: 'Pending' },
      { value: 'confirmed', label: 'Confirmed' },
      { value: 'shipped', label: 'Shipped' },
      { value: 'delivered', label: 'Delivered' },
      { value: 'cancelled', label: 'Cancelled' },
    ]},
    { key: 'shipping_address', label: 'Shipping Address', type: 'textarea' },
    { key: 'priority', label: 'Priority', type: 'dropdown', options: [
      { value: 'low', label: 'Low' },
      { value: 'normal', label: 'Normal' },
      { value: 'high', label: 'High' },
      { value: 'urgent', label: 'Urgent' },
    ]},
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
  routes: [
    { key: 'name', label: 'Route Name', type: 'text' },
    { key: 'status', label: 'Status', type: 'dropdown', options: [
      { value: 'scheduled', label: 'Scheduled' },
      { value: 'in_progress', label: 'In Progress' },
      { value: 'completed', label: 'Completed' },
      { value: 'cancelled', label: 'Cancelled' },
    ]},
    { key: 'scheduled_date', label: 'Date', type: 'date' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
  ambassadors: [
    { key: 'tracking_code', label: 'Tracking Code', type: 'text' },
    { key: 'tier', label: 'Tier', type: 'dropdown', options: [
      { value: 'bronze', label: 'Bronze' },
      { value: 'silver', label: 'Silver' },
      { value: 'gold', label: 'Gold' },
      { value: 'platinum', label: 'Platinum' },
    ]},
    { key: 'is_active', label: 'Active', type: 'toggle' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
  commissions: [
    { key: 'amount', label: 'Amount', type: 'number' },
    { key: 'status', label: 'Status', type: 'dropdown', options: [
      { value: 'pending', label: 'Pending' },
      { value: 'approved', label: 'Approved' },
      { value: 'paid', label: 'Paid' },
    ]},
    { key: 'paid_at', label: 'Paid Date', type: 'date' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
};

export function EntityDrawer({
  open,
  onClose,
  entity,
  entityId,
  data,
  onSave,
}: EntityDrawerProps) {
  const { user, userRole: authRole } = useAuth();
  const [showHistory, setShowHistory] = useState(false);
  const [localData, setLocalData] = useState(data);
  
  const userRole = (authRole as UserRole) || 'va';
  
  const { updateField, isSaving } = useEditableEntity({
    entity,
    entityId,
    onUpdate: onSave,
  });

  useEffect(() => {
    setLocalData(data);
  }, [data]);

  const handleFieldSave = async (field: string, value: any) => {
    const oldValue = localData[field];
    await updateField(field, value, oldValue);
    setLocalData((prev) => ({ ...prev, [field]: value }));
  };

  const handleQuickAction = (action: string, actionData?: any) => {
    // This would typically dispatch to an action handler
    console.log('Quick action:', action, actionData);
    // You could integrate with your existing action system here
  };

  const fields = entityFieldConfigs[entity] || [];

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-background/80 backdrop-blur-sm z-40 transition-opacity',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed right-0 top-0 h-full w-full sm:w-[450px] bg-background border-l border-border shadow-xl z-50 transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold">
              {localData.title || localData.name || getEntityTitle(entity)}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs capitalize">
                {entity}
              </Badge>
              {localData.brand && (
                <Badge variant="secondary" className="text-xs">
                  {localData.brand}
                </Badge>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="h-[calc(100%-65px)]">
          <div className="p-4 space-y-6">
            {/* Quick Actions */}
            <QuickActions
              entity={entity}
              entityId={entityId}
              entityData={localData}
              onAction={handleQuickAction}
            />

            <Separator />

            {/* Editable Fields */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">Details</h4>
              {fields.map((field) => {
                const isEditable = canEditField(entity, field.key, userRole);
                const value = localData[field.key];

                return (
                  <EditableField
                    key={field.key}
                    field={field.key}
                    label={field.label}
                    type={field.type}
                    value={value}
                    options={field.options}
                    editable={isEditable}
                    onSave={handleFieldSave}
                  />
                );
              })}
            </div>

            <Separator />

            {/* Audit History */}
            <Collapsible open={showHistory} onOpenChange={setShowHistory}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4" />
                    <span>History</span>
                  </div>
                  {showHistory ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <AuditHistory entityType={entity} entityId={entityId} />
              </CollapsibleContent>
            </Collapsible>
          </div>
        </ScrollArea>
      </div>
    </>
  );
}
