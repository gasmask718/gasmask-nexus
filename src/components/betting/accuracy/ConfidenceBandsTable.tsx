import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ConfidenceBandMetrics } from '@/hooks/useAccuracyMetrics';
import { BarChart3, TrendingUp, TrendingDown } from 'lucide-react';

interface ConfidenceBandsTableProps {
  data: ConfidenceBandMetrics[];
}

export function ConfidenceBandsTable({ data }: ConfidenceBandsTableProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Accuracy by Confidence Band
          </CardTitle>
          <CardDescription className="text-xs">
            Performance breakdown by AI confidence score
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground text-sm py-12">
            No confidence-scored predictions available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Find best performing band
  const bestBand = data.reduce((a, b) => a.winRate > b.winRate ? a : b);
  const totalPicks = data.reduce((sum, b) => sum + b.total, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Accuracy by Confidence Band
            </CardTitle>
            <CardDescription className="text-xs">
              {totalPicks} predictions across {data.length} confidence bands
            </CardDescription>
          </div>
          {bestBand && (
            <Badge variant="secondary" className="text-xs">
              Best: {bestBand.band} ({bestBand.winRate.toFixed(1)}%)
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs">Band</TableHead>
              <TableHead className="text-xs text-right">Count</TableHead>
              <TableHead className="text-xs text-right">Wins</TableHead>
              <TableHead className="text-xs text-right">Losses</TableHead>
              <TableHead className="text-xs text-right">Win%</TableHead>
              <TableHead className="text-xs text-right">Avg Prob</TableHead>
              <TableHead className="text-xs text-right">Cal. Gap</TableHead>
              <TableHead className="text-xs text-right">Trend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((band) => {
              const isOverperforming = band.calibrationGap > 0;
              const isWinning = band.winRate >= 50;
              
              return (
                <TableRow key={band.band}>
                  <TableCell className="font-medium text-xs">
                    {band.band}
                    {band.band === bestBand.band && (
                      <Badge variant="default" className="ml-2 text-[10px] px-1 py-0">
                        Best
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-right">{band.total}</TableCell>
                  <TableCell className="text-xs text-right text-green-500">{band.wins}</TableCell>
                  <TableCell className="text-xs text-right text-red-500">{band.losses}</TableCell>
                  <TableCell className={`text-xs text-right font-medium ${isWinning ? 'text-green-500' : 'text-red-500'}`}>
                    {band.winRate.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-xs text-right">
                    {band.avgProbability.toFixed(1)}%
                  </TableCell>
                  <TableCell className={`text-xs text-right font-medium ${isOverperforming ? 'text-green-500' : 'text-red-500'}`}>
                    {isOverperforming ? '+' : ''}{band.calibrationGap.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-xs text-right">
                    {isOverperforming ? (
                      <TrendingUp className="h-4 w-4 text-green-500 inline" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500 inline" />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {/* Summary insights */}
        <div className="mt-4 p-3 bg-muted/50 rounded-lg text-xs space-y-1">
          <p className="font-medium">Key Insights:</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>
              <span className="text-foreground font-medium">{bestBand.band}</span> band has highest accuracy at {bestBand.winRate.toFixed(1)}%
            </li>
            {data.filter(b => b.calibrationGap > 5).length > 0 && (
              <li>
                Model is <span className="text-green-500 font-medium">underconfident</span> in bands: {data.filter(b => b.calibrationGap > 5).map(b => b.band).join(', ')}
              </li>
            )}
            {data.filter(b => b.calibrationGap < -5).length > 0 && (
              <li>
                Model is <span className="text-red-500 font-medium">overconfident</span> in bands: {data.filter(b => b.calibrationGap < -5).map(b => b.band).join(', ')}
              </li>
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
