/**
 * Data Health Scanner - Check database tables, RLS, and API connectivity
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Database, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Shield } from 'lucide-react';
import { QAScanResults, DataHealthIssue } from '@/hooks/useQAScanner';

interface DataHealthScannerProps {
  scanResults: QAScanResults | null;
}

const statusConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  'ok': { 
    label: 'Healthy', 
    icon: <CheckCircle2 className="h-4 w-4 text-green-500" />, 
    color: 'text-green-500' 
  },
  'connection_failed': { 
    label: 'Connection Failed', 
    icon: <XCircle className="h-4 w-4 text-destructive" />, 
    color: 'text-destructive' 
  },
  'table_missing': { 
    label: 'Table Missing', 
    icon: <AlertTriangle className="h-4 w-4 text-orange-500" />, 
    color: 'text-orange-500' 
  },
  'rls_denied': { 
    label: 'RLS Denied', 
    icon: <Shield className="h-4 w-4 text-destructive" />, 
    color: 'text-destructive' 
  },
  'column_missing': { 
    label: 'Column Missing', 
    icon: <AlertTriangle className="h-4 w-4 text-orange-500" />, 
    color: 'text-orange-500' 
  },
};

export function DataHealthScanner({ scanResults }: DataHealthScannerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [floorFilter, setFloorFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  if (!scanResults) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <p className="text-muted-foreground">Run a scan to see data health results</p>
        </CardContent>
      </Card>
    );
  }

  const issues = scanResults.dataHealthIssues;
  const floors = [...new Set(issues.map(i => i.floor))];

  const filteredIssues = issues.filter(issue => {
    const matchesSearch = issue.tableName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFloor = floorFilter === 'all' || issue.floor === floorFilter;
    const matchesStatus = statusFilter === 'all' || issue.status === statusFilter;
    return matchesSearch && matchesFloor && matchesStatus;
  });

  // Group by floor for summary
  const floorHealth = floors.map(floor => {
    const floorIssues = issues.filter(i => i.floor === floor);
    const okCount = floorIssues.filter(i => i.status === 'ok').length;
    const totalCount = floorIssues.length;
    return {
      floor,
      okCount,
      totalCount,
      percentage: totalCount > 0 ? Math.round((okCount / totalCount) * 100) : 100,
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Data Health Scanner
        </CardTitle>
        <CardDescription>
          Validates database connectivity, RLS policies, and table access per floor
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Floor Health Summary */}
        <div className="grid grid-cols-6 gap-3 mb-6">
          {floorHealth.map(({ floor, okCount, totalCount, percentage }) => (
            <div 
              key={floor}
              className={`p-3 rounded-lg text-center ${
                percentage === 100 
                  ? 'bg-green-500/10 border border-green-500/30' 
                  : percentage >= 50 
                  ? 'bg-yellow-500/10 border border-yellow-500/30'
                  : 'bg-destructive/10 border border-destructive/30'
              }`}
            >
              <p className="text-xs font-medium mb-1 truncate" title={floor}>{floor}</p>
              <p className={`text-lg font-bold ${
                percentage === 100 ? 'text-green-600' : percentage >= 50 ? 'text-yellow-600' : 'text-destructive'
              }`}>
                {percentage}%
              </p>
              <p className="text-xs text-muted-foreground">{okCount}/{totalCount}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={floorFilter} onValueChange={setFloorFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Floors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Floors</SelectItem>
              {floors.map(floor => (
                <SelectItem key={floor} value={floor}>{floor}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(statusConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Results Table */}
        {filteredIssues.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="font-medium text-lg mb-1">All Tables Healthy</h3>
            <p className="text-sm text-muted-foreground">
              Database connectivity and RLS policies are working correctly
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Floor</TableHead>
                <TableHead>Table Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Error Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredIssues.map((issue) => (
                <TableRow key={issue.id}>
                  <TableCell className="font-medium text-xs">
                    {issue.floor}
                  </TableCell>
                  <TableCell className="font-mono">
                    {issue.tableName}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {statusConfig[issue.status]?.icon}
                      <span className={`text-sm ${statusConfig[issue.status]?.color}`}>
                        {statusConfig[issue.status]?.label}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={issue.severity === 'P0' ? 'destructive' : 'outline'}>
                      {issue.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">
                    {issue.error || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
