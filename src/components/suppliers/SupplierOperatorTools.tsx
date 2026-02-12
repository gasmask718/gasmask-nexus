import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface SupplierOperatorToolsProps {
  supplierName: string;
  productName: string;
  currentCost: number;
  projectedCost60d: number;
  contractRiskIndex: number;
  recommendedAction: string;
  forecast_pct_increase?: number;
}

export function SupplierOperatorTools({
  supplierName,
  productName,
  currentCost,
  projectedCost60d,
  contractRiskIndex,
  recommendedAction,
  forecast_pct_increase,
}: SupplierOperatorToolsProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const pctIncrease = forecast_pct_increase || ((projectedCost60d - currentCost) / currentCost) * 100;

  const tools = [
    {
      id: 'summary',
      label: 'Copy Risk Summary',
      content: `SUPPLIER: ${supplierName}
PRODUCT: ${productName}

Current Cost: $${currentCost.toFixed(2)}/unit
Projected Cost (60d): $${projectedCost60d.toFixed(2)}/unit
Increase: ${pctIncrease.toFixed(1)}%

Contract Risk Index: ${contractRiskIndex.toFixed(0)}/100
Recommended Action: ${recommendedAction.replace(/_/g, ' ')}

NEXT STEPS:
1. Schedule negotiation call
2. Share cost trend data
3. Propose pricing structure (fixed, band, or tiered)
4. If negotiation stalls, activate secondary sourcing`,
    },
    {
      id: 'notes',
      label: 'Copy Negotiation Notes',
      content: `CALL NOTES: ${supplierName} - ${productName}
Date: [INSERT DATE]
Participants: [INSERT NAMES]

OPENING:
- Objective: ${recommendedAction.replace(/_/g, ' ')}
- Context: Projected ${pctIncrease.toFixed(1)}% cost increase over 60 days

DISCUSSION POINTS:
- Root cause of price movement
- Our volume commitment and growth potential
- Proposed pricing structure
- Timeline for decision

OUTCOMES:
☐ Accepted pricing fix
☐ Agreed to pricing band
☐ Agreed to volume discount
☐ No agreement; activate fallback plan

ACTION ITEMS:
[TO BE FILLED IN]`,
    },
    {
      id: 'email',
      label: 'Copy Email Template',
      content: `Subject: Partnership Proposal – ${productName}

Hi [Supplier Contact],

Thank you for taking the time to discuss our partnership on ${productName}.

As we reviewed, we're seeing a projected increase of ${pctIncrease.toFixed(1)}% over the next 60 days, which impacts our margin and growth plans. To maintain our current commitment and scale, we'd like to propose one of the following:

OPTION A: Fixed Pricing
Lock in current or negotiated pricing through [DATE], with a review clause tied to documented market changes.

OPTION B: Pricing Band
Establish a price range (floor/ceiling) anchored to a mutually agreed index (CPI, commodity prices) plus a fixed margin.

OPTION C: Volume-Based Discount
Implement tiered discounts that offset inflation as our volume grows with you.

I'd like to move forward quickly on this. Can we schedule a follow-up call by [DATE]?

Thanks,
[Your Name]`,
    },
  ];

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {tools.map((tool) => (
        <Button
          key={tool.id}
          size="sm"
      variant={copiedId === tool.id ? "default" : "outline"}
      onClick={() => handleCopy(tool.content, tool.id)}
      className={cn(
        "text-xs",
        copiedId === tool.id ? "bg-emerald-600 hover:bg-emerald-700" : ""
      )}
        >
          {copiedId === tool.id ? (
            <>
              <Check className="h-3 w-3 mr-1" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3 mr-1" />
              {tool.label}
            </>
          )}
        </Button>
      ))}
    </div>
  );
}
