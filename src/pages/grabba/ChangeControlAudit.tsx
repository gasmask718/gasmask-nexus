import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GrabbaLayout } from '@/components/grabba/GrabbaLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { 
  History, Search, Filter, CheckCircle2, XCircle, 
  Edit, Eye, User, Calendar, FileText
} from 'lucide-react';
import type { Json } from '@/integrations/supabase/types';

interface AuditEntry {
  id: string;
  change_list_id: string;
  action: string;
  actor_id: string | null;
  actor_role: string | null;
  details: Json | null;
  created_at: string;
  change_list?: {
    store_id: string;
    store?: { store_name: string };
  };
}

export default function ChangeControlAudit() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');

  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ['change-control-audit', filterAction],
    queryFn: async () => {
      let query = supabase
        .from('change_control_audit')
        .select(`
          *,
          change_list:change_lists(
            store_id,
            store:store_master(store_name)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (filterAction !== 'all') {
        query = query.eq('action', filterAction);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as AuditEntry[];
    }
  });

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'approved':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'submitted':
        return <FileText className="h-4 w-4 text-blue-600" />;
      case 'viewed':
        return <Eye className="h-4 w-4 text-gray-600" />;
      case 'modified':
        return <Edit className="h-4 w-4 text-yellow-600" />;
      default:
        return <History className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'approved':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/30">{action}</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/30">{action}</Badge>;
      case 'submitted':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30">{action}</Badge>;
      default:
        return <Badge variant="secondary">{action}</Badge>;
    }
  };

  const filteredLogs = auditLogs?.filter(log =>
    log.change_list?.store?.store_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.actor_role?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.action?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Stats
  const stats = {
    total: auditLogs?.length || 0,
    approved: auditLogs?.filter(l => l.action === 'approved').length || 0,
    rejected: auditLogs?.filter(l => l.action === 'rejected').length || 0,
    submitted: auditLogs?.filter(l => l.action === 'submitted').length || 0
  };

  return (
    <GrabbaLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="h-6 w-6 text-primary" />
            Change Control Audit Log
          </h1>
          <p className="text-muted-foreground">Complete history of all change request actions</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Total Actions</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Approvals</p>
              <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Rejections</p>
              <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Submissions</p>
              <p className="text-2xl font-bold text-blue-600">{stats.submitted}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search logs..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="modified">Modified</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Audit Log Table */}
        <Card>
          <CardHeader>
            <CardTitle>Audit Trail</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : filteredLogs?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No audit logs found
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLogs?.map((log) => (
                  <div 
                    key={log.id}
                    className="flex items-center gap-4 p-3 border rounded-lg hover:bg-muted/30"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                      {getActionIcon(log.action)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {getActionBadge(log.action)}
                        <span className="text-sm font-medium">
                          {log.change_list?.store?.store_name || 'Unknown Store'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {log.actor_role || 'System'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(log.created_at), 'MMM d, yyyy h:mm a')}
                        </span>
                      </div>
                    </div>
                    {log.details && (
                      <div className="text-xs text-muted-foreground max-w-xs truncate">
                        {typeof log.details === 'object' && log.details !== null && 'notes' in log.details
                          ? String((log.details as { notes?: string }).notes || '')
                          : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </GrabbaLayout>
  );
}
