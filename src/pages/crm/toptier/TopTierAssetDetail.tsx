/**
 * TopTier Asset Detail Page
 * Full view of a media asset with metadata
 */
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, Edit, Image, Video, Download, 
  Building2, Calendar, User, Tag, Link2
} from 'lucide-react';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { useCRMSimulation } from '@/hooks/useCRMSimulation';
import { useResolvedData } from '@/hooks/useResolvedData';
import { format } from 'date-fns';

export default function TopTierAssetDetail() {
  const navigate = useNavigate();
  const { partnerId, assetId } = useParams<{ partnerId?: string; assetId: string }>();
  
  const { simulationMode } = useSimulationMode();
  const { getEntityData } = useCRMSimulation('toptier-experience');
  
  // Generate simulated assets
  const simulatedAssets = useMemo(() => [
    { id: 'asset1', partner_id: partnerId, name: 'Yacht Sunset Shot', type: 'image', url: 'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=800', folder: 'Photos', tags: ['yacht', 'sunset', 'lifestyle'], usage_notes: 'Approved for social media and website', uploaded_by: 'John Smith', created_at: new Date().toISOString() },
    { id: 'asset2', partner_id: partnerId, name: 'Promotional Video', type: 'video', url: '#', folder: 'Videos', tags: ['promo', 'brand'], usage_notes: 'Use for paid campaigns only', uploaded_by: 'Jane Doe', created_at: new Date(Date.now() - 86400000).toISOString() },
    { id: 'asset3', partner_id: partnerId, name: 'Venue Interior', type: 'image', url: 'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?w=800', folder: 'Venue / Asset Shots', tags: ['interior', 'venue', 'luxury'], usage_notes: 'Editorial use allowed', uploaded_by: 'John Smith', created_at: new Date(Date.now() - 172800000).toISOString() },
  ], [partnerId]);

  const { data: assets, isSimulated } = useResolvedData([], simulatedAssets);

  const asset = useMemo(() => {
    return assets.find((a: any) => a.id === assetId);
  }, [assets, assetId]);

  if (!asset) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card className="p-8 text-center">
          <Image className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium mb-2">Asset not found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            The asset you're looking for doesn't exist.
          </p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </Card>
      </div>
    );
  }

  const isImage = asset.type === 'image';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center">
              {isImage ? <Image className="h-8 w-8 text-primary" /> : <Video className="h-8 w-8 text-primary" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{asset.name}</h1>
                {isSimulated && <SimulationBadge />}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">{asset.type}</Badge>
                <Badge variant="secondary">{asset.folder}</Badge>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(`/crm/toptier-experience/partners/profile/${partnerId}/assets/${assetId}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Metadata
            </Button>
            <Button>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Preview */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-0">
              {isImage ? (
                <img 
                  src={asset.url} 
                  alt={asset.name}
                  className="w-full h-auto rounded-lg"
                />
              ) : (
                <div className="aspect-video bg-muted flex items-center justify-center rounded-lg">
                  <Video className="h-16 w-16 text-muted-foreground" />
                  <p className="text-muted-foreground ml-4">Video Preview</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Metadata */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Asset Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Uploaded</p>
                  <p className="font-medium">{format(new Date(asset.created_at), 'MMMM d, yyyy')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Uploaded By</p>
                  <p className="font-medium">{asset.uploaded_by}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Tags
                </p>
                <div className="flex flex-wrap gap-1">
                  {asset.tags?.map((tag: string) => (
                    <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Usage Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{asset.usage_notes || 'No usage restrictions specified.'}</p>
            </CardContent>
          </Card>

          {partnerId && (
            <Card>
              <CardHeader>
                <CardTitle>Partner</CardTitle>
              </CardHeader>
              <CardContent>
                <div 
                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => navigate(`/crm/toptier-experience/partners/profile/${partnerId}`)}
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">View Partner</p>
                    <p className="text-sm text-muted-foreground">Click to open</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
