import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useInfluencerSocialAccounts } from "@/hooks/useInfluencerAnalytics";
import { 
  Instagram, 
  Youtube, 
  Facebook, 
  Twitter, 
  ExternalLink,
  Plus,
  Edit2,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Link2
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { cn } from "@/lib/utils";

interface SocialIdentitySectionProps {
  influencerId: string;
  isEditable?: boolean;
}

const platformConfig: Record<string, { 
  icon: any; 
  label: string; 
  color: string;
  urlPrefix: string;
  placeholder: string;
}> = {
  instagram: { 
    icon: Instagram, 
    label: 'Instagram', 
    color: 'bg-gradient-to-r from-purple-500 to-pink-500',
    urlPrefix: 'https://instagram.com/',
    placeholder: '@username'
  },
  tiktok: { 
    icon: () => (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
      </svg>
    ), 
    label: 'TikTok', 
    color: 'bg-black',
    urlPrefix: 'https://tiktok.com/@',
    placeholder: '@username'
  },
  youtube: { 
    icon: Youtube, 
    label: 'YouTube', 
    color: 'bg-red-600',
    urlPrefix: 'https://youtube.com/@',
    placeholder: '@channel or URL'
  },
  twitter: { 
    icon: Twitter, 
    label: 'X / Twitter', 
    color: 'bg-sky-500',
    urlPrefix: 'https://x.com/',
    placeholder: '@username'
  },
  facebook: { 
    icon: Facebook, 
    label: 'Facebook', 
    color: 'bg-blue-600',
    urlPrefix: 'https://facebook.com/',
    placeholder: 'Page URL or username'
  },
};

interface SocialHandles {
  instagram_handle?: string | null;
  tiktok_handle?: string | null;
  youtube_handle?: string | null;
  twitter_handle?: string | null;
  facebook_handle?: string | null;
}

export function SocialIdentitySection({ influencerId, isEditable = true }: SocialIdentitySectionProps) {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [formData, setFormData] = useState<SocialHandles>({});
  const [saving, setSaving] = useState(false);

  // Fetch influencer base data for social handles
  const { data: influencer, isLoading: influencerLoading } = useQuery({
    queryKey: ['influencer-social-identity', influencerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('influencers')
        .select('id, name, instagram_handle, tiktok_handle, youtube_handle, twitter_handle, facebook_handle, username, platform')
        .eq('id', influencerId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Fetch connected social accounts (for analytics sync status)
  const { data: connectedAccounts, isLoading: accountsLoading } = useInfluencerSocialAccounts(influencerId);

  const isLoading = influencerLoading || accountsLoading;

  // Calculate total followers
  const totalFollowers = connectedAccounts?.reduce((sum, acc) => sum + (acc.follower_count || 0), 0) || 0;

  const formatFollowers = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const openEditDialog = () => {
    setFormData({
      instagram_handle: influencer?.instagram_handle || '',
      tiktok_handle: influencer?.tiktok_handle || '',
      youtube_handle: influencer?.youtube_handle || '',
      twitter_handle: influencer?.twitter_handle || '',
      facebook_handle: influencer?.facebook_handle || '',
    });
    setEditOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('influencers')
        .update({
          instagram_handle: formData.instagram_handle || null,
          tiktok_handle: formData.tiktok_handle || null,
          youtube_handle: formData.youtube_handle || null,
          twitter_handle: formData.twitter_handle || null,
          facebook_handle: formData.facebook_handle || null,
        })
        .eq('id', influencerId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['influencer-social-identity', influencerId] });
      toast.success('Social accounts updated');
      setEditOpen(false);
    } catch (error) {
      console.error('Error updating social accounts:', error);
      toast.error('Failed to update social accounts');
    } finally {
      setSaving(false);
    }
  };

  // Build platform list with data
  const platforms = Object.entries(platformConfig).map(([key, config]) => {
    const handleKey = `${key}_handle` as keyof SocialHandles;
    const handle = influencer?.[handleKey as keyof typeof influencer];
    const connectedAccount = connectedAccounts?.find(a => a.platform === key);

    return {
      key,
      ...config,
      handle: handle as string | null,
      connected: !!connectedAccount,
      verified: connectedAccount?.verified || false,
      followers: connectedAccount?.follower_count || 0,
      profileUrl: connectedAccount?.profile_url || (handle ? `${config.urlPrefix}${handle.replace('@', '')}` : null),
    };
  });

  const configuredPlatforms = platforms.filter(p => p.handle || p.connected);
  const platformsWithData = configuredPlatforms.length;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Social Identity</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingSkeleton variant="list" count={4} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Social Identity
          </CardTitle>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {formatFollowers(totalFollowers)} total audience
            </span>
            <Badge variant="outline">
              {platformsWithData} of {Object.keys(platformConfig).length} platforms
            </Badge>
          </div>
        </div>
        {isEditable && (
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" onClick={openEditDialog}>
                <Edit2 className="h-4 w-4 mr-2" />
                Edit Accounts
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Edit Social Accounts</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {Object.entries(platformConfig).map(([key, config]) => {
                  const handleKey = `${key}_handle` as keyof SocialHandles;
                  const Icon = config.icon;
                  
                  return (
                    <div key={key} className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <div className={cn("p-1.5 rounded text-white", config.color)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        {config.label}
                      </Label>
                      <Input
                        placeholder={config.placeholder}
                        value={formData[handleKey] || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          [handleKey]: e.target.value
                        }))}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {platformsWithData === 0 ? (
          <EmptyState
            icon={Link2}
            title="No social accounts configured"
            description="Add social media handles to track this influencer across platforms."
            actionLabel={isEditable ? "Add Accounts" : undefined}
            onAction={isEditable ? openEditDialog : undefined}
          />
        ) : (
          <div className="space-y-3">
            {platforms.map((platform) => {
              if (!platform.handle && !platform.connected) return null;
              
              const Icon = platform.icon;
              
              return (
                <div
                  key={platform.key}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg text-white", platform.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {platform.handle || 'Connected'}
                        </span>
                        {platform.verified && (
                          <CheckCircle2 className="h-4 w-4 text-blue-500" />
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        {platform.followers > 0 && (
                          <span>{formatFollowers(platform.followers)} followers</span>
                        )}
                        {platform.profileUrl && (
                          <a
                            href={platform.profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-3 w-3" />
                            View Profile
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    {platform.connected ? (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Analytics Synced
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Manual Entry
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
