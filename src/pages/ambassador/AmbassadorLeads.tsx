/**
 * Ambassador Leads Page
 * Real data from useAmbassadorLeads hook - pipelines for store/wholesaler/influencer/ambassador leads
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  Store, ShoppingCart, Users, UserPlus, Plus, 
  Search, ChevronRight, Clock, CheckCircle, XCircle,
  Phone, Mail, MapPin, Calendar, ArrowRight, Loader2, Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { AmbassadorLayout } from '@/components/ambassador/AmbassadorLayout';
import { useAmbassadorLeads, type Lead } from '@/hooks/useAmbassadorLeads';
import { useAuth } from '@/contexts/AuthContext';
import { useViewAs } from '@/contexts/ViewAsContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

export default function AmbassadorLeads() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isViewingAs, effectiveAmbassadorId, effectiveUserId } = useViewAs();
  const { ambassadorId: routeAmbassadorId } = useParams<{ ambassadorId?: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [selectedLeadType, setSelectedLeadType] = useState<'store' | 'wholesaler' | 'ambassador' | 'influencer'>('store');
  const [leadDetailOpen, setLeadDetailOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [activeLane, setActiveLane] = useState<'stores' | 'wholesalers' | 'influencers' | 'ambassadors'>('stores');
  const [debugOpen, setDebugOpen] = useState(false);

  // Resolve targetUserId from route ambassador ID if present
  const { data: targetAmbassador, isLoading: isTargetAmbassadorLoading } = useQuery({
    queryKey: ['ambassador-by-id', routeAmbassadorId],
    queryFn: async () => {
      if (!routeAmbassadorId) return null;
      const { data, error } = await supabase
        .from('ambassadors')
        .select('id, name, user_id, recruited_by_ambassador_id')
        .eq('id', routeAmbassadorId)
        .single();
      if (error) {
        console.warn('Failed to fetch target ambassador:', error);
        return null;
      }
      return data;
    },
    enabled: !!routeAmbassadorId,
  });

  // RESOLUTION RULE (non-negotiable): if routeAmbassadorId exists, it MUST win.
  // IMPORTANT: if target ambassador has no user_id yet, DO NOT fall back to current user.
  const pipelineUserId = useMemo(() => {
    if (routeAmbassadorId) return targetAmbassador?.user_id ?? null;
    return effectiveUserId ?? user?.id ?? null;
  }, [routeAmbassadorId, targetAmbassador?.user_id, effectiveUserId, user?.id]);
  
  // Real data from hook - now scoped to target user if viewing another ambassador
  const { 
    leads,
    storeLeads, wholesalerLeads, influencerLeads, ambassadorLeads,
    getLeadsByStage, storeStages, wholesalerStages, influencerStages, ambassadorStages,
    isLoading, createLead, isCreatingLead, updateStage,
    isFetching,
    refetchLeads,
    leadsUpdatedAt,
    // Lane-specific conversions
    convertToStore, isConvertingToStore,
    convertToWholesaler, isConvertingToWholesaler,
    convertToAmbassador, isConvertingToAmbassador,
    convertToInfluencer, isConvertingToInfluencer,
    // Delete
    deleteLead, isDeletingLead,
    getStageDisplayName,
    // Read-only mode
    isReadOnly: hookIsReadOnly,
  } = useAmbassadorLeads(undefined, pipelineUserId);

  // Admin-only debug visibility (DEV always shows)
  const { data: userRoles } = useQuery({
    queryKey: ['user-roles', user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as string[];
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      if (error) {
        return [] as string[];
      }
      return (data || []).map((r: any) => String(r.role));
    },
    enabled: !!user?.id,
  });

  const isAdmin = import.meta.env.DEV || (userRoles || []).some(r => r === 'admin' || r === 'owner');

  const isViewingOtherAmbassador = !!routeAmbassadorId && routeAmbassadorId !== (effectiveAmbassadorId ?? null);
  const isReadOnly = isViewingAs || isViewingOtherAmbassador || hookIsReadOnly;

  const canViewScopedPipeline = useMemo(() => {
    if (!routeAmbassadorId) return true;
    if (isAdmin) return true;
    if (!effectiveAmbassadorId) return false;
    if (routeAmbassadorId === effectiveAmbassadorId) return true;
    return targetAmbassador?.recruited_by_ambassador_id === effectiveAmbassadorId;
  }, [routeAmbassadorId, isAdmin, effectiveAmbassadorId, targetAmbassador?.recruited_by_ambassador_id]);

  useEffect(() => {
    if (!routeAmbassadorId) return;
    if (isAdmin) return;
    if (isTargetAmbassadorLoading) return;

    if (!canViewScopedPipeline) {
      toast.error("You don't have permission to view this pipeline");
      navigate('/ambassador/leads', { replace: true });
    }
  }, [routeAmbassadorId, isAdmin, isTargetAmbassadorLoading, canViewScopedPipeline, navigate]);

  const { data: ambassadorId } = useQuery({
    queryKey: ['ambassador-self-debug', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('ambassadors')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) {
        return null;
      }
      return data?.[0]?.id ?? null;
    },
    enabled: !!user?.id,
  });

  const kpiCounts = useMemo(() => {
    const counts: Record<'store' | 'wholesaler' | 'influencer' | 'ambassador', number> = {
      store: 0,
      wholesaler: 0,
      influencer: 0,
      ambassador: 0,
    };

    (leads || []).forEach((l) => {
      if (l?.lead_type && l.lead_type in counts) {
        counts[l.lead_type] += 1;
      }
    });

    return counts;
  }, [leads]);

  const laneToLeadType: Record<'stores' | 'wholesalers' | 'influencers' | 'ambassadors', 'store' | 'wholesaler' | 'influencer' | 'ambassador'> = {
    stores: 'store',
    wholesalers: 'wholesaler',
    influencers: 'influencer',
    ambassadors: 'ambassador',
  };

  const getEffectiveStage = (lead: Lead, laneStages: string[]) => {
    const s = (lead.stage || '').toLowerCase();
    if (laneStages.includes(s)) return s;
    // No silent drops: if stage isn't in this lane's configured columns, show it in the first column.
    return laneStages.includes('new') ? 'new' : (laneStages[0] || s);
  };

  // Form state for new lead
  const [newLead, setNewLead] = useState({
    name: '',
    contact_name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    zipcode: '',
    notes: '',
  });

  const handleCreateLead = async () => {
    if (!newLead.name.trim()) {
      toast.error('Please enter a business/contact name');
      return;
    }
    
    try {
      await createLead({
        ...newLead,
        lead_type: selectedLeadType,
        source: `${selectedLeadType}_referral`,
      });

      // GUARANTEED OUTCOME: force refetch now (not just invalidate) so the UI updates immediately.
      await refetchLeads();

      setAddLeadOpen(false);
      setNewLead({ name: '', contact_name: '', phone: '', email: '', address: '', city: '', state: '', zipcode: '', notes: '' });
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleForceRefetch = async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: ['ambassador-leads'] });
      await refetchLeads();
      toast.success('Pipeline refetched');
    } catch (e) {
      toast.error(`Refetch failed: ${(e as Error).message}`);
    }
  };

  const handleCopySnapshot = async () => {
    const snapshot = {
      timestamp: new Date().toISOString(),
      route: location.pathname,
      auth_user_id: user?.id ?? null,
      effective_user_id: effectiveUserId ?? null,
      effective_ambassador_id: effectiveAmbassadorId ?? null,
      route_ambassador_id: routeAmbassadorId ?? null,
      resolved_pipeline_user_id: pipelineUserId,
      ambassador_id: ambassadorId ?? null,
      pipeline_query_key: ['ambassador-leads', pipelineUserId, null],
      pipeline_query: {
        table: 'sales_prospects',
        filters: {
          assigned_to: pipelineUserId,
          archived: false,
        },
        order_by: 'created_at desc',
      },
      kpi_counts: kpiCounts,
      active_filters: {
        active_lane: activeLane,
        search: searchQuery,
      },
      rows: {
        length: (leads || []).length,
        first5: (leads || []).slice(0, 5).map(l => ({
          id: l.id,
          lead_type: l.lead_type,
          assigned_to: l.assigned_to ?? null,
          archived: l.archived ?? null,
          pipeline_stage: l.stage,
          created_by: '(column not present on sales_prospects)',
        })),
      }
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
      toast.success('Pipeline snapshot copied');
    } catch (e) {
      console.error('Clipboard write failed:', e);
      toast.error('Could not copy snapshot (clipboard blocked)');
    }
  };

  const handleMoveStage = async (lead: Lead, newStage: string) => {
    try {
      await updateStage({ leadId: lead.id, newStage });
    } catch (error) {
      // Error handled in hook
    }
  };

  // Lane-specific conversion handlers - leads NEVER cross lanes
  const handleConvertLead = async (lead: Lead) => {
    try {
      switch (lead.lead_type) {
        case 'store':
          await convertToStore({ leadId: lead.id, lead });
          break;
        case 'wholesaler':
          await convertToWholesaler({ leadId: lead.id, lead });
          break;
        case 'ambassador':
          await convertToAmbassador({ leadId: lead.id, lead });
          break;
        case 'influencer':
          await convertToInfluencer({ leadId: lead.id, lead });
          break;
        default:
          throw new Error(`Unknown lead type: ${lead.lead_type}`);
      }
      setLeadDetailOpen(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  // Check if any conversion is in progress
  const isConverting = isConvertingToStore || isConvertingToWholesaler || isConvertingToAmbassador || isConvertingToInfluencer;

  // Handle delete confirmation
  const handleDeleteClick = (lead: Lead) => {
    setLeadToDelete(lead);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!leadToDelete) return;
    try {
      await deleteLead(leadToDelete.id);
      setDeleteConfirmOpen(false);
      setLeadToDelete(null);
      setLeadDetailOpen(false);
      setSelectedLead(null);
    } catch (error) {
      // Error handled in hook
    }
  };

  // Get conversion button text based on lead type
  const getConversionButtonText = (leadType: string) => {
    switch (leadType) {
      case 'store': return 'Convert to Store & Assign';
      case 'wholesaler': return 'Convert to Wholesaler';
      case 'ambassador': return 'Convert to Ambassador';
      case 'influencer': return 'Activate Influencer';
      default: return 'Convert';
    }
  };

  const openLeadDetail = (lead: Lead) => {
    setSelectedLead(lead);
    setLeadDetailOpen(true);
  };

  // Define pipelines with real data
  const pipelines = [
    {
      id: 'stores',
      name: 'Store Leads',
      icon: <Store className="h-4 w-4" />,
      stages: storeStages,
      leads: storeLeads,
    },
    {
      id: 'wholesalers',
      name: 'Wholesaler Leads',
      icon: <ShoppingCart className="h-4 w-4" />,
      stages: wholesalerStages,
      leads: wholesalerLeads,
    },
    {
      id: 'influencers',
      name: 'Influencer / Street Team',
      icon: <Users className="h-4 w-4" />,
      stages: influencerStages,
      leads: influencerLeads,
    },
    {
      id: 'ambassadors',
      name: 'Ambassador Recruits',
      icon: <UserPlus className="h-4 w-4" />,
      stages: ambassadorStages,
      leads: ambassadorLeads,
    },
  ];

  const getStageColor = (stage: string) => {
    // Match lowercase stages from DB
    const colors: Record<string, string> = {
      'new': 'bg-gray-500',
      'identified': 'bg-gray-500',
      'applied': 'bg-gray-500',
      'contacted': 'bg-blue-500',
      'reached out': 'bg-blue-500',
      'screening': 'bg-blue-500',
      'meeting set': 'bg-purple-500',
      'qualified': 'bg-purple-500',
      'interested': 'bg-purple-500',
      'interview': 'bg-purple-500',
      'proposal': 'bg-yellow-500',
      'onboarding': 'bg-yellow-500',
      'training': 'bg-yellow-500',
      'background check': 'bg-yellow-500',
      'negotiation': 'bg-orange-500',
      'won': 'bg-green-500',
      'active': 'bg-green-500',
      'lost': 'bg-red-500',
    };
    return colors[stage.toLowerCase()] || 'bg-gray-500';
  };

  if (isLoading) {
    return (
      <AmbassadorLayout 
        title={t("amb.leads.title")} 
        subtitle={t("amb.leads.subtitle")}
        backPath="/ambassador/dashboard"
      >
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      </AmbassadorLayout>
    );
  }

  if (routeAmbassadorId && isTargetAmbassadorLoading) {
    return (
      <AmbassadorLayout 
        title={t("amb.leads.title")} 
        subtitle="Loading pipeline context…"
        backPath={routeAmbassadorId ? `/profile/ambassador/${routeAmbassadorId}` : "/ambassador/dashboard"}
      >
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      </AmbassadorLayout>
    );
  }

  return (
    <AmbassadorLayout 
      title={isReadOnly && targetAmbassador ? `Pipeline for ${targetAmbassador.name || 'Ambassador'}` : "Leads Pipeline"}
      subtitle={isReadOnly ? "Read-only view — Leads created by this ambassador" : "Manage prospects across all channels"}
      backPath={routeAmbassadorId ? `/profile/ambassador/${routeAmbassadorId}` : "/ambassador/dashboard"}
    >
      <div className="p-6 space-y-6">
        {/* Read-Only Context Banner */}
        {isReadOnly && targetAmbassador && (
          <Alert className="bg-primary/10 border-primary/30">
            <Eye className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>
                <strong>Viewing Pipeline for {targetAmbassador.name}</strong>
                <span className="ml-2 text-muted-foreground">· Read-only mode · Leads created by this ambassador</span>
              </span>
            </AlertDescription>
          </Alert>
        )}

        {/* Pipeline Debug (Admin-only, DEV always) */}
        {isAdmin && (
          <Collapsible open={debugOpen} onOpenChange={setDebugOpen}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm">
                  Pipeline Debug
                </Button>
              </CollapsibleTrigger>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleForceRefetch}>
                  Force Refetch Now
                </Button>
                <Button variant="outline" size="sm" onClick={handleCopySnapshot}>
                  Copy Pipeline Snapshot
                </Button>
              </div>
            </div>
            <CollapsibleContent>
              <Card className="mt-3 border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Pipeline Debug</CardTitle>
                  <CardDescription>
                    Live visibility into pipeline binding, filters, and returned rows.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <div><span className="text-muted-foreground">route:</span> <span className="font-mono">{location.pathname}</span></div>
                      <div><span className="text-muted-foreground">auth user.id:</span> <span className="font-mono">{user?.id || '—'}</span></div>
                      <div><span className="text-muted-foreground">ambassador.id:</span> <span className="font-mono">{ambassadorId || '—'}</span></div>
                      <div><span className="text-muted-foreground">active lane:</span> <span className="font-mono">{activeLane}</span></div>
                      <div><span className="text-muted-foreground">search:</span> <span className="font-mono">{searchQuery || '—'}</span></div>
                      <div><span className="text-muted-foreground">isFetching:</span> <span className="font-mono">{String(isFetching)}</span></div>
                      <div><span className="text-muted-foreground">last refreshed:</span> <span className="font-mono">{leadsUpdatedAt ? new Date(leadsUpdatedAt).toLocaleString() : '—'}</span></div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-muted-foreground">pipeline query (authoritative)</div>
                      <pre className="text-xs rounded-md bg-muted/30 border border-border/50 p-3 whitespace-pre-wrap break-words font-mono">
{`from('sales_prospects')\n  .select('*')\n  .eq('assigned_to', ${user?.id ? `'${user.id}'` : 'null'})\n  .eq('archived', false)\n  .order('created_at', { ascending: false })`}
                      </pre>
                      <div className="text-muted-foreground">query keys</div>
                      <pre className="text-xs rounded-md bg-muted/30 border border-border/50 p-3 whitespace-pre-wrap break-words font-mono">
{JSON.stringify({
  pipeline: ['ambassador-leads', user?.id, null],
  invalidatePrefix: ['ambassador-leads'],
}, null, 2)}
                      </pre>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">raw leads</div>
                      <pre className="text-xs rounded-md bg-muted/30 border border-border/50 p-3 whitespace-pre-wrap break-words font-mono">
{JSON.stringify({
  length: (leads || []).length,
  first5: (leads || []).slice(0, 5).map(l => ({
    id: l.id,
    lead_type: l.lead_type,
    assigned_to: l.assigned_to ?? null,
    archived: l.archived ?? null,
    pipeline_stage: l.stage,
    created_by: '(column not present on sales_prospects)',
  })),
}, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">KPI counts (derived from raw leads)</div>
                      <pre className="text-xs rounded-md bg-muted/30 border border-border/50 p-3 whitespace-pre-wrap break-words font-mono">
{JSON.stringify(kpiCounts, null, 2)}
                      </pre>
                      {(leads || []).length === 0 && (
                        <div className="mt-3 text-sm border border-destructive/30 bg-destructive/5 text-destructive rounded-md p-3">
                          Select returned 0 rows. If create succeeded but this stays 0, SELECT RLS is likely blocking visibility.
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* KPI Summary Cards - MASTER GENIUS ARCHITECT: Always render, never conditional on truthy count */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {pipelines.map((pipeline) => {
            // CRITICAL: force render from authoritative counts object, never from UI columns
            const leadType = laneToLeadType[pipeline.id as keyof typeof laneToLeadType];
            const countNum = Number(kpiCounts?.[leadType] ?? 0);
            const count = Number.isNaN(countNum) ? 0 : countNum;
            
            return (
              <Card 
                key={pipeline.id}
                className="border-primary/20 hover:border-primary/40 transition-colors cursor-pointer"
                onClick={() => {
                  // Scroll to corresponding tab or set active
                  const tabElement = document.querySelector(`[value="${pipeline.id}"]`);
                  tabElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  (tabElement as HTMLElement)?.click();
                }}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                      {pipeline.icon}
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{pipeline.name}</p>
                      <p className="text-2xl font-bold font-mono">{count}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Pipeline Tabs */}
        <Tabs value={activeLane} onValueChange={(v) => setActiveLane(v as any)} className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <TabsList className="flex-wrap h-auto">
              {pipelines.map((pipeline) => (
                <TabsTrigger key={pipeline.id} value={pipeline.id} className="gap-2">
                  {pipeline.icon}
                  <span className="hidden sm:inline">{pipeline.name}</span>
                  <Badge variant="secondary" className="ml-1">
                    {Number.isNaN(Number(kpiCounts?.[laneToLeadType[pipeline.id as keyof typeof laneToLeadType]] ?? 0))
                      ? 0
                      : Number(kpiCounts?.[laneToLeadType[pipeline.id as keyof typeof laneToLeadType]] ?? 0)
                    }
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
            {!isReadOnly && (
              <Button onClick={() => setAddLeadOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Lead
              </Button>
            )}
          </div>

          {pipelines.map((pipeline) => (
            <TabsContent key={pipeline.id} value={pipeline.id} className="space-y-4">
              {/* Search */}
              <div className="relative w-full md:w-[300px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder={`Search ${pipeline.name.toLowerCase()}...`}
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Kanban-style Stage View */}
              <div className="overflow-x-auto pb-4">
                <div className="flex gap-4 min-w-max">
                  {pipeline.stages.map((stage) => {
                    const stageLeads = pipeline.leads.filter(l => 
                      getEffectiveStage(l, pipeline.stages) === stage && 
                      (searchQuery === '' || l.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    );
                    
                    return (
                      <div 
                        key={stage}
                        className="w-[300px] flex-shrink-0"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${getStageColor(stage)}`} />
                            <span className="font-medium">{getStageDisplayName(stage)}</span>
                          </div>
                          <Badge variant="secondary">{stageLeads.length}</Badge>
                        </div>
                        
                        <div className="space-y-3">
                          {stageLeads.map((lead) => (
                            <Card 
                              key={lead.id}
                              className="cursor-pointer hover:border-primary/50 transition-colors"
                              onClick={() => openLeadDetail(lead)}
                            >
                              <CardContent className="p-4">
                                <div className="font-medium mb-2">{lead.name}</div>
                                
                                {lead.contact_name && (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                    <Users className="h-3 w-3" />
                                    {lead.contact_name}
                                  </div>
                                )}
                                
                                {lead.phone && (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                    <Phone className="h-3 w-3" />
                                    {lead.phone}
                                  </div>
                                )}
                                
                                {lead.address && (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                    <MapPin className="h-3 w-3" />
                                    <span className="truncate">{lead.address}</span>
                                  </div>
                                )}

                                {lead.next_follow_up && (
                                  <div className="mt-3 pt-3 border-t">
                                    <div className="flex items-center gap-2 text-xs">
                                      <Calendar className="h-3 w-3 text-primary" />
                                      <span className="text-primary font-medium">Follow up</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {format(new Date(lead.next_follow_up), 'MMM d, yyyy')}
                                    </div>
                                  </div>
                                )}
                                
                                <div className="flex items-center justify-between mt-3 pt-3 border-t">
                                  <span className="text-xs text-muted-foreground">
                                    Added {format(new Date(lead.created_at), 'MMM d, yyyy')}
                                  </span>
                                  <Button variant="ghost" size="sm" className="h-7 px-2">
                                    <ArrowRight className="h-3 w-3" />
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                          
                          {stageLeads.length === 0 && (
                            <div className="border-2 border-dashed rounded-lg p-6 text-center text-muted-foreground">
                              <p className="text-sm">No leads in this stage</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Empty state for pipeline */}
              {pipeline.leads.length === 0 && (
                <div className="text-center py-12">
                  <div className="p-3 rounded-full bg-muted/50 w-fit mx-auto mb-4">
                    {pipeline.icon}
                  </div>
                  <h3 className="font-medium mb-2">No {pipeline.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {isReadOnly 
                      ? 'This ambassador has not created any leads in this pipeline yet'
                      : 'Start building your pipeline by adding leads'
                    }
                  </p>
                  {!isReadOnly && (
                    <Button onClick={() => {
                      const typeMap: Record<string, 'store' | 'wholesaler' | 'ambassador' | 'influencer'> = {
                        'stores': 'store',
                        'wholesalers': 'wholesaler', 
                        'influencers': 'influencer',
                        'ambassadors': 'ambassador'
                      };
                      setSelectedLeadType(typeMap[pipeline.id] || 'store');
                      setAddLeadOpen(true);
                    }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add {pipeline.name.replace(' Leads', '')}
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Add Lead Modal */}
      <Dialog open={addLeadOpen} onOpenChange={setAddLeadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Lead</DialogTitle>
            <DialogDescription>
              Enter details for the new prospect
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Lead Type</Label>
              <Select value={selectedLeadType} onValueChange={(v) => setSelectedLeadType(v as 'store' | 'wholesaler' | 'ambassador' | 'influencer')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="store">Store</SelectItem>
                  <SelectItem value="wholesaler">Wholesaler</SelectItem>
                  <SelectItem value="influencer">Influencer / Street Team</SelectItem>
                  <SelectItem value="ambassador">Ambassador Recruit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Business / Contact Name *</Label>
              <Input 
                value={newLead.name}
                onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                placeholder="e.g. Quick Stop Deli"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Contact Name</Label>
                <Input 
                  value={newLead.contact_name}
                  onChange={(e) => setNewLead({ ...newLead, contact_name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input 
                  value={newLead.phone}
                  onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input 
                type="email"
                value={newLead.email}
                onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                placeholder="contact@business.com"
              />
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <AddressAutocomplete
                value={newLead.address}
                onChange={(val) => setNewLead({ ...newLead, address: val })}
                onSelect={(parsed) => setNewLead(prev => ({
                  ...prev,
                  address: parsed.street,
                  city: parsed.city,
                  state: parsed.state,
                  zipcode: parsed.zip,
                }))}
                placeholder="Start typing an address..."
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>City</Label>
                <Input 
                  value={newLead.city}
                  onChange={(e) => setNewLead({ ...newLead, city: e.target.value })}
                  placeholder="New York"
                />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input 
                  value={newLead.state}
                  onChange={(e) => setNewLead({ ...newLead, state: e.target.value })}
                  placeholder="NY"
                />
              </div>
              <div className="space-y-2">
                <Label>Zip Code</Label>
                <Input 
                  value={newLead.zipcode}
                  onChange={(e) => setNewLead({ ...newLead, zipcode: e.target.value })}
                  placeholder="10001"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea 
                value={newLead.notes}
                onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                placeholder="Any additional notes..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddLeadOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateLead} disabled={isCreatingLead}>
              {isCreatingLead && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lead Detail Modal */}
      <Dialog open={leadDetailOpen} onOpenChange={setLeadDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedLead?.name}</DialogTitle>
            <DialogDescription>
              Lead details and actions
            </DialogDescription>
          </DialogHeader>
          
          {selectedLead && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2 mb-4">
                <Badge className={getStageColor(selectedLead.stage)}>{selectedLead.stage}</Badge>
                <Badge variant="outline">{selectedLead.lead_type}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                {selectedLead.contact_name && (
                  <div>
                    <p className="text-muted-foreground">Contact</p>
                    <p className="font-medium">{selectedLead.contact_name}</p>
                  </div>
                )}
                {selectedLead.phone && (
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <p className="font-medium">{selectedLead.phone}</p>
                  </div>
                )}
                {selectedLead.email && (
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="font-medium">{selectedLead.email}</p>
                  </div>
                )}
                {selectedLead.address && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Address</p>
                    <p className="font-medium">{selectedLead.address}{selectedLead.city ? `, ${selectedLead.city}` : ''}{selectedLead.state ? `, ${selectedLead.state}` : ''}</p>
                  </div>
                )}
              </div>

              {selectedLead.notes && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm bg-muted/50 p-3 rounded-lg">{selectedLead.notes}</p>
                </div>
              )}

              {/* Stage movement - disabled in read-only mode */}
              {!isReadOnly && (
                <div className="pt-4 border-t space-y-3">
                  <p className="text-sm font-medium">Move to Stage</p>
                  <div className="flex flex-wrap gap-2">
                    {(selectedLead.lead_type === 'store' ? storeStages :
                      selectedLead.lead_type === 'wholesaler' ? wholesalerStages :
                      selectedLead.lead_type === 'influencer' ? influencerStages : ambassadorStages
                    ).map(stage => (
                      <Button
                        key={stage}
                        variant={selectedLead.stage === stage ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleMoveStage(selectedLead, stage)}
                      >
                        {stage}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Lane-specific conversion button - shows for all lead types, hidden in read-only mode */}
              {!isReadOnly && selectedLead.stage !== 'won' && selectedLead.stage !== 'lost' && selectedLead.stage !== 'active' && (
                <div className="pt-4 border-t">
                  <Button 
                    className="w-full" 
                    onClick={() => handleConvertLead(selectedLead)}
                    disabled={isConverting}
                  >
                    {isConverting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {getConversionButtonText(selectedLead.lead_type)}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    {selectedLead.lead_type === 'store' && 'This will create a store record and assign it to you'}
                    {selectedLead.lead_type === 'wholesaler' && 'This will create a wholesaler record'}
                    {selectedLead.lead_type === 'ambassador' && 'This will submit for ambassador onboarding'}
                    {selectedLead.lead_type === 'influencer' && 'This will activate the influencer'}
                  </p>
                </div>
              )}

              {/* Delete Button - hidden in read-only mode */}
              {!isReadOnly && (
                <div className="pt-4 border-t">
                  <Button 
                    variant="destructive"
                    className="w-full" 
                    onClick={() => handleDeleteClick(selectedLead)}
                    disabled={isDeletingLead}
                  >
                    {isDeletingLead && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Lead
                  </Button>
                </div>
              )}

              {/* Read-only notice */}
              {isReadOnly && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground text-center">
                    You are viewing this lead in read-only mode
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Lead</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{leadToDelete?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} disabled={isDeletingLead}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeletingLead}>
              {isDeletingLead && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AmbassadorLayout>
  );
}
