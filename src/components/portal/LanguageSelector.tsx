import { Globe } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/hooks/useTranslation';
import { SupportedLanguage } from '@/lib/i18n';

export function LanguageSelector() {
  const { language, setLanguage, availableLanguages } = useTranslation();
  
  return (
    <Select value={language} onValueChange={(val) => setLanguage(val as SupportedLanguage)}>
      <SelectTrigger className="w-auto gap-2 border-border/50 bg-background/50">
        <Globe className="h-4 w-4" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {availableLanguages.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            {lang.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
