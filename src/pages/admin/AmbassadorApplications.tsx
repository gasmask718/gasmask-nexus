/**
 * Ambassador Applications Admin Page
 * Review and approve/reject ambassador applications
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  User, CheckCircle2, XCircle, Clock, Search,
  Mail, Phone, MapPin, FileText, Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function AmbassadorApplications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);

  // Fetch all applications
  const { data: applications, isLoading } = useQuery({
    queryKey: ['all-ambassador-applications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ambassador_applications')
        .select(`
          *,
          referrer:referred_by_ambassador_id (id, name)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async ({ appId, notes }: { appId: string; notes: string }) => {
      const app = applications?.find(a => a.id === appId);
      if (!app) throw new Error('Application not found');

      // Create the ambassador record using explicit insert object
      const { data: newAmbassador, error: createError } = await (supabase as any)
        .from('ambassadors')
        .insert({
          name: app.full_name,
          phone_primary: app.phone || null,
          city: app.city || null,
          state: app.state || null,
          recruited_by_ambassador_id: app.referred_by_ambassador_id || null,
          is_active: true,
          tier: 'standard',
        })
        .select('id')
        .single();

      if (createError) throw createError;

      // Update the application
      const { error: updateError } = await supabase
        .from('ambassador_applications')
        .update({
          status: 'approved',
          reviewed_by: user!.id,
          reviewed_at: new Date().toISOString(),
          review_notes: notes,
          created_ambassador_id: newAmbassador.id,
        })
        .eq('id', appId);

      if (updateError) throw updateError;

      return newAmbassador;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-ambassador-applications'] });
      toast.success('Application approved! Ambassador account created.');
      setSelectedApp(null);
      setActionType(null);
      setReviewNotes('');
    },
    onError: (error: Error) => {
      toast.error(`Failed to approve: ${error.message}`);
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ appId, notes }: { appId: string; notes: string }) => {
      const { error } = await supabase
        .from('ambassador_applications')
        .update({
          status: 'rejected',
          reviewed_by: user!.id,
          reviewed_at: new Date().toISOString(),
          review_notes: notes,
        })
        .eq('id', appId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-ambassador-applications'] });
      toast.success('Application rejected');
      setSelectedApp(null);
      setActionType(null);
      setReviewNotes('');
    },
    onError: (error: Error) => {
      toast.error(`Failed to reject: ${error.message}`);
    },
  });

  const handleAction = () => {
    if (!selectedApp || !actionType) return;

    if (actionType === 'approve') {
      approveMutation.mutate({ appId: selectedApp.id, notes: reviewNotes });
    } else {
      rejectMutation.mutate({ appId: selectedApp.id, notes: reviewNotes });
    }
  };

  const pendingApps = applications?.filter(a => a.status === 'pending_review') || [];
  const approvedApps = applications?.filter(a => a.status === 'approved') || [];
  const rejectedApps = applications?.filter(a => a.status === 'rejected') || [];

  const filteredPending = pendingApps.filter(app =>
    app.full_name.toLowerCase().includes(search.toLowerCase()) ||
    app.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ambassador Applications</h1>
        <p className="text-muted-foreground">Review and manage ambassador recruitment applications</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search applications..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            Pending
            <Badge variant="secondary">{pendingApps.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Approved
            <Badge variant="secondary">{approvedApps.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="rejected" className="gap-2">
            <XCircle className="h-4 w-4" />
            Rejected
            <Badge variant="secondary">{rejectedApps.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <ApplicationList
            applications={filteredPending}
            isLoading={isLoading}
            onSelect={(app) => setSelectedApp(app)}
            showActions
            onApprove={(app) => { setSelectedApp(app); setActionType('approve'); }}
            onReject={(app) => { setSelectedApp(app); setActionType('reject'); }}
          />
        </TabsContent>
        <TabsContent value="approved">
          <ApplicationList
            applications={approvedApps}
            isLoading={isLoading}
            onSelect={(app) => setSelectedApp(app)}
          />
        </TabsContent>
        <TabsContent value="rejected">
          <ApplicationList
            applications={rejectedApps}
            isLoading={isLoading}
            onSelect={(app) => setSelectedApp(app)}
          />
        </TabsContent>
      </Tabs>

      {/* Review Dialog */}
      <Dialog open={!!actionType} onOpenChange={() => { setActionType(null); setReviewNotes(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? 'Approve Application' : 'Reject Application'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve' 
                ? `This will create an ambassador account for ${selectedApp?.full_name}`
                : `This will reject the application from ${selectedApp?.full_name}`
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Review Notes</Label>
              <Textarea
                placeholder={actionType === 'approve' 
                  ? 'Welcome message or initial instructions...'
                  : 'Reason for rejection...'
                }
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionType(null); setReviewNotes(''); }}>
              Cancel
            </Button>
            <Button
              variant={actionType === 'approve' ? 'default' : 'destructive'}
              onClick={handleAction}
              disabled={approveMutation.isPending || rejectMutation.isPending}
            >
              {(approveMutation.isPending || rejectMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {actionType === 'approve' ? 'Approve & Create Account' : 'Reject Application'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ApplicationList({
  applications,
  isLoading,
  onSelect,
  showActions,
  onApprove,
  onReject,
}: {
  applications: any[];
  isLoading: boolean;
  onSelect: (app: any) => void;
  showActions?: boolean;
  onApprove?: (app: any) => void;
  onReject?: (app: any) => void;
}) {
  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Loading...</div>;
  }

  if (applications.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No applications in this category</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[500px]">
      <div className="space-y-3 p-1">
        {applications.map(app => (
          <Card key={app.id} className="hover:border-primary/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium">{app.full_name}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {app.email}
                      </span>
                      {app.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {app.phone}
                        </span>
                      )}
                      {app.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {app.city}{app.state ? `, ${app.state}` : ''}
                        </span>
                      )}
                    </div>
                    {app.referrer && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Referred by: <span className="font-medium">{app.referrer.name}</span>
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Applied: {format(new Date(app.created_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {showActions && onApprove && onReject ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-green-600 hover:text-green-700 hover:border-green-600"
                        onClick={() => onApprove(app)}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:border-red-600"
                        onClick={() => onReject(app)}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </>
                  ) : (
                    <Badge 
                      variant="outline" 
                      className={
                        app.status === 'approved' 
                          ? 'bg-green-500/10 text-green-500 border-green-500/20'
                          : app.status === 'rejected'
                          ? 'bg-red-500/10 text-red-500 border-red-500/20'
                          : ''
                      }
                    >
                      {app.status.replace('_', ' ')}
                    </Badge>
                  )}
                </div>
              </div>

              {app.motivation && (
                <div className="mt-3 p-3 rounded-lg bg-muted/30 text-sm">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Motivation:</p>
                  <p className="line-clamp-2">{app.motivation}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
