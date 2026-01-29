import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useInfluencerPosts, PostWithMetrics } from "@/hooks/useInfluencerAnalytics";
import { format } from "date-fns";
import { Eye, Heart, MessageCircle, Share2, Bookmark, ExternalLink } from "lucide-react";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";

type DrilldownType = 'exposures' | 'views' | 'likes' | 'comments' | 'shares' | 'saves' | 'posts';

interface InfluencerKPIDrilldownProps {
  influencerId: string;
  type: DrilldownType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const drilldownConfig: Record<DrilldownType, { title: string; icon: any; metricKey: keyof NonNullable<PostWithMetrics['metrics']> | 'all' }> = {
  exposures: { title: 'Exposure Breakdown', icon: Eye, metricKey: 'all' },
  views: { title: 'Views by Post', icon: Eye, metricKey: 'views' },
  likes: { title: 'Likes by Post', icon: Heart, metricKey: 'likes' },
  comments: { title: 'Comments by Post', icon: MessageCircle, metricKey: 'comments' },
  shares: { title: 'Shares by Post', icon: Share2, metricKey: 'shares' },
  saves: { title: 'Saves by Post', icon: Bookmark, metricKey: 'saves' },
  posts: { title: 'All Posts', icon: Eye, metricKey: 'all' },
};

export function InfluencerKPIDrilldown({ 
  influencerId, 
  type, 
  open, 
  onOpenChange 
}: InfluencerKPIDrilldownProps) {
  const { data: posts, isLoading, error } = useInfluencerPosts(influencerId);
  const config = drilldownConfig[type];
  const Icon = config.icon;

  const formatNumber = (num: number | undefined) => {
    if (!num) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Sort posts by the relevant metric
  const sortedPosts = [...(posts || [])].sort((a, b) => {
    if (config.metricKey === 'all') {
      const aTotal = (a.metrics?.views || 0) + (a.metrics?.impressions || 0) + (a.metrics?.reach || 0);
      const bTotal = (b.metrics?.views || 0) + (b.metrics?.impressions || 0) + (b.metrics?.reach || 0);
      return bTotal - aTotal;
    }
    return (b.metrics?.[config.metricKey] || 0) - (a.metrics?.[config.metricKey] || 0);
  });

  // Platform breakdown for exposures
  const platformBreakdown = posts?.reduce((acc, post) => {
    const platform = post.platform || 'unknown';
    if (!acc[platform]) {
      acc[platform] = { views: 0, impressions: 0, reach: 0, count: 0 };
    }
    acc[platform].views += post.metrics?.views || 0;
    acc[platform].impressions += post.metrics?.impressions || 0;
    acc[platform].reach += post.metrics?.reach || 0;
    acc[platform].count += 1;
    return acc;
  }, {} as Record<string, { views: number; impressions: number; reach: number; count: number }>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            {config.title}
          </DialogTitle>
        </DialogHeader>

        {isLoading && <LoadingSkeleton variant="table" count={5} />}

        {error && (
          <div className="text-center py-8 text-destructive">
            Failed to load data. Please try again.
          </div>
        )}

        {!isLoading && !error && (
          <>
            {/* Platform breakdown for exposures */}
            {type === 'exposures' && platformBreakdown && Object.keys(platformBreakdown).length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {Object.entries(platformBreakdown).map(([platform, data]) => (
                  <Card key={platform}>
                    <CardContent className="p-3">
                      <div className="text-sm font-medium capitalize mb-1">{platform}</div>
                      <div className="text-lg font-bold">
                        {formatNumber(data.views + data.impressions + data.reach)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {data.count} posts
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Posts table */}
            {sortedPosts.length === 0 ? (
              <EmptyState 
                title="No data yet" 
                description="Post metrics will appear here once content is tracked."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Platform</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Posted</TableHead>
                    {config.metricKey === 'all' ? (
                      <>
                        <TableHead className="text-right">Views</TableHead>
                        <TableHead className="text-right">Impressions</TableHead>
                        <TableHead className="text-right">Reach</TableHead>
                      </>
                    ) : (
                      <TableHead className="text-right">{config.title.split(' ')[0]}</TableHead>
                    )}
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPosts.map((post) => (
                    <TableRow key={post.id}>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {post.platform || 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell>{post.campaign?.name || 'Untagged'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {post.posted_at 
                          ? format(new Date(post.posted_at), 'MMM d, yyyy')
                          : 'Not posted'
                        }
                      </TableCell>
                      {config.metricKey === 'all' ? (
                        <>
                          <TableCell className="text-right font-medium">
                            {formatNumber(post.metrics?.views)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatNumber(post.metrics?.impressions)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatNumber(post.metrics?.reach)}
                          </TableCell>
                        </>
                      ) : (
                        <TableCell className="text-right font-medium">
                          {formatNumber(post.metrics?.[config.metricKey])}
                        </TableCell>
                      )}
                      <TableCell>
                        {post.url && (
                          <a 
                            href={post.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
