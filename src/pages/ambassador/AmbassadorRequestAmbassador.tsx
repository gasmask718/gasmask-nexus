/**
 * AmbassadorRequestAmbassador — Ambassador portal page for requesting new ambassadors
 * Ambassadors REQUEST. Admins APPROVE. No direct invite generation.
 */
import { useState } from 'react';
import {
  UserPlus, Plus, Clock, CheckCircle, XCircle, Mail, MapPin, FileText,
} from 'lucide-react';
import { AmbassadorLayout } from '@/components/ambassador/AmbassadorLayout';
import { PortalRBACGate } from '@/components/portal/PortalRBACGate';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMyRequests, useSubmitRequest, type AmbassadorRequest } from '@/hooks/useAmbassadorRequests';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  pending: { label: 'Pending Review', variant: 'secondary' as const, icon: Clock, className: 'text-amber-500' },
  approved: { label: 'Approved', variant: 'default' as const, icon: CheckCircle, className: 'text-emerald-500' },
  rejected: { label: 'Rejected', variant: 'destructive' as const, icon: XCircle, className: 'text-destructive' },
};

function RequestContent() {
  const { data: requests = [], isLoading } = useMyRequests();
  const submitRequest = useSubmitRequest();
  const [showForm, setShowForm] = useState(false);
  const [detailRequest, setDetailRequest] = useState<AmbassadorRequest | null>(null);
  const [form, setForm] = useState({ full_name: '', email: '', territory: '', justification: '' });

  const resetForm = () => setForm({ full_name: '', email: '', territory: '', justification: '' });

  const handleSubmit = async () => {
    if (!form.full_name.trim()) return toast.error('Full name is required');
    if (!form.email.trim()) return toast.error('Email is required');
    if (!form.justification.trim()) return toast.error('Justification is required');
    await submitRequest.mutateAsync(form);
    setShowForm(false);
    resetForm();
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const approvedCount = requests.filter(r => r.status === 'approved').length;
  const rejectedCount = requests.filter(r => r.status === 'rejected').length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Governance Banner */}
      <Alert className="bg-primary/5 border-primary/20">
        <UserPlus className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <strong>Governed Expansion:</strong> Submit a request to recommend a new ambassador. 
          All requests are reviewed and approved by management before any invite is generated.
        </AlertDescription>
      </Alert>

      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-3 pb-2 text-center">
            <Clock className="h-4 w-4 mx-auto mb-1 text-amber-500" />
            <p className="text-xl font-bold font-mono">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-2 text-center">
            <CheckCircle className="h-4 w-4 mx-auto mb-1 text-emerald-500" />
            <p className="text-xl font-bold font-mono">{approvedCount}</p>
            <p className="text-xs text-muted-foreground">Approved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-2 text-center">
            <XCircle className="h-4 w-4 mx-auto mb-1 text-destructive" />
            <p className="text-xl font-bold font-mono">{rejectedCount}</p>
            <p className="text-xs text-muted-foreground">Rejected</p>
          </CardContent>
        </Card>
      </div>

      {/* Action */}
      <div className="flex justify-end">
        <Button onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Request New Ambassador
        </Button>
      </div>

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">My Requests</CardTitle>
          <CardDescription>Ambassador expansion requests you've submitted</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Territory</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      No requests yet. Click "Request New Ambassador" to submit your first recommendation.
                    </TableCell>
                  </TableRow>
                ) : requests.map(req => {
                  const config = STATUS_CONFIG[req.status as keyof typeof STATUS_CONFIG];
                  return (
                    <TableRow key={req.id} className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setDetailRequest(req)}>
                      <TableCell className="font-medium">{req.full_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{req.email}</TableCell>
                      <TableCell className="text-sm">{req.territory || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={config.variant}>{config.label}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Submit Request Dialog */}
      <Dialog open={showForm} onOpenChange={v => { if (!v) { setShowForm(false); resetForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request New Ambassador</DialogTitle>
            <DialogDescription>
              Submit a recommendation for a new ambassador. Management will review and approve or reject this request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name <span className="text-destructive">*</span></Label>
              <Input placeholder="Recommended person's full name" value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Email <span className="text-destructive">*</span></Label>
              <Input placeholder="email@example.com" type="email" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Territory / Borough</Label>
              <Input placeholder="e.g. Brooklyn, Jamaica, Bronx" value={form.territory}
                onChange={e => setForm(f => ({ ...f, territory: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Justification <span className="text-destructive">*</span></Label>
              <Textarea 
                placeholder="Why are you recommending this person? What stores would they cover? What value do they bring?"
                value={form.justification}
                onChange={e => setForm(f => ({ ...f, justification: e.target.value }))}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitRequest.isPending}>
              {submitRequest.isPending ? 'Submitting...' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailRequest} onOpenChange={v => { if (!v) setDetailRequest(null); }}>
        <DialogContent className="max-w-lg">
          {detailRequest && (() => {
            const config = STATUS_CONFIG[detailRequest.status as keyof typeof STATUS_CONFIG];
            const Icon = config.icon;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {detailRequest.full_name}
                    <Badge variant={config.variant}>{config.label}</Badge>
                  </DialogTitle>
                  <DialogDescription>
                    Submitted {format(new Date(detailRequest.created_at), 'PPP')}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{detailRequest.email}</span>
                    </div>
                    {detailRequest.territory && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{detailRequest.territory}</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Justification</p>
                    <p className="text-sm whitespace-pre-wrap">{detailRequest.justification}</p>
                  </div>

                  {detailRequest.review_notes && (
                    <div className={`rounded-lg p-3 ${detailRequest.status === 'approved' ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-destructive/10 border border-destructive/20'}`}>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Review Notes</p>
                      <p className="text-sm whitespace-pre-wrap">{detailRequest.review_notes}</p>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AmbassadorRequestAmbassador() {
  return (
    <PortalRBACGate allowedRoles={['ambassador', 'admin']} portalName="Ambassador Portal">
      <AmbassadorLayout
        title="Team Expansion"
        subtitle="Request new ambassadors for management review"
        portalIcon={<UserPlus className="h-4 w-4 text-primary-foreground" />}
      >
        <RequestContent />
      </AmbassadorLayout>
    </PortalRBACGate>
  );
}
