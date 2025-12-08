import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, TrendingUp, TrendingDown, Calendar, Eye } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export default function DirectorReportsPanel() {
  const { data: reports, isLoading } = useQuery({
    queryKey: ['director-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_director_reports')
        .select('*')
        .order('report_date', { ascending: false })
        .limit(14);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Director Reports
            </CardTitle>
            <CardDescription>
              Daily summaries of autonomous actions and performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-4">
                {reports?.map((report) => (
                  <div key={report.id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {format(new Date(report.report_date), 'EEEE, MMMM d, yyyy')}
                        </span>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                    </div>
                    
                    {report.summary && (
                      <p className="text-sm text-muted-foreground mb-4">{report.summary}</p>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{report.campaigns_created || 0}</Badge>
                        <span className="text-muted-foreground">Created</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{report.campaigns_optimized || 0}</Badge>
                        <span className="text-muted-foreground">Optimized</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{report.campaigns_paused || 0}</Badge>
                        <span className="text-muted-foreground">Paused</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{report.stores_shifted || 0}</Badge>
                        <span className="text-muted-foreground">Stores</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Predicted:</span>
                        <span className="font-medium">${report.predicted_revenue?.toLocaleString() || 0}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Actual:</span>
                        <span className="font-medium">
                          ${report.actual_revenue?.toLocaleString() || '--'}
                        </span>
                        {report.actual_revenue && report.predicted_revenue && (
                          report.actual_revenue >= report.predicted_revenue ? (
                            <TrendingUp className="h-4 w-4 text-green-500" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-500" />
                          )
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {(!reports || reports.length === 0) && (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No reports generated yet</p>
                    <p className="text-sm">Reports will appear after the director runs</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Performance Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Campaigns Created</span>
              <span className="font-bold">
                {reports?.reduce((acc, r) => acc + (r.campaigns_created || 0), 0) || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Optimizations</span>
              <span className="font-bold">
                {reports?.reduce((acc, r) => acc + (r.campaigns_optimized || 0), 0) || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Stores Reached</span>
              <span className="font-bold">
                {reports?.reduce((acc, r) => acc + (r.stores_shifted || 0), 0) || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Voices Assigned</span>
              <span className="font-bold">
                {reports?.reduce((acc, r) => acc + (r.voices_assigned || 0), 0) || 0}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue Accuracy</CardTitle>
            <CardDescription>Prediction vs actual revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <p className="text-4xl font-bold text-green-500">87%</p>
              <p className="text-sm text-muted-foreground mt-2">Average accuracy</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
