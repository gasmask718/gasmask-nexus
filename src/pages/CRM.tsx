import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessStore } from '@/stores/businessStore';
import { useUserRole } from '@/hooks/useUserRole';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, Phone, Mail, MessageSquare, AlertTriangle, 
  TrendingUp, Calendar, Plus, Search, Database, Building2 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { seedDemoData } from '@/utils/seedDemoData';
import CRMLayout from './crm/CRMLayout';
import { QuickAddContactForm } from '@/components/crm/QuickAddContactForm';
import { GlobalBusinessSelector } from '@/components/crm/GlobalBusinessSelector';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const CRM = () => {
  const navigate = useNavigate();
  const { selectedBusiness, loading, fetchBusinesses, ensureBusinessSelected, businesses } = useBusinessStore();
  const { role } = useUserRole();
  const [showDemoDialog, setShowDemoDialog] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  // Initialize business on mount
  useEffect(() => {
    fetchBusinesses();
  }, [fetchBusinesses]);

  // Ensure business is selected
  useEffect(() => {
    ensureBusinessSelected();
  }, [ensureBusinessSelected]);

  const handleLoadDemoData = async () => {
    if (!selectedBusiness?.id) return;
    
    setLoadingDemo(true);
    const success = await seedDemoData(selectedBusiness.id);
    setLoadingDemo(false);
    setShowDemoDialog(false);
    
    if (success) {
      window.location.reload();
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading CRM...</p>
        </div>
      </div>
    );
  }

  // Show empty state if no businesses exist at all
  if (businesses.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="p-8 text-center max-w-md">
          <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Businesses Found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first business to start using CRM features.
          </p>
          <Button onClick={() => navigate('/settings/business')}>
            <Plus className="mr-2 h-4 w-4" />
            Add New Business
          </Button>
        </Card>
      </div>
    );
  }

  const { data: contacts, refetch: refetchContacts } = useQuery({
    queryKey: ['crm-contacts', selectedBusiness?.id],
    queryFn: async () => {
      if (!selectedBusiness?.id) return [];
      
      const { data, error } = await supabase
        .from('crm_contacts')
        .select('*')
        .eq('business_id', selectedBusiness.id)
        .order('last_contact_date', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedBusiness?.id,
  });

  const { data: recentLogs } = useQuery({
    queryKey: ['recent-communication-logs', selectedBusiness?.id],
    queryFn: async () => {
      if (!selectedBusiness?.id) return [];
      
      const { data, error } = await supabase
        .from('communication_logs')
        .select(`
          *,
          contact:crm_contacts(name),
          store:stores(name),
          created_by_profile:profiles!communication_logs_created_by_fkey(name)
        `)
        .eq('business_id', selectedBusiness.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedBusiness?.id,
  });

  const { data: followUps } = useQuery({
    queryKey: ['follow-ups-pending', selectedBusiness?.id],
    queryFn: async () => {
      if (!selectedBusiness?.id) return [];
      
      const { data, error } = await supabase
        .from('communication_logs')
        .select('*, contact:crm_contacts(name), store:stores(name)')
        .eq('business_id', selectedBusiness.id)
        .eq('follow_up_required', true)
        .gte('follow_up_date', new Date().toISOString())
        .order('follow_up_date', { ascending: true })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedBusiness?.id,
  });

  const totalContacts = contacts?.length || 0;
  const activeContacts = contacts?.filter(c => c.relationship_status === 'active').length || 0;
  const atRiskContacts = contacts?.filter(c => ['cold', 'lost'].includes(c.relationship_status)).length || 0;
  const contactsByType = contacts?.reduce((acc, c) => {
    acc[c.type] = (acc[c.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'call': return <Phone className="h-4 w-4" />;
      case 'sms': return <MessageSquare className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      active: 'default',
      warm: 'secondary',
      cold: 'outline',
      lost: 'destructive',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  return (
    <CRMLayout title="CRM Command Center">
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">CRM Command Center</h1>
            <p className="text-muted-foreground mt-1">
              Unified communication and relationship management
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <GlobalBusinessSelector />
          {role === 'admin' && (
            <Button 
              variant="outline" 
              onClick={() => setShowDemoDialog(true)}
              disabled={loadingDemo}
            >
              <Database className="mr-2 h-4 w-4" />
              Load Demo Data
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate('/crm/contacts')}>
            <Users className="mr-2 h-4 w-4" />
            All Contacts
          </Button>
          <Dialog open={showQuickAdd} onOpenChange={setShowQuickAdd}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Quick Add
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Quick Add Contact</DialogTitle>
              </DialogHeader>
              <QuickAddContactForm onSuccess={() => {
                setShowQuickAdd(false);
                refetchContacts();
              }} />
            </DialogContent>
          </Dialog>
          <Button onClick={() => navigate('/crm/contacts/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New Contact
          </Button>
        </div>
      </div>

      <AlertDialog open={showDemoDialog} onOpenChange={setShowDemoDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Load Demo Data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create sample contacts, communication logs, phone numbers, AI agents, and call logs for testing purposes. 
              This data will be isolated to your current business: <strong>{selectedBusiness?.name}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLoadDemoData} disabled={loadingDemo}>
              {loadingDemo ? 'Loading...' : 'Load Demo Data'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Contacts</p>
              <p className="text-2xl font-bold">{totalContacts}</p>
            </div>
            <Users className="h-8 w-8 text-primary" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-2xl font-bold text-green-500">{activeContacts}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">At Risk</p>
              <p className="text-2xl font-bold text-destructive">{atRiskContacts}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Follow-ups Due</p>
              <p className="text-2xl font-bold">{followUps?.length || 0}</p>
            </div>
            <Calendar className="h-8 w-8 text-primary" />
          </div>
        </Card>
      </div>

      {/* Contacts by Type */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Contacts by Type</h2>
        <div className="grid gap-3 md:grid-cols-6">
          {Object.entries(contactsByType).map(([type, count]) => (
            <div key={type} className="p-3 rounded-lg border bg-secondary/20">
              <p className="text-sm text-muted-foreground capitalize">{type}</p>
              <p className="text-xl font-bold">{count}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Activity</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/communication/calls')}>
              View All
            </Button>
          </div>
          <div className="space-y-3">
            {recentLogs?.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 rounded-lg border hover:bg-secondary/50 transition-colors"
              >
                <div className="p-2 rounded-lg bg-primary/10">
                  {getChannelIcon(log.channel)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {log.contact?.name || log.store?.name || 'Unknown'}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {log.summary}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(log.created_at).toLocaleString()} · {log.created_by_profile?.name}
                  </p>
                </div>
                <Badge variant="outline" className="capitalize">
                  {log.channel}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* Upcoming Follow-ups */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Upcoming Follow-ups</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/crm/follow-ups')}>
              View All
            </Button>
          </div>
          <div className="space-y-3">
            {followUps?.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 rounded-lg border hover:bg-secondary/50 transition-colors"
              >
                <Calendar className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {log.contact?.name || log.store?.name || 'Unknown'}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {log.summary}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Due: {new Date(log.follow_up_date!).toLocaleDateString()}
                  </p>
                </div>
                <Button size="sm" variant="outline">
                  Complete
                </Button>
              </div>
            ))}
            {(!followUps || followUps.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No upcoming follow-ups
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* At-Risk Relationships */}
      {atRiskContacts > 0 && (
        <Card className="p-6 border-destructive/20">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h2 className="text-lg font-semibold">At-Risk Relationships</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {contacts
              ?.filter(c => ['cold', 'lost'].includes(c.relationship_status))
              .slice(0, 6)
              .map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-destructive/20 hover:bg-destructive/5 cursor-pointer transition-colors"
                  onClick={() => navigate(`/crm/contacts/${contact.id}`)}
                >
                  <div>
                    <p className="font-medium">{contact.name}</p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {contact.type} · Last contact:{' '}
                      {contact.last_contact_date
                        ? new Date(contact.last_contact_date).toLocaleDateString()
                        : 'Never'}
                    </p>
                  </div>
                  {getStatusBadge(contact.relationship_status)}
                </div>
              ))}
          </div>
        </Card>
      )}
      </div>
    </CRMLayout>
  );
};

export default CRM;