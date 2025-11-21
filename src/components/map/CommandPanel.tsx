import { Package, Users, MapPin } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface CommandPanelProps {
  storeCount: number;
  driverCount: number;
  activeRoutes: number;
}

export const CommandPanel = ({ storeCount, driverCount, activeRoutes }: CommandPanelProps) => {
  return (
    <div className="absolute top-4 right-4 z-10">
      <Card className="bg-card/95 backdrop-blur border-border/50 shadow-lg p-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Stores</p>
              <p className="text-xl font-bold">{storeCount}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <Users className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Active Team</p>
              <p className="text-xl font-bold">{driverCount}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <MapPin className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Active Routes</p>
              <p className="text-xl font-bold">{activeRoutes}</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
