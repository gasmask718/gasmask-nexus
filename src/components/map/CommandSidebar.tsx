import { useState } from 'react';
import { Package, Users, Route, AlertTriangle, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertsPanel, Alert } from './AlertsPanel';
import { DemoRoute } from './demoRoutes';

interface Store {
  id: string;
  name: string;
  address_city: string | null;
  address_street: string | null;
  status: string;
  type: string;
}

interface DemoDriver {
  id: string;
  name: string;
  role: 'driver' | 'biker';
  lat: number;
  lng: number;
  territory: string;
  updated_at: Date;
}

interface CommandSidebarProps {
  stores: Store[];
  drivers: DemoDriver[];
  routes: DemoRoute[];
  alerts: Alert[];
  onStoreClick: (store: Store) => void;
  onDriverClick: (driver: DemoDriver) => void;
  onRouteClick: (route: DemoRoute) => void;
  onAlertClick: (alert: Alert) => void;
  onClose: () => void;
}

export const CommandSidebar = ({
  stores,
  drivers,
  routes,
  alerts,
  onStoreClick,
  onDriverClick,
  onRouteClick,
  onAlertClick,
  onClose
}: CommandSidebarProps) => {
  const [activeTab, setActiveTab] = useState('stores');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'prospect': return 'bg-yellow-500';
      case 'needsFollowUp': return 'bg-orange-500';
      case 'inactive': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getRouteStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in-progress': return 'bg-blue-500';
      case 'planned': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Card className="h-full bg-card/95 backdrop-blur border-border/50 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-border/50 flex items-center justify-between">
        <h2 className="text-xl font-bold">Command Center</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full grid grid-cols-4 p-2 mx-2 mt-2">
          <TabsTrigger value="stores" className="text-xs">
            <Package className="h-4 w-4 mr-1" />
            Stores
          </TabsTrigger>
          <TabsTrigger value="drivers" className="text-xs">
            <Users className="h-4 w-4 mr-1" />
            Team
          </TabsTrigger>
          <TabsTrigger value="routes" className="text-xs">
            <Route className="h-4 w-4 mr-1" />
            Routes
          </TabsTrigger>
          <TabsTrigger value="alerts" className="text-xs relative">
            <AlertTriangle className="h-4 w-4 mr-1" />
            Alerts
            {alerts.length > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {alerts.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stores" className="flex-1 m-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-2">
              {stores.map((store) => (
                <Card
                  key={store.id}
                  className="p-3 cursor-pointer transition-all hover:bg-secondary/50"
                  onClick={() => onStoreClick(store)}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("w-3 h-3 rounded-full mt-1.5", getStatusColor(store.status))} />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm">{store.name}</h4>
                      <p className="text-xs text-muted-foreground truncate">
                        {store.address_street}, {store.address_city}
                      </p>
                      <Badge variant="outline" className="mt-1 text-xs capitalize">
                        {store.type.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="drivers" className="flex-1 m-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-2">
              {drivers.map((driver) => {
                const timeAgo = Math.floor((Date.now() - driver.updated_at.getTime()) / 1000);
                const isIdle = timeAgo > 900; // 15 minutes
                const status = isIdle ? 'idle' : 'moving';
                
                return (
                  <Card
                    key={driver.id}
                    className="p-3 cursor-pointer transition-all hover:bg-secondary/50"
                    onClick={() => onDriverClick(driver)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-3 h-3 rounded-full mt-1.5",
                        driver.role === 'driver' ? 'bg-red-500' : 'bg-purple-500',
                        !isIdle && 'animate-pulse'
                      )} />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm">{driver.name}</h4>
                        <p className="text-xs text-muted-foreground">{driver.territory}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs capitalize">
                            {driver.role}
                          </Badge>
                          <Badge 
                            variant={isIdle ? 'outline' : 'default'} 
                            className="text-xs capitalize"
                          >
                            {status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="routes" className="flex-1 m-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-2">
              {routes.map((route) => (
                <Card
                  key={route.id}
                  className="p-3 cursor-pointer transition-all hover:bg-secondary/50"
                  onClick={() => onRouteClick(route)}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("w-3 h-3 rounded-full mt-1.5", getRouteStatusColor(route.status))} />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm">{route.driverName}</h4>
                      <p className="text-xs text-muted-foreground">{route.territory}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {route.stops.length} stops
                        </Badge>
                        <Badge variant="outline" className="text-xs capitalize">
                          {route.status.replace('-', ' ')}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="alerts" className="flex-1 m-0 p-4">
          <AlertsPanel alerts={alerts} onAlertClick={onAlertClick} />
        </TabsContent>
      </Tabs>
    </Card>
  );
};
