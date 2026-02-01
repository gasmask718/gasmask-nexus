/**
 * WORKER INTELLIGENCE TABLE
 * 
 * Sortable management view with columns:
 * - Worker name, Speed score, Quality score, Consistency score
 * - Predictability, Boxes/hour, Avg defect rate, Last active date
 * 
 * Filters:
 * - High performers
 * - Training-needed
 * - Risk (low predictability + high defects)
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  Star,
  GraduationCap,
  AlertTriangle,
  Users,
  Filter,
  Gauge,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WorkerSkillProfile } from '@/hooks/useWorkerPerformance';
import { ExportButton } from '@/components/crud/ExportButton';

interface WorkerIntelligenceTableProps {
  profiles: WorkerSkillProfile[];
  workers: { id: string; full_name: string; role?: string; status?: string }[];
  onWorkerClick?: (workerId: string) => void;
}

type SortKey = 'name' | 'speed' | 'quality' | 'consistency' | 'predictability' | 'boxesPerHour' | 'defectRate' | 'lastActive';
type SortDirection = 'asc' | 'desc';
type FilterType = 'all' | 'high-performers' | 'training-needed' | 'risk';

const TREND_ICONS = {
  improving: <TrendingUp className="h-3 w-3 text-emerald-500" />,
  stable: <Minus className="h-3 w-3 text-muted-foreground" />,
  declining: <TrendingDown className="h-3 w-3 text-red-500" />,
};

// Calculate predictability score (same logic as profile card)
function calculatePredictability(profile: WorkerSkillProfile): number {
  const consistencyVariance = profile.rolling_7_day_boxes > 0 
    ? Math.abs((profile.rolling_7_day_defects || 0) / profile.rolling_7_day_boxes) 
    : 0.25;
  
  return Math.round(
    (profile.reliability_score * 0.4) +
    ((1 - Math.min(consistencyVariance, 1)) * 100 * 0.3) +
    ((profile.trend_speed === 'stable' ? 75 : profile.trend_speed === 'improving' ? 100 : 50) * 0.15) +
    ((profile.trend_quality === 'stable' ? 75 : profile.trend_quality === 'improving' ? 100 : 50) * 0.15)
  );
}

function getPredictabilityBadge(score: number) {
  if (score >= 75) return { label: 'High', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  if (score >= 50) return { label: 'Medium', color: 'bg-amber-100 text-amber-700 border-amber-200' };
  return { label: 'Low', color: 'bg-red-100 text-red-700 border-red-200' };
}

function getScoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-600';
  if (score >= 40) return 'text-amber-600';
  return 'text-red-600';
}

export function WorkerIntelligenceTable({ 
  profiles, 
  workers,
  onWorkerClick 
}: WorkerIntelligenceTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filter, setFilter] = useState<FilterType>('all');

  const workerMap = useMemo(() => 
    new Map(workers.map(w => [w.id, w])), 
    [workers]
  );

  // Enrich profiles with calculated fields
  const enrichedProfiles = useMemo(() => 
    profiles.map(profile => ({
      ...profile,
      workerName: workerMap.get(profile.worker_id)?.full_name || 'Unknown',
      workerRole: workerMap.get(profile.worker_id)?.role || '',
      predictability: calculatePredictability(profile),
      consistencyScore: profile.rolling_7_day_boxes > 0 
        ? Math.round((1 - Math.min(Math.abs(profile.rolling_7_day_defects / profile.rolling_7_day_boxes), 1)) * 100)
        : 50,
    })),
    [profiles, workerMap]
  );

  // Filter logic
  const filteredProfiles = useMemo(() => {
    let result = enrichedProfiles;

    // Text search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.workerName.toLowerCase().includes(query) ||
        p.workerRole.toLowerCase().includes(query)
      );
    }

    // Category filter
    switch (filter) {
      case 'high-performers':
        result = result.filter(p => p.overall_score >= 70);
        break;
      case 'training-needed':
        result = result.filter(p => p.overall_score < 50 || p.trend_speed === 'declining' || p.trend_quality === 'declining');
        break;
      case 'risk':
        result = result.filter(p => p.predictability < 50 && (p.defect_rate_per_thousand || 0) > 10);
        break;
    }

    return result;
  }, [enrichedProfiles, searchQuery, filter]);

  // Sort logic
  const sortedProfiles = useMemo(() => {
    const sorted = [...filteredProfiles].sort((a, b) => {
      let comparison = 0;
      
      switch (sortKey) {
        case 'name':
          comparison = a.workerName.localeCompare(b.workerName);
          break;
        case 'speed':
          comparison = (a.speed_score || 0) - (b.speed_score || 0);
          break;
        case 'quality':
          comparison = (a.quality_score || 0) - (b.quality_score || 0);
          break;
        case 'consistency':
          comparison = (a.consistencyScore || 0) - (b.consistencyScore || 0);
          break;
        case 'predictability':
          comparison = a.predictability - b.predictability;
          break;
        case 'boxesPerHour':
          comparison = (a.boxes_per_hour || 0) - (b.boxes_per_hour || 0);
          break;
        case 'defectRate':
          comparison = (a.defect_rate_per_thousand || 0) - (b.defect_rate_per_thousand || 0);
          break;
        case 'lastActive':
          comparison = new Date(a.last_calculated_at || 0).getTime() - new Date(b.last_calculated_at || 0).getTime();
          break;
      }
      
      return sortDirection === 'desc' ? -comparison : comparison;
    });
    
    return sorted;
  }, [filteredProfiles, sortKey, sortDirection]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc'); // Default to desc for scores
    }
  };

  const SortIcon = ({ active, direction }: { active: boolean; direction: SortDirection }) => {
    if (!active) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    return direction === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1" /> 
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  // Export data preparation
  const exportData = sortedProfiles.map(p => ({
    Name: p.workerName,
    Role: p.workerRole,
    'Overall Score': p.overall_score,
    'Speed Score': p.speed_score,
    'Quality Score': p.quality_score,
    'Consistency Score': p.consistencyScore,
    'Predictability Score': p.predictability,
    'Boxes/Hour': p.boxes_per_hour?.toFixed(1) || '',
    'Defect Rate (per 1k)': p.defect_rate_per_thousand?.toFixed(1) || '',
    'Speed Trend': p.trend_speed,
    'Quality Trend': p.trend_quality,
    'Last Updated': p.last_calculated_at ? new Date(p.last_calculated_at).toLocaleDateString() : '',
  }));

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Worker Intelligence
          </CardTitle>
          <Badge variant="outline">{sortedProfiles.length} workers</Badge>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-wrap gap-3 mt-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search workers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          
          <Select value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter workers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" /> All Workers
                </span>
              </SelectItem>
              <SelectItem value="high-performers">
                <span className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-500" /> High Performers
                </span>
              </SelectItem>
              <SelectItem value="training-needed">
                <span className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-blue-500" /> Training Needed
                </span>
              </SelectItem>
              <SelectItem value="risk">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" /> Risk
                </span>
              </SelectItem>
            </SelectContent>
          </Select>

          <ExportButton 
            data={exportData} 
            filename="worker-intelligence" 
            disabled={sortedProfiles.length === 0}
          />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead 
                  className="cursor-pointer whitespace-nowrap"
                  onClick={() => handleSort('name')}
                >
                  <span className="flex items-center">
                    Worker
                    <SortIcon active={sortKey === 'name'} direction={sortDirection} />
                  </span>
                </TableHead>
                <TableHead 
                  className="cursor-pointer text-center whitespace-nowrap"
                  onClick={() => handleSort('speed')}
                >
                  <span className="flex items-center justify-center">
                    Speed
                    <SortIcon active={sortKey === 'speed'} direction={sortDirection} />
                  </span>
                </TableHead>
                <TableHead 
                  className="cursor-pointer text-center whitespace-nowrap"
                  onClick={() => handleSort('quality')}
                >
                  <span className="flex items-center justify-center">
                    Quality
                    <SortIcon active={sortKey === 'quality'} direction={sortDirection} />
                  </span>
                </TableHead>
                <TableHead 
                  className="cursor-pointer text-center whitespace-nowrap"
                  onClick={() => handleSort('consistency')}
                >
                  <span className="flex items-center justify-center">
                    Consistency
                    <SortIcon active={sortKey === 'consistency'} direction={sortDirection} />
                  </span>
                </TableHead>
                <TableHead 
                  className="cursor-pointer text-center whitespace-nowrap"
                  onClick={() => handleSort('predictability')}
                >
                  <span className="flex items-center justify-center">
                    <Gauge className="h-3 w-3 mr-1" />
                    Predict.
                    <SortIcon active={sortKey === 'predictability'} direction={sortDirection} />
                  </span>
                </TableHead>
                <TableHead 
                  className="cursor-pointer text-center whitespace-nowrap"
                  onClick={() => handleSort('boxesPerHour')}
                >
                  <span className="flex items-center justify-center">
                    Boxes/Hr
                    <SortIcon active={sortKey === 'boxesPerHour'} direction={sortDirection} />
                  </span>
                </TableHead>
                <TableHead 
                  className="cursor-pointer text-center whitespace-nowrap"
                  onClick={() => handleSort('defectRate')}
                >
                  <span className="flex items-center justify-center">
                    Defects‰
                    <SortIcon active={sortKey === 'defectRate'} direction={sortDirection} />
                  </span>
                </TableHead>
                <TableHead className="text-center whitespace-nowrap">Trends</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedProfiles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No workers match current filters
                  </TableCell>
                </TableRow>
              ) : (
                sortedProfiles.map(profile => {
                  const predictBadge = getPredictabilityBadge(profile.predictability);
                  
                  return (
                    <TableRow 
                      key={profile.id}
                      className={cn(
                        "cursor-pointer",
                        profile.overall_score < 40 && "bg-red-50/50 dark:bg-red-950/20"
                      )}
                      onClick={() => onWorkerClick?.(profile.worker_id)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">{profile.workerName}</p>
                          {profile.workerRole && (
                            <p className="text-xs text-muted-foreground capitalize">{profile.workerRole}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={cn("font-semibold", getScoreColor(profile.speed_score || 0))}>
                          {profile.speed_score || '—'}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={cn("font-semibold", getScoreColor(profile.quality_score || 0))}>
                          {profile.quality_score || '—'}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={cn("font-semibold", getScoreColor(profile.consistencyScore || 0))}>
                          {profile.consistencyScore || '—'}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={cn("text-xs", predictBadge.color)}>
                          {predictBadge.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {profile.boxes_per_hour?.toFixed(1) || '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={cn(
                          "font-medium",
                          (profile.defect_rate_per_thousand || 0) > 10 ? "text-red-600" : ""
                        )}>
                          {profile.defect_rate_per_thousand?.toFixed(1) || '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <div className="flex items-center gap-0.5" title={`Speed: ${profile.trend_speed}`}>
                            {TREND_ICONS[profile.trend_speed || 'stable']}
                          </div>
                          <div className="flex items-center gap-0.5" title={`Quality: ${profile.trend_quality}`}>
                            {TREND_ICONS[profile.trend_quality || 'stable']}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
