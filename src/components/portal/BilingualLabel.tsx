/**
 * BilingualLabel — renders a translated label.
 * In ES learn-mode, shows the English original as a small subtitle so
 * field workers can match Spanish to English while they read the UI.
 *
 * Shared by Production + Ambassador portals.
 */
import { useTranslation } from '@/hooks/useTranslation';

interface Props {
  tKey: string;
  en: string;
  /** Render inline (no flex-col stack). Useful inside buttons. */
  inline?: boolean;
  className?: string;
}

export function BilingualLabel({ tKey, en, inline, className }: Props) {
  const { t, language } = useTranslation();
  const translated = t(tKey);
  const showSubtitle = language === 'es' && translated !== en;

  if (!showSubtitle) {
    return <span className={className}>{translated}</span>;
  }

  if (inline) {
    return (
      <span className={className}>
        {translated} <span className="text-[9px] opacity-60">({en})</span>
      </span>
    );
  }

  return (
    <span className={`flex flex-col leading-tight items-start ${className ?? ''}`}>
      <span>{translated}</span>
      <span className="text-[9px] opacity-60">{en}</span>
    </span>
  );
}

export default BilingualLabel;
