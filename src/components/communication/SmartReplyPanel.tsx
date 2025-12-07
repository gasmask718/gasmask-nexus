import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useCommunicationIntelligence } from "@/hooks/useCommunicationIntelligence";
import { Sparkles, Send, RefreshCw, Copy } from "lucide-react";
import { toast } from "sonner";

interface SmartReplyPanelProps {
  sentiment?: "positive" | "neutral" | "negative";
  keywords?: string[];
  onSelectReply?: (reply: string) => void;
}

export default function SmartReplyPanel({ 
  sentiment = "neutral", 
  keywords = [], 
  onSelectReply 
}: SmartReplyPanelProps) {
  const { generateSmartReply } = useCommunicationIntelligence();
  const [suggestions, setSuggestions] = useState<string[]>(() => 
    generateSmartReply(sentiment, keywords)
  );
  const [customReply, setCustomReply] = useState("");

  const refreshSuggestions = () => {
    setSuggestions(generateSmartReply(sentiment, keywords));
    toast.success("Suggestions refreshed");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const handleSelect = (reply: string) => {
    setCustomReply(reply);
    onSelectReply?.(reply);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Sparkles className="text-primary" size={18} />
            Smart Reply Suggestions
          </div>
          <Button variant="ghost" size="sm" onClick={refreshSuggestions}>
            <RefreshCw size={14} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.map((suggestion, index) => (
          <div
            key={index}
            className="group relative p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
            onClick={() => handleSelect(suggestion)}
          >
            <p className="text-sm pr-16">{suggestion}</p>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(suggestion);
                }}
              >
                <Copy size={12} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(suggestion);
                }}
              >
                <Send size={12} />
              </Button>
            </div>
          </div>
        ))}

        <div className="pt-2 border-t">
          <Textarea
            value={customReply}
            onChange={(e) => setCustomReply(e.target.value)}
            placeholder="Or type a custom reply..."
            className="min-h-[80px]"
          />
          <div className="flex justify-end mt-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => onSelectReply?.(customReply)}>
              <Send size={14} className="mr-1" />
              Use Reply
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
