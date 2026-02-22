import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PipelineStage } from '@/services/wholesaler/useWholesalerAnalytics';
import { ArrowRight } from 'lucide-react';

interface Props {
  stages: PipelineStage[];
}

export function SettlementPipelineVisualizer({ stages }: Props) {
  const totalAmount = stages.reduce((s, st) => s + st.amount, 0);

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Settlement Pipeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-stretch gap-1">
          {stages.map((stage, i) => {
            const widthPercent = totalAmount > 0 ? Math.max(12, (stage.amount / totalAmount) * 100) : 20;

            return (
              <React.Fragment key={stage.stage}>
                <div
                  className="relative flex flex-col items-center justify-between rounded-lg border px-3 py-3 text-center transition-all hover:scale-[1.02] cursor-pointer"
                  style={{
                    flex: `0 0 ${widthPercent}%`,
                    borderColor: `${stage.color}40`,
                    backgroundColor: `${stage.color}08`,
                  }}
                >
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                    {stage.label}
                  </p>
                  <p className="text-lg font-bold" style={{ color: stage.color }}>
                    ${stage.amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {stage.count} payout{stage.count !== 1 ? 's' : ''}
                  </p>
                  {/* Bottom accent bar */}
                  <div
                    className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                </div>
                {i < stages.length - 1 && (
                  <div className="flex items-center px-0.5 text-muted-foreground/40">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
