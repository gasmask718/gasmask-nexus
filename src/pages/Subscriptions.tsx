import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Star, Zap } from "lucide-react";

const Subscriptions = () => {
  const { data: plans } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'free': return <Zap className="h-6 w-6" />;
      case 'pro': return <Star className="h-6 w-6" />;
      case 'elite': return <Crown className="h-6 w-6" />;
      case 'diamond': return <Crown className="h-6 w-6 text-purple-500" />;
      default: return <Zap className="h-6 w-6" />;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'free': return 'bg-gray-100 dark:bg-gray-800';
      case 'pro': return 'bg-blue-100 dark:bg-blue-900';
      case 'elite': return 'bg-purple-100 dark:bg-purple-900';
      case 'diamond': return 'bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900 dark:to-pink-900';
      default: return 'bg-secondary';
    }
  };

  return (
    <Layout>
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Store Membership Plans</h1>
          <p className="text-xl text-muted-foreground">
            Choose the plan that fits your business needs
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans?.map(plan => {
            const benefits = plan.benefits as { features: string[] };
            return (
              <Card key={plan.id} className={`p-6 ${getTierColor(plan.tier)} relative overflow-hidden`}>
                {plan.tier === 'elite' && (
                  <Badge className="absolute top-4 right-4">Popular</Badge>
                )}
                {plan.tier === 'diamond' && (
                  <Badge className="absolute top-4 right-4 bg-gradient-to-r from-purple-600 to-pink-600">
                    Premium
                  </Badge>
                )}
                
                <div className="flex items-center gap-3 mb-4">
                  {getTierIcon(plan.tier)}
                  <h3 className="text-2xl font-bold">{plan.name}</h3>
                </div>

                <div className="mb-6">
                  <div className="text-4xl font-bold">
                    ${plan.price}
                    <span className="text-lg text-muted-foreground">/mo</span>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  {benefits.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                <Button 
                  className="w-full"
                  variant={plan.tier === 'diamond' ? 'default' : 'outline'}
                >
                  {plan.tier === 'free' ? 'Current Plan' : 'Upgrade'}
                </Button>
              </Card>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <Card className="p-8 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-4">Need a Custom Plan?</h2>
            <p className="text-muted-foreground mb-6">
              Contact our team to create a tailored solution for your business
            </p>
            <Button size="lg">Contact Sales</Button>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Subscriptions;