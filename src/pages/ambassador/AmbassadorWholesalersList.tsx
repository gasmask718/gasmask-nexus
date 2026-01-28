/**
 * Ambassador Wholesalers List - MASTER GENIUS ARCHITECT
 * Lane-separated: Wholesalers are NEVER in store_assignments
 * Never delete, only unassign (deactivate assignment)
 */
import { useState, useMemo } from 'react';
import { 
  Building2, Search, MapPin, Phone, Mail, Calendar,
  Trash2, ExternalLink
} from 'lucide-react';
import { EnhancedPortalLayout } from '@/components/portal/EnhancedPortalLayout';
import { PortalRBACGate } from '@/components/portal/PortalRBACGate';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { DeleteConfirmModal } from '@/components/crud/DeleteConfirmModal';
import { useAmbassadorWholesalers, type PortfolioWholesaler } from '@/hooks/useAmbassadorWholesalers';
import { formatDistanceToNow } from 'date-fns';

interface WholesalerCardProps {
  wholesaler: PortfolioWholesaler;
  onRemove: () => void;
}

function WholesalerCard({ wholesaler, onRemove }: WholesalerCardProps) {
  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove();
  };

  return (
    <Card className="hover:border-primary/50 transition-colors group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                {wholesaler.name}
              </h3>
              <Badge variant={wholesaler.assignment_type === 'sourced' ? 'default' : 'secondary'} className="text-xs shrink-0">
                {wholesaler.assignment_type}
              </Badge>
              {wholesaler.is_primary && (
                <Badge variant="outline" className="text-xs shrink-0">Primary</Badge>
              )}
              {wholesaler.status && (
                <Badge 
                  variant={wholesaler.status === 'active' ? 'default' : 'secondary'} 
                  className="text-xs shrink-0"
                >
                  {wholesaler.status}
                </Badge>
              )}
            </div>
            {wholesaler.contact_name && (
              <p className="text-sm text-muted-foreground truncate mb-2">
                {wholesaler.contact_name}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {(wholesaler.city || wholesaler.state) && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {[wholesaler.city, wholesaler.state].filter(Boolean).join(', ')}
                </span>
              )}
              {wholesaler.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {wholesaler.phone}
                </span>
              )}
              {wholesaler.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {wholesaler.email}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDistanceToNow(new Date(wholesaler.assigned_at), { addSuffix: true })}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs text-muted-foreground">Commission</span>
            <span className="font-semibold text-primary">{wholesaler.commission_rate}%</span>
            <div className="flex items-center gap-2 mt-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={handleRemoveClick}
                title="Remove from My Wholesalers"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function WholesalersListContent() {
  const { wholesalers, metrics, isLoading, unassignWholesaler, isUnassigning } = useAmbassadorWholesalers();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  
  // Remove wholesaler confirmation modal state
  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [wholesalerToRemove, setWholesalerToRemove] = useState<PortfolioWholesaler | null>(null);

  const filteredWholesalers = useMemo(() => {
    let result = wholesalers;

    // Filter by tab
    if (activeTab === 'assigned') {
      result = result.filter(w => w.assignment_type === 'assigned');
    } else if (activeTab === 'sourced') {
      result = result.filter(w => w.assignment_type === 'sourced');
    } else if (activeTab === 'referred') {
      result = result.filter(w => w.assignment_type === 'referred');
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(w => 
        w.name.toLowerCase().includes(query) ||
        w.contact_name?.toLowerCase().includes(query) ||
        w.city?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [wholesalers, searchQuery, activeTab]);

  const handleRemoveClick = (wholesaler: PortfolioWholesaler) => {
    setWholesalerToRemove(wholesaler);
    setRemoveModalOpen(true);
  };

  const handleConfirmRemove = async () => {
    if (!wholesalerToRemove) return;
    await unassignWholesaler(wholesalerToRemove.wholesaler_id);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12" />
        <div className="grid gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-primary">{metrics.total}</p>
            <p className="text-sm text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold">{metrics.assigned}</p>
            <p className="text-sm text-muted-foreground">Assigned</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-green-500">{metrics.sourced}</p>
            <p className="text-sm text-muted-foreground">Sourced</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-blue-500">{metrics.referred}</p>
            <p className="text-sm text-muted-foreground">Referred</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search wholesalers by name, contact, or location..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All ({wholesalers.length})</TabsTrigger>
          <TabsTrigger value="assigned">Assigned ({metrics.assigned})</TabsTrigger>
          <TabsTrigger value="sourced">Sourced ({metrics.sourced})</TabsTrigger>
          <TabsTrigger value="referred">Referred ({metrics.referred})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {filteredWholesalers.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-lg font-medium">No wholesalers found</p>
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? 'Try a different search term' : 'No wholesalers in this category'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filteredWholesalers.map((wholesaler) => (
                <WholesalerCard 
                  key={wholesaler.assignment_id} 
                  wholesaler={wholesaler}
                  onRemove={() => handleRemoveClick(wholesaler)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Remove Wholesaler Confirmation Modal */}
      <DeleteConfirmModal
        open={removeModalOpen}
        onOpenChange={setRemoveModalOpen}
        title="Remove Wholesaler from Portfolio"
        description={`This removes "${wholesalerToRemove?.name}" from your portfolio. It does not delete the wholesaler - you can be reassigned to them later.`}
        onConfirm={handleConfirmRemove}
      />
    </div>
  );
}

export default function AmbassadorWholesalersList() {
  return (
    <PortalRBACGate allowedRoles={['ambassador']} portalName="Ambassador Portal">
      <EnhancedPortalLayout 
        title="My Wholesalers" 
        subtitle="All wholesalers in your portfolio"
        portalIcon={<Building2 className="h-4 w-4 text-primary-foreground" />}
      >
        <WholesalersListContent />
      </EnhancedPortalLayout>
    </PortalRBACGate>
  );
}
