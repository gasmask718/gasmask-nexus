/**
 * TopTier Campaigns List - Marketing campaigns and promos
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ArrowLeft, Search, Eye, Plus, Megaphone, DollarSign, 
  Users, Calendar, TrendingUp, Target
} from 'lucide-react';
import { TOPTIER_PARTNER_CATEGORIES } from '@/config/crmBlueprints';
import { useSimulationMode, SimulationBadge } from '@/contexts/SimulationModeContext';
import { format } from 'date-fns';

// Generate simulated campaigns
const generateSimulatedCampaigns = () => {
  const names = [
    'Summer Yacht Special', 'VIP Helicopter Tour', 'Luxury Car Weekend',
    'Miami Club Package', 'Vegas Experience Bundle', 'Private Chef Promo',
    'Security Detail Offer', 'Rooftop Event Special', 'NYC Party Package'
  ];
  const categories = ['yachts', 'helicopter_promo', 'exotic_rental_car_promo', 'club_lounge_package', 'private_chef_promo', 'security_promo'];
  const statuses = ['draft', 'active', 'paused', 'completed'];

  return names.map((name, i) => ({
    id: `campaign_${i + 1}`,
    name,
    category: categories[i % categories.length],
    status: statuses[i % statuses.length],
    start_date: new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000).toISOString(),
    end_date: new Date(Date.now() + (30 - i * 3) * 24 * 60 * 60 * 1000).toISOString(),
    budget: Math.floor(Math.random() * 10000) + 2000,
    spent: Math.floor(Math.random() * 5000) + 500,
    leads_generated: Math.floor(Math.random() * 50) + 5,
    conversions: Math.floor(Math.random() * 15) + 1,
    revenue_generated: Math.floor(Math.random() * 50000) + 5000,
    linked_partners: Math.floor(Math.random() * 5) + 1,
    linked_influencers: Math.floor(Math.random() * 3),
    created_at: new Date(Date.now() - i * 10 * 24 * 60 * 60 * 1000).toISOString(),
  }));
};

export default function TopTierCampaigns() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { simulationMode } = useSimulationMode();
  const campaigns = useMemo(() => generateSimulatedCampaigns(), []);
  const isSimulated = simulationMode;

  // Filter campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((campaign) => {
      const matchesSearch = searchTerm === '' ||
        campaign.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || campaign.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [campaigns, searchTerm, categoryFilter, statusFilter]);

  // Stats
  const stats = useMemo(() => ({
    total: filteredCampaigns.length,
    active: filteredCampaigns.filter(c => c.status === 'active').length,
    totalBudget: filteredCampaigns.reduce((sum, c) => sum + c.budget, 0),
    totalSpent: filteredCampaigns.reduce((sum, c) => sum + c.spent, 0),
    totalLeads: filteredCampaigns.reduce((sum, c) => sum + c.leads_generated, 0),
    totalRevenue: filteredCampaigns.reduce((sum, c) => sum + c.revenue_generated, 0),
  }), [filteredCampaigns]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-500/10 text-gray-600',
      active: 'bg-green-500/10 text-green-600',
      paused: 'bg-yellow-500/10 text-yellow-600',
      completed: 'bg-blue-500/10 text-blue-600',
    };
    return <Badge className={styles[status] || 'bg-muted'}>{status}</Badge>;
  };

  const getCategoryLabel = (value: string) => {
    return TOPTIER_PARTNER_CATEGORIES.find(c => c.value === value)?.label || value;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-fit"
          onClick={() => navigate('/crm/toptier-experience/partners')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Campaigns & Promos</h1>
              {isSimulated && <SimulationBadge />}
            </div>
            <p className="text-muted-foreground">Manage marketing campaigns and promotions</p>
          </div>
          <Button onClick={() => navigate('/crm/toptier-experience/campaigns/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Create Campaign
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Campaigns</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Active</p>
            <p className="text-2xl font-bold text-green-600">{stats.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Budget</p>
            <p className="text-2xl font-bold">${(stats.totalBudget / 1000).toFixed(0)}k</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Spent</p>
            <p className="text-2xl font-bold">${(stats.totalSpent / 1000).toFixed(0)}k</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Leads</p>
            <p className="text-2xl font-bold">{stats.totalLeads}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Revenue</p>
            <p className="text-2xl font-bold text-emerald-600">${(stats.totalRevenue / 1000).toFixed(0)}k</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {TOPTIER_PARTNER_CATEGORIES.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Campaigns Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            Campaigns ({filteredCampaigns.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredCampaigns.length === 0 ? (
            <div className="text-center py-12">
              <Megaphone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No campaigns found</h3>
              <p className="text-muted-foreground mb-4">Create your first campaign to get started</p>
              <Button onClick={() => navigate('/crm/toptier-experience/campaigns/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Campaign
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Campaign</th>
                    <th className="text-left py-3 px-4 font-medium">Category</th>
                    <th className="text-left py-3 px-4 font-medium">Duration</th>
                    <th className="text-right py-3 px-4 font-medium">Budget</th>
                    <th className="text-right py-3 px-4 font-medium">Leads</th>
                    <th className="text-right py-3 px-4 font-medium">Revenue</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-right py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCampaigns.map((campaign) => (
                    <tr 
                      key={campaign.id} 
                      className="border-b hover:bg-muted/50 cursor-pointer"
                      onClick={() => navigate(`/crm/toptier-experience/campaigns/${campaign.id}`)}
                    >
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium">{campaign.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {campaign.linked_partners} partners, {campaign.linked_influencers} influencers
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-xs">
                          {getCategoryLabel(campaign.category)}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm">
                        {format(new Date(campaign.start_date), 'MMM d')} - {format(new Date(campaign.end_date), 'MMM d')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div>
                          <p className="font-medium">${campaign.budget.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">${campaign.spent.toLocaleString()} spent</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-medium">
                        {campaign.leads_generated}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-green-600">
                        ${campaign.revenue_generated.toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(campaign.status)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/crm/toptier-experience/campaigns/${campaign.id}`);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
