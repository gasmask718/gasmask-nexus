import { LiveCallObserver } from "@/components/communication/LiveCallObserver";
import { useBrandaroLiveScript } from "@/hooks/useBrandaroLiveScript";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Theater, ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const emotionColors: Record<string, string> = {
  interested: "text-green-500 bg-green-500/10",
  neutral: "text-muted-foreground bg-muted/50",
  skeptical: "text-yellow-500 bg-yellow-500/10",
  confused: "text-orange-500 bg-orange-500/10",
  defensive: "text-red-500 bg-red-500/10",
  frustrated: "text-red-600 bg-red-600/10",
  curious: "text-blue-500 bg-blue-500/10",
  excited: "text-emerald-500 bg-emerald-500/10",
  hesitant: "text-amber-500 bg-amber-500/10",
  disengaged: "text-gray-500 bg-gray-500/10",
  ready_to_close: "text-green-600 bg-green-600/10",
};

const emotionEmoji: Record<string, string> = {
  interested: "🟢", neutral: "⚪", skeptical: "🟡", confused: "🟠",
  defensive: "🔴", frustrated: "😤", curious: "🔵", excited: "✨",
  hesitant: "🟡", disengaged: "⚫", ready_to_close: "🎯",
};

export default function DialerLiveCallsTab() {
  const {
    currentEmotion,
    emotionTimeline,
    currentPersonality,
    personalitySwitches,
    switchCount,
  } = useBrandaroLiveScript();

  return (
    <div className="space-y-4">
      {/* Intelligence HUD — shows when active */}
      {(currentEmotion || currentPersonality) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Emotion State */}
          {currentEmotion && (
            <Card className="border-l-[3px] border-l-blue-500">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Brain className="h-4 w-4 text-blue-500" />
                    Emotion Detection
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {currentEmotion.confidence_score}% confident
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={cn("border-0 text-sm", emotionColors[currentEmotion.detected_emotion] || "bg-muted")}>
                    {emotionEmoji[currentEmotion.detected_emotion] || "❓"} {currentEmotion.detected_emotion.replace(/_/g, " ")}
                  </Badge>
                  {currentEmotion.secondary_emotion && currentEmotion.secondary_emotion !== "none" && (
                    <>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <Badge variant="outline" className="text-[10px]">
                        {currentEmotion.secondary_emotion}
                      </Badge>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-[10px]">
                    Strategy: {currentEmotion.recommended_strategy.replace(/_/g, " ")}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    Tone: {currentEmotion.tone_adjustment.replace(/_/g, " ")}
                  </Badge>
                  <Badge variant={currentEmotion.urgency === "critical" ? "destructive" : "outline"} className="text-[10px]">
                    {currentEmotion.urgency} urgency
                  </Badge>
                </div>
                {currentEmotion.empathy_phrase && (
                  <p className="text-xs text-muted-foreground italic">
                    💬 "{currentEmotion.empathy_phrase}"
                  </p>
                )}
                {/* Emotion timeline mini-bar */}
                {emotionTimeline.length > 1 && (
                  <div className="flex gap-0.5 mt-1">
                    {emotionTimeline.slice(-15).map((e, i) => (
                      <div
                        key={i}
                        className={cn("h-2 flex-1 rounded-sm", emotionColors[e.emotion]?.split(" ")[1] || "bg-muted")}
                        title={`${e.emotion} (${e.confidence}%)`}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Personality State */}
          {currentPersonality && (
            <Card className="border-l-[3px] border-l-purple-500">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Theater className="h-4 w-4 text-purple-500" />
                    Active Personality
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {currentPersonality.confidence_score}% match
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="border-0 bg-purple-500/10 text-purple-600 text-sm">
                    🎭 {currentPersonality.nickname}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {currentPersonality.archetype}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{currentPersonality.reason}</p>
                {currentPersonality.blend_with && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Sparkles className="h-3 w-3" />
                    Blended: {currentPersonality.blend_ratio}% primary
                  </div>
                )}
                {personalitySwitches.length > 0 && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    Switches: {switchCount}/3 used
                    {personalitySwitches.map((s, i) => (
                      <Badge key={i} variant="outline" className="text-[9px] px-1">
                        {s.nickname}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <LiveCallObserver />
    </div>
  );
}
