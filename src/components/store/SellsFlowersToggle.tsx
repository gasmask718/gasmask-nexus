import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Flower2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { verifiedUpdate, mutationErrorMessage } from '@/lib/verifiedMutation';
import { fieldStamp } from '@/lib/dates';

interface SellsFlowersToggleProps {
  storeId: string;
  initialValue: boolean;
  initialNote?: string | null;
  flaggedAt?: string | null;
  flaggedBy?: string | null;
  onUpdate?: () => void;
  readOnly?: boolean;
}

/**
 * Store-level "Sells Flowers" toggle.
 *
 * This is a PROSPECTING ATTRIBUTE, not a sales record. It answers
 * "which stores would buy flower" — the targeting list. Actual flower
 * sales live in invoices / invoice_line_items once a flower SKU exists.
 *
 * Writes to store_master (the table StoreMasterProfile reads).
 * Visible & editable: Admin, VA, Ambassador, Biker. Read-only: Driver.
 */
export function SellsFlowersToggle({
  storeId,
  initialValue,
  initialNote = null,
  flaggedAt = null,
  flaggedBy = null,
  onUpdate,
  readOnly = false,
}: SellsFlowersToggleProps) {
  const [sellsFlowers, setSellsFlowers] = useState(initialValue);
  const [note, setNote] = useState(initialNote ?? '');
  const [savedNote, setSavedNote] = useState(initialNote ?? '');
  const [stamp, setStamp] = useState<{ at: string | null; by: string | null }>({
    at: flaggedAt,
    by: flaggedBy,
  });
  const [flaggerName, setFlaggerName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSellsFlowers(initialValue);
    setNote(initialNote ?? '');
    setSavedNote(initialNote ?? '');
    setStamp({ at: flaggedAt, by: flaggedBy });
  }, [initialValue, initialNote, flaggedAt, flaggedBy]);

  useEffect(() => {
    let cancelled = false;
    if (!stamp.by) {
      setFlaggerName(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', stamp.by as string)
        .maybeSingle();
      if (!cancelled) setFlaggerName(data?.name || data?.email || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [stamp.by]);

  const persist = async (nextFlag: boolean, nextNote: string, label: string) => {
    setSaving(true);
    try {
      // verifiedUpdate throws when RLS rejects the row (PostgREST returns
      // 204 / zero rows with no error, which used to surface as a false
      // "saved" toast).
      const rows = await verifiedUpdate<{
        sells_flowers: boolean;
        sells_flowers_note: string | null;
        sells_flowers_flagged_at: string | null;
        sells_flowers_flagged_by: string | null;
      }>(label, () =>
        supabase
          .from('store_master')
          .update({
            sells_flowers: nextFlag,
            sells_flowers_note: nextFlag ? nextNote.trim() || null : null,
          })
          .eq('id', storeId),
      );

      const row = rows[0];
      setSellsFlowers(row?.sells_flowers ?? nextFlag);
      setNote(row?.sells_flowers_note ?? '');
      setSavedNote(row?.sells_flowers_note ?? '');
      setStamp({
        at: row?.sells_flowers_flagged_at ?? null,
        by: row?.sells_flowers_flagged_by ?? null,
      });

      toast.success(
        nextFlag ? 'Marked as flower seller' : 'Removed flower seller tag',
      );
      onUpdate?.();
    } catch (error) {
      console.error('Error updating sells_flowers:', error);
      toast.error(mutationErrorMessage(error), { duration: 8000 });
      // Roll the switch back — nothing was written.
      setSellsFlowers(!nextFlag);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (checked: boolean) => {
    if (readOnly || saving) return;
    setSellsFlowers(checked);
    void persist(checked, checked ? note : '', 'update flower seller flag');
  };

  const noteDirty = sellsFlowers && note.trim() !== (savedNote ?? '').trim();

  return (
    <Card className="glass-card border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Flower2 className="h-5 w-5 text-pink-500" />
          Store Attributes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-full bg-pink-500/10 flex items-center justify-center">
              <Flower2 className="h-5 w-5 text-pink-500" />
            </div>
            <div>
              <Label className="text-base font-medium">Sells Flowers</Label>
              <p className="text-sm text-muted-foreground">
                Store buys flower products
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {saving && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            <Switch
              checked={sellsFlowers}
              onCheckedChange={handleToggle}
              disabled={saving || readOnly}
            />
          </div>
        </div>

        {sellsFlowers && (
          <div className="space-y-2 rounded-md border border-border/50 bg-muted/30 p-3">
            <Label className="text-xs font-medium text-muted-foreground">
              What did the store say?
            </Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Wants 2 boxes/week, asked about pricing, buys from a guy on Fridays…"
              rows={2}
              disabled={readOnly || saving}
              className="text-sm"
            />
            {noteDirty && !readOnly && (
              <Button
                size="sm"
                onClick={() =>
                  void persist(true, note, 'save flower seller note')
                }
                disabled={saving}
              >
                {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                Save note
              </Button>
            )}
            {stamp.at && (
              <p className="text-xs text-muted-foreground">
                Flagged by {flaggerName ?? 'unknown'} · {fieldStamp(stamp.at)}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
