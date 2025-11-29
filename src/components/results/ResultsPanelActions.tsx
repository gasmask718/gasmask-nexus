// ═══════════════════════════════════════════════════════════════════════════════
// RESULTS PANEL ACTIONS — Action Buttons Based on Panel Type
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  Route,
  UserPlus,
  Phone,
  MessageSquare,
  Download,
  CheckCircle,
  FileText,
  StickyNote,
  Truck,
  XCircle,
  MapPin,
  Package,
  Printer,
  DollarSign,
  Mail,
  Users,
  MoreHorizontal,
  Calendar,
} from 'lucide-react';
import { exportData } from '@/utils/exportUtils';
import { QueryResult } from '@/lib/commands/CommandEngine';
import { executeAction } from '@/lib/commands/ExecutionEngine';
import { useGrabbaPermissions } from '@/hooks/useGrabbaPermissions';
import { usePermissions } from '@/hooks/usePermissions';
import { SendToRouteModal } from '@/components/scheduling/SendToRouteModal';

export type PanelType = 'stores' | 'deliveries' | 'inventory' | 'finance' | 'ambassadors' | 'drivers' | 'wholesale';

interface ResultsPanelActionsProps {
  panelType: PanelType;
  selectedResults: QueryResult[];
  allResults: QueryResult[];
  brand?: string;
  onActionComplete?: () => void;
}

export function ResultsPanelActions({
  panelType,
  selectedResults,
  allResults,
  brand,
  onActionComplete,
}: ResultsPanelActionsProps) {
  const { role, isAdmin } = useGrabbaPermissions();
  const { canUpdate } = usePermissions();
  const hasSelection = selectedResults.length > 0;
  const targetResults = hasSelection ? selectedResults : allResults;

  const [showRouteModal, setShowRouteModal] = useState(false);

  const canPerformActions = isAdmin || ['admin', 'employee', 'csr'].includes(role || '');

  const handleExport = () => {
    const exportColumns = [
      { key: 'title', label: 'Name' },
      { key: 'subtitle', label: 'Details' },
      { key: 'type', label: 'Type' },
    ];
    
    exportData({
      filename: `${panelType}-export`,
      format: 'csv',
      data: targetResults.map(r => ({
        title: r.title,
        subtitle: r.subtitle,
        type: r.type,
        ...r.data,
      })),
      columns: exportColumns,
    });
    
    toast.success(`Exported ${targetResults.length} records`);
  };

  const handleAction = async (actionType: string) => {
    if (!canPerformActions) {
      toast.error("You don't have permission to perform this action");
      return;
    }

    // Special handling for route_planner
    if (actionType === 'route_planner') {
      setShowRouteModal(true);
      return;
    }

    try {
      const entityIds = targetResults.map(r => r.id);
      
      switch (actionType) {
        case 'assign_driver':
          await executeAction('assign_driver', { entityIds });
          toast.success(`Assigned ${targetResults.length} items to driver`);
          break;
        case 'send_text':
          await executeAction('send_text', { entityIds });
          toast.success(`Sent text to ${targetResults.length} contacts`);
          break;
        case 'mark_completed':
          await executeAction('update_invoice_status', { entityIds, status: 'completed' });
          toast.success(`Marked ${targetResults.length} items as completed`);
          break;
        case 'mark_paid':
          await executeAction('update_invoice_status', { entityIds, status: 'paid' });
          toast.success(`Marked ${targetResults.length} invoices as paid`);
          break;
        default:
          toast.info(`Action "${actionType}" triggered for ${targetResults.length} items`);
      }
      
      onActionComplete?.();
    } catch (error) {
      toast.error('Action failed');
    }
  };

  // Action configurations per panel type
  const actionConfigs: Record<PanelType, ActionConfig[]> = {
    stores: [
      { id: 'route_planner', icon: Route, label: 'Send to Route', primary: true },
      { id: 'assign_driver', icon: UserPlus, label: 'Assign to Driver' },
      { id: 'call_all', icon: Phone, label: 'Call All' },
      { id: 'send_text', icon: MessageSquare, label: 'Text All' },
      { id: 'mark_completed', icon: CheckCircle, label: 'Mark Completed' },
      { id: 'create_invoice', icon: FileText, label: 'Create Invoice' },
      { id: 'add_note', icon: StickyNote, label: 'Add Note' },
    ],
    deliveries: [
      { id: 'assign_driver', icon: Truck, label: 'Assign Driver', primary: true },
      { id: 'mark_completed', icon: CheckCircle, label: 'Mark Completed' },
      { id: 'mark_failed', icon: XCircle, label: 'Mark Failed' },
      { id: 'route_planner', icon: MapPin, label: 'Send to Route' },
    ],
    inventory: [
      { id: 'adjust_stock', icon: Package, label: 'Adjust Stock', primary: true },
      { id: 'assign_batch', icon: Route, label: 'Assign to Batch' },
      { id: 'mark_out', icon: XCircle, label: 'Mark Out of Stock' },
      { id: 'print_labels', icon: Printer, label: 'Print Labels' },
    ],
    finance: [
      { id: 'mark_paid', icon: DollarSign, label: 'Mark Paid', primary: true },
      { id: 'create_invoice', icon: FileText, label: 'Generate Invoice' },
      { id: 'send_text', icon: MessageSquare, label: 'Contact Store' },
      { id: 'send_email', icon: Mail, label: 'Send Reminder' },
      { id: 'schedule_followup', icon: Calendar, label: 'Schedule Follow-up' },
    ],
    ambassadors: [
      { id: 'assign_stores', icon: Users, label: 'Assign Stores', primary: true },
      { id: 'adjust_payout', icon: DollarSign, label: 'Adjust Payout' },
      { id: 'send_text', icon: MessageSquare, label: 'Message' },
    ],
    drivers: [
      { id: 'route_planner', icon: Route, label: 'Create Route', primary: true },
      { id: 'send_text', icon: MessageSquare, label: 'Send Message' },
      { id: 'adjust_payout', icon: DollarSign, label: 'Process Payment' },
    ],
    wholesale: [
      { id: 'push_marketplace', icon: Package, label: 'Push to Marketplace', primary: true },
      { id: 'notify_stores', icon: MessageSquare, label: 'Notify Stores' },
      { id: 'adjust_price', icon: DollarSign, label: 'Adjust Pricing' },
    ],
  };

  const actions = actionConfigs[panelType] || [];
  const primaryAction = actions.find(a => a.primary);
  const secondaryActions = actions.filter(a => !a.primary);

  // Get store IDs for route modal
  const storeIds = targetResults.map(r => r.id);

  return (
    <>
      <div className="sticky bottom-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t border-border px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            {hasSelection ? (
              <span className="font-medium text-foreground">{selectedResults.length} selected</span>
            ) : (
              <span>{allResults.length} total results</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Primary Action */}
            {primaryAction && (
              <Button onClick={() => handleAction(primaryAction.id)} className="gap-2">
                <primaryAction.icon className="h-4 w-4" />
                {primaryAction.label}
                {hasSelection && <span>({selectedResults.length})</span>}
              </Button>
            )}

            {/* Secondary Actions Dropdown */}
            {secondaryActions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <MoreHorizontal className="h-4 w-4" />
                    More Actions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {secondaryActions.map((action) => (
                    <DropdownMenuItem
                      key={action.id}
                      onClick={() => handleAction(action.id)}
                      className="gap-2"
                    >
                      <action.icon className="h-4 w-4" />
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleExport} className="gap-2">
                    <Download className="h-4 w-4" />
                    Export Data
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Export Button (always visible) */}
            <Button variant="outline" size="icon" onClick={handleExport}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Send to Route Modal */}
      <SendToRouteModal
        open={showRouteModal}
        onOpenChange={setShowRouteModal}
        storeIds={storeIds}
        brand={brand}
        onSuccess={onActionComplete}
      />
    </>
  );
}

interface ActionConfig {
  id: string;
  icon: React.ElementType;
  label: string;
  primary?: boolean;
}

export default ResultsPanelActions;
