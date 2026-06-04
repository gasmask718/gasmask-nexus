/**
 * DDPersonalizeInviteDialog
 * Single-Gemini-call draft for a supplier invite (sms or email).
 * Operator reviews + copies; never auto-sends. Falls back to template on AI failure.
 */
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, Copy, Loader2, RotateCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  wholesalerId: string;
  companyName: string;
  trigger?: React.ReactNode;
}

export function DDPersonalizeInviteDialog({ wholesalerId, companyName, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<'sms' | 'email'>('email');
  const [busy, setBusy] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [aiGenerated, setAiGenerated] = useState<boolean | null>(null);
  const [fallback, setFallback] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('dd-personalize-invite', {
        body: { wholesaler_id: wholesalerId, channel },
      });
      if (error) throw error;
      setSubject(data?.subject ?? '');
      setBody(data?.body ?? '');
      setAiGenerated(!!data?.ai_generated);
      setFallback(!!data?.fallback_used);
      if (data?.fallback_used) toast.warning('AI unavailable — using template fallback');
    } catch (e: any) {
      toast.error(`Draft failed: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  }

  function copyAll() {
    const text = channel === 'email' && subject ? `Subject: ${subject}\n\n${body}` : body;
    navigator.clipboard.writeText(text);
    toast.success('Copied — paste into the invite');
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o && !body) generate(); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <Sparkles className="h-3.5 w-3.5 mr-1" /> AI draft
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Personalize invite — {companyName}
            {aiGenerated && <Badge variant="outline" className="ml-2">AI-drafted</Badge>}
            {fallback && <Badge variant="secondary" className="ml-2">template fallback</Badge>}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={channel} onValueChange={(v) => { setChannel(v as any); setBody(''); setSubject(''); setAiGenerated(null); }}>
          <TabsList>
            <TabsTrigger value="email">Email</TabsTrigger>
            <TabsTrigger value="sms">SMS</TabsTrigger>
          </TabsList>
        </Tabs>

        {channel === 'email' && (
          <div className="space-y-1">
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={busy} />
          </div>
        )}
        <div className="space-y-1">
          <Label>Body</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} disabled={busy} rows={channel === 'sms' ? 4 : 8} />
          <p className="text-xs text-muted-foreground">
            {channel === 'sms' ? `${body.length}/320 chars` : 'Operator reviews before sending.'}
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={generate} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
            <span className="ml-1">Regenerate</span>
          </Button>
          <Button onClick={copyAll} disabled={busy || !body}>
            <Copy className="h-4 w-4 mr-1" /> Copy & close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
