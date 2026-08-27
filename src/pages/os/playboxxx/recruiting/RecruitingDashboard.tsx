import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import {
  Users, UserCog, Camera, CalendarClock, CheckCircle2, XCircle, CopyCheck, MapPin, Sparkles,
} from 'lucide-react';
import {
  RecruitingPageHeader, OutreachDisabledBanner, STAFF_CATEGORIES, CREATOR_CATEGORIES,
  STAFF_ROLE_LABELS, CREATOR_CATEGORY_LABELS, STAFF_SOURCE, CREATOR_SOURCE, MOCK_ACTIVITY,
} from './shared';

async function countLeads(categories?: readonly string[]) {
  let q = supabase.from('business_leads').select('id', { count: 'exact', head: true });
  if (categories) q = q.in('category', categories as string[]);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

export default function RecruitingDashboard() {
  const totals = useQuery({
    queryKey: ['recruiting-engine', 'counts'],
    queryFn: async () => ({
      staff: await countLeads(STAFF_CATEGORIES),
      creator: await countLeads(CREATOR_CATEGORIES),
      total: await countLeads([...STAFF_CATEGORIES, ...CREATOR_CATEGORIES]),
    }),
  });

  const stats = [
    { label: 'Total Candidates', value: totals.data?.total, icon: Users },
    { label: 'Staff Candidates', value: totals.data?.staff, icon: UserCog },
    { label: 'Creator / Model Candidates', value: totals.data?.creator, icon: Camera },
    { label: 'Searches Due', value: 5, icon: CalendarClock, placeholder: true },
    { label: 'Successful Runs', value: 128, icon: CheckCircle2, placeholder: true },
    { label: 'Failed Runs', value: 3, icon: XCircle, placeholder: true },
    { label: 'Duplicates Prevented', value: 1_412, icon: CopyCheck, placeholder: true },
  ];

  return (
    <div className="p-6 space-y-6">
      <RecruitingPageHeader
        title="Recruiting Engine"
        subtitle="Internal candidate discovery and research workspace for Playboxxx."
        badge="Search + Ingestion Only"
      />
      <OutreachDisabledBanner />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  {totals.isLoading && !s.placeholder ? (
                    <Skeleton className="h-8 w-20 mt-1" />
                  ) : (
                    <p className="text-2xl font-bold mt-1">
                      {(s.value ?? 0).toLocaleString()}
                    </p>
                  )}
                  {s.placeholder && (
                    <p className="text-xs text-muted-foreground mt-1">Placeholder</p>
                  )}
                </div>
                <s.icon className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {MOCK_ACTIVITY.map((a) => (
              <div key={a.title} className="flex items-start justify-between gap-3 border-b border-border/50 pb-3 last:border-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.detail}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{a.time}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Local Staff / Service Roles
              </CardTitle>
              <p className="text-xs text-muted-foreground">Source: {STAFF_SOURCE}</p>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {STAFF_ROLE_LABELS.map((r) => (
                <Badge key={r} variant="secondary">{r}</Badge>
              ))}
            </CardContent>
          </Card>

          <Card className="border-muted-foreground/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Creator / Model
              </CardTitle>
              <p className="text-xs text-muted-foreground">Source: {CREATOR_SOURCE}</p>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {CREATOR_CATEGORY_LABELS.map((c) => (
                <Badge key={c} variant="outline">{c}</Badge>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
