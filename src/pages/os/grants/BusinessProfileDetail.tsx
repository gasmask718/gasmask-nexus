import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Profile = Record<string, any>;

type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "bool"
  | "select"
  | "array";

interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  placeholder?: string;
  span?: 1 | 2;
}

const ENTITY_OPTIONS = [
  { value: "llc", label: "LLC" },
  { value: "corp", label: "Corporation" },
  { value: "sole_prop", label: "Sole Proprietorship" },
  { value: "nonprofit", label: "Nonprofit" },
  { value: "partnership", label: "Partnership" },
];

const TABS: { id: string; label: string; fields: FieldDef[] }[] = [
  {
    id: "identity",
    label: "Identity & Entity",
    fields: [
      { key: "business_name", label: "Business Name", type: "text" },
      { key: "legal_name", label: "Legal Name", type: "text" },
      { key: "dba_name", label: "DBA Name", type: "text" },
      { key: "entity_type", label: "Entity Type", type: "select", options: ENTITY_OPTIONS },
      { key: "ein", label: "EIN", type: "text", placeholder: "XX-XXXXXXX" },
      { key: "state_of_incorporation", label: "State of Incorporation", type: "text" },
      { key: "date_incorporated", label: "Date Incorporated", type: "date" },
      { key: "years_in_business", label: "Years in Business", type: "number" },
      { key: "naics_primary", label: "Primary NAICS Code", type: "text" },
      { key: "naics_secondary", label: "Secondary NAICS (comma-sep)", type: "array" },
      { key: "website", label: "Website", type: "text", span: 2 },
      { key: "business_description", label: "Business Description", type: "textarea", span: 2 },
      { key: "is_active", label: "Active", type: "bool" },
    ],
  },
  {
    id: "address",
    label: "Address & Zones",
    fields: [
      { key: "address_street", label: "Street", type: "text", span: 2 },
      { key: "address_city", label: "City", type: "text" },
      { key: "address_state", label: "State", type: "text" },
      { key: "address_zip", label: "ZIP", type: "text" },
      { key: "address_county", label: "County", type: "text" },
      { key: "congressional_district", label: "Congressional District", type: "text" },
      { key: "is_urban", label: "Urban Zone", type: "bool" },
      { key: "is_rural", label: "Rural Zone", type: "bool" },
      { key: "is_opportunity_zone", label: "Opportunity Zone", type: "bool" },
      { key: "is_hud_zone", label: "HUD Zone", type: "bool" },
    ],
  },
  {
    id: "ownership",
    label: "Ownership",
    fields: [
      { key: "owner_name", label: "Owner Name", type: "text" },
      { key: "owner_title", label: "Owner Title", type: "text" },
      { key: "owner_email", label: "Owner Email", type: "text" },
      { key: "owner_phone", label: "Owner Phone", type: "text" },
      { key: "owner_percentage", label: "Ownership %", type: "number" },
      { key: "owner_race", label: "Race", type: "text" },
      { key: "owner_ethnicity", label: "Ethnicity", type: "text" },
      { key: "owner_gender", label: "Gender", type: "text" },
      { key: "owner_veteran", label: "Veteran", type: "bool" },
      { key: "owner_disabled", label: "Disabled", type: "bool" },
    ],
  },
  {
    id: "certifications",
    label: "Certifications",
    fields: [
      { key: "cert_sba_small", label: "SBA Small Business", type: "bool" },
      { key: "cert_8a", label: "8(a)", type: "bool" },
      { key: "cert_8a_number", label: "8(a) Number", type: "text" },
      { key: "cert_8a_expiration", label: "8(a) Expiration", type: "date" },
      { key: "cert_mbe", label: "MBE", type: "bool" },
      { key: "cert_mbe_number", label: "MBE Number", type: "text" },
      { key: "cert_mbe_expiration", label: "MBE Expiration", type: "date" },
      { key: "cert_wbe", label: "WBE", type: "bool" },
      { key: "cert_wbe_number", label: "WBE Number", type: "text" },
      { key: "cert_wbe_expiration", label: "WBE Expiration", type: "date" },
      { key: "cert_dbe", label: "DBE", type: "bool" },
      { key: "cert_dbe_number", label: "DBE Number", type: "text" },
      { key: "cert_dbe_expiration", label: "DBE Expiration", type: "date" },
      { key: "cert_hubzone", label: "HUBZone", type: "bool" },
      { key: "cert_hubzone_number", label: "HUBZone Number", type: "text" },
      { key: "cert_hubzone_expiration", label: "HUBZone Expiration", type: "date" },
      { key: "cert_sdvob", label: "SDVOSB", type: "bool" },
      { key: "cert_sdvob_number", label: "SDVOSB Number", type: "text" },
      { key: "cert_sdvob_expiration", label: "SDVOSB Expiration", type: "date" },
      { key: "cert_veteran", label: "Veteran-Owned", type: "bool" },
      { key: "cert_veteran_number", label: "Veteran Cert Number", type: "text" },
    ],
  },
  {
    id: "financials",
    label: "Financials",
    fields: [
      { key: "annual_revenue_current", label: "Annual Revenue (Current)", type: "number" },
      { key: "annual_revenue_prior", label: "Annual Revenue (Prior Yr)", type: "number" },
      { key: "annual_revenue_two_years_ago", label: "Annual Revenue (2 Yrs Ago)", type: "number" },
      { key: "net_income_current", label: "Net Income (Current)", type: "number" },
      { key: "cash_on_hand", label: "Cash on Hand", type: "number" },
      { key: "outstanding_debt", label: "Outstanding Debt", type: "number" },
      { key: "credit_score_business", label: "Business Credit Score", type: "number" },
      { key: "credit_score_personal", label: "Personal Credit Score", type: "number" },
      { key: "bank_account_exists", label: "Business Bank Account", type: "bool" },
      { key: "bank_name", label: "Bank Name", type: "text" },
      { key: "collateral_available", label: "Collateral Available", type: "bool" },
      { key: "collateral_description", label: "Collateral Description", type: "textarea", span: 2 },
    ],
  },
  {
    id: "employees",
    label: "Employees & Jobs",
    fields: [
      { key: "employee_count_ft", label: "Full-Time Employees", type: "number" },
      { key: "employee_count_pt", label: "Part-Time Employees", type: "number" },
      { key: "employee_count_contract", label: "Contract Employees", type: "number" },
      { key: "jobs_to_create", label: "Jobs to Create", type: "number" },
      { key: "jobs_to_retain", label: "Jobs to Retain", type: "number" },
    ],
  },
  {
    id: "registrations",
    label: "Registrations",
    fields: [
      { key: "sam_registered", label: "SAM.gov Registered", type: "bool" },
      { key: "sam_expiration_date", label: "SAM Expiration", type: "date" },
      { key: "duns_number", label: "DUNS Number", type: "text" },
      { key: "uei_number", label: "UEI Number", type: "text" },
      { key: "state_registration_number", label: "State Registration #", type: "text" },
      { key: "business_licenses", label: "Business Licenses (comma-sep)", type: "array", span: 2 },
    ],
  },
  {
    id: "documents",
    label: "Documents",
    fields: [
      { key: "doc_ein_letter", label: "EIN Letter", type: "bool" },
      { key: "doc_articles_of_incorporation", label: "Articles of Incorporation", type: "bool" },
      { key: "doc_operating_agreement", label: "Operating Agreement", type: "bool" },
      { key: "doc_business_license", label: "Business License", type: "bool" },
      { key: "doc_tax_returns_current", label: "Tax Returns (Current)", type: "bool" },
      { key: "doc_tax_returns_prior", label: "Tax Returns (Prior)", type: "bool" },
      { key: "doc_bank_statements", label: "Bank Statements", type: "bool" },
      { key: "doc_financial_statements", label: "Financial Statements", type: "bool" },
      { key: "doc_profit_loss", label: "Profit & Loss", type: "bool" },
      { key: "doc_business_plan", label: "Business Plan", type: "bool" },
      { key: "doc_resumes", label: "Resumes", type: "bool" },
      { key: "doc_certifications", label: "Certifications", type: "bool" },
      { key: "doc_insurance", label: "Insurance", type: "bool" },
      { key: "doc_lease_or_deed", label: "Lease or Deed", type: "bool" },
    ],
  },
];

function toInputValue(type: FieldType, v: any): any {
  if (v === null || v === undefined) return type === "bool" ? false : "";
  if (type === "array") return Array.isArray(v) ? v.join(", ") : "";
  if (type === "date") return typeof v === "string" ? v.slice(0, 10) : "";
  return v;
}

function fromInputValue(type: FieldType, v: any): any {
  if (type === "bool") return !!v;
  if (type === "number") {
    if (v === "" || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  if (type === "array") {
    if (!v || typeof v !== "string") return [];
    return v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (type === "date" || type === "text" || type === "textarea" || type === "select") {
    return v === "" ? null : v;
  }
  return v;
}

export default function BusinessProfileDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = TABS.some((t) => t.id === tabParam) ? (tabParam as string) : TABS[0].id;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const initialValuesRef = useRef<Record<string, any>>({});

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("grant_business_profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) toast.error(error.message);
      setProfile(data);
      initialValuesRef.current = data ? { ...data } : {};
      setLoading(false);
    })();
  }, [id]);

  const setLocal = (key: string, value: any) => {
    setProfile((p) => (p ? { ...p, [key]: value } : p));
  };

  const persist = async (field: FieldDef, rawValue: any) => {
    if (!id || !profile) return;
    const nextValue = fromInputValue(field.type, rawValue);
    const prevValue = initialValuesRef.current[field.key];
    const same =
      Array.isArray(nextValue) && Array.isArray(prevValue)
        ? nextValue.join("|") === prevValue.join("|")
        : nextValue === prevValue ||
          (nextValue == null && prevValue == null);
    if (same) return;

    setSavingKey(field.key);
    const { data: updated, error } = await supabase
      .from("grant_business_profiles")
      .update({ [field.key]: nextValue })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    setSavingKey(null);

    if (error) {
      toast.error(`Save failed: ${error.message}`);
      // roll back local
      setLocal(field.key, prevValue);
      return;
    }

    initialValuesRef.current[field.key] = nextValue;
    // Merge fresh completeness from trigger recompute
    if (updated) {
      setProfile((p) => (p ? { ...p, ...updated } : updated));
      initialValuesRef.current = { ...initialValuesRef.current, ...updated };
    }
    setSavedKey(field.key);
    setTimeout(() => {
      setSavedKey((k) => (k === field.key ? null : k));
    }, 1500);
  };

  const completeness = profile?.completeness_pct ?? profile?.completeness_score ?? 0;
  const completenessColor = useMemo(() => {
    if (completeness >= 80) return "bg-emerald-500";
    if (completeness >= 50) return "bg-amber-500";
    return "bg-red-500";
  }, [completeness]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
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

  const renderField = (f: FieldDef) => {
    const val = toInputValue(f.type, profile[f.key]);
    const isSaving = savingKey === f.key;
    const isSaved = savedKey === f.key;
    const indicator = (
      <span className="ml-2 inline-flex items-center h-4 text-xs">
        {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        {isSaved && !isSaving && <Check className="h-3 w-3 text-emerald-500" />}
      </span>
    );

    const wrapper = (children: React.ReactNode) => (
      <div
        key={f.key}
        className={f.span === 2 ? "md:col-span-2 space-y-1.5" : "space-y-1.5"}
      >
        <Label className="text-xs font-medium flex items-center">
          {f.label}
          {indicator}
        </Label>
        {children}
      </div>
    );

    switch (f.type) {
      case "textarea":
        return wrapper(
          <Textarea
            defaultValue={val}
            rows={3}
            onBlur={(e) => persist(f, e.target.value)}
          />,
        );
      case "bool":
        return (
          <div
            key={f.key}
            className={
              (f.span === 2 ? "md:col-span-2 " : "") +
              "flex items-center justify-between rounded-md border border-border/60 px-3 py-2"
            }
          >
            <Label className="text-sm font-medium flex items-center">
              {f.label}
              {indicator}
            </Label>
            <Switch
              checked={!!val}
              onCheckedChange={(checked) => {
                setLocal(f.key, checked);
                persist(f, checked);
              }}
            />
          </div>
        );
      case "select":
        return wrapper(
          <Select
            value={val || ""}
            onValueChange={(v) => {
              setLocal(f.key, v);
              persist(f, v);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {f.options?.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>,
        );
      case "number":
        return wrapper(
          <Input
            type="number"
            defaultValue={val}
            onBlur={(e) => persist(f, e.target.value)}
          />,
        );
      case "date":
        return wrapper(
          <Input
            type="date"
            defaultValue={val}
            onBlur={(e) => persist(f, e.target.value)}
          />,
        );
      case "array":
      case "text":
      default:
        return wrapper(
          <Input
            type="text"
            defaultValue={val}
            placeholder={f.placeholder}
            onBlur={(e) => persist(f, e.target.value)}
          />,
        );
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate("/os/grants/businesses")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Business Profiles
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="capitalize">
            {profile.entity_type || "no entity type"}
          </Badge>
          {profile.is_active ? (
            <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
              Active
            </Badge>
          ) : (
            <Badge variant="secondary">Inactive</Badge>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">
                {profile.business_name || "Unnamed Business"}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Auto-saves on blur. Green check confirms each field was written.
              </p>
            </div>
            <div className="text-right min-w-[200px]">
              <div className="text-xs text-muted-foreground mb-1">Completeness</div>
              <div className="flex items-center gap-2 justify-end">
                <div className="w-32 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full ${completenessColor} transition-all`}
                    style={{ width: `${completeness}%` }}
                  />
                </div>
                <span className="text-sm font-mono font-medium tabular-nums">
                  {completeness}%
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {(() => {
            const missing: string[] = Array.isArray(profile.completeness_missing)
              ? profile.completeness_missing
              : [];
            const pct = Number(completeness) || 0;
            const badge =
              pct >= 90
                ? { label: "Excellent", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" }
                : pct >= 70
                ? { label: "Good", cls: "bg-sky-500/15 text-sky-600 border-sky-500/30" }
                : pct >= 40
                ? { label: "Needs Information", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" }
                : { label: "Incomplete", cls: "bg-red-500/15 text-red-600 border-red-500/30" };
            return (
              <div className="mb-6 rounded-lg border border-border/60 bg-muted/30 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold">Eligibility Readiness</div>
                  <Badge variant="outline" className={badge.cls}>{badge.label}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mb-3">
                  Profile {pct}% complete · {missing.length} missing {missing.length === 1 ? "requirement" : "requirements"}
                </div>
                {missing.length === 0 ? (
                  <div className="flex items-center gap-2 text-xs text-emerald-600">
                    <Check className="h-3 w-3" /> All required fields complete. Ready for grant matching.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {missing.slice(0, 12).map((m) => (
                      <Badge key={m} variant="outline" className="text-[10px] font-normal">
                        {m}
                      </Badge>
                    ))}
                    {missing.length > 12 && (
                      <Badge variant="outline" className="text-[10px]">+{missing.length - 12} more</Badge>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
          <Tabs defaultValue={TABS[0].id} className="w-full">
            <TabsList className="w-full flex-wrap h-auto justify-start">
              {TABS.map((t) => (
                <TabsTrigger key={t.id} value={t.id} className="text-xs">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {TABS.map((t) => (
              <TabsContent key={t.id} value={t.id} className="mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {t.fields.map(renderField)}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
