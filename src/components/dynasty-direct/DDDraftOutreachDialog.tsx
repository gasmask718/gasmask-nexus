/**
 * DDDraftOutreachDialog
 *
 * Generic 'Draft outreach' dialog: calls dd-draft-outreach for an AI draft,
 * lets the operator edit, and stages the message as a communication_drafts
 * row (status='draft', ai_generated=true) for the messaging hub to send.
 *
 * Never auto-sends. The AI-generated badge is shown explicitly.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Loader2, Sparkles, RefreshCw, Send } from 'lucide-react';
import { toast } from 'sonner';

type Intent = 'reengage' | 'onboard' | 'restock' | 'check-in';
type Channel = 'sms' | 'email';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /**
   * Accepts either a wholesaler_profiles.id OR a wholesalers.id — the dialog
   * resolves the matching profile, recipients and channel availability.
   */
  wholesalerId: string;
  wholesalerName?: string;
  defaultIntent?: Intent;
  defaultChannel?: Channel;
}

export function DDDraftOutreachDialog({
  open, onOpenChange, wholesalerId, wholesalerName,
  defaultIntent = 'check-in', defaultChannel,
}: Props) {
  const [intent, setIntent] = useState<Intent>(defaultIntent);
  const [channel, setChannel] = useState<Channel>(defaultChannel ?? 'sms');
  const [loading, setLoading] = useState(false);
  const [body, setBody] = useState('');
  const [subject, setSubject] = useState('');
  const [model, setModel] = useState<string | null>(null);
  const [staging, setStaging] = useState(false);

  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const [recipientPhone, setRecipientPhone] = useState<string | null>(null);
  const [recipientEmail, setRecipientEmail] = useState<string | null>(null);
  const [recipientName, setRecipientName] = useState<string | null>(wholesalerName ?? null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  async function resolveProfile(): Promise<string | null> {
    setResolveError(null);
    // Try as profile id, then fall back to wholesalers.id via the FK link.
    const direct = await supabase
      .from('wholesaler_profiles')
      .select('id, company_name, contact_name, phone, email')
      .eq('id', wholesalerId)
      .maybeSingle();
    let row = direct.data;
    if (!row) {
      const linked = await supabase
        .from('wholesaler_profiles')
        .select('id, company_name, contact_name, phone, email')
        .eq('wholesaler_id', wholesalerId)
        .maybeSingle();
      row = linked.data;
    }
    if (!row) {
      setResolveError('No linked marketplace profile for this supplier (cannot draft).');
      return null;
    }
    setResolvedId(row.id);
    setRecipientPhone(row.phone);
    setRecipientEmail(row.email);
    setRecipientName(row.contact_name || row.company_name || wholesalerName || null);
    if (!defaultChannel) setChannel(row.phone ? 'sms' : 'email');
    return row.id;
  }

  async function draft(idOverride?: string) {
    const id = idOverride ?? resolvedId;
    if (!id) return;
    setLoading(true);
    setModel(null);
    try {
      const { data, error } = await supabase.functions.invoke('dd-draft-outreach', {
        body: { wholesaler_id: id, intent, channel },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setBody(data.body ?? '');
      setSubject(data.subject ?? '');
      setModel(data.model ?? null);
    } catch (e: any) {
      toast.error(e.message || 'Draft failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    (async () => {
      const id = await resolveProfile();
      if (id) await draft(id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function stageDraft() {
    if (!body.trim()) { toast.error('Body is empty'); return; }
    setStaging(true);
    try {
      const { error } = await supabase.from('communication_drafts').insert({
        channel,
        body: body.trim(),
        subject: channel === 'email' ? subject.trim() || null : null,
        recipient_phone: channel === 'sms' ? recipientPhone ?? null : null,
        recipient_email: channel === 'email' ? recipientEmail ?? null : null,
        recipient_name: wholesalerName ?? null,
        entity_type: 'wholesaler',
        entity_id: wholesalerId,
        ai_generated: true,
        automation_source: 'dd-draft-outreach',
        context_data: { intent, ui: 'DDDraftOutreachDialog' },
        status: 'draft',
        requires_approval: true,
      });
      if (error) throw error;
      toast.success('Staged in messaging hub — review & send there');
      onOpenChange(false);
      setBody(''); setSubject(''); setModel(null);
    } catch (e: any) {
      toast.error(e.message || 'Failed to stage');
    } finally {
      setStaging(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setBody(''); setSubject(''); setModel(null); } }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Draft outreach
            {wholesalerName && <span className="text-muted-foreground font-normal">· {wholesalerName}</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div>
              <Label className="text-xs text-muted-foreground">Intent</Label>
              <ToggleGroup type="single" value={intent} onValueChange={(v) => v && setIntent(v as Intent)} className="mt-1">
                <ToggleGroupItem value="check-in" size="sm">Check-in</ToggleGroupItem>
                <ToggleGroupItem value="reengage" size="sm">Re-engage</ToggleGroupItem>
                <ToggleGroupItem value="restock" size="sm">Restock</ToggleGroupItem>
                <ToggleGroupItem value="onboard" size="sm">Onboard</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Channel</Label>
              <ToggleGroup type="single" value={channel} onValueChange={(v) => v && setChannel(v as Channel)} className="mt-1">
                <ToggleGroupItem value="sms" size="sm" disabled={!recipientPhone}>SMS</ToggleGroupItem>
                <ToggleGroupItem value="email" size="sm" disabled={!recipientEmail}>Email</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <Button variant="outline" size="sm" onClick={draft} disabled={loading} className="ml-auto">
              {loading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
              Regenerate
            </Button>
          </div>

          {channel === 'email' && (
            <div>
              <Label className="text-xs">Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1" />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs">Body</Label>
              {model && (
                <Badge variant="outline" className="text-[10px] bg-primary/10 border-primary/30 text-primary">
                  <Sparkles className="h-2.5 w-2.5 mr-1" /> AI-generated · {model.split('/').pop()}
                </Badge>
              )}
            </div>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={channel === 'email' ? 8 : 5}
              placeholder={loading ? 'Drafting…' : 'Draft will appear here'}
              className="font-mono text-sm"
            />
            <div className="text-[11px] text-muted-foreground mt-1 flex justify-between">
              <span>{channel === 'sms' ? `${body.length}/320` : `${body.length} chars`}</span>
              <span>Edit freely — operator review required before send</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={stageDraft} disabled={staging || loading || !body.trim()}>
            {staging ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
            Stage in messaging hub
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
