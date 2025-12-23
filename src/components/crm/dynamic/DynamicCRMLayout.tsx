import { useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  CRMCategoryConfig, 
  getCRMCategoryConfig, 
  CRMCategorySlug,
  inferCRMCategory 
} from '@/config/crmCategories';
import { DynamicEntityList } from './DynamicEntityList';
import { DynamicEntityForm } from './DynamicEntityForm';
import { SharedCRMComponents } from './SharedCRMComponents';
import { 
  Users, Star, UserCheck, Car, Building, Ship, Link, Store, 
  Camera, Package, Calendar, DollarSign, MapPin, BarChart3,
  Sparkles, Target, Banknote, LayoutGrid, Truck, Bus, Plane,
  Waves, Building2, Image, GitBranch, Handshake, ShoppingCart, Map
} from 'lucide-react';

// Icon mapping
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Users, Star, UserCheck, Car, Building, Ship, Link, Store,
  Camera, Package, Calendar, DollarSign, MapPin, BarChart3,
  Sparkles, Target, Banknote, LayoutGrid, Truck, Bus, Plane,
  Waves, Building2, Image, GitBranch, Handshake, ShoppingCart, Map,
  CalendarDays: Calendar,
  TrendingUp: BarChart3,
  CreditCard: DollarSign,
  Shield: Target,
  Settings: LayoutGrid,
  User: Users,
};

interface DynamicCRMLayoutProps {
  businessSlug?: string | null;
  businessType?: string | null;
  industry?: string | null;
  categoryOverride?: CRMCategorySlug;
  selectedEntityId?: string | null;
  onEntitySelect?: (id: string | null) => void;
}

export function DynamicCRMLayout({
  businessSlug,
  businessType,
  industry,
  categoryOverride,
  selectedEntityId,
  onEntitySelect,
}: DynamicCRMLayoutProps) {
  // Determine the CRM category
  const categorySlug = useMemo(() => {
    if (categoryOverride) return categoryOverride;
    return inferCRMCategory(businessType, industry, businessSlug);
  }, [businessSlug, businessType, industry, categoryOverride]);

  // Get the category configuration
  const config = useMemo(() => {
    return getCRMCategoryConfig(categorySlug);
  }, [categorySlug]);

  // Get visible tabs
  const visibleTabs = useMemo(() => {
    return config.tabs.filter(tab => tab.enabled);
  }, [config]);

  // Get icon component
  const getIcon = (iconName: string) => {
    const IconComponent = ICON_MAP[iconName];
    return IconComponent ? <IconComponent className="h-4 w-4" /> : null;
  };

  return (
    <div className="space-y-6">
      {/* Category Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div 
            className="p-2 rounded-lg" 
            style={{ backgroundColor: `${config.color}20` }}
          >
            {getIcon(config.icon)}
          </div>
          <div>
            <h2 className="text-xl font-semibold">{config.name}</h2>
            <p className="text-sm text-muted-foreground">{config.description}</p>
          </div>
        </div>
        <Badge variant="outline" style={{ borderColor: config.color, color: config.color }}>
          {categorySlug.replace(/_/g, ' ').toUpperCase()}
        </Badge>
      </div>

      {/* Dynamic Tabs */}
      <Tabs defaultValue={visibleTabs[0]?.key} className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          {visibleTabs.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key} className="flex items-center gap-2">
              {getIcon(tab.icon)}
              <span>{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {visibleTabs.map((tab) => (
          <TabsContent key={tab.key} value={tab.key} className="mt-6">
            {tab.entity ? (
              <DynamicEntityList
                categorySlug={categorySlug}
                entityType={tab.entity}
                onSelect={onEntitySelect}
                selectedId={selectedEntityId}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {getIcon(tab.icon)}
                    {tab.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    {tab.label} view coming soon...
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Shared Components Sidebar */}
      {config.sharedComponents && (
        <SharedCRMComponents
          config={config}
          selectedEntityId={selectedEntityId}
        />
      )}
    </div>
  );
}
