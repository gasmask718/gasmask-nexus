import { useState } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Wallet, CreditCard, DollarSign, PiggyBank, TrendingUp, 
  TrendingDown, Plus, Calendar, ShoppingBag, Utensils, 
  Car, Home, Smartphone, Coffee, RefreshCw
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFinancialEngine, useNetWorth } from '@/hooks/useFinancialEngine';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const EXPENSE_CATEGORIES = [
  { value: 'food', label: 'Food & Dining', icon: Utensils },
  { value: 'shopping', label: 'Shopping', icon: ShoppingBag },
  { value: 'transportation', label: 'Transportation', icon: Car },
  { value: 'housing', label: 'Housing & Rent', icon: Home },
  { value: 'utilities', label: 'Utilities', icon: Smartphone },
  { value: 'entertainment', label: 'Entertainment', icon: Coffee },
  { value: 'other', label: 'Other', icon: DollarSign },
];

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'debit', label: 'Debit Card' },
  { value: 'credit', label: 'Credit Card' },
  { value: 'cashapp', label: 'CashApp' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'applepay', label: 'Apple Pay' },
];

export default function PersonalFinance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { addPersonalTransaction, isLoading } = useFinancialEngine();
  const { data: netWorthData } = useNetWorth(user?.id || '');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newExpense, setNewExpense] = useState({
    amount: '',
    category: '',
    description: '',
    payment_method: 'cash',
    merchant: '',
  });

  const handleAddExpense = () => {
    if (!user?.id || !newExpense.amount || !newExpense.category) {
      toast({ title: 'Please fill in required fields', variant: 'destructive' });
      return;
    }

    addPersonalTransaction({
      user_id: user.id,
      transaction_date: new Date().toISOString().split('T')[0],
      amount: parseFloat(newExpense.amount),
      transaction_type: 'expense',
      category: newExpense.category,
      description: newExpense.description,
      payment_method: newExpense.payment_method,
      merchant: newExpense.merchant,
    });

    setNewExpense({
      amount: '',
      category: '',
      description: '',
      payment_method: 'cash',
      merchant: '',
    });
    setDialogOpen(false);
  };

  const latestNetWorth = netWorthData?.[0];

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Personal Finance</h1>
            <p className="text-muted-foreground">Track your personal spending and wealth</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Expense
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Personal Expense</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Amount *</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="0.00"
                      className="pl-10"
                      value={newExpense.amount}
                      onChange={(e) => setNewExpense(prev => ({ ...prev, amount: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select 
                    value={newExpense.category}
                    onValueChange={(value) => setNewExpense(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select 
                    value={newExpense.payment_method}
                    onValueChange={(value) => setNewExpense(prev => ({ ...prev, payment_method: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map(method => (
                        <SelectItem key={method.value} value={method.value}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Merchant (optional)</Label>
                  <Input
                    placeholder="Where did you spend?"
                    value={newExpense.merchant}
                    onChange={(e) => setNewExpense(prev => ({ ...prev, merchant: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Input
                    placeholder="What was this for?"
                    value={newExpense.description}
                    onChange={(e) => setNewExpense(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>

                <Button 
                  className="w-full" 
                  onClick={handleAddExpense}
                  disabled={isLoading}
                >
                  {isLoading ? 'Adding...' : 'Add Expense'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Net Worth</p>
                  <p className={`text-2xl font-bold ${(latestNetWorth?.net_worth || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${latestNetWorth?.net_worth?.toLocaleString() || '0'}
                  </p>
                </div>
                <div className="p-3 bg-primary/10 rounded-full">
                  <PiggyBank className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Assets</p>
                  <p className="text-2xl font-bold text-green-600">
                    ${latestNetWorth?.total_assets?.toLocaleString() || '0'}
                  </p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Liabilities</p>
                  <p className="text-2xl font-bold text-red-600">
                    ${latestNetWorth?.total_liabilities?.toLocaleString() || '0'}
                  </p>
                </div>
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                  <CreditCard className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Spending Today</p>
                  <p className="text-2xl font-bold">$0</p>
                </div>
                <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-full">
                  <Wallet className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="spending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="spending">Spending</TabsTrigger>
            <TabsTrigger value="income">Income</TabsTrigger>
            <TabsTrigger value="networth">Net Worth</TabsTrigger>
          </TabsList>

          <TabsContent value="spending">
            <Card>
              <CardHeader>
                <CardTitle>Recent Spending</CardTitle>
                <CardDescription>Your personal expenses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Wallet className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No spending recorded yet</p>
                  <p className="text-sm">Add your first expense to start tracking</p>
                  <Button variant="outline" className="mt-4" onClick={() => setDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Expense
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="income">
            <Card>
              <CardHeader>
                <CardTitle>Income Sources</CardTitle>
                <CardDescription>Track your earnings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No income recorded yet</p>
                  <p className="text-sm">Add income sources to track your earnings</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="networth">
            <Card>
              <CardHeader>
                <CardTitle>Net Worth History</CardTitle>
                <CardDescription>Track your wealth over time</CardDescription>
              </CardHeader>
              <CardContent>
                {netWorthData?.length ? (
                  <div className="space-y-3">
                    {netWorthData.map((snapshot) => (
                      <div key={snapshot.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{format(new Date(snapshot.snapshot_date), 'MMM d, yyyy')}</span>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${snapshot.net_worth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ${snapshot.net_worth?.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Assets: ${snapshot.total_assets?.toLocaleString()} | Debt: ${snapshot.total_liabilities?.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <PiggyBank className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No net worth snapshots yet</p>
                    <p className="text-sm">Create your first snapshot to track wealth over time</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
