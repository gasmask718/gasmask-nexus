import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, CheckCircle, ExternalLink, Loader2, Star } from 'lucide-react';
import { toast } from 'sonner';
import AccountNotesPanel from '@/components/funding/AccountNotesPanel';

const PLAYBOOK_STEPS = [
  {
    step: 1,
    title: 'Purchase the Right Shelf Corp',
    details: `Best states: Wyoming (privacy, no state tax), New Mexico (anonymous, cheap), Delaware (credibility).
Minimum age for funding: 2 years preferred, 1 year acceptable at some lenders.
What to verify before buying: Is the EIN clean (no IRS issues)? Are annual reports filed and current? Any liens or judgments?
Cost range: $300–$2,000 depending on age and state.
⚠️ Red flags: vendors who claim "credit history included" — shelf corps do not have real credit history, only age.`,
  },
  {
    step: 2,
    title: 'Post-Purchase Activation',
    details: `• File any pending annual reports (check Secretary of State website for your state)
• Update registered agent to your name or a registered agent service
• Obtain EIN if not included (IRS Form SS-4, free, online, 1 day)
• Open business checking account immediately
  Requirements: EIN, Articles of Incorporation, Operating Agreement
  Best banks: Mercury, Relay, Bluevine, Chase Business, Bank of America Business`,
  },
  {
    step: 3,
    title: 'Build Business Identity',
    details: `• Get a physical or virtual business address (NOT a PO Box — use Regus, iPostal, or Alliance Virtual)
• Get a business phone number (Google Voice or Grasshopper)
• Register with Dun & Bradstreet (get DUNS number — free)
• Register with Experian Business and Equifax Business
• Verify business on Google Business Profile
• Build a basic website (even 1 page is enough for lenders)`,
  },
  {
    step: 4,
    title: 'Establish Trade References (Net-30 Accounts)',
    details: `Open 3–5 net-30 vendor accounts immediately — these report to business bureaus.
Starter vendors that approve new/shelf corps:
• Uline • Quill • Grainger • Crown Office Supplies • Summa Office Supplies • The CEO Creative • Nav
Each account: spend $50–$200, pay on net-30 terms, report shows in 30–60 days.
Target: 3 trade references reporting before applying for business credit cards or loans.`,
  },
  {
    step: 5,
    title: 'Business Credit Cards (30–60 Days After Trade Lines)',
    details: `Apply for starter business cards that don't require personal guarantee when possible.
Best starter cards for shelf corps: Divvy, Ramp, Brex (revenue-based), Bill.com Divvy
After 3 trade lines: apply for Tier 2 cards — Capital One Spark, Chase Ink, Amex Blue Business`,
  },
  {
    step: 6,
    title: 'Apply for Funding',
    details: `With 2-year corp + EIN + bank account + 3 trade lines reporting: qualify for $5K–$25K unsecured
With 2-year corp + 6 months bank statements + $10K/month revenue: qualify for $25K–$150K
Best lenders for shelf corps:
• Bluevine (revenue-based LOC) • Fundbox • OnDeck • Credibly • Reliant Funding
Credit unions that accept shelf corps:
• PenFed Business • Alliant Business • Navy Federal Business (requires 1 year)`,
  },
];

export default function ShelfCorpPage() {
  const queryClient = useQueryClient();
  const [expandedStep, setExpandedStep] = useState<number | null>(1);

  const { data: vendors = [], isLoading: vendorsLoading } = useQuery({
    queryKey: ['shelf-corp-vendors'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shelf_corp_vendors' as any).select('*').order('cost_efficiency_score', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: trackers = [], isLoading: trackersLoading } = useQuery({
    queryKey: ['shelf-corp-trackers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shelf_corp_tracker' as any).select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Building2 className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Shelf Corp Command Center</h1>
          <p className="text-sm text-muted-foreground">Vendor directory, activation playbook, and client tracking</p>
        </div>
      </div>

      <Tabs defaultValue="vendors">
        <TabsList>
          <TabsTrigger value="vendors">Vendor Directory</TabsTrigger>
          <TabsTrigger value="playbook">Activation Playbook</TabsTrigger>
          <TabsTrigger value="tracker">Client Trackers</TabsTrigger>
        </TabsList>

        {/* VENDORS TAB */}
        <TabsContent value="vendors" className="space-y-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Price Range</TableHead>
                  <TableHead>Ages Available</TableHead>
                  <TableHead>States</TableHead>
                  <TableHead>Includes EIN</TableHead>
                  <TableHead>Turnaround</TableHead>
                  <TableHead>Efficiency</TableHead>
                  <TableHead>Trust</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendorsLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
                ) : vendors.map((v: any) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{v.vendor_name}</span>
                        {v.website_url && (
                          <a href={v.website_url} target="_blank" rel="noopener"><ExternalLink className="h-3 w-3 text-muted-foreground" /></a>
                        )}
                        {v.verified && <CheckCircle className="h-3 w-3 text-emerald-400" />}
                      </div>
                    </TableCell>
                    <TableCell>${v.price_range_min?.toLocaleString()}–${v.price_range_max?.toLocaleString()}</TableCell>
                    <TableCell>{v.corp_age_years_available}</TableCell>
                    <TableCell>{v.states_offered?.join(', ')}</TableCell>
                    <TableCell>{v.includes_ein ? '✅' : '❌'}</TableCell>
                    <TableCell>{v.turn_around_days} days</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-amber-400" />
                        <span className="text-sm font-medium">{v.cost_efficiency_score}/10</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={v.trust_score >= 7 ? 'bg-emerald-500/20 text-emerald-400' : v.trust_score >= 5 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}>
                        {v.trust_score}/10
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* PLAYBOOK TAB */}
        <TabsContent value="playbook" className="space-y-4">
          <div className="space-y-3">
            {PLAYBOOK_STEPS.map((s) => (
              <Card key={s.step} className={`cursor-pointer transition-all ${expandedStep === s.step ? 'border-primary/50' : 'border-border/30'}`}
                onClick={() => setExpandedStep(expandedStep === s.step ? null : s.step)}>
                <CardHeader className="py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                      {s.step}
                    </div>
                    <CardTitle className="text-sm">{s.title}</CardTitle>
                  </div>
                </CardHeader>
                {expandedStep === s.step && (
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{s.details}</p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* TRACKER TAB */}
        <TabsContent value="tracker" className="space-y-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Age at Purchase</TableHead>
                  <TableHead>Current Step</TableHead>
                  <TableHead>EIN</TableHead>
                  <TableHead>Bank Open</TableHead>
                  <TableHead>Trade Lines</TableHead>
                  <TableHead>Biz Credit Cards</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trackersLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
                ) : trackers.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No shelf corp trackers yet. Add one from a client profile.</TableCell></TableRow>
                ) : trackers.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.vendor_purchased_from || '—'}</TableCell>
                    <TableCell>{t.state_of_formation || '—'}</TableCell>
                    <TableCell>{t.corp_age_at_purchase ? `${t.corp_age_at_purchase}yr` : '—'}</TableCell>
                    <TableCell>
                      <Badge className="bg-primary/20 text-primary">
                        Step {t.activation_step_current}/6
                      </Badge>
                    </TableCell>
                    <TableCell>{t.ein || '—'}</TableCell>
                    <TableCell>{t.bank_account_opened ? `✅ ${t.bank_name || ''}` : '❌'}</TableCell>
                    <TableCell>{t.trade_lines_count || 0}</TableCell>
                    <TableCell>{t.business_credit_cards_count || 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
