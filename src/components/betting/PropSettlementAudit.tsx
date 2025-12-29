import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Database, Play, Filter } from 'lucide-react';
import { usePropSettlement, usePlayerBoxScores } from '@/hooks/usePropSettlement';
import { format } from 'date-fns';

export function PropSettlementAudit() {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  
  const {
    runSettlement,
    isSettling,
    lastSettlementRun,
    boxScoresCount,
    openEntriesCount,
    auditLogs,
    refetchAuditLogs,
  } = usePropSettlement();

  const { data: boxScores, isLoading: boxScoresLoading } = usePlayerBoxScores(selectedDate);

  const getResultBadge = (result: string) => {
    switch (result) {
      case 'W':
        return <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Win</Badge>;
      case 'L':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Loss</Badge>;
      case 'Push':
        return <Badge variant="secondary">Push</Badge>;
      default:
        return <Badge variant="outline">{result}</Badge>;
    }
  };

  const getComparisonBadge = (comparison: string) => {
    switch (comparison) {
      case 'OVER':
        return <Badge variant="outline" className="text-green-600 border-green-600">OVER</Badge>;
      case 'UNDER':
        return <Badge variant="outline" className="text-red-600 border-red-600">UNDER</Badge>;
      case 'PUSH':
        return <Badge variant="outline">PUSH</Badge>;
      default:
        return <Badge variant="outline">{comparison}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Settlement Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Prop Settlement Engine
              </CardTitle>
              <CardDescription className="mt-1">
                Settles props using FINAL box score stats only. No averages or projections.
              </CardDescription>
            </div>
            <Button 
              onClick={runSettlement} 
              disabled={isSettling}
              className="gap-2"
            >
              {isSettling ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Run Settlement
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-sm text-muted-foreground">Box Scores</div>
              <div className="text-2xl font-bold">{boxScoresCount}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-sm text-muted-foreground">Open Props</div>
              <div className="text-2xl font-bold">{openEntriesCount}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-sm text-muted-foreground">Last Run</div>
              <div className="text-sm font-medium">
                {lastSettlementRun 
                  ? format(lastSettlementRun, 'HH:mm:ss')
                  : 'Never'}
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-sm text-muted-foreground">Audit Logs</div>
              <div className="text-2xl font-bold">{auditLogs.length}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Box Scores for Date */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Player Box Scores</CardTitle>
              <CardDescription>Final game stats used for settlement</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-40"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {boxScoresLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !boxScores?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No box scores for {selectedDate}</p>
              <p className="text-sm mt-1">Run "Update Scores" to fetch final stats</p>
            </div>
          ) : (
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-right">PTS</TableHead>
                    <TableHead className="text-right">REB</TableHead>
                    <TableHead className="text-right">AST</TableHead>
                    <TableHead className="text-right">PRA</TableHead>
                    <TableHead className="text-right">3PM</TableHead>
                    <TableHead className="text-right">MIN</TableHead>
                    <TableHead>DNP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boxScores.slice(0, 50).map((bs) => (
                    <TableRow key={bs.id} className={bs.dnp ? 'opacity-50' : ''}>
                      <TableCell className="font-medium">{bs.player_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{bs.team}</Badge>
                        <span className="text-xs text-muted-foreground ml-1">vs {bs.opponent}</span>
                      </TableCell>
                      <TableCell className="text-right font-mono">{bs.points}</TableCell>
                      <TableCell className="text-right font-mono">{bs.rebounds}</TableCell>
                      <TableCell className="text-right font-mono">{bs.assists}</TableCell>
                      <TableCell className="text-right font-mono font-bold">{bs.pra}</TableCell>
                      <TableCell className="text-right font-mono">{bs.three_pointers_made}</TableCell>
                      <TableCell className="text-right font-mono">{bs.minutes}</TableCell>
                      <TableCell>
                        {bs.dnp ? (
                          <Badge variant="destructive" className="text-xs">DNP</Badge>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settlement Audit Trail */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Settlement Audit Trail</CardTitle>
              <CardDescription>Every settled prop with stat source verification</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchAuditLogs()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!auditLogs.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No settlement audit logs yet</p>
              <p className="text-sm mt-1">Run settlement to create audit entries</p>
            </div>
          ) : (
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Settled</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead>Stat</TableHead>
                    <TableHead className="text-right">Line</TableHead>
                    <TableHead>Side</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead>Comparison</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>DNP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(log.settled_at), 'MMM d HH:mm')}
                      </TableCell>
                      <TableCell className="font-medium">{log.player_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.stat_type}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{log.line_value}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={log.side === 'MORE' ? 'text-green-600 border-green-600' : 'text-red-600 border-red-600'}
                        >
                          {log.side}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {log.final_stat_value}
                      </TableCell>
                      <TableCell>{getComparisonBadge(log.comparison_result)}</TableCell>
                      <TableCell>{getResultBadge(log.result)}</TableCell>
                      <TableCell>
                        {log.dnp ? (
                          <Badge variant="destructive" className="text-xs">DNP</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">{log.minutes_played}m</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
