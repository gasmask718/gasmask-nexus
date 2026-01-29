import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye } from "lucide-react";
import { useAmbassadorCommissions, CommissionCategory } from "@/hooks/useAmbassadorCommissions";
import { CommissionKPICards } from "./CommissionKPICards";
import { CommissionLedger } from "./CommissionLedger";

interface CommissionPanelProps {
  ambassadorId: string;
  ambassadorName?: string;
  isReadOnly?: boolean;
}

export function CommissionPanel({ ambassadorId, ambassadorName, isReadOnly }: CommissionPanelProps) {
  const [selectedCategory, setSelectedCategory] = useState<CommissionCategory | null>(null);
  
  const { events, summaries, totals, isLoading } = useAmbassadorCommissions({
    ambassadorId,
    category: selectedCategory || undefined,
  });

  const handleCategoryClick = (category: CommissionCategory) => {
    setSelectedCategory(category);
  };

  const handleBack = () => {
    setSelectedCategory(null);
  };

  return (
    <div className="space-y-6">
      {/* Read-only banner */}
      {isReadOnly && ambassadorName && (
        <Alert className="border-amber-500/30 bg-amber-500/10">
          <Eye className="h-4 w-4 text-amber-400" />
          <AlertDescription className="text-amber-200">
            <strong>Viewing Commission Data for {ambassadorName}</strong>
            <span className="ml-2 text-amber-400/80">Read-only mode</span>
          </AlertDescription>
        </Alert>
      )}

      {/* Totals Summary */}
      <div className="flex items-center gap-6 p-4 bg-muted/30 rounded-lg">
        <div>
          <span className="text-sm text-muted-foreground">Lifetime Earnings</span>
          <div className="text-2xl font-bold text-foreground">
            ${totals.lifetime.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="h-10 w-px bg-border" />
        <div>
          <span className="text-sm text-muted-foreground">Pending</span>
          <div className="text-xl font-semibold text-yellow-400">
            ${totals.pending.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="h-10 w-px bg-border" />
        <div>
          <span className="text-sm text-muted-foreground">Paid</span>
          <div className="text-xl font-semibold text-green-400">
            ${totals.paid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* View: KPI Cards or Ledger */}
      {selectedCategory === null ? (
        <CommissionKPICards
          summaries={summaries}
          onCategoryClick={handleCategoryClick}
          isLoading={isLoading}
        />
      ) : (
        <CommissionLedger
          events={events}
          category={selectedCategory}
          onBack={handleBack}
          isLoading={isLoading}
          isReadOnly={isReadOnly}
          ambassadorName={ambassadorName}
        />
      )}

      {/* Full ledger when no category selected */}
      {selectedCategory === null && (
        <CommissionLedger
          events={events}
          isLoading={isLoading}
          isReadOnly={isReadOnly}
          ambassadorName={ambassadorName}
        />
      )}
    </div>
  );
}
