import { 
  FileText, MessageSquare, Route, StickyNote, 
  Package, Layers, CheckCircle, Bell, Send, Truck 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DrillDownEntity } from '@/lib/drilldown';

interface QuickActionsProps {
  entity: DrillDownEntity;
  entityId: string;
  entityData: Record<string, any>;
  onAction: (action: string, data?: any) => void;
}

interface ActionConfig {
  icon: React.ElementType;
  label: string;
  action: string;
  variant?: 'default' | 'outline' | 'secondary';
}

const entityActions: Record<DrillDownEntity, ActionConfig[]> = {
  stores: [
    { icon: FileText, label: 'Create Invoice', action: 'create_invoice' },
    { icon: MessageSquare, label: 'Send Text', action: 'send_text' },
    { icon: Route, label: 'Assign to Route', action: 'assign_route' },
    { icon: StickyNote, label: 'Add Note', action: 'add_note' },
  ],
  inventory: [
    { icon: Package, label: 'Adjust Stock', action: 'adjust_stock' },
    { icon: Layers, label: 'Add to Batch', action: 'add_to_batch' },
    { icon: StickyNote, label: 'Add Note', action: 'add_note' },
  ],
  invoices: [
    { icon: CheckCircle, label: 'Mark Paid', action: 'mark_paid' },
    { icon: Bell, label: 'Send Reminder', action: 'send_reminder' },
    { icon: StickyNote, label: 'Add Note', action: 'add_note' },
  ],
  drivers: [
    { icon: Route, label: 'Create Route', action: 'create_route' },
    { icon: Send, label: 'Send Message', action: 'send_message' },
    { icon: StickyNote, label: 'Add Note', action: 'add_note' },
  ],
  deliveries: [
    { icon: CheckCircle, label: 'Mark Complete', action: 'mark_complete' },
    { icon: Truck, label: 'Reassign', action: 'reassign' },
    { icon: StickyNote, label: 'Add Note', action: 'add_note' },
  ],
  orders: [
    { icon: CheckCircle, label: 'Update Status', action: 'update_status' },
    { icon: Send, label: 'Send Update', action: 'send_update' },
    { icon: StickyNote, label: 'Add Note', action: 'add_note' },
  ],
  routes: [
    { icon: Truck, label: 'Assign Driver', action: 'assign_driver' },
    { icon: Send, label: 'Send to Driver', action: 'send_to_driver' },
    { icon: StickyNote, label: 'Add Note', action: 'add_note' },
  ],
  ambassadors: [
    { icon: MessageSquare, label: 'Send Message', action: 'send_message' },
    { icon: FileText, label: 'View Report', action: 'view_report' },
    { icon: StickyNote, label: 'Add Note', action: 'add_note' },
  ],
  commissions: [
    { icon: CheckCircle, label: 'Mark Paid', action: 'mark_paid' },
    { icon: FileText, label: 'Generate Receipt', action: 'generate_receipt' },
    { icon: StickyNote, label: 'Add Note', action: 'add_note' },
  ],
};

export function QuickActions({ entity, entityId, entityData, onAction }: QuickActionsProps) {
  const actions = entityActions[entity] || [];

  if (actions.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground">Quick Actions</h4>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.action}
              variant={action.variant || 'outline'}
              size="sm"
              onClick={() => onAction(action.action, { entityId, entityData })}
              className="gap-1.5"
            >
              <Icon className="h-3.5 w-3.5" />
              {action.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
