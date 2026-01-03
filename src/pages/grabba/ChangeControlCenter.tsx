import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { GrabbaLayout } from '@/components/grabba/GrabbaLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  FileCheck, Clock, CheckCircle2, XCircle, 
  Search, Filter, RefreshCw, Eye,
  ChevronDown, ChevronUp, User, Store, Calendar,
  Shield, Zap
} from 'lucide-react';
import type { Json } from '@/integrations/supabase/types';

interface ChangeListItem {
  id: string;
  change_list_id: string;
  entity_type: string;
  entity_id: string;
  field_name: string;
  old_value: Json | null;
  new_value: Json;
  requires_note: boolean;
  change_note: string | null;
  ai_flagged: boolean;
  ai_flag_reason: string | null;
  status: string;
  created_at: string;
}

interface ChangeList {
  id: string;
  store_id: string;
  visit_id: string | null;
  submitted_by: string;
  submitted_by_role: string;
  status: string;
  ai_risk_level: string | null;
  ai_risk_flags: Json | null;
  ai_scanned_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  approved_by: string | null;
  approved_at: string | null;
  committed_at: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  store?: { store_name: string };
  items?: ChangeListItem[];
}

export default function ChangeControlCenter() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedChangeList, setSelectedChangeList] = useState<ChangeList | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');

  // Fetch change lists with items
  const { data: changeLists, isLoading, refetch } = useQuery({
    queryKey: ['change-lists-admin', selectedTab, filterRole],
    queryFn: async () => {
      let query = supabase
        .from('change_lists')
        .select(`
          *,
          store:store_master(store_name),
          items:change_list_items(*)
        `)
        .order('created_at', { ascending: false });

      if (selectedTab !== 'all') {
        query = query.eq('status', selectedTab);
      }
      if (filterRole !== 'all') {
        query = query.eq('submitted_by_role', filterRole);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as ChangeList[];
    }
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async ({ listId, itemIds, notes }: { listId: string; itemIds?: string[]; notes: string }) => {
      const now = new Date().toISOString();
      
      // If specific items, approve those items
      if (itemIds && itemIds.length > 0) {
        const { error: itemsError } = await supabase
          .from('change_list_items')
          .update({ status: 'approved' })
          .in('id', itemIds);
        if (itemsError) throw itemsError;

        // Check if all items are now reviewed
        const { data: remainingPending } = await supabase
          .from('change_list_items')
          .select('id')
          .eq('change_list_id', listId)
          .eq('status', 'pending');

        if (!remainingPending || remainingPending.length === 0) {
          // Update list status
          const { error: listError } = await supabase
            .from('change_lists')
            .update({ 
              status: 'approved', 
              approved_at: now,
              approved_by: user?.id,
              review_notes: notes
            })
            .eq('id', listId);
          if (listError) throw listError;
        }
      } else {
        // Approve entire list
        const { error: listError } = await supabase
          .from('change_lists')
          .update({ 
            status: 'approved', 
            approved_at: now,
            approved_by: user?.id,
            review_notes: notes
          })
          .eq('id', listId);
        if (listError) throw listError;

        const { error: itemsError } = await supabase
          .from('change_list_items')
          .update({ status: 'approved' })
          .eq('change_list_id', listId);
        if (itemsError) throw itemsError;
      }

      // Log audit
      await supabase.from('change_control_audit').insert({
        change_list_id: listId,
        action: 'approved',
        actor_id: user?.id,
        actor_role: 'admin',
        details: { notes, itemIds } as unknown as Json
      });
    },
    onSuccess: () => {
      toast.success('Changes approved successfully');
      queryClient.invalidateQueries({ queryKey: ['change-lists-admin'] });
      setReviewDialogOpen(false);
      setSelectedItems([]);
    },
    onError: (error) => {
      toast.error('Failed to approve: ' + (error as Error).message);
    }
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ listId, itemIds, notes }: { listId: string; itemIds?: string[]; notes: string }) => {
      const now = new Date().toISOString();
      
      if (itemIds && itemIds.length > 0) {
        const { error: itemsError } = await supabase
          .from('change_list_items')
          .update({ status: 'rejected' })
          .in('id', itemIds);
        if (itemsError) throw itemsError;
      } else {
        const { error: listError } = await supabase
          .from('change_lists')
          .update({ 
            status: 'rejected', 
            reviewed_at: now,
            reviewed_by: user?.id,
            review_notes: notes
          })
          .eq('id', listId);
        if (listError) throw listError;

        const { error: itemsError } = await supabase
          .from('change_list_items')
          .update({ status: 'rejected' })
          .eq('change_list_id', listId);
        if (itemsError) throw itemsError;
      }

      await supabase.from('change_control_audit').insert({
        change_list_id: listId,
        action: 'rejected',
        actor_id: user?.id,
        actor_role: 'admin',
        details: { notes, itemIds } as unknown as Json
      });
    },
    onSuccess: () => {
      toast.success('Changes rejected');
      queryClient.invalidateQueries({ queryKey: ['change-lists-admin'] });
      setReviewDialogOpen(false);
      setSelectedItems([]);
    },
    onError: (error) => {
      toast.error('Failed to reject: ' + (error as Error).message);
    }
  });

  // Batch approve
  const handleBatchApprove = () => {
    if (selectedItems.length === 0) {
      toast.error('Select items to approve');
      return;
    }
    // Group by change list
    const byList: Record<string, string[]> = {};
    changeLists?.forEach(list => {
      list.items?.forEach(item => {
        if (selectedItems.includes(item.id)) {
          if (!byList[list.id]) byList[list.id] = [];
          byList[list.id].push(item.id);
        }
      });
    });

    Object.entries(byList).forEach(([listId, itemIds]) => {
      approveMutation.mutate({ listId, itemIds, notes: 'Batch approved' });
    });
  };

  // Stats
  const stats = {
    pending: changeLists?.filter(cl => cl.status === 'pending').length || 0,
    approved: changeLists?.filter(cl => cl.status === 'approved').length || 0,
    rejected: changeLists?.filter(cl => cl.status === 'rejected').length || 0,
    total: changeLists?.length || 0
  };

  const filteredLists = changeLists?.filter(cl => 
    cl.store?.store_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cl.submitted_by_role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatValue = (val: Json | null): string => {
    if (val === null || val === undefined) return '(empty)';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    return JSON.stringify(val);
  };

  return (
    <GrabbaLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Change Control Center
            </h1>
            <p className="text-muted-foreground">Review and approve field-submitted changes</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
            {selectedItems.length > 0 && (
              <Button size="sm" onClick={handleBatchApprove} className="bg-green-600 hover:bg-green-700">
                <Zap className="h-4 w-4 mr-1" />
                Batch Approve ({selectedItems.length})
              </Button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:border-yellow-500/50" onClick={() => setSelectedTab('pending')}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Review</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-green-500/50" onClick={() => setSelectedTab('approved')}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Approved</p>
                  <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-red-500/50" onClick={() => setSelectedTab('rejected')}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Rejected</p>
                  <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary/50" onClick={() => setSelectedTab('all')}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Requests</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <FileCheck className="h-8 w-8 text-primary/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by store or submitter..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="driver">Driver</SelectItem>
              <SelectItem value="biker">Biker</SelectItem>
              <SelectItem value="ambassador">Ambassador</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList>
            <TabsTrigger value="pending" className="gap-1">
              <Clock className="h-4 w-4" /> Pending ({stats.pending})
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-1">
              <CheckCircle2 className="h-4 w-4" /> Approved
            </TabsTrigger>
            <TabsTrigger value="rejected" className="gap-1">
              <XCircle className="h-4 w-4" /> Rejected
            </TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedTab} className="mt-4">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : filteredLists?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No change requests found
              </div>
            ) : (
              <div className="space-y-4">
                {filteredLists?.map((changeList) => (
                  <ChangeListCard
                    key={changeList.id}
                    changeList={changeList}
                    selectedItems={selectedItems}
                    onToggleItem={(itemId) => {
                      setSelectedItems(prev => 
                        prev.includes(itemId) 
                          ? prev.filter(id => id !== itemId)
                          : [...prev, itemId]
                      );
                    }}
                    onReview={() => {
                      setSelectedChangeList(changeList);
                      setReviewDialogOpen(true);
                    }}
                    getStatusBadge={getStatusBadge}
                    formatValue={formatValue}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Review Dialog */}
        <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5" />
                Review Change Request
              </DialogTitle>
              <DialogDescription>
                Store: {selectedChangeList?.store?.store_name} | 
                Submitted by: {selectedChangeList?.submitted_by_role}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {selectedChangeList?.items?.map((item) => (
                <div key={item.id} className="p-3 border rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium capitalize">
                      {item.entity_type}: {item.field_name}
                    </span>
                    {getStatusBadge(item.status)}
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Old Value:</span>
                      <p className="font-mono bg-red-500/10 p-1 rounded mt-1">
                        {formatValue(item.old_value)}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">New Value:</span>
                      <p className="font-mono bg-green-500/10 p-1 rounded mt-1">
                        {formatValue(item.new_value)}
                      </p>
                    </div>
                  </div>
                  {item.ai_flagged && (
                    <div className="mt-2 text-xs text-orange-600 bg-orange-500/10 p-2 rounded">
                      ⚠️ AI Flagged: {item.ai_flag_reason}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Review Notes</label>
              <Textarea 
                placeholder="Add notes about this decision..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
              />
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={() => selectedChangeList && rejectMutation.mutate({ 
                  listId: selectedChangeList.id, 
                  notes: reviewNotes 
                })}
                disabled={rejectMutation.isPending}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Reject All
              </Button>
              <Button 
                className="bg-green-600 hover:bg-green-700"
                onClick={() => selectedChangeList && approveMutation.mutate({ 
                  listId: selectedChangeList.id, 
                  notes: reviewNotes 
                })}
                disabled={approveMutation.isPending}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Approve All
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </GrabbaLayout>
  );
}

// Change List Card Component
interface ChangeListCardProps {
  changeList: ChangeList;
  selectedItems: string[];
  onToggleItem: (itemId: string) => void;
  onReview: () => void;
  getStatusBadge: (status: string) => React.ReactNode;
  formatValue: (val: Json | null) => string;
}

function ChangeListCard({ changeList, selectedItems, onToggleItem, onReview, getStatusBadge, formatValue }: ChangeListCardProps) {
  const [expanded, setExpanded] = useState(false);
  const pendingItems = changeList.items?.filter(i => i.status === 'pending').length || 0;
  const flaggedItems = changeList.items?.filter(i => i.ai_flagged).length || 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="py-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Store className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">{changeList.store?.store_name || 'Unknown Store'}</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <User className="h-3 w-3" />
                <span className="capitalize">{changeList.submitted_by_role}</span>
                <span className="text-muted-foreground">•</span>
                <Calendar className="h-3 w-3" />
                {format(new Date(changeList.created_at), 'MMM d, h:mm a')}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge(changeList.status)}
            <Badge variant="secondary">{changeList.items?.length || 0} changes</Badge>
            {pendingItems > 0 && (
              <Badge className="bg-yellow-500">{pendingItems} pending</Badge>
            )}
            {flaggedItems > 0 && (
              <Badge className="bg-orange-500">{flaggedItems} flagged</Badge>
            )}
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 border-t">
          <div className="space-y-2 mt-3">
            {changeList.items?.map((item) => (
              <div 
                key={item.id} 
                className={`flex items-center gap-3 p-2 rounded hover:bg-muted/50 ${item.ai_flagged ? 'border-l-2 border-orange-500' : ''}`}
              >
                {item.status === 'pending' && (
                  <Checkbox 
                    checked={selectedItems.includes(item.id)}
                    onCheckedChange={() => onToggleItem(item.id)}
                  />
                )}
                <div className="flex-1 grid grid-cols-4 gap-2 text-sm">
                  <span className="font-medium capitalize">{item.field_name}</span>
                  <span className="text-muted-foreground truncate">{formatValue(item.old_value)}</span>
                  <span className="text-green-600 truncate">→ {formatValue(item.new_value)}</span>
                  {getStatusBadge(item.status)}
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
            <Button variant="outline" size="sm" onClick={onReview}>
              <Eye className="h-4 w-4 mr-1" />
              Full Review
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
