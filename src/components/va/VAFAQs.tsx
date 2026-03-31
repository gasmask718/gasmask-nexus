import { useState } from 'react';
import { useVASession } from '@/contexts/VASessionContext';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

export function VAFAQs() {
  const { t } = useVASession();
  const [search, setSearch] = useState('');

  const faqs = [
    { q: t('va.faqs.q1'), a: t('va.faqs.a1') },
    { q: t('va.faqs.q2'), a: t('va.faqs.a2') },
    { q: t('va.faqs.q3'), a: t('va.faqs.a3') },
    { q: t('va.faqs.q4'), a: t('va.faqs.a4') },
    { q: t('va.faqs.q5'), a: t('va.faqs.a5') },
  ];

  const filtered = faqs.filter(f => {
    if (!search) return true;
    const q = search.toLowerCase();
    return f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-bold text-white">{t('va.faqs.title')}</h3>
        <div className="flex-1 relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('va.faqs.search')}
            className="pl-7 h-7 text-xs bg-slate-800 border-slate-700 text-white"
          />
        </div>
      </div>
      {filtered.map((faq, i) => (
        <div key={i} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
          <p className="text-sm font-medium text-cyan-400 mb-1">❓ {faq.q}</p>
          <p className="text-sm text-slate-300">{faq.a}</p>
        </div>
      ))}
    </div>
  );
}
