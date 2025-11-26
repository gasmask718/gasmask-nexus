import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { FileText, TrendingUp, AlertCircle, Target, Zap } from 'lucide-react';

interface DailyCEOReportProps {
  compact?: boolean;
}

export function DailyCEOReport({ compact = false }: DailyCEOReportProps) {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLatestReport();
  }, []);

  const fetchLatestReport = async () => {
    try {
      const { data, error } = await supabase
        .from('ceo_reports')
        .select('*')
        .order('report_date', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      setReport(data);
    } catch (error) {
      console.error('Error fetching CEO report:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground text-center">Loading daily report...</p>
      </Card>
    );
  }

  if (!report) {
    return (
      <Card className="p-6 text-center">
        <FileText className="h-12 w-12 mx-auto mb-2 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">No report generated yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Click "Generate Daily Report" to create one
        </p>
      </Card>
    );
  }

  const reportDate = new Date(report.report_date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          <div>
            <h3 className="text-xl font-bold">Daily CEO Report</h3>
            <p className="text-sm text-muted-foreground">{reportDate}</p>
          </div>
        </div>
        <Badge>AI Generated</Badge>
      </div>

      <ScrollArea className={compact ? "h-[300px]" : "h-[500px]"}>
        <div className="space-y-6">
          {/* Revenue Snapshot */}
          {report.revenue_snapshot && (
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Revenue Snapshot
              </h4>
              <div className="p-4 bg-muted rounded-lg">
                <pre className="text-sm whitespace-pre-wrap">
                  {JSON.stringify(report.revenue_snapshot, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* What Changed */}
          {report.changes_summary && Array.isArray(report.changes_summary) && (
            <div>
              <h4 className="font-semibold mb-2">What Changed</h4>
              <div className="space-y-2">
                {report.changes_summary.map((change: any, i: number) => (
                  <div key={i} className="p-3 border rounded-lg text-sm">
                    {typeof change === 'string' ? change : JSON.stringify(change)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Issues */}
          {report.issues && Array.isArray(report.issues) && report.issues.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                What Broke / Issues
              </h4>
              <div className="space-y-2">
                {report.issues.map((issue: any, i: number) => (
                  <div key={i} className="p-3 border border-red-200 rounded-lg text-sm bg-red-50">
                    {typeof issue === 'string' ? issue : JSON.stringify(issue)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Growth Areas */}
          {report.growth_areas && Array.isArray(report.growth_areas) && report.growth_areas.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Zap className="h-4 w-4 text-green-500" />
                What Grew
              </h4>
              <div className="space-y-2">
                {report.growth_areas.map((growth: any, i: number) => (
                  <div key={i} className="p-3 border border-green-200 rounded-lg text-sm bg-green-50">
                    {typeof growth === 'string' ? growth : JSON.stringify(growth)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Items */}
          {report.action_items && Array.isArray(report.action_items) && report.action_items.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Target className="h-4 w-4 text-orange-500" />
                What Needs Action
              </h4>
              <div className="space-y-2">
                {report.action_items.map((action: any, i: number) => (
                  <div key={i} className="p-3 border border-orange-200 rounded-lg text-sm bg-orange-50">
                    {typeof action === 'string' ? action : JSON.stringify(action)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Predictions */}
          {report.ai_predictions && (
            <div>
              <h4 className="font-semibold mb-2">AI Predictions</h4>
              <div className="p-4 bg-muted rounded-lg">
                <pre className="text-sm whitespace-pre-wrap">
                  {JSON.stringify(report.ai_predictions, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}