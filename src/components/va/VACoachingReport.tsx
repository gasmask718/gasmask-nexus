import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Star, TrendingUp, AlertTriangle, CheckCircle, Lightbulb } from 'lucide-react';

interface CoachingData {
  summary?: string;
  objections_raised?: string[];
  va_strengths?: string[];
  va_improvements?: string[];
  missed_opportunities?: string[];
  recommended_rebuttals?: string[];
  overall_score?: number;
  coaching_note?: string;
  raw?: string;
  parse_error?: boolean;
}

interface VACoachingReportProps {
  data: CoachingData;
  onClose: () => void;
}

export function VACoachingReport({ data, onClose }: VACoachingReportProps) {
  if (data.parse_error && data.raw) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-white text-sm">AI Coaching Report</CardTitle>
          <Button size="icon" variant="ghost" onClick={onClose}><X className="h-4 w-4 text-slate-400" /></Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">{data.raw}</p>
        </CardContent>
      </Card>
    );
  }

  const score = data.overall_score || 0;
  const scoreColor = score >= 8 ? 'text-emerald-400' : score >= 5 ? 'text-amber-400' : 'text-red-400';

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-white text-sm flex items-center gap-2">
          <Star className="h-4 w-4 text-yellow-400" />
          AI Coaching Report
        </CardTitle>
        <Button size="icon" variant="ghost" onClick={onClose}><X className="h-4 w-4 text-slate-400" /></Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Score */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">Overall Score</span>
          <span className={`text-3xl font-bold ${scoreColor}`}>{score}/10</span>
        </div>

        {/* Summary */}
        {data.summary && (
          <div>
            <p className="text-xs text-slate-500 mb-1 font-medium">Summary</p>
            <p className="text-sm text-slate-300">{data.summary}</p>
          </div>
        )}

        {/* Coaching Note */}
        {data.coaching_note && (
          <div className="bg-cyan-500/10 rounded-lg p-2 border border-cyan-500/20">
            <p className="text-sm text-cyan-300">💪 {data.coaching_note}</p>
          </div>
        )}

        {/* Strengths */}
        {data.va_strengths && data.va_strengths.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 mb-1 font-medium flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-emerald-400" /> Strengths
            </p>
            <ul className="space-y-1">
              {data.va_strengths.map((s, i) => (
                <li key={i} className="text-xs text-emerald-300 flex items-start gap-1">
                  <span className="mt-0.5">✓</span> {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Improvements */}
        {data.va_improvements && data.va_improvements.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 mb-1 font-medium flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-amber-400" /> Areas to Improve
            </p>
            <ul className="space-y-1">
              {data.va_improvements.map((s, i) => (
                <li key={i} className="text-xs text-amber-300 flex items-start gap-1">
                  <span className="mt-0.5">→</span> {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Missed Opportunities */}
        {data.missed_opportunities && data.missed_opportunities.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 mb-1 font-medium flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-red-400" /> Missed Opportunities
            </p>
            <ul className="space-y-1">
              {data.missed_opportunities.map((s, i) => (
                <li key={i} className="text-xs text-red-300 flex items-start gap-1">
                  <span className="mt-0.5">!</span> {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommended Rebuttals */}
        {data.recommended_rebuttals && data.recommended_rebuttals.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 mb-1 font-medium flex items-center gap-1">
              <Lightbulb className="h-3 w-3 text-yellow-400" /> Better Rebuttals
            </p>
            <ul className="space-y-1">
              {data.recommended_rebuttals.map((s, i) => (
                <li key={i} className="text-xs text-yellow-300 flex items-start gap-1">
                  <span className="mt-0.5">💡</span> {s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
