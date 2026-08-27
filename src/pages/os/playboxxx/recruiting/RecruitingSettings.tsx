import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { RecruitingPageHeader, OutreachDisabledBanner, STAFF_SOURCE, CREATOR_SOURCE, STAFF_ROLE_LABELS, CREATOR_CATEGORY_LABELS } from './shared';

function ToggleRow({ label, description, checked = false, disabled = true }: {
  label: string; description: string; checked?: boolean; disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="space-y-0.5">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} disabled={disabled} />
    </div>
  );
}

export default function RecruitingSettings() {
  return (
    <div className="p-6 space-y-6">
      <RecruitingPageHeader
        title="Settings"
        subtitle="Configuration for the Playboxxx Recruiting Engine."
        badge="Search + Ingestion Only"
      />
      <OutreachDisabledBanner />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sources</CardTitle>
            <CardDescription>Discovery sources enabled for each recruiting lane.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Staff lane</span>
              <Badge variant="outline">{STAFF_SOURCE}</Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm">Creator / Model lane</span>
              <Badge variant="outline">{CREATOR_SOURCE}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Automation</CardTitle>
            <CardDescription>These controls are placeholders and are not connected yet.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <ToggleRow label="Enable scheduled searches" description="Automated search runs on a recurring schedule." />
            <ToggleRow label="Auto-ingest new candidates" description="Write discovered results into the shared candidate pool." />
            <ToggleRow label="Duplicate detection" description="Skip candidates already present in the pool." checked disabled />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Outreach</CardTitle>
            <CardDescription>Outreach is disabled at the platform level for this hub.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <ToggleRow label="SMS outreach" description="Not permitted during the Search + Ingestion phase." />
            <ToggleRow label="Email outreach" description="Not permitted during the Search + Ingestion phase." />
            <ToggleRow label="Calling" description="Not permitted during the Search + Ingestion phase." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Categories</CardTitle>
            <CardDescription>Role categories tracked per lane.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-2">Staff / Service Roles</p>
              <div className="flex flex-wrap gap-2">
                {STAFF_ROLE_LABELS.map((c) => <Badge key={c} variant="secondary">{c}</Badge>)}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">Creator / Model</p>
              <div className="flex flex-wrap gap-2">
                {CREATOR_CATEGORY_LABELS.map((c) => <Badge key={c} variant="secondary">{c}</Badge>)}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
