/**
 * Partner Assets Tab - Document and media management
 */
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, Search, Upload, Download, Eye, Edit, Trash2,
  File, FileText, Image, Video, Archive, Tag
} from 'lucide-react';
import { SimulationBadge, EmptyStateWithGuidance } from '@/contexts/SimulationModeContext';
import { format } from 'date-fns';

interface PartnerAssetsTabProps {
  partner: any;
  isSimulated: boolean;
}

export default function PartnerAssetsTab({ partner, isSimulated }: PartnerAssetsTabProps) {
  const navigate = useNavigate();
  const { partnerId } = useParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // Simulated assets
  const [assets] = useState([
    { id: '1', name: 'Service Agreement 2024.pdf', type: 'contract', size: '2.4 MB', uploadDate: new Date(Date.now() - 86400000 * 30), tags: ['legal', 'active'] },
    { id: '2', name: 'Partner Media Kit.zip', type: 'media', size: '45 MB', uploadDate: new Date(Date.now() - 86400000 * 45), tags: ['marketing'] },
    { id: '3', name: 'Insurance Certificate.pdf', type: 'insurance', size: '1.1 MB', uploadDate: new Date(Date.now() - 86400000 * 60), tags: ['legal', 'insurance'] },
    { id: '4', name: 'Rate Card 2024.xlsx', type: 'document', size: '156 KB', uploadDate: new Date(Date.now() - 86400000 * 20), tags: ['pricing'] },
    { id: '5', name: 'Promo Photos.zip', type: 'media', size: '120 MB', uploadDate: new Date(Date.now() - 86400000 * 10), tags: ['marketing', 'photos'] },
    { id: '6', name: 'Venue Tour Video.mp4', type: 'video', size: '250 MB', uploadDate: new Date(Date.now() - 86400000 * 5), tags: ['marketing', 'video'] },
  ]);

  const filteredAssets = useMemo(() => {
    return assets.filter((asset: any) => {
      const matchesSearch = !searchTerm || 
        asset.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.tags?.some((t: string) => t.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesType = typeFilter === 'all' || asset.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [assets, searchTerm, typeFilter]);

  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'contract': return <FileText className="h-8 w-8" />;
      case 'document': return <File className="h-8 w-8" />;
      case 'media': return <Image className="h-8 w-8" />;
      case 'video': return <Video className="h-8 w-8" />;
      case 'insurance': return <FileText className="h-8 w-8" />;
      default: return <Archive className="h-8 w-8" />;
    }
  };

  const getAssetColor = (type: string) => {
    switch (type) {
      case 'contract': return 'bg-blue-500/10 text-blue-500';
      case 'document': return 'bg-gray-500/10 text-gray-500';
      case 'media': return 'bg-purple-500/10 text-purple-500';
      case 'video': return 'bg-red-500/10 text-red-500';
      case 'insurance': return 'bg-green-500/10 text-green-500';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  const handleUploadAsset = () => {
    // Open file upload dialog
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = (e: any) => {
      const files = e.target.files;
      console.log('Files to upload:', files);
    };
    input.click();
  };

  const handleViewAsset = (assetId: string) => {
    navigate(`/crm/toptier-experience/partners/profile/${partnerId}/assets/${assetId}`);
  };

  const handleDownloadAsset = (e: React.MouseEvent, asset: any) => {
    e.stopPropagation();
    console.log('Download asset:', asset.name);
  };

  const handleDeleteAsset = (e: React.MouseEvent, assetId: string) => {
    e.stopPropagation();
    console.log('Delete asset:', assetId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          Assets
          {isSimulated && <SimulationBadge />}
        </h2>
        <Button onClick={handleUploadAsset}>
          <Upload className="h-4 w-4 mr-2" />
          Upload Asset
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search assets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Asset Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="contract">Contracts</SelectItem>
            <SelectItem value="document">Documents</SelectItem>
            <SelectItem value="media">Media</SelectItem>
            <SelectItem value="video">Videos</SelectItem>
            <SelectItem value="insurance">Insurance</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Assets Grid */}
      {filteredAssets.length === 0 ? (
        <EmptyStateWithGuidance
          icon={File}
          title="No Assets"
          description="Upload contracts, media, and other documents related to this partner."
          actionLabel="Upload Asset"
          onAction={handleUploadAsset}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssets.map((asset: any) => (
            <Card 
              key={asset.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => handleViewAsset(asset.id)}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`h-16 w-16 rounded-lg flex items-center justify-center ${getAssetColor(asset.type)}`}>
                    {getAssetIcon(asset.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{asset.name}</h3>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <span>{asset.size}</span>
                      <span>•</span>
                      <span>{format(asset.uploadDate, 'MMM d, yyyy')}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {asset.tags?.map((tag: string) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          <Tag className="h-2 w-2 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={(e) => handleDownloadAsset(e, asset)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); handleViewAsset(asset.id); }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={(e) => handleDeleteAsset(e, asset.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
