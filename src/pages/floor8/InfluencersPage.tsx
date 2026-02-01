/**
 * Floor 8 — Influencers
 * Top-of-funnel growth attribution
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { 
  Star, Users, DollarSign, Search, TrendingUp,
  Instagram, Youtube, Music2, Twitter, Globe, Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';

const PLATFORM_ICONS: Record<string, any> = {
  instagram: Instagram,
  youtube: Youtube,
  tiktok: Music2,
  twitter: Twitter,
  other: Globe,
};

export default function InfluencersPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');

  // Fetch all influencers
  const { data: influencers = [], isLoading } = useQuery({
    queryKey: ['floor8-influencers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('influencers')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch campaign participation
  const { data: campaignParticipants = [] } = useQuery({
    queryKey: ['floor8-influencer-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('influencer_campaign_participants')
        .select('influencer_id, campaign_id');
      if (error) throw error;
      return data || [];
    },
  });

  // Enrich influencer data
  const enrichedInfluencers = influencers.map((inf) => {
    const campaignCount = campaignParticipants.filter(p => p.influencer_id === inf.id).length;
    
    return {
      ...inf,
      campaignCount,
      conversionCount: 0,
      revenueAttributed: 0,
    };
  });

  // Filter influencers
  let filteredInfluencers = enrichedInfluencers;
  
  if (searchTerm) {
    filteredInfluencers = filteredInfluencers.filter(inf => 
      inf.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inf.instagram_handle?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }
  
  if (statusFilter !== 'all') {
    filteredInfluencers = filteredInfluencers.filter(inf => inf.status === statusFilter);
  }
  
  if (platformFilter !== 'all') {
    filteredInfluencers = filteredInfluencers.filter(inf => inf.platform === platformFilter);
  }

  // Calculate summary metrics
  const activeInfluencers = influencers.filter(inf => inf.status === 'active').length;
  const totalReach = influencers.reduce((sum, inf) => sum + Number(inf.followers || 0), 0);
  const totalRevenue = enrichedInfluencers.reduce((sum, inf) => sum + inf.revenueAttributed, 0);

  // Get unique platforms
  const platforms = [...new Set(influencers.map(inf => inf.platform).filter(Boolean))];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Star className="h-8 w-8" />
              Influencers
            </h1>
            <p className="text-muted-foreground mt-1">
              Top-of-funnel growth attribution
            </p>
          </div>
          <Button onClick={() => navigate('/influencer-campaigns')}>
            View Campaigns
          </Button>
        </div>

        {/* Summary KPIs */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="text-sm text-muted-foreground">Total Influencers</span>
              </div>
              <div className="text-3xl font-bold mt-2">{influencers.length}</div>
              <p className="text-xs text-muted-foreground">{activeInfluencers} active</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" />
                <span className="text-sm text-muted-foreground">Total Reach</span>
              </div>
              <div className="text-3xl font-bold mt-2">
                {totalReach > 1000000 
                  ? `${(totalReach / 1000000).toFixed(1)}M`
                  : totalReach > 1000
                  ? `${(totalReach / 1000).toFixed(0)}K`
                  : totalReach}
              </div>
              <p className="text-xs text-muted-foreground">combined followers</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span className="text-sm text-muted-foreground">Active Campaigns</span>
              </div>
              <div className="text-3xl font-bold mt-2">
                {[...new Set(campaignParticipants.map(p => p.campaign_id))].length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-500" />
                <span className="text-sm text-muted-foreground">Revenue Attributed</span>
              </div>
              <div className="text-3xl font-bold text-green-500 mt-2">
                ${totalRevenue.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search influencers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="dormant">Dormant</SelectItem>
                </SelectContent>
              </Select>
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  {platforms.map((p) => (
                    <SelectItem key={p} value={p!} className="capitalize">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Influencers Table */}
        <Card>
          <CardHeader>
            <CardTitle>Influencer Directory</CardTitle>
            <CardDescription>Click to view influencer profile</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : filteredInfluencers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Star className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No influencers found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Influencer</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Followers</TableHead>
                    <TableHead>Handle</TableHead>
                    <TableHead>Campaigns</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInfluencers.map((inf) => {
                    const PlatformIcon = PLATFORM_ICONS[inf.platform?.toLowerCase() || 'other'] || Globe;
                    const displayHandle = inf.instagram_handle || inf.tiktok_handle || inf.youtube_handle || '';
                    const followers = inf.followers || 0;
                    
                    return (
                      <TableRow 
                        key={inf.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/influencers/${inf.id}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <Star className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{inf.name}</p>
                              {displayHandle && (
                                <p className="text-xs text-muted-foreground">@{displayHandle}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <PlatformIcon className="h-4 w-4" />
                            <span className="capitalize">{inf.platform || 'N/A'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {followers > 1000000
                            ? `${(followers / 1000000).toFixed(1)}M`
                            : followers > 1000
                            ? `${(followers / 1000).toFixed(0)}K`
                            : followers || 'N/A'}
                        </TableCell>
                        <TableCell>
                          {inf.instagram_handle ? (
                            <Badge variant="outline" className="font-mono">
                              @{inf.instagram_handle}
                            </Badge>
                          ) : 'N/A'}
                        </TableCell>
                        <TableCell>{inf.campaignCount}</TableCell>
                        <TableCell className="font-bold text-green-500">
                          ${inf.revenueAttributed.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              inf.status === 'active' ? 'default' :
                              inf.status === 'paused' ? 'secondary' :
                              'outline'
                            }
                          >
                            {inf.status || 'unknown'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
