import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { CheckCircle2, Circle } from 'lucide-react';
import { useState } from 'react';

interface SupplierFallbackChecklistProps {
  recommendedAction?: string;
  riskTier?: string;
  supplierName?: string;
}

export function SupplierFallbackChecklist({
  recommendedAction,
  riskTier,
  supplierName,
}: SupplierFallbackChecklistProps) {
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());

  // Only show if seeking alternative or critical risk
  const shouldShow = recommendedAction?.includes('alternative') || riskTier === 'critical';

  if (!shouldShow) {
    return null;
  }

  const checklistItems = [
    {
      title: 'Identify Secondary Supplier',
      desc: 'Map 2–3 potential suppliers with similar capabilities',
    },
    {
      title: 'Compare Last 3 Unit Costs',
      desc: 'Verify pricing is competitive vs. current supplier',
    },
    {
      title: 'Verify MOQ & Lead Time',
      desc: 'Confirm minimum order quantity and delivery timeline match our needs',
    },
    {
      title: 'Validate Product Compatibility',
      desc: 'Test samples; confirm specs match our manufacturing requirements',
    },
    {
      title: 'Review Quality / SLA',
      desc: 'Check defect rates, on-time delivery history, warranty terms',
    },
    {
      title: 'Get Formal Pricing Quote',
      desc: 'Lock in pricing for 12+ months if possible',
    },
    {
      title: 'Plan Transition Timeline',
      desc: 'Define when we switch volume and any overlap period needed',
    },
  ];

  const toggleItem = (idx: number) => {
    const newSet = new Set(checkedItems);
    if (newSet.has(idx)) {
      newSet.delete(idx);
    } else {
      newSet.add(idx);
    }
    setCheckedItems(newSet);
  };

  return (
    <Card className="border-l-4 border-l-orange-500">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Alternative Sourcing Readiness</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Preparation steps if {supplierName} negotiation does not resolve
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {checklistItems.map((item, idx) => (
            <div
              key={idx}
              onClick={() => toggleItem(idx)}
              className="flex items-start gap-3 p-2 rounded cursor-pointer hover:bg-muted/50 transition-colors"
            >
              {checkedItems.has(idx) ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <p className={`text-sm font-medium ${checkedItems.has(idx) ? 'text-muted-foreground line-through' : ''}`}>
                  {item.title}
                </p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4 pt-4 border-t">
          {checkedItems.size} of {checklistItems.length} steps completed
        </p>
      </CardContent>
    </Card>
  );
}
