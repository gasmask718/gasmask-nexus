import { AlertTriangle, Zap, Clock } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type InvoiceMode = 'live' | 'historical';

interface InvoiceModeSelectorProps {
  mode: InvoiceMode;
  onModeChange: (mode: InvoiceMode) => void;
  className?: string;
}

export function InvoiceModeSelector({ mode, onModeChange, className }: InvoiceModeSelectorProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <Label className="text-sm font-medium">Invoice Mode</Label>
      
      <RadioGroup
        value={mode}
        onValueChange={(value) => onModeChange(value as InvoiceMode)}
        className="grid grid-cols-2 gap-3"
      >
        {/* Live Mode */}
        <Card
          className={cn(
            'relative cursor-pointer p-4 transition-all border-2',
            mode === 'live'
              ? 'border-primary bg-primary/5'
              : 'border-muted hover:border-muted-foreground/30'
          )}
          onClick={() => onModeChange('live')}
        >
          <div className="flex items-start gap-3">
            <RadioGroupItem value="live" id="live" className="mt-1" />
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="live" className="font-semibold cursor-pointer">
                  Live Invoice
                </Label>
                <Badge variant="default" className="text-[10px] px-1.5 py-0">
                  <Zap className="h-2.5 w-2.5 mr-0.5" />
                  AUTO
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Real transaction — receipt text sent automatically
              </p>
            </div>
          </div>
        </Card>

        {/* Historical Mode */}
        <Card
          className={cn(
            'relative cursor-pointer p-4 transition-all border-2',
            mode === 'historical'
              ? 'border-amber-500 bg-amber-500/5'
              : 'border-muted hover:border-muted-foreground/30'
          )}
          onClick={() => onModeChange('historical')}
        >
          <div className="flex items-start gap-3">
            <RadioGroupItem value="historical" id="historical" className="mt-1" />
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="historical" className="font-semibold cursor-pointer">
                  Historical Entry
                </Label>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500 text-amber-600">
                  <Clock className="h-2.5 w-2.5 mr-0.5" />
                  NO SMS
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Backfilled data — NO notifications sent
              </p>
            </div>
          </div>
        </Card>
      </RadioGroup>

      {/* Warning for historical mode */}
      {mode === 'historical' && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-700 dark:text-amber-400">
            <strong>Historical Mode Active</strong>
            <p className="mt-0.5">
              This invoice will be recorded without sending any notifications to the customer.
              Use this for backfilling old records or data corrections.
            </p>
          </div>
        </div>
      )}

      {/* Confirmation for live mode */}
      {mode === 'live' && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 border border-primary/30">
          <Zap className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="text-xs text-primary">
            <strong>Live Mode Active</strong>
            <p className="mt-0.5">
              A receipt confirmation text will be automatically sent to the customer's phone upon submission.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
