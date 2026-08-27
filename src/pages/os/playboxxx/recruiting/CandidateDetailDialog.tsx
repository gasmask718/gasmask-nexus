import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { LaneBadge, laneForCategory, prettyRole, STAFF_SOURCE, CREATOR_SOURCE } from './shared';

export interface CandidateRow {
  id: string;
  business_name: string | null;
  contact_name: string | null;
  category: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  full_address: string | null;
  source: string | null;
  external_source: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm break-words">{value || '—'}</p>
    </div>
  );
}

export default function CandidateDetailDialog({
  candidate,
  onOpenChange,
}: {
  candidate: CandidateRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const lane = laneForCategory(candidate?.category);

  return (
    <Dialog open={!!candidate} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {candidate && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {candidate.business_name || candidate.contact_name || 'Candidate'}
                <LaneBadge lane={lane} />
              </DialogTitle>
              <DialogDescription>
                Discovery record — outreach actions are disabled during the Search + Ingestion phase.
              </DialogDescription>
            </DialogHeader>

            {lane === 'creator' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Name" value={candidate.contact_name || candidate.business_name} />
                <Field label="Handle" value="Not captured yet" />
                <Field label="Platform" value="Not captured yet" />
                <Field label="Profile URL" value={candidate.website} />
                <Field label="Location" value={[candidate.city, candidate.state].filter(Boolean).join(', ')} />
                <Field label="Portfolio" value="Not captured yet" />
                <Field label="Followers" value="Not captured yet" />
                <Field label="Source" value={candidate.external_source || CREATOR_SOURCE} />
                <Field label="First Discovered" value={candidate.created_at ? new Date(candidate.created_at).toLocaleString() : null} />
                <Field label="Last Updated" value={candidate.updated_at ? new Date(candidate.updated_at).toLocaleString() : null} />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Name" value={candidate.contact_name} />
                <Field label="Business" value={candidate.business_name} />
                <Field label="Role" value={prettyRole(candidate.category)} />
                <Field label="Location" value={[candidate.city, candidate.state].filter(Boolean).join(', ')} />
                <Field label="Address" value={candidate.full_address} />
                <Field label="Phone" value={candidate.phone} />
                <Field label="Website" value={candidate.website} />
                <Field label="Source" value={candidate.external_source || candidate.source || STAFF_SOURCE} />
                <Field label="First Discovered" value={candidate.created_at ? new Date(candidate.created_at).toLocaleString() : null} />
                <Field label="Last Updated" value={candidate.updated_at ? new Date(candidate.updated_at).toLocaleString() : null} />
              </div>
            )}

            <Separator />
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{candidate.status || 'new'}</Badge>
              <span className="text-xs text-muted-foreground">Outreach Disabled</span>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
