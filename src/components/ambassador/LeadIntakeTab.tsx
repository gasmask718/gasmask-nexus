/**
 * Lead Intake Tab - Shows all leads created by a specific ambassador
 * Displays: Store leads, Wholesaler leads, Influencer leads, Ambassador recruits
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Store, Users, Megaphone, User, Clock, ArrowRight,
  CheckCircle2, AlertCircle, Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

interface LeadIntakeTabProps {
  ambassadorId: string;
  ambassadorUserId?: string | null;
}

const LEAD_TYPE_CONFIG = {
  store: { icon: Store, label: 'Store Leads', color: 'text-rose-400' },
  wholesaler: { icon: Users, label: 'Wholesaler Leads', color: 'text-amber-400' },
  influencer: { icon: Megaphone, label: 'Influencer Leads', color: 'text-purple-400' },
  ambassador: { icon: User, label: 'Ambassador Recruits', color: 'text-cyan-400' },
};

const STAGE_COLORS: Record<string, string> = {
  new: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  contacted: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  qualified: 'bg-green-500/10 text-green-500 border-green-500/20',
  negotiation: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  converted: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  lost: 'bg-red-500/10 text-red-500 border-red-500/20',
};

export function LeadIntakeTab({ ambassadorId, ambassadorUserId }: LeadIntakeTabProps) {
  // Fetch leads created by this ambassador
  const leadsQuery = useQuery({
    queryKey: ['ambassador-lead-intake', ambassadorId, ambassadorUserId],
    queryFn: async () => {
      // Query leads created by this ambassador (via ambassador_id)
      const { data, error } = await (supabase as any)
        .from('sales_prospects')
        .select('*')
        .eq('ambassador_id', ambassadorId)
        .eq('archived', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!ambassadorId,
  });

  // Fetch pending ambassador applications
  const applicationsQuery = useQuery({
    queryKey: ['ambassador-pending-applications', ambassadorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ambassador_applications')
        .select('*')
        .eq('referred_by_ambassador_id', ambassadorId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!ambassadorId,
  });

  const leads = leadsQuery.data || [];
  const applications = applicationsQuery.data || [];
  const isLoading = leadsQuery.isLoading || applicationsQuery.isLoading;

  // Group leads by type
  const storeLeads = leads.filter(l => l.lead_type === 'store');
  const wholesalerLeads = leads.filter(l => l.lead_type === 'wholesaler');
  const influencerLeads = leads.filter(l => l.lead_type === 'influencer');
  const ambassadorLeads = leads.filter(l => l.lead_type === 'ambassador');

  // Combine ambassador leads with applications
  const totalAmbassadorItems = ambassadorLeads.length + applications.length;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 text-primary" />
          Lead Intake
        </CardTitle>
        <CardDescription>
          All leads and applications created by this ambassador
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="store">
          <TabsList className="grid grid-cols-4 mb-4">
            <TabsTrigger value="store" className="text-xs">
              <Store className="h-4 w-4 mr-1.5 text-rose-400" />
              <span className="hidden sm:inline">Stores</span>
              <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 text-xs">
                {storeLeads.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="wholesaler" className="text-xs">
              <Users className="h-4 w-4 mr-1.5 text-amber-400" />
              <span className="hidden sm:inline">Wholesalers</span>
              <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 text-xs">
                {wholesalerLeads.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="influencer" className="text-xs">
              <Megaphone className="h-4 w-4 mr-1.5 text-purple-400" />
              <span className="hidden sm:inline">Influencers</span>
              <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 text-xs">
                {influencerLeads.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="ambassador" className="text-xs">
              <User className="h-4 w-4 mr-1.5 text-cyan-400" />
              <span className="hidden sm:inline">Recruits</span>
              <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 text-xs">
                {totalAmbassadorItems}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="store">
            <LeadList leads={storeLeads} type="store" />
          </TabsContent>
          <TabsContent value="wholesaler">
            <LeadList leads={wholesalerLeads} type="wholesaler" />
          </TabsContent>
          <TabsContent value="influencer">
            <LeadList leads={influencerLeads} type="influencer" />
          </TabsContent>
          <TabsContent value="ambassador">
            <ApplicationList 
              leads={ambassadorLeads} 
              applications={applications} 
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function LeadList({ leads, type }: { leads: any[]; type: string }) {
  if (leads.length === 0) {
    const config = LEAD_TYPE_CONFIG[type as keyof typeof LEAD_TYPE_CONFIG];
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <config.icon className="h-12 w-12 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No {type} leads</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Leads will appear here once created
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[350px]">
      <div className="space-y-2">
        {leads.map(lead => (
          <LeadCard key={lead.id} lead={lead} />
        ))}
      </div>
    </ScrollArea>
  );
}

function LeadCard({ lead }: { lead: any }) {
  const stageColor = STAGE_COLORS[lead.pipeline_stage] || STAGE_COLORS.new;
  const config = LEAD_TYPE_CONFIG[lead.lead_type as keyof typeof LEAD_TYPE_CONFIG];

  return (
    <div className="p-3 rounded-lg border bg-card hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <config.icon className={`h-5 w-5 ${config.color} shrink-0`} />
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">
              {lead.business_name || lead.contact_name || 'Unnamed Lead'}
            </p>
            <div className="flex items-center gap-2 mt-1">
              {lead.city && (
                <span className="text-xs text-muted-foreground">{lead.city}</span>
              )}
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(new Date(lead.created_at), 'MMM d, yyyy')}
              </span>
            </div>
          </div>
        </div>
        <Badge variant="outline" className={`shrink-0 capitalize ${stageColor}`}>
          {lead.pipeline_stage || 'new'}
        </Badge>
      </div>
    </div>
  );
}

function ApplicationList({ leads, applications }: { leads: any[]; applications: any[] }) {
  const allItems = [
    ...applications.map(app => ({ ...app, itemType: 'application' })),
    ...leads.map(lead => ({ ...lead, itemType: 'lead' })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (allItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <User className="h-12 w-12 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No ambassador recruits</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Share your referral link to recruit ambassadors
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[350px]">
      <div className="space-y-2">
        {allItems.map(item => (
          item.itemType === 'application' 
            ? <ApplicationCard key={item.id} application={item} />
            : <LeadCard key={item.id} lead={item} />
        ))}
      </div>
    </ScrollArea>
  );
}

function ApplicationCard({ application }: { application: any }) {
  const statusConfig = {
    pending_review: { color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', icon: Clock },
    approved: { color: 'bg-green-500/10 text-green-500 border-green-500/20', icon: CheckCircle2 },
    rejected: { color: 'bg-red-500/10 text-red-500 border-red-500/20', icon: AlertCircle },
  };
  
  const config = statusConfig[application.status as keyof typeof statusConfig] || statusConfig.pending_review;

  return (
    <div className="p-3 rounded-lg border bg-card hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <User className="h-5 w-5 text-cyan-400 shrink-0" />
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{application.full_name}</p>
            <div className="flex items-center gap-2 mt-1">
              {application.city && (
                <span className="text-xs text-muted-foreground">
                  {application.city}{application.state ? `, ${application.state}` : ''}
                </span>
              )}
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(new Date(application.created_at), 'MMM d, yyyy')}
              </span>
            </div>
          </div>
        </div>
        <Badge variant="outline" className={`shrink-0 capitalize ${config.color}`}>
          <config.icon className="h-3 w-3 mr-1" />
          {application.status.replace('_', ' ')}
        </Badge>
      </div>
    </div>
  );
}

export default LeadIntakeTab;
