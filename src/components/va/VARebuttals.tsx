import { useVASession } from '@/contexts/VASessionContext';

export function VARebuttals() {
  const { t } = useVASession();

  const rebuttals = [
    { key: 'tooExpensive', icon: '💰' },
    { key: 'notInterested', icon: '🚫' },
    { key: 'callBack', icon: '📅' },
    { key: 'alreadyHave', icon: '🤷' },
  ];

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-white">{t('va.rebuttals.title')}</h3>
      {rebuttals.map(r => (
        <div key={r.key} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-2">
            <span>{r.icon}</span>
            <span className="text-xs font-bold text-orange-400">
              "{t(`va.rebuttals.${r.key}`)}"
            </span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            {t(`va.rebuttals.${r.key}Response`)}
          </p>
        </div>
      ))}
    </div>
  );
}
