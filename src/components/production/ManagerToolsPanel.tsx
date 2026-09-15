/**
 * TOOLS AT MY OFFICE — read-only for the office manager, with one action:
 * report a problem. Managers never add, edit or move assets; HQ does that.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useOfficeTools } from '@/hooks/useProductionPortal';
import {
  useToolIssues,
  useReportToolIssue,
  ISSUE_TYPE_LABEL,
  ToolIssueType,
} from '@/hooks/useProductionFloorOps';
import { Wrench, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export function ManagerToolsPanel({ officeId }: { officeId: string }) {
  const { data: tools = [], isLoading } = useOfficeTools(officeId);
  const { data: issues = [] } = useToolIssues(officeId, 'all');
  const report = useReportToolIssue();

  const [target, setTarget] = useState<{ id: string | null; name: string } | null>(null);
  const [issueType, setIssueType] = useState<ToolIssueType>('fault');
  const [severity, setSeverity] = useState<'low' | 'normal' | 'high'>('normal');
  const [description, setDescription] = useState('');

  const openIssues = issues.filter((i) => i.status === 'open' || i.status === 'acknowledged');

  const submit = async () => {
    if (!target || !description.trim()) return;
    await report.mutateAsync({
      office_id: officeId,
      tool_id: target.id,
      tool_name: target.name,
      issue_type: issueType,
      severity,
      description: description.trim(),
    });
    setTarget(null);
    setDescription('');
    setIssueType('fault');
    setSeverity('normal');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" />
          Tools at my office
          {openIssues.length > 0 && (
            <Badge variant="destructive" className="ml-1">{openIssues.length} reported</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="h-16 bg-muted animate-pulse rounded-lg" />
        ) : tools.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No tools are assigned to this office yet.
          </p>
        ) : (
          tools.map((tool: any) => {
            const toolIssues = openIssues.filter((i) => i.tool_id === tool.id);
            return (
              <div key={tool.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{tool.tool_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {tool.tool_type} · {tool.operational_count ?? tool.quantity ?? 0} of {tool.quantity ?? 0} working
                    {tool.status ? ` · ${tool.status}` : ''}
                  </p>
                  {toolIssues.length > 0 && (
                    <p className="text-xs text-destructive flex items-center gap-1 mt-0.5">
                      <AlertTriangle className="h-3 w-3" />
                      {toolIssues.length} problem reported — HQ notified
                    </p>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={() => setTarget({ id: tool.id, name: tool.tool_name })}>
                  Report a problem
                </Button>
              </div>
            );
          })
        )}

        {issues.length > 0 && (
          <div className="pt-2 border-t space-y-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">My reports</p>
            {issues.slice(0, 6).map((i) => (
              <div key={i.id} className="flex items-center justify-between text-sm">
                <span className="truncate">
                  {i.tool_name} — {ISSUE_TYPE_LABEL[i.issue_type]}
                  <span className="text-muted-foreground"> · {format(new Date(i.reported_at), 'MMM d')}</span>
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px]',
                    (i.status === 'resolved' || i.status === 'closed') && 'text-emerald-600 border-emerald-500/40',
                  )}
                >
                  {i.status === 'resolved' || i.status === 'closed' ? (
                    <CheckCircle className="h-3 w-3 mr-1" />
                  ) : null}
                  {i.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Report a problem — {target?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>What is wrong?</Label>
              <Select value={issueType} onValueChange={(v) => setIssueType(v as ToolIssueType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ISSUE_TYPE_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>How urgent?</Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Can wait</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">Stopping work</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Describe it</Label>
              <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What happened, when, what it affects..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>Cancel</Button>
            <Button onClick={submit} disabled={report.isPending || !description.trim()}>
              {report.isPending ? 'Sending...' : 'Send to HQ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
