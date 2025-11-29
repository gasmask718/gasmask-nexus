// Phase 11B - Universal Insight Panel Component

import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Route, Truck, MessageSquare, Phone, FileText, DollarSign, 
  Package, Users, Zap, ExternalLink, CheckSquare, ListChecks,
  Brain, Store, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/usePermissions';

export type InsightType = 
  | 'unpaid_stores' 
  | 'low_stock' 
  | 'new_stores'
  | 'inactive_ambassadors'
  | 'pending_orders'
  | 'delivery_bottleneck'
  | 'communication_gap'
  | 'payment_alerts'
  | 'ai_priority'
  | 'declining_brand'
  | 'unassigned_deliveries'
  | 'restock_needed'
  | 'driver_issues'
  | 'wholesale_pending';

export interface InsightRecord {
  id: string;
  name: string;
  subtitle?: string;
  status?: string;
  value?: string | number;
  metadata?: Record<string, unknown>;
}

export interface InsightAction {
  id: string;
  label: string;
  icon: React.ElementType;
  variant?: 'default' | 'secondary' | 'outline' | 'destructive';
  requiresSelection?: boolean;
  bulkEnabled?: boolean;
  requiredRole?: string[];
  onClick: (selectedIds: string[], records: InsightRecord[]) => void;
}

interface InsightPanelProps {
  isOpen: boolean;
  onClose: () => void;
  type: InsightType;
  title: string;
  description?: string;
  records: InsightRecord[];
  actions?: InsightAction[];
  aiSuggestions?: string[];
  isLoading?: boolean;
}

export function InsightPanel({
  isOpen,
  onClose,
  type,
  title,
  description,
  records,
  actions = [],
  aiSuggestions = [],
  isLoading = false,
}: InsightPanelProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('details');
  const { role, canCreate, canUpdate } = usePermissions();

  const isVA = role === 'csr'; // VA/CSR role
  const isDriver = role === 'driver';
  const canBulkAction = !isVA && !isDriver;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === records.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(records.map(r => r.id));
    }
  };

  const handleAction = (action: InsightAction) => {
    if (action.requiresSelection && selectedIds.length === 0) {
      toast.warning('Please select at least one item');
      return;
    }
    
    const selectedRecords = records.filter(r => selectedIds.includes(r.id));
    action.onClick(selectedIds, action.requiresSelection ? selectedRecords : records);
  };

  // Filter actions based on permissions
  const availableActions = actions.filter(action => {
    if (action.requiredRole && !action.requiredRole.includes(role || '')) {
      return false;
    }
    if (action.bulkEnabled && !canBulkAction) {
      return false;
    }
    return true;
  });

  const singleActions = availableActions.filter(a => !a.bulkEnabled);
  const bulkActions = availableActions.filter(a => a.bulkEnabled);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col h-full">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {records.length} {records.length === 1 ? 'item' : 'items'}
            </Badge>
            {type.includes('ai') && (
              <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/30 text-xs">
                <Brain className="h-3 w-3 mr-1" />
                AI Insight
              </Badge>
            )}
          </div>
          <SheetTitle className="text-lg">{title}</SheetTitle>
          {description && (
            <SheetDescription className="text-sm">{description}</SheetDescription>
          )}
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="details" className="text-xs">
              <ListChecks className="h-3 w-3 mr-1" />
              Details
            </TabsTrigger>
            <TabsTrigger value="actions" className="text-xs" disabled={!canBulkAction}>
              <Zap className="h-3 w-3 mr-1" />
              Bulk Actions
            </TabsTrigger>
            <TabsTrigger value="ai" className="text-xs">
              <Brain className="h-3 w-3 mr-1" />
              AI Suggestions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="flex-1 min-h-0 mt-4">
            <div className="space-y-3 h-full flex flex-col">
              {/* Select All */}
              {canBulkAction && records.length > 0 && (
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      checked={selectedIds.length === records.length && records.length > 0}
                      onCheckedChange={selectAll}
                    />
                    <span className="text-xs text-muted-foreground">
                      {selectedIds.length > 0 ? `${selectedIds.length} selected` : 'Select all'}
                    </span>
                  </div>
                </div>
              )}

              {/* Records List */}
              <ScrollArea className="flex-1">
                <div className="space-y-2 pr-4">
                  {isLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading...</div>
                  ) : records.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No records found</div>
                  ) : (
                    records.map((record) => (
                      <div
                        key={record.id}
                        className={`p-3 rounded-lg border transition-colors ${
                          selectedIds.includes(record.id)
                            ? 'bg-primary/5 border-primary/30'
                            : 'bg-muted/30 hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {canBulkAction && (
                            <Checkbox
                              checked={selectedIds.includes(record.id)}
                              onCheckedChange={() => toggleSelect(record.id)}
                              className="mt-1"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium truncate">{record.name}</p>
                              {record.status && (
                                <Badge variant="outline" className="text-[10px] ml-2">
                                  {record.status}
                                </Badge>
                              )}
                            </div>
                            {record.subtitle && (
                              <p className="text-xs text-muted-foreground mt-0.5">{record.subtitle}</p>
                            )}
                            {record.value && (
                              <p className="text-xs font-medium text-primary mt-1">{record.value}</p>
                            )}
                          </div>
                        </div>
                        
                        {/* Quick Actions */}
                        <div className="flex gap-1 mt-2 ml-7">
                          {singleActions.slice(0, 4).map((action) => (
                            <Button
                              key={action.id}
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() => action.onClick([record.id], [record])}
                            >
                              <action.icon className="h-3 w-3 mr-1" />
                              {action.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="actions" className="flex-1 mt-4">
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Apply actions to {selectedIds.length > 0 ? `${selectedIds.length} selected` : 'all'} items
              </p>
              
              <div className="grid grid-cols-2 gap-2">
                {bulkActions.map((action) => (
                  <Button
                    key={action.id}
                    variant={action.variant || 'outline'}
                    className="h-auto py-3 flex-col gap-1"
                    onClick={() => handleAction(action)}
                    disabled={action.requiresSelection && selectedIds.length === 0}
                  >
                    <action.icon className="h-5 w-5" />
                    <span className="text-xs">{action.label}</span>
                  </Button>
                ))}
              </div>

              {bulkActions.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">
                  No bulk actions available for this panel
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="ai" className="flex-1 mt-4">
            <div className="space-y-3">
              {aiSuggestions.length > 0 ? (
                aiSuggestions.map((suggestion, i) => (
                  <div key={i} className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20">
                    <div className="flex items-start gap-2">
                      <Brain className="h-4 w-4 text-purple-500 mt-0.5" />
                      <p className="text-sm">{suggestion}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <Brain className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No AI suggestions available</p>
                </div>
              )}
              
              <Separator />
              
              <Button variant="outline" className="w-full" onClick={() => toast.info('Queuing tasks...')}>
                <Zap className="h-4 w-4 mr-2" />
                Queue All as Autopilot Tasks
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

// Default actions for common insight types
export function getDefaultActions(type: InsightType): InsightAction[] {
  const storeActions: InsightAction[] = [
    {
      id: 'route',
      label: 'Send to Route',
      icon: Route,
      bulkEnabled: true,
      onClick: (ids) => toast.success(`Added ${ids.length} stores to route planner`),
    },
    {
      id: 'assign_driver',
      label: 'Assign Driver',
      icon: Truck,
      bulkEnabled: true,
      onClick: (ids) => toast.success(`Assigning driver to ${ids.length} stores`),
    },
    {
      id: 'message',
      label: 'Message',
      icon: MessageSquare,
      onClick: (ids) => toast.info(`Opening message for ${ids.length} stores`),
    },
    {
      id: 'call',
      label: 'Call',
      icon: Phone,
      onClick: ([id]) => toast.info(`Calling store ${id}`),
    },
    {
      id: 'open_crm',
      label: 'Open CRM',
      icon: ExternalLink,
      onClick: ([id]) => toast.info(`Opening CRM for ${id}`),
    },
  ];

  const collectionActions: InsightAction[] = [
    {
      id: 'collection',
      label: 'Start Collection',
      icon: DollarSign,
      bulkEnabled: true,
      onClick: (ids) => toast.success(`Started collection for ${ids.length} accounts`),
    },
    {
      id: 'invoice',
      label: 'Open Invoice',
      icon: FileText,
      onClick: ([id]) => toast.info(`Opening invoice for ${id}`),
    },
    {
      id: 'payment_request',
      label: 'Send Payment Request',
      icon: MessageSquare,
      bulkEnabled: true,
      onClick: (ids) => toast.success(`Sent payment requests to ${ids.length} accounts`),
    },
  ];

  const inventoryActions: InsightAction[] = [
    {
      id: 'restock',
      label: 'Restock',
      icon: Package,
      bulkEnabled: true,
      onClick: (ids) => toast.success(`Created restock task for ${ids.length} items`),
    },
    {
      id: 'production',
      label: 'Create Batch',
      icon: Zap,
      onClick: () => toast.info('Opening production batch form'),
    },
  ];

  const ambassadorActions: InsightAction[] = [
    {
      id: 'message',
      label: 'Message',
      icon: MessageSquare,
      bulkEnabled: true,
      onClick: (ids) => toast.success(`Messaging ${ids.length} ambassadors`),
    },
    {
      id: 'assign_stores',
      label: 'Assign Stores',
      icon: Store,
      onClick: (ids) => toast.info(`Assigning stores to ${ids.length} ambassadors`),
    },
  ];

  const wholesaleActions: InsightAction[] = [
    {
      id: 'approve',
      label: 'Approve Order',
      icon: CheckSquare,
      bulkEnabled: true,
      onClick: (ids) => toast.success(`Approved ${ids.length} orders`),
    },
    {
      id: 'fulfill',
      label: 'Move to Fulfillment',
      icon: Package,
      bulkEnabled: true,
      onClick: (ids) => toast.success(`Moved ${ids.length} orders to fulfillment`),
    },
    {
      id: 'invoice',
      label: 'Send Invoice',
      icon: FileText,
      bulkEnabled: true,
      onClick: (ids) => toast.success(`Sent invoices for ${ids.length} orders`),
    },
  ];

  switch (type) {
    case 'unpaid_stores':
    case 'payment_alerts':
      return [...storeActions, ...collectionActions];
    case 'low_stock':
    case 'restock_needed':
      return [...storeActions, ...inventoryActions];
    case 'new_stores':
    case 'delivery_bottleneck':
    case 'communication_gap':
    case 'unassigned_deliveries':
      return storeActions;
    case 'inactive_ambassadors':
      return ambassadorActions;
    case 'pending_orders':
    case 'wholesale_pending':
      return wholesaleActions;
    case 'ai_priority':
    case 'declining_brand':
      return [...storeActions, { 
        id: 'queue_task', 
        label: 'Queue Task', 
        icon: Zap, 
        bulkEnabled: true,
        onClick: (ids) => toast.success(`Queued ${ids.length} tasks`) 
      }];
    default:
      return storeActions;
  }
}

// Helper to get insight title and description
export function getInsightMeta(type: InsightType): { title: string; description: string } {
  const meta: Record<InsightType, { title: string; description: string }> = {
    unpaid_stores: { title: 'Unpaid Stores', description: 'Stores with outstanding balances requiring collection' },
    low_stock: { title: 'Low Stock Stores', description: 'Stores running low on inventory' },
    new_stores: { title: 'New Stores', description: 'Recently onboarded stores' },
    inactive_ambassadors: { title: 'Inactive Ambassadors', description: 'Ambassadors with no recent activity' },
    pending_orders: { title: 'Pending Orders', description: 'Orders awaiting processing' },
    delivery_bottleneck: { title: 'Delivery Bottlenecks', description: 'Stores with delivery delays' },
    communication_gap: { title: 'Communication Gap', description: 'Stores not contacted recently' },
    payment_alerts: { title: 'Payment Alerts', description: 'Accounts requiring payment attention' },
    ai_priority: { title: 'AI Priority Stores', description: 'AI-recommended stores to check' },
    declining_brand: { title: 'Declining Performance', description: 'Brands showing negative trends' },
    unassigned_deliveries: { title: 'Unassigned Deliveries', description: 'Deliveries needing driver assignment' },
    restock_needed: { title: 'Restock Needed', description: 'Items requiring replenishment' },
    driver_issues: { title: 'Driver Issues', description: 'Drivers with reported problems' },
    wholesale_pending: { title: 'Wholesale Pending', description: 'Wholesale orders awaiting action' },
  };
  return meta[type] || { title: 'Insight Panel', description: '' };
}
