import { useState } from 'react';
import { Target, Loader2, FileX, BarChart3 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { useAccuracyMetrics, DEFAULT_ACCURACY_FILTERS, AccuracyFilters } from '@/hooks/useAccuracyMetrics';
import { AccuracyKPICards } from './AccuracyKPICards';
import { AccuracyFiltersBar } from './AccuracyFiltersBar';
import { CalibrationChart } from './CalibrationChart';
import { ConfidenceBandsTable } from './ConfidenceBandsTable';
import { DailyAccuracyChart } from './DailyAccuracyChart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';

export function AccuracyDashboard() {
  const [filters, setFilters] = useState<AccuracyFilters>(DEFAULT_ACCURACY_FILTERS);
  
  const {
    results,
    isLoading,
    globalMetrics,
    confidenceBands,
    calibrationData,
    dailyAccuracy,
    weeklyAccuracy,
    monthlyAccuracy,
    last7Days,
  } = useAccuracyMetrics(filters);

  const hasNoData = !isLoading && (!results || results.length === 0);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <AccuracyFiltersBar filters={filters} onChange={setFilters} />

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading accuracy data...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {hasNoData && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileX className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Settled Results Yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Accuracy metrics will populate automatically after games are settled. 
              Run the settlement engine to process final scores.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Main Content - Only show when data exists */}
      {!isLoading && results && results.length > 0 && (
        <>
          {/* KPI Header */}
          <AccuracyKPICards metrics={globalMetrics} last7Days={last7Days} />

          {/* Charts & Analysis */}
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="calibration">Calibration</TabsTrigger>
              <TabsTrigger value="confidence">Confidence Bands</TabsTrigger>
              <TabsTrigger value="trend">Daily Trend</TabsTrigger>
              <TabsTrigger value="results">All Results</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <CalibrationChart data={calibrationData} />
                <ConfidenceBandsTable data={confidenceBands} />
              </div>
              <DailyAccuracyChart data={dailyAccuracy} />
            </TabsContent>

            <TabsContent value="calibration">
              <CalibrationChart data={calibrationData} />
            </TabsContent>

            <TabsContent value="confidence">
              <ConfidenceBandsTable data={confidenceBands} />
            </TabsContent>

            <TabsContent value="trend" className="space-y-4">
              <DailyAccuracyChart data={dailyAccuracy} />
              
              {/* Weekly & Monthly Summary */}
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Weekly */}
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="text-sm font-medium mb-4">Weekly Summary</h3>
                    {weeklyAccuracy.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Week</TableHead>
                            <TableHead className="text-xs text-right">Picks</TableHead>
                            <TableHead className="text-xs text-right">Wins</TableHead>
                            <TableHead className="text-xs text-right">Win%</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {weeklyAccuracy.slice(-8).map((week) => (
                            <TableRow key={week.week}>
                              <TableCell className="text-xs">
                                {format(parseISO(week.week), 'MMM d')}
                              </TableCell>
                              <TableCell className="text-xs text-right">{week.total}</TableCell>
                              <TableCell className="text-xs text-right">{week.wins}</TableCell>
                              <TableCell className={`text-xs text-right font-medium ${
                                week.winRate >= 50 ? 'text-green-500' : 'text-red-500'
                              }`}>
                                {week.winRate.toFixed(1)}%
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-8">No weekly data</p>
                    )}
                  </CardContent>
                </Card>

                {/* Monthly */}
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="text-sm font-medium mb-4">Monthly Summary</h3>
                    {monthlyAccuracy.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Month</TableHead>
                            <TableHead className="text-xs text-right">Picks</TableHead>
                            <TableHead className="text-xs text-right">Wins</TableHead>
                            <TableHead className="text-xs text-right">Win%</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {monthlyAccuracy.map((month) => (
                            <TableRow key={month.month}>
                              <TableCell className="text-xs">
                                {format(parseISO(`${month.month}-01`), 'MMM yyyy')}
                              </TableCell>
                              <TableCell className="text-xs text-right">{month.total}</TableCell>
                              <TableCell className="text-xs text-right">{month.wins}</TableCell>
                              <TableCell className={`text-xs text-right font-medium ${
                                month.winRate >= 50 ? 'text-green-500' : 'text-red-500'
                              }`}>
                                {month.winRate.toFixed(1)}%
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-8">No monthly data</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="results">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm font-medium mb-4 flex items-center justify-between">
                    <span>All Settled Results</span>
                    <Badge variant="secondary" className="text-xs">
                      {results.length} results
                    </Badge>
                  </div>
                  <div className="max-h-[500px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Date</TableHead>
                          <TableHead className="text-xs">Matchup</TableHead>
                          <TableHead className="text-xs">Score</TableHead>
                          <TableHead className="text-xs">AI Pick</TableHead>
                          <TableHead className="text-xs">Actual</TableHead>
                          <TableHead className="text-xs text-right">Prob</TableHead>
                          <TableHead className="text-xs text-right">Conf</TableHead>
                          <TableHead className="text-xs text-center">Result</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.slice(0, 100).map((result) => (
                          <TableRow key={result.id}>
                            <TableCell className="text-xs">
                              {format(parseISO(result.game_date), 'MM/dd')}
                            </TableCell>
                            <TableCell className="text-xs">
                              {result.away_team} @ {result.home_team}
                            </TableCell>
                            <TableCell className="text-xs">
                              {result.away_score ?? '-'} - {result.home_score ?? '-'}
                            </TableCell>
                            <TableCell className="text-xs font-medium">
                              {result.ai_predicted_winner || '—'}
                            </TableCell>
                            <TableCell className="text-xs font-medium">
                              {result.actual_winner}
                            </TableCell>
                            <TableCell className="text-xs text-right">
                              {result.ai_probability !== null 
                                ? `${(Number(result.ai_probability) * 100).toFixed(0)}%` 
                                : '—'}
                            </TableCell>
                            <TableCell className="text-xs text-right">
                              {result.ai_confidence_score !== null 
                                ? `${Number(result.ai_confidence_score).toFixed(0)}%` 
                                : '—'}
                            </TableCell>
                            <TableCell className="text-xs text-center">
                              {result.ai_predicted_winner === null ? (
                                <Badge variant="outline" className="text-[10px]">No Pick</Badge>
                              ) : result.is_correct ? (
                                <Badge variant="default" className="text-[10px] bg-green-500">W</Badge>
                              ) : (
                                <Badge variant="destructive" className="text-[10px]">L</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
