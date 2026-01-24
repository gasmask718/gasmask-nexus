import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  Mic,
  User,
  ChevronDown,
  ChevronUp,
  Smile,
  MessageSquare,
  HelpCircle,
  Copy,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SpeakerStyleProfile } from '@/hooks/usePlaybooks';

interface StyleCardProps {
  style: SpeakerStyleProfile;
  onToggleActive: (id: string, active: boolean) => void;
  onEdit: (style: SpeakerStyleProfile) => void;
}

export function StyleCard({ style, onToggleActive, onEdit }: StyleCardProps) {
  const [expanded, setExpanded] = useState(false);

  const getToneBadgeColor = (tone: string) => {
    switch (tone.toLowerCase()) {
      case 'warm': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      case 'professional': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'empathetic': return 'bg-pink-500/10 text-pink-600 border-pink-500/20';
      case 'energetic': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'calm': return 'bg-green-500/10 text-green-600 border-green-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card className={cn('transition-all', !style.is_active && 'opacity-60')}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2 rounded-lg',
              style.is_active ? 'bg-primary/10' : 'bg-muted'
            )}>
              <Mic className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">{style.name}</h3>
              {style.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {style.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={getToneBadgeColor(style.tone)}>
              {style.tone}
            </Badge>
            <Switch
              checked={style.is_active}
              onCheckedChange={(checked) => onToggleActive(style.id, checked)}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span>{style.times_used} uses</span>
          </div>
          <div className="flex items-center gap-2">
            <Smile className="h-4 w-4 text-muted-foreground" />
            <span>{style.avg_caller_satisfaction?.toFixed(0) ?? '—'}% sat.</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Pacing:</span>
            <span className="capitalize">{style.pacing}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Energy:</span>
            <span className="capitalize">{style.energy_level}</span>
          </div>
        </div>

        {/* Feature Flags */}
        <div className="flex flex-wrap gap-2">
          {style.uses_humor && (
            <Badge variant="outline" className="text-xs">
              <Smile className="h-3 w-3 mr-1" />
              Humor
            </Badge>
          )}
          {style.uses_stories && (
            <Badge variant="outline" className="text-xs">
              <MessageSquare className="h-3 w-3 mr-1" />
              Stories
            </Badge>
          )}
          {style.uses_questions && (
            <Badge variant="outline" className="text-xs">
              <HelpCircle className="h-3 w-3 mr-1" />
              Questions
            </Badge>
          )}
          {style.mirroring_enabled && (
            <Badge variant="outline" className="text-xs">
              <Copy className="h-3 w-3 mr-1" />
              Mirroring
            </Badge>
          )}
        </div>

        {/* Sliders */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Formality</span>
              <span>{style.formality_level}%</span>
            </div>
            <Progress value={style.formality_level} className="h-2" />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Max Enthusiasm</span>
              <span>{style.max_enthusiasm_level}%</span>
            </div>
            <Progress value={style.max_enthusiasm_level} className="h-2" />
          </div>
        </div>

        {/* Derived From */}
        {style.derived_from_human_id && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span>Derived from human exemplar</span>
          </div>
        )}

        {/* Expandable Examples */}
        {expanded && (
          <div className="pt-4 border-t space-y-4">
            {style.greeting_examples.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Greeting Examples</h4>
                <ul className="space-y-1">
                  {style.greeting_examples.map((ex, i) => (
                    <li key={i} className="text-sm text-muted-foreground italic">
                      "{ex}"
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {style.empathy_expressions.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Empathy Expressions</h4>
                <ul className="space-y-1">
                  {style.empathy_expressions.map((ex, i) => (
                    <li key={i} className="text-sm text-muted-foreground italic">
                      "{ex}"
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {style.closing_examples.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Closing Examples</h4>
                <ul className="space-y-1">
                  {style.closing_examples.map((ex, i) => (
                    <li key={i} className="text-sm text-muted-foreground italic">
                      "{ex}"
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Examples
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={() => onEdit(style)}>
            Edit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
