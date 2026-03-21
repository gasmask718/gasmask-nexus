import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Palette, Image, Loader2, FileText, Package } from 'lucide-react';
import { useAssetsByType, type AssetType } from '@/hooks/useCanvaAssets';
import { CanvaAssetCard } from '@/components/canva/CanvaAssetCard';
import { useGenerateCanvaAsset } from '@/hooks/useCanvaAssets';
import { Skeleton } from '@/components/ui/skeleton';

const ASSET_TYPES: { value: AssetType; label: string; icon: string }[] = [
  { value: 'store_flyer', label: 'Store Flyers', icon: '📄' },
  { value: 'product_card', label: 'Product Cards', icon: '🏷️' },
  { value: 'sticker_design', label: 'Sticker Designs', icon: '🎨' },
  { value: 'campaign_image', label: 'Campaign Images', icon: '📸' },
  { value: 'welcome_card', label: 'Welcome Cards', icon: '🎉' },
  { value: 'price_sheet', label: 'Price Sheets', icon: '💰' },
  { value: 'social_post', label: 'Social Posts', icon: '📱' },
  { value: 'weekly_report', label: 'Weekly Reports', icon: '📊' },
  { value: 'demo_banner', label: 'Demo Banners', icon: '🖥️' },
];

export default function CanvaAssetsPage() {
  const [selectedType, setSelectedType] = useState<AssetType | undefined>(undefined);
  const { data: assets, isLoading } = useAssetsByType(selectedType);
  const generateAsset = useGenerateCanvaAsset();

  const readyCount = assets?.filter(a => a.status === 'ready').length || 0;
  const generatingCount = assets?.filter(a => a.status === 'generating').length || 0;
  const failedCount = assets?.filter(a => a.status === 'failed').length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Palette className="h-6 w-6" /> Design Assets
          </h2>
          <p className="text-muted-foreground text-sm">
            All Canva-generated designs across stores and campaigns
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Assets', value: assets?.length || 0, color: 'text-foreground' },
          { label: 'Ready', value: readyCount, color: 'text-green-500' },
          { label: 'Generating', value: generatingCount, color: 'text-blue-500' },
          { label: 'Failed', value: failedCount, color: 'text-red-500' },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={selectedType || 'all'} onValueChange={v => setSelectedType(v === 'all' ? undefined : v as AssetType)}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="All asset types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All asset types</SelectItem>
            {ASSET_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>
                {t.icon} {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Assets grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-lg" />
          ))}
        </div>
      ) : !assets?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Palette className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No design assets yet</p>
            <p className="text-sm mt-1">
              Generate assets from store profiles, campaigns, or the compliance checklist
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {assets.map((asset: any) => (
            <CanvaAssetCard
              key={asset.id}
              asset={asset}
              onRegenerate={() => generateAsset.mutate({
                asset_type: asset.asset_type,
                store_id: asset.store_id,
                brand: asset.brand,
              })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
