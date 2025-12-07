import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Languages } from 'lucide-react';

interface LanguageStatsPanelProps {
  stats: {
    total: number;
    distribution: Record<string, number>;
  } | undefined;
}

const languageNames: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  zh: 'Chinese',
  ar: 'Arabic',
  bn: 'Bengali',
  ht: 'Haitian Creole',
  fr: 'French',
};

const languageColors: Record<string, string> = {
  en: 'bg-blue-500',
  es: 'bg-orange-500',
  zh: 'bg-red-500',
  ar: 'bg-green-500',
  bn: 'bg-purple-500',
  ht: 'bg-yellow-500',
  fr: 'bg-pink-500',
};

export default function LanguageStatsPanel({ stats }: LanguageStatsPanelProps) {
  if (!stats || stats.total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Language Detection Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <Languages className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No language detection data yet.</p>
            <p className="text-sm">Stats will appear as messages are processed.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const sortedLanguages = Object.entries(stats.distribution).sort((a, b) => b[1] - a[1]);
  const maxCount = Math.max(...Object.values(stats.distribution));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Language Detection Stats
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total messages analyzed:</span>
            <Badge variant="secondary">{stats.total}</Badge>
          </div>
          
          <div className="space-y-3">
            {sortedLanguages.map(([lang, count]) => {
              const percentage = ((count / stats.total) * 100).toFixed(1);
              const barWidth = (count / maxCount) * 100;
              
              return (
                <div key={lang}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>{languageNames[lang] || lang.toUpperCase()}</span>
                    <span className="text-muted-foreground">
                      {count} ({percentage}%)
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${languageColors[lang] || 'bg-primary'} rounded-full transition-all duration-500`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
