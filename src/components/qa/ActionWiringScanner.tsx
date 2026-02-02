/**
 * Action Wiring Scanner - Detect dead buttons and unwired actions
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Zap, CheckCircle2, XCircle, AlertOctagon, MousePointer, Link as LinkIcon, Menu } from 'lucide-react';
import { QAScanResults, ActionIssue } from '@/hooks/useQAScanner';

interface ActionWiringScannerProps {
  scanResults: QAScanResults | null;
}

const actionTypeIcons: Record<string, React.ReactNode> = {
  'button': <MousePointer className="h-4 w-4" />,
  'link': <LinkIcon className="h-4 w-4" />,
  'menu': <Menu className="h-4 w-4" />,
};

const statusConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  'wired': { label: 'Wired', icon: <CheckCircle2 className="h-4 w-4 text-green-500" />, color: 'text-green-500' },
  'disabled_intentional': { label: 'Disabled (Intentional)', icon: <AlertOctagon className="h-4 w-4 text-yellow-500" />, color: 'text-yellow-500' },
  'missing_wiring': { label: 'Missing Wiring', icon: <XCircle className="h-4 w-4 text-destructive" />, color: 'text-destructive' },
};

export function ActionWiringScanner({ scanResults }: ActionWiringScannerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [floorFilter, setFloorFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  if (!scanResults) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <p className="text-muted-foreground">Run a scan to see action wiring results</p>
        </CardContent>
      </Card>
    );
  }

  const issues = scanResults.actionIssues;
  const floors = [...new Set(issues.map(i => i.floor))];

  const filteredIssues = issues.filter(issue => {
    const matchesSearch = issue.actionLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          issue.pageName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFloor = floorFilter === 'all' || issue.floor === floorFilter;
    const matchesType = typeFilter === 'all' || issue.actionType === typeFilter;
    return matchesSearch && matchesFloor && matchesType;
  });

  const deadButtonCount = issues.filter(i => i.status === 'missing_wiring').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Action Wiring Scanner
        </CardTitle>
        <CardDescription>
          {deadButtonCount} dead buttons detected — these are P0 blockers for go-live
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-destructive/10 rounded-lg text-center">
            <p className="text-3xl font-bold text-destructive">
              {issues.filter(i => i.status === 'missing_wiring').length}
            </p>
            <p className="text-sm text-muted-foreground">Missing Wiring (P0)</p>
          </div>
          <div className="p-4 bg-yellow-500/10 rounded-lg text-center">
            <p className="text-3xl font-bold text-yellow-600">
              {issues.filter(i => i.status === 'disabled_intentional').length}
            </p>
            <p className="text-sm text-muted-foreground">Disabled Intentionally</p>
          </div>
          <div className="p-4 bg-green-500/10 rounded-lg text-center">
            <p className="text-3xl font-bold text-green-600">
              {issues.filter(i => i.status === 'wired').length}
            </p>
            <p className="text-sm text-muted-foreground">Properly Wired</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search actions..."
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
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="button">Buttons</SelectItem>
              <SelectItem value="link">Links</SelectItem>
              <SelectItem value="menu">Menu Items</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results Table */}
        {filteredIssues.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="font-medium text-lg mb-1">No Dead Actions Found</h3>
            <p className="text-sm text-muted-foreground">
              All interactive elements are properly wired
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Floor</TableHead>
                <TableHead>Page</TableHead>
                <TableHead>Action Label</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Component</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredIssues.map((issue) => (
                <TableRow key={issue.id}>
                  <TableCell className="text-xs font-medium">
                    {issue.floor}
                  </TableCell>
                  <TableCell>{issue.pageName}</TableCell>
                  <TableCell className="font-medium">
                    {issue.actionLabel}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {actionTypeIcons[issue.actionType]}
                      <span className="capitalize">{issue.actionType}</span>
                    </div>
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
                  <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px] truncate">
                    {issue.componentFile}
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
