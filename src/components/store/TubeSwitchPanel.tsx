import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Plus, RefreshCw, CheckCircle2, Clock } from 'lucide-react';
import { useStoreTubeSwitches, useLogTubeSwitch, type LogTubeSwitchInput } from '@/hooks/useStoreTubeSwitches';
import { format } from 'date-fns';

import { dynastyDate } from '@/lib/dates';
const SWITCH_REASONS = [
  { value: 'damaged', label: 'Damaged' },
  { value: 'outdated_branding', label: 'Outdated Branding' },
  { value: 'product_upgrade', label: 'Product Upgrade' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'performance_issue', label: 'Performance Issue' },
  { value: 'other', label: 'Other' },
];

interface TubeSwitchPanelProps {
  storeId: string;
}

export function TubeSwitchPanel({ storeId }: TubeSwitchPanelProps) {
  const { data: records, isLoading, analytics } = useStoreTubeSwitches(storeId);
  const logMutation = useLogTubeSwitch();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    old_tube_type: '',
    estimated_old_tube_quantity: 0,
    switched_quantity: 0,
    switch_reason: '',
    notes: '',
    verified: false,
  });

  const handleSubmit = () => {
    if (!form.old_tube_type || !form.switch_reason) return;
    const input: LogTubeSwitchInput = {
      store_id: storeId,
      old_tube_type: form.old_tube_type,
      estimated_old_tube_quantity: form.estimated_old_tube_quantity,
      switched_quantity: form.switched_quantity,
      switch_reason: form.switch_reason,
      notes: form.notes || undefined,
      verified: form.verified,
    };
    logMutation.mutate(input, {
      onSuccess: () => {
        setOpen(false);
        setForm({ old_tube_type: '', estimated_old_tube_quantity: 0, switched_quantity: 0, switch_reason: '', notes: '', verified: false });
      },
    });
  };

  const statusConfig = {
    green: { label: 'No Outstanding Switch', color: 'bg-green-500/10 text-green-700 border-green-500/30', icon: CheckCircle2 },
    yellow: { label: 'Partial Switch Needed', color: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30', icon: Clock },
    red: { label: 'Switch Required', color: 'bg-red-500/10 text-red-700 border-red-500/30', icon: AlertTriangle },
  };

  const currentStatus = statusConfig[analytics.status];
  const StatusIcon = currentStatus.icon;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <RefreshCw className="h-5 w-5" />
          Tube Switch Intelligence
        </CardTitle>
        <p className="text-xs text-muted-foreground border border-dashed border-muted-foreground/30 rounded px-2 py-1 mt-1">
          Tube Switch records are informational and do not trigger automated inventory, dispatch, or financial changes.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Badges */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className={currentStatus.color}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {currentStatus.label}
          </Badge>
          <Badge variant="outline">Est. Old: {analytics.oldTubeEstimate}</Badge>
          <Badge variant="outline">Outstanding: {analytics.outstanding}</Badge>
          <Badge variant="outline">Total: {analytics.totalSwitches}</Badge>
          <Badge variant="outline">90d: {analytics.last90Days}</Badge>
          {analytics.lastSwitchDate && (
            <Badge variant="outline">Last: {dynastyDate(analytics.lastSwitchDate)}</Badge>
          )}
        </div>

        {/* Log Button + Dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" /> Log Tube Switch
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log Tube Switch</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Old Tube Type</Label>
                <Input value={form.old_tube_type} onChange={e => setForm(f => ({ ...f, old_tube_type: e.target.value }))} placeholder="e.g. GasMask Bags" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Estimated Old Qty</Label>
                  <Input type="number" min={0} value={form.estimated_old_tube_quantity} onChange={e => setForm(f => ({ ...f, estimated_old_tube_quantity: parseInt(e.target.value) || 0 }))} />
                </div>
                <div>
                  <Label>Qty Replaced</Label>
                  <Input type="number" min={0} value={form.switched_quantity} onChange={e => setForm(f => ({ ...f, switched_quantity: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>
              <div>
                <Label>Reason</Label>
                <Select value={form.switch_reason} onValueChange={v => setForm(f => ({ ...f, switch_reason: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                  <SelectContent>
                    {SWITCH_REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.verified} onCheckedChange={v => setForm(f => ({ ...f, verified: v }))} />
                <Label>Mark as Verified</Label>
              </div>
              <Button onClick={handleSubmit} disabled={logMutation.isPending || !form.old_tube_type || !form.switch_reason} className="w-full">
                {logMutation.isPending ? 'Saving...' : 'Log Switch'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* History Table */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : records && records.length > 0 ? (
          <div className="max-h-64 overflow-auto rounded border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Est.</TableHead>
                  <TableHead>Switched</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Verified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{dynastyDate(r.created_at)}</TableCell>
                    <TableCell className="text-xs">{r.old_tube_type}</TableCell>
                    <TableCell className="text-xs">{r.estimated_old_tube_quantity}</TableCell>
                    <TableCell className="text-xs">{r.switched_quantity}</TableCell>
                    <TableCell className="text-xs capitalize">{r.switch_reason?.replace('_', ' ')}</TableCell>
                    <TableCell className="text-xs">{r.verified ? '✅' : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No tube switch records yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
