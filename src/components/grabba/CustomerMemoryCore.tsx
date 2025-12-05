import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

type StoreRecord = {
  id: string;
  store_name?: string;
  name?: string;
  notes?: string | null;
  important_notes?: string | null;
  opportunities?: string[] | null;
  wholesale_interest?: boolean | null;
  [key: string]: any;
};

type StoreContact = {
  id: string;
  store_id: string;
  name?: string | null;
  phone?: string | null;
  role?: string | null;
  notes?: string | null;
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

interface CustomerMemoryCoreProps {
  store: StoreRecord | null | undefined;
  contacts: StoreContact[];
  interactions: StoreInteraction[];
}

export function CustomerMemoryCore({ store, contacts, interactions }: CustomerMemoryCoreProps) {
  if (!store) return null;

  const primaryContacts = contacts?.filter(c => c.role?.toLowerCase() === "owner") || [];
  const otherContacts = contacts?.filter(c => c.role?.toLowerCase() !== "owner") || [];

  const importantNotes = store.important_notes || store.notes || "No notes yet";
  const opportunities = store.opportunities || [];
  const wholesaleInterest = store.wholesale_interest || false;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Customer Memory Core</CardTitle>
        <CardDescription>
          A centralized memory center for important personal, cultural, and business details
          that strengthen long-term relationship building.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">

        {/* PRIMARY CONTACTS */}
        <div>
          <h3 className="font-semibold text-lg mb-2">Primary Contacts (Owners)</h3>
          {primaryContacts.length > 0 ? (
            primaryContacts.map((c) => (
              <div key={c.id} className="p-2 border rounded-lg mb-2">
                <p className="font-medium">{c.name}</p>
                <p className="text-sm">Role: {c.role}</p>
                <p className="text-sm">Phone: {c.phone || "N/A"}</p>
                <p className="text-sm text-muted-foreground">{c.notes}</p>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-sm">No owners saved yet</p>
          )}
        </div>

        {/* OTHER CONTACTS */}
        <div>
          <h3 className="font-semibold text-lg mb-2">Additional Contacts</h3>
          {otherContacts.length > 0 ? (
            otherContacts.map((c) => (
              <div key={c.id} className="p-2 border rounded-lg mb-2">
                <p className="font-medium">{c.name}</p>
                <p className="text-sm">Role: {c.role}</p>
                <p className="text-sm">Phone: {c.phone || "N/A"}</p>
                <p className="text-sm text-muted-foreground">{c.notes}</p>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-sm">No additional contacts saved</p>
          )}
        </div>

        {/* IMPORTANT NOTES */}
        <div>
          <h3 className="font-semibold text-lg mb-2">Important Relationship Notes</h3>
          <p className="whitespace-pre-wrap text-sm">{importantNotes}</p>
        </div>

        {/* OPPORTUNITIES */}
        <div>
          <h3 className="font-semibold text-lg mb-2">Growth Opportunities</h3>
          {opportunities.length > 0 ? (
            <ul className="list-disc ml-5">
              {opportunities.map((opp, i) => (
                <li key={i} className="text-sm">{opp}</li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">No opportunities documented</p>
          )}
        </div>

        {/* WHOLESALE INTEREST */}
        <div>
          <h3 className="font-semibold text-lg mb-2">Wholesale Signals</h3>
          <p className="text-sm">
            {wholesaleInterest
              ? "This store has shown interest in wholesale purchases."
              : "No wholesale interest recorded yet."}
          </p>
        </div>

        {/* INTERACTION HISTORY */}
        <div>
          <h3 className="font-semibold text-lg mb-2">Recent Interactions</h3>
          {interactions?.length > 0 ? (
            interactions.slice(0, 5).map((i) => (
              <div key={i.id} className="border rounded-lg p-2 mb-2">
                <p className="text-sm">{i.interaction_type || i.type || 'Interaction'} — {i.created_at ? new Date(i.created_at).toLocaleDateString() : 'N/A'}</p>
                <p className="text-sm text-muted-foreground">{i.notes || i.summary}</p>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-sm">No interactions logged yet</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
