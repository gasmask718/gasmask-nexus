import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Image, Video, FileText, Download, Plus, Search, Eye, Calendar, Tag, FolderOpen, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';

interface MediaAsset {
  id: string;
  name: string;
  type: 'video' | 'image' | 'document';
  folder: string;
  size: string;
  uploadedAt: string;
  uploadedBy: string;
  linkedCampaign?: string;
  usageRights: 'owned' | 'licensed' | 'partner';
  tags: string[];
  thumbnail?: string;
}

const SIMULATED_ASSETS: MediaAsset[] = [
  { id: 'asset-001', name: 'Summer Party Highlights 2024', type: 'video', folder: 'Event Highlights', size: '245 MB', uploadedAt: '2024-01-15', uploadedBy: 'Maria S.', linkedCampaign: 'Summer Promo', usageRights: 'owned', tags: ['Party', 'Summer', 'Highlight Reel'] },
  { id: 'asset-002', name: 'Wedding Decor Showcase', type: 'video', folder: 'Promo Videos', size: '180 MB', uploadedAt: '2024-01-10', uploadedBy: 'James W.', usageRights: 'owned', tags: ['Wedding', 'Decor', 'Showcase'] },
  { id: 'asset-003', name: 'Quinceañera Gallery - Garcia', type: 'image', folder: 'Event Highlights', size: '45 MB', uploadedAt: '2024-01-08', uploadedBy: 'Lisa C.', usageRights: 'partner', tags: ['Quinceañera', 'Gallery', 'Client'] },
  { id: 'asset-004', name: 'Corporate Event B-Roll', type: 'video', folder: 'Event Highlights', size: '320 MB', uploadedAt: '2024-01-05', uploadedBy: 'Robert J.', linkedCampaign: 'Corporate Package', usageRights: 'owned', tags: ['Corporate', 'B-Roll', 'Professional'] },
  { id: 'asset-005', name: 'Instagram Story Templates', type: 'image', folder: 'Social Media Clips', size: '12 MB', uploadedAt: '2024-01-03', uploadedBy: 'Maria S.', usageRights: 'owned', tags: ['Instagram', 'Template', 'Social'] },
  { id: 'asset-006', name: 'DJ Pulse Promo Clip', type: 'video', folder: 'Influencer Content', size: '85 MB', uploadedAt: '2024-01-02', uploadedBy: 'Amanda T.', linkedCampaign: 'Influencer Collab', usageRights: 'licensed', tags: ['DJ', 'Influencer', 'Promo'] },
  { id: 'asset-007', name: 'Event Flyer Templates', type: 'image', folder: 'Flyers / Ads', size: '28 MB', uploadedAt: '2023-12-28', uploadedBy: 'James W.', usageRights: 'owned', tags: ['Flyer', 'Template', 'Print'] },
  { id: 'asset-008', name: 'Venue Partnership Contract', type: 'document', folder: 'Documents', size: '2.4 MB', uploadedAt: '2023-12-20', uploadedBy: 'Lisa C.', usageRights: 'owned', tags: ['Contract', 'Legal', 'Venue'] },
  { id: 'asset-009', name: 'TikTok Montage - Best Moments', type: 'video', folder: 'Social Media Clips', size: '156 MB', uploadedAt: '2023-12-15', uploadedBy: 'Maria S.', linkedCampaign: 'TikTok Push', usageRights: 'owned', tags: ['TikTok', 'Montage', 'Viral'] },
  { id: 'asset-010', name: 'Luxury Event Branding Pack', type: 'image', folder: 'Flyers / Ads', size: '65 MB', uploadedAt: '2023-12-10', uploadedBy: 'Amanda T.', usageRights: 'owned', tags: ['Branding', 'Luxury', 'Design'] },
];

const FOLDERS = ['All', 'Promo Videos', 'Event Highlights', 'Influencer Content', 'Social Media Clips', 'Flyers / Ads', 'Documents'];

export default function UnforgettableMediaVault() {
  const navigate = useNavigate();
  const { simulationMode } = useSimulationMode();
  const [searchQuery, setSearchQuery] = useState('');
  const [folderFilter, setFolderFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('all');

  const assets = simulationMode ? SIMULATED_ASSETS : [];

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchQuery.toLowerCase()) || asset.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesFolder = folderFilter === 'All' || asset.folder === folderFilter;
    const matchesType = typeFilter === 'all' || asset.type === typeFilter;
    return matchesSearch && matchesFolder && matchesType;
  });

  const stats = {
    total: assets.length,
    videos: assets.filter(a => a.type === 'video').length,
    images: assets.filter(a => a.type === 'image').length,
    documents: assets.filter(a => a.type === 'document').length
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return <Video className="h-8 w-8 text-blue-400" />;
      case 'image': return <Image className="h-8 w-8 text-green-400" />;
      case 'document': return <FileText className="h-8 w-8 text-yellow-400" />;
      default: return <FileText className="h-8 w-8" />;
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FolderOpen className="h-8 w-8 text-primary" />
            Media Vault
            {simulationMode && <SimulationBadge />}
          </h1>
          <p className="text-muted-foreground">Promo content, event highlights, and marketing assets</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/crm/unforgettable_times_usa')}>← Back to CRM</Button>
          <Button><Upload className="h-4 w-4 mr-2" />Upload</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="flex justify-between"><div><p className="text-sm text-muted-foreground">Total Assets</p><p className="text-2xl font-bold">{stats.total}</p></div><FolderOpen className="h-6 w-6 text-muted-foreground" /></div></CardContent></Card>
        <Card className="border-blue-500/30"><CardContent className="p-4"><div className="flex justify-between"><div><p className="text-sm text-muted-foreground">Videos</p><p className="text-2xl font-bold text-blue-400">{stats.videos}</p></div><Video className="h-6 w-6 text-blue-400" /></div></CardContent></Card>
        <Card className="border-green-500/30"><CardContent className="p-4"><div className="flex justify-between"><div><p className="text-sm text-muted-foreground">Images</p><p className="text-2xl font-bold text-green-400">{stats.images}</p></div><Image className="h-6 w-6 text-green-400" /></div></CardContent></Card>
        <Card className="border-yellow-500/30"><CardContent className="p-4"><div className="flex justify-between"><div><p className="text-sm text-muted-foreground">Documents</p><p className="text-2xl font-bold text-yellow-400">{stats.documents}</p></div><FileText className="h-6 w-6 text-yellow-400" /></div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search assets or tags..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <Select value={folderFilter} onValueChange={setFolderFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>{FOLDERS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="video">Videos</SelectItem>
                <SelectItem value="image">Images</SelectItem>
                <SelectItem value="document">Documents</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredAssets.map(asset => (
          <Card key={asset.id} className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate(`/crm/unforgettable_times_usa/media/${asset.id}`)}>
            <CardContent className="p-4">
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center mb-3">
                {getTypeIcon(asset.type)}
              </div>
              <h3 className="font-medium text-sm line-clamp-2 mb-2">{asset.name}</h3>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                <span className="flex items-center gap-1"><FolderOpen className="h-3 w-3" />{asset.folder}</span>
                <span>{asset.size}</span>
              </div>
              <div className="flex flex-wrap gap-1 mb-3">
                {asset.tags.slice(0, 2).map(tag => <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>)}
              </div>
              <div className="flex items-center justify-between">
                <Badge variant={asset.usageRights === 'owned' ? 'default' : 'secondary'} className="text-xs">{asset.usageRights}</Badge>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7"><Download className="h-3 w-3" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredAssets.length === 0 && (
        <Card><CardContent className="p-12 text-center">
          <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">No Assets Found</h3>
          <p className="text-muted-foreground mb-4">{simulationMode ? 'No assets match your filters' : 'Enable Simulation Mode to see demo data'}</p>
          <Button><Upload className="h-4 w-4 mr-2" />Upload First Asset</Button>
        </CardContent></Card>
      )}
    </div>
  );
}
