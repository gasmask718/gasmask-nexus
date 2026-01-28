/**
 * Ambassador Portfolio Section - MASTER GENIUS ARCHITECT
 * Unified portfolio view for all managed entity types
 * Shows: My Stores, My Wholesalers, My Ambassadors, My Influencers
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Store, Users, ShoppingCart, Megaphone, 
  ArrowRight, Trash2, Phone, MapPin, Mail,
  Instagram, AtSign, Crown
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DeleteConfirmModal } from '@/components/crud/DeleteConfirmModal';
import { useAmbassadorPortfolio, type PortfolioStore } from '@/hooks/useAmbassadorPortfolio';
import { useAmbassadorWholesalers, type PortfolioWholesaler } from '@/hooks/useAmbassadorWholesalers';
import { useAmbassadorInfluencers, type PortfolioInfluencer } from '@/hooks/useAmbassadorInfluencers';
import { useAmbassadorRecruits, type RecruitedAmbassador } from '@/hooks/useAmbassadorRecruits';
import { formatDistanceToNow } from 'date-fns';

// ============ STORE CARD ============
function StoreCard({ store, onRemove }: { store: PortfolioStore; onRemove: () => void }) {
  const navigate = useNavigate();
  
  return (
    <div 
      className="p-3 rounded-lg border bg-card hover:border-primary/50 transition-colors cursor-pointer group"
      onClick={() => navigate(`/ambassador/stores/${store.store_id}`)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium truncate text-sm">{store.store_name}</h4>
            <Badge variant={store.assignment_type === 'sourced' ? 'default' : 'secondary'} className="text-xs shrink-0">
              {store.assignment_type}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {store.store_city}, {store.store_state}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ============ WHOLESALER CARD ============
function WholesalerCard({ wholesaler, onRemove }: { wholesaler: PortfolioWholesaler; onRemove: () => void }) {
  const navigate = useNavigate();
  
  return (
    <div 
      className="p-3 rounded-lg border bg-card hover:border-primary/50 transition-colors cursor-pointer group"
      onClick={() => navigate(`/ambassador/wholesalers/${wholesaler.wholesaler_id}`)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium truncate text-sm">{wholesaler.name}</h4>
            <Badge variant={wholesaler.assignment_type === 'sourced' ? 'default' : 'secondary'} className="text-xs shrink-0">
              {wholesaler.assignment_type}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {wholesaler.contact_name || wholesaler.city || 'No contact info'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ============ INFLUENCER CARD ============
function InfluencerCard({ influencer, onRemove }: { influencer: PortfolioInfluencer; onRemove: () => void }) {
  const navigate = useNavigate();
  
  return (
    <div 
      className="p-3 rounded-lg border bg-card hover:border-primary/50 transition-colors cursor-pointer group"
      onClick={() => navigate(`/ambassador/influencers/${influencer.influencer_id}`)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium truncate text-sm">{influencer.name}</h4>
            {influencer.platform && (
              <Badge variant="outline" className="text-xs shrink-0">
                {influencer.platform}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            {influencer.username && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <AtSign className="h-3 w-3" />
                {influencer.username}
              </span>
            )}
            {influencer.followers && (
              <span className="text-xs text-muted-foreground">
                {influencer.followers.toLocaleString()} followers
              </span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ============ AMBASSADOR RECRUIT CARD ============
function RecruitCard({ recruit, onRemove }: { recruit: RecruitedAmbassador; onRemove: () => void }) {
  const navigate = useNavigate();
  
  return (
    <div 
      className="p-3 rounded-lg border bg-card hover:border-primary/50 transition-colors cursor-pointer group"
      onClick={() => navigate(`/ambassador/ambassadors/${recruit.id}`)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium truncate text-sm">{recruit.name || 'Unnamed'}</h4>
            <Badge variant={recruit.is_active ? 'default' : 'secondary'} className="text-xs shrink-0">
              {recruit.is_active ? 'Active' : 'Inactive'}
            </Badge>
            {recruit.tier && (
              <Badge variant="outline" className="text-xs shrink-0">
                {recruit.tier}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {recruit.city || ''}{recruit.city && recruit.state ? ', ' : ''}{recruit.state || 'Location N/A'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ============ MAIN PORTFOLIO SECTION ============
export function PortfolioSection() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('stores');
  
  // Load all portfolio data
  const { stores, unassignStore, isLoading: storesLoading } = useAmbassadorPortfolio();
  const { wholesalers, unassignWholesaler, isLoading: wholesalersLoading } = useAmbassadorWholesalers();
  const { influencers, unassignInfluencer, isLoading: influencersLoading } = useAmbassadorInfluencers();
  const { recruits, removeRecruit, isLoading: recruitsLoading } = useAmbassadorRecruits();
  
  // Remove modal state
  const [removeModal, setRemoveModal] = useState<{
    open: boolean;
    type: 'store' | 'wholesaler' | 'influencer' | 'recruit';
    id: string;
    name: string;
  }>({ open: false, type: 'store', id: '', name: '' });

  const handleRemoveConfirm = async () => {
    switch (removeModal.type) {
      case 'store':
        await unassignStore(removeModal.id);
        break;
      case 'wholesaler':
        await unassignWholesaler(removeModal.id);
        break;
      case 'influencer':
        await unassignInfluencer(removeModal.id);
        break;
      case 'recruit':
        await removeRecruit(removeModal.id);
        break;
    }
  };

  const isLoading = storesLoading || wholesalersLoading || influencersLoading || recruitsLoading;

  // Tab configs with counts
  const tabs = [
    { id: 'stores', label: 'My Stores', icon: Store, count: stores.length, color: 'text-rose-400' },
    { id: 'wholesalers', label: 'My Wholesalers', icon: ShoppingCart, count: wholesalers.length, color: 'text-amber-400' },
    { id: 'influencers', label: 'My Influencers', icon: Megaphone, count: influencers.length, color: 'text-purple-400' },
    { id: 'recruits', label: 'My Ambassadors', icon: Users, count: recruits.length, color: 'text-cyan-400' },
  ];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              My Portfolio
            </CardTitle>
            <CardDescription>
              Manage all your confirmed contacts
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 mb-4">
            {tabs.map(tab => (
              <TabsTrigger key={tab.id} value={tab.id} className="text-xs">
                <tab.icon className={`h-4 w-4 mr-1.5 ${tab.color}`} />
                <span className="hidden sm:inline">{tab.label.replace('My ', '')}</span>
                <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 text-xs">
                  {tab.count}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Stores */}
          <TabsContent value="stores">
            <ScrollArea className="h-[280px] pr-2">
              {stores.length === 0 ? (
                <EmptyState icon={Store} message="No stores in portfolio" cta="Add stores via leads" />
              ) : (
                <div className="space-y-2">
                  {stores.map(store => (
                    <StoreCard 
                      key={store.assignment_id} 
                      store={store}
                      onRemove={() => setRemoveModal({
                        open: true,
                        type: 'store',
                        id: store.store_id,
                        name: store.store_name
                      })}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
            <div className="mt-3 pt-3 border-t">
              <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('/ambassador/stores')}>
                View All Stores
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </TabsContent>

          {/* Wholesalers */}
          <TabsContent value="wholesalers">
            <ScrollArea className="h-[280px] pr-2">
              {wholesalers.length === 0 ? (
                <EmptyState icon={ShoppingCart} message="No wholesalers in portfolio" cta="Convert leads to add wholesalers" />
              ) : (
                <div className="space-y-2">
                  {wholesalers.map(ws => (
                    <WholesalerCard 
                      key={ws.assignment_id} 
                      wholesaler={ws}
                      onRemove={() => setRemoveModal({
                        open: true,
                        type: 'wholesaler',
                        id: ws.wholesaler_id,
                        name: ws.name
                      })}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
            <div className="mt-3 pt-3 border-t">
              <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('/ambassador/wholesalers')}>
                View All Wholesalers
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </TabsContent>

          {/* Influencers */}
          <TabsContent value="influencers">
            <ScrollArea className="h-[280px] pr-2">
              {influencers.length === 0 ? (
                <EmptyState icon={Megaphone} message="No influencers in portfolio" cta="Convert leads to add influencers" />
              ) : (
                <div className="space-y-2">
                  {influencers.map(inf => (
                    <InfluencerCard 
                      key={inf.assignment_id} 
                      influencer={inf}
                      onRemove={() => setRemoveModal({
                        open: true,
                        type: 'influencer',
                        id: inf.influencer_id,
                        name: inf.name
                      })}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Ambassador Recruits */}
          <TabsContent value="recruits">
            <ScrollArea className="h-[280px] pr-2">
              {recruits.length === 0 ? (
                <EmptyState icon={Users} message="No ambassador recruits" cta="Convert leads to add recruits" />
              ) : (
                <div className="space-y-2">
                  {recruits.map(rec => (
                    <RecruitCard 
                      key={rec.id} 
                      recruit={rec}
                      onRemove={() => setRemoveModal({
                        open: true,
                        type: 'recruit',
                        id: rec.id,
                        name: rec.name || 'this ambassador'
                      })}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Remove Confirmation Modal */}
        <DeleteConfirmModal
          open={removeModal.open}
          onOpenChange={(open) => setRemoveModal(prev => ({ ...prev, open }))}
          title="Remove from Portfolio"
          description={`This removes "${removeModal.name}" from your portfolio. The entity is NOT deleted - you can be reassigned later.`}
          onConfirm={handleRemoveConfirm}
        />
      </CardContent>
    </Card>
  );
}

// Empty state component
function EmptyState({ icon: Icon, message, cta }: { icon: any; message: string; cta: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-8 text-center">
      <Icon className="h-10 w-10 text-muted-foreground/40 mb-3" />
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
      <p className="text-xs text-muted-foreground/70 mt-1">{cta}</p>
    </div>
  );
}
