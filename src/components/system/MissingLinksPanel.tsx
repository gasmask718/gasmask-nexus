// Phase 12 - Missing Linked Data Detection Panel

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertTriangle, 
  Link2Off, 
  Wrench, 
  RefreshCw,
  Store,
  Truck,
  FileText,
  Package,
  Users
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MissingLink {
  id: string;
  name: string;
  entityType: string;
  missingField: string;
  message: string;
}

interface MissingLinksPanelProps {
  entityTypes?: string[];
  maxItems?: number;
  onFixClick?: (item: MissingLink) => void;
}

const entityIcons: Record<string, React.ElementType> = {
  stores: Store,
  orders: FileText,
  drivers: Truck,
  inventory: Package,
  ambassadors: Users,
};

export function MissingLinksPanel({ 
  entityTypes = ['stores', 'orders', 'drivers', 'inventory'], 
  maxItems = 10,
  onFixClick 
}: MissingLinksPanelProps) {
  const [missingLinks, setMissingLinks] = useState<MissingLink[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const scanForMissingLinks = async () => {
    setIsLoading(true);
    const links: MissingLink[] = [];

    try {
      // Check stores without company
      if (entityTypes.includes('stores')) {
        const { data: stores } = await (supabase as any)
          .from('stores')
          .select('id, name, company_id, region')
          .limit(50);

        for (const store of stores || []) {
          if (!store.company_id) {
            links.push({
              id: store.id,
              name: store.name || 'Unnamed Store',
              entityType: 'stores',
              missingField: 'company_id',
              message: 'Missing company link',
            });
          }
          if (!store.region) {
            links.push({
              id: store.id,
              name: store.name || 'Unnamed Store',
              entityType: 'stores',
              missingField: 'region',
              message: 'Missing region',
            });
          }
        }
      }

      // Check drivers without region
      if (entityTypes.includes('drivers')) {
        const { data: profiles } = await (supabase as any)
          .from('profiles')
          .select('id, name, role')
          .eq('role', 'driver')
          .limit(50);

        for (const driver of profiles || []) {
          // Check if driver has route assignments
          const { data: routes } = await (supabase as any)
            .from('biker_routes')
            .select('id')
            .eq('biker_name', driver.name)
            .limit(1);

          if (!routes || routes.length === 0) {
            links.push({
              id: driver.id,
              name: driver.name || 'Unknown Driver',
              entityType: 'drivers',
              missingField: 'route',
              message: 'No assigned routes',
            });
          }
        }
      }

      // Check inventory without brand
      if (entityTypes.includes('inventory')) {
        const { data: inventory } = await (supabase as any)
          .from('store_brand_accounts')
          .select('id, store_master_id, brand')
          .is('brand', null)
          .limit(50);

        for (const item of inventory || []) {
          links.push({
            id: item.id,
            name: `Inventory ${item.id.slice(0, 8)}`,
            entityType: 'inventory',
            missingField: 'brand',
            message: 'Missing brand assignment',
          });
        }
      }

      setMissingLinks(links.slice(0, maxItems));
    } catch (error) {
      console.error('Error scanning for missing links:', error);
      toast.error('Failed to scan for missing links');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    scanForMissingLinks();
  }, [entityTypes.join(',')]);

  const handleFix = (item: MissingLink) => {
    if (onFixClick) {
      onFixClick(item);
    } else {
      toast.info(`Fix ${item.entityType}: ${item.name}`);
    }
  };

  if (missingLinks.length === 0 && !isLoading) {
    return (
      <Card className="border-green-500/20 bg-green-500/5">
        <CardContent className="py-4 text-center">
          <p className="text-sm text-green-600">All records properly linked</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Link2Off className="h-4 w-4 text-amber-500" />
            Missing Links
            <Badge variant="secondary" className="ml-1">
              {missingLinks.length}
            </Badge>
          </CardTitle>
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={scanForMissingLinks}
            disabled={isLoading}
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[200px]">
          <div className="space-y-1 p-3 pt-0">
            {missingLinks.map((item) => {
              const Icon = entityIcons[item.entityType] || AlertTriangle;
              return (
                <div
                  key={`${item.entityType}-${item.id}-${item.missingField}`}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/50 hover:bg-muted"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{item.name}</p>
                      <p className="text-[10px] text-muted-foreground">{item.message}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    onClick={() => handleFix(item)}
                  >
                    <Wrench className="h-3 w-3 mr-1" />
                    Fix
                  </Button>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
