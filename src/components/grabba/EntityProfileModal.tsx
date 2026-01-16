import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Phone, Mail, MapPin, DollarSign, FileText, Edit, Trash2, 
  Truck, Award, Car, User, Building2, Store, Bike, Star, Package, Calendar, Globe
} from 'lucide-react';
import { EntityNotesSection } from './EntityNotesSection';

export type EntityProfileType = 'wholesaler' | 'ambassador' | 'driver' | 'company' | 'store' | 'biker';

interface EntityProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: any;
  entityType: EntityProfileType;
  onEdit?: (entity: any) => void;
  onDelete?: (entity: any) => void;
}

export function EntityProfileModal({
  open,
  onOpenChange,
  entity,
  entityType,
  onEdit,
  onDelete,
}: EntityProfileModalProps) {
  if (!entity) return null;

  const getIcon = () => {
    switch (entityType) {
      case 'company': return <Building2 className="h-5 w-5 text-blue-500" />;
      case 'store': return <Store className="h-5 w-5 text-green-500" />;
      case 'wholesaler': return <Truck className="h-5 w-5 text-purple-500" />;
      case 'ambassador': return <Award className="h-5 w-5 text-amber-500" />;
      case 'driver': return <Car className="h-5 w-5 text-blue-500" />;
      case 'biker': return <Bike className="h-5 w-5 text-green-500" />;
    }
  };

  const getName = () => {
    switch (entityType) {
      case 'company': return entity.name || 'Company';
      case 'store': return entity.name || 'Store';
      case 'wholesaler': return entity.name || 'Wholesaler';
      case 'ambassador': return entity.profiles?.name || entity.full_name || 'Ambassador';
      case 'driver': return entity.full_name || 'Driver';
      case 'biker': return entity.full_name || 'Biker';
    }
  };

  const getStatus = () => {
    if (entityType === 'ambassador') return entity.is_active;
    if (entityType === 'company') return entity.health_score > 50;
    return entity.status === 'active';
  };

  const getStatusLabel = () => {
    if (entityType === 'company') {
      return entity.health_score > 70 ? 'Healthy' : entity.health_score > 40 ? 'Moderate' : 'At Risk';
    }
    if (entityType === 'store') {
      return entity.status || 'Unknown';
    }
    return getStatus() ? 'Active' : 'Inactive';
  };

  const renderCompanyDetails = () => (
    <>
      <div className="grid gap-3">
        {entity.default_phone && (
          <div className="flex items-center gap-3 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>{entity.default_phone}</span>
          </div>
        )}
        {entity.default_email && (
          <div className="flex items-center gap-3 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span>{entity.default_email}</span>
          </div>
        )}
        {(entity.default_city || entity.default_state || entity.neighborhood) && (
          <div className="flex items-center gap-3 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>{[entity.neighborhood, entity.default_city, entity.default_state].filter(Boolean).join(', ')}</span>
          </div>
        )}
      </div>
      <div className="border-t pt-3 mt-3">
        <p className="text-xs text-muted-foreground mb-2">Business Metrics</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span>${(entity.total_revenue || 0).toLocaleString()} revenue</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span>{entity.total_orders || 0} orders</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Star className="h-4 w-4 text-muted-foreground" />
            <span>Health: {entity.health_score || 0}/100</span>
          </div>
          {entity.payment_reliability_tier && (
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>{entity.payment_reliability_tier}</span>
            </div>
          )}
        </div>
      </div>
      {entity.type && (
        <div className="border-t pt-3 mt-3">
          <p className="text-xs text-muted-foreground mb-2">Type</p>
          <Badge variant="outline">{entity.type}</Badge>
        </div>
      )}
    </>
  );

  const renderStoreDetails = () => (
    <>
      <div className="grid gap-3">
        {entity.phone && (
          <div className="flex items-center gap-3 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>{entity.phone}</span>
          </div>
        )}
        {entity.alt_phone && (
          <div className="flex items-center gap-3 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>{entity.alt_phone} (Alt)</span>
          </div>
        )}
        {entity.email && (
          <div className="flex items-center gap-3 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span>{entity.email}</span>
          </div>
        )}
        {(entity.address_street || entity.address_city) && (
          <div className="flex items-center gap-3 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>{[entity.address_street, entity.address_city, entity.address_state, entity.address_zip].filter(Boolean).join(', ')}</span>
          </div>
        )}
        {entity.neighborhood && (
          <div className="flex items-center gap-3 text-sm">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span>Neighborhood: {entity.neighborhood}</span>
          </div>
        )}
      </div>
      <div className="border-t pt-3 mt-3">
        <p className="text-xs text-muted-foreground mb-2">Store Details</p>
        <div className="grid grid-cols-2 gap-3">
          {entity.type && (
            <div className="flex items-center gap-2 text-sm">
              <Store className="h-4 w-4 text-muted-foreground" />
              <span className="capitalize">{entity.type.replace('_', ' ')}</span>
            </div>
          )}
          {entity.primary_contact_name && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{entity.primary_contact_name}</span>
            </div>
          )}
          {entity.health_score !== undefined && (
            <div className="flex items-center gap-2 text-sm">
              <Star className="h-4 w-4 text-muted-foreground" />
              <span>Health: {entity.health_score || 0}/100</span>
            </div>
          )}
          {entity.open_date && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Open: {new Date(entity.open_date).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </div>
      {entity.companies?.name && (
        <div className="border-t pt-3 mt-3">
          <p className="text-xs text-muted-foreground mb-2">Parent Company</p>
          <Badge variant="outline" className="bg-blue-500/10">
            <Building2 className="h-3 w-3 mr-1" />
            {entity.companies.name}
          </Badge>
        </div>
      )}
    </>
  );

  const renderBikerDetails = () => (
    <>
      <div className="grid gap-3">
        {entity.phone && (
          <div className="flex items-center gap-3 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>{String(entity.phone)}</span>
          </div>
        )}
        {entity.email && (
          <div className="flex items-center gap-3 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span>{entity.email}</span>
          </div>
        )}
        {entity.territory && (
          <div className="flex items-center gap-3 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>Territory: {entity.territory}</span>
          </div>
        )}
      </div>
      {(entity.payout_method || entity.payout_handle) && (
        <div className="border-t pt-3 mt-3">
          <p className="text-xs text-muted-foreground mb-2">Payout Info</p>
          <div className="grid gap-2">
            {entity.payout_method && (
              <div className="flex items-center gap-3 text-sm">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="capitalize">{entity.payout_method}</span>
                {entity.payout_handle && (
                  <span className="text-muted-foreground">({entity.payout_handle})</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );

  const renderWholesalerDetails = () => (
    <>
      <div className="grid gap-3">
        {(entity.phone || entity.phone_primary) && (
          <div className="flex items-center gap-3 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>{String(entity.phone || entity.phone_primary)}</span>
          </div>
        )}
        {entity.email && (
          <div className="flex items-center gap-3 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span>{entity.email}</span>
          </div>
        )}
        {(entity.neighborhood || entity.state || entity.city) && (
          <div className="flex items-center gap-3 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>{[entity.neighborhood, entity.city, entity.state].filter(Boolean).join(', ')}</span>
          </div>
        )}
      </div>
      {entity.tags && (
        <div className="border-t pt-3 mt-3">
          <p className="text-xs text-muted-foreground mb-2">Tags</p>
          <span className="text-sm">{entity.tags}</span>
        </div>
      )}
    </>
  );

  const renderAmbassadorDetails = () => (
    <>
      <div className="grid gap-3">
        {entity.phone_primary && (
          <div className="flex items-center gap-3 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>{String(entity.phone_primary)}</span>
          </div>
        )}
        {entity.state && (
          <div className="flex items-center gap-3 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>{entity.state}</span>
          </div>
        )}
      </div>
      <div className="border-t pt-3 mt-3">
        <p className="text-xs text-muted-foreground mb-2">Tracking & Earnings</p>
        <div className="grid gap-2">
          {entity.tracking_code && (
            <div className="flex items-center gap-3 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>Code: {entity.tracking_code}</span>
            </div>
          )}
          <div className="flex items-center gap-3 text-sm">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span>${(entity.total_earnings || 0).toLocaleString()} earned</span>
          </div>
        </div>
      </div>
      {entity.tags && (
        <div className="border-t pt-3 mt-3">
          <p className="text-xs text-muted-foreground mb-2">Tags</p>
          <span className="text-sm">{entity.tags}</span>
        </div>
      )}
    </>
  );

  const renderDriverDetails = () => (
    <>
      <div className="grid gap-3">
        {entity.phone && (
          <div className="flex items-center gap-3 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span>{String(entity.phone)}</span>
          </div>
        )}
        {entity.email && (
          <div className="flex items-center gap-3 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span>{entity.email}</span>
          </div>
        )}
        {entity.home_base && (
          <div className="flex items-center gap-3 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>{entity.home_base}</span>
          </div>
        )}
      </div>
      {(entity.license_number || entity.payout_method || entity.vehicle_type) && (
        <div className="border-t pt-3 mt-3">
          <p className="text-xs text-muted-foreground mb-2">Additional Info</p>
          <div className="grid gap-2">
            {entity.vehicle_type && (
              <div className="flex items-center gap-3 text-sm">
                <Car className="h-4 w-4 text-muted-foreground" />
                <span>{entity.vehicle_type}</span>
              </div>
            )}
            {entity.license_number && (
              <div className="flex items-center gap-3 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span>License: {entity.license_number}</span>
              </div>
            )}
            {entity.payout_method && (
              <div className="flex items-center gap-3 text-sm">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="capitalize">{entity.payout_method}</span>
                {entity.payout_handle && (
                  <span className="text-muted-foreground">({entity.payout_handle})</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );

  const renderEntityDetails = () => {
    switch (entityType) {
      case 'company': return renderCompanyDetails();
      case 'store': return renderStoreDetails();
      case 'wholesaler': return renderWholesalerDetails();
      case 'ambassador': return renderAmbassadorDetails();
      case 'driver': return renderDriverDetails();
      case 'biker': return renderBikerDetails();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getIcon()}
            {getName()}
          </DialogTitle>
          <DialogDescription>
            Full profile and information
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid grid-cols-2 w-full max-w-[300px]">
            <TabsTrigger value="info" className="flex items-center gap-1">
              <User className="h-4 w-4" />
              Info
            </TabsTrigger>
            <TabsTrigger value="notes" className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              Notes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="mt-4 space-y-4">
            {/* Status Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={getStatus()
                ? "bg-green-500/20 text-green-400 border-green-500/30" 
                : "bg-muted text-muted-foreground"}>
                {getStatusLabel()}
              </Badge>
              
              {entityType === 'ambassador' && entity.tier && (
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                  {entity.tier}
                </Badge>
              )}
              
              {entityType === 'driver' && entity.vehicle_type && (
                <Badge variant="outline">{entity.vehicle_type}</Badge>
              )}
              
              {entityType === 'wholesaler' && (
                <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">
                  Wholesaler
                </Badge>
              )}

              {entityType === 'company' && entity.type && (
                <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                  {entity.type}
                </Badge>
              )}

              {entityType === 'store' && entity.sticker_status && (
                <Badge variant="outline">{entity.sticker_status}</Badge>
              )}

              {entityType === 'biker' && (
                <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
                  Biker
                </Badge>
              )}
            </div>

            {/* Entity-specific details */}
            {renderEntityDetails()}

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t">
              {onEdit && (
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    onOpenChange(false);
                    onEdit(entity);
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
              {onDelete && (
                <Button 
                  variant="destructive" 
                  className="flex-1"
                  onClick={() => {
                    onOpenChange(false);
                    onDelete(entity);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="notes" className="mt-4">
            <EntityNotesSection
              entityType={entityType}
              entityId={entity.id}
              entityName={getName()}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
