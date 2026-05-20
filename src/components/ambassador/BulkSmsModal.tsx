/**
 * SMS Bulk Modal — 3-step wizard.
 * Step 1: Template & language strategy
 * Step 2: Preview (3 samples + skip warnings)
 * Step 3: Send options (now/schedule + pacing)
 */
import { useMemo, useState } from 'react';
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
import { useTemplates, renderTemplate, MessageTemplate } from '@/hooks/useAmbassadorComms';
import { useCreateBulkJob } from '@/hooks/useBulkOutreach';
import { Rocket, ChevronRight, ChevronLeft, Clock, AlertTriangle } from 'lucide-react';

export interface BulkStoreLite {
  id: string;
  store_name: string;
  phone?: string | null;
  owner_name?: string | null;
  language_preference?: string | null;
  status?: string | null;
  last_order_date?: string | null;
  outstanding_balance?: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  ambassadorId: string;
  ambassadorName: string;
  selectedStores: BulkStoreLite[];
  onSent?: () => void;
}

const TEMPLATE_VARS = ['{{store_name}}', '{{owner_name}}', '{{ambassador_name}}', '{{days_since_last_order}}', '{{outstanding_balance}}'];

function extractVars(body: string): string[] {
  const matches = body.match(/\{\{(\w+)\}\}/g) || [];
  return Array.from(new Set(matches.map((m) => m.replace(/[{}]/g, ''))));
}

function isQuietHoursNow() {
  const h = (new Date().getUTCHours() - 5 + 24) % 24;
  return h < 8 || h >= 21;
}

export function BulkSmsModal({ open, onOpenChange, ambassadorId, ambassadorName, selectedStores, onSent }: Props) {
  const [step, setStep] = useState(1);
  const [templateId, setTemplateId] = useState<string>('');
  const [langStrategy, setLangStrategy] = useState<'auto' | 'en' | 'ar'>('auto');
  const [globalVars, setGlobalVars] = useState<Record<string, string>>({});
  const [timing, setTiming] = useState<'now' | 'schedule'>('now');
  const [scheduledFor, setScheduledFor] = useState<string>('');
  const [pacing, setPacing] = useState<number>(3);

  const { templates } = useTemplates();
  const create = useCreateBulkJob();

  const template = useMemo(() => templates.find((t) => t.id === templateId), [templates, templateId]);
  const vars = useMemo(() => template ? extractVars(template.body_en || '') : [], [template]);
  const customizableVars = useMemo(
    () => vars.filter((v) => !['store_name', 'owner_name', 'ambassador_name', 'days_since_last_order', 'last_order_date', 'outstanding_balance', 'phone'].includes(v)),
    [vars],
  );

  const buildBody = (store: BulkStoreLite): string => {
    if (!template) return '';
    const useAr = langStrategy === 'ar' || (langStrategy === 'auto' && store.language_preference === 'ar');
    const base = (useAr && (template as any).body_ar) ? (template as any).body_ar : template.body_en || '';
    const days = store.last_order_date ? Math.floor((Date.now() - new Date(store.last_order_date).getTime()) / 86400000) : 0;
    return renderTemplate(base, {
      store_name: store.store_name,
      owner_name: (useAr && (store as any).owner_name_arabic) || store.owner_name || 'there',
      ambassador_name: ambassadorName,
      days_since_last_order: days,
      last_order_date: store.last_order_date ? new Date(store.last_order_date).toLocaleDateString() : 'a while ago',
      outstanding_balance: store.outstanding_balance != null ? `$${Number(store.outstanding_balance).toFixed(2)}` : '$0',
      ...globalVars,
    });
  };

  // Compute skip warnings
  const skips = useMemo(() => {
    const noPhone = selectedStores.filter((s) => !s.phone);
    const blacklist = selectedStores.filter((s) => s.status === 'blacklisted');
    const quiet = isQuietHoursNow() && timing === 'now' ? selectedStores.length - noPhone.length - blacklist.length : 0;
    return { noPhone: noPhone.length, blacklist: blacklist.length, quiet };
  }, [selectedStores, timing]);

  const previews = useMemo(() => {
    if (!template || selectedStores.length === 0) return [];
    const samples = [selectedStores[0]];
    if (selectedStores.length > 2) samples.push(selectedStores[Math.floor(selectedStores.length / 2)]);
    if (selectedStores.length > 1) samples.push(selectedStores[selectedStores.length - 1]);
    return samples.map((s) => ({ store: s, body: buildBody(s) }));
  }, [template, selectedStores, langStrategy, globalVars]);

  const estimatedMinutes = Math.ceil((selectedStores.length * pacing) / 60);

  const reset = () => {
    setStep(1); setTemplateId(''); setLangStrategy('auto'); setGlobalVars({});
    setTiming('now'); setScheduledFor(''); setPacing(3);
  };

  const handleSend = async () => {
    if (!templateId) return;
    await create.mutateAsync({
      ambassador_id: ambassadorId,
      job_type: 'sms_blast',
      template_id: templateId,
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
            <Rocket className="h-5 w-5 text-primary" />
            Bulk SMS Blast — Step {step} of 3
          </DialogTitle>
          <DialogDescription>
            Sending to <span className="font-medium text-foreground">{selectedStores.length}</span> stores
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 -mt-2">
          {selectedStores.slice(0, 5).map((s) => (
            <Avatar key={s.id} className="h-7 w-7 border-2 border-background">
              <AvatarFallback className="text-[10px]">{s.store_name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          ))}
          {selectedStores.length > 5 && (
            <span className="text-xs text-muted-foreground">+{selectedStores.length - 5} more</span>
          )}
        </div>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-4 py-2">
              <div>
                <Label>Template</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger><SelectValue placeholder="Choose a template…" /></SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <span className="font-medium">{t.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">{t.category}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {template && (
                <div className="text-xs text-muted-foreground border rounded p-2 bg-muted/30">
                  <div className="font-mono whitespace-pre-wrap">{template.body_en}</div>
                </div>
              )}
              <div>
                <Label>Language strategy</Label>
                <RadioGroup value={langStrategy} onValueChange={(v) => setLangStrategy(v as any)} className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="auto" /> Auto (per-store)</label>
                  <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="en" /> English</label>
                  <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="ar" /> Arabic</label>
                </RadioGroup>
              </div>
              {customizableVars.length > 0 && (
                <div>
                  <Label>Custom variables (one value applied to all)</Label>
                  <div className="space-y-2 mt-2">
                    {customizableVars.map((v) => (
                      <div key={v} className="flex items-center gap-2">
                        <span className="text-xs font-mono w-44 text-muted-foreground">{`{{${v}}}`}</span>
                        <Input
                          placeholder="Leave blank for auto-fill"
                          value={globalVars[v] || ''}
                          onChange={(e) => setGlobalVars((p) => ({ ...p, [v]: e.target.value }))}
                          className="h-8"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-3 py-2">
              {(skips.noPhone + skips.blacklist + skips.quiet) > 0 && (
                <div className="border border-amber-500/40 bg-amber-500/10 rounded p-3 text-sm">
                  <div className="flex items-center gap-2 font-medium text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4" />
                    {skips.noPhone + skips.blacklist + skips.quiet} stores will be skipped
                  </div>
                  <ul className="mt-2 ml-6 list-disc text-xs text-muted-foreground">
                    {skips.noPhone > 0 && <li>{skips.noPhone} no phone number</li>}
                    {skips.blacklist > 0 && <li>{skips.blacklist} blacklisted</li>}
                    {skips.quiet > 0 && <li>{skips.quiet} outside quiet hours (8a–9p ET)</li>}
                  </ul>
                </div>
              )}
              <div className="text-sm font-medium">Preview ({previews.length} samples)</div>
              {previews.map((p, i) => (
                <div key={i} className="border rounded p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{i === 0 ? 'First' : i === previews.length - 1 ? 'Last' : 'Middle'}</Badge>
                    <span className="text-sm font-medium">{p.store.store_name}</span>
                    <span className="text-xs text-muted-foreground">→ {p.store.phone || '(no phone)'}</span>
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{p.body}</div>
                </div>
              ))}
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-4 py-2">
              <div>
                <Label>Timing</Label>
                <RadioGroup value={timing} onValueChange={(v) => setTiming(v as any)} className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="now" /> Send now</label>
                  <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="schedule" /> Schedule</label>
                </RadioGroup>
                {timing === 'schedule' && (
                  <Input
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={(e) => setScheduledFor(e.target.value)}
                    className="mt-2"
                  />
                )}
              </div>
              <div>
                <Label className="flex items-center justify-between">
                  <span>Pacing</span>
                  <span className="text-xs text-muted-foreground">1 every {pacing}s</span>
                </Label>
                <Slider value={[pacing]} onValueChange={(v) => setPacing(v[0])} min={1} max={30} step={1} className="mt-2" />
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  ~{estimatedMinutes} minutes total ({selectedStores.length} × {pacing}s)
                </div>
              </div>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between border-t pt-3">
          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
            {step < 3 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={step === 1 && !templateId}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSend} disabled={create.isPending || (timing === 'schedule' && !scheduledFor)}>
                <Rocket className="h-4 w-4 mr-1" />
                {timing === 'now' ? `Send to ${selectedStores.length}` : 'Schedule'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
