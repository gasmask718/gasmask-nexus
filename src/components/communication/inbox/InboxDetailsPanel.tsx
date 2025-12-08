import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Phone, MessageSquare, Mail, Send, X, ExternalLink, 
  CheckCircle, Clock, AlertTriangle, Bot, User, Building,
  MapPin, Sparkles, RefreshCw, ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { UnifiedInboxItem } from "@/hooks/useUnifiedInbox";
import { useNavigate } from "react-router-dom";
import { CallIntelligencePanel } from "@/components/communication/intelligence";

interface InboxDetailsPanelProps {
  item: UnifiedInboxItem | null;
  onClose: () => void;
  onMarkReviewed: (id: string, type: string) => void;
}

export function InboxDetailsPanel({ item, onClose, onMarkReviewed }: InboxDetailsPanelProps) {
  const navigate = useNavigate();
  const [replyContent, setReplyContent] = useState("");
  const [isSending, setIsSending] = useState(false);

  if (!item) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>Select an item to view details</p>
        </div>
      </div>
    );
  }

  const handleSendReply = async () => {
    if (!replyContent.trim()) return;
    setIsSending(true);
    // Simulate sending
    await new Promise(r => setTimeout(r, 1000));
    setIsSending(false);
    setReplyContent("");
  };

  const navigateTo = (path: string) => {
    navigate(path);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-medium"
            style={{ backgroundColor: item.business?.primary_color || "#6366f1" }}
          >
            {item.business?.name?.charAt(0) || "?"}
          </div>
          <div>
            <h3 className="font-semibold text-lg">
              {item.store?.store_name || item.phone_number || "Unknown"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {item.business?.name}
              {item.vertical && ` • ${item.vertical.name}`}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs capitalize">
                {item.type}
              </Badge>
              {item.ai_flag && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <Bot className="h-3 w-3" />
                  AI Generated
                </Badge>
              )}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Full Content */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {item.direction === "inbound" ? (
                  <ArrowRight className="h-4 w-4 text-green-500 rotate-180" />
                ) : (
                  <ArrowRight className="h-4 w-4 text-blue-500" />
                )}
                {item.direction === "inbound" ? "Inbound" : "Outbound"} {item.type}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn(
                "p-4 rounded-lg",
                item.direction === "inbound" ? "bg-muted" : "bg-primary/10"
              )}>
                <p className="text-sm whitespace-pre-wrap">
                  {item.full_content || item.summary}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {format(new Date(item.timestamp), "MMM d, yyyy 'at' h:mm a")}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Metadata */}
          {item.metadata && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {item.sentiment && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Sentiment</span>
                    <Badge variant={item.sentiment === "positive" ? "default" : item.sentiment === "negative" ? "destructive" : "secondary"}>
                      {item.sentiment}
                    </Badge>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Priority</span>
                  <Badge variant={item.priority_level === "high" ? "destructive" : "secondary"}>
                    {item.priority_level}
                  </Badge>
                </div>
                {item.metadata.status && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <span className="capitalize">{item.metadata.status}</span>
                  </div>
                )}
                {item.metadata.reason && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Reason</span>
                    <span>{item.metadata.reason}</span>
                  </div>
                )}
                {item.metadata.due_at && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Due</span>
                    <span>{format(new Date(item.metadata.due_at), "MMM d, h:mm a")}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* AI Recommendations */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                AI Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {item.type === "follow-up" && (
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>Execute the recommended {item.metadata?.recommended_action || "follow-up"} action</span>
                  </li>
                )}
                {item.sentiment === "negative" && (
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                    <span>Review sentiment and consider escalation or personal outreach</span>
                  </li>
                )}
                {item.requires_action && (
                  <li className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-blue-500 mt-0.5" />
                    <span>This item requires immediate attention</span>
                  </li>
                )}
                <li className="flex items-start gap-2">
                  <Bot className="h-4 w-4 text-primary mt-0.5" />
                  <span>AI can draft a response based on brand tone guidelines</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Quick Links */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Quick Links</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {item.store_id && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="justify-start gap-2"
                  onClick={() => navigateTo(`/crm/brand-stores/${item.store_id}`)}
                >
                  <Building className="h-4 w-4" />
                  Store Profile
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                className="justify-start gap-2"
                onClick={() => navigateTo("/communication/deals")}
              >
                <ExternalLink className="h-4 w-4" />
                Deals Pipeline
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="justify-start gap-2"
                onClick={() => navigateTo("/communication/follow-ups")}
              >
                <Clock className="h-4 w-4" />
                Follow-Up Manager
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="justify-start gap-2"
                onClick={() => navigateTo(`/crm?business=${item.business_id}`)}
              >
                <MapPin className="h-4 w-4" />
                Business CRM
              </Button>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>

      {/* Action Bar */}
      <div className="p-4 border-t space-y-3">
        {/* Reply Box */}
        <div className="flex gap-2">
          <Textarea
            placeholder="Type a reply..."
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            className="min-h-[60px]"
          />
          <Button 
            onClick={handleSendReply}
            disabled={isSending || !replyContent.trim()}
            className="self-end"
          >
            {isSending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-2">
            <Phone className="h-4 w-4" />
            Call Now
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Text Now
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Mail className="h-4 w-4" />
            Email Now
          </Button>
          {item.requires_action && (
            <Button 
              size="sm" 
              className="gap-2 ml-auto"
              onClick={() => onMarkReviewed(item.id, item.type)}
            >
              <CheckCircle className="h-4 w-4" />
              Mark Reviewed
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
