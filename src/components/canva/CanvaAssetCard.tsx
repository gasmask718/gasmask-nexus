import { Download, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const ASSET_LABELS: Record<string, string> = {
  store_flyer: 'Store Flyer',
  product_card: 'Product Card',
  sticker_design: 'Sticker Design',
  campaign_image: 'Campaign Image',
  welcome_card: 'Welcome Card',
  price_sheet: 'Price Sheet',
  social_post: 'Social Post',
  weekly_report: 'Weekly Report',
  demo_banner: 'Demo Banner',
};

interface CanvaAssetCardProps {
  asset: {
    id: string;
    asset_type: string;
    brand?: string;
    product_name?: string;
    status: string;
    canva_edit_url?: string;
    canva_export_url?: string;
    thumbnail_url?: string;
    created_at: string;
    metadata?: any;
  };
  onRegenerate?: () => void;
}

export function CanvaAssetCard({ asset, onRegenerate }: CanvaAssetCardProps) {
  const isReady = asset.status === 'ready';
  const isGenerating = asset.status === 'generating';

  return (
    <Card className="overflow-hidden">
      {/* Thumbnail / placeholder */}
      <div className="h-32 bg-muted flex items-center justify-center">
        {asset.thumbnail_url ? (
          <img src={asset.thumbnail_url} alt={asset.asset_type} className="w-full h-full object-cover" />
        ) : isGenerating ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-xs">Generating in Canva...</p>
          </div>
        ) : (
          <div className="text-center text-muted-foreground">
            <p className="text-2xl">🎨</p>
            <p className="text-xs mt-1">{asset.status === 'failed' ? 'Failed' : 'No preview'}</p>
          </div>
        )}
      </div>

      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium">{ASSET_LABELS[asset.asset_type] || asset.asset_type}</p>
            {asset.brand && <p className="text-[10px] text-muted-foreground">{asset.brand}</p>}
          </div>
          <Badge
            variant={isReady ? 'default' : isGenerating ? 'secondary' : 'destructive'}
            className="text-[10px]"
          >
            {asset.status}
          </Badge>
        </div>

        <p className="text-[10px] text-muted-foreground">
          {new Date(asset.created_at).toLocaleDateString()}
        </p>

        <div className="flex gap-1.5">
          {asset.canva_export_url && (
            <Button size="sm" variant="outline" className="text-xs h-7 gap-1 flex-1" onClick={() => window.open(asset.canva_export_url!, '_blank')}>
              <Download className="w-3 h-3" /> Download
            </Button>
          )}
          {asset.canva_edit_url && (
            <Button size="sm" variant="outline" className="text-xs h-7 gap-1 flex-1" onClick={() => window.open(asset.canva_edit_url!, '_blank')}>
              <ExternalLink className="w-3 h-3" /> Edit
            </Button>
          )}
          {onRegenerate && (
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onRegenerate}>
              <RefreshCw className="w-3 h-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
