import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sparkles, Upload, Wand2, Package, FileText, Lightbulb, Loader2,
  CheckCircle2, XCircle, ArrowRight, TrendingUp, AlertTriangle, Zap,
  Brain, Eye, DollarSign, Tag
} from 'lucide-react';
import {
  useIngestionJobs, useExtractedData, useApproveExtracted,
  useAISuggestions, useDismissSuggestion, useGeneratedListings,
  useAIExtract, useAIAutoBuild, useAIGenerateListing,
  useAIGenerateSuggestions, useAIAutoPackages
} from '@/hooks/useUTAIBuilder';

interface Props { partnerId: string; category: string; }

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-destructive/10 text-destructive border-destructive/30',
  high: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  medium: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  low: 'bg-muted text-muted-foreground border-border',
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  missing_info: AlertTriangle, pricing: DollarSign, upsell: TrendingUp,
  media: Eye, content: FileText, package: Package, optimization: Zap,
};

export default function UTAIBusinessBuilder({ partnerId, category }: Props) {
  const [activeTab, setActiveTab] = useState('ingest');
  const [textInput, setTextInput] = useState('');

  const { data: jobs = [] } = useIngestionJobs(partnerId);
  const { data: extracted = [] } = useExtractedData(partnerId);
  const approveItem = useApproveExtracted();
  const { data: suggestions = [] } = useAISuggestions(partnerId);
  const dismissSugg = useDismissSuggestion();
  const { data: listings = [] } = useGeneratedListings(partnerId);

  const aiExtract = useAIExtract();
  const aiAutoBuild = useAIAutoBuild();
  const aiGenListing = useAIGenerateListing();
  const aiGenSuggestions = useAIGenerateSuggestions();
  const aiAutoPackages = useAIAutoPackages();

  const pendingItems = extracted.filter(e => e.status === 'draft' || e.status === 'approved');
  const approvedItems = extracted.filter(e => e.status === 'approved');

  const handleExtract = () => {
    if (!textInput.trim()) return;
    aiExtract.mutate({ partner_id: partnerId, content: textInput, category, input_type: 'text' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 text-primary" /> AI Business Builder
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Upload → AI Structures → You Approve → Go Live</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="text-[10px]">{pendingItems.length} pending</Badge>
          <Badge variant="outline" className="text-[10px]">{suggestions.length} suggestions</Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {[
            { id: 'ingest', label: 'Upload & Extract', icon: Upload },
            { id: 'review', label: 'Review & Approve', icon: CheckCircle2 },
            { id: 'actions', label: 'AI Actions', icon: Wand2 },
            { id: 'insights', label: 'AI Insights', icon: Lightbulb },
            { id: 'listing', label: 'Listing Preview', icon: Eye },
          ].map(t => (
            <TabsTrigger key={t.id} value={t.id} className="text-xs gap-1.5">
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ═══ UPLOAD & EXTRACT ═══ */}
        <TabsContent value="ingest" className="space-y-4 mt-4">
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Paste Your Content
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Paste your menu, pricing sheet, service list, or any business description. AI will extract and structure everything automatically.
              </p>
              <Textarea
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                rows={6}
                placeholder={`Example:\n\nWedding Menu - $85/person\nAppetizers: Bruschetta, Shrimp Cocktail, Caprese\nEntrees: Filet Mignon ($12 upgrade), Salmon, Chicken Marsala\nDesserts: Tiramisu, Cheesecake\n\nPackages:\nBasic - $65/person (3 apps, 2 entrees, 1 dessert)\nPremium - $95/person (full menu, open bar, staff)`}
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button onClick={handleExtract} disabled={aiExtract.isPending || !textInput.trim()}>
                  {aiExtract.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  Extract with AI
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Jobs */}
          {jobs.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Extractions</h4>
              {jobs.slice(0, 5).map(job => (
                <div key={job.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-card">
                  <div className="flex items-center gap-2">
                    <Badge variant={job.status === 'completed' ? 'default' : job.status === 'failed' ? 'destructive' : 'secondary'} className="text-[10px]">
                      {job.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{job.input_type}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(job.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ═══ REVIEW & APPROVE ═══ */}
        <TabsContent value="review" className="space-y-4 mt-4">
          {pendingItems.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <CheckCircle2 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No items to review</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Upload content in the Extract tab to get started</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{pendingItems.length} items to review</p>
                {approvedItems.length > 0 && (
                  <Button size="sm" onClick={() => aiAutoBuild.mutate(partnerId)} disabled={aiAutoBuild.isPending}>
                    {aiAutoBuild.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5 mr-1" />}
                    Apply {approvedItems.length} Approved Items
                  </Button>
                )}
              </div>

              <ScrollArea className="h-[400px]">
                <div className="space-y-2 pr-4">
                  {pendingItems.map(item => {
                    const d = item.extracted_data as any;
                    return (
                      <Card key={item.id} className={`border-border/50 ${item.status === 'approved' ? 'border-green-500/30 bg-green-500/5' : ''}`}>
                        <CardContent className="pt-3 pb-2">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-[10px]">{item.data_type}</Badge>
                                <span className="text-[10px] text-muted-foreground">
                                  {Math.round((item.confidence_score || 0) * 100)}% confidence
                                </span>
                              </div>
                              <p className="text-sm font-medium">{d.name || d.item_name || d.title || 'Unnamed'}</p>
                              {d.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{d.description}</p>}
                              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                                {d.base_price && <Badge variant="secondary" className="text-[10px]">${d.base_price}</Badge>}
                                {d.price && <Badge variant="secondary" className="text-[10px]">${d.price}</Badge>}
                                {d.category && <Badge variant="secondary" className="text-[10px]">{d.category}</Badge>}
                                {d.tier && <Badge variant="secondary" className="text-[10px]">{d.tier}</Badge>}
                                {(d.dietary_tags || []).slice(0, 3).map((t: string) => (
                                  <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                                ))}
                              </div>
                            </div>
                            <div className="flex gap-1 ml-2 shrink-0">
                              {item.status !== 'approved' && (
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600 hover:bg-green-500/10"
                                  onClick={() => approveItem.mutate({ id: item.id, status: 'approved' })}>
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                              )}
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                onClick={() => approveItem.mutate({ id: item.id, status: 'rejected' })}>
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            </>
          )}
        </TabsContent>

        {/* ═══ AI ACTIONS ═══ */}
        <TabsContent value="actions" className="space-y-4 mt-4">
          <div className="grid gap-3 md:grid-cols-2">
            {[
              { label: 'Auto Build Packages', desc: 'AI creates 3 tiered packages from your menus', icon: Package, action: () => aiAutoPackages.mutate(partnerId), loading: aiAutoPackages.isPending },
              { label: 'Generate Listing', desc: 'AI writes your marketplace listing copy', icon: FileText, action: () => aiGenListing.mutate({ partner_id: partnerId, category }), loading: aiGenListing.isPending },
              { label: 'Get AI Suggestions', desc: 'AI analyzes your profile for improvements', icon: Lightbulb, action: () => aiGenSuggestions.mutate(partnerId), loading: aiGenSuggestions.isPending },
              { label: 'Apply Approved Items', desc: 'Push approved extracted data to your profile', icon: ArrowRight, action: () => aiAutoBuild.mutate(partnerId), loading: aiAutoBuild.isPending, disabled: approvedItems.length === 0 },
            ].map(tool => (
              <Card key={tool.label} className="cursor-pointer transition-all hover:border-primary/50 border-border/50"
                onClick={() => !tool.loading && !tool.disabled && tool.action()}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      {tool.loading ? <Loader2 className="h-5 w-5 text-primary animate-spin" /> : <tool.icon className="h-5 w-5 text-primary" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{tool.label}</p>
                      <p className="text-xs text-muted-foreground">{tool.desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ═══ AI INSIGHTS ═══ */}
        <TabsContent value="insights" className="space-y-4 mt-4">
          {suggestions.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <Lightbulb className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No active suggestions</p>
                <Button size="sm" variant="outline" className="mt-3"
                  onClick={() => aiGenSuggestions.mutate(partnerId)}
                  disabled={aiGenSuggestions.isPending}>
                  {aiGenSuggestions.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                  Generate Suggestions
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {suggestions.map(s => {
                const Icon = TYPE_ICONS[s.suggestion_type] || Lightbulb;
                const colorClass = PRIORITY_COLORS[s.priority] || PRIORITY_COLORS.medium;
                return (
                  <Card key={s.id} className={`border ${colorClass.split(' ').slice(2).join(' ')}`}>
                    <CardContent className="pt-3 pb-2">
                      <div className="flex items-start gap-3">
                        <div className={`p-1.5 rounded-md ${colorClass.split(' ')[0]}`}>
                          <Icon className={`h-4 w-4 ${colorClass.split(' ')[1]}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-medium">{s.title}</p>
                            <Badge variant="outline" className="text-[10px]">{s.priority}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{s.description}</p>
                        </div>
                        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0"
                          onClick={() => dismissSugg.mutate(s.id)}>
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ═══ LISTING PREVIEW ═══ */}
        <TabsContent value="listing" className="space-y-4 mt-4">
          {listings.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <Eye className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No listings generated yet</p>
                <Button size="sm" variant="outline" className="mt-3"
                  onClick={() => aiGenListing.mutate({ partner_id: partnerId, category })}
                  disabled={aiGenListing.isPending}>
                  {aiGenListing.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 mr-1" />}
                  Generate Listing
                </Button>
              </CardContent>
            </Card>
          ) : (
            listings.slice(0, 3).map(listing => (
              <Card key={listing.id} className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{listing.ai_title}</CardTitle>
                    <Badge variant={listing.status === 'published' ? 'default' : 'secondary'} className="text-[10px]">{listing.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{listing.ai_description}</p>

                  {Array.isArray(listing.ai_highlights) && (listing.ai_highlights as string[]).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Highlights</p>
                      <ul className="space-y-1">
                        {(listing.ai_highlights as string[]).map((h: string, i: number) => (
                          <li key={i} className="text-xs flex items-start gap-1.5">
                            <CheckCircle2 className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                            {h}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {Array.isArray(listing.ai_tags) && (listing.ai_tags as string[]).length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {(listing.ai_tags as string[]).map((t: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-[10px]">
                          <Tag className="h-2.5 w-2.5 mr-0.5" />{t}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-4 pt-2 border-t border-border/50">
                    {listing.estimated_event_value && (
                      <div className="text-center">
                        <p className="text-lg font-bold text-primary">${Number(listing.estimated_event_value).toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">Est. Event Value</p>
                      </div>
                    )}
                    {listing.upsell_score && (
                      <div className="text-center">
                        <p className="text-lg font-bold text-primary">{Math.round(Number(listing.upsell_score) * 100)}%</p>
                        <p className="text-[10px] text-muted-foreground">Upsell Score</p>
                      </div>
                    )}
                    {listing.profit_score && (
                      <div className="text-center">
                        <p className="text-lg font-bold text-primary">{Math.round(Number(listing.profit_score) * 100)}%</p>
                        <p className="text-[10px] text-muted-foreground">Profit Score</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
