import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useInfluencerSocialAccounts } from "@/hooks/useInfluencerAnalytics";
import { 
  Instagram, 
  Youtube, 
  Facebook, 
  Twitter, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface InfluencerSocialAccountsProps {
  influencerId: string;
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

export function InfluencerSocialAccounts({ influencerId }: InfluencerSocialAccountsProps) {
  const { data: accounts, isLoading } = useInfluencerSocialAccounts(influencerId);

  const formatFollowers = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Social Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!accounts || accounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Social Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>No social accounts connected</p>
            <Button variant="outline" size="sm" className="mt-4">
              Connect Account
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Social Accounts</CardTitle>
        <Button variant="ghost" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Sync All
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {accounts.map((account) => {
          const Icon = platformIcons[account.platform] || ExternalLink;
          const colorClass = platformColors[account.platform] || platformColors.other;

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
                        className="text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
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
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
