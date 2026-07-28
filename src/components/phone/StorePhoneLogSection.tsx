import { usePhoneLog, prettyPhone } from "@/hooks/usePhoneLog";
import { PhoneLogTimeline } from "@/components/phone/PhoneLogTimeline";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Phone } from "lucide-react";

/**
 * StorePhoneLogSection — this store's calls + texts + recordings, threaded
 * by number, straight from the canonical communication_logs.
 */
export function StorePhoneLogSection({ storeId }: { storeId: string }) {
  const { data: threads, isLoading } = usePhoneLog({ storeId, limit: 300 });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!threads?.length) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No calls or texts logged for this store yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {threads.map((t) => (
        <Card key={t.number} className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Phone className="h-4 w-4" /> {prettyPhone(t.number)}
            </CardTitle>
            <CardDescription className="flex flex-wrap gap-1 pt-1">
              <Badge variant="secondary" className="text-[10px]">{t.callCount} calls</Badge>
              <Badge variant="secondary" className="text-[10px]">{t.smsCount} texts</Badge>
              {t.recordingCount > 0 && (
                <Badge variant="outline" className="text-[10px]">{t.recordingCount} recordings</Badge>
              )}
              {t.voicemailCount > 0 && (
                <Badge className="bg-amber-500/20 text-amber-600 text-[10px]">{t.voicemailCount} voicemails</Badge>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PhoneLogTimeline entries={t.entries} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
