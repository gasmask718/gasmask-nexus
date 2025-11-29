import { useState } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  Brain, Lightbulb, AlertTriangle, TrendingUp, TrendingDown,
  RefreshCw, Play, History, Target, DollarSign, Percent,
  ArrowRight, CheckCircle, XCircle, Zap
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  useAdvisorAdvice, 
  useScenarioSimulator, 
  useAdvisorHistory,
  useLatestAdvisorSummary,
  useUnifiedContext
} from '@/hooks/useAdvisorMind';
import { format } from 'date-fns';

export default function AdvisorPenthouse() {
  const { user } = useAuth();
  const { advice, isLoading: advisorLoading, getAdvice } = useAdvisorAdvice();
  const { scenario, isSimulating, runSimulation } = useScenarioSimulator();
  const { sessions, scenarios: savedScenarios, actions, isLoading: historyLoading } = useAdvisorHistory();
  const { data: latestSummary } = useLatestAdvisorSummary();
  const { data: context } = useUnifiedContext(user?.id);

  const [question, setQuestion] = useState('');
  const [advisorMode, setAdvisorMode] = useState<'business' | 'personal' | 'mixed'>('mixed');
  const [timeWindow, setTimeWindow] = useState('today');

  // Scenario inputs
  const [scenarioName, setScenarioName] = useState('');
  const [cutSubscriptions, setCutSubscriptions] = useState(0);
  const [increaseMarketing, setIncreaseMarketing] = useState(0);
  const [changeDriverPay, setChangeDriverPay] = useState(0);
  const [raisePrice, setRaisePrice] = useState(0);

  const handleGetAdvice = () => {
    getAdvice({
      userId: user?.id,
      question: question || undefined,
      mode: advisorMode,
      timeWindow,
    });
  };

  const handleRunSimulation = () => {
    runSimulation({
      userId: user?.id,
      scenarioName: scenarioName || 'Custom Scenario',
      inputs: {
        cut_subscription_percent: cutSubscriptions,
        increase_marketing: increaseMarketing,
        change_driver_pay_percent: changeDriverPay,
        raise_price_percent: raisePrice,
      },
    });
  };

  const getRiskBadge = (level: string) => {
    const colors: Record<string, string> = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800',
    };
    return <Badge className={colors[level] || colors.medium}>{level}</Badge>;
  };

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Brain className="h-8 w-8 text-primary" />
              Advisor Penthouse
            </h1>
            <p className="text-muted-foreground">Unified AI brain for strategy, money, and risk</p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleGetAdvice} 
              disabled={advisorLoading}
              size="lg"
            >
              {advisorLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              Generate My Next 3 Moves
            </Button>
          </div>
        </div>

        {/* Context Summary */}
        {context && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Net Profit (MTD)</p>
                    <p className={`text-xl font-bold ${context.financial.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${context.financial.netProfit.toLocaleString()}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Open Risks</p>
                    <p className="text-xl font-bold">{context.risks.total}</p>
                    <p className="text-xs text-red-500">{context.risks.critical} critical</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pending Payroll</p>
                    <p className="text-xl font-bold">${context.financial.pendingPayroll.toLocaleString()}</p>
                  </div>
                  <Target className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Insights</p>
                    <p className="text-xl font-bold">{context.activeInsights}</p>
                  </div>
                  <Lightbulb className="h-8 w-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="advisor" className="space-y-4">
          <TabsList>
            <TabsTrigger value="advisor">Ask Advisor</TabsTrigger>
            <TabsTrigger value="simulator">What Happens If...?</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          {/* Advisor Tab */}
          <TabsContent value="advisor" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Input Panel */}
              <Card>
                <CardHeader>
                  <CardTitle>Ask Your Advisor</CardTitle>
                  <CardDescription>Get strategic guidance based on all your data</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Mode</Label>
                    <Select value={advisorMode} onValueChange={(v: any) => setAdvisorMode(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="business">Business Only</SelectItem>
                        <SelectItem value="personal">Personal Only</SelectItem>
                        <SelectItem value="mixed">Mixed (Both)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Time Focus</Label>
                    <Select value={timeWindow} onValueChange={setTimeWindow}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="this_week">This Week</SelectItem>
                        <SelectItem value="this_month">This Month</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Question (optional)</Label>
                    <Textarea 
                      placeholder="What should I focus on? How do I increase profit?"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                    />
                  </div>

                  <Button 
                    className="w-full" 
                    onClick={handleGetAdvice}
                    disabled={advisorLoading}
                  >
                    {advisorLoading ? 'Analyzing...' : 'Get Advice'}
                  </Button>
                </CardContent>
              </Card>

              {/* Results Panel */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>AI Summary</CardTitle>
                    {(advice || latestSummary) && (
                      <div className="flex items-center gap-2">
                        {getRiskBadge(advice?.risk_level || latestSummary?.risk_level || 'medium')}
                        <Badge variant="outline">
                          {advice?.confidence_score || latestSummary?.confidence_score || 0}% confidence
                        </Badge>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {advice ? (
                    <div className="space-y-4">
                      <p className="text-muted-foreground">{advice.summary}</p>

                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <Target className="h-4 w-4" /> Top Actions
                        </h4>
                        <ul className="space-y-2">
                          {advice.top_actions?.map((action, i) => (
                            <li key={i} className="flex items-start gap-2 p-2 bg-muted rounded-lg">
                              <span className="font-bold text-primary">{i + 1}.</span>
                              <span>{action}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {advice.warnings?.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2 flex items-center gap-2 text-orange-600">
                            <AlertTriangle className="h-4 w-4" /> Warnings
                          </h4>
                          <ul className="space-y-1">
                            {advice.warnings.map((w, i) => (
                              <li key={i} className="text-sm text-orange-700">• {w}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {advice.opportunities?.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2 flex items-center gap-2 text-green-600">
                            <TrendingUp className="h-4 w-4" /> Opportunities
                          </h4>
                          <ul className="space-y-1">
                            {advice.opportunities.map((o, i) => (
                              <li key={i} className="text-sm text-green-700">• {o}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : latestSummary ? (
                    <div className="space-y-4">
                      <p className="text-muted-foreground">{latestSummary.ai_summary}</p>
                      {latestSummary.ai_recommendations && (
                        <ul className="space-y-2">
                          {latestSummary.ai_recommendations.map((rec: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 p-2 bg-muted rounded-lg">
                              <span className="font-bold text-primary">{i + 1}.</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Click "Get Advice" to receive AI-powered strategic guidance</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Simulator Tab */}
          <TabsContent value="simulator" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Inputs */}
              <Card>
                <CardHeader>
                  <CardTitle>Scenario Inputs</CardTitle>
                  <CardDescription>Adjust the knobs to see projected outcomes</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Scenario Name</Label>
                    <Input 
                      placeholder="e.g., Cut costs 30%"
                      value={scenarioName}
                      onChange={(e) => setScenarioName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label>Cut Subscriptions</Label>
                      <span className="text-sm font-medium">{cutSubscriptions}%</span>
                    </div>
                    <Slider 
                      value={[cutSubscriptions]} 
                      onValueChange={([v]) => setCutSubscriptions(v)}
                      max={100}
                      step={5}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label>Increase Marketing ($)</Label>
                      <span className="text-sm font-medium">${increaseMarketing}</span>
                    </div>
                    <Slider 
                      value={[increaseMarketing]} 
                      onValueChange={([v]) => setIncreaseMarketing(v)}
                      max={10000}
                      step={100}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label>Change Driver Pay</Label>
                      <span className="text-sm font-medium">{changeDriverPay > 0 ? '+' : ''}{changeDriverPay}%</span>
                    </div>
                    <Slider 
                      value={[changeDriverPay + 50]} 
                      onValueChange={([v]) => setChangeDriverPay(v - 50)}
                      max={100}
                      step={5}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label>Raise Prices</Label>
                      <span className="text-sm font-medium">{raisePrice}%</span>
                    </div>
                    <Slider 
                      value={[raisePrice]} 
                      onValueChange={([v]) => setRaisePrice(v)}
                      max={50}
                      step={1}
                    />
                  </div>

                  <Button 
                    className="w-full" 
                    onClick={handleRunSimulation}
                    disabled={isSimulating}
                  >
                    {isSimulating ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    Simulate Scenario
                  </Button>
                </CardContent>
              </Card>

              {/* Results */}
              <Card>
                <CardHeader>
                  <CardTitle>Simulation Results</CardTitle>
                </CardHeader>
                <CardContent>
                  {scenario ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-4">
                        {scenario.is_favorable ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" /> Favorable
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800">
                            <XCircle className="h-3 w-3 mr-1" /> Not Recommended
                          </Badge>
                        )}
                        <Badge variant="outline">{scenario.risk_rating} risk</Badge>
                      </div>

                      {/* Comparison */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 border rounded-lg">
                          <h4 className="font-medium mb-2 text-muted-foreground">Baseline</h4>
                          <div className="space-y-1 text-sm">
                            <p>Revenue: ${scenario.baseline_metrics.monthly_revenue.toLocaleString()}</p>
                            <p>Expenses: ${scenario.baseline_metrics.monthly_expenses.toLocaleString()}</p>
                            <p className="font-medium">Profit: ${scenario.baseline_metrics.net_profit.toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="p-4 border rounded-lg border-primary">
                          <h4 className="font-medium mb-2 text-primary">Projected</h4>
                          <div className="space-y-1 text-sm">
                            <p>Revenue: ${scenario.projected_metrics.monthly_revenue.toLocaleString()}</p>
                            <p>Expenses: ${scenario.projected_metrics.monthly_expenses.toLocaleString()}</p>
                            <p className="font-medium">Profit: ${scenario.projected_metrics.net_profit.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>

                      {/* Change indicator */}
                      <div className="flex items-center justify-center gap-2 py-2">
                        {scenario.projected_metrics.net_profit > scenario.baseline_metrics.net_profit ? (
                          <>
                            <TrendingUp className="h-5 w-5 text-green-600" />
                            <span className="text-green-600 font-medium">
                              +${(scenario.projected_metrics.net_profit - scenario.baseline_metrics.net_profit).toLocaleString()}
                            </span>
                          </>
                        ) : (
                          <>
                            <TrendingDown className="h-5 w-5 text-red-600" />
                            <span className="text-red-600 font-medium">
                              ${(scenario.projected_metrics.net_profit - scenario.baseline_metrics.net_profit).toLocaleString()}
                            </span>
                          </>
                        )}
                      </div>

                      <div className="p-4 bg-muted rounded-lg">
                        <h4 className="font-medium mb-2">AI Analysis</h4>
                        <p className="text-sm text-muted-foreground">{scenario.ai_analysis}</p>
                      </div>

                      {scenario.ai_recommendations?.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2">Recommendations</h4>
                          <ul className="space-y-1 text-sm">
                            {scenario.ai_recommendations.map((rec, i) => (
                              <li key={i}>• {rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Percent className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Adjust inputs and run a simulation to see projected outcomes</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Recent Sessions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {sessions.length > 0 ? (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {sessions.map((session) => (
                        <div key={session.id} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="outline">{session.session_type}</Badge>
                            {getRiskBadge(session.risk_level)}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">{session.ai_summary}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {format(new Date(session.created_at), 'MMM d, yyyy h:mm a')}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">No sessions yet</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Play className="h-5 w-5" />
                    Saved Scenarios
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {savedScenarios.length > 0 ? (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {savedScenarios.map((sc) => (
                        <div key={sc.id} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{sc.scenario_name}</span>
                            {sc.is_favorable ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">{sc.ai_analysis}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {format(new Date(sc.created_at), 'MMM d, yyyy')}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">No scenarios yet</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
