import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useCall } from '@/components/communication/CallProvider';
import { ClickablePhone } from '@/components/communication/ClickablePhone';
import { 
  ArrowLeft, UserCheck, Phone, Mail, MapPin, Edit, 
  Instagram, MessageCircle, Tag, Building2, Globe,
  AlertTriangle, StickyNote, TrendingUp, DollarSign, 
  Store, BarChart3
} from 'lucide-react';
import { EntityNotesSection } from '@/components/grabba/EntityNotesSection';
import { useAmbassadorIntelligence } from '@/hooks/useAmbassadorIntelligence';
import {
  AmbassadorKPICards,
  AmbassadorStorePipeline,
  AmbassadorRevenuePanel,
  AmbassadorCommissionPanel,
  AmbassadorPerformanceSignals,
  AmbassadorActionBar,
  AmbassadorActivityTimeline,
  AmbassadorTerritoryPanel,
  AmbassadorIdentityHeader
} from '@/components/ambassador';

const AmbassadorProfile: React.FC = () => {
  const { ambassadorId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  // Fetch ambassador details
  const { data: ambassador, isLoading } = useQuery({
    queryKey: ['ambassador', ambassadorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ambassadors')
        .select(`
          *,
          profiles:user_id (name, email, avatar_url)
        `)
        .eq('id', ambassadorId)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!ambassadorId
  });

  // Use intelligence hook for metrics
  const { metrics, pipeline, commissions, onlineSales, isLoading: metricsLoading } = 
    useAmbassadorIntelligence(ambassadorId || '');

  // Update ambassador
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from('ambassadors').update(data).eq('id', ambassadorId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ambassador', ambassadorId] });
      toast.success('Ambassador updated');
      setEditOpen(false);
    },
    onError: () => toast.error('Failed to update ambassador')
  });

  // Toggle status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('ambassadors')
        .update({ is_active: !ambassador?.is_active })
        .eq('id', ambassadorId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ambassador', ambassadorId] });
      toast.success(`Ambassador ${ambassador?.is_active ? 'deactivated' : 'activated'}`);
    },
    onError: () => toast.error('Failed to update status')
  });

  if (isLoading) {
    return (
      <div className="p-6 text-center text-muted-foreground">Loading...</div>
    );
  }

  if (!ambassador) {
    return (
      <div className="p-6 text-center">
        <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Ambassador not found</p>
        <Button className="mt-4" onClick={() => navigate('/grabba/crm')}>
          Back to CRM
        </Button>
      </div>
    );
  }

  const ambassadorName = ambassador.profiles?.name || ambassador.name || 'Unknown Ambassador';
  const territory = ambassador.region || ambassador.neighborhood || '';
  const tags = ambassador.tags ? (typeof ambassador.tags === 'string' ? ambassador.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : ambassador.tags) : [];

  // Prepare performance metrics for signals
  const performanceMetrics = {
    totalStores: metrics?.storesAcquired || 0,
    activeStores: metrics?.storesActive || 0,
    dormantStores: metrics?.storesDormant || 0,
    totalRevenue: metrics?.totalRevenue || 0,
    avgOrderValue: metrics?.avgOrderValue || 0,
    pendingCommission: metrics?.pendingEarnings || 0,
    recentOrdersCount: metrics?.last30DaysOrders || 0
  };

  const ambassadorEmail = ambassador.email || ambassador.profiles?.email;
  const missingEmail = !ambassadorEmail;

  return (
    <div className="p-6 space-y-6">
      {/* Missing Email Warning */}
      {missingEmail && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-amber-500/50 bg-amber-500/10 text-amber-400">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Missing Email Address</p>
            <p className="text-sm text-amber-400/80">This ambassador does not have an email on file. Please edit their profile to add one.</p>
          </div>
          <Button variant="outline" size="sm" className="border-amber-500/50 text-amber-400 hover:bg-amber-500/20" onClick={() => setEditOpen(true)}>
            Add Email
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/grabba/crm')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <UserCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{ambassadorName}</h1>
              <div className="flex items-center gap-2 text-muted-foreground">
                {territory && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> {territory}
                  </span>
                )}
                <Badge variant={ambassador.is_active ? 'default' : 'secondary'}>
                  {ambassador.is_active ? 'Active' : 'Inactive'}
                </Badge>
                {ambassador.tier && (
                  <Badge variant="outline" className="capitalize">{ambassador.tier}</Badge>
                )}
              </div>
            </div>
          </div>
        </div>
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" /> Edit
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Ambassador</DialogTitle>
            </DialogHeader>
            <EditAmbassadorForm 
              ambassador={ambassador}
              onSubmit={(data) => updateMutation.mutate(data)}
              isLoading={updateMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards */}
      <AmbassadorKPICards metrics={metrics} />

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-flex">
          <TabsTrigger value="overview">
            <UserCheck className="h-4 w-4 mr-2 hidden sm:inline" /> Overview
          </TabsTrigger>
          <TabsTrigger value="stores">
            <Store className="h-4 w-4 mr-2 hidden sm:inline" /> Stores
          </TabsTrigger>
          <TabsTrigger value="revenue">
            <DollarSign className="h-4 w-4 mr-2 hidden sm:inline" /> Revenue
          </TabsTrigger>
          <TabsTrigger value="performance">
            <BarChart3 className="h-4 w-4 mr-2 hidden sm:inline" /> Performance
          </TabsTrigger>
          <TabsTrigger value="territory">
            <MapPin className="h-4 w-4 mr-2 hidden sm:inline" /> Territory
          </TabsTrigger>
          <TabsTrigger value="notes">
            <StickyNote className="h-4 w-4 mr-2 hidden sm:inline" /> Notes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Contact Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {ambassador.phone_primary && (
                  <ClickablePhone 
                    phone={ambassador.phone_primary}
                    entityType="ambassador"
                    entityId={ambassador.id}
                    entityName={ambassador.name}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors w-full text-left"
                  >
                    <Phone className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p className="font-medium">{ambassador.phone_primary}</p>
                    </div>
                  </ClickablePhone>
                )}
                {ambassador.phone_secondary && (
                  <div className="flex items-center gap-3 p-3 rounded-lg">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Secondary Phone</p>
                      <p className="font-medium">{ambassador.phone_secondary}</p>
                    </div>
                  </div>
                )}
                {ambassador.phone_whatsapp && (
                  <a href={`https://wa.me/${ambassador.phone_whatsapp}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
                    <MessageCircle className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">WhatsApp</p>
                      <p className="font-medium">{ambassador.phone_whatsapp}</p>
                    </div>
                  </a>
                )}
                {(ambassador.email || ambassador.profiles?.email) && (
                  <a href={`mailto:${ambassador.email || ambassador.profiles.email}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
                    <Mail className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{ambassador.email || ambassador.profiles?.email}</p>
                    </div>
                  </a>
                )}
                {ambassador.social_media && (
                  <div className="flex items-center gap-3 p-3 rounded-lg">
                    <Instagram className="h-5 w-5 text-pink-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Social Media</p>
                      <p className="font-medium">{ambassador.social_media}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Location & Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Location & Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {ambassador.neighborhood && (
                  <div className="flex items-center gap-3 p-3 rounded-lg">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Neighborhood</p>
                      <p className="font-medium">{ambassador.neighborhood}</p>
                    </div>
                  </div>
                )}
                {(ambassador.city || ambassador.state) && (
                  <div className="flex items-center gap-3 p-3 rounded-lg">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">City / State</p>
                      <p className="font-medium">
                        {[ambassador.city, ambassador.state].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  </div>
                )}
                {ambassador.tracking_code && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <Tag className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Tracking Code</p>
                      <p className="font-medium font-mono">{ambassador.tracking_code}</p>
                    </div>
                  </div>
                )}
                {tags.length > 0 && (
                  <div className="p-3">
                    <p className="text-sm text-muted-foreground mb-2">Tags</p>
                    <div className="flex flex-wrap gap-1">
                      {tags.map((tag: string, i: number) => (
                        <Badge key={i} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="p-3 text-sm text-muted-foreground">
                  <p>Created: {format(new Date(ambassador.created_at), 'MMM d, yyyy')}</p>
                </div>
              </CardContent>
            </Card>

            {/* Commission Panel */}
            <div className="md:col-span-2">
              <AmbassadorCommissionPanel 
                commissions={commissions} 
                metrics={metrics} 
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="stores" className="mt-4 space-y-6">
          <AmbassadorStorePipeline 
            pipeline={pipeline} 
          />
        </TabsContent>

        <TabsContent value="revenue" className="mt-4">
          <AmbassadorRevenuePanel 
            onlineSales={onlineSales}
            metrics={metrics}
          />
        </TabsContent>

        <TabsContent value="performance" className="mt-4 space-y-6">
          <AmbassadorPerformanceSignals 
            ambassadorId={ambassadorId || ''} 
            metrics={performanceMetrics}
          />
          
          {/* Activity Timeline - Real Component */}
          <AmbassadorActivityTimeline ambassadorId={ambassadorId || ''} />
        </TabsContent>

        <TabsContent value="territory" className="mt-4">
          <AmbassadorTerritoryPanel 
            ambassador={ambassador}
            stats={{
              storesInArea: metrics?.storesAcquired || 0,
              revenueInArea: metrics?.totalRevenue || 0,
              coveragePercent: metrics?.storesActive && metrics?.storesAcquired 
                ? Math.round((metrics.storesActive / Math.max(metrics.storesAcquired, 1)) * 100)
                : 0
            }}
          />
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <EntityNotesSection
            entityType="ambassador"
            entityId={ambassadorId}
            entityName={ambassadorName}
          />
        </TabsContent>
      </Tabs>

      {/* Sticky Action Bar */}
      <AmbassadorActionBar
        ambassadorId={ambassadorId || ''}
        ambassadorName={ambassadorName}
        isActive={ambassador.is_active}
        onToggleStatus={() => toggleStatusMutation.mutate()}
      />
    </div>
  );
};

// Edit Form Component
const EditAmbassadorForm: React.FC<{
  ambassador: any;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}> = ({ ambassador, onSubmit, isLoading }) => {
  const [formData, setFormData] = useState({
    name: ambassador.name || '',
    email: ambassador.email || '',
    phone_primary: ambassador.phone_primary || '',
    phone_secondary: ambassador.phone_secondary || '',
    phone_whatsapp: ambassador.phone_whatsapp || '',
    region: ambassador.region || '',
    neighborhood: ambassador.neighborhood || '',
    city: ambassador.city || '',
    state: ambassador.state || '',
    social_media: ambassador.social_media || '',
    tracking_code: ambassador.tracking_code || '',
    tier: ambassador.tier || 'starter',
  });

  return (
    <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto pr-2">
      <div>
        <label className="text-sm font-medium">Name</label>
        <Input 
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Phone</label>
          <Input 
            value={formData.phone_primary}
            onChange={(e) => setFormData(prev => ({ ...prev, phone_primary: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Secondary Phone</label>
          <Input 
            value={formData.phone_secondary}
            onChange={(e) => setFormData(prev => ({ ...prev, phone_secondary: e.target.value }))}
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">WhatsApp</label>
        <Input 
          value={formData.phone_whatsapp}
          onChange={(e) => setFormData(prev => ({ ...prev, phone_whatsapp: e.target.value }))}
        />
      </div>
      <div>
        <label className="text-sm font-medium">Social Media</label>
        <Input 
          value={formData.social_media}
          onChange={(e) => setFormData(prev => ({ ...prev, social_media: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Region</label>
          <Input 
            value={formData.region}
            onChange={(e) => setFormData(prev => ({ ...prev, region: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Neighborhood</label>
          <Input 
            value={formData.neighborhood}
            onChange={(e) => setFormData(prev => ({ ...prev, neighborhood: e.target.value }))}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">City</label>
          <Input 
            value={formData.city}
            onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-sm font-medium">State</label>
          <Input 
            value={formData.state}
            onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Tracking Code</label>
          <Input 
            value={formData.tracking_code}
            onChange={(e) => setFormData(prev => ({ ...prev, tracking_code: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Tier</label>
          <Input 
            value={formData.tier}
            onChange={(e) => setFormData(prev => ({ ...prev, tier: e.target.value }))}
          />
        </div>
      </div>
      <Button 
        className="w-full" 
        onClick={() => onSubmit(formData)}
        disabled={isLoading}
      >
        {isLoading ? 'Saving...' : 'Save Changes'}
      </Button>
    </div>
  );
};

export default AmbassadorProfile;
