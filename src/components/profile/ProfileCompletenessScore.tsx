/**
 * Profile Completeness Score — Visual indicator for data quality
 * Computed client-side, never stored
 */
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  score: number; // 0-100
  missingFields: string[];
  label?: string;
}

export function ProfileCompletenessScore({ score, missingFields, label = 'Profile Strength' }: Props) {
  const color = score >= 80 ? 'text-green-500' : score >= 50 ? 'text-amber-500' : 'text-red-500';
  const bgColor = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Badge variant="outline" className={color}>{score}%</Badge>
      </div>
      <Progress value={score} className="h-2" />
      {missingFields.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {missingFields.map((f) => (
            <Badge key={f} variant="outline" className="text-xs text-muted-foreground">
              <AlertCircle className="h-3 w-3 mr-1" />{f}
            </Badge>
          ))}
        </div>
      )}
      {missingFields.length === 0 && (
        <div className="flex items-center gap-1 text-xs text-green-500">
          <CheckCircle2 className="h-3 w-3" /> All fields complete
        </div>
      )}
    </div>
  );
}

// Ambassador completeness calculator
export function computeAmbassadorCompleteness(ambassador: any, territoryCount: number) {
  const checks = [
    { field: 'Phone', present: !!ambassador?.phone_primary },
    { field: 'Email', present: !!ambassador?.profiles?.email },
    { field: 'City', present: !!ambassador?.city },
    { field: 'State', present: !!ambassador?.state },
    { field: 'Territory', present: territoryCount > 0 },
    { field: 'Status', present: ambassador?.is_active !== undefined },
  ];
  const filled = checks.filter(c => c.present).length;
  const missing = checks.filter(c => !c.present).map(c => c.field);
  return { score: Math.round((filled / checks.length) * 100), missingFields: missing };
}

// Influencer completeness calculator
export function computeInfluencerCompleteness(influencer: any) {
  const checks = [
    { field: 'Name', present: !!influencer?.name },
    { field: 'Phone', present: !!influencer?.phone },
    { field: 'City', present: !!influencer?.city },
    { field: 'Birthday', present: !!influencer?.date_of_birth },
    { field: 'Email', present: !!influencer?.email },
    { field: 'Platform', present: !!influencer?.platform },
  ];
  const filled = checks.filter(c => c.present).length;
  const missing = checks.filter(c => !c.present).map(c => c.field);
  return { score: Math.round((filled / checks.length) * 100), missingFields: missing };
}
