import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Store as StoreIcon, MapPin, Phone, ExternalLink, ClipboardList, X } from 'lucide-react';
import { useState } from 'react';
import VisitLogModal from '@/components/VisitLogModal';

interface Store {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: string;
  type: string;
  phone: string | null;
  address_street: string | null;
  address_city: string | null;
}

interface StoreCardProps {
  store: Store;
  onClose: () => void;
}

export const StoreCard = ({ store, onClose }: StoreCardProps) => {
  const navigate = useNavigate();
  const [visitModalOpen, setVisitModalOpen] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'prospect': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'needsFollowUp': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'inactive': return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const openInMaps = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}`;
    window.open(url, '_blank');
  };

  return (
    <>
      <Card className="glass-card border-border/50 shadow-2xl animate-scale-in">
        <div className="p-4 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <div className="p-2 rounded-lg bg-primary/10">
                <StoreIcon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{store.name}</h3>
                <p className="text-sm text-muted-foreground capitalize">
                  {store.type.replace('_', ' ')}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Badge className={getStatusColor(store.status)}>
                {store.status.replace(/([A-Z])/g, ' $1').trim()}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {store.address_street && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p>{store.address_street}</p>
                  <p className="text-muted-foreground">{store.address_city}</p>
                </div>
              </div>
            )}
            {store.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${store.phone}`} className="hover:underline">
                  {store.phone}
                </a>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/stores/${store.id}`)}
              className="w-full"
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              View Details
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={openInMaps}
              className="w-full"
            >
              <MapPin className="h-3.5 w-3.5 mr-1.5" />
              Navigate
            </Button>
            <Button
              size="sm"
              className="w-full col-span-2 bg-primary hover:bg-primary/90"
              onClick={() => setVisitModalOpen(true)}
            >
              <ClipboardList className="h-3.5 w-3.5 mr-1.5" />
              Log Visit
            </Button>
          </div>
        </div>
      </Card>

      <VisitLogModal
        open={visitModalOpen}
        onOpenChange={setVisitModalOpen}
        storeId={store.id}
        storeName={store.name}
        onSuccess={() => {
          setVisitModalOpen(false);
        }}
      />
    </>
  );
};
