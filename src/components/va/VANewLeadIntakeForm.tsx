import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  Upload,
  X,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────
type UploadCategory =
  | "logo"
  | "brand_guidelines"
  | "images"
  | "service_photos"
  | "pricing"
  | "catalogs"
  | "other";

type UploadedFile = {
  name: string;
  url: string;
  size: number;
  type: string;
  category: UploadCategory;
};

type FormState = {
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  city: string;
  businessType: string;
  yearsInBusiness: string;
  teamSize: string;
  hoursOfOperation: string;
  serviceRadius: string;
  existingWebsite: string;
  socialMedia: string;
  servicePackages: string;
  needsLogo: string;
  logoPackage: string;
  themePreference: string;
  brandColors: string;
  pagesNeeded: string;
  primaryGoal: string;
  currentFrustration: string;
  idealCustomer: string;
  valueProposition: string;
  competitors: string;
  brandAdjectives: string;
  primaryCta: string;
  services: string;
  integrations: string[];
  otherIntegration: string;
  ownsDomain: string;
  copywritingPreference: string;
  mediaNeeds: string[];
  designInspiration: string;
  launchDateReason: string;
  budgetRange: string;
  supportPreference: string;
  message: string;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const initialForm: FormState = {
  businessName: "",
  ownerName: "",
  email: "",
  phone: "",
  city: "",
  businessType: "",
  yearsInBusiness: "",
  teamSize: "",
  hoursOfOperation: "",
  serviceRadius: "",
  existingWebsite: "",
  socialMedia: "",
  servicePackages: "",
  needsLogo: "",
  logoPackage: "",
  themePreference: "",
  brandColors: "",
  pagesNeeded: "",
  primaryGoal: "",
  currentFrustration: "",
  idealCustomer: "",
  valueProposition: "",
  competitors: "",
  brandAdjectives: "",
  primaryCta: "",
  services: "",
  integrations: [],
  otherIntegration: "",
  ownsDomain: "",
  copywritingPreference: "",
  mediaNeeds: [],
  designInspiration: "",
  launchDateReason: "",
  budgetRange: "",
  supportPreference: "",
  message: "",
};

const steps = [
  { label: "Vision", title: "The Vision", eyebrow: "01 / Discovery" },
  { label: "Market", title: "Market & Audience", eyebrow: "02 / Positioning" },
  { label: "Conversion", title: "Architecture & Conversion", eyebrow: "03 / Strategy" },
  { label: "Assets", title: "Assets & Content", eyebrow: "04 / Creative" },
  { label: "Timeline", title: "Investment & Timeline", eyebrow: "05 / Scope" },
  { label: "Review", title: "Final Review & Submission", eyebrow: "06 / Submit" },
];

const integrationOptions = ["Google Maps", "CRM Connection", "Booking System", "Live Chat", "Other"];
const mediaOptions = [
  "I have high-quality professional photos/videos",
  "I need custom graphic design (Canva, Photoshop) for banners/branding",
  "I need compelling video edits and reels created",
  "I will rely on premium stock photography",
];
const budgetOptions = [
  "$1,000 - $2,500 (The Starter Foundation)",
  "$2,500 - $5,000 (The Professional Growth Build)",
  "$5,000+ (The Custom Authority Platform)",
];

const uploadCategories: {
  key: UploadCategory;
  label: string;
  description: string;
  accept: string;
}[] = [
  { key: "logo", label: "Logos", description: "Logo marks, icons, SVGs, PNGs, PDFs, or source files.", accept: "image/*,.svg,.ai,.eps,.pdf" },
  { key: "brand_guidelines", label: "Brand Guidelines", description: "Brand books, color guides, font references, catalogs, or PDFs.", accept: ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,image/*" },
  { key: "images", label: "Images & Visual Assets", description: "Business photos, service pictures, product images, team photos.", accept: "image/*,video/*" },
  { key: "service_photos", label: "Service Photos", description: "Before/after, job-site, product examples, portfolio shots.", accept: "image/*,video/*" },
  { key: "pricing", label: "Pricing Sheets", description: "Menus, rate cards, quote sheets, price lists, package spreadsheets.", accept: ".pdf,.doc,.docx,.xls,.xlsx,.csv,image/*" },
  { key: "catalogs", label: "Catalogs & Brochures", description: "Service catalogs, brochures, flyers, menus, sales decks.", accept: ".pdf,.doc,.docx,.ppt,.pptx,image/*" },
  { key: "other", label: "Other Project Files", description: "Anything else worth reviewing before scoping the build.", accept: "image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv" },
];

const requiredByStep: Record<number, (keyof FormState)[]> = {
  0: ["businessName", "ownerName", "email", "phone", "city", "primaryGoal", "currentFrustration"],
  1: ["idealCustomer", "valueProposition", "competitors", "brandAdjectives"],
  2: ["primaryCta", "services"],
  3: ["ownsDomain", "copywritingPreference", "designInspiration"],
  4: ["launchDateReason", "budgetRange", "supportPreference"],
};

const FieldLabel = ({
  children,
  required = false,
}: {
  children: React.ReactNode;
  required?: boolean;
}) => (
  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
    {children} {required && <span className="text-cyan-400">*</span>}
  </label>
);

const fieldClass =
  "bg-slate-900/70 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-cyan-500";

interface Props {
  onCreated?: () => void;
  /**
   * "va"     — VA-facing form (default). Requires auth; shows SMS/Email invite buttons.
   * "public" — Public, token-gated form rendered from a link the prospect received.
   *            Skips auth, hides invite-send buttons, submits via edge function.
   */
  mode?: "va" | "public";
  /** Required when mode==="public". The token from va_intake_invites. */
  inviteToken?: string;
  /** Optional pre-fill (typically loaded from get_public_intake_invite RPC). */
  initialPrefill?: Partial<FormState>;
}

export function VANewLeadIntakeForm({ onCreated, mode = "va", inviteToken, initialPrefill }: Props) {
  const { user } = useAuth();
  const isPublic = mode === "public";
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>({ ...initialForm, ...(initialPrefill || {}) });
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploadingCategory, setUploadingCategory] = useState<UploadCategory | null>(null);
  const [scopeAccepted, setScopeAccepted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [smsSending, setSmsSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRefs = useRef<Record<UploadCategory, HTMLInputElement | null>>({
    logo: null,
    brand_guidelines: null,
    images: null,
    service_photos: null,
    pricing: null,
    catalogs: null,
    other: null,
  });

  const progress = useMemo(() => ((step + 1) / steps.length) * 100, [step]);

  const updateField = (key: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleArrayValue = (
    key: "integrations" | "mediaNeeds",
    value: string,
    checked: boolean,
  ) => {
    setForm((prev) => ({
      ...prev,
      [key]: checked ? [...prev[key], value] : prev[key].filter((item) => item !== value),
    }));
  };

  const validateStep = () => {
    const missing = (requiredByStep[step] || []).filter(
      (key) => !String((form as any)[key] || "").trim(),
    );
    if (missing.length) {
      toast.error("Please fill in the required fields before continuing.");
      return false;
    }
    if (step === 2 && form.integrations.length === 0) {
      toast.error("Choose at least one integration, or select Other.");
      return false;
    }
    if (step === 3 && form.mediaNeeds.length === 0) {
      toast.error("Choose at least one media/content option.");
      return false;
    }
    return true;
  };

  const nextStep = () => {
    if (!validateStep()) return;
    setStep((prev) => Math.min(prev + 1, steps.length - 1));
  };
  const previousStep = () => setStep((prev) => Math.max(prev - 1, 0));

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    category: UploadCategory,
  ) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploadingCategory(category);
    const newUploads: UploadedFile[] = [];

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} exceeds 10MB.`);
        continue;
      }
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${category}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
      const { error } = await supabase.storage
        .from("va-lead-intake")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });
      if (error) {
        console.error("Upload error:", error);
        toast.error(`Upload failed: ${file.name}`);
        continue;
      }
      const { data } = supabase.storage.from("va-lead-intake").getPublicUrl(path);
      newUploads.push({
        name: file.name,
        url: data.publicUrl,
        size: file.size,
        type: file.type,
        category,
      });
    }

    setUploadedFiles((prev) => [...prev, ...newUploads]);
    setUploadingCategory(null);
    const ref = fileInputRefs.current[category];
    if (ref) ref.value = "";
  };

  const removeFile = (index: number) =>
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));

  const buildSmsBody = () => {
    return [
      `New Lead: ${form.businessName}`,
      form.ownerName ? `Contact: ${form.ownerName}` : null,
      form.phone ? `Phone: ${form.phone}` : null,
      form.email ? `Email: ${form.email}` : null,
      form.city ? `Location: ${form.city}` : null,
      form.businessType ? `Type: ${form.businessType}` : null,
      form.primaryGoal ? `Goal: ${form.primaryGoal}` : null,
      form.budgetRange ? `Budget: ${form.budgetRange}` : null,
      form.launchDateReason ? `Launch: ${form.launchDateReason}` : null,
      form.primaryCta ? `Primary CTA: ${form.primaryCta}` : null,
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 1500);
  };

  const sendIntakeInvite = async (channels: ("sms" | "email")[]) => {
    if (!form.businessName.trim()) {
      toast.error("Business name is required.");
      return;
    }
    if (channels.includes("sms") && !form.phone.trim()) {
      toast.error("Phone number is required to send SMS.");
      return;
    }
    if (channels.includes("email") && !form.email.trim()) {
      toast.error("Email is required to send the intake link by email.");
      return;
    }
    setSmsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("va-send-intake-invite", {
        body: {
          business_name: form.businessName,
          owner_name: form.ownerName,
          phone: form.phone,
          email: form.email,
          channels,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const r = data?.results || {};
      const okParts: string[] = [];
      const failParts: string[] = [];
      if (channels.includes("sms")) {
        r.sms?.ok ? okParts.push("SMS") : failParts.push(`SMS (${r.sms?.error || "failed"})`);
      }
      if (channels.includes("email")) {
        r.email?.ok ? okParts.push("Email") : failParts.push(`Email (${r.email?.error || "failed"})`);
      }
      if (okParts.length) toast.success(`Intake link sent via ${okParts.join(" + ")}`);
      if (failParts.length) toast.error(`Failed: ${failParts.join(", ")}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to send intake link");
    } finally {
      setSmsSending(false);
    }
  };

  const handleSendSms = () => sendIntakeInvite(["sms"]);
  const handleSendEmail = () => sendIntakeInvite(["email"]);
  const handleSendBoth = () => sendIntakeInvite(["sms", "email"]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scopeAccepted) {
      toast.error("Please confirm the project scope agreement before submitting.");
      return;
    }
    if (!user) {
      toast.error("Not signed in.");
      return;
    }

    setLoading(true);
    const integrations =
      form.integrations.includes("Other") && form.otherIntegration.trim()
        ? [
            ...form.integrations.filter((item) => item !== "Other"),
            `Other: ${form.otherIntegration.trim()}`,
          ]
        : form.integrations;

    const intakePayload = {
      form_type: "va_brandaro_discovery_intake",
      submitted_at: new Date().toISOString(),
      contact: {
        businessName: form.businessName,
        ownerName: form.ownerName,
        email: form.email,
        phone: form.phone,
        city: form.city,
        businessType: form.businessType,
        yearsInBusiness: form.yearsInBusiness,
        teamSize: form.teamSize,
        hoursOfOperation: form.hoursOfOperation,
        serviceRadius: form.serviceRadius,
        existingWebsite: form.existingWebsite,
        socialMedia: form.socialMedia,
      },
      vision: {
        primaryGoal: form.primaryGoal,
        currentFrustration: form.currentFrustration,
      },
      market: {
        idealCustomer: form.idealCustomer,
        valueProposition: form.valueProposition,
        competitors: form.competitors,
        brandAdjectives: form.brandAdjectives,
      },
      conversion: {
        primaryCta: form.primaryCta,
        services: form.services,
        servicePackages: form.servicePackages,
        pagesNeeded: form.pagesNeeded,
        integrations,
      },
      creative: {
        ownsDomain: form.ownsDomain,
        copywritingPreference: form.copywritingPreference,
        mediaNeeds: form.mediaNeeds,
        designInspiration: form.designInspiration,
        themePreference: form.themePreference,
        brandColors: form.brandColors,
        needsLogo: form.needsLogo === "Yes",
        logoPackage: form.logoPackage,
      },
      scope: {
        launchDateReason: form.launchDateReason,
        budgetRange: form.budgetRange,
        supportPreference: form.supportPreference,
      },
      notes: form.message,
      uploadedFiles,
      scopeAccepted,
    };

    const callNotes = `[VA Discovery Intake]\n${JSON.stringify(intakePayload, null, 2)}`;

    try {
      const { error: insertError } = await (supabase as any)
        .from("brandaro_qualified_leads")
        .insert({
          business_name: form.businessName,
          phone_number: form.phone,
          city: form.city,
          state: null,
          industry: form.businessType || null,
          assigned_va: user.id,
          lead_status: "new",
          source: "va_intake",
          call_notes: callNotes,
          service_interest: form.services || null,
          has_website: !!form.existingWebsite,
          website_status: form.existingWebsite ? "has_site" : "unknown",
        });
      if (insertError) throw insertError;

      setSubmitted(true);
      toast.success("Discovery form submitted.");
      onCreated?.();
    } catch (error: any) {
      console.error("Discovery form submission error:", error);
      toast.error(error.message || "Submission failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/60 p-10 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/15 ring-1 ring-cyan-400/40">
          <CheckCircle className="h-8 w-8 text-cyan-400" />
        </div>
        <h3 className="text-2xl font-bold text-white">Discovery Form Received</h3>
        <p className="mt-2 text-sm text-slate-400">
          Lead saved. The team will follow up within 24 hours.
        </p>
        <Button
          className="mt-6 bg-cyan-600 hover:bg-cyan-700 text-white"
          onClick={() => {
            setSubmitted(false);
            setForm(initialForm);
            setUploadedFiles([]);
            setScopeAccepted(false);
            setStep(0);
          }}
        >
          Capture Another Lead
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/50 overflow-hidden">
      {/* Header */}
      <div className="px-6 sm:px-8 pt-6 pb-4 border-b border-slate-700 bg-gradient-to-r from-slate-900/80 via-slate-900/40 to-transparent">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
          <Sparkles className="h-3.5 w-3.5" /> VA Discovery Intake
        </div>
        <h2 className="mt-2 text-2xl font-bold text-white">New Lead — Full Discovery</h2>
        <p className="mt-1 text-sm text-slate-400">
          Capture the full project scope, content, and assets in one structured intake.
        </p>
      </div>

      {/* Stepper */}
      <div className="px-6 sm:px-8 py-5 border-b border-slate-700 bg-slate-900/40">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-cyan-400">
              {steps[step].eyebrow}
            </p>
            <p className="text-lg font-bold text-white">{steps[step].title}</p>
          </div>
          <span className="text-xs text-slate-400">
            Step {step + 1} of {steps.length}
          </span>
        </div>
        <Progress
          value={progress}
          className="mt-3 h-1.5 bg-slate-700 [&>div]:bg-gradient-to-r [&>div]:from-cyan-400 [&>div]:to-cyan-500"
        />
        <div className="mt-3 grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          {steps.map((item, i) => (
            <button
              key={item.label}
              type="button"
              onClick={() => i < step && setStep(i)}
              className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                i === step
                  ? "border-cyan-400 bg-cyan-500/10 text-white"
                  : i < step
                    ? "border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/5"
                    : "border-slate-700 text-slate-500"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div className="px-6 sm:px-8 py-6 min-h-[400px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              {step === 0 && (
                <>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <FieldLabel required>Business Name</FieldLabel>
                      <Input value={form.businessName} onChange={(e) => updateField("businessName", e.target.value)} placeholder="Brandaro Digital" className={fieldClass} />
                    </div>
                    <div>
                      <FieldLabel required>Decision Maker Name</FieldLabel>
                      <Input value={form.ownerName} onChange={(e) => updateField("ownerName", e.target.value)} placeholder="Full name" className={fieldClass} />
                    </div>
                    <div>
                      <FieldLabel required>Email Address</FieldLabel>
                      <Input type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} placeholder="you@business.com" className={fieldClass} />
                    </div>
                    <div>
                      <FieldLabel required>Phone Number</FieldLabel>
                      <Input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} placeholder="+1 (555) 123-4567" className={fieldClass} />
                    </div>
                    <div>
                      <FieldLabel required>Location / Service Area</FieldLabel>
                      <Input value={form.city} onChange={(e) => updateField("city", e.target.value)} placeholder="Houston, TX" className={fieldClass} />
                    </div>
                    <div>
                      <FieldLabel>Business Type</FieldLabel>
                      <Input value={form.businessType} onChange={(e) => updateField("businessType", e.target.value)} placeholder="Med spa, contractor, restaurant..." className={fieldClass} />
                    </div>
                    <div>
                      <FieldLabel>Years in Business</FieldLabel>
                      <Input value={form.yearsInBusiness} onChange={(e) => updateField("yearsInBusiness", e.target.value)} placeholder="3 years" className={fieldClass} />
                    </div>
                    <div>
                      <FieldLabel>Team Size</FieldLabel>
                      <Input value={form.teamSize} onChange={(e) => updateField("teamSize", e.target.value)} placeholder="Owner-operated, 5 employees..." className={fieldClass} />
                    </div>
                    <div>
                      <FieldLabel>Hours of Operation</FieldLabel>
                      <Input value={form.hoursOfOperation} onChange={(e) => updateField("hoursOfOperation", e.target.value)} placeholder="Mon-Fri, 9AM-6PM" className={fieldClass} />
                    </div>
                    <div>
                      <FieldLabel>Service Radius</FieldLabel>
                      <Input value={form.serviceRadius} onChange={(e) => updateField("serviceRadius", e.target.value)} placeholder="25 miles around Houston" className={fieldClass} />
                    </div>
                  </div>
                  <div>
                    <FieldLabel required>Primary goal of the new website</FieldLabel>
                    <Textarea value={form.primaryGoal} onChange={(e) => updateField("primaryGoal", e.target.value)} placeholder="Generate leads, automate onboarding, sell services, improve credibility..." rows={3} className={fieldClass} />
                  </div>
                  <div>
                    <FieldLabel required>Biggest frustration with current online presence</FieldLabel>
                    <Textarea value={form.currentFrustration} onChange={(e) => updateField("currentFrustration", e.target.value)} placeholder="Low conversion, outdated look, no clear offer..." rows={3} className={fieldClass} />
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <div>
                    <FieldLabel required>Ideal customer</FieldLabel>
                    <Textarea value={form.idealCustomer} onChange={(e) => updateField("idealCustomer", e.target.value)} placeholder="Describe the customer you most want to attract." rows={3} className={fieldClass} />
                  </div>
                  <div>
                    <FieldLabel required>Ultimate value proposition</FieldLabel>
                    <Textarea value={form.valueProposition} onChange={(e) => updateField("valueProposition", e.target.value)} placeholder="What makes your offer clearly better, faster, safer..." rows={3} className={fieldClass} />
                  </div>
                  <div>
                    <FieldLabel required>Top 2-3 competitors</FieldLabel>
                    <Textarea value={form.competitors} onChange={(e) => updateField("competitors", e.target.value)} placeholder="Names or links" rows={2} className={fieldClass} />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <FieldLabel>Existing Website</FieldLabel>
                      <Input value={form.existingWebsite} onChange={(e) => updateField("existingWebsite", e.target.value)} placeholder="https://yourwebsite.com" className={fieldClass} />
                    </div>
                    <div>
                      <FieldLabel>Social Media</FieldLabel>
                      <Input value={form.socialMedia} onChange={(e) => updateField("socialMedia", e.target.value)} placeholder="IG, FB, TikTok links..." className={fieldClass} />
                    </div>
                  </div>
                  <div>
                    <FieldLabel required>3 adjectives visitors should feel</FieldLabel>
                    <Input value={form.brandAdjectives} onChange={(e) => updateField("brandAdjectives", e.target.value)} placeholder="Trustworthy, Modern, Exclusive" className={fieldClass} />
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div>
                    <FieldLabel required>The #1 action a visitor MUST take</FieldLabel>
                    <Input value={form.primaryCta} onChange={(e) => updateField("primaryCta", e.target.value)} placeholder="Book a call, request a quote, apply now..." className={fieldClass} />
                  </div>
                  <div>
                    <FieldLabel required>Core Services / Products</FieldLabel>
                    <Textarea value={form.services} onChange={(e) => updateField("services", e.target.value)} placeholder="List your primary offers, services, products." rows={4} className={fieldClass} />
                  </div>
                  <div>
                    <FieldLabel>Service Packages</FieldLabel>
                    <Textarea value={form.servicePackages} onChange={(e) => updateField("servicePackages", e.target.value)} placeholder="Tiers, package names, bundled services..." rows={2} className={fieldClass} />
                  </div>
                  <div>
                    <FieldLabel>Pages Needed</FieldLabel>
                    <Input value={form.pagesNeeded} onChange={(e) => updateField("pagesNeeded", e.target.value)} placeholder="Home, About, Services, Pricing, Contact..." className={fieldClass} />
                  </div>
                  <div>
                    <FieldLabel required>Integrations</FieldLabel>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {integrationOptions.map((option) => (
                        <label key={option} className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/40 p-3 cursor-pointer hover:border-cyan-500/50">
                          <Checkbox
                            checked={form.integrations.includes(option)}
                            onCheckedChange={(c) => toggleArrayValue("integrations", option, c === true)}
                            className="border-slate-600 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
                          />
                          <span className="text-sm text-slate-200">{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  {form.integrations.includes("Other") && (
                    <div>
                      <FieldLabel>Describe Other Integration</FieldLabel>
                      <Input value={form.otherIntegration} onChange={(e) => updateField("otherIntegration", e.target.value)} placeholder="Describe the integration" className={fieldClass} />
                    </div>
                  )}
                </>
              )}

              {step === 3 && (
                <>
                  <div>
                    <FieldLabel required>Do you own your domain?</FieldLabel>
                    <RadioGroup value={form.ownsDomain} onValueChange={(v) => updateField("ownsDomain", v)} className="grid sm:grid-cols-2 gap-2">
                      {["Yes", "No"].map((option) => (
                        <Label key={option} className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/40 p-3 cursor-pointer text-slate-200">
                          <RadioGroupItem value={option} className="border-slate-500 text-cyan-400" />
                          {option}
                        </Label>
                      ))}
                    </RadioGroup>
                  </div>
                  <div>
                    <FieldLabel required>Copywriting</FieldLabel>
                    <RadioGroup value={form.copywritingPreference} onValueChange={(v) => updateField("copywritingPreference", v)} className="grid sm:grid-cols-2 gap-2">
                      {["I have the text ready", "I need SEO copy written"].map((option) => (
                        <Label key={option} className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/40 p-3 cursor-pointer text-slate-200">
                          <RadioGroupItem value={option} className="border-slate-500 text-cyan-400" />
                          {option}
                        </Label>
                      ))}
                    </RadioGroup>
                  </div>
                  <div>
                    <FieldLabel required>Media</FieldLabel>
                    <div className="grid gap-2">
                      {mediaOptions.map((option) => (
                        <label key={option} className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/40 p-3 cursor-pointer hover:border-cyan-500/50">
                          <Checkbox
                            checked={form.mediaNeeds.includes(option)}
                            onCheckedChange={(c) => toggleArrayValue("mediaNeeds", option, c === true)}
                            className="border-slate-600 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
                          />
                          <span className="text-sm text-slate-200">{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <FieldLabel required>Design Inspiration</FieldLabel>
                    <Textarea value={form.designInspiration} onChange={(e) => updateField("designInspiration", e.target.value)} placeholder="2-3 links to websites you love." rows={3} className={fieldClass} />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <FieldLabel>Theme Preference</FieldLabel>
                      <Input value={form.themePreference} onChange={(e) => updateField("themePreference", e.target.value)} placeholder="Luxury, modern, bold, clean..." className={fieldClass} />
                    </div>
                    <div>
                      <FieldLabel>Brand Colors</FieldLabel>
                      <Input value={form.brandColors} onChange={(e) => updateField("brandColors", e.target.value)} placeholder="Navy, gold, white / hex codes" className={fieldClass} />
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Needs Logo Designed?</FieldLabel>
                    <RadioGroup value={form.needsLogo} onValueChange={(v) => updateField("needsLogo", v)} className="grid sm:grid-cols-2 gap-2">
                      {["Yes", "No"].map((option) => (
                        <Label key={option} className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/40 p-3 cursor-pointer text-slate-200">
                          <RadioGroupItem value={option} className="border-slate-500 text-cyan-400" />
                          {option}
                        </Label>
                      ))}
                    </RadioGroup>
                  </div>
                  {form.needsLogo === "Yes" && (
                    <div>
                      <FieldLabel>Logo Package</FieldLabel>
                      <Input value={form.logoPackage} onChange={(e) => updateField("logoPackage", e.target.value)} placeholder="Basic logo, premium brand kit, not sure..." className={fieldClass} />
                    </div>
                  )}
                </>
              )}

              {step === 4 && (
                <>
                  <div>
                    <FieldLabel required>Target Launch Date & Reason</FieldLabel>
                    <Input value={form.launchDateReason} onChange={(e) => updateField("launchDateReason", e.target.value)} placeholder="June 15 — before our seasonal campaign" className={fieldClass} />
                  </div>
                  <div>
                    <FieldLabel required>Budget Range</FieldLabel>
                    <RadioGroup value={form.budgetRange} onValueChange={(v) => updateField("budgetRange", v)} className="grid gap-2">
                      {budgetOptions.map((option) => (
                        <Label key={option} className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/40 p-3 cursor-pointer text-slate-200">
                          <RadioGroupItem value={option} className="border-slate-500 text-cyan-400" />
                          {option}
                        </Label>
                      ))}
                    </RadioGroup>
                  </div>
                  <div>
                    <FieldLabel required>Ongoing Support</FieldLabel>
                    <RadioGroup value={form.supportPreference} onValueChange={(v) => updateField("supportPreference", v)} className="grid sm:grid-cols-2 gap-2">
                      {["I want a maintenance plan", "I will manage it myself"].map((option) => (
                        <Label key={option} className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/40 p-3 cursor-pointer text-slate-200">
                          <RadioGroupItem value={option} className="border-slate-500 text-cyan-400" />
                          {option}
                        </Label>
                      ))}
                    </RadioGroup>
                  </div>
                </>
              )}

              {step === 5 && (
                <>
                  <div>
                    <FieldLabel>Additional notes or specific requirements</FieldLabel>
                    <Textarea value={form.message} onChange={(e) => updateField("message", e.target.value)} placeholder="Special requirements, accessibility needs, must-have functionality..." rows={4} className={fieldClass} />
                  </div>
                  <div>
                    <FieldLabel>Upload logos, brand guidelines, images</FieldLabel>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {uploadCategories.map((category) => {
                        const files = uploadedFiles
                          .map((f, i) => ({ ...f, _idx: i }))
                          .filter((f) => f.category === category.key);
                        const isUploading = uploadingCategory === category.key;
                        return (
                          <div key={category.key} className="rounded-xl border border-slate-700 bg-slate-900/40 p-3">
                            <div className="mb-2">
                              <p className="text-sm font-semibold text-white">{category.label}</p>
                              <p className="text-[11px] text-slate-500">{category.description}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => fileInputRefs.current[category.key]?.click()}
                              className="w-full border-2 border-dashed border-slate-700 rounded-lg p-4 text-center hover:border-cyan-500/60 hover:bg-cyan-500/5 transition-colors"
                            >
                              <input
                                ref={(el) => (fileInputRefs.current[category.key] = el)}
                                type="file"
                                multiple
                                accept={category.accept}
                                onChange={(e) => handleFileUpload(e, category.key)}
                                className="hidden"
                                disabled={isUploading}
                              />
                              {isUploading ? (
                                <span className="inline-flex items-center gap-2 text-xs text-slate-400">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Uploading...
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-200">
                                  <Upload className="h-4 w-4 text-cyan-400" />
                                  Click to upload
                                </span>
                              )}
                            </button>
                            {files.length > 0 && (
                              <div className="mt-2 space-y-1.5">
                                {files.map((file) => (
                                  <div key={file._idx} className="flex items-center justify-between gap-2 rounded-md border border-slate-700 bg-slate-800 p-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      {file.type.startsWith("image/") ? (
                                        <ImageIcon className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                                      ) : (
                                        <FileText className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                                      )}
                                      <span className="text-xs text-slate-200 truncate">{file.name}</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => removeFile(file._idx)}
                                      className="text-slate-500 hover:text-red-400"
                                      aria-label="Remove file"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
                    <Checkbox
                      id="scopeAccepted"
                      checked={scopeAccepted}
                      onCheckedChange={(c) => setScopeAccepted(c === true)}
                      className="mt-0.5 border-slate-600 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
                    />
                    <Label htmlFor="scopeAccepted" className="text-sm font-normal leading-relaxed text-slate-200 cursor-pointer">
                      I understand these details form the foundation of my project scope and accept the{" "}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setTermsOpen(true);
                        }}
                        className="text-cyan-400 underline underline-offset-2 font-semibold"
                      >
                        Terms of Agreement
                      </button>
                      .
                    </Label>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 sm:px-8 py-4 border-t border-slate-700 bg-slate-900/40 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={previousStep}
            disabled={step === 0 || loading}
            className="gap-2 border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Previous
          </Button>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={handleSendSms}
              disabled={smsSending || !form.phone || !form.businessName}
              variant="outline"
              title="Sends https://www.brandarodigital.com/#contact link via SMS"
              className="gap-2 border-cyan-500/50 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20 hover:text-cyan-100"
            >
              {smsSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
              Send Intake Link (SMS)
            </Button>
            <Button
              type="button"
              onClick={handleSendEmail}
              disabled={smsSending || !form.email || !form.businessName}
              variant="outline"
              title="Sends https://www.brandarodigital.com/#contact link via Email"
              className="gap-2 border-purple-500/50 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20 hover:text-purple-100"
            >
              {smsSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Intake Link (Email)
            </Button>
            <Button
              type="button"
              onClick={handleSendBoth}
              disabled={smsSending || !form.businessName || (!form.phone && !form.email)}
              variant="outline"
              className="gap-2 border-emerald-500/50 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 hover:text-emerald-100"
            >
              {smsSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send via SMS + Email
            </Button>

            {step < steps.length - 1 ? (
              <Button
                type="button"
                onClick={nextStep}
                className="gap-2 bg-cyan-600 hover:bg-cyan-700 text-white"
              >
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={loading || !scopeAccepted || uploadingCategory !== null}
                className="gap-2 bg-cyan-600 hover:bg-cyan-700 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" /> Submit Discovery Form
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </form>

      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent className="max-w-lg bg-slate-900 border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-xl">Terms of Agreement</DialogTitle>
            <DialogDescription className="text-slate-400">
              Project content authorization.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
              <p className="text-sm text-slate-200 leading-relaxed italic">
                "I am willingly uploading content from my own business, and I trust the team to use those materials to help plan, design, build, or launch my website."
              </p>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              By accepting, you confirm that you own or have permission to share the uploaded logos, images, brand files, pricing, catalogs, and written content for your website project.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setTermsOpen(false)}
              className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
            >
              Close
            </Button>
            <Button
              onClick={() => {
                setScopeAccepted(true);
                setTermsOpen(false);
              }}
              className="bg-cyan-600 hover:bg-cyan-700 text-white"
            >
              I Agree
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default VANewLeadIntakeForm;
