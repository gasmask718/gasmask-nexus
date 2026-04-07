import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useVASession } from '@/contexts/VASessionContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Phone, FileText, Send, Search, Loader2, Users } from 'lucide-react';
import { motion } from 'framer-motion';

interface Lead {
  id: string;
  business_name: string;
  phone: string;
  email: string | null;
  status: string;
  created_at: string;
  assigned_va: string | null;
}

interface VALeadsTableProps {
  onCall: (lead: Lead) => void;
  onCreateInvoice: (lead: Lead) => void;
  onSendInvoice: (lead: Lead) => void;
}

const STATUS_CONFIG: Record<string, { bg: string; text: string }> = {
  new: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
  contacted: { bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
  interested: { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  not_interested: { bg: 'bg-red-500/15', text: 'text-red-400' },
  callback: { bg: 'bg-orange-500/15', text: 'text-orange-400' },
  closed: { bg: 'bg-green-500/15', text: 'text-green-400' },
};

export function VALeadsTable({ onCall, onCreateInvoice, onSendInvoice }: VALeadsTableProps) {
  const { t } = useVASession();
  const { user } = useAuth();
  const [search, setSearch] = useState('');

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['va-leads', user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('brandaro_qualified_leads')
        .select('id, business_name, phone_number, email, lead_status, created_at, assigned_va')
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

  const filtered = leads.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.business_name?.toLowerCase().includes(q) ||
      l.phone?.includes(q) ||
      l.email?.toLowerCase().includes(q)
    );
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
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
      </div>

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
                <th className="text-left p-3 pl-4 font-medium">{t('va.leads.name')}</th>
                <th className="text-left p-3 font-medium">{t('va.leads.phone')}</th>
                <th className="text-left p-3 hidden md:table-cell font-medium">{t('va.leads.email')}</th>
                <th className="text-left p-3 font-medium">{t('va.leads.status')}</th>
                <th className="text-right p-3 pr-4 font-medium">{t('va.leads.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead, idx) => {
                const config = STATUS_CONFIG[lead.status] || { bg: 'bg-muted/20', text: 'text-muted-foreground' };
                return (
                  <motion.tr
                    key={lead.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(idx * 0.02, 0.4), duration: 0.3 }}
                    className="border-t border-border/30 hover:bg-accent/20 transition-colors duration-150 text-foreground"
                  >
                    <td className="p-3 pl-4 font-medium">{lead.business_name || '—'}</td>
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
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
