import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Building2, Search, Target, Zap, ArrowRight, ArrowLeft,
  Users, Brain, Phone, Package, Truck, DollarSign, Factory,
  ShoppingBag, Crown, Shield, Globe, Bot, Warehouse,
  BarChart3, HeartHandshake, Megaphone, Building, Briefcase,
  Layers, Home, MapPin, Scale, Banknote, TrendingUp,
  ChevronDown, ChevronUp, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Floor Blueprint Data ──

interface FloorBlueprint {
  id: string;
  name: string;
  icon: any;
  color: string;
  category: string;
  purpose: string;
  coreFunction: string;
  systems: string[];
  userActions: string[];
  aiRole: string[];
  inputs: string[];
  outputs: string[];
  successMetrics: string[];
  connections: string[];
  warRoomSignals: string[];
}

const BLUEPRINTS: FloorBlueprint[] = [
  // ── Dynasty Core ──
  {
    id: "penthouse", name: "Penthouse — Executive Command", icon: Crown, color: "text-amber-500",
    category: "Dynasty Core",
    purpose: "The CEO cockpit. Full visibility into every floor, every metric, every decision. Strategic control over the entire Dynasty.",
    coreFunction: "Monitor KPIs, approve high-stakes decisions, manage budgets, oversee AI workforce, run executive scenarios.",
    systems: ["CEO Dashboard", "Advisor AI (Mind + Instincts)", "Mission Control", "Accounting OS", "Audit Engine", "Executive Policy Manager"],
    userActions: ["Review daily briefings", "Approve AI action queue items", "Set operational policies", "Run what-if scenarios", "Manage budgets & payroll"],
    aiRole: ["Generates morning/midday/evening ops briefings", "Runs scenario simulations", "Flags anomalies & triggers", "Recommends executive actions"],
    inputs: ["KPI data from all floors", "Financial ledger entries", "AI worker reports", "Alert triggers"],
    outputs: ["Policy decisions", "Budget approvals", "Strategic directives", "Executive briefings"],
    successMetrics: ["Revenue growth rate", "System uptime", "Decision queue resolution time", "AI confidence scores"],
    connections: ["Receives data from ALL floors", "Sends policies to Floor 9 (AI Ops)", "Sends budgets to Floor 5 (Finance)"],
    warRoomSignals: ["Total revenue", "Active alerts", "AI workforce health", "Pending approvals"],
  },
  {
    id: "security", name: "Security & Governance", icon: Shield, color: "text-red-500",
    category: "Dynasty Core",
    purpose: "Enforce role-based access, audit trails, compliance, and constitutional AI governance across the entire OS.",
    coreFunction: "Manage user roles, enforce RLS policies, audit AI decisions, maintain data integrity, prevent privilege escalation.",
    systems: ["Role Manager", "RLS Policy Engine", "AI Constitution", "Audit Log", "Admin Impersonation Log", "Security Scanner"],
    userActions: ["Assign/revoke roles", "Review audit logs", "Configure security policies", "Run compliance scans"],
    aiRole: ["Follows Declare-Check-Execute protocol", "Logs every decision attempt", "Cannot override security boundaries"],
    inputs: ["User actions", "AI decision attempts", "Role change requests"],
    outputs: ["Access grants/denials", "Audit records", "Compliance reports"],
    successMetrics: ["Zero unauthorized access", "100% audit coverage", "Policy violation count"],
    connections: ["Guards every floor", "Reports to Penthouse", "Enforces AI Constitution on Floor 9"],
    warRoomSignals: ["Security violations", "Pending role requests", "AI override attempts"],
  },

  // ── Grabba Skyscraper Floors ──
  {
    id: "floor0", name: "Floor 0 — Territory Intelligence", icon: MapPin, color: "text-cyan-500",
    category: "Grabba Floors",
    purpose: "Geographic discovery engine. Converts location data into actionable territory strategy and lead pipelines.",
    coreFunction: "Ingest business data from Yelp/OSM/Google Places, score territories, discover new stores, feed leads to CRM and dialer.",
    systems: ["Territory Map View", "Ingestion Workers (Yelp, OSM, Google)", "Domination Score Calculator", "Duplicate Resolution", "Store Promotion Pipeline"],
    userActions: ["Explore territory maps", "Review discovery records", "Approve store promotions", "Plan expansion routes"],
    aiRole: ["Scores territories by coverage/conversion", "Suggests expansion targets", "Checks permissions before executing playbooks"],
    inputs: ["External API data (Yelp, OSM, Google)", "Manual territory assignments", "GPS coordinates"],
    outputs: ["Verified store leads", "Territory scores", "Expansion recommendations", "Promoted store_master records"],
    successMetrics: ["Discovery → promotion rate", "Territory domination score", "New stores verified/week"],
    connections: ["Feeds verified stores to Floor 1 (CRM)", "Feeds leads to Floor 2 (Dialer)", "Reports expansion data to Penthouse"],
    warRoomSignals: ["Active territories", "Pending verifications", "Discovery pipeline size"],
  },
  {
    id: "floor1", name: "Floor 1 — CRM & Store Master", icon: Users, color: "text-blue-500",
    category: "Grabba Floors",
    purpose: "Central relationship management. Every store, contact, and customer interaction lives here.",
    coreFunction: "Manage store relationships, track contacts, handle follow-ups, maintain payment terms, monitor store health across all brands.",
    systems: ["Store Master", "Contact Manager", "Follow-Up Engine", "Store Performance Tracker", "Brand Relationship Manager", "Customer Import/Export"],
    userActions: ["Add/edit stores & contacts", "Schedule follow-ups", "Review store performance", "Import bulk contacts", "Manage payment terms"],
    aiRole: ["Auto-scores store health", "Suggests follow-up timing", "Detects inactive accounts", "Enriches contact profiles"],
    inputs: ["Territory discoveries (Floor 0)", "Call outcomes (Floor 2)", "Order history (Floor 5)", "Delivery data (Floor 4)"],
    outputs: ["Call lists to Floor 2", "Order references to Floor 5", "Store intel to Penthouse", "VA task assignments"],
    successMetrics: ["Active store count", "Contact coverage %", "Follow-up completion rate", "Store retention rate"],
    connections: ["Receives stores from Floor 0", "Feeds call lists to Floor 2", "Sends order data to Floor 5", "Reports to Penthouse"],
    warRoomSignals: ["Total active stores", "Stores needing follow-up", "New contacts added today"],
  },
  {
    id: "floor2", name: "Floor 2 — Communication Hub", icon: Phone, color: "text-green-500",
    category: "Grabba Floors",
    purpose: "All outbound and inbound communication. Calls, SMS, email, AI agents — everything routes through here.",
    coreFunction: "Execute outbound call campaigns, manage AI voice agents, handle SMS/email, maintain unified inbox, run predictive dialer.",
    systems: ["Predictive Dialer", "AI Voice Agents (ElevenLabs/Polly)", "SMS Engine (Twilio/BizText)", "Unified Inbox", "Campaign Manager", "Call Recording & Transcription", "Live Call Monitor"],
    userActions: ["Launch call campaigns", "Monitor live calls", "Review transcripts", "Send SMS blasts", "Manage conversation threads"],
    aiRole: ["Handles autonomous calls", "Real-time sentiment analysis", "Dynamic script generation", "Voicemail detection", "Auto follow-up scheduling"],
    inputs: ["Call lists from Floor 1", "Lead heat scores", "Campaign configurations", "AI personality profiles"],
    outputs: ["Call outcomes & transcripts", "SMS delivery confirmations", "Updated CRM records", "Follow-up tasks", "Conversation intelligence"],
    successMetrics: ["Calls per day", "Answer rate", "Conversion rate", "Avg call duration", "SMS delivery rate"],
    connections: ["Receives leads from Floor 1 & Brandaro", "Sends outcomes to Floor 1 (CRM)", "Feeds transcripts to Floor 9 (AI Learning)", "Reports to Penthouse"],
    warRoomSignals: ["Active calls", "Calls completed today", "Answer rate", "Queue depth"],
  },
  {
    id: "floor3", name: "Floor 3 — Inventory Engine", icon: Package, color: "text-orange-500",
    category: "Grabba Floors",
    purpose: "Procurement, stock management, and supply chain intelligence for all physical products.",
    coreFunction: "Track inventory levels, manage suppliers, process purchase orders, predict demand, prevent stockouts.",
    systems: ["Inventory Tracker", "Supplier Manager", "Purchase Order System", "Demand Predictor", "Stock Alert Engine", "Warehouse Brain"],
    userActions: ["Check stock levels", "Create purchase orders", "Manage suppliers", "Review demand forecasts", "Process receiving"],
    aiRole: ["Predicts demand patterns", "Suggests reorder points", "Optimizes supplier selection", "Alerts on anomalies"],
    inputs: ["Sales data (Floor 5)", "Delivery confirmations (Floor 4)", "Supplier catalogs", "Historical demand data"],
    outputs: ["Purchase orders", "Stock alerts", "Demand forecasts", "Supplier payments to Floor 5"],
    successMetrics: ["Stockout rate", "Inventory turnover", "Order accuracy", "Supplier lead time"],
    connections: ["Receives sales data from Floor 5", "Sends delivery requests to Floor 4", "Reports costs to Penthouse"],
    warRoomSignals: ["Low stock alerts", "Pending POs", "Inventory value"],
  },
  {
    id: "floor4", name: "Floor 4 — Delivery & Routing", icon: Truck, color: "text-teal-500",
    category: "Grabba Floors",
    purpose: "Last-mile logistics. Manage drivers, optimize routes, track deliveries in real-time.",
    coreFunction: "Assign deliveries to drivers, optimize multi-stop routes, track live GPS, manage driver payouts, handle proof of delivery.",
    systems: ["Route Optimizer", "Live Map", "Driver Management", "Biker Payouts", "Delivery Capacity Planner", "Route Ops Center"],
    userActions: ["Assign routes", "Monitor live deliveries", "Review driver performance", "Process delivery payouts", "Handle delivery exceptions"],
    aiRole: ["Optimizes route sequences", "Predicts delivery windows", "Detects route anomalies", "Suggests capacity adjustments"],
    inputs: ["Orders from Floor 5", "Inventory from Floor 3", "Driver availability", "GPS data"],
    outputs: ["Delivery confirmations", "Driver payouts to Floor 5", "Route performance data", "Customer delivery updates"],
    successMetrics: ["On-time delivery %", "Cost per delivery", "Route efficiency score", "Driver utilization"],
    connections: ["Receives orders from Floor 5", "Receives stock from Floor 3", "Sends payouts to Floor 5", "Reports to Penthouse"],
    warRoomSignals: ["Active deliveries", "Drivers on road", "Delayed deliveries"],
  },
  {
    id: "floor5", name: "Floor 5 — Finance & Orders", icon: DollarSign, color: "text-emerald-500",
    category: "Grabba Floors",
    purpose: "The financial backbone. Every dollar in, every dollar out, every invoice, every payout flows through here.",
    coreFunction: "Process orders, generate invoices, track payments, manage payroll, maintain accounting ledger, handle billing.",
    systems: ["Order Management", "Invoice Generator", "Payment Tracker", "Payroll Manager", "Accounting Ledger", "Billing Center", "Unpaid Accounts"],
    userActions: ["Create/review orders", "Generate invoices", "Process payments", "Run payroll", "Review P&L", "Chase unpaid accounts"],
    aiRole: ["Detects payment anomalies", "Predicts cash flow", "Flags margin deviations", "Auto-generates financial reports"],
    inputs: ["Orders from all channels", "Delivery confirmations (Floor 4)", "Employee hours", "Commission data (Floor 8)"],
    outputs: ["Invoices", "Payment confirmations", "Payroll runs", "Financial reports to Penthouse", "Commission payouts"],
    successMetrics: ["Revenue collected", "Days Sales Outstanding", "Invoice accuracy", "Payroll on-time rate"],
    connections: ["Receives orders from Floor 1/7", "Sends payouts to Floor 4/8", "Reports financials to Penthouse"],
    warRoomSignals: ["Daily revenue", "Outstanding invoices", "Cash flow status"],
  },
  {
    id: "floor6", name: "Floor 6 — Production", icon: Factory, color: "text-violet-500",
    category: "Grabba Floors",
    purpose: "Manufacturing and production operations. Track raw materials, production runs, quality control, and output.",
    coreFunction: "Manage production schedules, track material usage, monitor quality, predict supply needs, optimize throughput.",
    systems: ["Production Scheduler", "Material Tracker", "Quality Control", "Supply Predictor", "Output Dashboard"],
    userActions: ["Schedule production runs", "Log material usage", "Record quality checks", "Review output metrics"],
    aiRole: ["Predicts supply shortages", "Optimizes production schedules", "Detects quality anomalies"],
    inputs: ["Demand forecasts (Floor 3)", "Raw material inventory", "Order backlog (Floor 5)"],
    outputs: ["Finished goods to Floor 3", "Production costs to Floor 5", "Quality reports"],
    successMetrics: ["Units produced/day", "Defect rate", "Material waste %", "Production uptime"],
    connections: ["Receives demand from Floor 3", "Sends finished goods to Floor 3", "Reports costs to Floor 5"],
    warRoomSignals: ["Production status", "Quality alerts", "Output vs target"],
  },
  {
    id: "floor7", name: "Floor 7 — Wholesale Marketplace", icon: ShoppingBag, color: "text-pink-500",
    category: "Grabba Floors",
    purpose: "B2B and B2C marketplace platform. Stores order products, wholesale fulfillment, and marketplace operations.",
    coreFunction: "Run the online marketplace, process wholesale orders, manage product catalog, handle fulfillment, track marketplace metrics.",
    systems: ["Product Catalog", "Marketplace Orders", "Wholesale Fulfillment", "Shipping Label Generator", "Settlement Processor", "Store Order Portal"],
    userActions: ["Manage product listings", "Process orders", "Handle fulfillment", "Generate shipping labels", "Review settlements"],
    aiRole: ["Recommends pricing", "Predicts demand by product", "Auto-processes settlements", "Suggests product bundles"],
    inputs: ["Product inventory (Floor 3)", "Store orders", "Customer orders", "Shipping data"],
    outputs: ["Fulfilled orders", "Settlements to Floor 5", "Delivery requests to Floor 4", "Marketplace analytics"],
    successMetrics: ["GMV", "Order fulfillment rate", "Average order value", "Settlement accuracy"],
    connections: ["Receives inventory from Floor 3", "Sends orders to Floor 4", "Sends settlements to Floor 5", "Shared schema with Marketplace Hub"],
    warRoomSignals: ["Active orders", "GMV today", "Pending fulfillment"],
  },
  {
    id: "floor8", name: "Floor 8 — Ambassadors & Influencers", icon: HeartHandshake, color: "text-rose-500",
    category: "Grabba Floors",
    purpose: "Affiliate marketing, ambassador management, influencer campaigns, and referral tracking.",
    coreFunction: "Recruit and manage ambassadors, track referral clicks/conversions, process commissions, run influencer campaigns.",
    systems: ["Ambassador Portal", "Affiliate Click Tracker", "Commission Calculator", "Influencer Campaign Manager", "Payout System", "Ambassador Leaderboard"],
    userActions: ["Recruit ambassadors", "Review referral performance", "Approve commissions", "Launch influencer campaigns", "Process payouts"],
    aiRole: ["Scores ambassador performance", "Suggests commission tiers", "Identifies top performers", "Predicts campaign ROI"],
    inputs: ["Referral clicks", "Conversion events", "Campaign configurations", "Sales data (Floor 5)"],
    outputs: ["Commission payouts to Floor 5", "Ambassador performance reports", "Campaign analytics"],
    successMetrics: ["Active ambassadors", "Conversion rate", "Revenue from referrals", "Cost per acquisition"],
    connections: ["Sends commissions to Floor 5", "Receives sales data from Floor 5", "Reports to Penthouse"],
    warRoomSignals: ["Active ambassadors", "Referral revenue", "Pending payouts"],
  },
  {
    id: "floor9", name: "Floor 9 — AI Operations", icon: Bot, color: "text-indigo-500",
    category: "Grabba Floors",
    purpose: "The AI brain. All autonomous workers, decision engines, learning systems, and AI governance live here.",
    coreFunction: "Manage AI workers, process action queues, enforce AI constitution, run learning loops, coordinate multi-agent workflows.",
    systems: ["AI Worker Engine", "Action Queue", "Decision Engine", "AI Constitution Enforcer", "Learning Engine", "Agent Supervision", "Feedback Loop"],
    userActions: ["Review AI action queue", "Approve/reject AI decisions", "Monitor worker performance", "Configure AI policies", "Review decision logs"],
    aiRole: ["Executes approved tasks", "Learns from feedback", "Coordinates agent handoffs", "Self-monitors for drift"],
    inputs: ["Data from all floors", "Human approvals", "Feedback entries", "Policy configurations"],
    outputs: ["Executed tasks", "Decision recommendations", "Learning insights", "Performance reports to Penthouse"],
    successMetrics: ["Task completion rate", "Decision accuracy", "Human override rate", "Learning velocity"],
    connections: ["Serves all floors", "Governed by Security", "Reports to Penthouse", "Learns from Floor 2 transcripts"],
    warRoomSignals: ["Active workers", "Queue depth", "Decision accuracy", "Override rate"],
  },

  // ── Brand Systems ──
  {
    id: "brandaro", name: "Brandaro Digital Floor", icon: Megaphone, color: "text-red-600",
    category: "Brand Systems",
    purpose: "Automated digital marketing agency OS. AI-powered lead generation, website building, SEO, ads, and closing at scale.",
    coreFunction: "Generate leads via ads/SEO, qualify via AI calls/SMS, close deals with AI closing psychology, manage client websites, track revenue.",
    systems: ["War Room", "VA Dashboard", "Closer AI", "Personality Engine", "Closing Psychology", "Revenue Autopilot", "Global Scaling", "Competitor Takeover", "Ads Engine", "SEO Engine", "Learning Engine", "Domination Layer"],
    userActions: ["Monitor war room", "Launch campaigns", "Review call recordings", "Manage client sites", "Track revenue per client"],
    aiRole: ["Autonomous lead qualification", "Dynamic personality switching", "Real-time objection handling", "Self-evolving closer personas", "Competitor analysis"],
    inputs: ["Inbound leads", "Ad traffic", "Organic search traffic", "Client data", "Competitor intel"],
    outputs: ["Closed deals", "Client websites", "Revenue reports", "Learning data", "Market intelligence"],
    successMetrics: ["MRR", "Close rate", "Cost per acquisition", "Client retention", "Revenue per lead"],
    connections: ["Uses Floor 2 for calls/SMS", "Uses Floor 9 for AI workers", "Reports to Penthouse", "Feeds learning to personality evolution"],
    warRoomSignals: ["Revenue", "Active calls", "Hot leads", "Close rate", "AI persona performance"],
  },
  {
    id: "gasmask", name: "GasMask OS", icon: Building, color: "text-slate-500",
    category: "Brand Systems",
    purpose: "Operating system for the GasMask brand vertical. Product sales, store distribution, and brand-specific operations.",
    coreFunction: "Manage GasMask product line, store distribution, brand-specific CRM relationships, and vertical performance tracking.",
    systems: ["Brand Dashboard", "Store Relationships", "Product Catalog", "Sales Tracking", "Distribution Network"],
    userActions: ["Track brand sales", "Manage store accounts", "Review distribution", "Monitor brand KPIs"],
    aiRole: ["Predicts demand by region", "Scores store relationships", "Suggests distribution optimization"],
    inputs: ["Store orders", "Inventory data (Floor 3)", "Territory data (Floor 0)"],
    outputs: ["Brand revenue to Floor 5", "Reorder signals to Floor 3", "Brand KPIs to Penthouse"],
    successMetrics: ["Brand revenue", "Store penetration", "Reorder rate", "Brand growth %"],
    connections: ["Uses Floor 1 for CRM", "Uses Floor 3 for inventory", "Uses Floor 5 for billing", "Reports to Penthouse"],
    warRoomSignals: ["Brand revenue", "Active stores", "Top products"],
  },
  {
    id: "realestate", name: "Real Estate OS", icon: Home, color: "text-amber-600",
    category: "Brand Systems",
    purpose: "Real estate investment and wholesaling operations. Lead acquisition, deal pipeline, and investor management.",
    coreFunction: "Source motivated sellers, manage acquisition pipeline, connect with buyers, track assignments, analyze deals.",
    systems: ["Lead Pipeline", "Acquisitions Tracker", "Investor Network", "Deal Analyzer", "Assignment Fee Optimizer", "P&L Dashboard"],
    userActions: ["Source leads", "Analyze deals", "Submit offers", "Manage buyer list", "Track closings"],
    aiRole: ["Scores deal potential", "Predicts ARV", "Matches leads to buyers", "Optimizes assignment fees"],
    inputs: ["Property leads", "Market data", "Buyer preferences", "Comparable sales"],
    outputs: ["Closed assignments", "Assignment fees to Floor 5", "Investor reports"],
    successMetrics: ["Deals closed/month", "Avg assignment fee", "Lead-to-close ratio", "Total revenue"],
    connections: ["Uses Floor 2 for seller/buyer outreach", "Sends revenue to Floor 5", "Reports to Penthouse"],
    warRoomSignals: ["Active deals", "Pipeline value", "Assignments closed"],
  },

  // ── AI Systems ──
  {
    id: "ai-conversation", name: "AI Conversation Engine", icon: Brain, color: "text-purple-600",
    category: "AI Systems",
    purpose: "Real-time conversational AI that powers all live interactions — calls, SMS, and chat with dynamic personality and emotion awareness.",
    coreFunction: "Generate contextual responses, detect emotions, select optimal personality, handle objections, drive conversions in real-time.",
    systems: ["Live Script Engine", "Emotion Detector", "Personality Selector", "Objection Handler", "Context Memory", "Closing Psychology"],
    userActions: ["Monitor live conversations", "Review AI responses", "Adjust personality settings", "Train on new objections"],
    aiRole: ["Full autonomous conversation management", "Real-time emotion detection", "Dynamic personality switching", "Objection neutralization"],
    inputs: ["Live transcript chunks", "Lead context", "Emotion signals", "Historical patterns"],
    outputs: ["AI responses", "Emotion timeline", "Personality switches", "Close signals", "Learning data"],
    successMetrics: ["Response accuracy", "Emotion detection confidence", "Close rate", "Objection win rate"],
    connections: ["Powers Floor 2 calls/SMS", "Powers Brandaro outreach", "Feeds Floor 9 learning", "Uses personality evolution data"],
    warRoomSignals: ["Active conversations", "Avg confidence", "Emotion distribution"],
  },
  {
    id: "ai-evolution", name: "Personality Evolution Engine", icon: Star, color: "text-yellow-500",
    category: "AI Systems",
    purpose: "Self-improving AI closer system. Breeds, tests, ranks, and evolves sales personalities based on real performance data.",
    coreFunction: "Track personality performance, evolve top performers, auto-generate new hybrids, run A/B tests, manage personality lifecycle.",
    systems: ["Performance Tracker", "Evolution Engine", "Auto-Generation", "A/B Testing", "Ranking System", "Lifecycle Manager"],
    userActions: ["Review personality rankings", "Trigger evolution cycles", "Monitor A/B tests", "Retire underperformers"],
    aiRole: ["Autonomous trait extraction", "Crossover breeding of winners", "Auto-promotion/retirement", "Continuous optimization"],
    inputs: ["Call outcomes", "Conversion data", "Objection win rates", "Revenue per personality"],
    outputs: ["Evolved personalities", "New personality variants", "Performance rankings", "A/B test results"],
    successMetrics: ["Top personality close rate", "Evolution improvement %", "New personality survival rate"],
    connections: ["Feeds personalities to AI Conversation Engine", "Uses Floor 2 call data", "Reports to Brandaro War Room"],
    warRoomSignals: ["Top personalities", "Active A/B tests", "Evolution cycle results"],
  },

  // ── Workforce ──
  {
    id: "hr", name: "HR & Workforce", icon: Briefcase, color: "text-sky-500",
    category: "Workforce",
    purpose: "Human resource management. Hiring, onboarding, employee tracking, documents, and payroll administration.",
    coreFunction: "Manage full employee lifecycle — recruiting, onboarding, performance tracking, document management, payroll processing.",
    systems: ["Applicant Tracker", "Onboarding System", "Employee Directory", "Document Manager", "Interview Scheduler", "Payroll Integration"],
    userActions: ["Post jobs", "Review applicants", "Onboard new hires", "Manage employee records", "Process payroll"],
    aiRole: ["Screens applicants", "Suggests interview questions", "Flags compliance issues", "Predicts turnover risk"],
    inputs: ["Job applications", "Employee data", "Time records", "Performance reviews"],
    outputs: ["Hire decisions", "Onboarding tasks", "Payroll data to Floor 5", "Compliance reports"],
    successMetrics: ["Time to hire", "Onboarding completion rate", "Employee retention", "Payroll accuracy"],
    connections: ["Sends payroll to Floor 5", "Feeds VA assignments to Brandaro", "Reports headcount to Penthouse"],
    warRoomSignals: ["Active employees", "Open positions", "Pending onboarding"],
  },
  {
    id: "va-workforce", name: "VA Operations", icon: Users, color: "text-lime-500",
    category: "Workforce",
    purpose: "Virtual Assistant management, task assignment, performance tracking, and quality assurance for remote workers.",
    coreFunction: "Assign tasks to VAs, track daily performance, score call quality, manage VA leaderboards, optimize VA utilization.",
    systems: ["VA Dashboard", "Task Queue", "Performance Scorer", "Leaderboard", "Script Library", "Quality Monitor"],
    userActions: ["Assign tasks", "Review VA performance", "Listen to call recordings", "Coach underperformers", "Set daily targets"],
    aiRole: ["Auto-assigns tasks by skill", "Scores call quality", "Suggests coaching points", "Ranks VAs by performance"],
    inputs: ["Task assignments", "Call recordings", "Performance data", "Training materials"],
    outputs: ["Completed tasks", "Performance scores", "Coaching recommendations", "Leaderboard rankings"],
    successMetrics: ["Tasks completed/day", "Call quality score", "VA utilization %", "Lead conversion by VA"],
    connections: ["Receives tasks from Brandaro & Floor 1", "Uses Floor 2 for calls", "Reports to Penthouse"],
    warRoomSignals: ["Active VAs", "Tasks pending", "Top performer today"],
  },

  // ── Portals ──
  {
    id: "marketplace-portal", name: "Marketplace Hub (Public)", icon: ShoppingBag, color: "text-fuchsia-500",
    category: "Portals",
    purpose: "Customer-facing marketplace application. Public storefront sharing the canonical Supabase backend with Dynasty OS.",
    coreFunction: "Browse products, place orders, track deliveries, manage customer accounts — all on the shared database.",
    systems: ["Product Browser", "Shopping Cart", "Checkout Flow", "Order Tracking", "Customer Accounts"],
    userActions: ["Browse products", "Add to cart", "Place orders", "Track deliveries", "Manage account"],
    aiRole: ["Product recommendations", "Dynamic pricing suggestions", "Customer support chatbot"],
    inputs: ["Product catalog (Floor 7)", "Customer selections", "Payment data"],
    outputs: ["Orders to Floor 7", "Revenue to Floor 5", "Customer data to Floor 1"],
    successMetrics: ["Conversion rate", "Average order value", "Customer retention", "Cart abandonment rate"],
    connections: ["Shares schema with Floor 7", "Orders flow to Floor 4 for delivery", "Revenue flows to Floor 5"],
    warRoomSignals: ["Orders today", "Revenue", "Active shoppers"],
  },
  {
    id: "ambassador-portal", name: "Ambassador Portal", icon: HeartHandshake, color: "text-rose-400",
    category: "Portals",
    purpose: "Self-service portal for ambassadors to track referrals, commissions, and performance.",
    coreFunction: "View referral links, track clicks/conversions, monitor commissions, request payouts, access marketing materials.",
    systems: ["Referral Dashboard", "Commission Tracker", "Payout Requests", "Marketing Assets", "Performance Analytics"],
    userActions: ["Copy referral links", "Track conversions", "Request payouts", "Download marketing materials"],
    aiRole: ["Suggests best-performing content", "Predicts commission earnings", "Identifies growth opportunities"],
    inputs: ["Referral click data", "Conversion events", "Commission calculations"],
    outputs: ["Payout requests to Floor 5", "Performance data to Floor 8"],
    successMetrics: ["Clicks", "Conversions", "Commission earned", "Payout accuracy"],
    connections: ["Reads from Floor 8 data", "Payout requests to Floor 5"],
    warRoomSignals: ["Active ambassadors", "Referral revenue today"],
  },
];

const CATEGORIES = [...new Set(BLUEPRINTS.map(b => b.category))];

// ── Component ──

function BlueprintCard({ bp, expanded, onToggle }: { bp: FloorBlueprint; expanded: boolean; onToggle: () => void }) {
  const Icon = bp.icon;
  return (
    <Card className={cn("transition-all", expanded && "ring-1 ring-primary/20")}>
      <CardContent className="p-0">
        <button onClick={onToggle} className="w-full p-4 flex items-center justify-between text-left">
          <div className="flex items-center gap-3">
            <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", bp.color.replace("text-", "bg-") + "/10")}>
              <Icon className={cn("h-5 w-5", bp.color)} />
            </div>
            <div>
              <p className="font-semibold text-sm">{bp.name}</p>
              <p className="text-xs text-muted-foreground line-clamp-1">{bp.purpose}</p>
            </div>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {expanded && (
          <div className="px-4 pb-4 space-y-4 border-t pt-4">
            {/* Purpose & Core Function */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Section title="🎯 Purpose" items={[bp.purpose]} />
              <Section title="⚙️ Core Function" items={[bp.coreFunction]} />
            </div>

            {/* Systems & Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <TagSection title="🔧 Key Systems" items={bp.systems} color="bg-primary/10 text-primary" />
              <TagSection title="👤 User Actions" items={bp.userActions} color="bg-blue-500/10 text-blue-600" />
            </div>

            {/* AI & Automation */}
            <Section title="🤖 AI / Automation Role" items={bp.aiRole} />

            {/* I/O */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FlowSection title="📥 Inputs" items={bp.inputs} icon={ArrowRight} color="text-green-500" />
              <FlowSection title="📤 Outputs" items={bp.outputs} icon={ArrowLeft} color="text-orange-500" />
            </div>

            {/* Metrics & Connections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <TagSection title="📊 Success Metrics" items={bp.successMetrics} color="bg-emerald-500/10 text-emerald-600" />
              <Section title="🔗 Floor Connections" items={bp.connections} />
            </div>

            {/* War Room */}
            <TagSection title="🖥️ War Room Signals" items={bp.warRoomSignals} color="bg-red-500/10 text-red-600" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="bg-muted/30 rounded-lg p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{title}</p>
      <div className="space-y-1">
        {items.map((item, i) => (
          <p key={i} className="text-xs">{item}</p>
        ))}
      </div>
    </div>
  );
}

function TagSection({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <div className="bg-muted/30 rounded-lg p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <Badge key={i} variant="outline" className={cn("text-[10px] border-0", color)}>{item}</Badge>
        ))}
      </div>
    </div>
  );
}

function FlowSection({ title, items, icon: Icon, color }: { title: string; items: string[]; icon: any; color: string }) {
  return (
    <div className="bg-muted/30 rounded-lg p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{title}</p>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Icon className={cn("h-3 w-3 shrink-0", color)} />
            <span className="text-xs">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FloorBlueprint() {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("all");

  const filtered = BLUEPRINTS.filter(bp => {
    const matchesSearch = !search || bp.name.toLowerCase().includes(search.toLowerCase()) || bp.purpose.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === "all" || bp.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          🏢 Dynasty OS — Floor Blueprint
        </h1>
        <p className="text-sm text-muted-foreground">
          Complete operational blueprint for every floor, system, and unit — {BLUEPRINTS.length} sections defined
        </p>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search floors, systems, or purpose..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto">
          <Button size="sm" variant={activeCategory === "all" ? "default" : "outline"} onClick={() => setActiveCategory("all")} className="text-xs shrink-0">
            All ({BLUEPRINTS.length})
          </Button>
          {CATEGORIES.map(cat => (
            <Button key={cat} size="sm" variant={activeCategory === cat ? "default" : "outline"} onClick={() => setActiveCategory(cat)} className="text-xs shrink-0">
              {cat} ({BLUEPRINTS.filter(b => b.category === cat).length})
            </Button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-primary">{BLUEPRINTS.length}</p>
            <p className="text-[10px] text-muted-foreground">Total Sections</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-blue-500">{BLUEPRINTS.reduce((s, b) => s + b.systems.length, 0)}</p>
            <p className="text-[10px] text-muted-foreground">Total Systems</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-green-500">{BLUEPRINTS.reduce((s, b) => s + b.successMetrics.length, 0)}</p>
            <p className="text-[10px] text-muted-foreground">Success Metrics</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-purple-500">{CATEGORIES.length}</p>
            <p className="text-[10px] text-muted-foreground">Categories</p>
          </CardContent>
        </Card>
      </div>

      {/* Blueprints */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">No floors match your search</CardContent></Card>
        ) : filtered.map(bp => (
          <BlueprintCard
            key={bp.id}
            bp={bp}
            expanded={expandedId === bp.id}
            onToggle={() => setExpandedId(expandedId === bp.id ? null : bp.id)}
          />
        ))}
      </div>
    </div>
  );
}
