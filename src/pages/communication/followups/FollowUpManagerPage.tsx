import { useState, useMemo, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Clock, AlertTriangle, CheckCircle, Zap, Search, Filter, Calendar, Phone, MessageSquare, User, Building2, Layers, Users } from 'lucide-react';
import {
  usePendingFollowUps,
  useDueTodayFollowUps,
  useOverdueFollowUps,
  useCompletedFollowUps,
  useFollowUpQueueStats,
  useCompleteFollowUp,
  useCancelFollowUp,
  useTriggerFollowUpNow,
  useRunFollowUpEngine,
  type FollowUpQueueItem,
} from '@/hooks/useFollowUps';
import { FollowUpCard } from '@/components/communication/followups/FollowUpCard';
import { FollowUpExecutionBar, type ExecutionTarget } from '@/components/communication/followups/FollowUpExecutionBar';
import { RescheduleDialog } from '@/components/communication/followups/RescheduleDialog';
import { triggerFollowUp as triggerFollowUpAction } from '@/services/followUpTriggerService';
import { toast } from 'sonner';
import { ContactCadenceBoard, CadenceQuickStats } from '@/components/communication/cadence';
import { useContactCadenceStats } from '@/hooks/useContactCadence';
import type { CadenceFilter } from '@/hooks/useContactCadence';
import { useStoreContactIntelligence } from '@/hooks/useStoreContactIntelligence';
import { usePriorCustomerSegmentMap, FLOW_STATUS_META, FLOW_STATUS_ORDER, type FlowStatus } from '@/hooks/usePriorCustomerSegmentMap';
import { Sparkles } from 'lucide-react';

type CustomerStatusFilter = 'all' | FlowStatus | 'prospect';
const CUSTOMER_STATUS_OPTIONS: { value: CustomerStatusFilter; label: string }[] = [
  { value: 'all', label: 'All Customers' },
  { value: 'active_flow', label: '🟢 Active Flow' },
  { value: 'recently_quiet', label: '🟡 Recently Quiet' },
  { value: 'cold', label: '🔴 Cold' },
  { value: 'long_dormant', label: '⚫ Long Dormant' },
  { value: 'prospect', label: '✨ Prospects (no orders)' },
];

const REASON_OPTIONS = [
  { value: 'all', label: 'All Reasons' },
  { value: 'no_response', label: 'No Response' },
  { value: 'low_stock', label: 'Low Stock' },
  { value: 'churn_risk', label: 'Churn Risk' },
  { value: 'deal_stalled', label: 'Deal Stalled' },
  { value: 'delivery_followup', label: 'Delivery Follow-Up' },
  { value: 'onboarding', label: 'New Store Onboarding' },
  { value: 'positive_sentiment', label: 'Positive Sentiment' },
  { value: 'negative_sentiment', label: 'Negative Sentiment' },
];

const ACTION_OPTIONS = [
  { value: 'all', label: 'All Actions' },
  { value: 'ai_call', label: 'AI Call' },
  { value: 'ai_text', label: 'AI Text' },
  { value: 'manual_call', label: 'Manual Call' },
  { value: 'manual_text', label: 'Manual Text' },
];

const SORT_OPTIONS = [
  { value: 'due_at', label: 'Due Date' },
  { value: 'priority', label: 'Priority' },
  { value: 'created_at', label: 'Created Date' },
];

export default function FollowUpManagerPage() {
  const [activeTab, setActiveTab] = useState('cadence');
  const [searchQuery, setSearchQuery] = useState('');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [sortBy, setSortBy] = useState('due_at');
  const [rescheduleItem, setRescheduleItem] = useState<FollowUpQueueItem | null>(null);
  const [cadenceFilter, setCadenceFilter] = useState<CadenceFilter>('all');
  const [customerStatusFilter, setCustomerStatusFilter] = useState<CustomerStatusFilter>('all');
  const [priorCustomerBucket, setPriorCustomerBucket] = useState<FlowStatus | 'all'>('all');
  const [executionTargets, setExecutionTargets] = useState<ExecutionTarget[]>([]);

  const { map: priorCustomerMap, counts: priorCustomerCounts } = usePriorCustomerSegmentMap();

  const { data: stats } = useFollowUpQueueStats();
  const { data: cadenceStats } = useContactCadenceStats();
  const { data: pendingFollowUps, isLoading: pendingLoading } = usePendingFollowUps();
  const { data: dueTodayFollowUps, isLoading: dueTodayLoading } = useDueTodayFollowUps();
  const { data: overdueFollowUps, isLoading: overdueLoading } = useOverdueFollowUps();
  const { data: completedFollowUps, isLoading: completedLoading } = useCompletedFollowUps();

  const completeFollowUp = useCompleteFollowUp();
  const cancelFollowUp = useCancelFollowUp();
  const triggerFollowUp = useTriggerFollowUpNow();
  const runEngine = useRunFollowUpEngine();

  const handleTrigger = async (id: string) => {
    const followUp = [...(pendingFollowUps || []), ...(dueTodayFollowUps || []), ...(overdueFollowUps || [])].find(f => f.id === id);
    if (followUp) {
      const result = await triggerFollowUpAction(followUp);
      if (result.success) {
        toast.success(result.message);
        triggerFollowUp.mutate(id); // Also update local state
      } else {
        toast.error(result.message);
      }
    }
  };
  const handleComplete = (id: string) => completeFollowUp.mutate(id);
  const handleCancel = (id: string) => cancelFollowUp.mutate(id);
  const handleReschedule = (item: FollowUpQueueItem) => setRescheduleItem(item);

  // Combine all follow-ups for grouped views
  const allFollowUps = useMemo(() => {
    const all = [
      ...(pendingFollowUps || []),
      ...(dueTodayFollowUps || []),
      ...(overdueFollowUps || []),
    ];
    // Remove duplicates
    return Array.from(new Map(all.map(item => [item.id, item])).values());
  }, [pendingFollowUps, dueTodayFollowUps, overdueFollowUps]);

  // Fetch contact intelligence for all visible stores
  const storeIds = useMemo(() => {
    const ids = new Set<string>();
    allFollowUps.forEach(f => { if (f.store_id) ids.add(f.store_id); });
    return Array.from(ids);
  }, [allFollowUps]);
  const { data: intelligenceMap } = useStoreContactIntelligence(storeIds);

  const selectedContactIds = useMemo(
    () => new Set(executionTargets.filter(t => t.source === 'cadence' && t.contact_id).map(t => t.contact_id as string)),
    [executionTargets]
  );

  const selectedFollowUpIds = useMemo(
    () => new Set(executionTargets.filter(t => t.source === 'followup' && t.follow_up_id).map(t => t.follow_up_id as string)),
    [executionTargets]
  );

  const handleClearSelection = useCallback(() => {
    setExecutionTargets([]);
  }, []);

  const handleExecutionComplete = useCallback(() => {
    handleClearSelection();
  }, [handleClearSelection]);

  const handleCadenceSelectionChange = useCallback((targets: ExecutionTarget[]) => {
    setExecutionTargets(prev => [...prev.filter(t => t.source !== 'cadence'), ...targets]);
  }, []);

  const toggleFollowUpSelection = useCallback((item: FollowUpQueueItem) => {
    if (!item.store_id) return;

    setExecutionTargets(prev => {
      const exists = prev.some(t => t.source === 'followup' && t.follow_up_id === item.id);
      if (exists) return prev.filter(t => !(t.source === 'followup' && t.follow_up_id === item.id));

      return [
        ...prev,
        {
          store_id: item.store_id,
          source: 'followup',
          reason: item.reason,
          follow_up_id: item.id,
          priority: item.priority,
          business_id: item.business_id,
        },
      ];
    });
  }, []);

  // Filter and sort function
  const filterAndSort = (items: FollowUpQueueItem[] | undefined) => {
    if (!items) return [];
    
    let filtered = items.filter(item => {
      const matchesSearch = !searchQuery || 
        item.store?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.business?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesReason = reasonFilter === 'all' || item.reason === reasonFilter;
      const matchesAction = actionFilter === 'all' || item.recommended_action === actionFilter;
      let matchesCustomer = true;
      if (customerStatusFilter !== 'all') {
        const seg = item.store_id ? priorCustomerMap.get(item.store_id) : undefined;
        if (customerStatusFilter === 'prospect') {
          matchesCustomer = !seg;
        } else {
          matchesCustomer = seg?.flow_status === customerStatusFilter;
        }
      }
      return matchesSearch && matchesReason && matchesAction && matchesCustomer;
    });

    filtered.sort((a, b) => {
      if (sortBy === 'priority') return (a.priority || 5) - (b.priority || 5);
      if (sortBy === 'due_at') return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return filtered;
  };

  // Group by reason
  const groupedByReason = useMemo(() => {
    const groups: Record<string, FollowUpQueueItem[]> = {};
    allFollowUps.forEach(item => {
      const reason = item.reason || 'other';
      if (!groups[reason]) groups[reason] = [];
      groups[reason].push(item);
    });
    return groups;
  }, [allFollowUps]);

  // Group by action
  const groupedByAction = useMemo(() => {
    const groups: Record<string, FollowUpQueueItem[]> = {};
    allFollowUps.forEach(item => {
      const action = item.recommended_action || 'unknown';
      if (!groups[action]) groups[action] = [];
      groups[action].push(item);
    });
    return groups;
  }, [allFollowUps]);

  // Group by vertical
  const groupedByVertical = useMemo(() => {
    const groups: Record<string, FollowUpQueueItem[]> = {};
    allFollowUps.forEach(item => {
      const vertical = item.vertical?.name || 'No Vertical';
      if (!groups[vertical]) groups[vertical] = [];
      groups[vertical].push(item);
    });
    return groups;
  }, [allFollowUps]);

  // Group by business
  const groupedByBusiness = useMemo(() => {
    const groups: Record<string, FollowUpQueueItem[]> = {};
    allFollowUps.forEach(item => {
      const business = item.business?.name || 'No Business';
      if (!groups[business]) groups[business] = [];
      groups[business].push(item);
    });
    return groups;
  }, [allFollowUps]);

  const renderFollowUpList = (items: FollowUpQueueItem[] | undefined, isLoading: boolean, emptyMessage: string, showActions = true) => {
    const filtered = filterAndSort(items);
    if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
    if (!filtered.length) return <div className="text-center py-8 text-muted-foreground">{emptyMessage}</div>;
    return (
      <div className="grid gap-4">
        {showActions && filtered.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const selectableTargets = filtered
                  .filter(f => !!f.store_id)
                  .map((f) => ({
                    store_id: f.store_id as string,
                    source: 'followup' as const,
                    reason: f.reason,
                    follow_up_id: f.id,
                    priority: f.priority,
                    business_id: f.business_id,
                  }));

                const allSelected = selectableTargets.every(f => selectedFollowUpIds.has(f.follow_up_id as string));
                setExecutionTargets(prev => {
                  const withoutFollowUps = prev.filter(t => t.source !== 'followup');
                  return allSelected ? withoutFollowUps : [...withoutFollowUps, ...selectableTargets];
                });
              }}
            >
              {filtered.every(f => selectedFollowUpIds.has(f.id)) ? 'Deselect All' : `Select All (${filtered.length})`}
            </Button>
            {Array.from(selectedFollowUpIds).length > 0 && (
              <Badge variant="secondary">{Array.from(selectedFollowUpIds).length} selected</Badge>
            )}
          </div>
        )}
        {filtered.map((fu) => (
          <div key={fu.id} className="flex items-start gap-3">
            {showActions && (
              <input
                type="checkbox"
                className="mt-5 h-4 w-4 rounded border-border accent-primary"
                checked={selectedFollowUpIds.has(fu.id)}
                onChange={() => toggleFollowUpSelection(fu)}
              />
            )}
            <div className="flex-1">
              <FollowUpCard 
                followUp={fu} 
                onTrigger={showActions ? handleTrigger : undefined}
                onComplete={showActions ? handleComplete : undefined}
                onCancel={showActions ? handleCancel : undefined}
                onReschedule={showActions ? handleReschedule : undefined}
                isLoading={triggerFollowUp.isPending}
                pickupProbability={fu.store_id ? intelligenceMap?.get(fu.store_id)?.pickup_probability ?? null : null}
              />
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderGroupedSection = (groups: Record<string, FollowUpQueueItem[]>, icon: React.ReactNode) => (
    <div className="space-y-6">
      {Object.entries(groups).map(([key, items]) => (
        <div key={key} className="space-y-3">
          <div className="flex items-center gap-2 text-lg font-semibold">
            {icon}
            <span className="capitalize">{key.replace(/_/g, ' ')}</span>
            <Badge variant="secondary">{items.length}</Badge>
          </div>
          <div className="grid gap-3">
            {filterAndSort(items).map((fu) => (
              <FollowUpCard 
                key={fu.id} 
                followUp={fu} 
                onTrigger={handleTrigger}
                onComplete={handleComplete}
                onCancel={handleCancel}
                onReschedule={handleReschedule}
                isLoading={triggerFollowUp.isPending}
                pickupProbability={fu.store_id ? intelligenceMap?.get(fu.store_id)?.pickup_probability ?? null : null}
              />
            ))}
          </div>
        </div>
      ))}
      {Object.keys(groups).length === 0 && (
        <div className="text-center py-8 text-muted-foreground">No follow-ups to display</div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Follow-Up Manager</h1>
          <p className="text-muted-foreground">Automated follow-up detection, scheduling, and execution</p>
        </div>
        <Button variant="outline" onClick={() => runEngine.mutate()} disabled={runEngine.isPending}>
          <RefreshCw className={`h-4 w-4 mr-2 ${runEngine.isPending ? 'animate-spin' : ''}`} />
          Run Engine
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-orange-500/10 text-orange-500">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats?.pending || 0}</div>
              <div className="text-sm text-muted-foreground">Pending</div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-blue-500/10 text-blue-500">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats?.dueToday || 0}</div>
              <div className="text-sm text-muted-foreground">Due Today</div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats?.overdue || 0}</div>
              <div className="text-sm text-muted-foreground">Overdue</div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-full bg-green-500/10 text-green-500">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats?.completed || 0}</div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search stores, businesses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-0 bg-transparent shadow-none focus-visible:ring-0"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={reasonFilter} onValueChange={setReasonFilter}>
                <SelectTrigger className="w-[160px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Reason" />
                </SelectTrigger>
                <SelectContent>
                  {REASON_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[150px]">
                  <Phone className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={customerStatusFilter} onValueChange={(v) => setCustomerStatusFilter(v as CustomerStatusFilter)}>
                <SelectTrigger className="w-[200px]">
                  <Sparkles className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Customer Status" />
                </SelectTrigger>
                <SelectContent>
                  {CUSTOMER_STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[140px]">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="cadence" className="gap-1">
            <Users className="h-3 w-3" />
            Contact Cadence
            {(cadenceStats?.overdue7Days || 0) + (cadenceStats?.overdue14Days || 0) > 0 && (
              <Badge variant="destructive" className="ml-1">
                {(cadenceStats?.overdue7Days || 0) + (cadenceStats?.overdue14Days || 0)}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-1">
            <Clock className="h-3 w-3" />
            Pending
            {(stats?.pending || 0) > 0 && <Badge variant="secondary" className="ml-1">{stats?.pending}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="due-today" className="gap-1">
            <Zap className="h-3 w-3" />
            Due Today
            {(stats?.dueToday || 0) > 0 && <Badge variant="secondary" className="ml-1">{stats?.dueToday}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="overdue" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            Overdue
            {(stats?.overdue || 0) > 0 && <Badge variant="destructive" className="ml-1">{stats?.overdue}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            Completed
          </TabsTrigger>
          <TabsTrigger value="prior-customers" className="gap-1">
            <Sparkles className="h-3 w-3" />
            Prior Customers
            {priorCustomerCounts.total > 0 && (
              <Badge variant="secondary" className="ml-1">{priorCustomerCounts.total}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="by-reason" className="gap-1">
            <Filter className="h-3 w-3" />
            By Reason
          </TabsTrigger>
          <TabsTrigger value="by-action" className="gap-1">
            <Phone className="h-3 w-3" />
            By Action
          </TabsTrigger>
          <TabsTrigger value="by-vertical" className="gap-1">
            <Layers className="h-3 w-3" />
            By Vertical
          </TabsTrigger>
          <TabsTrigger value="by-business" className="gap-1">
            <Building2 className="h-3 w-3" />
            By Business
          </TabsTrigger>
        </TabsList>

        {/* Contact Cadence Tab */}
        <TabsContent value="cadence" className="mt-4 space-y-6">
          <CadenceQuickStats 
            onFilterChange={setCadenceFilter} 
            activeFilter={cadenceFilter} 
          />
          <ContactCadenceBoard 
            externalFilter={cadenceFilter} 
            onFilterChange={setCadenceFilter}
            selectable
            selectedIds={selectedContactIds}
            onSelectionChange={handleCadenceSelectionChange}
          />
        </TabsContent>

        <TabsContent value="pending" className="mt-4">
          {renderFollowUpList(pendingFollowUps, pendingLoading, 'No pending follow-ups')}
        </TabsContent>

        <TabsContent value="due-today" className="mt-4">
          {renderFollowUpList(dueTodayFollowUps, dueTodayLoading, 'No follow-ups due today')}
        </TabsContent>

        <TabsContent value="overdue" className="mt-4">
          {renderFollowUpList(overdueFollowUps, overdueLoading, 'No overdue follow-ups')}
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          {renderFollowUpList(completedFollowUps, completedLoading, 'No completed follow-ups', false)}
        </TabsContent>

        <TabsContent value="by-reason" className="mt-4">
          {renderGroupedSection(groupedByReason, <Filter className="h-5 w-5 text-muted-foreground" />)}
        </TabsContent>

        <TabsContent value="by-action" className="mt-4">
          {renderGroupedSection(groupedByAction, <Phone className="h-5 w-5 text-muted-foreground" />)}
        </TabsContent>

        <TabsContent value="by-vertical" className="mt-4">
          {renderGroupedSection(groupedByVertical, <Layers className="h-5 w-5 text-muted-foreground" />)}
        </TabsContent>

        <TabsContent value="by-business" className="mt-4">
          {renderGroupedSection(groupedByBusiness, <Building2 className="h-5 w-5 text-muted-foreground" />)}
        </TabsContent>
      </Tabs>

      {/* Reschedule Dialog */}
      <RescheduleDialog 
        followUp={rescheduleItem}
        open={!!rescheduleItem}
        onOpenChange={(open) => !open && setRescheduleItem(null)}
      />

      {/* Floating Execution Bar */}
      <FollowUpExecutionBar
        executionTargets={executionTargets}
        onClear={handleClearSelection}
        onExecutionComplete={handleExecutionComplete}
      />
    </div>
  );
}
