import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GRABBA_BRAND_IDS, GRABBA_BRAND_CONFIG, type GrabbaBrand } from "@/config/grabbaSkyscraper";
import type { GlobalSellThroughRow } from "@/hooks/useGlobalSellThroughAnalytics";

interface Props {
  rows: GlobalSellThroughRow[];
}

interface BrandStats {
  brand: GrabbaBrand;
  total: number;
  fast: number;
  medium: number;
  slow: number;
  newOrNoData: number;
}

const BAR_COLORS = {
  fast: "bg-emerald-500",
  medium: "bg-amber-500",
  slow: "bg-red-500",
  newOrNoData: "bg-blue-400",
};

export function BrandHeatmapSummary({ rows }: Props) {
  const stats: BrandStats[] = GRABBA_BRAND_IDS.map((brand) => {
    const brandRows = rows.filter((r) => r.brand_name === brand);
    const total = brandRows.length;
    const fast = brandRows.filter((r) => r.order_frequency_class === "Fast").length;
    const medium = brandRows.filter((r) => r.order_frequency_class === "Medium").length;
    const slow = brandRows.filter((r) => r.order_frequency_class === "Slow").length;
    const newOrNoData = brandRows.filter((r) => r.order_frequency_class === "New").length;
    return { brand, total, fast, medium, slow, newOrNoData };
  });

  return (
    <Card>
      <CardHeader className="pb-3 pt-4">
        <CardTitle className="text-sm font-semibold">Brand Velocity Distribution</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pb-4">
        {stats.map((s) => {
          const config = GRABBA_BRAND_CONFIG[s.brand];
          if (s.total === 0) {
            return (
              <div key={s.brand} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{config.icon} {config.name}</span>
                  <span className="text-muted-foreground">No data</span>
                </div>
                <div className="h-3 rounded-full bg-muted" />
              </div>
            );
          }

          const pctFast = (s.fast / s.total) * 100;
          const pctMedium = (s.medium / s.total) * 100;
          const pctSlow = (s.slow / s.total) * 100;
          const pctNew = (s.newOrNoData / s.total) * 100;

          return (
            <div key={s.brand} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">{config.icon} {config.name}</span>
                <span className="text-muted-foreground">{s.total} stores</span>
              </div>
              <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                {pctFast > 0 && (
                  <div
                    className={`${BAR_COLORS.fast} transition-all`}
                    style={{ width: `${pctFast}%` }}
                    title={`Fast: ${s.fast} (${Math.round(pctFast)}%)`}
                  />
                )}
                {pctMedium > 0 && (
                  <div
                    className={`${BAR_COLORS.medium} transition-all`}
                    style={{ width: `${pctMedium}%` }}
                    title={`Medium: ${s.medium} (${Math.round(pctMedium)}%)`}
                  />
                )}
                {pctSlow > 0 && (
                  <div
                    className={`${BAR_COLORS.slow} transition-all`}
                    style={{ width: `${pctSlow}%` }}
                    title={`Slow: ${s.slow} (${Math.round(pctSlow)}%)`}
                  />
                )}
                {pctNew > 0 && (
                  <div
                    className={`${BAR_COLORS.newOrNoData} transition-all`}
                    style={{ width: `${pctNew}%` }}
                    title={`New: ${s.newOrNoData} (${Math.round(pctNew)}%)`}
                  />
                )}
              </div>
              <div className="flex gap-3 text-[10px] text-muted-foreground">
                {s.fast > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />{Math.round(pctFast)}% Fast</span>}
                {s.medium > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />{Math.round(pctMedium)}% Medium</span>}
                {s.slow > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />{Math.round(pctSlow)}% Slow</span>}
                {s.newOrNoData > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" />{Math.round(pctNew)}% New</span>}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
