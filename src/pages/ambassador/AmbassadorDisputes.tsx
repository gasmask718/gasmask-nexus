import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  Plus,
  MessageSquare,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Filter,
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import {
  useDisputes,
  useDisputeKPIs,
  useCreateDispute,
  REASON_CODE_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_COLORS,
  type DisputeReasonCode,
  type DisputeStatus,
} from '@/hooks/useDisputes';

export default function AmbassadorDisputes() {
  const { data: disputes = [], isLoading } = useDisputes();
  const { data: kpis } = useDisputeKPIs();
  const createDispute = useCreateDispute();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<DisputeStatus | 'all'>('all');
  
  // Create form state
  const [reasonCode, setReasonCode] = useState<DisputeReasonCode>('other');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [requestedAmount, setRequestedAmount] = useState('');

  const filteredDisputes = statusFilter === 'all' 
    ? disputes 
    : disputes.filter(d => d.status === statusFilter);

  const handleCreateDispute = async () => {
    await createDispute.mutateAsync({
      reason_code: reasonCode,
      title: title || undefined,
      description,
      requested_amount: requestedAmount ? parseFloat(requestedAmount) : undefined,
    });
    
    setIsCreateOpen(false);
    setReasonCode('other');
    setTitle('');
    setDescription('');
    setRequestedAmount('');
  };

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Commission Disputes</h1>
          <p className="text-muted-foreground">
            File and track disputes for commission issues
          </p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              File Dispute
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>File a Commission Dispute</DialogTitle>
              <DialogDescription>
                Submit a dispute for review by our team. Provide as much detail as possible.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Reason</Label>
                <Select value={reasonCode} onValueChange={(v) => setReasonCode(v as DisputeReasonCode)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(REASON_CODE_LABELS).map(([code, label]) => (
                      <SelectItem key={code} value={code}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Title (Optional)</Label>
                <Input
                  placeholder="Brief summary of the issue"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Description *</Label>
                <Textarea
                  placeholder="Describe the issue in detail. Include order IDs, dates, and amounts if applicable."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Requested Amount (Optional)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="pl-7"
                    value={requestedAmount}
                    onChange={(e) => setRequestedAmount(e.target.value)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  What you believe the commission should be
                </p>
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateDispute}
                  disabled={!description || createDispute.isPending}
                >
                  {createDispute.isPending ? 'Submitting...' : 'Submit Dispute'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-900/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-blue-400">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Open</span>
            </div>
            <div className="text-2xl font-bold mt-1">{kpis?.open_disputes || 0}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500/10 to-green-900/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm">Approved</span>
            </div>
            <div className="text-2xl font-bold mt-1">{kpis?.approved_disputes || 0}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-red-500/10 to-red-900/5 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-400">
              <XCircle className="h-4 w-4" />
              <span className="text-sm">Rejected</span>
            </div>
            <div className="text-2xl font-bold mt-1">{kpis?.rejected_disputes || 0}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-muted/50 to-muted/30 border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span className="text-sm">Total</span>
            </div>
            <div className="text-2xl font-bold mt-1">{kpis?.total_disputes || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as DisputeStatus | 'all')}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_LABELS).map(([status, label]) => (
              <SelectItem key={status} value={status}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Disputes List */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            Your Disputes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredDisputes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No disputes found</p>
              <p className="text-sm">File a dispute if you believe there's an issue with your commissions</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDisputes.map((dispute) => (
                <Link
                  key={dispute.id}
                  to={`/ambassador/disputes/${dispute.id}`}
                  className="block"
                >
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${STATUS_COLORS[dispute.status]}`}>
                        {getStatusIcon(dispute.status)}
                      </div>
                      <div>
                        <div className="font-medium">
                          {dispute.title || REASON_CODE_LABELS[dispute.reason_code]}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(dispute.submitted_at), 'MMM d, yyyy')}
                          {dispute.ledger_source_name && (
                            <span> • {dispute.ledger_source_name}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {dispute.requested_amount && (
                        <span className="text-sm font-medium">
                          ${dispute.requested_amount.toLocaleString()}
                        </span>
                      )}
                      <Badge variant="outline" className={STATUS_COLORS[dispute.status]}>
                        {STATUS_LABELS[dispute.status]}
                      </Badge>
                      {(dispute.message_count ?? 0) > 0 && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <MessageSquare className="h-4 w-4" />
                          <span className="text-xs">{dispute.message_count}</span>
                        </div>
                      )}
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
