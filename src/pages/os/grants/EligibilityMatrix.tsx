import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Grid3x3 } from "lucide-react";

type Row = {
  business_profile_id: string;
  grant_opportunity_id: string;
  status: string;
  eligibility_score: number | null;
};

const STATUS_STYLES: Record<string, string> = {
  eligible: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  partially_eligible: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  needs_review: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  not_eligible: "bg-red-500/15 text-red-400 border-red-500/30",
};

export default function EligibilityMatrix() {
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<{ id: string; business_name: string }[]>([]);
  const [opps, setOpps] = useState<{ id: string; title: string | null }[]>([]);
  const [results, setResults] = useState<Record<string, Row>>({});

  useEffect(() => {
    (async () => {
      const [{ data: b }, { data: o }, { data: r }] = await Promise.all([
        supabase.from("grant_business_profiles").select("id, business_name").order("business_name"),
        supabase.from("grant_opportunities").select("id, title").order("title"),
        supabase.from("grant_eligibility_results").select("business_profile_id, grant_opportunity_id, status, eligibility_score"),
      ]);
      setBusinesses((b as any) ?? []);
      setOpps((o as any) ?? []);
      const map: Record<string, Row> = {};
      ((r as any) ?? []).forEach((row: Row) => {
        map[`${row.business_profile_id}::${row.grant_opportunity_id}`] = row;
      });
      setResults(map);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Grid3x3 className="h-6 w-6" /> Eligibility Matrix
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Every business × every open grant, scored.
        </p>
      </div>

      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {businesses.length} businesses × {opps.length} opportunities
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-background text-left p-2 border-b">Business</th>
                  {opps.map((o) => (
                    <th key={o.id} className="p-2 border-b text-left min-w-[140px]">
                      <div className="truncate max-w-[160px]" title={o.title ?? ""}>
                        {o.title ?? "—"}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {businesses.map((b) => (
                  <tr key={b.id} className="hover:bg-muted/30">
                    <td className="sticky left-0 bg-background p-2 border-b font-medium">
                      {b.business_name}
                    </td>
                    {opps.map((o) => {
                      const cell = results[`${b.id}::${o.id}`];
                      if (!cell) {
                        return (
                          <td key={o.id} className="p-2 border-b text-muted-foreground">
                            —
                          </td>
                        );
                      }
                      return (
                        <td key={o.id} className="p-2 border-b">
                          <Badge
                            variant="outline"
                            className={STATUS_STYLES[cell.status] ?? ""}
                          >
                            {cell.eligibility_score ?? 0}
                          </Badge>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
