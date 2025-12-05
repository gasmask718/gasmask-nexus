// src/components/grabba/CustomerMemoryCore.tsx

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

type StoreRecord = {
  id: string;
  name?: string;
  store_name?: string;
  country?: string | null;
  city?: string | null;
  neighborhood?: string | null;
  region?: string | null;
  notes?: string | null;
  tags?: string[] | null;
  [key: string]: any;
};

type StoreContact = {
  id: string;
  store_id: string;
  name?: string | null;
  phone?: string | null;
  role?: string | null;
  relationship?: string | null;
  is_primary?: boolean | null;
  notes?: string | null;
  [key: string]: any;
};

type StoreInteraction = {
  id: string;
  store_id: string;
  contact_id?: string | null;
  interaction_type?: string | null;
  channel?: string | null;
  summary?: string | null;
  details?: string | null;
  tags?: string[] | null;
  created_at?: string | null;
  [key: string]: any;
};

interface CustomerMemoryCoreProps {
  store: StoreRecord | null | undefined;
  contacts: StoreContact[];
  interactions: StoreInteraction[];
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function classNames(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}

export function CustomerMemoryCore({
  store,
  contacts,
  interactions,
}: CustomerMemoryCoreProps) {
  if (!store) return null;

  // ── Identity / country / location ──────────────────────────────
  const country =
    (store.country as string) ||
    (store.region as string) ||
    (store.city as string) ||
    null;

  const neighborhood =
    (store.neighborhood as string) ||
    (store.area as string) ||
    null;

  const storeName = store.store_name || store.name || 'Unnamed Store';

  // ── Contacts / family tree ─────────────────────────────────────
  const primaryOwner =
    contacts.find(
      (c) =>
        c.is_primary ||
        (c.role && c.role.toLowerCase().includes('owner')) ||
        (c.relationship && c.relationship.toLowerCase().includes('owner')),
    ) || null;

  const otherKeyPeople = contacts.filter((c) => c.id !== primaryOwner?.id);

  // ── Last interactions + "important" ones ───────────────────────
  const sortedInteractions = [...interactions].sort((a, b) => {
    const da = a.created_at ? new Date(a.created_at).getTime() : 0;
    const db = b.created_at ? new Date(b.created_at).getTime() : 0;
    return db - da;
  });

  const recentInteractions = sortedInteractions.slice(0, 4);

  const opportunityInteractions = sortedInteractions.filter((i) => {
    const type = (i.interaction_type || i.channel || '').toLowerCase();
    const text = (
      (i.summary || '') +
      ' ' +
      (i.details || '')
    ).toLowerCase();

    return (
      type.includes('opportunity') ||
      type.includes('wholesale') ||
      text.includes('wholesale') ||
      text.includes('new store') ||
      text.includes('open another') ||
      text.includes('expansion')
    );
  });

  const topOpportunities = opportunityInteractions.slice(0, 5);

  const totalVisits = sortedInteractions.filter((i) =>
    (i.interaction_type || i.channel || '').toLowerCase().includes('visit'),
  ).length;

  const potentialWholesale = topOpportunities.length > 0;

  return (
    <Card className="border-amber-500/30 bg-black/40 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>Customer Memory Core</span>
          <span className="rounded-full border border-amber-500/40 px-3 py-0.5 text-xs uppercase tracking-wide text-amber-200">
            Relationship Intelligence
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        {/* SECTION 1: Identity & Country */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs uppercase text-muted-foreground">
                Store Identity
              </div>
              <div className="text-base font-medium">
                {storeName}
              </div>
            </div>
            {country && (
              <div className="rounded-md border border-border bg-black/40 px-3 py-1 text-xs text-muted-foreground">
                Country / Region:{' '}
                <span className="font-medium text-foreground">{country}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {neighborhood && (
              <span className="rounded-full border border-border px-2 py-0.5">
                Neighborhood: <span className="font-medium">{neighborhood}</span>
              </span>
            )}
            {store.city && (
              <span className="rounded-full border border-border px-2 py-0.5">
                City: <span className="font-medium">{store.city}</span>
              </span>
            )}
            {Array.isArray(store.tags) &&
              store.tags.slice(0, 3).map((tag: string) => (
                <span
                  key={tag}
                  className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-200"
                >
                  {tag}
                </span>
              ))}
          </div>
        </div>

        <div className="h-px w-full bg-border/60" />

        {/* SECTION 2: People / family contacts */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground">
              People We Know Here
            </span>
            <span className="text-muted-foreground/70">
              {contacts.length} contact{contacts.length === 1 ? '' : 's'}
            </span>
          </div>

          {primaryOwner ? (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-emerald-300">
                Primary Decision Maker
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-foreground">
                  {primaryOwner.name || 'Unnamed Contact'}
                </span>
                {(primaryOwner.role || primaryOwner.relationship) && (
                  <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200">
                    {primaryOwner.role || primaryOwner.relationship}
                  </span>
                )}
                {primaryOwner.phone && (
                  <span className="text-xs text-muted-foreground">
                    {primaryOwner.phone}
                  </span>
                )}
              </div>
              {primaryOwner.notes && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {primaryOwner.notes}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
              No primary owner saved yet. Mark one contact as "owner" or
              "primary" so the team knows who to build with.
            </div>
          )}

          {otherKeyPeople.length > 0 && (
            <div className="space-y-1.5 text-xs">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Other Key People
              </div>
              <div className="space-y-1.5">
                {otherKeyPeople.slice(0, 4).map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-2 rounded-md bg-black/40 px-2 py-1.5"
                  >
                    <div className="flex flex-col">
                      <span className="text-foreground">
                        {c.name || 'Unnamed'}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {c.relationship || c.role || 'Staff / Contact'}
                      </span>
                    </div>
                    <div className="text-right text-[11px] text-muted-foreground">
                      {c.phone && <div>{c.phone}</div>}
                    </div>
                  </div>
                ))}
                {otherKeyPeople.length > 4 && (
                  <div className="text-[11px] text-muted-foreground">
                    + {otherKeyPeople.length - 4} more contacts
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="h-px w-full bg-border/60" />

        {/* SECTION 3: Important notes / memory */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground">
              Important Things to Remember
            </span>
            <span className="text-muted-foreground/70">
              {recentInteractions.length} recent
            </span>
          </div>

          {recentInteractions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
              No interactions logged yet. Each visit / call should be logged so
              future you remembers the vibe.
            </div>
          ) : (
            <div className="space-y-1.5">
              {recentInteractions.map((i) => (
                <div
                  key={i.id}
                  className="rounded-md bg-black/40 px-3 py-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">
                      {i.summary || i.interaction_type || i.channel || 'Interaction'}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDate(i.created_at)}
                    </span>
                  </div>
                  {i.details && (
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {i.details}
                    </div>
                  )}
                  {Array.isArray(i.tags) && i.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                      {i.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-border px-1.5 py-0.5"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="h-px w-full bg-border/60" />

        {/* SECTION 4: Opportunities & expansion */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground">
              Opportunities & Expansion
            </span>
            {potentialWholesale && (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-200">
                Expansion Signals
              </span>
            )}
          </div>

          {topOpportunities.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
              No explicit wholesale / new store notes logged yet.
              <br />
              When a store mentions "new location", "more boxes", or
              "wholesale", log it as an opportunity so the system remembers.
            </div>
          ) : (
            <div className="space-y-1.5">
              {topOpportunities.map((opp) => (
                <div
                  key={opp.id}
                  className={classNames(
                    'rounded-md border px-3 py-2 text-xs',
                    'border-amber-500/40 bg-amber-500/5',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-amber-100">
                      {opp.summary || 'Opportunity'}
                    </span>
                    <span className="text-[11px] text-amber-200/80">
                      {formatDate(opp.created_at)}
                    </span>
                  </div>
                  {opp.details && (
                    <div className="mt-0.5 text-[11px] text-amber-100/80">
                      {opp.details}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Lightweight "memory decision" summary */}
          <div className="rounded-md bg-black/40 px-3 py-2 text-[11px] text-muted-foreground">
            <div className="font-medium text-foreground">
              Relationship Snapshot
            </div>
            <div className="mt-0.5">
              • Logged visits:{' '}
              <span className="font-semibold">{totalVisits}</span>
              <br />
              • Wholesale / expansion notes:{' '}
              <span className="font-semibold">
                {topOpportunities.length}
              </span>
              <br />
              {potentialWholesale
                ? 'This store has spoken about growth. Treat them like a future partner, not just a buyer.'
                : 'No strong expansion signals yet. Focus on consistency, on-time delivery, and building trust.'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
