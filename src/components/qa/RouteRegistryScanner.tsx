/**
 * Route Registry Scanner - Detect 404s, dead routes, and orphan pages
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExternalLink, Search, Filter, CheckCircle2, XCircle, AlertTriangle, FileCode } from 'lucide-react';
import { QAScanResults, RouteIssue } from '@/hooks/useQAScanner';
import { Link } from 'react-router-dom';

interface RouteRegistryScannerProps {
  scanResults: QAScanResults | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  'ok': { label: 'OK', color: 'bg-green-500', icon: <CheckCircle2 className="h-4 w-4 text-green-500" /> },
  '404': { label: '404', color: 'bg-destructive', icon: <XCircle className="h-4 w-4 text-destructive" /> },
  'dead_actions': { label: 'Dead Actions', color: 'bg-destructive', icon: <XCircle className="h-4 w-4 text-destructive" /> },
  'empty_shell': { label: 'Empty Shell', color: 'bg-orange-500', icon: <AlertTriangle className="h-4 w-4 text-orange-500" /> },
  'rls_denied': { label: 'RLS Denied', color: 'bg-destructive', icon: <XCircle className="h-4 w-4 text-destructive" /> },
  'api_error': { label: 'API Error', color: 'bg-orange-500', icon: <AlertTriangle className="h-4 w-4 text-orange-500" /> },
  'crash': { label: 'Crash', color: 'bg-destructive', icon: <XCircle className="h-4 w-4 text-destructive" /> },
};

const severityConfig: Record<string, { label: string; variant: 'destructive' | 'outline' | 'secondary' }> = {
  'P0': { label: 'P0', variant: 'destructive' },
  'P1': { label: 'P1', variant: 'outline' },
  'P2': { label: 'P2', variant: 'secondary' },
};

export function RouteRegistryScanner({ scanResults }: RouteRegistryScannerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [floorFilter, setFloorFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  if (!scanResults) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <p className="text-muted-foreground">Run a scan to see route registry results</p>
        </CardContent>
      </Card>
    );
  }

  const issues = scanResults.routeIssues;
  const floors = [...new Set(issues.map(i => i.floor))];

  const filteredIssues = issues.filter(issue => {
    const matchesSearch = issue.pageName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          issue.path.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFloor = floorFilter === 'all' || issue.floor === floorFilter;
    const matchesStatus = statusFilter === 'all' || issue.status === statusFilter;
    return matchesSearch && matchesFloor && matchesStatus;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCode className="h-5 w-5" />
          Route Registry Scanner
        </CardTitle>
        <CardDescription>
          {issues.length} route issues detected across {floors.length} floors
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search pages or paths..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={floorFilter} onValueChange={setFloorFilter}>
            <SelectTrigger className="w-[200px]">
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
            <h3 className="font-medium text-lg mb-1">No Route Issues Found</h3>
            <p className="text-sm text-muted-foreground">
              All registered routes are healthy
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Floor</TableHead>
                <TableHead>Page Name</TableHead>
                <TableHead>Path</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Error</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredIssues.map((issue) => (
                <TableRow key={issue.id}>
                  <TableCell className="font-medium text-xs">
                    {issue.floor}
                  </TableCell>
                  <TableCell>{issue.pageName}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {issue.path}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {statusConfig[issue.status]?.icon}
                      <span className="text-sm">{statusConfig[issue.status]?.label}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={severityConfig[issue.severity]?.variant || 'secondary'}>
                      {issue.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                    {issue.lastError || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={issue.path} target="_blank">
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
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
