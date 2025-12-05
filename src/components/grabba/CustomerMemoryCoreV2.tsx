import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

type StoreRecord = {
  id: string;
  store_name?: string;
  name?: string;
  notes?: string | null;
  important_notes?: string | null;
  opportunities?: string[] | null;
  red_flags?: string[] | null;
  green_flags?: string[] | null;
  wholesale_interest?: boolean | null;
  country?: string | null;
  [key: string]: any;
};

type StoreContact = {
  id: string;
  store_id: string;
  name?: string | null;
  phone?: string | null;
  role?: string | null;
  notes?: string | null;
  tags?: string[] | null;
  photo_url?: string | null;
  [key: string]: any;
};

type StoreInteraction = {
  id: string;
  store_id?: string | null;
  interaction_type?: string | null;
  type?: string | null;
  notes?: string | null;
  summary?: string | null;
  created_at?: string | null;
  [key: string]: any;
};

type StoreVisit = {
  id: string;
  store_id?: string | null;
  purpose?: string | null;
  notes?: string | null;
  created_at?: string | null;
  [key: string]: any;
};

interface CustomerMemoryCoreV2Props {
  store: StoreRecord | null | undefined;
  contacts: StoreContact[];
  interactions: StoreInteraction[];
  visits?: StoreVisit[];
}

// Generate tags from contact notes
function extractTags(str = ""): string[] {
  const words = str.toLowerCase();
  const tags: string[] = [];

  if (words.includes("friendly")) tags.push("Friendly");
  if (words.includes("negotiat")) tags.push("Negotiator");
  if (words.includes("late")) tags.push("Late Payer");
  if (words.includes("loyal")) tags.push("Loyal");
  if (words.includes("bulk")) tags.push("Bulk Buyer");
  if (words.includes("wholesale")) tags.push("Wholesale Potential");
  if (words.includes("brother") || words.includes("cousin")) tags.push("Family Operated");
  if (words.includes("picky")) tags.push("Picky Buyer");
  if (words.includes("upsell")) tags.push("Upsell Potential");

  return tags;
}

export function CustomerMemoryCoreV2({ store, contacts, interactions, visits = [] }: CustomerMemoryCoreV2Props) {
  if (!store) return null;

  const primaryContacts = contacts?.filter(c => c.role?.toLowerCase() === "owner") || [];
  const otherContacts = contacts?.filter(c => c.role?.toLowerCase() !== "owner") || [];

  const importantNotes = store.important_notes || store.notes || "No notes saved yet";
  const opportunities = store.opportunities || [];
  const redFlags = store.red_flags || [];
  const greenFlags = store.green_flags || [];
  const wholesaleInterest = store.wholesale_interest || false;
  const country = store.country || "Unknown";

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Customer Memory Core — V2</CardTitle>
        <CardDescription>
          Deep-memory intelligence for relationship building, opportunity spotting, and long-term store strategy.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-8">
        
        {/* CONTACTS WITH PHOTOS & TAGS */}
        <section>
          <h3 className="font-semibold text-lg mb-3">Primary Contacts (Owners)</h3>

          {primaryContacts.length > 0 ? (
            primaryContacts.map((c) => {
              const tags = [...(c.tags || []), ...extractTags(c.notes || "")];
              return (
                <div key={c.id} className="p-3 border rounded-lg mb-3 flex items-start gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={c.photo_url || undefined} />
                    <AvatarFallback>{c.name?.charAt(0) || "?"}</AvatarFallback>
                  </Avatar>

                  <div className="flex-1">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-sm text-muted-foreground">{c.role}</p>
                    <p className="text-sm">Phone: {c.phone || "N/A"}</p>

                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {tags.map((tag, idx) => (
                          <Badge key={idx} variant="secondary">{tag}</Badge>
                        ))}
                      </div>
                    )}

                    {c.notes && (
                      <p className="text-sm text-muted-foreground mt-2">{c.notes}</p>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-muted-foreground text-sm">No owners saved yet</p>
          )}
        </section>

        {/* ADDITIONAL CONTACTS */}
        <section>
          <h3 className="font-semibold text-lg mb-3">Additional Contacts</h3>

          {otherContacts.length > 0 ? (
            otherContacts.map((c) => {
              const tags = [...(c.tags || []), ...extractTags(c.notes || "")];

              return (
                <div key={c.id} className="p-3 border rounded-lg mb-3 flex items-start gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={c.photo_url || undefined} />
                    <AvatarFallback>{c.name?.charAt(0) || "?"}</AvatarFallback>
                  </Avatar>

                  <div className="flex-1">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-sm text-muted-foreground">{c.role}</p>
                    <p className="text-sm">Phone: {c.phone || "N/A"}</p>

                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {tags.map((tag, idx) => (
                          <Badge key={idx} variant="secondary">{tag}</Badge>
                        ))}
                      </div>
                    )}

                    {c.notes && (
                      <p className="text-sm text-muted-foreground mt-2">{c.notes}</p>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-muted-foreground text-sm">No additional contacts saved</p>
          )}
        </section>

        {/* IMPORTANT RELATIONSHIP NOTES */}
        <section>
          <h3 className="font-semibold text-lg mb-2">Important Relationship Notes</h3>
          <p className="whitespace-pre-wrap text-sm">{importantNotes}</p>
        </section>

        {/* RED FLAGS & GREEN FLAGS */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold mb-2">Red Flags</h3>
            {redFlags.length > 0 ? (
              redFlags.map((r, i) => (
                <p key={i} className="text-sm mb-1 text-destructive">⚠️ {r}</p>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">No red flags recorded</p>
            )}
          </div>

          <div>
            <h3 className="font-semibold mb-2">Green Flags</h3>
            {greenFlags.length > 0 ? (
              greenFlags.map((g, i) => (
                <p key={i} className="text-sm mb-1 text-green-500">✔️ {g}</p>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">No green flags recorded</p>
            )}
          </div>
        </section>

        {/* OPPORTUNITIES */}
        <section>
          <h3 className="font-semibold text-lg mb-2">Growth & Expansion Opportunities</h3>

          {opportunities.length > 0 ? (
            <ul className="list-disc ml-5">
              {opportunities.map((opp, i) => (
                <li key={i} className="text-sm mb-1">{opp}</li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">No opportunities documented</p>
          )}
        </section>

        {/* WHOLESALE & COUNTRY */}
        <section>
          <h3 className="font-semibold text-lg mb-2">Store Context</h3>
          <p className="text-sm">Country / Cultural Background: {country}</p>
          <p className="text-sm mt-1">
            Wholesale Interest:{" "}
            {wholesaleInterest ? "✔️ Interested" : "No interest yet"}
          </p>
        </section>

        {/* MEMORY TIMELINE */}
        <section>
          <h3 className="font-semibold text-lg mb-3">Memory Timeline</h3>

          {interactions?.length > 0 ? (
            interactions.slice(0, 7).map((i) => (
              <div key={i.id} className="border-l-4 border-primary pl-4 mb-3">
                <p className="text-sm font-medium">
                  {i.created_at ? new Date(i.created_at).toLocaleDateString() : "N/A"}
                </p>
                <p className="text-sm">{i.interaction_type || i.type || "Interaction"}</p>
                <p className="text-sm text-muted-foreground">{i.notes || i.summary}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No memory history yet</p>
          )}
        </section>

        {/* VISIT LOGS */}
        <section>
          <h3 className="font-semibold text-lg mb-2">Visit Logs</h3>
          {visits?.length > 0 ? (
            visits.map((v) => (
              <div key={v.id} className="p-2 border rounded mb-2">
                <p className="text-sm font-medium">
                  {v.created_at ? new Date(v.created_at).toLocaleDateString() : "N/A"}
                </p>
                <p className="text-sm">Purpose: {v.purpose || "Not specified"}</p>
                <p className="text-sm text-muted-foreground">Notes: {v.notes || "None"}</p>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-sm">No visits recorded</p>
          )}
        </section>

      </CardContent>
    </Card>
  );
}
