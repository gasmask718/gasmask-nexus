/**
 * WholesalerProfile — Dual-Engine Control Panel
 * 
 * Engine 1: GasMask Supply Relationship (B2B Ledger)
 * Engine 2: Wholesale Marketplace Portal (Platform Revenue)
 * 
 * Separated data. Separated reporting. Shared identity.
 * Tier, credit limit, and AI score persisted in DB.
 */
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  ArrowLeft, Warehouse, Phone, Mail, MapPin, Edit, 
  Instagram, MessageCircle, Tag, Building2, Globe,
  AlertTriangle, DollarSign, ShoppingBag,
  CreditCard, Shield
} from 'lucide-react';
import { EntityNotesSection } from '@/components/grabba/EntityNotesSection';
import { useCall } from '@/components/communication/CallProvider';
import { WholesalerSupplyTab } from '@/components/wholesaler/WholesalerSupplyTab';
import { WholesalerMarketplaceTab } from '@/components/wholesaler/WholesalerMarketplaceTab';

const WholesalerProfile: React.FC = () => {
  const { wholesalerId, id } = useParams();
  const resolvedId = wholesalerId || id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { initiateCall } = useCall();
  const [editOpen, setEditOpen] = useState(false);

  // Fetch wholesaler identity
  const { data: wholesaler, isLoading } = useQuery({
    queryKey: ['wholesaler', resolvedId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wholesalers')
        .select('*')
        .eq('id', resolvedId)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!resolvedId
  });

  // Fetch supply-side data
  const { data: orders = [] } = useQuery({
    queryKey: ['wholesaler-orders', resolvedId],
    queryFn: async () => {
      const { data, error } = await supabase.from('wholesaler_orders').select('*').eq('wholesaler_id', resolvedId!).order('order_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!resolvedId,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['wholesaler-payments', resolvedId],
    queryFn: async () => {
      const { data, error } = await supabase.from('wholesaler_payments').select('*').eq('wholesaler_id', resolvedId!).order('payment_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!resolvedId,
  });

  const { data: disputes = [] } = useQuery({
    queryKey: ['wholesaler-disputes', resolvedId],
    queryFn: async () => {
      const { data, error } = await supabase.from('wholesaler_disputes').select('*').eq('wholesaler_id', resolvedId!).order('opened_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!resolvedId,
  });

  // Supply summary from view
  const { data: supplySummary } = useQuery({
    queryKey: ['wholesaler-supply-summary', resolvedId],
    queryFn: async () => {
      const { data, error } = await supabase.from('wholesaler_supply_summary').select('*').eq('wholesaler_id', resolvedId!).maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!resolvedId,
  });

  // Marketplace summary from view
  const { data: marketplaceSummary } = useQuery({
    queryKey: ['wholesaler-marketplace-summary', resolvedId],
    queryFn: async () => {
      const { data, error } = await supabase.from('wholesaler_marketplace_summary').select('*').eq('wholesaler_id', resolvedId!).maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!resolvedId,
  });

  // Update wholesaler
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from('wholesalers').update(data).eq('id', resolvedId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wholesaler', resolvedId] });
      queryClient.invalidateQueries({ queryKey: ['wholesaler-supply-summary', resolvedId] });
      toast.success('Wholesaler updated');
      setEditOpen(false);
    },
    onError: (error: any) => {
      console.error('Update Wholesaler Error:', error);
      toast.error(`Failed to update wholesaler: ${error?.message || 'Unknown error'}`);
    }
  });

  if (isLoading) {
    return <div className="p-6 text-center text-muted-foreground">Loading...</div>;
  }

  if (!wholesaler) {
    return (
      <div className="p-6 text-center">
        <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Wholesaler not found</p>
        <Button className="mt-4" onClick={() => navigate('/grabba/store-master')}>Back to CRM</Button>
      </div>
    );
  }

  const wholesalerName = wholesaler.name || 'Unknown Wholesaler';
  const territory = wholesaler.neighborhood || '';
  const tags = wholesaler.tags ? (typeof wholesaler.tags === 'string' ? wholesaler.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : wholesaler.tags) : [];

  // DB-persisted tier (with fallback calculation)
  const tier = wholesaler.tier || 'silver';
  const tierDisplay = tier.charAt(0).toUpperCase() + tier.slice(1);
  const tierColor = tier === 'platinum' ? 'bg-purple-500/15 text-purple-400 border-purple-500/30' :
                    tier === 'gold' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                    'bg-muted text-muted-foreground';

  const lifetimePurchases = supplySummary?.lifetime_purchase_total || 0;
  const unpaidBalance = supplySummary?.unpaid_balance || 0;
  const marketplaceRevenue = marketplaceSummary?.total_revenue_generated || 0;

  return (
    <div className="p-6 space-y-6">
      {/* ===== HEADER: Identity + Status + Tier + Summary Intel ===== */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/grabba/store-master')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-orange-500/10 flex items-center justify-center">
              <Warehouse className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{wholesalerName}</h1>
                <Badge className={tierColor}>{tierDisplay}</Badge>
                <Badge variant={wholesaler.status === 'active' ? 'default' : 'secondary'}>
                  {wholesaler.status || 'Active'}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                {territory && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {territory}</span>}
                {wholesaler.payment_terms && <span className="flex items-center gap-1"><CreditCard className="h-3.5 w-3.5" /> {wholesaler.payment_terms}</span>}
                {wholesaler.credit_limit > 0 && <span className="flex items-center gap-1"><Shield className="h-3.5 w-3.5" /> Credit: ${Number(wholesaler.credit_limit).toLocaleString()}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Header Summary Badges */}
        <div className="hidden lg:flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Supply Lifetime</p>
            <p className="text-lg font-bold text-emerald-400">${Number(lifetimePurchases).toLocaleString()}</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Unpaid</p>
            <p className={`text-lg font-bold ${unpaidBalance > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>${Number(unpaidBalance).toLocaleString()}</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Marketplace Rev</p>
            <p className="text-lg font-bold text-blue-400">${Number(marketplaceRevenue).toLocaleString()}</p>
          </div>
        </div>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger asChild>
            <Button variant="outline"><Edit className="h-4 w-4 mr-2" /> Edit</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Edit Wholesaler</DialogTitle></DialogHeader>
            <EditWholesalerForm wholesaler={wholesaler} onSubmit={(data) => updateMutation.mutate(data)} isLoading={updateMutation.isPending} />
          </DialogContent>
        </Dialog>
      </div>

      {/* ===== DUAL-ENGINE TABS ===== */}
      <Tabs defaultValue="supply" className="w-full">
        <TabsList className="grid grid-cols-3 w-full max-w-lg">
          <TabsTrigger value="supply" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <span>Supply Relationship</span>
          </TabsTrigger>
          <TabsTrigger value="marketplace" className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            <span>Marketplace Portal</span>
          </TabsTrigger>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span>Identity</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="supply" className="mt-6">
          <WholesalerSupplyTab wholesalerId={resolvedId!} orders={orders} payments={payments} disputes={disputes} profile={wholesaler} />
        </TabsContent>

        <TabsContent value="marketplace" className="mt-6">
          <WholesalerMarketplaceTab wholesalerId={resolvedId!} />
        </TabsContent>

        <TabsContent value="overview" className="mt-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">Contact Information</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {wholesaler.phone && (
                  <button onClick={() => initiateCall({ destinationPhone: wholesaler.phone, entityType: 'wholesaler', entityId: wholesaler.id, entityName: wholesaler.name })} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors w-full text-left">
                    <Phone className="h-5 w-5 text-primary" />
                    <div><p className="text-sm text-muted-foreground">Phone</p><p className="font-medium">{wholesaler.phone}</p></div>
                  </button>
                )}
                {wholesaler.phone_secondary && (
                  <div className="flex items-center gap-3 p-3 rounded-lg"><Phone className="h-5 w-5 text-muted-foreground" /><div><p className="text-sm text-muted-foreground">Secondary Phone</p><p className="font-medium">{wholesaler.phone_secondary}</p></div></div>
                )}
                {wholesaler.phone_whatsapp && (
                  <a href={`https://wa.me/${wholesaler.phone_whatsapp}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"><MessageCircle className="h-5 w-5 text-green-500" /><div><p className="text-sm text-muted-foreground">WhatsApp</p><p className="font-medium">{wholesaler.phone_whatsapp}</p></div></a>
                )}
                {wholesaler.email && (
                  <a href={`mailto:${wholesaler.email}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"><Mail className="h-5 w-5 text-primary" /><div><p className="text-sm text-muted-foreground">Email</p><p className="font-medium">{wholesaler.email}</p></div></a>
                )}
                {wholesaler.social_media && (
                  <div className="flex items-center gap-3 p-3 rounded-lg"><Instagram className="h-5 w-5 text-pink-500" /><div><p className="text-sm text-muted-foreground">Social Media</p><p className="font-medium">{wholesaler.social_media}</p></div></div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Location & Details</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {wholesaler.neighborhood && (
                  <div className="flex items-center gap-3 p-3 rounded-lg"><Building2 className="h-5 w-5 text-muted-foreground" /><div><p className="text-sm text-muted-foreground">Neighborhood</p><p className="font-medium">{wholesaler.neighborhood}</p></div></div>
                )}
                {(wholesaler.city || wholesaler.state) && (
                  <div className="flex items-center gap-3 p-3 rounded-lg"><Globe className="h-5 w-5 text-muted-foreground" /><div><p className="text-sm text-muted-foreground">City / State</p><p className="font-medium">{[wholesaler.city, wholesaler.state].filter(Boolean).join(', ')}</p></div></div>
                )}
                {/* Tier & Credit Summary */}
                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Tier</span>
                    <Badge className={tierColor}>{tierDisplay}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Credit Limit</span>
                    <span className="text-sm font-medium">${Number(wholesaler.credit_limit || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Payment Terms</span>
                    <span className="text-sm font-medium">{wholesaler.payment_terms || 'Not set'}</span>
                  </div>
                </div>
                {tags.length > 0 && (
                  <div className="p-3"><p className="text-sm text-muted-foreground mb-2">Tags</p><div className="flex flex-wrap gap-1">{tags.map((tag: string, i: number) => (<Badge key={i} variant="secondary">{tag}</Badge>))}</div></div>
                )}
                <div className="p-3 text-sm text-muted-foreground"><p>Created: {format(new Date(wholesaler.created_at), 'MMM d, yyyy')}</p></div>
              </CardContent>
            </Card>

            <div className="md:col-span-2">
              <EntityNotesSection entityType="wholesaler" entityId={resolvedId} entityName={wholesalerName} />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Edit Form with tier, credit_limit, and payment_terms
const EditWholesalerForm: React.FC<{ wholesaler: any; onSubmit: (data: any) => void; isLoading: boolean; }> = ({ wholesaler, onSubmit, isLoading }) => {
  const [formData, setFormData] = useState({
    name: wholesaler.name || '',
    phone: wholesaler.phone || '',
    phone_secondary: wholesaler.phone_secondary || '',
    phone_whatsapp: wholesaler.phone_whatsapp || '',
    email: wholesaler.email || '',
    neighborhood: wholesaler.neighborhood || '',
    city: wholesaler.city || '',
    state: wholesaler.state || '',
    social_media: wholesaler.social_media || '',
    tier: wholesaler.tier || 'silver',
    credit_limit: wholesaler.credit_limit?.toString() || '0',
    payment_terms: wholesaler.payment_terms || '',
  });

  return (
    <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto pr-2">
      <div><label className="text-sm font-medium">Name</label><Input value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="text-sm font-medium">Phone</label><Input value={formData.phone} onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))} /></div>
        <div><label className="text-sm font-medium">Secondary Phone</label><Input value={formData.phone_secondary} onChange={(e) => setFormData(prev => ({ ...prev, phone_secondary: e.target.value }))} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="text-sm font-medium">WhatsApp</label><Input value={formData.phone_whatsapp} onChange={(e) => setFormData(prev => ({ ...prev, phone_whatsapp: e.target.value }))} /></div>
        <div><label className="text-sm font-medium">Email</label><Input type="email" value={formData.email} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} /></div>
      </div>
      <div><label className="text-sm font-medium">Social Media</label><Input value={formData.social_media} onChange={(e) => setFormData(prev => ({ ...prev, social_media: e.target.value }))} /></div>
      <div><label className="text-sm font-medium">Neighborhood</label><Input value={formData.neighborhood} onChange={(e) => setFormData(prev => ({ ...prev, neighborhood: e.target.value }))} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="text-sm font-medium">City</label><Input value={formData.city} onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))} /></div>
        <div><label className="text-sm font-medium">State</label><Input value={formData.state} onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))} /></div>
      </div>
      {/* Tier, Credit, Payment Terms */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium">Tier</label>
          <Select value={formData.tier} onValueChange={(v) => setFormData(prev => ({ ...prev, tier: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="silver">Silver</SelectItem>
              <SelectItem value="gold">Gold</SelectItem>
              <SelectItem value="platinum">Platinum</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Credit Limit</label>
          <Input type="number" value={formData.credit_limit} onChange={(e) => setFormData(prev => ({ ...prev, credit_limit: e.target.value }))} />
        </div>
        <div>
          <label className="text-sm font-medium">Payment Terms</label>
          <Select value={formData.payment_terms || 'none'} onValueChange={(v) => setFormData(prev => ({ ...prev, payment_terms: v === 'none' ? '' : v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not set</SelectItem>
              <SelectItem value="prepaid">Prepaid</SelectItem>
              <SelectItem value="net7">Net 7</SelectItem>
              <SelectItem value="net30">Net 30</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button className="w-full" onClick={() => {
        const payload: Record<string, any> = { ...formData, credit_limit: parseFloat(formData.credit_limit) || 0 };
        // Convert empty strings to null to avoid DB constraint issues
        Object.keys(payload).forEach(key => {
          if (payload[key] === '') payload[key] = null;
        });
        onSubmit(payload);
      }} disabled={isLoading}>
        {isLoading ? 'Saving...' : 'Save Changes'}
      </Button>
    </div>
  );
};

export default WholesalerProfile;
