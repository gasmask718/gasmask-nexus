import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { StoreContactActions } from '@/components/store/StoreContactActions';
import { useContactVerification } from '@/components/store/ContactVerificationFlow';
import { canSendPortalInvite, contactBadges, contactVcf, type BadgeTone } from '@/lib/contactStatus';
import { readFunctionError } from '@/lib/storePortal';
import { BookmarkCheck, Download, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const TONE: Record<BadgeTone, string> = {
  done: 'bg-success/15 text-success border-success/40',
  todo: 'bg-muted text-muted-foreground border-border',
  failed: 'bg-destructive/15 text-destructive border-destructive/40',
};

function downloadVcf(name: string, store: string, phone: string) {
  const blob = new Blob([contactVcf(name, store, phone)], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = `${name.replace(/[^\w-]+/g, '_') || 'contact'}.vcf`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/** Every contact for a store with status badges, Call/Text, Saved-in-my-phone and portal invite. */
export function ContactStatusCards({ storeId }: { storeId: string }) {
  const q = useContactVerification(storeId);
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const refresh = () => ['contact-verification', 'store-contacts', 'my-work'].forEach(k => void qc.invalidateQueries({ queryKey: [k] }));
  const contacts = (q.data?.contacts || []) as any[];
  const storeName = q.data?.store_name || 'Store';
  const portalOpen = !!q.data?.portal_live || !!q.data?.is_test;

  const markSaved = async (id: string) => {
    setBusy('save' + id);
    try { const { error } = await (supabase as any).rpc('contact_mark_saved', { p_contact_id: id }); if (error) throw error; toast.success('Marked as saved in your phone'); refresh(); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(null); }
  };
  const invite = async (id: string) => {
    setBusy('inv' + id);
    try {
      const { data, error } = await supabase.functions.invoke('text-store-portal-invite', { body: { store_id: storeId, contact_id: id } });
      if (error) throw new Error(await readFunctionError(error));
      if (data?.error || data?.success === false) throw new Error(data.error || 'Invite did not send');
      toast.success('Portal invite created — text delivery pending');
    } catch (e: any) { toast.error(e.message); } finally { refresh(); setBusy(null); }
  };

  if (q.isLoading) return <Loader2 className="h-4 w-4 animate-spin" />;
  if (q.error) return <p className="text-sm text-destructive">{(q.error as Error).message}</p>;
  if (!contacts.length) return <p className="text-sm text-muted-foreground">No contacts yet — use Verify contact to add one.</p>;

  return (
    <div className="space-y-2" onClick={e => e.stopPropagation()}>
      {contacts.map(c => {
        const saved = (c.saved_by || []) as { name: string; saved_at: string; me: boolean }[];
        const mine = saved.some(s => s.me);
        return (
          <div key={c.id} className="rounded-lg border p-3 space-y-2" data-testid="contact-status-card">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0"><div className="font-semibold break-words">{c.name}</div><div className="text-xs text-muted-foreground">{c.role} · {c.phone}</div></div>
              {c.phone && <StoreContactActions contact={c} storeId={storeId} compact invalidateKeys={[['contact-verification', storeId]]} />}
            </div>
            <div className="flex flex-wrap gap-1">
              {contactBadges(c).map(b => (
                <Popover key={b.key}>
                  <PopoverTrigger asChild>
                    <button type="button" className={cn('rounded-full border px-2 py-1 text-xs font-medium', TONE[b.tone])}>{b.label}</button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto max-w-[16rem] text-sm">
                    {b.when ? new Date(b.when).toLocaleString('en-US', { timeZone: 'America/New_York' }) : 'Not yet'}
                    {b.key === 'saved' && saved.length > 0 && <ul className="mt-1 text-xs">{saved.map((s, i) => <li key={i}>{s.name} · {new Date(s.saved_at).toLocaleDateString()}</li>)}</ul>}
                  </PopoverContent>
                </Popover>
              ))}
            </div>
            {saved.length > 0 && <p className="text-xs text-muted-foreground">Saved by: {saved.map(s => s.me ? 'you' : s.name).join(', ')}</p>}
            {c.phone && (
              <div className="grid grid-cols-2 gap-2">
                <Button variant={mine ? 'secondary' : 'outline'} className="h-11" disabled={mine || busy === 'save' + c.id} onClick={() => void markSaved(c.id)}>
                  {busy === 'save' + c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookmarkCheck className="h-4 w-4" />}{mine ? 'Saved' : 'Saved in my phone'}
                </Button>
                <Button variant="outline" className="h-11" onClick={() => downloadVcf(c.name, storeName, c.phone)}><Download className="h-4 w-4" />Add to contacts</Button>
              </div>
            )}
            {canSendPortalInvite(c) && (
              <Button className="h-11 w-full" disabled={!portalOpen || busy === 'inv' + c.id} onClick={() => void invite(c.id)}>
                {busy === 'inv' + c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{portalOpen ? 'Send portal invite' : 'Portal invite (launch locked)'}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
