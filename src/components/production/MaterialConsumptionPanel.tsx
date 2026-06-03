/**
 * MATERIAL CONSUMPTION INTELLIGENCE
 * Shows daily, 7d avg, 30d avg, lifetime material usage.
 */

import { useMemo } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { BilingualLabel } from '@/components/portal/BilingualLabel';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDailyMaterialSummary, useLifetimeMaterialSummary } from '@/hooks/useProductionMaterials';
import { Leaf, Package, Box, Tag, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, subDays } from 'date-fns';

interface MaterialConsumptionPanelProps {
  officeId: string;
}

const MATERIAL_LABELS: Record<string, { label: string; unit: string; icon: React.ReactNode }> = {
  tobacco_lbs: { label: 'Tobacco', unit: 'lbs', icon: <Leaf className="h-4 w-4 text-emerald-600" /> },
  tubes: { label: 'Tubes', unit: 'units', icon: <Package className="h-4 w-4 text-blue-600" /> },
  bags: { label: 'Bags', unit: 'units', icon: <Package className="h-4 w-4 text-purple-600" /> },
  stickers: { label: 'Stickers', unit: 'units', icon: <Tag className="h-4 w-4 text-amber-600" /> },
  boxes: { label: 'Boxes', unit: 'boxes', icon: <Box className="h-4 w-4 text-sky-600" /> },
  other: { label: 'Other', unit: 'units', icon: <Layers className="h-4 w-4 text-muted-foreground" /> },
};

export function MaterialConsumptionPanel({ officeId }: MaterialConsumptionPanelProps) {
  const { t } = useTranslation();
  const { data: dailyData = [], isLoading } = useDailyMaterialSummary(officeId);
  const { data: lifetimeData = [] } = useLifetimeMaterialSummary(officeId);

  const today = format(new Date(), 'yyyy-MM-dd');
  const d7ago = format(subDays(new Date(), 7), 'yyyy-MM-dd');
  const d30ago = format(subDays(new Date(), 30), 'yyyy-MM-dd');

  const materialTypes = useMemo(() => {
    const types = new Set<string>();
    dailyData.forEach(d => types.add(d.material_type));
    lifetimeData.forEach(d => types.add(d.material_type));
    return Array.from(types);
  }, [dailyData, lifetimeData]);

  const getAgg = (matType: string, startDate: string, endDate: string) => {
    const records = dailyData.filter(d =>
      d.material_type === matType && d.usage_date >= startDate && d.usage_date <= endDate
    );
    return records.reduce((sum, r) => sum + (r.total_used || 0), 0);
  };

  const rows = useMemo(() => materialTypes.map(mt => {
    const todayUsed = getAgg(mt, today, today);
    const last7d = getAgg(mt, d7ago, today);
    const last30d = getAgg(mt, d30ago, today);
    const daysIn7 = Math.min(dailyData.filter(d => d.material_type === mt && d.usage_date >= d7ago).length, 7) || 1;
    const daysIn30 = Math.min(dailyData.filter(d => d.material_type === mt && d.usage_date >= d30ago).length, 30) || 1;
    const lifetime = lifetimeData.find(l => l.material_type === mt)?.lifetime_used || 0;
    const meta = MATERIAL_LABELS[mt] || MATERIAL_LABELS.other;

    return {
      type: mt,
      ...meta,
      today: todayUsed,
      avg7d: last7d / daysIn7,
      avg30d: last30d / daysIn30,
      lifetime,
    };
  }), [materialTypes, dailyData, lifetimeData]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">{t("production.loading_material_data")}</CardContent>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Leaf className="h-5 w-5 text-emerald-600" />
            <BilingualLabel tKey="production.material_consumption_intel" en="Material Consumption Intelligence" />
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8 text-muted-foreground text-sm">
          {t("production.no_material_usage")}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Leaf className="h-5 w-5 text-emerald-600" />
          <BilingualLabel tKey="production.material_consumption_intel" en="Material Consumption Intelligence" />
        </CardTitle>
        <CardDescription>{t("production.material_consumption_intel_desc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs"><BilingualLabel tKey="production.material" en="Material" /></TableHead>
              <TableHead className="text-xs text-right"><BilingualLabel tKey="production.today" en="Today" /></TableHead>
              <TableHead className="text-xs text-right"><BilingualLabel tKey="production.avg_7d" en="7d Avg" /></TableHead>
              <TableHead className="text-xs text-right"><BilingualLabel tKey="production.avg_30d" en="30d Avg" /></TableHead>
              <TableHead className="text-xs text-right"><BilingualLabel tKey="production.lifetime" en="Lifetime" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(row => (
              <TableRow key={row.type}>
                <TableCell className="text-xs">
                  <div className="flex items-center gap-2">
                    {row.icon}
                    <span className="font-medium">{row.label}</span>
                    <Badge variant="outline" className="text-[9px]">{row.unit}</Badge>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-right font-mono">{row.today.toLocaleString(undefined, { maximumFractionDigits: 1 })}</TableCell>
                <TableCell className="text-xs text-right font-mono text-muted-foreground">{row.avg7d.toFixed(1)}</TableCell>
                <TableCell className="text-xs text-right font-mono text-muted-foreground">{row.avg30d.toFixed(1)}</TableCell>
                <TableCell className="text-xs text-right font-mono font-semibold">{row.lifetime.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
