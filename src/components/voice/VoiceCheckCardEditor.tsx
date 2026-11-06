import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { VOICE_COUNT_BRANDS, type VoiceCheckCard } from '@/lib/voice/voiceUpdate';
import { AlertTriangle, DollarSign, MapPin, Plus, Store } from 'lucide-react';

export function VoiceCheckCardEditor({ card, onChange, onOpenPayment }: {
  card: VoiceCheckCard;
  onChange: (card: VoiceCheckCard) => void;
  onOpenPayment: () => void;
}) {
  const patch = (value: Partial<VoiceCheckCard>) => onChange({ ...card, ...value });
  const money = card.money;

  return <div className="space-y-3" data-testid="voice-check-card">
    <section className="rounded-lg border bg-card p-3">
      <Label className="text-xs text-muted-foreground">Store</Label>
      <div className="mt-1 flex items-start gap-2"><Store className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div><p className="font-semibold">{card.store_name}</p><p className="text-sm text-muted-foreground">{card.store_address || 'No address on file'}</p></div></div>
    </section>

    <section className="rounded-lg border bg-card p-3 space-y-3">
      <div className="flex items-center justify-between"><div><h4 className="font-semibold">Count</h4><p className="text-xs text-muted-foreground">Tap a number to correct it.</p></div><Button type="button" size="sm" variant="outline" onClick={() => patch({ counts: [...card.counts, { brand_id: 'gasmasktubes', brand_name: 'GasMask Tubes', count: 0, unit: 'tubes' }] })}><Plus className="h-4 w-4" />Add</Button></div>
      {!card.counts.length && <p className="text-sm text-muted-foreground">No count heard. Add one only if you want to save it.</p>}
      {card.counts.map((count, index) => <div key={`${count.brand_id}-${index}`} className="grid grid-cols-[1fr_92px] items-end gap-2">
        <div><Label>Brand</Label><Select value={count.brand_id} onValueChange={brandId => { const brand = VOICE_COUNT_BRANDS.find(b => b.id === brandId)!; patch({ counts: card.counts.map((c, i) => i === index ? { ...c, brand_id: brand.id, brand_name: brand.name, unit: brand.unit } : c) }); }}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent>{VOICE_COUNT_BRANDS.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>{count.unit} left</Label><Input className="h-11" type="number" min={0} step={1} inputMode="numeric" value={count.count ?? ''} onChange={e => patch({ counts: card.counts.map((c, i) => i === index ? { ...c, count: e.target.value === '' ? null : Number(e.target.value) } : c) })} /></div>
      </div>)}
    </section>

    <section className="rounded-lg border bg-card p-3 space-y-3">
      <div className="flex items-center justify-between"><h4 className="font-semibold">Order request</h4><Button type="button" size="sm" variant={card.order.requested ? 'default' : 'outline'} onClick={() => patch({ order: { ...card.order, requested: !card.order.requested } })}>{card.order.requested ? 'Included' : 'Not included'}</Button></div>
      {card.order.requested && <>
        {card.order.items.map((item, index) => <div key={`${item.brand_key}-${index}`} className="grid grid-cols-[1fr_100px] items-end gap-2"><div><Label>Brand</Label><Input className="h-11" value={item.name} onChange={e => patch({ order: { ...card.order, items: card.order.items.map((x, i) => i === index ? { ...x, name: e.target.value } : x) } })} /></div><div><Label>Boxes</Label><Input className="h-11" type="number" min={0.5} max={100} step={0.5} value={item.quantity} onChange={e => patch({ order: { ...card.order, items: card.order.items.map((x, i) => i === index ? { ...x, quantity: Number(e.target.value) } : x) } })} /></div></div>)}
        <div className="grid grid-cols-2 gap-2"><div><Label>Deliver by</Label><Select value={card.order.deliver_by} onValueChange={(value: 'next_visit' | 'tomorrow' | 'date') => patch({ order: { ...card.order, deliver_by: value } })}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="next_visit">Next visit</SelectItem><SelectItem value="tomorrow">Tomorrow</SelectItem><SelectItem value="date">Pick date</SelectItem></SelectContent></Select></div>{card.order.deliver_by === 'date' && <div><Label>Date</Label><Input className="h-11" type="date" value={card.order.deliver_date || ''} onChange={e => patch({ order: { ...card.order, deliver_date: e.target.value } })} /></div>}</div>
        <div><Label>Quick order note</Label><Input className="h-11" value={card.order.note || ''} onChange={e => patch({ order: { ...card.order, note: e.target.value } })} /></div>
      </>}
    </section>

    <section className="rounded-lg border bg-card p-3 space-y-3">
      <div className="flex items-center justify-between"><div className="flex items-center gap-2"><h4 className="font-semibold">Contact</h4>{card.contact.mentioned && card.contact.is_new && <Badge variant="secondary">NEW</Badge>}</div><Button type="button" size="sm" variant={card.contact.mentioned ? 'default' : 'outline'} onClick={() => patch({ contact: { ...card.contact, mentioned: !card.contact.mentioned } })}>{card.contact.mentioned ? 'Included' : 'Not included'}</Button></div>
      {card.contact.mentioned && <><div><Label>Name</Label><Input className="h-11" value={card.contact.name || ''} onChange={e => patch({ contact: { ...card.contact, name: e.target.value } })} /></div><div className="grid grid-cols-2 gap-2"><div><Label>Phone</Label><Input className="h-11" type="tel" value={card.contact.phone || ''} onChange={e => patch({ contact: { ...card.contact, phone: e.target.value } })} /></div><div><Label>Role</Label><Select value={card.contact.role || 'worker'} onValueChange={role => patch({ contact: { ...card.contact, role } })}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="owner">Owner</SelectItem><SelectItem value="manager">Manager</SelectItem><SelectItem value="worker">Worker</SelectItem></SelectContent></Select></div></div></>}
    </section>

    <section className="rounded-lg border bg-card p-3 space-y-3">
      <div className="flex items-center justify-between"><div><h4 className="font-semibold">Owner's other stores / leads</h4><p className="text-xs text-muted-foreground">Confirmed leads join the connected-stores list.</p></div><Button type="button" size="sm" variant="outline" onClick={() => patch({ leads: [...card.leads, { name: '', address: '', city: '', state: 'NY' }] })}><Plus className="h-4 w-4" />Add</Button></div>
      {!card.leads.length && <p className="text-sm text-muted-foreground">No other stores heard.</p>}
      {card.leads.map((lead, index) => <div key={index} className="space-y-2 rounded-md border p-2"><div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /><Badge variant="outline">Lead {index + 1}</Badge></div><Input aria-label={`Lead ${index + 1} name`} placeholder="Store name" value={lead.name} onChange={e => patch({ leads: card.leads.map((x, i) => i === index ? { ...x, name: e.target.value } : x) })} /><Input aria-label={`Lead ${index + 1} street`} placeholder="Street address" value={lead.address} onChange={e => patch({ leads: card.leads.map((x, i) => i === index ? { ...x, address: e.target.value } : x) })} /><div className="grid grid-cols-[1fr_76px] gap-2"><Input aria-label={`Lead ${index + 1} city`} placeholder="City" value={lead.city} onChange={e => patch({ leads: card.leads.map((x, i) => i === index ? { ...x, city: e.target.value } : x) })} /><Input aria-label={`Lead ${index + 1} state`} placeholder="State" value={lead.state} onChange={e => patch({ leads: card.leads.map((x, i) => i === index ? { ...x, state: e.target.value } : x) })} /></div></div>)}
    </section>

    <section className="rounded-lg border bg-card p-3"><Label htmlFor="voice-note-text">Note text</Label><Textarea id="voice-note-text" rows={4} placeholder="Stickers, best time, boss name, complaints…" value={card.note || ''} onChange={e => patch({ note: e.target.value })} /></section>

    <section className="rounded-lg border border-warning/50 bg-warning/10 p-3">
      <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" /><Label className="text-warning">Status change — only when clearly said</Label></div><Select value={card.status_change || 'none'} onValueChange={value => patch({ status_change: value === 'none' ? null : value as VoiceCheckCard['status_change'] })}><SelectTrigger className="mt-2 h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No status change</SelectItem><SelectItem value="closed">Closed permanently</SelectItem><SelectItem value="no_tobacco">No tobacco</SelectItem><SelectItem value="not_interested">Not interested</SelectItem></SelectContent></Select>
    </section>

    {money.mentioned && <section className="rounded-lg border border-destructive/60 bg-destructive/10 p-3 space-y-2" data-testid="voice-money-warning"><div className="flex items-center gap-2 font-semibold text-destructive"><DollarSign className="h-5 w-5" />Money mentioned — not saved from voice</div><div className="grid grid-cols-2 gap-2"><div><Label>Amount heard</Label><Input className="h-11" type="number" min={0} step={0.01} value={money.amount ?? ''} onChange={e => patch({ money: { ...money, amount: e.target.value === '' ? null : Number(e.target.value) } })} /></div><div><Label>Money note</Label><Input className="h-11" value={money.note || ''} onChange={e => patch({ money: { ...money, note: e.target.value } })} /></div></div><p className="text-sm">Confirm the amount and payment method on the normal invoice screen. Its receipt comes from there.</p><Button type="button" variant="destructive" className="h-12 w-full" onClick={onOpenPayment}>Open normal payment screen</Button></section>}
  </div>;
}
