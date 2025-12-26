import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ImageIcon, Video, Download, Eye, ArrowLeft, Calendar, User, 
  Tag, Link as LinkIcon, Edit, Trash2
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { useToast } from '@/hooks/use-toast';

interface MediaAsset {
  id: string;
  type: 'image' | 'video';
  name: string;
  description: string;
  url: string;
  thumbnail: string;
  category: 'promo' | 'event' | 'influencer' | 'social' | 'flyer';
  linkedEntity?: { type: string; name: string; id: string };
  linkedCampaigns: string[];
  usageRights: 'internal' | 'promo' | 'full';
  uploadedBy: string;
  uploadedAt: string;
  fileSize: string;
  dimensions?: string;
  duration?: string;
  tags: string[];
}

const SIMULATED_MEDIA: MediaAsset = {
  id: 'media-001',
  type: 'video',
  name: 'NYE Gala 2023 Highlight Reel',
  description: 'Professional highlight reel from the New Year\'s Eve Gala 2023 at Grand Ballroom NYC. Features key moments, guest interviews, and venue showcase.',
  url: '/placeholder.svg',
  thumbnail: '/placeholder.svg',
  category: 'promo',
  linkedEntity: { type: 'event', name: 'New Year\'s Eve Gala', id: 'event-001' },
  linkedCampaigns: ['Q1 Social Media Push', 'NYC Venue Outreach'],
  usageRights: 'promo',
  uploadedBy: 'Marketing Team',
  uploadedAt: '2024-01-02T10:00:00Z',
  fileSize: '145 MB',
  duration: '2:34',
  tags: ['NYE', 'gala', 'highlight', 'promo', '2023']
};

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

export default function UnforgettableMediaDetail() {
  const { mediaId } = useParams<{ mediaId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { simulationMode } = useSimulationMode();

  const media = simulationMode ? SIMULATED_MEDIA : null;

  const handleDownload = () => {
    toast({
      title: 'Download Started',
      description: `Downloading ${media?.name}...`
    });
  };

  if (!media) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">Media Not Found</h3>
            <p className="text-muted-foreground mb-4">
              {simulationMode ? 'This media asset does not exist' : 'Enable Simulation Mode to see demo data'}
            </p>
            <Button onClick={() => navigate('/os/unforgettable/media')}>
              ← Back to Media Vault
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="sm" onClick={() => navigate('/os/unforgettable/media')}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Media Vault
            </Button>
          </div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            {media.type === 'video' ? (
              <Video className="h-8 w-8 text-purple-400" />
            ) : (
              <ImageIcon className="h-8 w-8 text-blue-400" />
            )}
            {media.name}
            {simulationMode && <SimulationBadge />}
          </h1>
          <p className="text-muted-foreground">{media.description}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Preview */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-0">
              <div className="relative aspect-video bg-muted rounded-t-lg flex items-center justify-center">
                {media.type === 'video' ? (
                  <Video className="h-20 w-20 text-muted-foreground" />
                ) : (
                  <ImageIcon className="h-20 w-20 text-muted-foreground" />
                )}
              </div>
              <div className="p-4 flex gap-2">
                <Button className="flex-1">
                  <Eye className="h-4 w-4 mr-2" />
                  Full Preview
                </Button>
                <Button variant="outline" className="flex-1" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Details */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Category</p>
                <Badge className={categoryConfig[media.category].color}>
                  {categoryConfig[media.category].label}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Usage Rights</p>
                <Badge className={rightsConfig[media.usageRights].color}>
                  {rightsConfig[media.usageRights].label}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">File Size</p>
                <p className="font-medium">{media.fileSize}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {media.type === 'video' ? 'Duration' : 'Dimensions'}
                </p>
                <p className="font-medium">
                  {media.type === 'video' ? media.duration : media.dimensions}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Uploaded By</p>
                <p className="font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {media.uploadedBy}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Upload Date</p>
                <p className="font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {new Date(media.uploadedAt).toLocaleDateString()}
                </p>
              </div>
            </CardContent>
          </Card>

          {media.linkedEntity && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LinkIcon className="h-4 w-4" />
                  Linked Entity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="outline">{media.linkedEntity.type}</Badge>
                <p className="font-medium mt-1">{media.linkedEntity.name}</p>
              </CardContent>
            </Card>
          )}

          {media.linkedCampaigns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Used In Campaigns</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {media.linkedCampaigns.map((campaign, idx) => (
                    <Badge key={idx} variant="outline" className="mr-2">
                      {campaign}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Tags
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {media.tags.map((tag, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    #{tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
