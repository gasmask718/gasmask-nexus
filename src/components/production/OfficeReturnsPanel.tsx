/**
 * RETURNS OFFICE → HQ.
 * mode="manager": create a return, see this office's returns.
 * mode="hq": review everything and confirm what actually arrived.
 * Original shipment/issue records are never touched — a return is its own row.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  useOfficeReturns,
  useCreateReturn,
  useConfirmReturn,
  RETURN_TYPE_LABEL,
  ReturnType,
  OfficeReturn,
} from '@/hooks/useProductionFloorOps';
import { PackageOpen, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const STATUS_STYLE: Record<string, string> = {
  submitted: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  received: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
  rejected: 'bg-destructive/15 text-destructive border-destructive/30',
  cancelled: 'bg-muted text-muted-foreground',
};

export function OfficeReturnsPanel({
  officeId,
  mode = 'manager',
}: {
  officeId?: string;
  mode?: 'manager' | 'hq';
}) {
  const { data: returns = [], isLoading } = useOfficeReturns(officeId);
  const create = useCreateReturn();
  const confirm = useConfirmReturn();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    return_type: 'unused_material' as ReturnType,
    item_name: '',
    quantity: '',
    unit: 'each',
    item_condition: '',
    reason: '',
  });
  const [reviewing, setReviewing] = useState<OfficeReturn | null>(null);
  const [receivedQty, setReceivedQty] = useState('');
  const [hqNotes, setHqNotes] = useState('');

  const submit = async () => {
    if (!officeId || !form.item_name.trim() || !Number(form.quantity)) return;
    await create.mutateAsync({
      office_id: officeId,
      return_type: form.return_type,
      item_name: form.item_name.trim(),
      quantity: Number(form.quantity),
      unit: form.unit,
      item_condition: form.item_condition || null,
      reason: form.reason || null,
    });
    setOpen(false);
    setForm({ return_type: 'unused_material', item_name: '', quantity: '', unit: 'each', item_condition: '', reason: '' });
  };

  const review = async (status: 'received' | 'rejected') => {
    if (!reviewing) return;
    await confirm.mutateAsync({
      id: reviewing.id,
      status,
      received_quantity: receivedQty ? Number(receivedQty) : reviewing.quantity,
      hq_notes: hqNotes || null,
    });
    setReviewing(null);
    setReceivedQty('');
    setHqNotes('');
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <PackageOpen className="h-5 w-5 text-primary" />
          {mode === 'hq' ? 'Returns from offices' : 'Sending back to HQ'}
        </CardTitle>
        {mode === 'manager' && officeId && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />Send something back</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Send something back to HQ</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1">
                  <Label>What kind of return?</Label>
                  <Select value={form.return_type} onValueChange={(v) => setForm({ ...form, return_type: v as ReturnType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(RETURN_TYPE_LABEL).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Item</Label>
                  <Input value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} placeholder="e.g. Empty tubes, Grabba boxes, hand sealer" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>How many</Label>
                    <Input type="number" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Unit</Label>
                    <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="each">each</SelectItem>
                        <SelectItem value="lb">lb</SelectItem>
                        <SelectItem value="kg">kg</SelectItem>
                        <SelectItem value="roll">roll</SelectItem>
                        <SelectItem value="box">box</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Condition (optional)</Label>
                  <Input value={form.item_condition} onChange={(e) => setForm({ ...form, item_condition: e.target.value })} placeholder="good / damaged / opened" />
                </div>
                <div className="space-y-1">
                  <Label>Why are you sending it back?</Label>
                  <Textarea rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={submit} disabled={create.isPending || !form.item_name.trim() || !Number(form.quantity)}>
                  {create.isPending ? 'Sending...' : 'Send to HQ'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="h-16 bg-muted animate-pulse rounded-lg" />
        ) : returns.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nothing has been returned yet.</p>
        ) : (
          returns.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {r.item_name} — {r.quantity} {r.unit}
                </p>
                <p className="text-xs text-muted-foreground">
                  {RETURN_TYPE_LABEL[r.return_type]} · {format(new Date(r.initiated_at), 'MMM d, h:mm a')}
                  {r.reason ? ` · ${r.reason}` : ''}
                </p>
                {r.status === 'received' && r.received_quantity != null && r.received_quantity !== r.quantity && (
                  <p className="text-xs text-amber-600">HQ counted {r.received_quantity} {r.unit}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className={cn('capitalize', STATUS_STYLE[r.status])}>{r.status}</Badge>
                {mode === 'hq' && r.status === 'submitted' && (
                  <Button size="sm" variant="outline" onClick={() => { setReviewing(r); setReceivedQty(String(r.quantity)); }}>
                    Confirm
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Confirm return — {reviewing?.item_name}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Office sent {reviewing?.quantity} {reviewing?.unit}.
            </p>
            <div className="space-y-1">
              <Label>How many actually arrived</Label>
              <Input type="number" min="0" value={receivedQty} onChange={(e) => setReceivedQty(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <Textarea rows={2} value={hqNotes} onChange={(e) => setHqNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => review('rejected')} disabled={confirm.isPending}>Reject</Button>
            <Button onClick={() => review('received')} disabled={confirm.isPending}>
              {confirm.isPending ? 'Saving...' : 'Mark received'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
