import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Instagram, MessageSquare, Mail, TrendingUp, MapPin, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Influencers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedInfluencer, setSelectedInfluencer] = useState<any>(null);

  const { data: influencers, isLoading } = useQuery({
    queryKey: ['influencers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('influencers')
        .select('*')
        .order('score', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { error } = await supabase
        .from('influencers')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['influencers'] });
      toast({ title: "Status updated" });
    },
  });

  const generateDMTemplate = (influencer: any) => {
    const template = `Hey @${influencer.username}! 👋

We've been following your content in ${influencer.city} and love what you're doing in the ${influencer.niche} space.

We're expanding our presence and think you'd be a perfect fit to collaborate. Interested in partnering up?

Let's chat! 🚀`;

    navigator.clipboard.writeText(template);
    toast({ title: "DM template copied to clipboard!" });
  };

  const generateEmailPitch = (influencer: any) => {
    const email = `Subject: Partnership Opportunity - ${influencer.name}

Hi ${influencer.name},

I'm reaching out because we've been impressed by your ${influencer.platform} presence and engagement with your ${influencer.followers.toLocaleString()} followers.

We're looking to partner with creators in ${influencer.city} who align with our brand in the ${influencer.niche} space. Your engagement rate of ${influencer.engagement_rate}% is particularly impressive.

Would you be interested in discussing a potential partnership?

Looking forward to hearing from you!

Best regards,
The Team`;

    navigator.clipboard.writeText(email);
    toast({ title: "Email pitch copied to clipboard!" });
  };

  const getScoreColor = (score: number) => {
    if (score >= 15) return "text-green-500 bg-green-500/10 border-green-500/20";
    if (score >= 10) return "text-yellow-500 bg-yellow-500/10 border-yellow-500/20";
    return "text-blue-500 bg-blue-500/10 border-blue-500/20";
  };

  const getPlatformIcon = (platform: string) => {
    return <Instagram className="w-4 h-4" />;
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading influencers...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-foreground">Influencer Discovery</h1>
          <p className="text-muted-foreground">Target high-value creators for brand partnerships</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {influencers?.map((influencer) => (
            <Card key={influencer.id} className="p-6 border-border/50 hover:border-primary/50 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  {getPlatformIcon(influencer.platform)}
                  <span className="font-mono text-sm text-muted-foreground">
                    @{influencer.username}
                  </span>
                </div>
                <Badge className={getScoreColor(influencer.score)}>
                  Score: {influencer.score}
                </Badge>
              </div>

              <h3 className="text-xl font-bold mb-2">{influencer.name}</h3>

              <div className="space-y-2 mb-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <TrendingUp className="w-4 h-4" />
                  <span>{influencer.followers.toLocaleString()} followers</span>
                  <span className="ml-auto">{influencer.engagement_rate}% engagement</span>
                </div>
                {influencer.city && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    <span>{influencer.city}</span>
                  </div>
                )}
                <Badge variant="outline">{influencer.niche}</Badge>
                <Badge variant={influencer.status === 'active' ? 'default' : 'secondary'}>
                  {influencer.status}
                </Badge>
              </div>

              <div className="flex gap-2 mb-2">
                <Button
                  size="sm"
                  variant="default"
                  className="flex-1"
                  onClick={() => navigate(`/influencers/${influencer.id}`)}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  View Details
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => generateDMTemplate(influencer)}
                >
                  <MessageSquare className="w-4 h-4 mr-1" />
                  DM
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => generateEmailPitch(influencer)}
                >
                  <Mail className="w-4 h-4 mr-1" />
                  Email
                </Button>
              </div>

              {influencer.status === 'target' && (
                <Button
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => updateStatus.mutate({ id: influencer.id, status: 'contacted' })}
                >
                  Mark as Contacted
                </Button>
              )}
            </Card>
          ))}
        </div>

        {influencers?.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">No influencers found. Add some to get started!</p>
          </Card>
        )}
      </div>
    </div>
  );
}