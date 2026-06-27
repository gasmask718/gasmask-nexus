import { useEffect, useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Trash2 } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Blackout {
  id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
}

const toDateStr = (d: Date) => format(d, 'yyyy-MM-dd');

export function PartnerAvailability({ partnerId }: { partnerId: string }) {
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>();
  const [reason, setReason] = useState('');
  const [blackouts, setBlackouts] = useState<Blackout[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadBlackouts = async () => {
    const { data, error } = await supabase
      .from('partner_blackout_dates')
      .select('id, start_date, end_date, reason')
      .eq('partner_id', partnerId)
      .gte('end_date', toDateStr(new Date()))
      .order('start_date', { ascending: true });
    if (error) toast.error(error.message);
    else setBlackouts((data ?? []) as Blackout[]);
    setLoading(false);
  };

  useEffect(() => { loadBlackouts(); /* eslint-disable-next-line */ }, [partnerId]);

  const handleAdd = async () => {
    if (!selectedRange?.from || !selectedRange?.to) {
      toast.error('Please select a date range');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('partner_blackout_dates').insert({
      partner_id: partnerId,
      start_date: toDateStr(selectedRange.from),
      end_date: toDateStr(selectedRange.to),
      reason: reason.trim() || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Blackout added — we won't dispatch you during this period");
      setSelectedRange(undefined);
      setReason('');
      await loadBlackouts();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('partner_blackout_dates').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Blackout removed'); await loadBlackouts(); }
  };

  const disabledDays = blackouts.flatMap(b => {
    const days: Date[] = [];
    const cur = new Date(b.start_date + 'T00:00:00');
    const end = new Date(b.end_date + 'T00:00:00');
    while (cur <= end) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
    return days;
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Availability</CardTitle>
        <CardDescription>
          Mark dates you're unavailable. We'll automatically skip you for dispatches during those periods — no need to decline SMS dispatches one-by-one.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label className="mb-2 block">Select date range to mark unavailable</Label>
          <Calendar
            mode="range"
            selected={selectedRange}
            onSelect={setSelectedRange}
            disabled={(date) =>
              date < new Date(new Date().setHours(0, 0, 0, 0)) ||
              disabledDays.some(d => d.toDateString() === date.toDateString())
            }
            numberOfMonths={2}
            className="rounded-md border"
          />
        </div>

        {selectedRange?.from && selectedRange?.to && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="blackout-reason">Reason (optional)</Label>
              <Input
                id="blackout-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Vacation, vehicle maintenance, personal time..."
                maxLength={100}
              />
            </div>
            <Button onClick={handleAdd} disabled={saving}>
              {saving
                ? 'Saving...'
                : `Mark unavailable: ${format(selectedRange.from, 'MMM d')} - ${format(selectedRange.to, 'MMM d, yyyy')}`}
            </Button>
          </div>
        )}

        <Separator />

        <div>
          <h4 className="font-medium mb-3">Your upcoming blackouts</h4>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : blackouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No blackouts scheduled. You're available for dispatches.</p>
          ) : (
            <div className="space-y-2">
              {blackouts.map(b => (
                <div key={b.id} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <div className="font-medium">
                      {format(new Date(b.start_date + 'T00:00:00'), 'MMM d')} - {format(new Date(b.end_date + 'T00:00:00'), 'MMM d, yyyy')}
                    </div>
                    {b.reason && <p className="text-sm text-muted-foreground">{b.reason}</p>}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(b.id)} aria-label="Delete blackout">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
