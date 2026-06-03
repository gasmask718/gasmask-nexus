import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, User, Loader2, Receipt } from "lucide-react";
import { VerifyNumberButton } from "@/components/store/VerifyNumberButton";
import { useNavigate } from "react-router-dom";

interface Props {
  storeId: string;
  storeName: string;
}

export function FieldVerifyContactsCard({ storeId, storeName }: Props) {
  const navigate = useNavigate();
  const { data: contacts, isLoading, refetch } = useQuery({
    queryKey: ["field-verify-contacts", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_contacts")
        .select(`
          id, name, role, phone, is_primary, can_receive_sms, opted_out,
          number_verification_status,
          number_verification_sent_at,
          number_verification_delivered_at,
          number_verification_confirmed_at,
          number_verification_error
        `)
        .eq("store_id", storeId)
        .eq("is_simulation", false)
        .order("is_primary", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const confirmedCount = contacts?.filter((c) => c.number_verification_status === "confirmed").length || 0;
  const total = contacts?.length || 0;

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Verify Contact Numbers
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {confirmedCount} / {total} confirmed
          </Badge>
        </div>
        <CardDescription>
          While you're with them: send the intro text so they save our number, then confirm they got it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : !contacts?.length ? (
          <p className="text-sm text-muted-foreground text-center py-4">No contacts on file for this store</p>
        ) : (
          contacts.map((c) => (
            <div key={c.id} className="rounded-lg border border-border/50 p-3 bg-card/60 space-y-2">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{c.name}</span>
                      {c.is_primary && <Badge variant="outline" className="text-[10px] bg-yellow-500/10 text-yellow-600 border-yellow-500/30">Primary</Badge>}
                      {c.role && <Badge variant="secondary" className="text-[10px]">{c.role}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{c.phone || "no phone"}</p>
                  </div>
                </div>
              </div>

              <VerifyNumberButton
                contactId={c.id}
                storeId={storeId}
                contactName={c.name}
                contactPhone={c.phone}
                status={c.number_verification_status}
                sentAt={c.number_verification_sent_at}
                deliveredAt={c.number_verification_delivered_at}
                confirmedAt={c.number_verification_confirmed_at}
                error={c.number_verification_error}
                fullWidth
                size="sm"
                onChanged={refetch}
              />
            </div>
          ))
        )}

        {/* Quick action: create an invoice so the rep can show the store the number we send from */}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => navigate(`/invoices/new?store_id=${storeId}`)}
        >
          <Receipt className="h-4 w-4 mr-1.5" />
          Create Invoice for {storeName}
        </Button>
      </CardContent>
    </Card>
  );
}
