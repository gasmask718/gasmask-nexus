import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Phone, Mail, MapPin, DollarSign, Package, 
  ChevronRight, MessageSquare, ArrowLeft, Store, Truck, AlertCircle, Loader2
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GRABBA_BRAND_CONFIG } from '@/config/grabbaBrands';
import { useGrabbaBrand } from '@/contexts/GrabbaBrandContext';
import { StoreContactsSection } from '@/components/store/StoreContactsSection';
import { LogInteractionModal } from '@/components/crm/LogInteractionModal';
import { CustomerMemoryCoreV2 } from '@/components/grabba/CustomerMemoryCoreV2';
import { StoreAIFuturePanel } from '@/components/grabba/StoreAIFuturePanel';
import { StorePersonalMemoryPanel } from '@/components/grabba/StorePersonalMemoryPanel';
import { PersonalIntelligencePanel } from '@/components/grabba/PersonalIntelligencePanel';
import { VoiceNotesCard } from '@/components/grabba/VoiceNotesCard';
import { useStoreMasterAutoCreate } from '@/hooks/useStoreMasterAutoCreate';
import { getExtractedProfile } from '@/services/profileExtractionService';
import { getStoreRelationshipScore, RelationshipScore } from '@/services/crmInsightsService';
// ═══════════════════════════════════════════════════════════════════════════════
// STORE MASTER PROFILE — Unified store view within Floor 1 CRM
// ═══════════════════════════════════════════════════════════════════════════════

export default function StoreMasterProfile() {
  const params = useParams();
  const id = params.id || params.storeId;
  const navigate = useNavigate();
  const { selectedBrand } = useGrabbaBrand();
  const [showLogModal, setShowLogModal] = useState(false);

  // Fetch store contacts for the modal
  const { data: storeContacts } = useQuery({
    queryKey: ['store-contacts-for-modal', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('store_contacts')
        .select('id, name')
        .eq('store_id', id);
      return data || [];
    },
    enabled: !!id,
  });

  // Self-healing: auto-create store_master if missing
  const { 
    storeMaster, 
    isLoading, 
    isCreating, 
    legacyStore,
    debug 
  } = useStoreMasterAutoCreate(id);
  
  // Log debug info for troubleshooting
  console.log('[StoreMasterProfile] Debug:', { id, ...debug });

  const { data: brandAccounts } = useQuery({
    queryKey: ['brand-accounts', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_brand_accounts')
        .select('*')
        .eq('store_master_id', id);
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch payments for this store
  const { data: payments } = useQuery({
    queryKey: ['store-payments', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('store_payments')
        .select('*')
        .eq('store_id', id)
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    }
  });

  // Contacts for this store (multiple family members / managers / workers)
  const { data: contacts = [] } = useQuery({
    queryKey: ['store-contacts', id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('store_contacts')
        .select('*')
        .eq('store_id', id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading store contacts', error);
        return [];
      }
      return data || [];
    },
    enabled: !!id,
  });

  // Interactions for this store (visits, new store talks, wholesale talks, etc.)
  const { data: interactions = [] } = useQuery({
    queryKey: ['store-interactions', id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('contact_interactions')
        .select('*')
        .eq('store_id', id)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        console.error('Error loading store interactions', error);
        return [];
      }
      return data || [];
    },
    enabled: !!id,
  });

  // Visit logs for this store (filtered from interactions where type = visit)
  const { data: visits = [] } = useQuery({
    queryKey: ['store-visits', id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from('contact_interactions')
        .select('*')
        .eq('store_id', id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error loading store visits', error);
        return [];
      }
      // Filter visits client-side to avoid deep type instantiation
      return (data || []).filter((d: any) => 
        d.interaction_type === 'visit' || d.type === 'visit'
      ).slice(0, 50);
    },
    enabled: !!id,
  });

  // AI Extracted Profile for Personal Intelligence Panel
  const { data: aiProfile } = useQuery({
    queryKey: ['extracted-profile', id],
    queryFn: () => getExtractedProfile(id || ''),
    enabled: !!id,
  });

  // V9: Relationship Score
  const { data: relationshipScore } = useQuery({
    queryKey: ['relationship-score', id],
    queryFn: () => getStoreRelationshipScore(id || ''),
    enabled: !!id,
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // LOADING STATE: Show "Rebuilding profile..." instead of 404
  // ═══════════════════════════════════════════════════════════════════════════════
  if (isLoading || isCreating) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="text-center">
          <p className="text-lg font-medium text-foreground">
            {isCreating ? 'Creating Store Master record...' : 'Loading store profile...'}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            {isCreating 
              ? 'Setting up your store profile with default values...' 
              : 'Retrieving store data from the system...'}
          </p>
        </div>
        {/* Debug info in development */}
        <div className="text-xs text-muted-foreground/50 mt-4">
          ID: {id} | Status: {isCreating ? 'Creating' : 'Loading'}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // REBUILDING STATE: If storeMaster is still null, show rebuilding UI (never 404)
  // ═══════════════════════════════════════════════════════════════════════════════
  if (!storeMaster) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="text-center">
          <p className="text-lg font-medium text-foreground">Rebuilding profile...</p>
          <p className="text-sm text-muted-foreground mt-2">
            This store profile is being created. Please wait...
          </p>
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" onClick={() => navigate('/grabba/crm')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to CRM
          </Button>
          <Button onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
        {/* Debug info */}
        <div className="text-xs text-muted-foreground/50 mt-4 p-4 bg-muted/30 rounded-lg">
          <p>Debug Info:</p>
          <pre className="text-left mt-2">
            {JSON.stringify(debug, null, 2)}
          </pre>
        </div>
      </div>
    );
  }

  const totalSpent = brandAccounts?.reduce((sum, acc) => sum + Number(acc.total_spent || 0), 0) || 0;
  const activeBrands = brandAccounts?.filter(a => a.active_status).map(a => a.brand as string) || [];
  const unpaidBalance = payments?.filter((p: any) => p.payment_status !== 'paid')
    .reduce((sum: number, p: any) => sum + ((p.owed_amount || 0) - (p.paid_amount || 0)), 0) || 0;

  return (
    <div className="space-y-6">
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* TOP HEADER — Store Name ALWAYS at top, from store_master.name              */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/grabba/crm')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <Store className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">{storeMaster.store_name}</h1>
            {activeBrands.length > 0 && (
              <div className="flex gap-1">
                {activeBrands.map(brand => {
                  const config = GRABBA_BRAND_CONFIG[brand.toLowerCase().replace(' ', '_') as keyof typeof GRABBA_BRAND_CONFIG];
                  return config ? (
                    <Badge key={brand} className={config.pill}>{config.icon}</Badge>
                  ) : null;
                })}
              </div>
            )}
            {relationshipScore && (
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${relationshipScore.color}`}>
                {relationshipScore.tier} ({relationshipScore.score})
              </span>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            Floor 1 CRM — Store Master Profile
            {(storeMaster as any).owner_name && (
              <span className="ml-2">• Owner: {(storeMaster as any).owner_name}</span>
            )}
          </p>
        </div>
      </div>

      {/* Three Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Panel - Store Identity & KPIs */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Store Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="text-muted-foreground text-xs mb-1">Address</div>
                <div className="font-medium">
                  {storeMaster.address}<br />
                  {storeMaster.city}, {storeMaster.state} {storeMaster.zip}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{storeMaster.phone || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="truncate">{storeMaster.email || 'N/A'}</span>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-500">${totalSpent.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Total Spent</div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{brandAccounts?.length || 0}</div>
              <div className="text-xs text-muted-foreground">Brand Accounts</div>
            </CardContent>
          </Card>
          <Card className={`border-l-4 ${unpaidBalance > 0 ? 'border-l-red-500' : 'border-l-green-500'}`}>
            <CardContent className="pt-4">
              <div className={`text-2xl font-bold ${unpaidBalance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                ${unpaidBalance.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">Unpaid Balance</div>
            </CardContent>
          </Card>

          {/* Store Contacts */}
          <StoreContactsSection storeId={id || ''} storeName={storeMaster.store_name} />
        </div>

        {/* Center Panel - V3 AI Future + V4 Memory + V2 Core */}
        <div className="lg:col-span-6 space-y-6">
          {/* V3 - AI Future View Panel */}
          <StoreAIFuturePanel storeId={id || ''} />
          
          {/* Customer Memory Core V2 */}
          <CustomerMemoryCoreV2
            store={storeMaster}
            contacts={contacts}
            interactions={interactions}
            visits={visits}
          />

          {/* V7: Voice Notes Card */}
          <VoiceNotesCard storeId={id || ''} />

          {/* ===== PERSONAL INTELLIGENCE PANEL — DIRECTLY UNDER MEMORY CORE ===== */}
          <PersonalIntelligencePanel profile={aiProfile} storeId={id || ''} />

          {/* ===== PERSONAL MEMORY & BACKGROUND (ALWAYS VISIBLE - CENTER COLUMN) ===== */}
          <div id="store-memory-panel">
            <StorePersonalMemoryPanel storeId={id || ''} />
          </div>
        </div>

        {/* Right Panel - Actions, Orders, Payments */}
        <div className="lg:col-span-3 space-y-4">
          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full justify-start" size="sm" onClick={() => setShowLogModal(true)}>
                <MessageSquare className="w-4 h-4 mr-2" />
                Log Interaction
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm" onClick={() => navigate(`/grabba/communication?store=${id}`)}>
                <MessageSquare className="w-4 h-4 mr-2" />
                Send Message
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm" onClick={() => navigate(`/grabba/deliveries?store=${id}`)}>
                <Truck className="w-4 h-4 mr-2" />
                Schedule Delivery
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm" onClick={() => navigate(`/grabba/inventory?store=${id}`)}>
                <Package className="w-4 h-4 mr-2" />
                View Inventory
              </Button>
            </CardContent>
          </Card>

          {/* Brand Accounts Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Brand Accounts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {brandAccounts && brandAccounts.length > 0 ? (
                brandAccounts.map((account) => {
                  const brandKey = account.brand?.toLowerCase().replace(' ', '_') as keyof typeof GRABBA_BRAND_CONFIG;
                  const config = GRABBA_BRAND_CONFIG[brandKey];
                  return (
                    <div key={account.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <div className="flex items-center gap-2">
                        <Badge className={config?.pill || ''} variant="outline">{config?.icon} {account.brand}</Badge>
                      </div>
                      <span className="text-sm font-medium">${Number(account.total_spent || 0).toLocaleString()}</span>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No brand accounts</p>
              )}
            </CardContent>
          </Card>

          {/* Recent Payments */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Recent Transactions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {payments && payments.length > 0 ? (
                <div className="space-y-2">
                  {payments.slice(0, 3).map((payment: any) => (
                    <div key={payment.id} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                      <span>${Number(payment.paid_amount || 0).toLocaleString()}</span>
                      <Badge variant={payment.payment_status === 'paid' ? 'default' : 'secondary'} className="text-xs">
                        {payment.payment_status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No payments recorded</p>
              )}
              
              {/* View Store Master Memory Button - Always visible */}
              <Button 
                variant="outline" 
                className="w-full mt-2 border-primary/30 hover:bg-primary/10"
                onClick={() => {
                  const memoryPanel = document.getElementById('store-memory-panel');
                  memoryPanel?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                View Store Master Memory
              </Button>
            </CardContent>
          </Card>

        </div>
      </div>

      {/* Log Interaction Modal */}
      <LogInteractionModal
        isOpen={showLogModal}
        onClose={() => setShowLogModal(false)}
        storeMasterId={id}
        storeName={storeMaster.store_name}
        storeContacts={storeContacts || []}
      />
    </div>
  );
}
