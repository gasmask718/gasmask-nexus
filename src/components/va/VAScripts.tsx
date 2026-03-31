import { useVASession } from '@/contexts/VASessionContext';

export function VAScripts() {
  const { t } = useVASession();

  const steps = [
    { key: 'greeting', icon: '👋' },
    { key: 'qualify', icon: '🎯' },
    { key: 'pitch', icon: '💡' },
    { key: 'close', icon: '🤝' },
  ];

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-white">{t('va.scripts.title')}</h3>
      {steps.map((step, i) => (
        <div key={step.key} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{step.icon}</span>
            <span className="text-xs font-bold text-cyan-400 uppercase">
              {t('va.scripts.step')} {i + 1} — {t(`va.scripts.${step.key}`)}
            </span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            {t(`va.scripts.${step.key}Text`)}
          </p>
        </div>
      ))}
    </div>
  );
}
