import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface SupplierNegotiationScriptsProps {
  supplierName: string;
  productName: string;
  currentCost: number;
  projectedCost60d: number;
  forecast_pct_increase?: number;
  recommended_action?: string;
}

export function SupplierNegotiationScripts({
  supplierName,
  productName,
  currentCost,
  projectedCost60d,
  forecast_pct_increase,
  recommended_action,
}: SupplierNegotiationScriptsProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const pctIncrease = forecast_pct_increase || ((projectedCost60d - currentCost) / currentCost) * 100;

  const scripts = [
    {
      title: 'Opening Message',
      text: `Hi [Supplier Contact],

I wanted to reach out about our partnership on ${productName}. We've been reviewing our cost trends and forecast, and I see projected price movement of ${pctIncrease.toFixed(1)}% over the next 60 days. 

Before we discuss options, I'd like to understand what's driving this from your side. When would be a good time to walk through this together?

Thanks,
[Your Name]`,
    },
    {
      title: 'Data-Backed Push',
      text: `Following up on our conversation about ${productName}:

We've analyzed your last 5 shipments to us. The trajectory points to a unit cost of $${projectedCost60d.toFixed(2)} by the end of Q2, up from today's $${currentCost.toFixed(2)}.

For us to maintain our current volume commitment, we'd like to explore three options with you:
1. Fixed pricing through year-end
2. A pricing cap tied to market indices (CPI + agreed margin)
3. Volume-based discount structure to offset cost increases

Which of these works best for your planning?`,
    },
    {
      title: 'Exit / Fallback Language',
      text: `I appreciate your position. However, without pricing certainty or cost-sharing mechanisms, we need to activate contingency plans.

This means we'll be evaluating alternative suppliers and will likely reduce our volume commitment to you starting next quarter to 50% of current levels, with the balance going to a secondary source.

I'd rather not do this, as our current relationship is valuable. Can we revisit a structure that gives us both stability?`,
    },
  ];

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Negotiation Scripts</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">Customized talking points for {supplierName}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {scripts.map((script, idx) => (
          <div key={idx} className="p-3 rounded-lg border space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">{script.title}</h4>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleCopy(script.text, idx)}
                className={cn(
                  "text-xs",
                  copiedIndex === idx ? "text-emerald-600" : "text-muted-foreground"
                )}
              >
                {copiedIndex === idx ? (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap font-mono">
              {script.text}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
