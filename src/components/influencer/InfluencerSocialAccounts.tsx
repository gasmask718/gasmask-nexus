import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useInfluencerSocialAccounts } from "@/hooks/useInfluencerAnalytics";
import { useToast } from "@/hooks/use-toast";
import { 
  Instagram, 
  Youtube, 
  Facebook, 
  Twitter, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  Plus,
  Loader2
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ComingSoonButton } from "@/components/ui/ComingSoonBadge";

interface InfluencerSocialAccountsProps {
  influencerId: string;
  isEditable?: boolean;
}

const platformIcons: Record<string, any> = {
  instagram: Instagram,
  youtube: Youtube,
  facebook: Facebook,
  twitter: Twitter,
  tiktok: () => (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
    </svg>
  ),
};

const platformColors: Record<string, string> = {
  instagram: 'bg-gradient-to-r from-purple-500 to-pink-500',
  youtube: 'bg-red-600',
  facebook: 'bg-blue-600',
  twitter: 'bg-sky-500',
  tiktok: 'bg-black',
  other: 'bg-gray-500',
};

export function InfluencerSocialAccounts({ influencerId, isEditable = true }: InfluencerSocialAccountsProps) {
  const { data: accounts, isLoading, error, refetch } = useInfluencerSocialAccounts(influencerId);
  const [syncingAccount, setSyncingAccount] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const { toast } = useToast();

  const formatFollowers = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const handleSyncAccount = async (accountId: string) => {
    setSyncingAccount(accountId);
    // TODO: Implement actual sync via edge function
    await new Promise(resolve => setTimeout(resolve, 1500));
    toast({
      title: "Sync initiated",
      description: "Account sync has been queued. Metrics will update shortly.",
    });
    setSyncingAccount(null);
    refetch();
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    // TODO: Implement actual sync all via edge function
    await new Promise(resolve => setTimeout(resolve, 2000));
    toast({
      title: "Sync initiated",
      description: "All accounts have been queued for sync.",
    });
    setSyncingAll(false);
    refetch();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Social Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingSkeleton variant="list" count={3} />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Failed to load accounts"
        description="We couldn't load the social accounts. Please try again."
        actionLabel="Retry"
        onAction={() => refetch()}
      />
    );
  }

  if (!accounts || accounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Social Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Instagram}
            title="No social accounts connected"
            description="Connect social media accounts to track analytics and engagement metrics."
            actionLabel={isEditable ? "Connect Account" : undefined}
            actionDisabled={!isEditable}
            disabledReason={!isEditable ? "Read-only view" : undefined}
            onAction={isEditable ? () => {
              toast({
                title: "Coming Soon",
                description: "Social account connection will be available soon.",
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
        <CardTitle className="text-lg">Social Accounts ({accounts.length})</CardTitle>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSyncAll}
            disabled={syncingAll}
          >
            {syncingAll ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync All
          </Button>
          {isEditable && (
            <ComingSoonButton icon={Plus} size="sm">
              Add Account
            </ComingSoonButton>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {accounts.map((account) => {
          const Icon = platformIcons[account.platform] || ExternalLink;
          const colorClass = platformColors[account.platform] || platformColors.other;
          const isSyncing = syncingAccount === account.id;

          return (
            <div 
              key={account.id} 
              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg text-white ${colorClass}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">@{account.handle}</span>
                    {account.verified && (
                      <CheckCircle2 className="h-4 w-4 text-blue-500" />
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <span>{formatFollowers(account.follower_count)} followers</span>
                    {account.profile_url && (
                      <a 
                        href={account.profile_url} 
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

              <div className="flex items-center gap-3">
                <div className="text-right text-sm">
                  {account.connection_status === 'connected' ? (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  ) : account.connection_status === 'needs_reconnect' ? (
                    <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Reconnect
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-red-600 border-red-600">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Disconnected
                    </Badge>
                  )}
                  {account.last_synced_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Synced {formatDistanceToNow(new Date(account.last_synced_at), { addSuffix: true })}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleSyncAccount(account.id)}
                  disabled={isSyncing}
                >
                  {isSyncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
