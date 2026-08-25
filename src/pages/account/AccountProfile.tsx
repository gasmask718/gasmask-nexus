import { useEffect, useState } from "react";
import { useCustomerAccount } from "@/hooks/useCustomerAccount";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, User } from "lucide-react";

export default function AccountProfile() {
  const { profile, loading, refetch, user } = useCustomerAccount();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name || "");
    setPhone(profile.phone || "");
    setCity(profile.city || "");
    setState(profile.state || "");
    setMarketingOptIn(!!profile.marketing_opt_in);
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("customer_profiles" as any)
      .update({
        full_name: fullName,
        phone,
        city,
        state,
        marketing_opt_in: marketingOptIn,
      })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error(`Failed to save profile: ${error.message}`);
      return;
    }
    toast.success("Profile updated");
    refetch();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Email</Label>
          <Input value={profile?.email || user?.email || ""} disabled />
        </div>
        <div>
          <Label>Full Name</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <Label>Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>City</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div>
            <Label>State</Label>
            <Input value={state} onChange={(e) => setState(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">Marketing emails</p>
            <p className="text-xs text-muted-foreground">Receive promotions and product updates.</p>
          </div>
          <Switch checked={marketingOptIn} onCheckedChange={setMarketingOptIn} />
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save changes
        </Button>
      </CardFooter>
    </Card>
  );
}
