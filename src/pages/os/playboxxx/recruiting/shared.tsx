/**
 * Playboxx OS Hub → Recruiting Engine — shared UI + mock scaffolding.
 * Phase: Search + Ingestion only. No outreach, no automation wiring.
 */
import { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Ban, Inbox } from 'lucide-react';

/** business_leads.category values treated as the local staff / service lane. */
export const STAFF_CATEGORIES = [
  'beauty',
  'decorator',
  'private_chef',
  'staff',
  'cleaner',
  'florist',
] as const;

/** business_leads.category values treated as the creator / model lane. */
export const CREATOR_CATEGORIES = [
  'entertainer',
  'photographer',
  'videographer',
  'dj',
] as const;

export const STAFF_ROLE_LABELS = [
  'Hair / Makeup',
  'Nails',
  'Decorator',
  'Chef / Cook',
  'Seamstress',
];

export const CREATOR_CATEGORY_LABELS = ['Creator', 'Model', 'Model Recruiting'];

export const STAFF_SOURCE = 'Overpass / OpenStreetMap';
export const CREATOR_SOURCE = 'Apify / Approved Social Discovery';

export function laneForCategory(category?: string | null): 'staff' | 'creator' | 'other' {
  if (!category) return 'other';
  if ((STAFF_CATEGORIES as readonly string[]).includes(category)) return 'staff';
  if ((CREATOR_CATEGORIES as readonly string[]).includes(category)) return 'creator';
  return 'other';
}

export function prettyRole(category?: string | null) {
  if (!category) return '—';
  return category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function LaneBadge({ lane }: { lane: 'staff' | 'creator' | 'other' }) {
  if (lane === 'staff') {
    return <Badge variant="outline" className="border-primary/40 text-primary">Staff</Badge>;
  }
  if (lane === 'creator') {
    return <Badge variant="outline" className="border-accent-foreground/30">Creator / Model</Badge>;
  }
  return <Badge variant="outline" className="text-muted-foreground">Unclassified</Badge>;
}

export function RecruitingPageHeader({
  title,
  subtitle,
  badge,
  actions,
}: {
  title: string;
  subtitle: string;
  badge?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {badge && <Badge variant="secondary">{badge}</Badge>}
        </div>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function OutreachDisabledBanner({
  text = 'Outreach is currently disabled.',
}: { text?: string }) {
  return (
    <Alert className="border-destructive/30 bg-destructive/10">
      <Ban className="h-4 w-4" />
      <AlertDescription className="text-sm">{text}</AlertDescription>
    </Alert>
  );
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
}: {
  title: string;
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-2 py-14 text-center">
        <Icon className="h-8 w-8 text-muted-foreground" />
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      </CardContent>
    </Card>
  );
}

/* ── Mock scaffolding (UI placeholders until the engine is connected) ── */

export const MOCK_STAFF_ASSIGNMENTS = [
  { id: 'sa-1', location: 'Davao City', role: 'Hairdresser', source: 'Overpass', status: 'Active', lastSearch: 'Aug 27', nextSearch: 'Aug 28', candidates: 84 },
  { id: 'sa-2', location: 'Cebu City', role: 'Seamstress', source: 'Overpass', status: 'Active', lastSearch: 'Aug 27', nextSearch: 'Aug 28', candidates: 43 },
  { id: 'sa-3', location: 'Manila', role: 'Nail Technician', source: 'Overpass', status: 'Active', lastSearch: 'Aug 26', nextSearch: 'Aug 28', candidates: 127 },
];

export const MOCK_CREATOR_ASSIGNMENTS = [
  { id: 'ca-1', location: 'Manila', role: 'Model Recruiting', source: 'Apify', status: 'Active', lastSearch: 'Aug 27', nextSearch: 'Aug 28', candidates: 18 },
  { id: 'ca-2', location: 'Cebu City', role: 'Creator', source: 'Apify', status: 'Paused', lastSearch: 'Aug 25', nextSearch: '—', candidates: 31 },
];

export const MOCK_CREATORS = [
  { name: 'Jane Smith', handle: '@janesmith', platform: 'Instagram', location: 'Manila', followers: '24.5K', portfolio: 'Linked', source: 'Apify', discovered: 'Aug 27, 2026' },
  { name: 'Maria Cruz', handle: '@mariacruz', platform: 'TikTok', location: 'Cebu', followers: '81K', portfolio: 'Linked', source: 'Apify', discovered: 'Aug 27, 2026' },
  { name: 'Anna Lee', handle: '@annalee', platform: 'Instagram', location: 'Davao', followers: '12.8K', portfolio: '—', source: 'Apify', discovered: 'Aug 26, 2026' },
];

export const MOCK_RUNS = [
  { id: '#1842', date: 'Aug 27, 2026 · 12:04 PM', lane: 'Staff', source: 'Overpass', searches: 6, results: 184, newCandidates: 73, duplicates: 111, status: 'Completed' },
  { id: '#1841', date: 'Aug 27, 2026 · 06:04 AM', lane: 'Creator', source: 'Apify', searches: 3, results: 52, newCandidates: 31, duplicates: 21, status: 'Completed' },
  { id: '#1840', date: 'Aug 27, 2026 · 12:04 AM', lane: 'Staff', source: 'Overpass', searches: 2, results: 0, newCandidates: 0, duplicates: 0, status: 'No Results' },
];

export const MOCK_ACTIVITY = [
  { title: 'Staff search — Davao City / Hairdresser', detail: '32 candidates discovered', time: '2 hours ago' },
  { title: 'Creator discovery — Manila / Models', detail: '18 candidates discovered', time: '5 hours ago' },
  { title: 'Staff search — Cebu City / Seamstress', detail: '14 candidates discovered', time: '8 hours ago' },
];

export const MOCK_LOGS = [
  { event: 'Search completed', detail: 'Staff · Davao City · Hairdresser', when: 'Aug 27, 2026 · 12:04 PM', status: 'Success', lane: 'Staff', source: 'Overpass' },
  { event: 'Candidate created', detail: "Maria's Beauty Studio", when: 'Aug 27, 2026 · 12:05 PM', status: 'Success', lane: 'Staff', source: 'Overpass' },
  { event: 'Duplicate skipped', detail: 'Existing candidate matched by source ID', when: 'Aug 27, 2026 · 12:05 PM', status: 'Skipped', lane: 'Staff', source: 'Overpass' },
  { event: 'Search returned no results', detail: 'Cebu City · Seamstress', when: 'Aug 27, 2026 · 12:06 PM', status: 'No Results', lane: 'Staff', source: 'Overpass' },
];
