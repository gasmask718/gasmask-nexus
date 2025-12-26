import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ImageIcon, Video, Upload, Search, Filter, Download, Eye, 
  Trash2, FolderOpen, Plus, Calendar, User, Tag, ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { useToast } from '@/hooks/use-toast';

interface MediaAsset {
  id: string;
  type: 'image' | 'video';
  name: string;
  url: string;
  thumbnail: string;
  category: 'promo' | 'event' | 'influencer' | 'social' | 'flyer';
  linkedEntity?: { type: string; name: string; id: string };
  usageRights: 'internal' | 'promo' | 'full';
  uploadedBy: string;
  uploadedAt: string;
  fileSize: string;
  dimensions?: string;
  duration?: string;
}

const SIMULATED_MEDIA: MediaAsset[] = [
  {
    id: 'media-001',
    type: 'video',
    name: 'NYE Gala 2023 Highlight Reel',
    url: '/placeholder.svg',
    thumbnail: '/placeholder.svg',
    category: 'promo',
    linkedEntity: { type: 'event', name: 'New Year\'s Eve Gala', id: 'event-001' },
    usageRights: 'promo',
    uploadedBy: 'Marketing Team',
    uploadedAt: '2024-01-02T10:00:00Z',
    fileSize: '145 MB',
    duration: '2:34'
  },
  {
    id: 'media-002',
    type: 'image',
    name: 'Grand Ballroom Setup',
    url: '/placeholder.svg',
    thumbnail: '/placeholder.svg',
    category: 'event',
    linkedEntity: { type: 'venue', name: 'Grand Ballroom NYC', id: 'hall-001' },
    usageRights: 'full',
    uploadedBy: 'Venue Manager',
    uploadedAt: '2024-01-10T14:30:00Z',
    fileSize: '4.2 MB',
    dimensions: '4000x3000'
  },
  {
    id: 'media-003',
    type: 'video',
    name: '@PartyQueen Instagram Story',
    url: '/placeholder.svg',
    thumbnail: '/placeholder.svg',
    category: 'influencer',
    linkedEntity: { type: 'influencer', name: 'Maria (@PartyQueen)', id: 'inf-001' },
    usageRights: 'promo',
    uploadedBy: 'Influencer Relations',
    uploadedAt: '2024-01-08T09:15:00Z',
    fileSize: '28 MB',
    duration: '0:45'
  },
  {
    id: 'media-004',
    type: 'image',
    name: 'Quinceañera Package Flyer',
    url: '/placeholder.svg',
    thumbnail: '/placeholder.svg',
    category: 'flyer',
    usageRights: 'promo',
    uploadedBy: 'Design Team',
    uploadedAt: '2024-01-05T11:00:00Z',
    fileSize: '1.8 MB',
    dimensions: '1080x1920'
  },
  {
    id: 'media-005',
    type: 'image',
    name: 'Rodriguez Wedding Reception',
    url: '/placeholder.svg',
    thumbnail: '/placeholder.svg',
    category: 'event',
    linkedEntity: { type: 'event', name: 'Rodriguez Wedding', id: 'event-002' },
    usageRights: 'internal',
    uploadedBy: 'Photographer',
    uploadedAt: '2024-01-14T16:45:00Z',
    fileSize: '8.5 MB',
    dimensions: '5000x3333'
  },
  {
    id: 'media-006',
    type: 'video',
    name: 'TikTok Event Montage',
    url: '/placeholder.svg',
    thumbnail: '/placeholder.svg',
    category: 'social',
    usageRights: 'promo',
    uploadedBy: 'Social Media Team',
    uploadedAt: '2024-01-12T13:20:00Z',
    fileSize: '52 MB',
    duration: '1:00'
  }
];

const categoryConfig: Record<string, { label: string; color: string }> = {
  promo: { label: 'Promo Video', color: 'bg-purple-500/20 text-purple-400' },
  event: { label: 'Event Highlight', color: 'bg-blue-500/20 text-blue-400' },
  influencer: { label: 'Influencer Content', color: 'bg-pink-500/20 text-pink-400' },
  social: { label: 'Social Media', color: 'bg-green-500/20 text-green-400' },
  flyer: { label: 'Flyer/Ad', color: 'bg-yellow-500/20 text-yellow-400' }
};

const rightsConfig: Record<string, { label: string; color: string }> = {
  internal: { label: 'Internal Only', color: 'bg-gray-500/20 text-gray-400' },
  promo: { label: 'Promo Use', color: 'bg-blue-500/20 text-blue-400' },
  full: { label: 'Full Rights', color: 'bg-green-500/20 text-green-400' }
};

export default function UnforgettableMedia() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { simulationMode } = useSimulationMode();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedMedia, setSelectedMedia] = useState<MediaAsset | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const media = simulationMode ? SIMULATED_MEDIA : [];

  const filteredMedia = media.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    return matchesSearch && matchesCategory && matchesType;
  });

  const stats = {
    total: media.length,
    images: media.filter(m => m.type === 'image').length,
    videos: media.filter(m => m.type === 'video').length,
    promo: media.filter(m => m.usageRights === 'promo' || m.usageRights === 'full').length
  };

  const handleUpload = () => {
    if (!simulationMode) {
      toast({
        title: 'Storage Not Configured',
        description: 'Please configure storage bucket to enable uploads.',
        variant: 'destructive'
      });
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
      toast({
        title: 'Upload Complete',
        description: `${files.length} file(s) uploaded successfully.`
      });
    }, 1500);
  };

  const handleDownload = (item: MediaAsset) => {
    toast({
      title: 'Download Started',
      description: `Downloading ${item.name}...`
    });
  };

  return (
    <div className="space-y-6 p-6">
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        multiple 
        accept="image/*,video/*"
        onChange={handleFileSelect}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="sm" onClick={() => navigate('/os/unforgettable')}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FolderOpen className="h-8 w-8 text-primary" />
            Media Vault
            {simulationMode && <SimulationBadge />}
          </h1>
          <p className="text-muted-foreground">Manage promotional content, event highlights, and media assets</p>
        </div>
        <Button onClick={handleUpload} disabled={isUploading}>
          <Upload className="h-4 w-4 mr-2" />
          {isUploading ? 'Uploading...' : 'Upload Media'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Assets</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <FolderOpen className="h-6 w-6 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Images</p>
                <p className="text-2xl font-bold text-blue-400">{stats.images}</p>
              </div>
              <ImageIcon className="h-6 w-6 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-purple-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Videos</p>
                <p className="text-2xl font-bold text-purple-400">{stats.videos}</p>
              </div>
              <Video className="h-6 w-6 text-purple-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Promo Ready</p>
                <p className="text-2xl font-bold text-green-400">{stats.promo}</p>
              </div>
              <Tag className="h-6 w-6 text-green-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search media..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="promo">Promo Videos</SelectItem>
                <SelectItem value="event">Event Highlights</SelectItem>
                <SelectItem value="influencer">Influencer Content</SelectItem>
                <SelectItem value="social">Social Media</SelectItem>
                <SelectItem value="flyer">Flyers/Ads</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="image">Images</SelectItem>
                <SelectItem value="video">Videos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Media Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredMedia.map((item) => (
          <Card 
            key={item.id} 
            className="overflow-hidden cursor-pointer hover:ring-2 ring-primary transition-all"
            onClick={() => setSelectedMedia(item)}
          >
            <div className="relative aspect-video bg-muted">
              <div className="absolute inset-0 flex items-center justify-center">
                {item.type === 'video' ? (
                  <Video className="h-10 w-10 text-muted-foreground" />
                ) : (
                  <ImageIcon className="h-10 w-10 text-muted-foreground" />
                )}
              </div>
              <Badge className={`absolute top-2 right-2 ${categoryConfig[item.category].color}`}>
                {item.type === 'video' ? <Video className="h-3 w-3 mr-1" /> : <ImageIcon className="h-3 w-3 mr-1" />}
                {item.type}
              </Badge>
            </div>
            <CardContent className="p-3">
              <p className="font-medium text-sm truncate">{item.name}</p>
              <div className="flex items-center justify-between mt-1">
                <Badge variant="outline" className="text-xs">
                  {categoryConfig[item.category].label}
                </Badge>
                <span className="text-xs text-muted-foreground">{item.fileSize}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredMedia.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">No Media Found</h3>
            <p className="text-muted-foreground">
              {simulationMode ? 'No media matches your filters' : 'Enable Simulation Mode to see demo data'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Media Detail Dialog */}
      <Dialog open={!!selectedMedia} onOpenChange={() => setSelectedMedia(null)}>
        <DialogContent className="max-w-2xl">
          {selectedMedia && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedMedia.name}</DialogTitle>
                <DialogDescription>
                  Uploaded by {selectedMedia.uploadedBy} on {new Date(selectedMedia.uploadedAt).toLocaleDateString()}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                {/* Preview */}
                <div className="relative aspect-video bg-muted rounded-lg flex items-center justify-center">
                  {selectedMedia.type === 'video' ? (
                    <Video className="h-16 w-16 text-muted-foreground" />
                  ) : (
                    <ImageIcon className="h-16 w-16 text-muted-foreground" />
                  )}
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Category</p>
                    <Badge className={categoryConfig[selectedMedia.category].color}>
                      {categoryConfig[selectedMedia.category].label}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Usage Rights</p>
                    <Badge className={rightsConfig[selectedMedia.usageRights].color}>
                      {rightsConfig[selectedMedia.usageRights].label}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">File Size</p>
                    <p className="font-medium">{selectedMedia.fileSize}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {selectedMedia.type === 'video' ? 'Duration' : 'Dimensions'}
                    </p>
                    <p className="font-medium">
                      {selectedMedia.type === 'video' ? selectedMedia.duration : selectedMedia.dimensions}
                    </p>
                  </div>
                </div>

                {selectedMedia.linkedEntity && (
                  <div>
                    <p className="text-sm text-muted-foreground">Linked To</p>
                    <p className="font-medium">
                      {selectedMedia.linkedEntity.type}: {selectedMedia.linkedEntity.name}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => handleDownload(selectedMedia)}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                  <Button variant="outline" className="flex-1">
                    <Eye className="h-4 w-4 mr-2" />
                    Preview
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
