import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useVASession } from '@/contexts/VASessionContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Phone, FileText, Send, Search, Loader2 } from 'lucide-react';

interface Lead {
  id: string;
  business_name: string;
  phone: string;
  email: string | null;
  status: string;
  created_at: string;
  assigned_va_id: string | null;
}

interface VALeadsTableProps {
  onCall: (lead: Lead) => void;
  onCreateInvoice: (lead: Lead) => void;
  onSendInvoice: (lead: Lead) => void;
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-400',
  contacted: 'bg-yellow-500/20 text-yellow-400',
  interested: 'bg-emerald-500/20 text-emerald-400',
  not_interested: 'bg-red-500/20 text-red-400',
  callback: 'bg-orange-500/20 text-orange-400',
  closed: 'bg-green-500/20 text-green-400',
};

export function VALeadsTable({ onCall, onCreateInvoice, onSendInvoice }: VALeadsTableProps) {
  const { t } = useVASession();
  const { user } = useAuth();
  const [search, setSearch] = useState('');

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['va-leads', user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('brandaro_leads_master')
        .select('id, business_name, phone, email, status, created_at, assigned_va_id')
        .order('created_at', { ascending: false })
        .limit(200);
      return (data || []) as Lead[];
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
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-cyan-400" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold text-white">{t('va.leads.title')}</h2>
        <div className="flex-1 max-w-sm relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('va.leads.search')}
            className="pl-9 bg-slate-800 border-slate-700 text-white text-sm h-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="py-12 text-center text-slate-400">
            {t('va.leads.noLeads')}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/80 text-slate-400 text-xs">
                <th className="text-left p-3">{t('va.leads.name')}</th>
                <th className="text-left p-3">{t('va.leads.phone')}</th>
                <th className="text-left p-3 hidden md:table-cell">{t('va.leads.email')}</th>
                <th className="text-left p-3">{t('va.leads.status')}</th>
                <th className="text-right p-3">{t('va.nav.activeCall')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(lead => (
                <tr key={lead.id} className="border-t border-slate-700/50 hover:bg-slate-800/30 text-white">
                  <td className="p-3 font-medium">{lead.business_name || '—'}</td>
                  <td className="p-3 font-mono text-xs text-slate-300">{lead.phone || '—'}</td>
                  <td className="p-3 text-xs text-slate-400 hidden md:table-cell">{lead.email || '—'}</td>
                  <td className="p-3">
                    <Badge className={STATUS_COLORS[lead.status] || 'bg-slate-600 text-slate-300'}>
                      {lead.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
                        onClick={() => onCall(lead)} disabled={!lead.phone}>
                        <Phone className="h-3 w-3 mr-1" /> {t('va.leads.call')}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-400 hover:text-white hidden lg:flex"
                        onClick={() => onCreateInvoice(lead)}>
                        <FileText className="h-3 w-3 mr-1" /> {t('va.leads.createInvoice')}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-400 hover:text-white hidden lg:flex"
                        onClick={() => onSendInvoice(lead)}>
                        <Send className="h-3 w-3 mr-1" /> {t('va.leads.sendInvoice')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
