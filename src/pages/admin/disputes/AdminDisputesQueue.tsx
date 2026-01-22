/**
 * Admin Disputes Queue - Centralized dispute management for admins
 * Shows all disputes with filtering, priority sorting, and quick actions
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  Users,
  DollarSign,
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import {
  useAdminDisputeQueue,
  useAdminPickupDispute,
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_COLORS,
  REASON_CODE_LABELS,
  type DisputeStatus,
  type DisputePriority,
} from '@/hooks/useDisputes';

export default function AdminDisputesQueue() {
  const [statusFilter, setStatusFilter] = useState<DisputeStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<DisputePriority | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: disputes = [], isLoading } = useAdminDisputeQueue({
    status: statusFilter === 'all' ? undefined : statusFilter,
    priority: priorityFilter === 'all' ? undefined : priorityFilter,
  });
  
  const pickupDispute = useAdminPickupDispute();

  const filteredDisputes = disputes.filter(d => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      d.title?.toLowerCase().includes(query) ||
      d.description?.toLowerCase().includes(query) ||
      d.ambassador_name?.toLowerCase().includes(query)
    );
  });

  // Calculate KPIs
  const openCount = disputes.filter(d => 
    ['submitted', 'under_review', 'needs_info'].includes(d.status)
  ).length;
  const urgentCount = disputes.filter(d => d.priority === 'urgent').length;
  const pendingApprovalCount = disputes.filter(d => d.status === 'under_review').length;

  const getStatusIcon = (status: DisputeStatus) => {
    switch (status) {
      case 'submitted':
        return <Clock className="h-4 w-4" />;
      case 'under_review':
        return <HelpCircle className="h-4 w-4" />;
      case 'needs_info':
        return <AlertTriangle className="h-4 w-4" />;
      case 'approved':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'rejected':
        return <XCircle className="h-4 w-4" />;
      case 'resolved':
        return <CheckCircle2 className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const handlePickup = async (disputeId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await pickupDispute.mutateAsync(disputeId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dispute Queue</h1>
        <p className="text-muted-foreground">
          Review and resolve ambassador commission disputes
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-900/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-blue-400">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">Open</span>
            </div>
            <div className="text-2xl font-bold mt-1">{openCount}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-red-500/10 to-red-900/5 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-400">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Urgent</span>
            </div>
            <div className="text-2xl font-bold mt-1">{urgentCount}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-900/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-amber-400">
              <HelpCircle className="h-4 w-4" />
              <span className="text-sm">Under Review</span>
            </div>
            <div className="text-2xl font-bold mt-1">{pendingApprovalCount}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-muted/50 to-muted/30 border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span className="text-sm">Total</span>
            </div>
            <div className="text-2xl font-bold mt-1">{disputes.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search disputes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as DisputeStatus | 'all')}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(STATUS_LABELS).map(([status, label]) => (
                <SelectItem key={status} value={status}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as DisputePriority | 'all')}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Disputes List */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            Disputes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredDisputes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No disputes found</p>
              <p className="text-sm">Adjust your filters to see more results</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDisputes.map((dispute) => (
                <Link
                  key={dispute.id}
                  to={`/admin/disputes/${dispute.id}`}
                  className="block"
                >
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${STATUS_COLORS[dispute.status]}`}>
                        {getStatusIcon(dispute.status)}
                      </div>
                      <div>
                        <div className="font-medium">
                          {dispute.title || REASON_CODE_LABELS[dispute.reason_code] || 'Dispute'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {dispute.ambassador_name || 'Unknown Ambassador'} •{' '}
                          {format(new Date(dispute.submitted_at), 'MMM d, yyyy')}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {dispute.requested_amount && (
                        <div className="flex items-center gap-1 text-sm font-medium">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          {dispute.requested_amount.toLocaleString()}
                        </div>
                      )}
                      
                      <Badge 
                        variant="outline" 
                        className={PRIORITY_COLORS[dispute.priority]}
                      >
                        {dispute.priority}
                      </Badge>
                      
                      <Badge variant="outline" className={STATUS_COLORS[dispute.status]}>
                        {STATUS_LABELS[dispute.status]}
                      </Badge>
                      
                      {dispute.status === 'submitted' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => handlePickup(dispute.id, e)}
                          disabled={pickupDispute.isPending}
                        >
                          Pick Up
                        </Button>
                      )}
                      
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
