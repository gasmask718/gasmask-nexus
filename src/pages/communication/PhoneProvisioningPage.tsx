import { useCallback, useEffect, useMemo, useState } from "react";
import { Filter } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Loader2, MapPin, Phone, RefreshCw, Search, ShoppingCart, Filter } from "lucide-react";

const BUSINESSES = [
  { key: "gasmask", label: "GasMask Approved" },
  { key: "unforgettable_times", label: "Unforgettable Times" },
  { key: "real_estate", label: "Real Estate Division" },
  { key: "surplus_funds", label: "Surplus Funds Recovery" },
  { key: "top_tier", label: "Top Tier Experience" },
  { key: "brandaro", label: "Brandaro Digital" },
  { key: "iclean", label: "iClean WeClean" },
  { key: "playboxxx", label: "Playboxxx Entertainment" },
];

const STATE_AREA_CODES: Record<string, { label: string; emoji: string; codes: string[] }> = {
  "New York": { label: "New York", emoji: "🗽", codes: ["929", "718", "347", "646", "212"] },
  Texas: { label: "Texas", emoji: "⭐", codes: ["214", "713", "832", "512", "972", "469"] },
  Florida: { label: "Florida", emoji: "🌴", codes: ["305", "786", "754", "407", "561", "321"] },
  California: { label: "California", emoji: "🌅", codes: ["213", "310", "323", "415", "619", "818"] },
  "New Jersey": { label: "New Jersey", emoji: "🏙️", codes: ["848", "201", "732", "908", "973"] },
  Georgia: { label: "Georgia", emoji: "🍑", codes: ["404", "470", "678", "770"] },
  Illinois: { label: "Illinois", emoji: "🌃", codes: ["312", "773", "847"] },
  Pennsylvania: { label: "Pennsylvania", emoji: "🔔", codes: ["215", "267", "412"] },
  Arizona: { label: "Arizona", emoji: "🌵", codes: ["602", "480", "520"] },
  Nevada: { label: "Nevada", emoji: "🎰", codes: ["702", "725"] },
};

const TOLL_FREE_PREFIXES = ["800", "888", "877", "866", "855", "844", "833"];

type SearchResult = {
  phoneNumber: string;
  friendlyName: string;
  locality: string;
  region: string;
  country: string;
  monthlyCost: number;
};

type ExistingNumber = {
  id: string;
  phone_number: string;
  friendly_name: string | null;
  business: string | null;
  assigned_agent_id: string | null;
  assigned_agent_name: string | null;
  twilio_sid: string | null;
  monthly_cost: number | null;
  is_active: boolean | null;
};

const selectClassName = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export default function PhoneProvisioningPage() {
  const queryClient = useQueryClient();

  const [step, setStep] = useState(0);
  const [twilioStatus, setTwilioStatus] = useState<any>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [autoSyncAttempted, setAutoSyncAttempted] = useState(false);

  const [editingNumberId, setEditingNumberId] = useState<string | null>(null);
  const [assignBusiness, setAssignBusiness] = useState("");
  const [assignAgentId, setAssignAgentId] = useState("");
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [importingNumberId, setImportingNumberId] = useState<string | null>(null);

  const [business, setBusiness] = useState("");
  const [country, setCountry] = useState<"US" | "DO">("US");
  const [numberType, setNumberType] = useState<"local" | "tollfree">("local");
  const [selectedState, setSelectedState] = useState("");
  const [areaCode, setAreaCode] = useState("");
  const [tollFreePrefix, setTollFreePrefix] = useState("");
  const [customAreaCode, setCustomAreaCode] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<SearchResult | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseProgress, setPurchaseProgress] = useState<string[]>([]);
  const [purchaseComplete, setPurchaseComplete] = useState(false);

  const { data: existingNumbers = [], isLoading: numbersLoading, refetch: refetchNumbers } = useQuery({
    queryKey: ["dc-phone-numbers"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("dc_phone_numbers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ExistingNumber[];
    },
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["dc-agents"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("dc_agents")
        .select("agent_id, name, business")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const filteredAssignAgents = useMemo(
    () => agents.filter((agent: any) => !assignBusiness || agent.business === assignBusiness),
    [agents, assignBusiness],
  );

  const filteredWizardAgents = useMemo(
    () => agents.filter((agent: any) => !business || agent.business === business),
    [agents, business],
  );

  const checkTwilioStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("provision-dc-number", {
        body: { action: "status" },
      });
      if (error) throw error;
      setTwilioStatus(data);
    } catch (error: any) {
      setTwilioStatus({ connected: false, error: error.message || "Status check failed" });
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const syncNumbers = useCallback(async (silent = false) => {
    setSyncing(true);
    setSyncMessage("");
    try {
      const { data, error } = await supabase.functions.invoke("provision-dc-number", {
        body: { action: "sync" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const message = `✅ Synced ${data?.synced || 0} numbers from Twilio`;
      setSyncMessage(message);
      if (!silent) toast.success(message);
      await refetchNumbers();
      queryClient.invalidateQueries({ queryKey: ["dc-phone-numbers"] });
    } catch (error: any) {
      const message = error.message || "Sync failed";
      setSyncMessage(message);
      if (!silent) toast.error(message);
    } finally {
      setSyncing(false);
    }
  }, [queryClient, refetchNumbers]);

  useEffect(() => {
    checkTwilioStatus();
  }, [checkTwilioStatus]);

  useEffect(() => {
    if (!statusLoading && twilioStatus?.connected && !numbersLoading && existingNumbers.length === 0 && !autoSyncAttempted) {
      setAutoSyncAttempted(true);
      syncNumbers(true);
    }
  }, [statusLoading, twilioStatus, numbersLoading, existingNumbers.length, autoSyncAttempted, syncNumbers]);

  const formatPhone = (num: string) => {
    const digits = (num || "").replace(/\D/g, "");
    if (digits.length === 11 && digits[0] === "1") return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    return num;
  };

  const openAssign = (row: ExistingNumber) => {
    setEditingNumberId(row.id);
    setAssignBusiness(row.business === "unassigned" ? "" : row.business || "");
    setAssignAgentId(row.assigned_agent_id || "");
  };

  const saveAssignment = async (row: ExistingNumber) => {
    setAssignmentSaving(true);
    try {
      const agent = agents.find((item: any) => item.agent_id === assignAgentId);
      const { data, error } = await supabase.functions.invoke("provision-dc-number", {
        body: {
          action: "assign",
          phoneNumberId: row.id,
          business: assignBusiness,
          agentId: assignAgentId || null,
          agentName: agent?.name || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Assignment saved");
      setEditingNumberId(null);
      await refetchNumbers();
    } catch (error: any) {
      toast.error(error.message || "Assignment failed");
    } finally {
      setAssignmentSaving(false);
    }
  };

  const importToElevenLabs = async (row: ExistingNumber) => {
    if (!row.assigned_agent_id || !row.twilio_sid) {
      toast.error("Assign an agent first");
      return;
    }

    setImportingNumberId(row.id);
    try {
      const businessName = BUSINESSES.find((item) => item.key === row.business)?.label || row.business || "Business";
      const { data, error } = await supabase.functions.invoke("provision-dc-number", {
        body: {
          action: "import_to_elevenlabs",
          phoneNumberValue: row.phone_number,
          twilioSid: row.twilio_sid,
          business: row.business,
          businessName,
          agentId: row.assigned_agent_id,
          agentName: row.assigned_agent_name,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Imported to ElevenLabs");
    } catch (error: any) {
      toast.error(error.message || "ElevenLabs import failed");
    } finally {
      setImportingNumberId(null);
    }
  };

  const handleSearch = async () => {
    setSearching(true);
    setSearchResults([]);
    try {
      const body: any = { action: "search", country, numberType };
      if (country === "DO") body.areaCode = "809";
      else if (numberType === "tollfree") body.prefix = tollFreePrefix;
      else body.areaCode = areaCode || customAreaCode || "929";

      const { data, error } = await supabase.functions.invoke("provision-dc-number", { body });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Search failed");
      setSearchResults(data.numbers || []);
      if (!data.numbers?.length) toast.info("No numbers found. Try a different area code.");
    } catch (error: any) {
      toast.error(error.message || "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedNumber || !business) return;
    setPurchasing(true);
    setPurchaseProgress(["📞 Contacting Twilio..."]);

    try {
      const selectedAgent = agents.find((agent: any) => agent.agent_id === selectedAgentId);
      const { data, error } = await supabase.functions.invoke("provision-dc-number", {
        body: {
          action: "purchase",
          phoneNumber: selectedNumber.phoneNumber,
          business,
          agentId: selectedAgentId || null,
          agentName: selectedAgent?.name || null,
          country,
          numberType,
          quantity: country === "DO" ? 1 : quantity,
        },
      });

      if (error) throw error;
      setPurchaseProgress((current) => [...current, "✅ Number secured!", "💾 Saving to database..."]);
      const result = data?.results?.[0];
      if (!result?.success) throw new Error(JSON.stringify(result?.error || "Purchase failed"));
      setPurchaseProgress((current) => [...current, `✅ ${result.number} is LIVE!`]);
      setPurchaseComplete(true);
      await refetchNumbers();
      toast.success("Number purchased successfully");
    } catch (error: any) {
      setPurchaseProgress((current) => [...current, `❌ ${error.message || "Purchase failed"}`]);
      toast.error(error.message || "Purchase failed");
    } finally {
      setPurchasing(false);
    }
  };

  const resetWizard = () => {
    setStep(0);
    setBusiness("");
    setCountry("US");
    setNumberType("local");
    setSelectedState("");
    setAreaCode("");
    setTollFreePrefix("");
    setCustomAreaCode("");
    setQuantity(1);
    setSearchResults([]);
    setSelectedNumber(null);
    setSelectedAgentId("");
    setPurchaseProgress([]);
    setPurchaseComplete(false);
  };

  const monthlyCost = country === "DO" ? 5 : numberType === "tollfree" ? 2 : 1;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Phone className="h-8 w-8 text-primary" /> Phone Number Provisioning</h1>
          <p className="text-muted-foreground mt-1">Sync purchased numbers, assign them, and buy new ones.</p>
        </div>
        {step > 0 && !purchaseComplete ? (
          <Button variant="outline" onClick={resetWizard}><ArrowLeft className="h-4 w-4 mr-2" />Start Over</Button>
        ) : null}
      </div>

      <Card>
        <CardContent className="py-4 space-y-3">
          {statusLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Checking Twilio connection...</div>
          ) : twilioStatus?.connected ? (
            <div className="text-sm font-medium text-green-600">🟢 Twilio Connected — {twilioStatus.accountName}</div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="font-medium text-destructive">⚠️ Twilio credentials not working</div>
              <p className="text-muted-foreground">This page uses the same <code className="bg-muted px-1 rounded">TWILIO_ACCOUNT_SID</code> secret name as the working voice token function, plus <code className="bg-muted px-1 rounded">TWILIO_AUTH_TOKEN</code> for Twilio REST API calls.</p>
              {twilioStatus?.error ? <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">{JSON.stringify(twilioStatus.error, null, 2)}</pre> : null}
            </div>
          )}

          <Button size="lg" onClick={() => syncNumbers(false)} disabled={!twilioStatus?.connected || syncing}>
            {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}🔄 Sync Numbers from Twilio
          </Button>

          {syncMessage ? <p className="text-sm text-muted-foreground">{syncMessage}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Purchased Numbers</CardTitle>
          <CardDescription>All rows from dc_phone_numbers</CardDescription>
        </CardHeader>
        <CardContent>
          {numbersLoading || (syncing && existingNumbers.length === 0) ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading numbers...</div>
          ) : existingNumbers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No purchased numbers found yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-3 pr-4">Number</th>
                    <th className="pb-3 pr-4">Label</th>
                    <th className="pb-3 pr-4">Business</th>
                    <th className="pb-3 pr-4">Agent</th>
                    <th className="pb-3 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {existingNumbers.map((row) => (
                    <>
                      <tr key={row.id} className="border-b border-border/60 align-top">
                        <td className="py-3 pr-4 font-mono">{formatPhone(row.phone_number)}</td>
                        <td className="py-3 pr-4">{row.friendly_name || "—"}</td>
                        <td className="py-3 pr-4">{BUSINESSES.find((item) => item.key === row.business)?.label || row.business || "Unassigned"}</td>
                        <td className="py-3 pr-4">{row.assigned_agent_name || "Not assigned"}</td>
                        <td className="py-3 pr-4">
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={() => openAssign(row)}>Assign</Button>
                            <Button variant="outline" size="sm" disabled={!row.assigned_agent_id || importingNumberId === row.id} onClick={() => importToElevenLabs(row)}>
                              {importingNumberId === row.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}📲 Import to ElevenLabs
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {editingNumberId === row.id ? (
                        <tr key={`${row.id}-editor`} className="border-b border-border/60 bg-muted/20">
                          <td colSpan={5} className="py-4">
                            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end">
                              <div>
                                <label className="text-xs text-muted-foreground">Business</label>
                                <select className={selectClassName} value={assignBusiness} onChange={(e) => { setAssignBusiness(e.target.value); setAssignAgentId(""); }}>
                                  <option value="">Select business</option>
                                  {BUSINESSES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground">Agent</label>
                                <select className={selectClassName} value={assignAgentId} onChange={(e) => setAssignAgentId(e.target.value)}>
                                  <option value="">Select agent</option>
                                  {filteredAssignAgents.map((agent: any) => <option key={agent.agent_id} value={agent.agent_id}>{agent.name}</option>)}
                                </select>
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" disabled={assignmentSaving || !assignBusiness} onClick={() => saveAssignment(row)}>
                                  {assignmentSaving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}Save
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setEditingNumberId(null)}>Cancel</Button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Buy New Number</CardTitle>
          <CardDescription>Existing wizard kept below the purchased numbers table</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {BUSINESSES.map((item) => (
                <Button key={item.key} variant={business === item.key ? "default" : "outline"} className="h-auto py-4" onClick={() => { setBusiness(item.key); setStep(1); }}>
                  {item.label}
                </Button>
              ))}
            </div>
          ) : null}

          {step === 1 ? (
            <div className="grid md:grid-cols-2 gap-4">
              <button className="rounded-lg border border-border p-5 text-left" onClick={() => { setCountry("US"); setStep(2); }}>
                <div className="text-3xl mb-2">🇺🇸</div>
                <div className="font-semibold">United States</div>
                <div className="text-sm text-muted-foreground">Local & toll-free</div>
              </button>
              <button className="rounded-lg border border-border p-5 text-left" onClick={() => { setCountry("DO"); setNumberType("local"); setStep(3); }}>
                <div className="text-3xl mb-2">🇩🇴</div>
                <div className="font-semibold">Dominican Republic</div>
                <div className="text-sm text-muted-foreground">Local presence</div>
              </button>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid md:grid-cols-2 gap-4">
              <button className="rounded-lg border border-border p-5 text-left" onClick={() => { setNumberType("local"); setStep(3); }}>
                <MapPin className="h-6 w-6 mb-2" />
                <div className="font-semibold">📍 Local Number</div>
                <div className="text-sm text-muted-foreground">$1/month</div>
              </button>
              <button className="rounded-lg border border-border p-5 text-left" onClick={() => { setNumberType("tollfree"); setStep(3); }}>
                <Phone className="h-6 w-6 mb-2" />
                <div className="font-semibold">📞 Toll-Free Number</div>
                <div className="text-sm text-muted-foreground">$2/month</div>
              </button>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              {country === "DO" ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">DR numbers use area codes 809, 829, and 849. We’ll search the best available local number.</div>
                  <Button onClick={() => { setAreaCode("809"); setStep(business === "brandaro" ? 4 : 5); }}>Continue <ArrowRight className="h-4 w-4 ml-2" /></Button>
                </div>
              ) : numberType === "tollfree" ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {TOLL_FREE_PREFIXES.map((prefix) => (
                      <Button key={prefix} variant={tollFreePrefix === prefix ? "default" : "outline"} onClick={() => { setTollFreePrefix(prefix); setStep(business === "brandaro" ? 4 : 5); }}>{prefix}</Button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {Object.entries(STATE_AREA_CODES).map(([state, info]) => (
                      <Button key={state} variant={selectedState === state ? "default" : "outline"} className="h-auto py-3" onClick={() => setSelectedState(state)}>
                        {info.emoji} {info.label}
                      </Button>
                    ))}
                    <Button variant={selectedState === "Other" ? "default" : "outline"} onClick={() => setSelectedState("Other")}>🤠 Other</Button>
                  </div>

                  {selectedState && selectedState !== "Other" ? (
                    <div className="flex flex-wrap gap-2">
                      {STATE_AREA_CODES[selectedState]?.codes.map((code) => (
                        <Button key={code} variant={areaCode === code ? "default" : "outline"} onClick={() => { setAreaCode(code); setStep(business === "brandaro" ? 4 : 5); }}>{code}</Button>
                      ))}
                    </div>
                  ) : null}

                  {selectedState === "Other" ? (
                    <div className="flex gap-2 items-center">
                      <Input value={customAreaCode} onChange={(e) => setCustomAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="Enter area code" className="max-w-40" />
                      <Button disabled={customAreaCode.length !== 3} onClick={() => { setAreaCode(customAreaCode); setStep(business === "brandaro" ? 4 : 5); }}>Use {customAreaCode}</Button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}

          {step === 4 && business === "brandaro" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((value) => <Button key={value} variant={quantity === value ? "default" : "outline"} onClick={() => setQuantity(value)}>{value}</Button>)}
              </div>
              <p className="text-sm text-muted-foreground">Recommended: 1 number per 4 VAs</p>
              <Button onClick={() => setStep(5)}>Continue <ArrowRight className="h-4 w-4 ml-2" /></Button>
            </div>
          ) : null}

          {step === 5 ? (
            <div className="space-y-4">
              <Button onClick={handleSearch} disabled={searching}>{searching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}Search Available Numbers</Button>
              {searchResults.length ? (
                <div className="grid gap-3">
                  {searchResults.map((result) => (
                    <button key={result.phoneNumber} onClick={() => { setSelectedNumber(result); setStep(6); }} className="rounded-lg border border-border p-4 text-left flex items-start justify-between">
                      <div>
                        <div className="font-mono font-semibold">📞 {formatPhone(result.phoneNumber)}</div>
                        <div className="text-sm text-muted-foreground">{result.locality || result.region}{result.locality ? `, ${result.region}` : ""}</div>
                      </div>
                      <div className="font-medium">${result.monthlyCost.toFixed(2)}/mo</div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 6 ? (
            <div className="space-y-3">
              <label className="text-sm font-medium">Assign Agent</label>
              <select className={selectClassName} value={selectedAgentId} onChange={(e) => setSelectedAgentId(e.target.value)}>
                <option value="">Assign later</option>
                {filteredWizardAgents.map((agent: any) => <option key={agent.agent_id} value={agent.agent_id}>{agent.name}</option>)}
              </select>
              <Button onClick={() => setStep(7)}>Continue <ArrowRight className="h-4 w-4 ml-2" /></Button>
            </div>
          ) : null}

          {step === 7 ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border p-5 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Number</span><span className="font-mono">{formatPhone(selectedNumber?.phoneNumber || "")}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Business</span><span>{BUSINESSES.find((item) => item.key === business)?.label}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Monthly</span><span>${monthlyCost.toFixed(2)}/mo</span></div>
              </div>

              {purchaseProgress.length ? (
                <div className="rounded-lg border border-border p-4 font-mono text-sm space-y-1">
                  {purchaseProgress.map((message, index) => <div key={`${message}-${index}`}>{message}</div>)}
                </div>
              ) : null}

              {!purchaseComplete ? (
                <Button onClick={handlePurchase} disabled={purchasing} className="w-full">
                  {purchasing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShoppingCart className="h-4 w-4 mr-2" />}Buy This Number — ${monthlyCost.toFixed(2)}/month
                </Button>
              ) : null}

              {purchaseComplete ? <Button variant="outline" onClick={resetWizard}>Buy Another Number</Button> : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
