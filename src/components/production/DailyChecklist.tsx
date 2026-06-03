/**
 * DAILY CHECKLIST PANEL
 * 
 * Shows the mandatory steps for completing a production day.
 * Blocks day closure until all items are checked.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/hooks/useTranslation';
import { BilingualLabel } from '@/components/portal/BilingualLabel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  Circle, 
  Boxes, 
  FileOutput, 
  Scale,
  Lock,
  AlertTriangle,
  ClipboardCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  completed: boolean;
  required: boolean;
}

interface DailyChecklistProps {
  hasBatch: boolean;
  hasOutput: boolean;
  hasVarianceReview: boolean;
  varianceAmount?: number;
  boxCount: number;
  onCloseDay: () => void;
  isClosing?: boolean;
  isDayClosed?: boolean;
}

export function DailyChecklist({
  hasBatch,
  hasOutput,
  hasVarianceReview,
  varianceAmount = 0,
  boxCount,
  onCloseDay,
  isClosing,
  isDayClosed,
}: DailyChecklistProps) {
  const { t } = useTranslation();
  const items: ChecklistItem[] = [
    {
      id: 'batch',
      label: t('production.checklist.batch_created'),
      description: t('production.checklist.batch_created_desc'),
      icon: <Boxes className="h-4 w-4" />,
      completed: hasBatch,
      required: true,
    },
    {
      id: 'output',
      label: t('production.checklist.output_entered'),
      description: t('production.checklist.output_entered_desc'),
      icon: <FileOutput className="h-4 w-4" />,
      completed: hasOutput,
      required: true,
    },
    {
      id: 'variance',
      label: t('production.checklist.variance_reviewed'),
      description: varianceAmount !== 0 
        ? t('production.checklist.variance_acknowledged', { amount: (varianceAmount > 0 ? '+' : '') + varianceAmount })
        : t('production.checklist.no_variance_to_review'),
      icon: <Scale className="h-4 w-4" />,
      completed: hasVarianceReview || varianceAmount === 0,
      required: varianceAmount !== 0,
    },
  ];

  const requiredItems = items.filter(i => i.required);
  const allRequiredComplete = requiredItems.every(i => i.completed);
  const completedCount = items.filter(i => i.completed).length;

  // Show warning for zero output
  const hasZeroOutput = hasOutput && boxCount === 0;

  if (isDayClosed) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
              <Lock className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h4 className="font-semibold text-emerald-800 dark:text-emerald-200"><BilingualLabel tKey="production.day_closed" en="Day Closed" /></h4>
              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                {t("production.day_closed_desc")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            <BilingualLabel tKey="production.daily_checklist" en="Daily Checklist" />
          </CardTitle>
          <Badge variant={allRequiredComplete ? 'default' : 'secondary'}>
            {completedCount}/{items.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map(item => (
          <div 
            key={item.id}
            className={cn(
              'flex items-start gap-3 p-2 rounded-lg transition-colors',
              item.completed ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-muted/50'
            )}
          >
            <div className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
              item.completed 
                ? 'bg-emerald-100 dark:bg-emerald-900' 
                : 'bg-muted border-2 border-muted-foreground/20'
            )}>
              {item.completed ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <Circle className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {item.icon}
                <span className={cn(
                  'text-sm font-medium',
                  item.completed && 'text-emerald-700 dark:text-emerald-300'
                )}>
                  {item.label}
                </span>
                {item.required && !item.completed && (
                  <Badge variant="outline" className="text-xs">{t("production.required")}</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
            </div>
          </div>
        ))}

        {/* Zero Output Warning */}
        {hasZeroOutput && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                <BilingualLabel tKey="production.zero_boxes_recorded" en="Zero boxes recorded" />
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {t("production.zero_boxes_recorded_desc")}
              </p>
            </div>
          </div>
        )}

        {/* Close Day Button */}
        <Button 
          onClick={onCloseDay}
          disabled={!allRequiredComplete || isClosing}
          className="w-full mt-4"
          variant={allRequiredComplete ? 'default' : 'secondary'}
        >
          <Lock className="h-4 w-4 mr-2" />
          {isClosing ? t("production.closing_day") : t("production.close_day")}
        </Button>

        {!allRequiredComplete && (
          <p className="text-xs text-center text-muted-foreground">
            {t("production.complete_required_before_closing")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
