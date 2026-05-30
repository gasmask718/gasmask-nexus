/**
 * Deleted Records OS Section (Admin Only)
 * 
 * Shows all soft-deleted, archived, and deactivated records
 * with complete audit trail and restore capabilities.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Trash2, RotateCcw, User, Store, Users, Package,
  AlertTriangle, History, Filter, Search, Eye
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface AuditRecord {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  metadata: any;
  created_at: string;
  user_id: string | null;
  user_name?: string;
}

interface DeletedRecord {
  id: string;
  name: string;
  type: string;
  deletedAt: string;
  deletedBy: string;
  canRestore: boolean;
  metadata?: any;
}

export default function DeletedRecords() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<DeletedRecord | null>(null);
  const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<any>(null);

  // Fetch recovery ledger (governed deletions)
  const { data: recoveryLedger, isLoading: recoveryLoading } = useQuery({
    queryKey: ['recovery-ledger'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deletion_recovery_log')
        .select('*')
        .order('deleted_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch archived leads
  const { data: archivedLeads, isLoading: leadsLoading } = useQuery({
    queryKey: ['archived-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_prospects')
        .select('id, store_name, contact_name, lead_type, archived_at, archived_by, created_at')
        .eq('archived', true)
        .order('archived_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch deactivated ambassadors
  const { data: deactivatedAmbassadors, isLoading: ambassadorsLoading } = useQuery({
    queryKey: ['deactivated-ambassadors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ambassadors')
        .select('id, name, phone_primary, is_active, updated_at')
        .eq('is_active', false)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch unassigned stores (stores with no active assignments)
  const { data: unassignedStores, isLoading: storesLoading } = useQuery({
    queryKey: ['unassigned-stores'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('store_assignments')
        .select(`
          store_id,
          deactivated_at,
          deactivated_by,
          store:store_id (id, store_name, owner_name, city)
        `)
        .eq('active', false)
        .not('deactivated_at', 'is', null)
        .order('deactivated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch audit log for deleted/archived actions
  const { data: auditLog, isLoading: auditLoading } = useQuery({
    queryKey: ['deleted-audit-log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .in('action', ['delete', 'archive', 'deactivate', 'unassign'])
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  // Restore mutations
  const restoreLead = useMutation({
    mutationFn: async (leadId: string) => {
      const { error } = await supabase
        .from('sales_prospects')
        .update({ archived: false, archived_at: null, archived_by: null })
        .eq('id', leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archived-leads'] });
      toast.success('Lead restored successfully');
      setRestoreDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to restore: ${error.message}`);
    },
  });

  const reactivateAmbassador = useMutation({
    mutationFn: async (ambassadorId: string) => {
      const { error } = await supabase
        .from('ambassadors')
        .update({ is_active: true })
        .eq('id', ambassadorId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deactivated-ambassadors'] });
      toast.success('Ambassador reactivated');
      setRestoreDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to reactivate: ${error.message}`);
    },
  });

  const restoreFromLedger = useMutation({
    mutationFn: async ({ logId, entityTable }: { logId: string; entityTable: string }) => {
      if (entityTable === 'collection_accounts') {
        // Find the entity_id from the recovery log
        const { data: logEntry } = await supabase
          .from('deletion_recovery_log')
          .select('entity_id')
          .eq('id', logId)
          .single();
        if (!logEntry) throw new Error('Recovery log entry not found');
        const { error } = await supabase.rpc('restore_deleted_collection_account', {
          p_account_id: logEntry.entity_id,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc('restore_deleted_store', {
          p_log_id: logId,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recovery-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      queryClient.invalidateQueries({ queryKey: ['store-master'] });
      queryClient.invalidateQueries({ queryKey: ['collection-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['collection-stats'] });
      toast.success('Record restored successfully');
      setRestoreDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to restore: ${error.message}`);
    },
  });

  const handleRestore = () => {
    if (!selectedRecord) return;
    
    switch (selectedRecord.type) {
      case 'lead':
        restoreLead.mutate(selectedRecord.id);
        break;
      case 'ambassador':
        reactivateAmbassador.mutate(selectedRecord.id);
        break;
      case 'store_deleted':
      case 'collection_account_deleted':
        restoreFromLedger.mutate({
          logId: selectedRecord.id,
          entityTable: selectedRecord.type === 'collection_account_deleted' ? 'collection_accounts' : 'store_master',
        });
        break;
      default:
        toast.error('Restore not supported for this record type');
    }
  };

  const openRestoreDialog = (record: DeletedRecord) => {
    setSelectedRecord(record);
    setRestoreDialogOpen(true);
  };

  const isLoading = leadsLoading || ambassadorsLoading || storesLoading || auditLoading || recoveryLoading;

  // Build unified records list
  const allRecords: DeletedRecord[] = [
    // Recovery ledger (governed deletions — stores, etc.)
    ...(recoveryLedger || []).filter(r => !r.is_restored).map(entry => {
      const isCollection = entry.entity_table === 'collection_accounts';
      const snapshot = entry.entity_snapshot as any;
      return {
        id: entry.id,
        name: isCollection
          ? (snapshot?.entity_name || `Collection Account #${entry.entity_id.slice(-8)}`)
          : (snapshot?.store_name || `${entry.entity_type} #${entry.entity_id.slice(-8)}`),
        type: isCollection ? 'collection_account_deleted' : 'store_deleted',
        deletedAt: entry.deleted_at,
        deletedBy: entry.deleted_by || 'Unknown',
        canRestore: true,
        metadata: {
          reason: entry.delete_reason,
          source_ui: entry.source_ui,
          entity_type: entry.entity_type,
          snapshot: entry.entity_snapshot,
        },
      };
    }),
    ...(archivedLeads || []).map(lead => ({
      id: lead.id,
      name: lead.store_name || lead.contact_name || 'Unnamed Lead',
      type: 'lead',
      deletedAt: lead.archived_at || lead.created_at,
      deletedBy: lead.archived_by || 'Unknown',
      canRestore: true,
      metadata: { lead_type: lead.lead_type },
    })),
    ...(deactivatedAmbassadors || []).map(amb => ({
      id: amb.id,
      name: amb.name || amb.phone_primary || 'Unnamed Ambassador',
      type: 'ambassador',
      deletedAt: amb.updated_at,
      deletedBy: 'System',
      canRestore: true,
    })),
    ...(unassignedStores || []).filter(s => s.store).map((s: any) => ({
      id: s.store_id,
      name: s.store?.store_name || s.store?.owner_name || 'Unnamed Store',
      type: 'store_unassignment',
      deletedAt: s.deactivated_at,
      deletedBy: s.deactivated_by || 'Unknown',
      canRestore: false,
      metadata: { city: s.store?.city },
    })),
  ];

  // Filter records
  const filteredRecords = allRecords.filter(record => {
    const matchesSearch = record.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = entityFilter === 'all' || record.type === entityFilter;
    return matchesSearch && matchesType;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'lead': return <Users className="h-4 w-4" />;
      case 'ambassador': return <User className="h-4 w-4" />;
      case 'store_unassignment': return <Store className="h-4 w-4" />;
      case 'store_deleted': return <Store className="h-4 w-4 text-destructive" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'lead': return <Badge variant="secondary">Lead</Badge>;
      case 'ambassador': return <Badge variant="outline">Ambassador</Badge>;
      case 'store_unassignment': return <Badge>Store Unassigned</Badge>;
      case 'store_deleted': return <Badge variant="destructive">Store Deleted</Badge>;
      default: return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trash2 className="h-8 w-8 text-destructive" />
            Deleted & Archived Records
          </h1>
          <p className="text-muted-foreground mt-1">
            View and restore soft-deleted records. All data is preserved for audit purposes.
          </p>
        </div>
      </div>

      <Tabs defaultValue="records" className="space-y-4">
        <TabsList>
          <TabsTrigger value="records">
            All Records ({allRecords.length})
          </TabsTrigger>
          <TabsTrigger value="audit">
            Audit Log ({auditLog?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search records..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={entityFilter} onValueChange={setEntityFilter}>
                  <SelectTrigger className="w-[200px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="store_deleted">Deleted Stores</SelectItem>
                    <SelectItem value="lead">Leads</SelectItem>
                    <SelectItem value="ambassador">Ambassadors</SelectItem>
                    <SelectItem value="store_unassignment">Store Unassignments</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Records List */}
          <Card>
            <CardHeader>
              <CardTitle>Deleted Records</CardTitle>
              <CardDescription>
                {filteredRecords.length} records found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Trash2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No deleted records found</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {filteredRecords.map((record) => (
                      <div
                        key={`${record.type}-${record.id}`}
                        className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                            {getTypeIcon(record.type)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{record.name}</span>
                              {getTypeBadge(record.type)}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Deleted {format(new Date(record.deletedAt), 'MMM d, yyyy h:mm a')}
                              {record.deletedBy !== 'Unknown' && ` by ${record.deletedBy}`}
                            </p>
                            {record.metadata?.reason && (
                              <p className="text-xs text-muted-foreground/70 italic">
                                Reason: {record.metadata.reason}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {record.canRestore && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openRestoreDialog(record)}
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Restore
                            </Button>
                          )}
                          {record.metadata?.snapshot && (
                            <Button size="sm" variant="ghost" onClick={() => {
                              setSelectedSnapshot(record.metadata.snapshot);
                              setSnapshotDialogOpen(true);
                            }}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Audit Trail
              </CardTitle>
              <CardDescription>
                Complete log of all delete, archive, and deactivation actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {auditLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (auditLog?.length || 0) === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No audit records found</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {auditLog?.map((entry: any) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border text-sm"
                      >
                        <div>
                          <span className="font-medium capitalize">{entry.action}</span>
                          <span className="mx-2 text-muted-foreground">on</span>
                          <span>{entry.entity_type}</span>
                          {entry.entity_id && (
                            <span className="text-muted-foreground ml-1">
                              ({entry.entity_id.slice(-8)})
                            </span>
                          )}
                        </div>
                        <span className="text-muted-foreground">
                          {format(new Date(entry.created_at), 'MMM d, yyyy, h:mm a')}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Restore Confirmation Dialog */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Restore Record
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to restore "{selectedRecord?.name}"?
              This will make it active again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRestore}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Snapshot Viewer Dialog */}
      <Dialog open={snapshotDialogOpen} onOpenChange={setSnapshotDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Record Snapshot
            </DialogTitle>
            <DialogDescription>
              Read-only snapshot of the record at the time of deletion.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[50vh]">
            <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto whitespace-pre-wrap">
              {selectedSnapshot ? JSON.stringify(selectedSnapshot, null, 2) : 'No snapshot data'}
            </pre>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSnapshotDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
