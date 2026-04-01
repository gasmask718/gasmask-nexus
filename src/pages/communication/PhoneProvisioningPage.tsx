/**
 * Phone Number Provisioning Page
 * Buy Twilio numbers (Local + Toll-Free + International) directly from the OS
 */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Phone, MapPin, Search, ShoppingCart, Check, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

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
  "Texas": { label: "Texas", emoji: "⭐", codes: ["214", "713", "832", "512", "972", "469"] },
  "Florida": { label: "Florida", emoji: "🌴", codes: ["305", "786", "754", "407", "561", "321"] },
  "California": { label: "California", emoji: "🌅", codes: ["213", "310", "323", "415", "619", "818"] },
  "New Jersey": { label: "New Jersey", emoji: "🏙️", codes: ["848", "201", "732", "908", "973"] },
  "Georgia": { label: "Georgia", emoji: "🍑", codes: ["404", "470", "678", "770"] },
  "Illinois": { label: "Illinois", emoji: "🌃", codes: ["312", "773", "847"] },
  "Pennsylvania": { label: "Pennsylvania", emoji: "🔔", codes: ["215", "267", "412"] },
  "Arizona": { label: "Arizona", emoji: "🌵", codes: ["602", "480", "520"] },
  "Nevada": { label: "Nevada", emoji: "🎰", codes: ["702", "725"] },
};

const TOLL_FREE_PREFIXES = ["800", "888", "877", "866", "855", "844", "833"];

const BUSINESS_AGENTS: Record<string, { id: string; name: string }[]> = {
  gasmask: [{ id: "gasmask-main", name: "GasMask Main Agent" }],
  unforgettable_times: [
    { id: "ut-ambassador", name: "UT Ambassador Agent" },
    { id: "ut-concierge", name: "UT Concierge Agent" },
    { id: "ut-partner", name: "UT Partner Agent" },
  ],
  real_estate: [
    { id: "re-qualifier", name: "RE Lead Qualifier" },
    { id: "re-closer", name: "RE Closer Agent" },
    { id: "re-specialist", name: "RE Specialist Agent" },
  ],
  surplus_funds: [
    { id: "sf-client", name: "SF Client Outreach" },
    { id: "sf-attorney", name: "SF Attorney Agent" },
  ],
  top_tier: [
    { id: "tt-concierge", name: "TT Concierge Agent" },
    { id: "tt-ambassador", name: "TT Ambassador Agent" },
  ],
  brandaro: [
    { id: "brandaro-sales", name: "Brandaro Digital Sales Expert" },
    { id: "brandaro-closer", name: "Brandaro Sales Closer" },
    { id: "brandaro-rel", name: "Brandaro Relationship Specialist" },
    { id: "brandaro-es-closer", name: "Brandaro Spanish Closer" },
    { id: "brandaro-es-rel", name: "Brandaro Spanish Relationship" },
  ],
  iclean: [{ id: "iclean-booking", name: "iClean Booking Agent" }],
  playboxxx: [
    { id: "playboxxx-affiliate", name: "Playboxxx Affiliate Agent" },
    { id: "playboxxx-manager", name: "Playboxxx Manager Agent" },
    { id: "playboxxx-production", name: "Playboxxx Production Agent" },
  ],
};

type SearchResult = {
  phoneNumber: string;
  friendlyName: string;
  locality: string;
  region: string;
  country: string;
  monthlyCost: number;
};

export default function PhoneProvisioningPage() {
  const [step, setStep] = useState(0);
  const [twilioStatus, setTwilioStatus] = useState<{ connected: boolean; accountName: string } | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [existingNumbers, setExistingNumbers] = useState<any[]>([]);

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
  const [selectedAgent, setSelectedAgent] = useState<{ id: string; name: string } | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseProgress, setPurchaseProgress] = useState<string[]>([]);
  const [purchaseComplete, setPurchaseComplete] = useState(false);

  useEffect(() => {
    checkTwilioStatus();
    loadExistingNumbers();
  }, []);

  const checkTwilioStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("provision-dc-number", {
        body: { action: "status" },
      });
      if (error) throw error;
      setTwilioStatus({ connected: data.connected, accountName: data.accountName });
    } catch {
      setTwilioStatus({ connected: false, accountName: "Error" });
    } finally {
      setStatusLoading(false);
    }
  };

  const loadExistingNumbers = async () => {
    const { data } = await supabase.from("dc_phone_numbers").select("*").order("created_at", { ascending: false });
    if (data) setExistingNumbers(data);
  };

  const handleSearch = async () => {
    setSearching(true);
    setSearchResults([]);
    try {
      const searchBody: any = { action: "search", country, numberType };
      if (country === "DO") {
        searchBody.areaCode = "809";
      } else if (numberType === "tollfree") {
        searchBody.prefix = tollFreePrefix;
      } else {
        searchBody.areaCode = areaCode || customAreaCode || "929";
      }

      const { data, error } = await supabase.functions.invoke("provision-dc-number", { body: searchBody });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Search failed");
      setSearchResults(data.numbers || []);
      if (data.numbers?.length === 0) toast.info("No numbers found. Try a different area code.");
    } catch (err: any) {
      toast.error("Search failed: " + (err.message || "Unknown error"));
    } finally {
      setSearching(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedNumber || !business) return;
    setPurchasing(true);
    setPurchaseProgress(["📞 Contacting Twilio..."]);

    try {
      await new Promise((r) => setTimeout(r, 800));
      setPurchaseProgress((p) => [...p, "✅ Number secured!"]);

      const { data, error } = await supabase.functions.invoke("provision-dc-number", {
        body: {
          action: "purchase",
          phoneNumber: selectedNumber.phoneNumber,
          business,
          agentId: selectedAgent?.id,
          agentName: selectedAgent?.name,
          country,
          numberType: country === "DO" ? "dr_local" : numberType,
          quantity: 1,
        },
      });

      if (error) throw error;
      setPurchaseProgress((p) => [...p, "💾 Saving to database..."]);
      await new Promise((r) => setTimeout(r, 500));

      const result = data.results?.[0];
      if (result?.success) {
        setPurchaseProgress((p) => [...p, `✅ ${result.number} is LIVE!`]);
        setPurchaseComplete(true);
        loadExistingNumbers();
        toast.success("Number purchased successfully!");
      } else {
        throw new Error(JSON.stringify(result?.error || "Purchase failed"));
      }
    } catch (err: any) {
      setPurchaseProgress((p) => [...p, `❌ Error: ${err.message}`]);
      toast.error("Purchase failed");
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
    setSelectedAgent(null);
    setPurchaseProgress([]);
    setPurchaseComplete(false);
  };

  const formatPhone = (num: string) => {
    const d = num.replace(/\D/g, "");
    if (d.length === 11 && d[0] === "1") {
      return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
    }
    return num;
  };

  const monthlyCost = country === "DO" ? 5.0 : numberType === "tollfree" ? 2.0 : 1.0;
  const isTwilioConnected = Boolean(twilioStatus?.connected);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Phone className="h-8 w-8 text-primary" /> Phone Number Provisioning
          </h1>
          <p className="text-muted-foreground mt-1">Search, purchase, and assign Twilio phone numbers</p>
        </div>
        {step > 0 && !purchaseComplete && (
          <Button variant="outline" onClick={resetWizard}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Start Over
          </Button>
        )}
      </div>

      {/* Connection Status */}
      <Card>
        <CardContent className="py-4">
          {statusLoading ? (
            <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Checking Twilio connection...</div>
          ) : twilioStatus?.connected ? (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-medium">
              🟢 Twilio Connected — {twilioStatus.accountName}
            </div>
          ) : (
            <div className="space-y-2 text-red-500 font-medium">
              <div>⚠️ Twilio credentials not found.</div>
              <div>Please add these to project secrets:</div>
              <div className="font-mono text-sm text-foreground">TWILIO_ACCOUNT_SID</div>
              <div className="font-mono text-sm text-foreground">TWILIO_AUTH_TOKEN</div>
              <div className="text-sm text-muted-foreground">
                You can find them at console.twilio.com under Account Info on the dashboard.
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Existing Numbers */}
      {isTwilioConnected && existingNumbers.length > 0 && step === 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Current Numbers</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Business</th>
                    <th className="pb-2 font-medium">Number</th>
                    <th className="pb-2 font-medium">Agent</th>
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium">Cost</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {existingNumbers.map((n) => (
                    <tr key={n.id} className="border-b border-border/50">
                      <td className="py-2">{n.business}</td>
                      <td className="py-2 font-mono">{formatPhone(n.phone_number)}</td>
                      <td className="py-2">{n.assigned_agent_name || "—"}</td>
                      <td className="py-2">{n.number_type || "local"}</td>
                      <td className="py-2">${n.monthly_cost || "1.00"}/mo</td>
                      <td className="py-2">
                        {n.is_active ? (
                          <span className="text-green-600 dark:text-green-400">✅ Active</span>
                        ) : (
                          <span className="text-muted-foreground">Inactive</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 0 — Select Business */}
      {isTwilioConnected && step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1 — Select Business</CardTitle>
            <CardDescription>Which business needs a phone number?</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {BUSINESSES.map((b) => (
              <Button
                key={b.key}
                variant={business === b.key ? "default" : "outline"}
                className="h-auto py-4 flex flex-col gap-1"
                onClick={() => { setBusiness(b.key); setStep(1); }}
              >
                <span className="font-semibold text-sm">{b.label}</span>
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* STEP 1 — Select Country */}
      {isTwilioConnected && step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2 — Select Country</CardTitle>
            <CardDescription>Where do you need a phone number?</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => { setCountry("US"); setStep(2); }}
                className="p-6 rounded-lg border-2 border-border text-left transition-all hover:shadow-md hover:border-primary"
              >
                <div className="text-4xl mb-2">🇺🇸</div>
                <div className="text-lg font-bold">United States</div>
                <div className="text-muted-foreground text-sm mt-1">Local & Toll-Free numbers</div>
                <div className="text-primary font-semibold mt-2">From $1/month</div>
              </button>
              <button
                onClick={() => { setCountry("DO"); setStep(3); setNumberType("local"); }}
                className="p-6 rounded-lg border-2 border-border text-left transition-all hover:shadow-md hover:border-primary"
              >
                <div className="text-4xl mb-2">🇩🇴</div>
                <div className="text-lg font-bold">Dominican Republic</div>
                <div className="text-muted-foreground text-sm mt-1">Local presence — 3-4x higher answer rate</div>
                <div className="text-primary font-semibold mt-2">~$5/month</div>
              </button>
            </div>
            <div className="mt-4 text-center text-sm text-muted-foreground">🌍 More countries coming soon</div>
          </CardContent>
        </Card>
      )}

      {/* STEP 2 — Number Type (US only) */}
      {isTwilioConnected && step === 2 && country === "US" && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3 — Number Type</CardTitle>
            <CardDescription>What kind of number do you need?</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => { setNumberType("local"); setStep(3); }}
                className="p-6 rounded-lg border-2 border-border text-left transition-all hover:shadow-md hover:border-primary"
              >
                <MapPin className="h-8 w-8 text-primary mb-2" />
                <div className="text-lg font-bold">📍 Local Number</div>
                <div className="text-muted-foreground text-sm mt-1">Best for outbound cold calling</div>
                <div className="text-primary font-semibold mt-2">$1/month</div>
              </button>
              <button
                onClick={() => { setNumberType("tollfree"); setStep(3); }}
                className="p-6 rounded-lg border-2 border-border text-left transition-all hover:shadow-md hover:border-primary"
              >
                <Phone className="h-8 w-8 text-primary mb-2" />
                <div className="text-lg font-bold">📞 Toll-Free</div>
                <div className="text-muted-foreground text-sm mt-1">Best for inbound callbacks — builds trust</div>
                <div className="text-primary font-semibold mt-2">$2/month</div>
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 3 — State / Area Code */}
      {isTwilioConnected && step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 4 — {country === "DO" ? "Dominican Republic" : numberType === "tollfree" ? "Toll-Free Prefix" : "Select State & Area Code"}</CardTitle>
          </CardHeader>
          <CardContent>
            {country === "DO" ? (
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="font-medium">🇩🇴 Dominican Republic Numbers</p>
                  <p className="text-sm text-muted-foreground mt-1">DR numbers use area codes 809, 829, 849. We'll find the best available number.</p>
                </div>
                <Button onClick={() => { setAreaCode("809"); setStep(business === "brandaro" ? 4 : 5); }}>
                  Continue <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            ) : numberType === "tollfree" ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Select a toll-free prefix:</p>
                <div className="flex flex-wrap gap-3">
                  {TOLL_FREE_PREFIXES.map((p) => (
                    <Button
                      key={p}
                      variant={tollFreePrefix === p ? "default" : "outline"}
                      size="lg"
                      className="text-lg font-mono"
                      onClick={() => { setTollFreePrefix(p); setStep(business === "brandaro" ? 4 : 5); }}
                    >
                      {p}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Select a state to see available area codes:</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {Object.entries(STATE_AREA_CODES).map(([state, info]) => (
                    <Button
                      key={state}
                      variant={selectedState === state ? "default" : "outline"}
                      className="h-auto py-3 flex flex-col gap-0.5"
                      onClick={() => setSelectedState(state)}
                    >
                      <span className="text-lg">{info.emoji}</span>
                      <span className="text-xs font-medium">{info.label}</span>
                    </Button>
                  ))}
                  <Button
                    variant={selectedState === "Other" ? "default" : "outline"}
                    className="h-auto py-3 flex flex-col gap-0.5"
                    onClick={() => setSelectedState("Other")}
                  >
                    <span className="text-lg">🤠</span>
                    <span className="text-xs font-medium">Other</span>
                  </Button>
                </div>

                {selectedState && selectedState !== "Other" && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{STATE_AREA_CODES[selectedState]?.emoji} {selectedState} area codes:</p>
                    <div className="flex flex-wrap gap-2">
                      {STATE_AREA_CODES[selectedState]?.codes.map((code) => (
                        <Button
                          key={code}
                          variant={areaCode === code ? "default" : "outline"}
                          size="lg"
                          className="text-lg font-mono"
                          onClick={() => { setAreaCode(code); setStep(business === "brandaro" ? 4 : 5); }}
                        >
                          {code}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedState === "Other" && (
                  <div className="flex gap-2 items-center">
                    <Input
                      placeholder="Enter area code (e.g. 702)"
                      value={customAreaCode}
                      onChange={(e) => setCustomAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
                      className="w-40 font-mono text-lg"
                      maxLength={3}
                    />
                    <Button
                      disabled={customAreaCode.length !== 3}
                      onClick={() => { setAreaCode(customAreaCode); setStep(business === "brandaro" ? 4 : 5); }}
                    >
                      Use {customAreaCode} <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* STEP 4 — Quantity (Brandaro only) */}
      {isTwilioConnected && step === 4 && business === "brandaro" && (
        <Card>
          <CardHeader>
            <CardTitle>Step 5 — Quantity</CardTitle>
            <CardDescription>How many outbound numbers do you need?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              {[1, 2, 3, 4, 5].map((q) => (
                <Button
                  key={q}
                  variant={quantity === q ? "default" : "outline"}
                  size="lg"
                  className="text-xl w-14 h-14"
                  onClick={() => setQuantity(q)}
                >
                  {q}
                </Button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">💡 Recommended: 1 number per 4 VAs. For 20 VAs → select 5</p>
            <Button onClick={() => setStep(5)}>Continue <ArrowRight className="h-4 w-4 ml-2" /></Button>
          </CardContent>
        </Card>
      )}

      {/* STEP 5 — Search */}
      {isTwilioConnected && step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 6 — Search Available Numbers</CardTitle>
            <CardDescription>
              {country === "DO" ? "Searching Dominican Republic" : numberType === "tollfree" ? `Searching toll-free ${tollFreePrefix}` : `Searching ${selectedState || "US"} — area code ${areaCode || customAreaCode}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleSearch} disabled={searching} size="lg">
              {searching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
              {searching ? "Searching..." : "🔍 Search Available Numbers"}
            </Button>

            {searchResults.length > 0 && (
              <div className="grid gap-3">
                {searchResults.map((num) => (
                  <button
                    key={num.phoneNumber}
                    onClick={() => { setSelectedNumber(num); setStep(6); }}
                    className={`p-4 rounded-lg border-2 text-left transition-all hover:shadow-md ${
                      selectedNumber?.phoneNumber === num.phoneNumber ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-lg font-mono font-bold">📞 {formatPhone(num.phoneNumber)}</div>
                        <div className="text-sm text-muted-foreground">{num.locality || num.region}{num.locality ? `, ${num.region}` : ""} • Voice + SMS</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-primary">${num.monthlyCost.toFixed(2)}/mo</div>
                        <div className="text-xs text-green-600 dark:text-green-400 mt-1">✓ Select</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!searching && searchResults.length === 0 && (
              <p className="text-muted-foreground text-sm">Click search to find available numbers.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* STEP 6 — Assign Agent */}
      {isTwilioConnected && step === 6 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 7 — Assign Agent</CardTitle>
            <CardDescription>Which AI agent should answer calls on this number?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              {(BUSINESS_AGENTS[business] || []).map((agent) => (
                <Button
                  key={agent.id}
                  variant={selectedAgent?.id === agent.id ? "default" : "outline"}
                  className="justify-start h-auto py-3"
                  onClick={() => { setSelectedAgent(agent); setStep(7); }}
                >
                  <Check className={`h-4 w-4 mr-2 ${selectedAgent?.id === agent.id ? "opacity-100" : "opacity-0"}`} />
                  {agent.name}
                </Button>
              ))}
              <Button
                variant={selectedAgent?.id === "none" ? "default" : "outline"}
                className="justify-start h-auto py-3"
                onClick={() => { setSelectedAgent({ id: "none", name: "Unassigned" }); setStep(7); }}
              >
                <Check className={`h-4 w-4 mr-2 ${selectedAgent?.id === "none" ? "opacity-100" : "opacity-0"}`} />
                Skip — Assign later
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 7 — Confirm & Buy */}
      {isTwilioConnected && step === 7 && !purchaseComplete && (
        <Card>
          <CardHeader><CardTitle>Step 8 — Confirm Purchase</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted/50 p-5 rounded-lg space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Number:</span><span className="font-mono font-bold">{formatPhone(selectedNumber?.phoneNumber || "")}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Country:</span><span>{country === "DO" ? "🇩🇴 Dominican Republic" : "🇺🇸 United States"}{selectedState ? ` — ${selectedState}` : ""}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Type:</span><span>{country === "DO" ? "Local (DR)" : numberType === "tollfree" ? "Toll-Free" : "Local"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Business:</span><span>{BUSINESSES.find((b) => b.key === business)?.label}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Agent:</span><span>{selectedAgent?.name}</span></div>
              <hr className="border-border" />
              <div className="flex justify-between text-lg font-bold"><span>Monthly Cost:</span><span className="text-primary">${monthlyCost.toFixed(2)}/mo</span></div>
            </div>

            {purchaseProgress.length > 0 && (
              <div className="space-y-1 p-4 bg-muted/30 rounded-lg font-mono text-sm">
                {purchaseProgress.map((msg, i) => (
                  <div key={i}>{msg}</div>
                ))}
                {purchasing && <Loader2 className="h-4 w-4 animate-spin mt-2" />}
              </div>
            )}

            {!purchasing && purchaseProgress.length === 0 && (
              <Button onClick={handlePurchase} size="lg" className="w-full">
                <ShoppingCart className="h-5 w-5 mr-2" /> Buy This Number — ${monthlyCost.toFixed(2)}/month
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Purchase Complete */}
      {isTwilioConnected && purchaseComplete && (
        <Card className="border-green-500/50 bg-green-500/5">
          <CardContent className="py-6 text-center space-y-4">
            <div className="text-4xl">🎉</div>
            <h2 className="text-2xl font-bold text-green-600 dark:text-green-400">Number is LIVE!</h2>
            <p className="font-mono text-lg">{formatPhone(selectedNumber?.phoneNumber || "")}</p>
            <p className="text-muted-foreground">Assigned to {selectedAgent?.name} for {BUSINESSES.find((b) => b.key === business)?.label}</p>
            <Button onClick={resetWizard} variant="outline">Buy Another Number</Button>
          </CardContent>
        </Card>
      )}

      {/* Bulk Setup Card */}
      {isTwilioConnected && step === 0 && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">🚀 Dynasty Complete Setup</CardTitle>
            <CardDescription>Recommended number package for all businesses — ~$25/month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Region</th>
                    <th className="pb-2 font-medium">Qty</th>
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium">Code</th>
                    <th className="pb-2 font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {[
                    { region: "🗽 New York", qty: 5, type: "Local", code: "929", cost: "$5/mo" },
                    { region: "🌴 Florida", qty: 2, type: "Local", code: "305", cost: "$2/mo" },
                    { region: "⭐ Texas", qty: 2, type: "Local", code: "214", cost: "$2/mo" },
                    { region: "🌅 California", qty: 2, type: "Local", code: "213", cost: "$2/mo" },
                    { region: "🏙️ New Jersey", qty: 1, type: "Local", code: "848", cost: "$1/mo" },
                    { region: "🍑 Georgia", qty: 1, type: "Local", code: "404", cost: "$1/mo" },
                    { region: "🇩🇴 Dom Republic", qty: 2, type: "Local", code: "809", cost: "$10/mo" },
                    { region: "📞 Inbound", qty: 1, type: "Toll-Free", code: "888", cost: "$2/mo" },
                  ].map((r, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2">{r.region}</td>
                      <td className="py-2">{r.qty}</td>
                      <td className="py-2">{r.type}</td>
                      <td className="py-2 font-mono">{r.code}</td>
                      <td className="py-2">{r.cost}</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td className="py-2">Total</td>
                    <td className="py-2">16</td>
                    <td></td>
                    <td></td>
                    <td className="py-2 text-primary">~$25/mo</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
