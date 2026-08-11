import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, ExternalLink, Plus, Trash2 } from "lucide-react";

type Account = {
  id: string;
  full_name: string;
  email: string;
  status: string | null;
  tier: string | null;
  total_views: number | null;
  total_earnings: number | null;
};

type Social = {
  id: string;
  platform: string;
  handle: string;
  profile_url: string | null;
  follower_count: number | null;
  is_active: boolean | null;
  connected_at: string | null;
};

type Assignment = {
  id: string;
  campaign_id: string;
  status: string | null;
  tracking_link: string | null;
  assigned_at: string | null;
  clipper_campaigns: {
    id: string;
    brand_name: string;
    dynasty_business: string;
    title: string;
    description: string | null;
    brief: string | null;
    dos: string | null;
    donts: string | null;
    hashtags: string[] | null;
    raw_footage_url: string | null;
    base_rate_per_1k: number | null;
    commission_rate: number | null;
    status: string | null;
  } | null;
};

type Submission = {
  id: string;
  campaign_id: string | null;
  platform: string;
  post_url: string;
  status: string | null;
  views: number | null;
  total_earnings: number | null;
  submitted_at: string | null;
  clipper_campaigns: { brand_name: string | null; title: string | null } | null;
};

const PLATFORMS = [
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
  { value: "twitter", label: "X (Twitter)" },
];

const PLATFORM_BADGE: Record<string, string> = {
  tiktok: "bg-pink-500/15 text-pink-300 border-pink-500/30",
  instagram: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  youtube: "bg-red-500/15 text-red-300 border-red-500/30",
  twitter: "bg-blue-500/15 text-blue-300 border-blue-500/30",
};

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  approved: "bg-green-500/15 text-green-300 border-green-500/30",
  rejected: "bg-red-500/15 text-red-300 border-red-500/30",
  flagged: "bg-orange-500/15 text-orange-300 border-orange-500/30",
};

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

/**
 * Clipper portal home. Only an ACTIVE clipper_accounts row bound to the
 * signed-in user grants access — everyone else sees the "not approved" state.
 */
export default function ClipperPortal() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<Account | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        navigate("/clipper/login", { replace: true });
        return;
      }
      setSignedIn(true);
      const { data } = await supabase
        .from("clipper_accounts")
        .select("id, full_name, email, status, tier, total_views, total_earnings")
        .eq("user_id", sess.session.user.id)
        .maybeSingle();
      setAccount((data as Account) ?? null);
      setLoading(false);
    })();
  }, [navigate]);

  const clipperId = account?.id ?? null;
  const active = signedIn && account && (account.status ?? "").toLowerCase() === "active";

  // ---- data ---------------------------------------------------------------
  const { data: socials, isLoading: socialsLoading } = useQuery<Social[]>({
    queryKey: ["clipper-socials", clipperId],
    enabled: !!clipperId && !!active,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clipper_social_accounts")
        .select("id, platform, handle, profile_url, follower_count, is_active, connected_at")
        .eq("clipper_id", clipperId!)
        .order("platform", { ascending: true })
        .order("connected_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Social[];
    },
  });

  const { data: assignments, isLoading: campaignsLoading } = useQuery<Assignment[]>({
    queryKey: ["clipper-assignments-portal", clipperId],
    enabled: !!clipperId && !!active,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clipper_assignments")
        .select(
          `id, campaign_id, status, tracking_link, assigned_at,
           clipper_campaigns!campaign_id(id, brand_name, dynasty_business, title, description, brief, dos, donts,
             hashtags, raw_footage_url, base_rate_per_1k, commission_rate, status)`
        )
        .eq("clipper_id", clipperId!)
        .eq("status", "active")
        .order("assigned_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any as Assignment[];
    },
  });

  const { data: submissions, isLoading: subsLoading } = useQuery<Submission[]>({
    queryKey: ["clipper-my-submissions", clipperId],
    enabled: !!clipperId && !!active,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clipper_submissions")
        .select(
          `id, campaign_id, platform, post_url, status, views, total_earnings, submitted_at,
           clipper_campaigns!campaign_id(brand_name, title)`
        )
        .eq("clipper_id", clipperId!)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any as Submission[];
    },
  });

  // ---- mutations ----------------------------------------------------------
  const [addOpen, setAddOpen] = useState(false);
  const [newPlatform, setNewPlatform] = useState("tiktok");
  const [newHandle, setNewHandle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newFollowers, setNewFollowers] = useState("");

  const addSocial = useMutation({
    mutationFn: async () => {
      const handle = newHandle.trim().replace(/^@/, "");
      if (!handle) throw new Error("Handle is required");
      const { error } = await supabase.from("clipper_social_accounts").insert({
        clipper_id: clipperId,
        platform: newPlatform,
        handle,
        profile_url: newUrl.trim() || null,
        follower_count: newFollowers ? Number(newFollowers) : 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Account connected");
      setAddOpen(false);
      setNewHandle(""); setNewUrl(""); setNewFollowers("");
      qc.invalidateQueries({ queryKey: ["clipper-socials", clipperId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not save account"),
  });

  const removeSocial = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clipper_social_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Account removed");
      qc.invalidateQueries({ queryKey: ["clipper-socials", clipperId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not remove account"),
  });

  const [submitFor, setSubmitFor] = useState<Assignment | null>(null);
  const [subSocialId, setSubSocialId] = useState<string>("");
  const [subUrl, setSubUrl] = useState("");

  const submitClip = useMutation({
    mutationFn: async () => {
      const url = subUrl.trim();
      if (!/^https?:\/\/.+/i.test(url)) throw new Error("Enter the full post URL (https://…)");
      const social = (socials ?? []).find((s) => s.id === subSocialId);
      if (!social) throw new Error("Pick which account you posted from");
      const { error } = await supabase.from("clipper_submissions").insert({
        clipper_id: clipperId,
        campaign_id: submitFor!.campaign_id,
        social_account_id: social.id,
        platform: social.platform,
        post_url: url,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Clip submitted — it's now in the review queue");
      setSubmitFor(null); setSubUrl(""); setSubSocialId("");
      qc.invalidateQueries({ queryKey: ["clipper-my-submissions", clipperId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not submit clip"),
  });

  const socialsByPlatform = useMemo(() => {
    const m = new Map<string, Social[]>();
    (socials ?? []).forEach((s) => m.set(s.platform, [...(m.get(s.platform) ?? []), s]));
    return m;
  }, [socials]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/clipper/login", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 space-y-4 text-center">
            <h1 className="text-xl font-bold text-foreground">Not approved yet</h1>
            <p className="text-sm text-muted-foreground">
              This account doesn't have an active Clipper Nation membership. Once your application
              is approved you'll get an email with your login link.
            </p>
            <Button variant="outline" onClick={signOut}>Sign out</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Welcome, {account!.full_name}</h1>
            <p className="text-sm text-muted-foreground">{account!.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-green-500/15 text-green-400 border-green-500/30">Active clipper</Badge>
            <Button variant="outline" size="sm" onClick={signOut}>Sign out</Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card><CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Tier</p>
            <p className="text-xl font-semibold text-foreground">{account!.tier || "Starter"}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Total views</p>
            <p className="text-xl font-semibold text-foreground">
              {(account!.total_views ?? 0).toLocaleString()}
            </p>
          </CardContent></Card>
          <Card><CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Total earnings</p>
            <p className="text-xl font-semibold text-foreground">
              ${Number(account!.total_earnings ?? 0).toFixed(2)}
            </p>
          </CardContent></Card>
        </div>

        <Tabs defaultValue="campaigns">
          <TabsList>
            <TabsTrigger value="campaigns">Campaigns ({assignments?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="accounts">My accounts ({socials?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="submissions">My clips ({submissions?.length ?? 0})</TabsTrigger>
          </TabsList>

          {/* ---------------- CAMPAIGNS ---------------- */}
          <TabsContent value="campaigns" className="space-y-4 pt-4">
            {campaignsLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (assignments ?? []).length === 0 ? (
              <Card><CardContent className="pt-6 text-sm text-muted-foreground">
                No campaigns assigned yet. Your manager will assign brands from the OS floor.
              </CardContent></Card>
            ) : (
              (assignments ?? []).map((a) => {
                const c = a.clipper_campaigns;
                if (!c) return null;
                return (
                  <Card key={a.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-base text-foreground">{c.title}</CardTitle>
                          <p className="text-xs text-muted-foreground">{c.brand_name}</p>
                        </div>
                        <Badge variant="outline">${Number(c.base_rate_per_1k ?? 0).toFixed(2)}/1k views</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      {c.brief && <p className="text-muted-foreground whitespace-pre-line">{c.brief}</p>}
                      {c.description && !c.brief && (
                        <p className="text-muted-foreground whitespace-pre-line">{c.description}</p>
                      )}
                      <div className="grid gap-2 sm:grid-cols-2">
                        {c.dos && <p className="text-xs text-green-400">✅ {c.dos}</p>}
                        {c.donts && <p className="text-xs text-red-400">🚫 {c.donts}</p>}
                      </div>
                      {(c.hashtags ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {c.hashtags!.map((h) => (
                            <Badge key={h} variant="secondary" className="text-[10px]">#{h.replace(/^#/, "")}</Badge>
                          ))}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {c.raw_footage_url && (
                          <Button asChild variant="outline" size="sm">
                            <a href={c.raw_footage_url} target="_blank" rel="noreferrer">
                              Raw footage <ExternalLink className="h-3 w-3 ml-1" />
                            </a>
                          </Button>
                        )}
                        {a.tracking_link && (
                          <Button asChild variant="ghost" size="sm">
                            <a href={a.tracking_link} target="_blank" rel="noreferrer">
                              My tracking link <ExternalLink className="h-3 w-3 ml-1" />
                            </a>
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => {
                            setSubmitFor(a);
                            setSubSocialId((socials ?? [])[0]?.id ?? "");
                            setSubUrl("");
                          }}
                        >
                          Submit clip
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* ---------------- SOCIAL ACCOUNTS ---------------- */}
          <TabsContent value="accounts" className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Connect as many accounts as you want — multiple handles on the same platform are fine.
              </p>
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Connect account</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Connect a social account</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label>Platform</Label>
                      <Select value={newPlatform} onValueChange={setNewPlatform}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PLATFORMS.map((p) => (
                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Handle</Label>
                      <Input value={newHandle} onChange={(e) => setNewHandle(e.target.value)} placeholder="@yourhandle" />
                    </div>
                    <div className="space-y-1">
                      <Label>Profile URL (optional)</Label>
                      <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://tiktok.com/@yourhandle" />
                    </div>
                    <div className="space-y-1">
                      <Label>Followers (optional)</Label>
                      <Input type="number" value={newFollowers} onChange={(e) => setNewFollowers(e.target.value)} placeholder="0" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                    <Button onClick={() => addSocial.mutate()} disabled={addSocial.isPending}>
                      {addSocial.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                      Save account
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {socialsLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (socials ?? []).length === 0 ? (
              <Card><CardContent className="pt-6 text-sm text-muted-foreground">
                No accounts connected yet.
              </CardContent></Card>
            ) : (
              PLATFORMS.filter((p) => socialsByPlatform.has(p.value)).map((p) => (
                <Card key={p.value}>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">{p.label}</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {socialsByPlatform.get(p.value)!.map((s) => (
                      <div key={s.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">@{s.handle}</p>
                          <p className="text-xs text-muted-foreground">
                            {(s.follower_count ?? 0).toLocaleString()} followers · added {fmtDate(s.connected_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={PLATFORM_BADGE[s.platform]}>{s.platform}</Badge>
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => removeSocial.mutate(s.id)}
                            disabled={removeSocial.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* ---------------- SUBMISSIONS ---------------- */}
          <TabsContent value="submissions" className="space-y-3 pt-4">
            {subsLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (submissions ?? []).length === 0 ? (
              <Card><CardContent className="pt-6 text-sm text-muted-foreground">
                No clips submitted yet. Post a clip, then submit the URL from the Campaigns tab.
              </CardContent></Card>
            ) : (
              (submissions ?? []).map((s) => (
                <Card key={s.id}>
                  <CardContent className="pt-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {s.clipper_campaigns?.title ?? "Campaign"} · {s.clipper_campaigns?.brand_name ?? ""}
                      </p>
                      <a
                        href={s.post_url} target="_blank" rel="noreferrer"
                        className="text-xs text-muted-foreground underline truncate block max-w-[420px]"
                      >
                        {s.post_url}
                      </a>
                      <p className="text-xs text-muted-foreground">
                        Submitted {fmtDate(s.submitted_at)} · {(s.views ?? 0).toLocaleString()} views · $
                        {Number(s.total_earnings ?? 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={PLATFORM_BADGE[s.platform]}>{s.platform}</Badge>
                      <Badge variant="outline" className={STATUS_BADGE[s.status ?? "pending"]}>{s.status}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Submit clip dialog */}
      <Dialog open={!!submitFor} onOpenChange={(o) => !o && setSubmitFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit clip — {submitFor?.clipper_campaigns?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Posted from</Label>
              <Select value={subSocialId} onValueChange={setSubSocialId}>
                <SelectTrigger><SelectValue placeholder="Select one of your accounts" /></SelectTrigger>
                <SelectContent>
                  {(socials ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.platform} · @{s.handle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(socials ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">Connect a social account first.</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Post URL</Label>
              <Input value={subUrl} onChange={(e) => setSubUrl(e.target.value)} placeholder="https://www.tiktok.com/@handle/video/…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitFor(null)}>Cancel</Button>
            <Button onClick={() => submitClip.mutate()} disabled={submitClip.isPending}>
              {submitClip.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Submit clip
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
