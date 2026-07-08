import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function BusinessProfileDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase
        .from("grant_business_profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) toast.error(error.message);
      setProfile(data);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate("/os/grants/businesses")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <p className="mt-4 text-muted-foreground">Profile not found.</p>
      </div>
    );
  }

  const fields = Object.entries(profile).filter(
    ([k]) => !["id", "created_at", "updated_at"].includes(k)
  );

  return (
    <div className="p-6 space-y-4">
      <Button variant="ghost" onClick={() => navigate("/os/grants/businesses")}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Business Profiles
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>{profile.business_name}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Read-only profile view. Inline editing arrives in a follow-up ticket.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {fields.map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-border/50 py-1.5 gap-4">
                <span className="text-muted-foreground">{k}</span>
                <span className="text-right font-mono text-xs truncate max-w-[60%]">
                  {v === null || v === undefined
                    ? "—"
                    : Array.isArray(v)
                    ? v.join(", ") || "—"
                    : typeof v === "boolean"
                    ? v ? "yes" : "no"
                    : String(v)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
