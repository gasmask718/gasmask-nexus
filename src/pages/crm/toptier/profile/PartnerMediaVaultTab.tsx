/**
 * Partner Media Vault Tab - Photos & Videos management
 * Full folder-based media organization with preview and metadata
 */
import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Upload, Search, Image, Video, Folder, Eye, Download, Trash2, 
  Tag, Edit, Play, ExternalLink, Plus, Filter, Grid, List,
  Instagram, Share2, FileImage, Film, Camera
} from 'lucide-react';
import { SimulationBadge } from '@/contexts/SimulationModeContext';
import { format } from 'date-fns';
import EmptyStateWithGuidance from '@/components/crm/EmptyStateWithGuidance';

interface PartnerMediaVaultTabProps {
  partner: any;
  isSimulated: boolean;
}

interface MediaAsset {
  id: string;
  name: string;
  type: 'photo' | 'video';
  folder: string;
  url: string;
  thumbnail: string;
  size: string;
  uploadedAt: string;
  uploadedBy: string;
  tags: string[];
  usageNotes: string;
  linkedCampaigns?: string[];
}

const MEDIA_FOLDERS = [
  { id: 'photos', label: 'Photos', icon: Image },
  { id: 'videos', label: 'Videos', icon: Video },
  { id: 'social', label: 'Social Media Content', icon: Instagram },
  { id: 'promo', label: 'Promotional Content', icon: Share2 },
  { id: 'venue', label: 'Venue / Asset Shots', icon: Camera },
  { id: 'legal', label: 'Contracts & Legal Media', icon: Folder },
];

export default function PartnerMediaVaultTab({ partner, isSimulated }: PartnerMediaVaultTabProps) {
  const navigate = useNavigate();
  const { partnerId } = useParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFolder, setActiveFolder] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Generate simulated media assets
  const mediaAssets: MediaAsset[] = useMemo(() => {
    if (!isSimulated) return [];
    
    const photos = [
      { name: 'Venue Exterior Shot', folder: 'venue', tags: ['exterior', 'daytime'] },
      { name: 'Interior Lounge Area', folder: 'venue', tags: ['interior', 'lounge'] },
      { name: 'VIP Section Preview', folder: 'venue', tags: ['vip', 'premium'] },
      { name: 'Instagram Story Template', folder: 'social', tags: ['story', 'template'] },
      { name: 'Promo Banner - Summer', folder: 'promo', tags: ['banner', 'seasonal'] },
      { name: 'Service Showcase 1', folder: 'photos', tags: ['service', 'showcase'] },
      { name: 'Customer Experience Shot', folder: 'photos', tags: ['customer', 'experience'] },
      { name: 'Brand Logo High-Res', folder: 'promo', tags: ['logo', 'branding'] },
    ];

    const videos = [
      { name: 'Venue Walkthrough', folder: 'videos', tags: ['walkthrough', 'tour'] },
      { name: 'Service Demo Reel', folder: 'videos', tags: ['demo', 'service'] },
      { name: 'TikTok Promo Clip', folder: 'social', tags: ['tiktok', 'short'] },
      { name: 'Event Highlights', folder: 'promo', tags: ['event', 'highlights'] },
    ];

    const allMedia: MediaAsset[] = [
      ...photos.map((p, i) => ({
        id: `photo-${i}`,
        name: p.name,
        type: 'photo' as const,
        folder: p.folder,
        url: `https://picsum.photos/800/600?random=${i}`,
        thumbnail: `https://picsum.photos/200/150?random=${i}`,
        size: `${Math.floor(Math.random() * 5 + 1)}.${Math.floor(Math.random() * 9)}MB`,
        uploadedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        uploadedBy: 'Admin User',
        tags: p.tags,
        usageNotes: 'Approved for marketing use',
        linkedCampaigns: Math.random() > 0.5 ? ['Summer Promo 2024'] : undefined,
      })),
      ...videos.map((v, i) => ({
        id: `video-${i}`,
        name: v.name,
        type: 'video' as const,
        folder: v.folder,
        url: 'https://example.com/video.mp4',
        thumbnail: `https://picsum.photos/200/150?random=${i + 100}`,
        size: `${Math.floor(Math.random() * 50 + 10)}.${Math.floor(Math.random() * 9)}MB`,
        uploadedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        uploadedBy: 'Marketing Team',
        tags: v.tags,
        usageNotes: 'Internal use only',
        linkedCampaigns: Math.random() > 0.5 ? ['Q4 Campaign'] : undefined,
      })),
    ];

    return allMedia;
  }, [isSimulated]);

  // Filter assets
  const filteredAssets = useMemo(() => {
    return mediaAssets.filter(asset => {
      const matchesSearch = searchTerm === '' || 
        asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesFolder = activeFolder === 'all' || asset.folder === activeFolder;
      const matchesType = typeFilter === 'all' || asset.type === typeFilter;
      return matchesSearch && matchesFolder && matchesType;
    });
  }, [mediaAssets, searchTerm, activeFolder, typeFilter]);

  // Get folder counts
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = { all: mediaAssets.length };
    MEDIA_FOLDERS.forEach(folder => {
      counts[folder.id] = mediaAssets.filter(a => a.folder === folder.id).length;
    });
    return counts;
  }, [mediaAssets]);

  const handleUpload = () => {
    console.log('Opening upload dialog...');
    // TODO: Implement file upload
  };

  const handleViewAsset = (assetId: string) => {
    navigate(`/crm/toptier-experience/assets/${assetId}`);
  };

  const handleDownload = (e: React.MouseEvent, asset: MediaAsset) => {
    e.stopPropagation();
    console.log('Downloading asset:', asset.name);
  };

  const handleDelete = (e: React.MouseEvent, assetId: string) => {
    e.stopPropagation();
    console.log('Deleting asset:', assetId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Media Vault</h2>
          {isSimulated && <SimulationBadge />}
        </div>
        <div className="flex gap-2">
          <Button onClick={handleUpload}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Media
          </Button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Assets</p>
                <p className="text-2xl font-bold">{mediaAssets.length}</p>
              </div>
              <FileImage className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Photos</p>
                <p className="text-2xl font-bold">{mediaAssets.filter(a => a.type === 'photo').length}</p>
              </div>
              <Image className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Videos</p>
                <p className="text-2xl font-bold">{mediaAssets.filter(a => a.type === 'video').length}</p>
              </div>
              <Film className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Folders</p>
                <p className="text-2xl font-bold">{MEDIA_FOLDERS.length}</p>
              </div>
              <Folder className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Folders & Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Folder Sidebar */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Folders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-2">
            <Button
              variant={activeFolder === 'all' ? 'secondary' : 'ghost'}
              className="w-full justify-start"
              onClick={() => setActiveFolder('all')}
            >
              <Folder className="h-4 w-4 mr-2" />
              All Media
              <Badge variant="outline" className="ml-auto">{folderCounts.all}</Badge>
            </Button>
            {MEDIA_FOLDERS.map(folder => {
              const Icon = folder.icon;
              return (
                <Button
                  key={folder.id}
                  variant={activeFolder === folder.id ? 'secondary' : 'ghost'}
                  className="w-full justify-start"
                  onClick={() => setActiveFolder(folder.id)}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  <span className="truncate">{folder.label}</span>
                  <Badge variant="outline" className="ml-auto">{folderCounts[folder.id] || 0}</Badge>
                </Button>
              );
            })}
          </CardContent>
        </Card>

        {/* Media Grid */}
        <div className="lg:col-span-3 space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search media..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="photo">Photos</SelectItem>
                <SelectItem value="video">Videos</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-1">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Media Content */}
          {filteredAssets.length === 0 ? (
            <EmptyStateWithGuidance
              icon={<Image className="h-12 w-12" />}
              title="No media found"
              description={searchTerm ? 'Try adjusting your search' : 'Upload photos and videos to this partner\'s media vault'}
              actionLabel="Upload Media"
              onAction={handleUpload}
            />
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredAssets.map(asset => (
                <Card 
                  key={asset.id}
                  className="cursor-pointer hover:shadow-lg transition-all group overflow-hidden"
                  onClick={() => handleViewAsset(asset.id)}
                >
                  <div className="relative aspect-video bg-muted">
                    <img 
                      src={asset.thumbnail} 
                      alt={asset.name}
                      className="w-full h-full object-cover"
                    />
                    {asset.type === 'video' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <Play className="h-10 w-10 text-white" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="secondary" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={(e) => handleDownload(e, asset)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={(e) => handleDelete(e, asset.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Badge 
                      className="absolute bottom-2 left-2" 
                      variant={asset.type === 'video' ? 'default' : 'secondary'}
                    >
                      {asset.type === 'video' ? <Video className="h-3 w-3 mr-1" /> : <Image className="h-3 w-3 mr-1" />}
                      {asset.type}
                    </Badge>
                  </div>
                  <CardContent className="p-3">
                    <p className="font-medium text-sm truncate">{asset.name}</p>
                    <p className="text-xs text-muted-foreground">{asset.size}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {asset.tags.slice(0, 2).map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <div className="divide-y">
                {filteredAssets.map(asset => (
                  <div 
                    key={asset.id}
                    className="flex items-center gap-4 p-4 hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleViewAsset(asset.id)}
                  >
                    <div className="relative h-16 w-24 rounded-lg overflow-hidden bg-muted">
                      <img 
                        src={asset.thumbnail} 
                        alt={asset.name}
                        className="w-full h-full object-cover"
                      />
                      {asset.type === 'video' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <Play className="h-6 w-6 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{asset.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {asset.size} • Uploaded {format(new Date(asset.uploadedAt), 'MMM d, yyyy')}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {asset.tags.map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                    <Badge variant={asset.type === 'video' ? 'default' : 'secondary'}>
                      {asset.type}
                    </Badge>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={(e) => handleDownload(e, asset)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={(e) => handleDelete(e, asset.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
