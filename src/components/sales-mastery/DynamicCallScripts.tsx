import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, Mic, BookOpen } from 'lucide-react';

type Hub = 'real_estate' | 'surplus_funds';

const RE_SCRIPTS = [
  {
    stage: 'opener',
    title: '🎯 OPENER — First 10 seconds',
    lines: [
      `"Hey [name], my name is [agent] — quick question before I explain why I'm calling. Are you the owner of the property over at [address]?"`,
      `[If yes] → "Perfect. I'll be straight with you — I buy properties for cash and I'm actively looking in your area. Is that something you'd even consider if the price worked?"`,
    ],
    rules: ['Never say "how are you today."', 'Never pitch before qualifying.', 'Never ask two questions at once.'],
  },
  {
    stage: 'qualifying',
    title: '🔍 QUALIFYING — Find the pain, not the price',
    lines: [
      `"What's your situation with the property right now?"`,
      `[Listen completely. Never interrupt. Log: motivated/not motivated]`,
      `"How long have you owned it?"`,
      `"And if you were to move on it — would you need to move fast or do you have flexibility on timing?"`,
    ],
    rules: ['80% listening, 20% talking.', 'Duration of explanation = urgency.'],
  },
  {
    stage: 'bridge',
    title: '🌉 BRIDGE — Connect pain to solution',
    lines: [
      `"That's exactly the situation we work with. We helped someone in [city] in almost the identical situation — they needed to close in 18 days, we closed in 14, cash, no repairs, no agents."`,
    ],
    rules: ['Use their exact words back.', 'One story. 30 seconds max.'],
  },
  {
    stage: 'price',
    title: '💰 PRICE TALK — Never anchor first',
    lines: [
      `"Before I throw a number out — what would you need to feel good about walking away from this?"`,
      `[If they give a number] → "Got it. I can't promise that but let me run the numbers against what we're seeing in the market. What's the condition of the property?"`,
    ],
    rules: ['Let them set the frame.', 'If they push you for a number, give a range based on MAO.'],
  },
  {
    stage: 'objections',
    title: '🛡️ OBJECTIONS — 4 Universal Responses',
    lines: [
      `"Too low" → "I hear you. What's your number based on? Because if there's room to work, I want to find it."`,
      `"Need to think" → "Of course. What's the one thing holding you?"`,
      `"Already have an agent" → "Respect that. When's their listing expire? Because cash buyers close faster than any listed sale."`,
      `"Not interested" → "Fair enough. Is it the price or the timing that doesn't work? Because one of those I might be able to fix."`,
    ],
    rules: ['Never argue. Isolate the real concern.', 'Match their energy — calm to calm, urgent to urgent.'],
  },
  {
    stage: 'close',
    title: '🎯 CLOSE — Always close THIS call',
    lines: [
      `"Here's what I'd like to do — let me get a simple agreement over to you today. No obligation to close, but it locks in this price for you while we do our paperwork. Does that work?"`,
      `[If pushback] → "What would need to be different for you to feel comfortable moving forward today?"`,
    ],
    rules: ['Never say "I\'ll call you back."', 'Close or schedule a specific follow-up within 24 hours.'],
  },
];

const SF_SCRIPTS = [
  {
    stage: 'opener',
    title: '🎯 OPENER — Establish legitimacy fast',
    lines: [
      `"Hey [name], my name is [agent] with Dynasty Surplus Recovery. I'm reaching out because our records show there may be unclaimed funds from a property transaction connected to [address]. Are you familiar with that property?"`,
      `[If yes] → "Great. We specialize in recovering surplus funds from foreclosure sales. Based on our research, there could be $[amount] owed to you. Can I take 2 minutes to explain how it works?"`,
    ],
    rules: ['Lead with the money amount — it creates instant interest.', 'Never sound like a cold caller. Sound like a researcher delivering good news.'],
  },
  {
    stage: 'qualifying',
    title: '🔍 QUALIFYING — Confirm ownership + interest',
    lines: [
      `"Just to confirm — were you the owner of record at [address] before the sale?"`,
      `"And are you aware that when a property sells at foreclosure for more than what's owed, the excess belongs to the former owner?"`,
      `"Have you tried to recover these funds on your own?"`,
    ],
    rules: ['If they tried and failed — position your attorney network as the solution.', 'If they didn\'t know — you\'re delivering great news. Stay excited.'],
  },
  {
    stage: 'bridge',
    title: '🌉 BRIDGE — Build trust with credentials',
    lines: [
      `"We've recovered over $[total] for former homeowners just like you. We work with licensed attorneys in [state] who handle the entire court process. You don't lift a finger."`,
    ],
    rules: ['One success story. Use their state if possible.', 'Emphasize: no upfront cost, no risk.'],
  },
  {
    stage: 'price',
    title: '💰 FEE DISCUSSION — Frame as partnership',
    lines: [
      `"Our standard is 35% of whatever we recover. But here's the key — you pay nothing unless we get you money. Zero upfront. Zero risk. We only get paid when you get paid."`,
      `[If pushback] → "Without a specialized recovery team, most people never see this money. We make it happen. Would you rather have 65% of something or 100% of nothing?"`,
    ],
    rules: ['Never negotiate below 30%.', '35% is the anchor — only go to 30% for claims over $50K.'],
  },
  {
    stage: 'objections',
    title: '🛡️ OBJECTIONS',
    lines: [
      `"Sounds like a scam" → "I understand. You can verify us at [website]. We work with [attorney name] who's licensed in your state. And remember — we don't get paid unless you get paid."`,
      `"I need to talk to my lawyer" → "Absolutely. Most attorneys don't specialize in surplus recovery though. Happy to speak with your lawyer directly."`,
      `"How long does this take?" → "60-90 days typically. We'll keep you updated at every step."`,
      `"I already claimed my funds" → "Great! But sometimes there are additional claims from separate sales. Can I verify at no cost?"`,
    ],
    rules: ['Always offer verification. Transparency kills doubt.'],
  },
  {
    stage: 'close',
    title: '🎯 CLOSE — Get the agreement signed',
    lines: [
      `"Here's what I'd like to do — I'll send you a simple contingency agreement right now. It authorizes us to investigate and recover your funds. No money from you today or ever — unless we recover your surplus. Can I get that over to you?"`,
      `[If pushback] → "What's holding you back? Because the longer this sits, the harder it can be to recover."`,
    ],
    rules: ['Create urgency with the timeline.', 'Send DocuSign immediately after verbal yes.'],
  },
];

interface DynamicCallScriptsProps {
  hub: Hub;
  accentColor: string;
  currentStage?: string;
  onStageSelect?: (stage: string) => void;
}

export function DynamicCallScripts({ hub, accentColor, currentStage, onStageSelect }: DynamicCallScriptsProps) {
  const scripts = hub === 'real_estate' ? RE_SCRIPTS : SF_SCRIPTS;
  const [activeStage, setActiveStage] = useState(currentStage || scripts[0].stage);

  const handleStageClick = (stage: string) => {
    setActiveStage(stage);
    onStageSelect?.(stage);
  };

  const activeScript = scripts.find(s => s.stage === activeStage) || scripts[0];

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <BookOpen className="h-4 w-4" style={{ color: accentColor }} />
          Dynamic Call Script
        </CardTitle>
        <div className="flex flex-wrap gap-1 mt-2">
          {scripts.map(s => (
            <Button
              key={s.stage}
              size="sm"
              variant={activeStage === s.stage ? 'default' : 'outline'}
              className="h-7 text-xs"
              style={activeStage === s.stage ? { backgroundColor: accentColor } : {}}
              onClick={() => handleStageClick(s.stage)}
            >
              {s.stage.charAt(0).toUpperCase() + s.stage.slice(1)}
              {activeStage === s.stage && <Mic className="h-3 w-3 ml-1" />}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="p-4 rounded-lg border border-border" style={{ borderLeftColor: accentColor, borderLeftWidth: '4px' }}>
          <h3 className="font-bold text-sm mb-3" style={{ color: accentColor }}>{activeScript.title}</h3>
          <div className="space-y-3">
            {activeScript.lines.map((line, i) => (
              <p key={i} className="text-sm italic text-foreground/90 leading-relaxed">{line}</p>
            ))}
          </div>
          {activeScript.rules.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border/50">
              <p className="text-xs font-semibold text-muted-foreground mb-1">RULES:</p>
              {activeScript.rules.map((r, i) => (
                <p key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                  <ChevronRight className="h-3 w-3 mt-0.5 flex-shrink-0" style={{ color: accentColor }} />{r}
                </p>
              ))}
            </div>
          )}
        </div>
        {activeStage !== scripts[scripts.length - 1].stage && (
          <Button
            size="sm"
            variant="outline"
            className="w-full text-xs"
            onClick={() => {
              const idx = scripts.findIndex(s => s.stage === activeStage);
              if (idx < scripts.length - 1) handleStageClick(scripts[idx + 1].stage);
            }}
          >
            Next Stage <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
