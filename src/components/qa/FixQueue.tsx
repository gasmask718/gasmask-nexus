/**
 * Fix Queue - Prioritized list of issues to resolve before go-live
 */
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Search, Bug, CheckCircle2, XCircle, AlertTriangle, 
  ExternalLink, ArrowUp, ArrowRight, ArrowDown, FileCode, Clipboard
} from 'lucide-react';
import { QAScanResults } from '@/hooks/useQAScanner';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

interface FixQueueProps {
  scanResults: QAScanResults | null;
}

interface FixQueueItem {
  id: string;
  floor: string;
  pageName: string;
  path: string;
  category: 'route' | 'action' | 'data';
  issue: string;
  severity: 'P0' | 'P1' | 'P2';
  componentFile: string;
  reproSteps?: string;
  likelyFix?: string;
}

const severityConfig: Record<string, { 
  icon: React.ReactNode; 
  color: string; 
  bgColor: string;
  label: string 
}> = {
  'P0': { 
    icon: <ArrowUp className="h-4 w-4" />, 
    color: 'text-destructive', 
    bgColor: 'bg-destructive/10',
    label: 'Critical' 
  },
  'P1': { 
    icon: <ArrowRight className="h-4 w-4" />, 
    color: 'text-orange-600', 
    bgColor: 'bg-orange-500/10',
    label: 'High' 
  },
  'P2': { 
    icon: <ArrowDown className="h-4 w-4" />, 
    color: 'text-yellow-600', 
    bgColor: 'bg-yellow-500/10',
    label: 'Medium' 
  },
};

export function FixQueue({ scanResults }: FixQueueProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'P0' | 'P1' | 'P2' | 'all'>('P0');
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());

  // Build unified fix queue from all scan results
  const fixQueue = useMemo((): FixQueueItem[] => {
    if (!scanResults) return [];

    const items: FixQueueItem[] = [];

    // Add route issues
    scanResults.routeIssues.forEach(issue => {
      items.push({
        id: issue.id,
        floor: issue.floor,
        pageName: issue.pageName,
        path: issue.path,
        category: 'route',
        issue: `${issue.status}: ${issue.lastError || 'Route has issues'}`,
        severity: issue.severity,
        componentFile: issue.componentFile,
        reproSteps: `Navigate to ${issue.path}`,
        likelyFix: issue.status === '404' 
          ? 'Add route to AppRoutes.tsx' 
          : issue.status === 'empty_shell'
          ? 'Implement page content and states'
          : 'Check auth and RLS configuration',
      });
    });

    // Add action issues
    scanResults.actionIssues.forEach(issue => {
      items.push({
        id: issue.id,
        floor: issue.floor,
        pageName: issue.pageName,
        path: issue.path,
        category: 'action',
        issue: `Dead ${issue.actionType}: "${issue.actionLabel}"`,
        severity: issue.severity,
        componentFile: issue.componentFile,
        reproSteps: `Go to ${issue.path}, click "${issue.actionLabel}"`,
        likelyFix: 'Add onClick handler or disabledReason prop',
      });
    });

    // Add data issues
    scanResults.dataHealthIssues.forEach(issue => {
      items.push({
        id: issue.id,
        floor: issue.floor,
        pageName: issue.tableName,
        path: `/admin/qa-command-center`,
        category: 'data',
        issue: `${issue.status}: ${issue.error || 'Table has issues'}`,
        severity: issue.severity,
        componentFile: `Database: ${issue.tableName}`,
        reproSteps: `Query ${issue.tableName} table`,
        likelyFix: issue.status === 'rls_denied'
          ? 'Add RLS policy for current role'
          : 'Check table exists and has correct schema',
      });
    });

    // Sort by severity
    return items.sort((a, b) => {
      const order = { 'P0': 0, 'P1': 1, 'P2': 2 };
      return order[a.severity] - order[b.severity];
    });
  }, [scanResults]);

  const filteredQueue = fixQueue.filter(item => {
    const matchesSearch = item.pageName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.issue.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.path.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'all' || item.severity === activeTab;
    const isNotCompleted = !completedItems.has(item.id);
    return matchesSearch && matchesTab && isNotCompleted;
  });

  const p0Count = fixQueue.filter(i => i.severity === 'P0' && !completedItems.has(i.id)).length;
  const p1Count = fixQueue.filter(i => i.severity === 'P1' && !completedItems.has(i.id)).length;
  const p2Count = fixQueue.filter(i => i.severity === 'P2' && !completedItems.has(i.id)).length;

  const toggleComplete = (id: string) => {
    setCompletedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const copyFixDetails = (item: FixQueueItem) => {
    const text = `
## Fix: ${item.issue}

**Floor:** ${item.floor}
**Page:** ${item.pageName}
**Path:** ${item.path}
**Severity:** ${item.severity}
**Component:** ${item.componentFile}

### Reproduction Steps
${item.reproSteps}

### Likely Fix
${item.likelyFix}
    `.trim();
    
    navigator.clipboard.writeText(text);
    toast.success('Fix details copied to clipboard');
  };

  if (!scanResults) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Bug className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-medium text-lg mb-1">No Scan Results</h3>
          <p className="text-sm text-muted-foreground">
            Run a full scan to generate the fix queue
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="h-5 w-5" />
          Fix Queue
        </CardTitle>
        <CardDescription>
          Prioritized list of {fixQueue.length} issues to resolve before go-live
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Search */}
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search issues..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Severity Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="mb-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="P0" className="flex items-center gap-2">
              <span className="text-destructive font-bold">P0</span>
              <Badge variant="destructive">{p0Count}</Badge>
            </TabsTrigger>
            <TabsTrigger value="P1" className="flex items-center gap-2">
              <span className="text-orange-600 font-bold">P1</span>
              <Badge variant="outline" className="border-orange-500">{p1Count}</Badge>
            </TabsTrigger>
            <TabsTrigger value="P2" className="flex items-center gap-2">
              <span className="text-yellow-600 font-bold">P2</span>
              <Badge variant="outline">{p2Count}</Badge>
            </TabsTrigger>
            <TabsTrigger value="all">All Issues</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Queue Table */}
        {filteredQueue.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="font-medium text-lg mb-1">
              {activeTab === 'P0' ? 'No P0 Blockers!' : 'Queue Clear'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {activeTab === 'P0' 
                ? 'No critical issues blocking go-live' 
                : 'No issues match your current filters'}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Done</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Floor / Page</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Likely Fix</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQueue.map((item) => (
                <TableRow 
                  key={item.id}
                  className={completedItems.has(item.id) ? 'opacity-50' : ''}
                >
                  <TableCell>
                    <Checkbox 
                      checked={completedItems.has(item.id)}
                      onCheckedChange={() => toggleComplete(item.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className={`flex items-center gap-1 ${severityConfig[item.severity].color}`}>
                      {severityConfig[item.severity].icon}
                      <Badge 
                        variant={item.severity === 'P0' ? 'destructive' : 'outline'}
                        className={item.severity !== 'P0' ? severityConfig[item.severity].bgColor : ''}
                      >
                        {item.severity}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-xs text-muted-foreground">{item.floor}</p>
                      <p className="font-medium">{item.pageName}</p>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <p className="text-sm truncate" title={item.issue}>{item.issue}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {item.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                    {item.likelyFix}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => copyFixDetails(item)}
                        title="Copy fix details"
                      >
                        <Clipboard className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={item.path} target="_blank" title="Open page">
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
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
