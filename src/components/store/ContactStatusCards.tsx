import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { StoreContactActions } from '@/components/store/StoreContactActions';
import { useContactVerification } from '@/components/store/ContactVerificationFlow';
import { canSendPortalInvite, contactBadges, formatUs, ourVcf, OUR_NAME, OUR_NUMBER, PORTAL_LINK, type BadgeTone } from '@/lib/contactStatus';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { QRCodeSVG } from 'qrcode.react';
import { readFunctionError } from '@/lib/storePortal';
import { BookmarkCheck, Download, Loader2, QrCode, Send } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const TONE: Record<BadgeTone, string> = {
  done: 'bg-success/15 text-success border-success/40',
  todo: 'bg-muted text-muted-foreground border-border',
  failed: 'bg-destructive/15 text-destructive border-destructive/40',
};

function downloadVcf() {
  const blob = new Blob([ourVcf()], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = 'GasMask-Ching.vcf'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/** Every contact for a store with status badges, Call/Text, Saved-in-my-phone and portal invite. */
export function ContactStatusCards({ storeId }: { storeId: string }) {
  const q = useContactVerification(storeId);
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [showFor, setShowFor] = useState<any | null>(null);
  const refresh = () => ['contact-verification', 'store-contacts', 'my-work'].forEach(k => void qc.invalidateQueries({ queryKey: [k] }));
  const contacts = (q.data?.contacts || []) as any[];
  const portalOpen = !!q.data?.portal_live || !!q.data?.is_test;

  const markSaved = async (id: string) => {
    setBusy('save' + id);
    try { const { error } = await (supabase as any).rpc('contact_mark_saved_our_number', { p_contact_id: id }); if (error) throw error; toast.success('Recorded: they saved our number'); setShowFor(null); refresh(); }
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
        const mine = !!c.saved_our_number;
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
                    {b.key === 'saved' && c.saved_our_number && <div className="mt-1 text-xs">{c.saved_our_number_source === 'text_reply' ? 'They replied SAVED' : `Confirmed by ${c.saved_our_number_by || 'staff'}`}</div>}
                  </PopoverContent>
                </Popover>
              ))}
            </div>
            {c.phone && (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="h-11" onClick={() => setShowFor(c)}><QrCode className="h-4 w-4" />Show our number</Button>
                <Button variant={mine ? 'secondary' : 'default'} className="h-11 whitespace-normal" disabled={mine || busy === 'save' + c.id} onClick={() => void markSaved(c.id)}>
                  {busy === 'save' + c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookmarkCheck className="h-4 w-4" />}{mine ? 'Saved our number' : 'They saved our number'}
                </Button>
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
      <Dialog open={!!showFor} onOpenChange={o => !o && setShowFor(null)}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-sm p-4 rounded-lg text-center">
          <DialogHeader><DialogTitle>Save our number</DialogTitle><DialogDescription>Show this to {showFor?.name || 'them'}. Scan the code with the phone camera to add the contact.</DialogDescription></DialogHeader>
          <div className="text-lg font-semibold">{OUR_NAME}</div>
          <a href={`tel:${OUR_NUMBER}`} className="block text-3xl font-bold tracking-wide">{formatUs(OUR_NUMBER)}</a>
          <div className="mx-auto rounded-lg bg-card p-3" data-testid="our-number-qr"><QRCodeSVG value={ourVcf()} size={220} bgColor="#ffffff" fgColor="#000000" includeMargin /></div>
          <p className="text-xs text-muted-foreground break-all">{PORTAL_LINK}</p>
          <Button variant="outline" className="h-11 w-full" onClick={downloadVcf}><Download className="h-4 w-4" />Download contact card</Button>
          {showFor && <Button className="h-12 w-full" disabled={busy === 'save' + showFor.id || !!showFor.saved_our_number} onClick={() => void markSaved(showFor.id)}><BookmarkCheck className="h-4 w-4" />They saved our number</Button>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
