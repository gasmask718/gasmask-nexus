import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from '@/hooks/useTranslation';
import { SupportedLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * LanguageSelector — compact EN / ES segmented toggle for the portal header.
 *
 * Designed for bilingual ambassadors who want to flip the UI instantly
 * (per Spanish/English request). Other supported languages live in a
 * “…” dropdown so the primary toggle stays one tap away.
 */
export function LanguageSelector() {
  const { language, setLanguage, availableLanguages } = useTranslation();

  const primary: SupportedLanguage[] = ['en', 'es'];
  const others = availableLanguages.filter((l) => !primary.includes(l.code as SupportedLanguage));

  return (
    <div className="flex items-center gap-1 rounded-md border border-border/50 bg-background/50 px-1 py-0.5">
      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
      {primary.map((code) => (
        <Button
          key={code}
          type="button"
          size="sm"
          variant={language === code ? 'default' : 'ghost'}
          className={cn(
            'h-7 px-2 text-xs font-semibold',
            language === code ? '' : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => setLanguage(code)}
          aria-pressed={language === code}
          aria-label={code === 'en' ? 'Switch to English' : 'Cambiar a Español'}
        >
          {code === 'en' ? 'EN' : 'ES'}
        </Button>
      ))}
      {others.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-7 px-1 text-xs">
              …
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {others.map((l) => (
              <DropdownMenuItem key={l.code} onClick={() => setLanguage(l.code as SupportedLanguage)}>
                {l.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
