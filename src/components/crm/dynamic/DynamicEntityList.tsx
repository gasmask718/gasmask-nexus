import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  getCRMCategoryConfig, 
  getCategoryEntity,
  CRMCategorySlug, 
  EntityType 
} from '@/config/crmCategories';
import { Plus, Search, Filter } from 'lucide-react';

interface DynamicEntityListProps {
  categorySlug: CRMCategorySlug;
  entityType: EntityType;
  onSelect?: (id: string | null) => void;
  selectedId?: string | null;
}

export function DynamicEntityList({
  categorySlug,
  entityType,
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

  if (!entityConfig) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            Entity type "{entityType}" is not configured for this category.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Mock data for demonstration - will be replaced with actual data fetching
  const mockData = [
    { id: '1', name: 'Sample Item 1', status: 'active' },
    { id: '2', name: 'Sample Item 2', status: 'pending' },
    { id: '3', name: 'Sample Item 3', status: 'inactive' },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {entityConfig.labelPlural}
            <Badge variant="secondary" className="ml-2">
              {mockData.length}
            </Badge>
          </CardTitle>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add {entityConfig.label}
          </Button>
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
          <div className="space-y-2">
            {mockData.map((item) => (
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
                      {entityConfig.label} ID: {item.id}
                    </p>
                  </div>
                  <Badge 
                    variant={item.status === 'active' ? 'default' : 'secondary'}
                    style={{ 
                      backgroundColor: item.status === 'active' ? config.color : undefined 
                    }}
                  >
                    {item.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
