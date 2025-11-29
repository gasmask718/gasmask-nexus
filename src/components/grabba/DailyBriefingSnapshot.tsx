// ═══════════════════════════════════════════════════════════════════════════════
// DAILY BRIEFING SNAPSHOT — Penthouse widget for mission control overview
// ═══════════════════════════════════════════════════════════════════════════════

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useBriefingSnapshot } from '@/hooks/useDailyBriefings';
import { useNavigate } from 'react-router-dom';
import { 
  Sun, 
  Moon, 
  AlertTriangle, 
  FileText, 
  Store, 
  Zap, 
  ExternalLink,
  Clock,
} from 'lucide-react';
import { format } from 'date-fns';

export function DailyBriefingSnapshot() {
  const navigate = useNavigate();
  const { snapshot, loading } = useBriefingSnapshot();

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border-indigo-500/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-32" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full mb-3" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-20" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!snapshot) {
    return (
      <Card className="bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border-indigo-500/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sun className="h-4 w-4 text-indigo-500" />
            Daily Briefing
          </CardTitle>
          <CardDescription>Mission control overview</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            No briefing generated yet today. Generate one to see your daily summary.
          </p>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/grabba/daily-briefing')}
            className="w-full"
          >
            <Zap className="h-3 w-3 mr-2" />
            Generate Briefing
          </Button>
        </CardContent>
      </Card>
    );
  }

  const TypeIcon = snapshot.type === 'morning' ? Sun : Moon;
  const typeLabel = snapshot.type === 'morning' ? 'Morning' : 'Evening';
  const typeColor = snapshot.type === 'morning' ? 'text-yellow-500' : 'text-indigo-500';

  return (
    <Card className="bg-gradient-to-br from-indigo-500/5 to-purple-500/5 border-indigo-500/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <TypeIcon className={`h-4 w-4 ${typeColor}`} />
            Daily Briefing
          </CardTitle>
          <Badge variant="outline" className="text-[10px]">
            {typeLabel}
          </Badge>
        </div>
        {snapshot.generatedAt && (
          <CardDescription className="flex items-center gap-1 text-[10px]">
            <Clock className="h-3 w-3" />
            {format(new Date(snapshot.generatedAt), 'h:mm a')}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* AI Summary */}
        {snapshot.aiSummary && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {snapshot.aiSummary}
          </p>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 rounded bg-red-500/10 border border-red-500/20">
            <div className="flex items-center justify-center gap-1">
              <AlertTriangle className="h-3 w-3 text-red-500" />
              <span className="text-sm font-bold text-red-600">{snapshot.newRisks}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Risks</p>
          </div>
          <div className="text-center p-2 rounded bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center justify-center gap-1">
              <FileText className="h-3 w-3 text-amber-500" />
              <span className="text-sm font-bold text-amber-600">{snapshot.unpaidInvoices}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Unpaid</p>
          </div>
          <div className="text-center p-2 rounded bg-blue-500/10 border border-blue-500/20">
            <div className="flex items-center justify-center gap-1">
              <Store className="h-3 w-3 text-blue-500" />
              <span className="text-sm font-bold text-blue-600">{snapshot.storesNeedingVisits}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Visits</p>
          </div>
        </div>

        {/* Actions Summary */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            <Zap className="h-3 w-3 inline mr-1 text-green-500" />
            {snapshot.totalActions} auto-actions today
          </span>
        </div>

        {/* CTA */}
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => navigate('/grabba/daily-briefing')}
          className="w-full text-xs"
        >
          <ExternalLink className="h-3 w-3 mr-2" />
          Open Full Briefing
        </Button>
      </CardContent>
    </Card>
  );
}
