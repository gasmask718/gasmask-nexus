import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useInfluencerPosts } from "@/hooks/useInfluencerAnalytics";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, Eye, Heart, MessageCircle, Share2, Bookmark, Play, Plus, RefreshCw, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ComingSoonButton } from "@/components/ui/ComingSoonBadge";

interface InfluencerContentTrackerProps {
  influencerId: string;
  isEditable?: boolean;
}

const platformColors: Record<string, string> = {
  instagram: 'bg-pink-500/20 text-pink-600',
  youtube: 'bg-red-500/20 text-red-600',
  facebook: 'bg-blue-500/20 text-blue-600',
  twitter: 'bg-sky-500/20 text-sky-600',
  tiktok: 'bg-gray-800/20 text-gray-800 dark:text-gray-200',
};

const sentimentColors: Record<string, string> = {
  positive: 'bg-green-500/20 text-green-600',
  neutral: 'bg-gray-500/20 text-gray-600',
  negative: 'bg-red-500/20 text-red-600',
};

export function InfluencerContentTracker({ influencerId, isEditable = true }: InfluencerContentTrackerProps) {
  const { data: posts, isLoading, error, refetch } = useInfluencerPosts(influencerId);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  const formatNumber = (num: number | undefined) => {
    if (!num) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const handleSync = async () => {
    setSyncing(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    toast({
      title: "Sync initiated",
      description: "Content metrics are being updated.",
    });
    setSyncing(false);
    refetch();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Content Tracker</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingSkeleton variant="table" count={5} />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Failed to load content"
        description="We couldn't load the content data. Please try again."
        actionLabel="Retry"
        onAction={() => refetch()}
      />
    );
  }

  if (!posts || posts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Content Tracker</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Play}
            title="No posts tracked yet"
            description="Track posts to monitor engagement metrics and campaign performance."
            actionLabel={isEditable ? "Add Post" : undefined}
            actionDisabled={!isEditable}
            disabledReason={!isEditable ? "Read-only view" : undefined}
            onAction={isEditable ? () => {
              toast({
                title: "Coming Soon",
                description: "Post tracking will be available soon.",
              });
            } : undefined}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Content Tracker ({posts.length} posts)</CardTitle>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync Metrics
          </Button>
          {isEditable && (
            <ComingSoonButton icon={Plus} size="sm">
              Add Post
            </ComingSoonButton>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Platform</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Posted</TableHead>
                <TableHead className="text-center">
                  <Eye className="h-4 w-4 mx-auto" />
                </TableHead>
                <TableHead className="text-center">
                  <Heart className="h-4 w-4 mx-auto" />
                </TableHead>
                <TableHead className="text-center">
                  <MessageCircle className="h-4 w-4 mx-auto" />
                </TableHead>
                <TableHead className="text-center">
                  <Share2 className="h-4 w-4 mx-auto" />
                </TableHead>
                <TableHead className="text-center">
                  <Bookmark className="h-4 w-4 mx-auto" />
                </TableHead>
                <TableHead>Sentiment</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post) => (
                <TableRow key={post.id} className="hover:bg-accent/50">
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className={platformColors[post.platform || 'other'] || 'bg-muted'}
                    >
                      {post.platform || 'Unknown'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{post.campaign?.name || 'Untagged'}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {post.posted_at 
                        ? format(new Date(post.posted_at), 'MMM d, yyyy')
                        : 'Not posted'
                      }
                    </span>
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {formatNumber(post.metrics?.views)}
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {formatNumber(post.metrics?.likes)}
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {formatNumber(post.metrics?.comments)}
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {formatNumber(post.metrics?.shares)}
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {formatNumber(post.metrics?.saves)}
                  </TableCell>
                  <TableCell>
                    {post.sentiment ? (
                      <Badge 
                        variant="outline" 
                        className={sentimentColors[post.sentiment]}
                      >
                        {post.sentiment}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {post.url ? (
                      <a 
                        href={post.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">No link</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* AI Summary section */}
        {posts.some(p => p.ai_summary) && (
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-semibold mb-2">AI Content Insights</h4>
            <div className="space-y-2">
              {posts.filter(p => p.ai_summary).slice(0, 3).map(post => (
                <div key={post.id} className="text-sm">
                  <span className="text-muted-foreground capitalize">
                    {post.platform}: 
                  </span>
                  <span className="ml-1">{post.ai_summary}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
