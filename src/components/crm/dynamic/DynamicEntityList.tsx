import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  getCRMCategoryConfig, 
  getCategoryEntity,
  CRMCategorySlug, 
  EntityType 
} from '@/config/crmCategories';
import { useCRMEntities } from '@/hooks/useCRMEntities';
import { Plus, Search, Filter, RefreshCw, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface DynamicEntityListProps {
  categorySlug: CRMCategorySlug;
  entityType: EntityType;
  businessId?: string | null;
  onSelect?: (id: string | null) => void;
  selectedId?: string | null;
}

export function DynamicEntityList({
  categorySlug,
  entityType,
  businessId,
  onSelect,
  selectedId,
}: DynamicEntityListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Get entity configuration
  const entityConfig = useMemo(() => {
    return getCategoryEntity(categorySlug, entityType);
  }, [categorySlug, entityType]);

  const config = useMemo(() => {
    return getCRMCategoryConfig(categorySlug);
  }, [categorySlug]);

  // Fetch real data
  const { data: entities = [], isLoading, error, refetch } = useCRMEntities({
    categorySlug,
    entityType,
    businessId,
    searchTerm,
    limit: 100,
  });

  if (!entityConfig) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">
            Entity type "{entityType}" is not configured for this category.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getStatusVariant = (status: string | boolean) => {
    if (typeof status === 'boolean') {
      return status ? 'default' : 'secondary';
    }
    const statusLower = String(status).toLowerCase();
    if (['active', 'confirmed', 'completed', 'true'].includes(statusLower)) {
      return 'default' as const;
    }
    if (['pending', 'warm', 'in_progress'].includes(statusLower)) {
      return 'outline' as const;
    }
    return 'secondary' as const;
  };

  const formatStatus = (status: string | boolean) => {
    if (typeof status === 'boolean') {
      return status ? 'Active' : 'Inactive';
    }
    return String(status).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {entityConfig.labelPlural}
            <Badge variant="secondary" className="ml-2">
              {isLoading ? '...' : entities.length}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add {entityConfig.label}
            </Button>
          </div>
        </div>
        
        {/* Search & Filter Bar */}
        <div className="flex items-center gap-2 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${entityConfig.labelPlural.toLowerCase()}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        <ScrollArea className="h-[400px]">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="p-4 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-5 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <AlertCircle className="h-8 w-8 mx-auto text-destructive mb-2" />
              <p className="text-muted-foreground">Failed to load {entityConfig.labelPlural.toLowerCase()}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
                Try Again
              </Button>
            </div>
          ) : entities.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground mb-4">
                No {entityConfig.labelPlural.toLowerCase()} found
              </p>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add First {entityConfig.label}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {entities.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onSelect?.(item.id)}
                  className={`
                    p-4 rounded-lg border cursor-pointer transition-colors
                    ${selectedId === item.id 
                      ? 'border-primary bg-primary/5' 
                      : 'hover:bg-muted/50'
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.rawData?.created_at && (
                          <>Added {formatDistanceToNow(new Date(item.rawData.created_at), { addSuffix: true })}</>
                        )}
                      </p>
                    </div>
                    <Badge 
                      variant={getStatusVariant(item.status)}
                      style={{ 
                        backgroundColor: getStatusVariant(item.status) === 'default' ? config.color : undefined 
                      }}
                    >
                      {formatStatus(item.status)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
