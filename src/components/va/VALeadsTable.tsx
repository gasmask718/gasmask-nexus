import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useVASession } from '@/contexts/VASessionContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Phone, FileText, Send, Search, Loader2, Users, Zap, PhoneCall, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { isSpanishLead } from '@/lib/spanishLeadDetector';
import { SendReceptionistLinkModal } from '@/components/brandaro/SendReceptionistLinkModal';
import { SendDemoModal } from '@/components/brandaro/SendDemoModal';

interface Lead {
  id: string;
  business_name: string;
  phone: string;
  email: string | null;
  status: string;
  created_at: string;
  assigned_va: string | null;
  industry?: string | null;
  category?: string | null;
  subtypes?: string | null;
  city?: string | null;
  google_place_id?: string | null;
}

interface CampaignLead {
  id?: string;
  name: string;
  phone: string;
}

interface VALeadsTableProps {
  onCall: (lead: Lead) => void;
  onCreateInvoice: (lead: Lead) => void;
  onSendInvoice: (lead: Lead) => void;
  onStartCampaign?: (leads: CampaignLead[]) => void;
  onQuickDial?: (lead: CampaignLead) => void;
  /** Where the list comes from — defaults to Brandaro's qualified leads */
  leadSource?: 'brandaro_qualified_leads' | 'v_store_who_to_contact';
  /** Brandaro-only row tools (invoices, receptionist link, demo) */
  brandaroTools?: boolean;
}

const STATUS_CONFIG: Record<string, { bg: string; text: string }> = {
  new: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
  contacted: { bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
  interested: { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  not_interested: { bg: 'bg-red-500/15', text: 'text-red-400' },
  callback: { bg: 'bg-orange-500/15', text: 'text-orange-400' },
  closed: { bg: 'bg-green-500/15', text: 'text-green-400' },
};

export function VALeadsTable({
  onCall, onCreateInvoice, onSendInvoice, onStartCampaign, onQuickDial,
  leadSource = 'brandaro_qualified_leads',
  brandaroTools = true,
}: VALeadsTableProps) {
  const { t } = useVASession();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [quickPhone, setQuickPhone] = useState('');
  const [quickName, setQuickName] = useState('');
  const [languageFilter, setLanguageFilter] = useState<'all' | 'spanish'>('all');
  const [receptionistLead, setReceptionistLead] = useState<Lead | null>(null);
  const [demoLead, setDemoLead] = useState<Lead | null>(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['va-leads', leadSource, user?.id],
    queryFn: async () => {
      if (leadSource === 'v_store_who_to_contact') {
        // Grabba brands (GasMask / Grabba R Us / Hot Scolatti / Hot Mama):
        // call the primary contact at each store.
        const { data } = await (supabase as any)
          .from('v_store_who_to_contact')
          .select('store_id, store_name, phone, name, role, how_to_reach')
          .not('phone', 'is', null)
          .eq('try_this_first', 1)
          .order('store_name')
          .limit(200);
        return (data || []).map((s: any) => ({
          id: s.store_id,
          business_name: s.store_name,
          phone: s.phone,
          email: null,
          status: 'new',
          created_at: '',
          assigned_va: null,
          category: s.role ? `${s.role}${s.name ? ` · ${s.name}` : ''}` : null,
        })) as Lead[];
      }
      const { data } = await (supabase as any)
        .from('brandaro_qualified_leads')
        .select('id, business_name, phone_number, email, lead_status, created_at, assigned_va, industry, category, subtypes, city, google_place_id')
        .eq('assigned_va', user!.id)
        .order('created_at', { ascending: false })
        .limit(200);
      return (data || []).map((l: any) => ({
        ...l,
        phone: l.phone_number,
        status: l.lead_status,
      })) as Lead[];
    },
    enabled: !!user,
  });

  const filtered = useMemo(() => {
    let rows = leads;
    if (languageFilter === 'spanish') rows = rows.filter(isSpanishLead);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        l =>
          l.business_name?.toLowerCase().includes(q) ||
          l.phone?.includes(q) ||
          l.email?.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [leads, search, languageFilter]);

  const spanishCount = useMemo(() => leads.filter(isSpanishLead).length, [leads]);

  const dialableFiltered = useMemo(() => filtered.filter(l => !!l.phone), [filtered]);
  const allDialableSelected = dialableFiltered.length > 0 && dialableFiltered.every(l => selected.has(l.id));

  const toggleAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allDialableSelected) {
        dialableFiltered.forEach(l => next.delete(l.id));
      } else {
        dialableFiltered.forEach(l => next.add(l.id));
      }
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleStartCampaign = () => {
    if (!onStartCampaign) return;
    const ids = selected.size > 0 ? selected : new Set(dialableFiltered.map(l => l.id));
    const list: CampaignLead[] = leads
      .filter(l => ids.has(l.id) && l.phone)
      .map(l => ({ id: l.id, name: l.business_name || 'Lead', phone: l.phone }));
    if (list.length === 0) {
      toast.error('No dialable leads selected');
      return;
    }
    onStartCampaign(list);
  };

  const handleQuickDial = () => {
    if (!onQuickDial) return;
    const cleaned = quickPhone.replace(/[^\d+]/g, '');
    if (cleaned.replace(/\D/g, '').length < 10) {
      toast.error('Enter a valid phone number');
      return;
    }
    onQuickDial({ name: quickName.trim() || 'Quick Dial', phone: cleaned });
    setQuickPhone('');
    setQuickName('');
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const selectedCount = selected.size;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-bold text-foreground">{t('va.leads.title')}</h2>
        <div className="flex-1 max-w-sm relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('va.leads.search')}
            className="pl-9 bg-secondary border-border text-foreground text-sm h-9"
          />
        </div>
        <Select value={languageFilter} onValueChange={(v) => setLanguageFilter(v as 'all' | 'spanish')}>
          <SelectTrigger className="w-[160px] h-9 bg-secondary border-border text-foreground text-sm">
            <SelectValue placeholder="Language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All languages</SelectItem>
            <SelectItem value="spanish">🇲🇽 Spanish ({spanishCount})</SelectItem>
          </SelectContent>
        </Select>
        {onStartCampaign && (
          <Button
            size="sm"
            onClick={handleStartCampaign}
            className="bg-caller hover:bg-caller-glow text-white gap-2"
            disabled={dialableFiltered.length === 0}
          >
            <Zap className="h-4 w-4" />
            {selectedCount > 0
              ? `Start Campaign (${selectedCount})`
              : `Start Campaign · All (${dialableFiltered.length})`}
          </Button>
        )}
      </div>

      {/* Quick Dial bar */}
      {onQuickDial && (
        <div className="rounded-xl border border-caller/20 bg-caller/5 p-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-caller font-semibold pr-1">
            <PhoneCall className="h-3.5 w-3.5" /> Quick Dial
          </div>
          <Input
            value={quickPhone}
            onChange={e => setQuickPhone(e.target.value.replace(/[^\d+\-\s()]/g, ''))}
            placeholder="+1 (555) 123-4567"
            className="bg-background border-border text-foreground font-mono w-52 h-9"
            inputMode="tel"
          />
          <Input
            value={quickName}
            onChange={e => setQuickName(e.target.value)}
            placeholder="Contact name (optional)"
            className="bg-background border-border text-foreground w-56 h-9"
          />
          <Button
            size="sm"
            onClick={handleQuickDial}
            disabled={!quickPhone}
            className="bg-caller hover:bg-caller-glow text-white gap-2"
          >
            <Phone className="h-4 w-4" /> Call Now
          </Button>
          <span className="text-[11px] text-muted-foreground">
            Routes through the same dialer · disposition required after the call
          </span>
        </div>
      )}

      {filtered.length === 0 ? (
        <Card className="glass-card border-border/50">
          <CardContent className="py-16 text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto">
              <Users className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground">{t('va.leads.noLeads')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/50 glass-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-accent/30 text-muted-foreground text-xs">
                {onStartCampaign && (
                  <th className="p-3 pl-4 w-10">
                    <Checkbox
                      checked={allDialableSelected}
                      onCheckedChange={toggleAll}
                      aria-label="Select all dialable"
                    />
                  </th>
                )}
                <th className="text-left p-3 font-medium">{t('va.leads.name')}</th>
                <th className="text-left p-3 font-medium">{t('va.leads.phone')}</th>
                <th className="text-left p-3 hidden md:table-cell font-medium">{t('va.leads.email')}</th>
                <th className="text-left p-3 font-medium">{t('va.leads.status')}</th>
                <th className="text-right p-3 pr-4 font-medium">{t('va.leads.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead, idx) => {
                const config = STATUS_CONFIG[lead.status] || { bg: 'bg-muted/20', text: 'text-muted-foreground' };
                const dialable = !!lead.phone;
                return (
                  <motion.tr
                    key={lead.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(idx * 0.02, 0.4), duration: 0.3 }}
                    className="border-t border-border/30 hover:bg-accent/20 transition-colors duration-150 text-foreground"
                  >
                    {onStartCampaign && (
                      <td className="p-3 pl-4">
                        <Checkbox
                          checked={selected.has(lead.id)}
                          onCheckedChange={() => toggleOne(lead.id)}
                          disabled={!dialable}
                          aria-label={`Select ${lead.business_name}`}
                        />
                      </td>
                    )}
                    <td className="p-3 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        {lead.business_name || '—'}
                        {isSpanishLead(lead) && (
                          <Badge className="text-[9px] px-1.5 py-0 border bg-amber-500/15 text-amber-500 border-amber-500/30">
                            🇲🇽 ES
                          </Badge>
                        )}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{lead.phone || '—'}</td>
                    <td className="p-3 text-xs text-muted-foreground hidden md:table-cell">{lead.email || '—'}</td>
                    <td className="p-3">
                      <Badge variant="outline" className={`border-transparent ${config.bg} ${config.text}`}>
                        {lead.status?.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="p-3 pr-4 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs hover:bg-accent/50 gap-1"
                          style={{ color: "hsl(var(--hud-cyan))" }}
                          onClick={() => onCall(lead)}
                          disabled={!lead.phone}
                        >
                          <Phone className="h-3 w-3" /> {t('va.leads.call')}
                        </Button>
                        {brandaroTools && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs hover:bg-accent/50 gap-1"
                              style={{ color: "hsl(var(--success))" }}
                              onClick={() => onCreateInvoice(lead)}
                            >
                              <FileText className="h-3 w-3" /> {t('va.leads.createInvoice')}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs hover:bg-accent/50 gap-1"
                              style={{ color: "hsl(var(--hud-amber))" }}
                              onClick={() => onSendInvoice(lead)}
                            >
                              <Send className="h-3 w-3" /> {t('va.leads.sendInvoice')}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs hover:bg-accent/50 gap-1"
                              style={{ color: "hsl(var(--hud-cyan))" }}
                              onClick={() => setReceptionistLead(lead)}
                            >
                              <Sparkles className="h-3 w-3" /> Receptionist
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs hover:bg-accent/50 gap-1"
                              style={{ color: "hsl(var(--hud-amber))" }}
                              onClick={() => setDemoLead(lead)}
                            >
                              <Zap className="h-3 w-3" /> Send Demo
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {brandaroTools && (
        <>
          <SendReceptionistLinkModal
            lead={receptionistLead ? { id: receptionistLead.id, business_name: receptionistLead.business_name, phone_number: receptionistLead.phone } : null}
            open={!!receptionistLead}
            onOpenChange={(o) => { if (!o) setReceptionistLead(null); }}
          />

          <SendDemoModal
            lead={demoLead ? {
              id: demoLead.id,
              business_name: demoLead.business_name,
              city: demoLead.city ?? null,
              phone_number: demoLead.phone,
              google_place_id: demoLead.google_place_id ?? null,
            } : null}
            open={!!demoLead}
            onClose={() => setDemoLead(null)}
          />
        </>
      )}
    </div>
  );
}
