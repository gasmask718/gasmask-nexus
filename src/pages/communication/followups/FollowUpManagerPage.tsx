import { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Clock, AlertTriangle, CheckCircle, Zap, Search, Filter, Calendar, Phone, MessageSquare, User, Building2, Layers } from 'lucide-react';
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
import { RescheduleDialog } from '@/components/communication/followups/RescheduleDialog';

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
  const [activeTab, setActiveTab] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [sortBy, setSortBy] = useState('due_at');
  const [rescheduleItem, setRescheduleItem] = useState<FollowUpQueueItem | null>(null);

  const { data: stats } = useFollowUpQueueStats();
  const { data: pendingFollowUps, isLoading: pendingLoading } = usePendingFollowUps();
  const { data: dueTodayFollowUps, isLoading: dueTodayLoading } = useDueTodayFollowUps();
  const { data: overdueFollowUps, isLoading: overdueLoading } = useOverdueFollowUps();
  const { data: completedFollowUps, isLoading: completedLoading } = useCompletedFollowUps();

  const completeFollowUp = useCompleteFollowUp();
  const cancelFollowUp = useCancelFollowUp();
  const triggerFollowUp = useTriggerFollowUpNow();
  const runEngine = useRunFollowUpEngine();

  const handleTrigger = (id: string) => triggerFollowUp.mutate(id);
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

  // Filter and sort function
  const filterAndSort = (items: FollowUpQueueItem[] | undefined) => {
    if (!items) return [];
    
    let filtered = items.filter(item => {
      const matchesSearch = !searchQuery || 
        item.store?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.business?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesReason = reasonFilter === 'all' || item.reason === reasonFilter;
      const matchesAction = actionFilter === 'all' || item.recommended_action === actionFilter;
      return matchesSearch && matchesReason && matchesAction;
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
        {filtered.map((fu) => (
          <FollowUpCard 
            key={fu.id} 
            followUp={fu} 
            onTrigger={showActions ? handleTrigger : undefined}
            onComplete={showActions ? handleComplete : undefined}
            onCancel={showActions ? handleCancel : undefined}
            onReschedule={showActions ? handleReschedule : undefined}
            isLoading={triggerFollowUp.isPending}
          />
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
    </div>
  );
}
