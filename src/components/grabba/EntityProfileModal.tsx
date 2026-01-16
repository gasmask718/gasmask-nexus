import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Phone, Mail, MapPin, DollarSign, FileText, Edit, Trash2, 
  Truck, Award, Car, User
} from 'lucide-react';
import { EntityNotesSection } from './EntityNotesSection';

interface EntityProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: any;
  entityType: 'wholesaler' | 'ambassador' | 'driver';
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
      case 'wholesaler': return <Truck className="h-5 w-5 text-purple-500" />;
      case 'ambassador': return <Award className="h-5 w-5 text-amber-500" />;
      case 'driver': return <Car className="h-5 w-5 text-blue-500" />;
    }
  };

  const getName = () => {
    switch (entityType) {
      case 'wholesaler': return entity.name || 'Wholesaler';
      case 'ambassador': return entity.profiles?.name || entity.full_name || 'Ambassador';
      case 'driver': return entity.full_name || 'Driver';
    }
  };

  const getStatus = () => {
    if (entityType === 'ambassador') return entity.is_active;
    return entity.status === 'active';
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
                {getStatus() ? 'Active' : 'Inactive'}
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
            </div>

            {/* Contact Info */}
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
              {(entity.home_base || entity.neighborhood || entity.state) && (
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{entity.home_base || entity.neighborhood || entity.state}</span>
                </div>
              )}
            </div>

            {/* Ambassador-specific info */}
            {entityType === 'ambassador' && (
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
            )}

            {/* Driver-specific info */}
            {entityType === 'driver' && (entity.license_number || entity.payout_method) && (
              <div className="border-t pt-3 mt-3">
                <p className="text-xs text-muted-foreground mb-2">Additional Info</p>
                <div className="grid gap-2">
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

            {/* Tags */}
            {entity.tags && (
              <div className="border-t pt-3 mt-3">
                <p className="text-xs text-muted-foreground mb-2">Tags</p>
                <span className="text-sm">{entity.tags}</span>
              </div>
            )}

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
