/**
 * Bulk AI Call Modal — 3-step wizard.
 */
import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useCreateBulkJob } from '@/hooks/useBulkOutreach';
import { supabase } from '@/integrations/supabase/client';
import { Bot, ChevronRight, ChevronLeft, Clock, AlertTriangle, Phone } from 'lucide-react';
import type { BulkStoreLite } from './BulkSmsModal';

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  ambassadorId: string;
  ambassadorName: string;
  selectedStores: BulkStoreLite[];
  onSent?: () => void;
}

function extractVars(body: string): string[] {
  const matches = body.match(/\{\{(\w+)\}\}/g) || [];
  return Array.from(new Set(matches.map((m) => m.replace(/[{}]/g, ''))));
}
function hydrate(t: string, v: Record<string, any>) {
  return t.replace(/\{\{(\w+)\}\}/g, (_, k) => (v[k] != null ? String(v[k]) : ''));
}
function isAiQuietHoursNow() {
  const h = (new Date().getUTCHours() - 5 + 24) % 24;
  return h < 9 || h >= 19;
}

export function BulkAiCallModal({ open, onOpenChange, ambassadorId, ambassadorName, selectedStores, onSent }: Props) {
  const [step, setStep] = useState(1);
  const [scripts, setScripts] = useState<any[]>([]);
  const [scriptId, setScriptId] = useState('');
  const [objective, setObjective] = useState('');
  const [langStrategy, setLangStrategy] = useState<'auto' | 'en' | 'ar'>('auto');
  const [globalVars, setGlobalVars] = useState<Record<string, string>>({});
  const [timing, setTiming] = useState<'now' | 'schedule'>('now');
  const [scheduledFor, setScheduledFor] = useState('');
  const [pacing, setPacing] = useState(30);
  const [dailyRemaining, setDailyRemaining] = useState<number | null>(null);

  const create = useCreateBulkJob();

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await (supabase as any).from('ambassador_call_scripts').select('*').eq('is_active', true);
      setScripts(data || []);
    })();
    (async () => {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase.from('communication_logs')
        .select('*', { count: 'exact', head: true })
        .eq('ambassador_id', ambassadorId).eq('call_type', 'ai_assisted').gte('created_at', dayAgo);
      const { data: amb } = await supabase.from('ambassadors').select('ai_call_daily_limit').eq('id', ambassadorId).maybeSingle();
      setDailyRemaining(Math.max(0, ((amb as any)?.ai_call_daily_limit ?? 50) - (count ?? 0)));
    })();
  }, [open, ambassadorId]);

  const script = useMemo(() => scripts.find((s) => s.id === scriptId), [scripts, scriptId]);
  const vars = useMemo(() => script ? extractVars((script.script_body || '') + ' ' + (script.opening_line || '')) : [], [script]);
  const customizableVars = useMemo(
    () => vars.filter((v) => !['store_name', 'owner_name', 'ambassador_name', 'days_since_last_order', 'last_order_date', 'outstanding_balance', 'phone'].includes(v)),
    [vars],
  );

  const buildOpening = (store: BulkStoreLite) => {
    if (!script) return '';
    const useAr = script.language === 'ar' || (langStrategy === 'auto' && store.language_preference === 'ar');
    const days = store.last_order_date ? Math.floor((Date.now() - new Date(store.last_order_date).getTime()) / 86400000) : 0;
    return hydrate(script.opening_line || '', {
      store_name: store.store_name,
      owner_name: (useAr && (store as any).owner_name_arabic) || store.owner_name || 'there',
      ambassador_name: ambassadorName,
      days_since_last_order: days,
      last_order_date: store.last_order_date ? new Date(store.last_order_date).toLocaleDateString() : 'a while ago',
      outstanding_balance: store.outstanding_balance != null ? `$${Number(store.outstanding_balance).toFixed(2)}` : '$0',
      ...globalVars,
    });
  };

  const skips = useMemo(() => {
    const noPhone = selectedStores.filter((s) => !s.phone).length;
    const blacklist = selectedStores.filter((s) => s.status === 'blacklisted').length;
    const quiet = isAiQuietHoursNow() && timing === 'now' ? selectedStores.length - noPhone - blacklist : 0;
    const capExceeded = dailyRemaining != null && selectedStores.length > dailyRemaining ? selectedStores.length - dailyRemaining : 0;
    return { noPhone, blacklist, quiet, capExceeded };
  }, [selectedStores, timing, dailyRemaining]);

  const previews = useMemo(() => {
    if (!script || !selectedStores.length) return [];
    const samples = [selectedStores[0]];
    if (selectedStores.length > 2) samples.push(selectedStores[Math.floor(selectedStores.length / 2)]);
    if (selectedStores.length > 1) samples.push(selectedStores[selectedStores.length - 1]);
    return samples.map((s) => ({ store: s, opening: buildOpening(s) }));
  }, [script, selectedStores, langStrategy, globalVars]);

  const estimatedMinutes = Math.ceil((selectedStores.length * pacing) / 60);

  const reset = () => {
    setStep(1); setScriptId(''); setObjective(''); setLangStrategy('auto'); setGlobalVars({});
    setTiming('now'); setScheduledFor(''); setPacing(30);
  };

  const handleSend = async () => {
    if (!scriptId) return;
    await create.mutateAsync({
      ambassador_id: ambassadorId,
      job_type: 'ai_call_blast',
      script_id: scriptId,
      objective: objective || script?.objective || null,
      target_store_ids: selectedStores.map((s) => s.id),
      language_strategy: langStrategy,
      custom_variables: Object.keys(globalVars).length ? globalVars : null,
      scheduled_for: timing === 'schedule' && scheduledFor ? new Date(scheduledFor).toISOString() : null,
      pacing_seconds: pacing,
    });
    reset();
    onOpenChange(false);
    onSent?.();
  };

  return (
    <Dialog open={open} onOpenChange={(b) => { if (!b) reset(); onOpenChange(b); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Bulk AI Call Blast — Step {step} of 3
          </DialogTitle>
          <DialogDescription>
            Queueing <span className="font-medium text-foreground">{selectedStores.length}</span> AI calls
            {dailyRemaining != null && <span className="ml-2 text-xs">({dailyRemaining} calls left today)</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 -mt-2">
          {selectedStores.slice(0, 5).map((s) => (
            <Avatar key={s.id} className="h-7 w-7 border-2 border-background">
              <AvatarFallback className="text-[10px]">{s.store_name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          ))}
          {selectedStores.length > 5 && <span className="text-xs text-muted-foreground">+{selectedStores.length - 5} more</span>}
        </div>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {step === 1 && (
            <div className="space-y-4 py-2">
              <div>
                <Label>Script</Label>
                <Select value={scriptId} onValueChange={setScriptId}>
                  <SelectTrigger><SelectValue placeholder="Choose a script…" /></SelectTrigger>
                  <SelectContent>
                    {scripts.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="font-medium">{s.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">{s.language?.toUpperCase()}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {script && (
                <div className="text-xs text-muted-foreground border rounded p-2 bg-muted/30">
                  <div className="font-medium mb-1">Opening:</div>
                  <div className="italic">{script.opening_line}</div>
                </div>
              )}
              <div>
                <Label>Objective override (optional)</Label>
                <Input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder={script?.objective || 'e.g. reorder push'} />
              </div>
              <div>
                <Label>Language strategy</Label>
                <RadioGroup value={langStrategy} onValueChange={(v) => setLangStrategy(v as any)} className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="auto" /> Auto</label>
                  <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="en" /> EN</label>
                  <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="ar" /> AR</label>
                </RadioGroup>
              </div>
              {customizableVars.length > 0 && (
                <div>
                  <Label>Custom variables</Label>
                  <div className="space-y-2 mt-2">
                    {customizableVars.map((v) => (
                      <div key={v} className="flex items-center gap-2">
                        <span className="text-xs font-mono w-44 text-muted-foreground">{`{{${v}}}`}</span>
                        <Input value={globalVars[v] || ''} onChange={(e) => setGlobalVars((p) => ({ ...p, [v]: e.target.value }))} className="h-8" placeholder="auto-fill" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3 py-2">
              {(skips.noPhone + skips.blacklist + skips.quiet + skips.capExceeded) > 0 && (
                <div className="border border-amber-500/40 bg-amber-500/10 rounded p-3 text-sm">
                  <div className="flex items-center gap-2 font-medium text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4" />
                    Warnings
                  </div>
                  <ul className="mt-2 ml-6 list-disc text-xs text-muted-foreground">
                    {skips.noPhone > 0 && <li>{skips.noPhone} no phone</li>}
                    {skips.blacklist > 0 && <li>{skips.blacklist} blacklisted</li>}
                    {skips.quiet > 0 && <li>{skips.quiet} outside AI quiet hours (9a–7p ET)</li>}
                    {skips.capExceeded > 0 && <li>{skips.capExceeded} exceed today's AI call cap (will be deferred)</li>}
                  </ul>
                </div>
              )}
              <div className="text-sm font-medium">Opening previews</div>
              {previews.map((p, i) => (
                <div key={i} className="border rounded p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{i === 0 ? 'First' : i === previews.length - 1 ? 'Last' : 'Middle'}</Badge>
                    <span className="text-sm font-medium">{p.store.store_name}</span>
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{p.store.phone || '(no phone)'}</span>
                  </div>
                  <div className="text-sm italic">"{p.opening}"</div>
                </div>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 py-2">
              <div>
                <Label>Timing</Label>
                <RadioGroup value={timing} onValueChange={(v) => setTiming(v as any)} className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="now" /> Send now</label>
                  <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="schedule" /> Schedule</label>
                </RadioGroup>
                {timing === 'schedule' && (
                  <Input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} className="mt-2" />
                )}
              </div>
              <div>
                <Label className="flex items-center justify-between">
                  <span>Pacing</span>
                  <span className="text-xs text-muted-foreground">1 every {pacing}s</span>
                </Label>
                <Slider value={[pacing]} onValueChange={(v) => setPacing(v[0])} min={10} max={120} step={5} className="mt-2" />
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  ~{estimatedMinutes} minutes total
                </div>
              </div>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between border-t pt-3">
          <div className="flex gap-2">
            {step > 1 && <Button variant="ghost" onClick={() => setStep((s) => s - 1)}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
            {step < 3 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={step === 1 && !scriptId}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
            ) : (
              <Button onClick={handleSend} disabled={create.isPending || (timing === 'schedule' && !scheduledFor)}>
                <Bot className="h-4 w-4 mr-1" />
                {timing === 'now' ? `Queue ${selectedStores.length} calls` : 'Schedule'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
