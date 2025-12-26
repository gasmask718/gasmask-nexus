/**
 * TopTier Assets - Media vault and documents
 */
import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ArrowLeft, Search, Eye, Plus, FileText, Image, 
  Video, File, Download, Folder, Upload
} from 'lucide-react';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { format } from 'date-fns';

// Generate simulated assets
const generateSimulatedAssets = () => {
  const types = ['image', 'video', 'document', 'contract', 'proposal'];
  const names = [
    'Miami Yacht Photos', 'Helicopter Tour Video', 'Partner Contract - LA Cars',
    'Event Proposal - Vegas', 'Security Team Photos', 'Club Package Promo',
    'Rooftop Event Gallery', 'Customer Testimonial', 'Rate Sheet 2024',
    'Terms & Conditions', 'Insurance Certificate', 'Marketing Materials'
  ];
  const partners = ['Miami Luxury Cars', 'LA Yacht Club', 'Vegas Helicopter', 'NYC Events', 'Atlanta Security'];

  return names.map((name, i) => ({
    id: `asset_${i + 1}`,
    name,
    type: types[i % types.length],
    file_type: types[i % types.length] === 'image' ? 'jpg' : types[i % types.length] === 'video' ? 'mp4' : 'pdf',
    size: `${Math.floor(Math.random() * 10) + 1}.${Math.floor(Math.random() * 9)}MB`,
    partner_id: `partner_${(i % partners.length) + 1}`,
    partner_name: partners[i % partners.length],
    folder: types[i % types.length] === 'image' || types[i % types.length] === 'video' ? 'Media' : 'Documents',
    uploaded_by: 'Admin User',
    uploaded_at: new Date(Date.now() - i * 3 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ['partner', types[i % types.length]],
  }));
};

export default function TopTierAssets() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>(searchParams.get('type') || 'all');
  const [folderFilter, setFolderFilter] = useState<string>('all');

  const { simulationMode } = useSimulationMode();
  const assets = useMemo(() => generateSimulatedAssets(), []);
  const isSimulated = simulationMode;

  // Filter assets
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      const matchesSearch = searchTerm === '' ||
        asset.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.partner_name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'all' || asset.type === typeFilter;
      const matchesFolder = folderFilter === 'all' || asset.folder === folderFilter;
      return matchesSearch && matchesType && matchesFolder;
    });
  }, [assets, searchTerm, typeFilter, folderFilter]);

  // Stats
  const stats = useMemo(() => ({
    total: assets.length,
    images: assets.filter(a => a.type === 'image').length,
    videos: assets.filter(a => a.type === 'video').length,
    documents: assets.filter(a => ['document', 'contract', 'proposal'].includes(a.type)).length,
  }), [assets]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="h-4 w-4 text-blue-500" />;
      case 'video': return <Video className="h-4 w-4 text-purple-500" />;
      case 'document': return <FileText className="h-4 w-4 text-green-500" />;
      case 'contract': return <FileText className="h-4 w-4 text-amber-500" />;
      case 'proposal': return <FileText className="h-4 w-4 text-cyan-500" />;
      default: return <File className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-fit"
          onClick={() => navigate('/crm/toptier-experience/partners')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Assets & Media Vault</h1>
              {isSimulated && <SimulationBadge />}
            </div>
            <p className="text-muted-foreground">Manage photos, videos, and documents</p>
          </div>
          <Button>
            <Upload className="h-4 w-4 mr-2" />
            Upload Asset
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Assets</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Folder className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Images</p>
                <p className="text-2xl font-bold">{stats.images}</p>
              </div>
              <Image className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Videos</p>
                <p className="text-2xl font-bold">{stats.videos}</p>
              </div>
              <Video className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Documents</p>
                <p className="text-2xl font-bold">{stats.documents}</p>
              </div>
              <FileText className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search assets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="image">Images</SelectItem>
            <SelectItem value="video">Videos</SelectItem>
            <SelectItem value="document">Documents</SelectItem>
            <SelectItem value="contract">Contracts</SelectItem>
            <SelectItem value="proposal">Proposals</SelectItem>
          </SelectContent>
        </Select>
        <Select value={folderFilter} onValueChange={setFolderFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Folder" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Folders</SelectItem>
            <SelectItem value="Media">Media</SelectItem>
            <SelectItem value="Documents">Documents</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Assets Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Folder className="h-5 w-5" />
            Assets ({filteredAssets.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredAssets.length === 0 ? (
            <div className="text-center py-12">
              <Folder className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No assets found</h3>
              <p className="text-muted-foreground mb-4">Upload your first asset to get started</p>
              <Button>
                <Upload className="h-4 w-4 mr-2" />
                Upload Asset
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredAssets.map((asset) => (
                <Card 
                  key={asset.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => navigate(`/crm/toptier-experience/assets/${asset.id}`)}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <div className="p-3 rounded-lg bg-muted">
                        {getTypeIcon(asset.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{asset.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{asset.partner_name}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">{asset.file_type}</Badge>
                          <span className="text-xs text-muted-foreground">{asset.size}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(asset.uploaded_at), 'MMM d, yyyy')}
                      </span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Download className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Eye className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
