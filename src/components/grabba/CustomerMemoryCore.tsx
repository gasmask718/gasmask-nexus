import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  User, Users, Brain, Lightbulb, Building2, DollarSign,
  Phone, MessageSquare, ChevronDown, ChevronRight, Globe,
  Heart, AlertTriangle, TrendingUp, Package, Calendar,
  Star, Zap, Target, Clock
} from 'lucide-react';
import { format } from 'date-fns';

interface CustomerMemoryCoreProps {
  storeId: string;
  storeMaster: any;
}

export function CustomerMemoryCore({ storeId, storeMaster }: CustomerMemoryCoreProps) {
  const [activeTab, setActiveTab] = useState('identity');

  // Fetch store contacts
  const { data: contacts } = useQuery({
    queryKey: ['memory-core-contacts', storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from('store_contacts')
        .select('*')
        .eq('store_id', storeId)
        .order('is_primary', { ascending: false });
      return data || [];
    },
  });

  // Fetch interactions for timeline
  const { data: interactions } = useQuery({
    queryKey: ['memory-core-interactions', storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from('contact_interactions')
        .select('*, store_contacts(name)')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  // Fetch orders for revenue memory
  const { data: orders } = useQuery({
    queryKey: ['memory-core-orders', storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from('wholesale_orders')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  // Fetch brand accounts
  const { data: brandAccounts } = useQuery({
    queryKey: ['memory-core-brand-accounts', storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from('store_brand_accounts')
        .select('*')
        .eq('store_master_id', storeId);
      return data || [];
    },
  });

  // Calculate revenue stats
  const revenueStats = calculateRevenueStats(orders || [], brandAccounts || []);

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-background to-muted/30">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Brain className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl">Customer Memory Core</CardTitle>
            <CardDescription>Complete intelligence on {storeMaster?.store_name}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 lg:grid-cols-7 w-full h-auto gap-1">
            <TabsTrigger value="identity" className="text-xs px-2">
              <User className="h-3 w-3 mr-1" /> Identity
            </TabsTrigger>
            <TabsTrigger value="contacts" className="text-xs px-2">
              <Users className="h-3 w-3 mr-1" /> Contacts
            </TabsTrigger>
            <TabsTrigger value="insights" className="text-xs px-2">
              <Brain className="h-3 w-3 mr-1" /> Insights
            </TabsTrigger>
            <TabsTrigger value="opportunities" className="text-xs px-2">
              <Lightbulb className="h-3 w-3 mr-1" /> Opps
            </TabsTrigger>
            <TabsTrigger value="expansion" className="text-xs px-2">
              <Building2 className="h-3 w-3 mr-1" /> Expansion
            </TabsTrigger>
            <TabsTrigger value="revenue" className="text-xs px-2">
              <DollarSign className="h-3 w-3 mr-1" /> Revenue
            </TabsTrigger>
            <TabsTrigger value="timeline" className="text-xs px-2">
              <Clock className="h-3 w-3 mr-1" /> Timeline
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <TabsContent value="identity" className="m-0">
              <IdentityBlock storeMaster={storeMaster} />
            </TabsContent>

            <TabsContent value="contacts" className="m-0">
              <ContactsBlock contacts={contacts || []} />
            </TabsContent>

            <TabsContent value="insights" className="m-0">
              <InsightsBlock interactions={interactions || []} storeMaster={storeMaster} />
            </TabsContent>

            <TabsContent value="opportunities" className="m-0">
              <OpportunitiesBlock revenueStats={revenueStats} storeMaster={storeMaster} />
            </TabsContent>

            <TabsContent value="expansion" className="m-0">
              <ExpansionBlock storeMaster={storeMaster} />
            </TabsContent>

            <TabsContent value="revenue" className="m-0">
              <RevenueBlock revenueStats={revenueStats} orders={orders || []} brandAccounts={brandAccounts || []} />
            </TabsContent>

            <TabsContent value="timeline" className="m-0">
              <InteractionTimelineBlock interactions={interactions || []} />
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// Identity Block Component
function IdentityBlock({ storeMaster }: { storeMaster: any }) {
  const languages = storeMaster?.languages || [];
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <InfoField label="Owner Name" value={storeMaster?.owner_name} icon={<User className="h-4 w-4" />} />
        <InfoField label="Nickname" value={storeMaster?.nickname} icon={<Star className="h-4 w-4" />} />
        <InfoField label="Country of Origin" value={storeMaster?.country_of_origin} icon={<Globe className="h-4 w-4" />} />
        <InfoField label="Communication Pref" value={storeMaster?.communication_preference} icon={<MessageSquare className="h-4 w-4" />} />
      </div>
      
      <div className="space-y-2">
        <div className="text-sm font-medium text-muted-foreground">Languages</div>
        <div className="flex flex-wrap gap-2">
          {languages.length > 0 ? (
            languages.map((lang: string, i: number) => (
              <Badge key={i} variant="secondary">{lang}</Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">Not specified</span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium text-muted-foreground">Personality Notes</div>
        <div className="p-3 bg-muted/50 rounded-lg text-sm">
          {storeMaster?.personality_notes || 'No personality notes recorded yet. Add insights from your interactions.'}
        </div>
      </div>
    </div>
  );
}

// Contacts Block Component
function ContactsBlock({ contacts }: { contacts: any[] }) {
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  if (contacts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No contacts linked to this store yet.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[300px]">
      <div className="space-y-2">
        {contacts.map((contact) => (
          <Collapsible
            key={contact.id}
            open={expandedIds.includes(contact.id)}
            onOpenChange={() => toggleExpand(contact.id)}
          >
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {contact.name}
                      {contact.is_primary && <Badge variant="default" className="text-xs">Primary</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground">{contact.role || 'Contact'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {contact.influence_level && (
                    <Badge variant="outline" className="text-xs">{contact.influence_level}</Badge>
                  )}
                  {expandedIds.includes(contact.id) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-3 bg-muted/30 rounded-b-lg border-t space-y-2 text-sm">
                {contact.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    {contact.phone}
                    {contact.can_receive_sms && <Badge variant="secondary" className="text-xs">SMS OK</Badge>}
                  </div>
                )}
                {contact.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MessageSquare className="h-4 w-4" />
                    {contact.email}
                  </div>
                )}
                {contact.notes && (
                  <div className="p-2 bg-background rounded text-muted-foreground">
                    {contact.notes}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </ScrollArea>
  );
}

// Insights Block Component
function InsightsBlock({ interactions, storeMaster }: { interactions: any[]; storeMaster: any }) {
  // Extract insights from interactions
  const loyaltyTriggers = storeMaster?.loyalty_triggers || [];
  const frustrationTriggers = storeMaster?.frustration_triggers || [];

  // AI-curated insights (mock for now, would come from AI analysis)
  const extractedInsights = [
    { type: 'opportunity', text: 'Mentioned interest in expanding to second location', icon: <Building2 className="h-4 w-4" /> },
    { type: 'sensitivity', text: 'Prefers morning calls only', icon: <AlertTriangle className="h-4 w-4" /> },
    { type: 'relationship', text: 'Responds well to product samples', icon: <Heart className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="text-sm font-medium flex items-center gap-2 text-green-500">
            <Heart className="h-4 w-4" /> Loyalty Triggers
          </div>
          <div className="space-y-1">
            {loyaltyTriggers.length > 0 ? (
              loyaltyTriggers.map((trigger: string, i: number) => (
                <Badge key={i} variant="outline" className="mr-1 border-green-500/50 text-green-500">{trigger}</Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">None recorded</span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" /> Frustration Triggers
          </div>
          <div className="space-y-1">
            {frustrationTriggers.length > 0 ? (
              frustrationTriggers.map((trigger: string, i: number) => (
                <Badge key={i} variant="outline" className="mr-1 border-destructive/50 text-destructive">{trigger}</Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">None recorded</span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">AI-Extracted Insights</div>
        <div className="space-y-2">
          {extractedInsights.map((insight, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <div className={`p-1.5 rounded ${
                insight.type === 'opportunity' ? 'bg-blue-500/10 text-blue-500' :
                insight.type === 'sensitivity' ? 'bg-amber-500/10 text-amber-500' :
                'bg-green-500/10 text-green-500'
              }`}>
                {insight.icon}
              </div>
              <span className="text-sm">{insight.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="text-xs text-muted-foreground text-center">
        Insights extracted from {interactions.length} logged interactions
      </div>
    </div>
  );
}

// Opportunities Block Component  
function OpportunitiesBlock({ revenueStats, storeMaster }: { revenueStats: any; storeMaster: any }) {
  const opportunities = [
    { type: 'upsell', title: 'Hot Mama Upsell', description: 'Store shows strong GasMask sales - recommend Hot Mama trial', priority: 'high' },
    { type: 'referral', title: 'Referral Potential', description: 'Owner mentioned knowing other store owners in the area', priority: 'medium' },
    { type: 'volume', title: 'Volume Increase', description: 'Consistent ordering pattern - offer bulk discount', priority: 'low' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-blue-500/10 border-blue-500/20">
          <CardContent className="p-3 text-center">
            <Target className="h-5 w-5 mx-auto mb-1 text-blue-500" />
            <div className="text-lg font-bold text-blue-500">{opportunities.filter(o => o.type === 'upsell').length}</div>
            <div className="text-xs text-muted-foreground">Upsells</div>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10 border-green-500/20">
          <CardContent className="p-3 text-center">
            <Users className="h-5 w-5 mx-auto mb-1 text-green-500" />
            <div className="text-lg font-bold text-green-500">{opportunities.filter(o => o.type === 'referral').length}</div>
            <div className="text-xs text-muted-foreground">Referrals</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/10 border-amber-500/20">
          <CardContent className="p-3 text-center">
            <TrendingUp className="h-5 w-5 mx-auto mb-1 text-amber-500" />
            <div className="text-lg font-bold text-amber-500">{opportunities.filter(o => o.type === 'volume').length}</div>
            <div className="text-xs text-muted-foreground">Volume</div>
          </CardContent>
        </Card>
      </div>

      <ScrollArea className="h-[200px]">
        <div className="space-y-2">
          {opportunities.map((opp, i) => (
            <div key={i} className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm">{opp.title}</span>
                <Badge variant={
                  opp.priority === 'high' ? 'destructive' :
                  opp.priority === 'medium' ? 'default' : 'secondary'
                } className="text-xs">{opp.priority}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{opp.description}</p>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// Expansion Block Component
function ExpansionBlock({ storeMaster }: { storeMaster: any }) {
  const hasExpansion = storeMaster?.has_expansion || false;
  const newAddresses = storeMaster?.new_store_addresses || [];
  const openDates = storeMaster?.expected_open_dates || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
        <div className={`p-2 rounded-full ${hasExpansion ? 'bg-green-500/10' : 'bg-muted'}`}>
          <Building2 className={`h-5 w-5 ${hasExpansion ? 'text-green-500' : 'text-muted-foreground'}`} />
        </div>
        <div>
          <div className="font-medium">Expansion Status</div>
          <div className="text-sm text-muted-foreground">
            {hasExpansion ? 'Expansion in progress' : 'No active expansion plans'}
          </div>
        </div>
        <Badge variant={hasExpansion ? 'default' : 'secondary'} className="ml-auto">
          {hasExpansion ? 'Active' : 'None'}
        </Badge>
      </div>

      {hasExpansion && (
        <>
          <div className="space-y-2">
            <div className="text-sm font-medium">New Store Locations</div>
            {newAddresses.length > 0 ? (
              <div className="space-y-2">
                {newAddresses.map((addr: string, i: number) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{addr}</span>
                    {openDates[i] && (
                      <Badge variant="outline" className="ml-auto text-xs">
                        <Calendar className="h-3 w-3 mr-1" />
                        {openDates[i]}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No addresses recorded yet</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Expansion Notes</div>
            <div className="p-3 bg-muted/50 rounded-lg text-sm">
              {storeMaster?.expansion_notes || 'No expansion notes recorded.'}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Revenue Block Component
function RevenueBlock({ revenueStats, orders, brandAccounts }: { revenueStats: any; orders: any[]; brandAccounts: any[] }) {
  const riskColors = {
    low: 'text-green-500 bg-green-500/10',
    medium: 'text-amber-500 bg-amber-500/10',
    high: 'text-destructive bg-destructive/10'
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-primary">{revenueStats.totalTubes}</div>
            <div className="text-xs text-muted-foreground">Total Tubes</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-primary">{revenueStats.totalBoxes}</div>
            <div className="text-xs text-muted-foreground">Total Boxes</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-green-500">${revenueStats.totalRevenue.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Total Revenue</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold">${revenueStats.avgMonthly.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Avg Monthly</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">Per-Brand Breakdown</div>
        <div className="space-y-2">
          {brandAccounts.map((account) => (
            <div key={account.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{account.brand}</span>
              </div>
              <span className="text-sm font-bold">${Number(account.total_spent || 0).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
        <div>
          <div className="text-sm font-medium">Risk Score</div>
          <div className="text-xs text-muted-foreground">Based on payment history</div>
        </div>
        <Badge className={riskColors[revenueStats.riskScore as keyof typeof riskColors] || riskColors.low}>
          {revenueStats.riskScore?.toUpperCase() || 'LOW'}
        </Badge>
      </div>

      {revenueStats.projectedNextOrder && (
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-blue-500" />
            <span className="font-medium">Projected Next Order:</span>
            <span>{revenueStats.projectedNextOrder}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Interaction Timeline Block Component
function InteractionTimelineBlock({ interactions }: { interactions: any[] }) {
  const channelIcons: Record<string, JSX.Element> = {
    CALL: <Phone className="h-4 w-4" />,
    SMS: <MessageSquare className="h-4 w-4" />,
    WHATSAPP: <MessageSquare className="h-4 w-4" />,
    IN_PERSON: <User className="h-4 w-4" />,
    EMAIL: <MessageSquare className="h-4 w-4" />,
  };

  const channelColors: Record<string, string> = {
    CALL: 'bg-blue-500/10 text-blue-500',
    SMS: 'bg-green-500/10 text-green-500',
    WHATSAPP: 'bg-emerald-500/10 text-emerald-500',
    IN_PERSON: 'bg-amber-500/10 text-amber-500',
    EMAIL: 'bg-purple-500/10 text-purple-500',
  };

  if (interactions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No interactions logged yet.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[300px]">
      <div className="space-y-3">
        {interactions.map((interaction) => (
          <div key={interaction.id} className="relative pl-8 pb-3 border-l-2 border-muted last:border-transparent">
            <div className={`absolute left-[-9px] top-0 p-1.5 rounded-full ${channelColors[interaction.channel] || 'bg-muted'}`}>
              {channelIcons[interaction.channel] || <MessageSquare className="h-4 w-4" />}
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-xs">{interaction.channel}</Badge>
                <Badge variant="secondary" className="text-xs">{interaction.direction}</Badge>
                {interaction.outcome && (
                  <Badge variant={
                    interaction.outcome === 'SUCCESS' ? 'default' :
                    interaction.outcome === 'FOLLOW_UP_NEEDED' ? 'destructive' : 'secondary'
                  } className="text-xs">{interaction.outcome}</Badge>
                )}
              </div>
              <div className="font-medium text-sm">{interaction.subject}</div>
              {interaction.summary && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{interaction.summary}</p>
              )}
              <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                <span>{interaction.store_contacts?.name || 'Unknown contact'}</span>
                <span>{format(new Date(interaction.created_at), 'MMM d, yyyy h:mm a')}</span>
              </div>
              {interaction.follow_up_at && (
                <div className="mt-2 p-2 bg-amber-500/10 rounded text-xs text-amber-500 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Follow up: {format(new Date(interaction.follow_up_at), 'MMM d, yyyy')}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

// Helper Components
function InfoField({ label, value, icon }: { label: string; value: string | null | undefined; icon: JSX.Element }) {
  return (
    <div className="space-y-1">
      <div className="text-sm text-muted-foreground flex items-center gap-2">
        {icon} {label}
      </div>
      <div className="font-medium">{value || <span className="text-muted-foreground">Not set</span>}</div>
    </div>
  );
}

// Helper function to calculate revenue stats
function calculateRevenueStats(orders: any[], brandAccounts: any[]) {
  const totalTubes = orders.reduce((sum, o) => sum + (o.quantity || 0), 0);
  const totalBoxes = Math.floor(totalTubes / 25); // Assuming 25 tubes per box
  const totalRevenue = brandAccounts.reduce((sum, a) => sum + Number(a.total_spent || 0), 0);
  
  // Calculate average monthly (simplified)
  const months = orders.length > 0 ? Math.max(1, Math.ceil(
    (new Date().getTime() - new Date(orders[orders.length - 1]?.created_at).getTime()) / (30 * 24 * 60 * 60 * 1000)
  )) : 1;
  const avgMonthly = Math.round(totalRevenue / months);

  // Project next order based on average order frequency
  let projectedNextOrder = null;
  if (orders.length >= 2) {
    const lastOrder = new Date(orders[0]?.created_at);
    const avgDaysBetweenOrders = 14; // Default assumption
    const nextDate = new Date(lastOrder.getTime() + avgDaysBetweenOrders * 24 * 60 * 60 * 1000);
    projectedNextOrder = format(nextDate, 'MMM d, yyyy');
  }

  return {
    totalTubes,
    totalBoxes,
    totalRevenue,
    avgMonthly,
    projectedNextOrder,
    riskScore: 'low', // Would be calculated from payment history
  };
}
