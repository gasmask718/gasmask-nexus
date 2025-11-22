import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, MessageSquare, Phone, Navigation, MessageCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface AIRecommendedScriptsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scripts: {
    initial: string;
    followup: string;
    visit: string;
    whatsapp: string;
  };
  entityType: 'store' | 'wholesaler' | 'influencer';
}

export const AIRecommendedScriptsModal = ({ 
  open, 
  onOpenChange, 
  scripts,
  entityType 
}: AIRecommendedScriptsModalProps) => {
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} script copied to clipboard`,
    });
  };

  const scriptItems = [
    {
      icon: MessageSquare,
      label: "Initial Check-In",
      text: scripts.initial,
      color: "text-blue-600"
    },
    {
      icon: Phone,
      label: "Follow-Up Message",
      text: scripts.followup,
      color: "text-green-600"
    },
    {
      icon: Navigation,
      label: "In-Person Visit",
      text: scripts.visit,
      color: "text-purple-600"
    },
    {
      icon: MessageCircle,
      label: "WhatsApp Message",
      text: scripts.whatsapp,
      color: "text-emerald-600"
    }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI-Generated Communication Scripts</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Personalized scripts optimized for {entityType} engagement
          </p>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {scriptItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${item.color}`} />
                    <span className="font-medium">{item.label}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(item.text, item.label)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-sm bg-muted p-3 rounded">
                  {item.text}
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mt-4">
          <div className="text-sm font-medium mb-2">💡 Pro Tips:</div>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Personalize with specific product names or recent orders</li>
            <li>Mention local events or neighborhood context</li>
            <li>Reference previous conversations for authenticity</li>
            <li>Always end with a clear call-to-action</li>
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
};
