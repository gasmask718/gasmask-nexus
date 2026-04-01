import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Phone, CheckCircle, Flame, Sun, Snowflake, Clock } from 'lucide-react';

interface SessionStats {
  callsDialed: number;
  callsAnswered: number;
  callsClosed: number;
  hotCount: number;
  warmCount: number;
  coldCount: number;
  avgDurationSeconds: number;
}

interface VASessionSummaryProps {
  stats: SessionStats;
  onClose: () => void;
}

export function VASessionSummary({ stats, onClose }: VASessionSummaryProps) {
  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  };

  const answerRate = stats.callsDialed > 0 ? Math.round((stats.callsAnswered / stats.callsDialed) * 100) : 0;
  const closeRate = stats.callsAnswered > 0 ? Math.round((stats.callsClosed / stats.callsAnswered) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <Card className="bg-slate-800 border-slate-700 w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-400" />
            Session Summary
          </CardTitle>
          <Button size="icon" variant="ghost" onClick={onClose}><X className="h-4 w-4 text-slate-400" /></Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Main Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <Phone className="h-4 w-4 mx-auto text-cyan-400 mb-1" />
              <p className="text-2xl font-bold text-white">{stats.callsDialed}</p>
              <p className="text-[10px] text-slate-400">Dialed</p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <Phone className="h-4 w-4 mx-auto text-emerald-400 mb-1" />
              <p className="text-2xl font-bold text-white">{stats.callsAnswered}</p>
              <p className="text-[10px] text-slate-400">Answered</p>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-3 text-center">
              <CheckCircle className="h-4 w-4 mx-auto text-yellow-400 mb-1" />
              <p className="text-2xl font-bold text-white">{stats.callsClosed}</p>
              <p className="text-[10px] text-slate-400">Closed</p>
            </div>
          </div>

          {/* Rates */}
          <div className="flex gap-3">
            <div className="flex-1 bg-slate-700/30 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-cyan-400">{answerRate}%</p>
              <p className="text-[10px] text-slate-400">Answer Rate</p>
            </div>
            <div className="flex-1 bg-slate-700/30 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-emerald-400">{closeRate}%</p>
              <p className="text-[10px] text-slate-400">Close Rate</p>
            </div>
            <div className="flex-1 bg-slate-700/30 rounded-lg p-2 text-center">
              <p className="text-lg font-bold text-slate-300">{formatDuration(stats.avgDurationSeconds)}</p>
              <p className="text-[10px] text-slate-400">Avg Duration</p>
            </div>
          </div>

          {/* Excitement Breakdown */}
          <div className="flex gap-2 justify-center">
            <Badge className="bg-red-600/20 text-red-400 gap-1">
              <Flame className="h-3 w-3" /> {stats.hotCount} HOT
            </Badge>
            <Badge className="bg-amber-600/20 text-amber-400 gap-1">
              <Sun className="h-3 w-3" /> {stats.warmCount} WARM
            </Badge>
            <Badge className="bg-blue-600/20 text-blue-400 gap-1">
              <Snowflake className="h-3 w-3" /> {stats.coldCount} COLD
            </Badge>
          </div>

          <Button onClick={onClose} className="w-full bg-cyan-600 hover:bg-cyan-700">
            Close Summary
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
