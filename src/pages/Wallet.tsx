import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, DollarSign, TrendingUp, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";

const WalletPage = () => {
  const { user } = useAuth();

  const { data: wallet } = useQuery({
    queryKey: ['wallet', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user?.id!)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: transactions } = useQuery({
    queryKey: ['wallet-transactions', wallet?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('wallet_id', wallet?.id!)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
    enabled: !!wallet?.id,
  });

  return (
    <Layout>
      <div className="container mx-auto p-6 max-w-5xl">
        <div className="flex items-center gap-3 mb-6">
          <Wallet className="h-8 w-8" />
          <div>
            <h1 className="text-3xl font-bold">My Wallet</h1>
            <p className="text-muted-foreground">Manage your earnings and payouts</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <div className="text-sm text-muted-foreground">Available Balance</div>
            </div>
            <div className="text-3xl font-bold">${wallet?.balance?.toFixed(2) || '0.00'}</div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              <div className="text-sm text-muted-foreground">Pending</div>
            </div>
            <div className="text-3xl font-bold">${wallet?.pending_balance?.toFixed(2) || '0.00'}</div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <div className="text-sm text-muted-foreground">Total Earned</div>
            </div>
            <div className="text-3xl font-bold">${wallet?.total_earned?.toFixed(2) || '0.00'}</div>
          </Card>
        </div>

        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Payout Method</h2>
            <Button variant="outline" size="sm">Update</Button>
          </div>
          {wallet?.payout_method ? (
            <div className="p-4 bg-secondary rounded-lg">
              <div className="font-medium capitalize">{wallet.payout_method}</div>
              <div className="text-sm text-muted-foreground mt-1">
                {wallet.payout_details ? 'Configured' : 'Not configured'}
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground">No payout method configured</div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Transaction History</h2>
          <div className="space-y-3">
            {transactions && transactions.length > 0 ? (
              transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
                  <div className="flex-1">
                    <div className="font-medium capitalize">{tx.transaction_type.replace('_', ' ')}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </div>
                    {tx.notes && (
                      <div className="text-xs text-muted-foreground mt-1">{tx.notes}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-semibold ${tx.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount > 0 ? '$' : '-$'}{Math.abs(tx.amount).toFixed(2)}
                    </div>
                    <Badge variant={tx.status === 'completed' ? 'default' : 'secondary'}>
                      {tx.status}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No transactions yet
              </div>
            )}
          </div>
        </Card>
      </div>
    </Layout>
  );
};

export default WalletPage;