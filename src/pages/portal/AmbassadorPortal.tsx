import { Link2, TrendingUp, DollarSign, Share2, Copy, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PortalLayout from '@/components/portal/PortalLayout';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { toast } from 'sonner';

// Mock data
const referralStats = {
  totalReferred: 12,
  activeStores: 8,
  totalSales: 4500,
  pendingPayout: 450,
};

const recentReferrals = [
  { date: '2024-01-15', store: 'New Smoke Shop', status: 'active', commission: '$45' },
  { date: '2024-01-10', store: 'Cloud Nine Vapes', status: 'pending', commission: '$0' },
  { date: '2024-01-05', store: 'Tobacco Plus', status: 'active', commission: '$38' },
];

export default function AmbassadorPortal() {
  const { data: profileData } = useCurrentUserProfile();
  const ambassadorProfile = profileData?.roleProfile as any;
  
  const referralCode = ambassadorProfile?.referral_code || 'AMB-XXXX';
  const referralLink = `https://osdynasty.com/r/${referralCode}`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  return (
    <PortalLayout title="Ambassador Portal">
      <div className="space-y-6">
        {/* Status Banner */}
        {ambassadorProfile?.status === 'pending' && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <p className="text-sm text-yellow-600 dark:text-yellow-400">
              Your ambassador application is under review. You'll be notified once approved.
            </p>
          </div>
        )}

        {/* Referral Code Card */}
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              Your Referral Link
            </CardTitle>
            <CardDescription>Share this link to earn commissions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input value={referralLink} readOnly className="font-mono text-sm" />
              <Button variant="outline" onClick={() => copyToClipboard(referralLink)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Badge variant="secondary" className="text-sm">
                Code: {referralCode}
              </Badge>
              <Badge variant="outline" className="text-sm">
                Commission: {(ambassadorProfile?.commission_rate || 0.1) * 100}%
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1">
                <Share2 className="h-4 w-4 mr-2" />
                Share on Social
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Referred</CardDescription>
              <CardTitle className="text-3xl">{referralStats.totalReferred}</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-sm text-muted-foreground">Stores</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Stores</CardDescription>
              <CardTitle className="text-3xl text-green-500">{referralStats.activeStores}</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-sm text-muted-foreground">Currently ordering</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Sales</CardDescription>
              <CardTitle className="text-3xl">${referralStats.totalSales}</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-sm text-muted-foreground">From referrals</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Payout</CardDescription>
              <CardTitle className="text-3xl text-primary">${referralStats.pendingPayout}</CardTitle>
            </CardHeader>
            <CardContent>
              <Button size="sm" variant="outline">Request Payout</Button>
            </CardContent>
          </Card>
        </div>

        {/* Recent Referrals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Recent Referrals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentReferrals.map((ref, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{ref.date}</TableCell>
                    <TableCell>{ref.store}</TableCell>
                    <TableCell>
                      <Badge variant={ref.status === 'active' ? 'default' : 'secondary'}>
                        {ref.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{ref.commission}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Promo Materials */}
        <Card>
          <CardHeader>
            <CardTitle>Promo Materials</CardTitle>
            <CardDescription>Download assets to promote your referral link</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="p-4 rounded-lg border text-center">
                <div className="w-full h-24 bg-muted rounded mb-2 flex items-center justify-center">
                  <span className="text-muted-foreground text-sm">QR Code</span>
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  Download QR
                </Button>
              </div>
              <div className="p-4 rounded-lg border text-center">
                <div className="w-full h-24 bg-muted rounded mb-2 flex items-center justify-center">
                  <span className="text-muted-foreground text-sm">Banner</span>
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  Download Banner
                </Button>
              </div>
              <div className="p-4 rounded-lg border text-center">
                <div className="w-full h-24 bg-muted rounded mb-2 flex items-center justify-center">
                  <span className="text-muted-foreground text-sm">Flyer</span>
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  Download Flyer
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}
