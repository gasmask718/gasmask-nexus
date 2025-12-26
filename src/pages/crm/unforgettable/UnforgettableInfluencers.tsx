import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Instagram, Youtube, Music2, Phone, Mail, Plus, Search, ArrowRight, DollarSign, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';

interface Influencer {
  id: string;
  name: string;
  handle: string;
  platform: 'instagram' | 'youtube' | 'tiktok' | 'multiple';
  followers: number;
  engagementRate: number;
  niche: string[];
  commissionEarned: number;
  campaignsCompleted: number;
  status: 'active' | 'pending' | 'inactive';
  phone: string;
  email: string;
}

const SIMULATED_INFLUENCERS: Influencer[] = [
  { id: 'inf-001', name: 'Maria Rodriguez', handle: '@mariasparty', platform: 'instagram', followers: 125000, engagementRate: 4.2, niche: ['Weddings', 'Quinceañeras'], commissionEarned: 8500, campaignsCompleted: 12, status: 'active', phone: '+1 (305) 555-0101', email: 'maria@influencer.com' },
  { id: 'inf-002', name: 'DJ Pulse', handle: '@djpulseofficial', platform: 'multiple', followers: 450000, engagementRate: 3.8, niche: ['Nightlife', 'Events', 'Music'], commissionEarned: 24000, campaignsCompleted: 28, status: 'active', phone: '+1 (212) 555-0202', email: 'booking@djpulse.com' },
  { id: 'inf-003', name: 'Event Queen NYC', handle: '@eventqueennyc', platform: 'youtube', followers: 89000, engagementRate: 5.1, niche: ['Corporate Events', 'Luxury Parties'], commissionEarned: 6200, campaignsCompleted: 8, status: 'active', phone: '+1 (718) 555-0303', email: 'collab@eventqueen.com' },
  { id: 'inf-004', name: 'Party Planner Pro', handle: '@partyplannerpro', platform: 'tiktok', followers: 280000, engagementRate: 6.5, niche: ['DIY Party Ideas', 'Budget Events'], commissionEarned: 3800, campaignsCompleted: 5, status: 'pending', phone: '+1 (404) 555-0404', email: 'pro@partyplanner.com' },
  { id: 'inf-005', name: 'Luxury Life Miami', handle: '@luxurylifemiami', platform: 'instagram', followers: 520000, engagementRate: 3.2, niche: ['Luxury Events', 'Yachts', 'VIP'], commissionEarned: 42000, campaignsCompleted: 35, status: 'active', phone: '+1 (305) 555-0505', email: 'contact@luxurylife.com' },
  { id: 'inf-006', name: 'The Event Guru', handle: '@theeventguru', platform: 'youtube', followers: 156000, engagementRate: 4.8, niche: ['How-To', 'Event Planning Tips'], commissionEarned: 9800, campaignsCompleted: 15, status: 'active', phone: '+1 (713) 555-0606', email: 'guru@events.com' },
];

const platformIcons = {
  instagram: Instagram,
  youtube: Youtube,
  tiktok: Music2,
  multiple: Users
};

export default function UnforgettableInfluencers() {
  const navigate = useNavigate();
  const { simulationMode } = useSimulationMode();
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const influencers = simulationMode ? SIMULATED_INFLUENCERS : [];

  const filteredInfluencers = influencers.filter(inf => {
    const matchesSearch = inf.name.toLowerCase().includes(searchQuery.toLowerCase()) || inf.handle.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPlatform = platformFilter === 'all' || inf.platform === platformFilter;
    const matchesStatus = statusFilter === 'all' || inf.status === statusFilter;
    return matchesSearch && matchesPlatform && matchesStatus;
  });

  const stats = {
    total: influencers.length,
    active: influencers.filter(i => i.status === 'active').length,
    totalReach: influencers.reduce((sum, i) => sum + i.followers, 0),
    totalCommission: influencers.reduce((sum, i) => sum + i.commissionEarned, 0)
  };

  const formatFollowers = (num: number) => num >= 1000000 ? `${(num / 1000000).toFixed(1)}M` : num >= 1000 ? `${(num / 1000).toFixed(0)}K` : num;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" />
            Influencer Partnerships
            {simulationMode && <SimulationBadge />}
          </h1>
          <p className="text-muted-foreground">Manage influencer collaborations and campaigns</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/crm/unforgettable_times_usa')}>← Back to CRM</Button>
          <Button><Plus className="h-4 w-4 mr-2" />Add Influencer</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Influencers</p><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
        <Card className="border-green-500/30"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Active</p><p className="text-2xl font-bold text-green-400">{stats.active}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Reach</p><p className="text-2xl font-bold">{formatFollowers(stats.totalReach)}</p></CardContent></Card>
        <Card className="border-yellow-500/30"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Commission Paid</p><p className="text-2xl font-bold text-yellow-400">${stats.totalCommission.toLocaleString()}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search influencers..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Platform" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="youtube">YouTube</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="multiple">Multiple</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredInfluencers.map(inf => {
          const PlatformIcon = platformIcons[inf.platform];
          return (
            <Card key={inf.id} className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate(`/crm/unforgettable_times_usa/influencers/${inf.id}`)}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{inf.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1"><PlatformIcon className="h-3 w-3" />{inf.handle}</CardDescription>
                  </div>
                  <Badge variant={inf.status === 'active' ? 'default' : 'secondary'}>{inf.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1">
                  {inf.niche.map(n => <Badge key={n} variant="outline" className="text-xs">{n}</Badge>)}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1"><Eye className="h-3 w-3 text-muted-foreground" />{formatFollowers(inf.followers)}</div>
                  <div className="flex items-center gap-1"><span className="text-xs text-muted-foreground">ER:</span>{inf.engagementRate}%</div>
                  <div className="flex items-center gap-1"><DollarSign className="h-3 w-3 text-green-400" />${inf.commissionEarned.toLocaleString()}</div>
                  <div className="flex items-center gap-1"><span className="text-xs text-muted-foreground">{inf.campaignsCompleted} campaigns</span></div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1"><Phone className="h-3 w-3 mr-1" />Call</Button>
                  <Button variant="outline" size="sm" className="flex-1"><Mail className="h-3 w-3 mr-1" />Email</Button>
                  <Button size="sm"><ArrowRight className="h-3 w-3" /></Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredInfluencers.length === 0 && (
        <Card><CardContent className="p-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">No Influencers Found</h3>
          <p className="text-muted-foreground">{simulationMode ? 'No influencers match your filters' : 'Enable Simulation Mode to see demo data'}</p>
        </CardContent></Card>
      )}
    </div>
  );
}
