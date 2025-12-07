import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe, Check } from 'lucide-react';
import { LanguageProfile } from '@/hooks/useLanguagePersonality';

interface LanguageProfilesPanelProps {
  profiles: LanguageProfile[];
  isLoading: boolean;
}

const languageFlags: Record<string, string> = {
  en: '🇺🇸',
  es: '🇪🇸',
  zh: '🇨🇳',
  ar: '🇸🇦',
  bn: '🇧🇩',
  ht: '🇭🇹',
  fr: '🇫🇷',
};

export default function LanguageProfilesPanel({ profiles, isLoading }: LanguageProfilesPanelProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Language Profiles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="w-5 h-5" />
          Language Profiles
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {profiles?.map((profile) => (
            <div
              key={profile.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{languageFlags[profile.code] || '🌐'}</span>
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {profile.name}
                    {profile.is_default && (
                      <Badge variant="secondary" className="text-xs">
                        <Check className="w-3 h-3 mr-1" />
                        Default
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {profile.dialect_code} • {profile.description}
                  </div>
                </div>
              </div>
              <Badge variant="outline">{profile.code.toUpperCase()}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
