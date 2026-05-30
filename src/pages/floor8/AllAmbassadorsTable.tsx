/**
 * Floor 8 - All Ambassadors Management Table
 * Operational control + filtering + accountability
 * MASTER GENIUS ARCHITECT: Every row is actionable, every metric is clickable
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Search, Download, ChevronRight,
  TrendingUp, TrendingDown, Minus, Phone, MessageSquare,
  MoreHorizontal, Store, DollarSign, ArrowUpDown, Route as RouteIcon
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAdminAmbassadorCommand, type AdminAmbassadorProfile } from '@/hooks/useAdminAmbassadorCommand';
import { formatDistanceToNow } from 'date-fns';
import { RouteAssignmentDialog } from '@/components/delivery/RouteAssignmentDialog';

type SortField = 'name' | 'stores_acquired' | 'revenue_generated' | 'pending_payout' | 'last_activity' | 'tier';
type SortDirection = 'asc' | 'desc';

// Trend Badge Component
function TrendBadge({ trend }: { trend: string }) {
  const config = {
    improving: { icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    stable: { icon: Minus, color: 'text-muted-foreground', bg: 'bg-muted/50' },
    declining: { icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-500/10' },
    new: { icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  }[trend] || { icon: Minus, color: 'text-muted-foreground', bg: 'bg-muted/50' };

  const Icon = config.icon;

  return (
    <Badge variant="outline" className={`${config.bg} ${config.color} border-0`}>
      <Icon className="h-3 w-3 mr-1" />
      {trend}
    </Badge>
  );
}

// Tier Badge Component  
function TierBadge({ tier }: { tier: string }) {
  const tierColors: Record<string, string> = {
    legendary: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    elite: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    rising: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    starter: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <Badge variant="outline" className={tierColors[tier] || tierColors.starter}>
      {tier}
    </Badge>
  );
}

// Status Badge
function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <Badge variant={isActive ? 'default' : 'secondary'}>
      {isActive ? 'Active' : 'Paused'}
    </Badge>
  );
}

export default function AllAmbassadorsTable() {
  const navigate = useNavigate();
  const { ambassadors, isLoading } = useAdminAmbassadorCommand();
  
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [trendFilter, setTrendFilter] = useState<string>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('revenue_generated');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Get unique regions for filter
  const regions = useMemo(() => {
    const states = [...new Set(ambassadors.map(a => a.state).filter(Boolean))];
    return states.sort();
  }, [ambassadors]);

  // Filter and sort ambassadors
  const filteredAmbassadors = useMemo(() => {
    let result = [...ambassadors];

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(a => 
        a.name.toLowerCase().includes(searchLower) ||
        a.city?.toLowerCase().includes(searchLower) ||
        a.tracking_code?.toLowerCase().includes(searchLower)
      );
    }

    // Tier filter
    if (tierFilter !== 'all') {
      result = result.filter(a => a.tier === tierFilter);
    }

    // Trend filter
    if (trendFilter !== 'all') {
      result = result.filter(a => a.trend === trendFilter);
    }

    // Region filter
    if (regionFilter !== 'all') {
      result = result.filter(a => a.state === regionFilter);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'stores_acquired':
          comparison = a.stores_acquired - b.stores_acquired;
          break;
        case 'revenue_generated':
          comparison = a.revenue_generated - b.revenue_generated;
          break;
        case 'pending_payout':
          comparison = a.pending_payout - b.pending_payout;
          break;
        case 'last_activity':
          const aDate = a.last_activity ? new Date(a.last_activity).getTime() : 0;
          const bDate = b.last_activity ? new Date(b.last_activity).getTime() : 0;
          comparison = aDate - bDate;
          break;
        case 'tier':
          const tierOrder = { legendary: 4, elite: 3, rising: 2, starter: 1 };
          comparison = (tierOrder[a.tier as keyof typeof tierOrder] || 0) - (tierOrder[b.tier as keyof typeof tierOrder] || 0);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [ambassadors, search, tierFilter, trendFilter, regionFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleRowClick = (ambassadorId: string) => {
    navigate(`/ambassadors/${ambassadorId}`);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            All Ambassadors
          </h1>
          <p className="text-muted-foreground">
            {filteredAmbassadors.length} of {ambassadors.length} ambassadors
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/ambassadors/command')}>
            Command View
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[250px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, city, or code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Tier Filter */}
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="legendary">Legendary</SelectItem>
                <SelectItem value="elite">Elite</SelectItem>
                <SelectItem value="rising">Rising</SelectItem>
                <SelectItem value="starter">Starter</SelectItem>
              </SelectContent>
            </Select>

            {/* Trend Filter */}
            <Select value={trendFilter} onValueChange={setTrendFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Trend" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Trends</SelectItem>
                <SelectItem value="improving">Improving</SelectItem>
                <SelectItem value="stable">Stable</SelectItem>
                <SelectItem value="declining">Declining</SelectItem>
                <SelectItem value="new">New</SelectItem>
              </SelectContent>
            </Select>

            {/* Region Filter */}
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {regions.map(r => (
                  <SelectItem key={r} value={r!}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-1">
                    Name
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('tier')}>
                  <div className="flex items-center gap-1">
                    Tier
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead>Region</TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort('stores_acquired')}>
                  <div className="flex items-center justify-end gap-1">
                    Stores
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort('revenue_generated')}>
                  <div className="flex items-center justify-end gap-1">
                    Revenue
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort('pending_payout')}>
                  <div className="flex items-center justify-end gap-1">
                    Pending
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('last_activity')}>
                  <div className="flex items-center gap-1">
                    Last Activity
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead>Trend</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAmbassadors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                    No ambassadors found matching your filters
                  </TableCell>
                </TableRow>
              ) : (
                filteredAmbassadors.map((amb) => (
                  <TableRow 
                    key={amb.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(amb.id)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{amb.name}</p>
                        {amb.tracking_code && (
                          <p className="text-xs text-muted-foreground font-mono">
                            {amb.tracking_code}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge isActive={amb.is_active} />
                    </TableCell>
                    <TableCell>
                      <TierBadge tier={amb.tier} />
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {amb.city && amb.state ? `${amb.city}, ${amb.state}` : amb.state || '-'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Store className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{amb.stores_acquired}</span>
                        {amb.active_stores !== amb.stores_acquired && (
                          <span className="text-xs text-muted-foreground">
                            ({amb.active_stores} active)
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium text-emerald-400">
                        ${amb.revenue_generated.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {amb.pending_payout > 0 ? (
                        <span className="font-medium text-amber-400">
                          ${amb.pending_payout.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {amb.last_activity 
                          ? formatDistanceToNow(new Date(amb.last_activity), { addSuffix: true })
                          : 'Never'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <TrendBadge trend={amb.trend} />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/ambassadors/${amb.id}`); }}>
                            <ChevronRight className="h-4 w-4 mr-2" />
                            View Profile
                          </DropdownMenuItem>
                          {amb.phone_primary && (
                            <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                              <Phone className="h-4 w-4 mr-2" />
                              Call
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Message
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/ambassadors/${amb.id}/stores`); }}>
                            <Store className="h-4 w-4 mr-2" />
                            View Stores
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/ambassadors/${amb.id}/payouts`); }}>
                            <DollarSign className="h-4 w-4 mr-2" />
                            View Payouts
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
