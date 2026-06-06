// Production trend view — lbs processed + boxes produced over time, brand-filterable.
// Reads production_batches (tobacco_lbs, brand, batch_date) + production_batch_outputs
// (boxes_completed via batch join). Conversion line = boxes per lb.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useGrabbaBrand } from "@/contexts/GrabbaBrandContext";
import { CANONICAL_BRANDS, type CanonicalBrandId } from "@/config/brands";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  Tooltip, Legend, CartesianGrid,
} from "recharts";
import { format, startOfWeek, startOfMonth, parseISO } from "date-fns";
import { TrendingUp } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

type Bucket = "week" | "month";

interface Row { batch_date: string; brand: string; tobacco_lbs: number | null; }
interface Output { batch_id: string; boxes_completed: number | null; }

function bucketKey(dateStr: string, bucket: Bucket) {
  const d = parseISO(dateStr);
  const start = bucket === "week" ? startOfWeek(d, { weekStartsOn: 1 }) : startOfMonth(d);
  return format(start, "yyyy-MM-dd");
}

export function ProductionTrendsTab() {
  const { selectedBrand, getBrandQuery } = useGrabbaBrand();
  const { t } = useTranslation();
  const [bucket, setBucket] = useState<Bucket>("week");

  const { data, isLoading } = useQuery({
    queryKey: ["production-trends", selectedBrand],
    queryFn: async () => {
      const brands = getBrandQuery();
      const { data: batches, error } = await supabase
        .from("production_batches")
        .select("id, batch_date, brand, tobacco_lbs")
        .in("brand", brands)
        .order("batch_date", { ascending: true });
      if (error) throw error;
      const ids = (batches || []).map((b: any) => b.id);
      let outputs: Output[] = [];
      if (ids.length) {
        const { data: o, error: oErr } = await supabase
          .from("production_batch_outputs")
          .select("batch_id, boxes_completed")
          .in("batch_id", ids);
        if (oErr) throw oErr;
        outputs = (o || []) as Output[];
      }
      return { batches: (batches || []) as any as (Row & { id: string })[], outputs };
    },
  });

  const chartData = useMemo(() => {
    if (!data) return [];
    const boxesByBatch = new Map<string, number>();
    data.outputs.forEach((o) => {
      boxesByBatch.set(o.batch_id, (boxesByBatch.get(o.batch_id) || 0) + Number(o.boxes_completed || 0));
    });
    const byBucket = new Map<string, { period: string; lbs: number; boxes: number }>();
    data.batches.forEach((b: any) => {
      if (!b.batch_date) return;
      const k = bucketKey(b.batch_date, bucket);
      const cur = byBucket.get(k) || { period: k, lbs: 0, boxes: 0 };
      cur.lbs += Number(b.tobacco_lbs || 0);
      cur.boxes += boxesByBatch.get(b.id) || 0;
      byBucket.set(k, cur);
    });
    return Array.from(byBucket.values())
      .sort((a, b) => a.period.localeCompare(b.period))
      .map((r) => ({
        ...r,
        label: format(parseISO(r.period), bucket === "week" ? "MMM d" : "MMM yyyy"),
        boxesPerLb: r.lbs > 0 ? Number((r.boxes / r.lbs).toFixed(2)) : 0,
      }));
  }, [data, bucket]);

  const totals = useMemo(() => {
    const lbs = chartData.reduce((s, r) => s + r.lbs, 0);
    const boxes = chartData.reduce((s, r) => s + r.boxes, 0);
    return { lbs, boxes, ratio: lbs > 0 ? (boxes / lbs).toFixed(2) : "—" };
  }, [chartData]);

  const brandLabel = selectedBrand === "all"
    ? t('production.trends.all_brands')
    : CANONICAL_BRANDS[selectedBrand as CanonicalBrandId]?.displayName || selectedBrand;

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              {t('production.trends.title', { brand: brandLabel })}
            </CardTitle>
            <CardDescription>
              {t('production.trends.desc')}
            </CardDescription>
          </div>
          <Tabs value={bucket} onValueChange={(v) => setBucket(v as Bucket)}>
            <TabsList>
              <TabsTrigger value="week">{t('production.trends.week')}</TabsTrigger>
              <TabsTrigger value="month">{t('production.trends.month')}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex gap-2 flex-wrap pt-2">
          <Badge variant="outline">{t('production.trends.lbs', { n: totals.lbs.toLocaleString() })}</Badge>
          <Badge variant="outline">{t('production.trends.boxes', { n: totals.boxes.toLocaleString() })}</Badge>
          <Badge variant="outline">{t('production.trends.ratio', { n: totals.ratio })}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">{t('common.loading_ellipsis')}</div>
        ) : chartData.length === 0 ? (
          <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">
            {t('production.trends.empty', { brand: brandLabel })}
          </div>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" className="text-xs" />
                <YAxis yAxisId="left" className="text-xs" />
                <YAxis yAxisId="right" orientation="right" className="text-xs" />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                  }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="lbs" name={t('production.trends.bar_lbs')} fill="hsl(var(--chart-1, var(--primary)))" />
                <Bar yAxisId="left" dataKey="boxes" name={t('production.trends.bar_boxes')} fill="hsl(var(--chart-2, var(--accent)))" />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="boxesPerLb"
                  name={t('production.trends.line_efficiency')}
                  stroke="hsl(var(--destructive))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
