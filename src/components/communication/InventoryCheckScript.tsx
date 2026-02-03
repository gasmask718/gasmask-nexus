import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, CheckCircle2, AlertCircle, Package, Calendar, ThumbsUp, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type InventoryLevel = "FEW_TUBES" | "1/4_BOX" | "1/2_BOX" | "3/4_BOX" | "FULL_BOX";
export type RestockPriority = "URGENT" | "SOON" | "OPTIONAL" | "NONE";
export type GrabbaInterest = "STARTER_ADDED" | "INTERESTED_LATER" | "NOT_INTERESTED";

export interface ScriptData {
  inventoryLevel?: InventoryLevel;
  restockPriority?: RestockPriority;
  deliveryDay?: string;
  grabbaInterest?: GrabbaInterest;
  completed: boolean;
}

interface InventoryCheckScriptProps {
  agentName?: string;
  onComplete: (data: ScriptData, summary: string) => void;
  onCancel: () => void;
}

export function InventoryCheckScript({ 
  agentName = "AI Agent", 
  onComplete,
  onCancel 
}: InventoryCheckScriptProps) {
  const [step, setStep] = useState<"OPENING" | "INVENTORY" | "DELIVERY" | "GRABBA" | "CLOSING">("OPENING");
  const [data, setData] = useState<ScriptData>({ completed: false });

  // Helper to derive priority
  const getPriority = (level: InventoryLevel): RestockPriority => {
    switch (level) {
      case "FEW_TUBES": 
      case "1/4_BOX": return "URGENT";
      case "1/2_BOX": return "SOON";
      case "3/4_BOX": return "OPTIONAL";
      case "FULL_BOX": return "NONE";
      default: return "NONE";
    }
  };

  const updateInventory = (level: InventoryLevel) => {
    setData(prev => ({ 
      ...prev, 
      inventoryLevel: level, 
      restockPriority: getPriority(level) 
    }));
    setStep("DELIVERY");
  };

  const [deliveryDayInput, setDeliveryDayInput] = useState("");

  const submitDelivery = () => {
    setData(prev => ({ ...prev, deliveryDay: deliveryDayInput || "Not specified" }));
    setStep("GRABBA");
  };
  
  const updateGrabba = (interest: GrabbaInterest) => {
    setData(prev => ({ ...prev, grabbaInterest: interest }));
    setStep("CLOSING");
  };

  const finishScript = () => {
    const finalData = { ...data, completed: true };
    
    // Generate summary note
    const summary = `
[AI INVENTORY CHECK]
Status: ${finalData.inventoryLevel} (${finalData.restockPriority})
Delivery: ${finalData.deliveryDay}
Grabba: ${finalData.grabbaInterest}
    `.trim();

    onComplete(finalData, summary);
  };

  return (
    <div className="flex flex-col h-full max-h-[600px]">
      <div className="flex items-center justify-between p-4 border-b bg-muted/20">
        <h3 className="font-semibold flex items-center gap-2">
          <span className="bg-primary/10 text-primary p-1 rounded">🛡️</span> 
          Inventory & Delivery Script
        </h3>
        <Button variant="ghost" size="sm" onClick={onCancel} className="h-8">Close Script</Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
          
          {/* STEP 1: OPENING */}
          <ScriptStep 
            isActive={step === "OPENING"}
            isDone={ step !== "OPENING" }
            title="1. Opening + Compliance"
            icon={<CheckCircle2 className="w-4 h-4" />}
          >
            <ScriptText>
              Hi, this is <strong>{agentName}</strong> calling on behalf of GasMask Approved.<br/>
              This call may be recorded for quality and training purposes.<br/>
              <br/>
              Is now a good time to do a quick inventory check?<br/>
              It’ll only take about 20 seconds.
            </ScriptText>
            
            {step === "OPENING" && (
              <div className="flex gap-2 mt-4">
                <Button onClick={() => setStep("INVENTORY")} className="bg-green-600 hover:bg-green-700">
                  Yes, Continue
                </Button>
                <Button variant="outline" onClick={onCancel}>
                  No, Call Later
                </Button>
              </div>
            )}
             {step !== "OPENING" && <div className="text-xs text-muted-foreground mt-2">Proceeded to inventory check</div>}
          </ScriptStep>

          {/* STEP 2: INVENTORY (Combined Purpose + Check) */}
          {(step === "INVENTORY" || step === "DELIVERY" || step === "GRABBA" || step === "CLOSING") && (
            <ScriptStep 
              isActive={step === "INVENTORY"}
              isDone={step !== "INVENTORY"}
              title="2. Inventory Check"
              icon={<Package className="w-4 h-4" />}
            >
              {step === "INVENTORY" ? (
                <>
                  <ScriptText>
                    I’m just calling to see how your inventory is looking and to help schedule deliveries so you don’t run low.
                  </ScriptText>
                  <Separator className="my-3"/>
                  <ScriptText className="text-primary font-medium">
                    Just to get a quick estimate — would you say you have:
                  </ScriptText>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                    <Button variant="outline" className="justify-start" onClick={() => updateInventory("FEW_TUBES")}>
                      <AlertCircle className="w-4 h-4 mr-2 text-red-500"/> Few / Almost Out
                    </Button>
                    <Button variant="outline" className="justify-start" onClick={() => updateInventory("1/4_BOX")}>
                      <span className="w-4 h-4 mr-2 flex items-center justify-center font-bold text-xs border rounded">1/4</span> Quarter Box
                    </Button>
                    <Button variant="outline" className="justify-start" onClick={() => updateInventory("1/2_BOX")}>
                      <span className="w-4 h-4 mr-2 flex items-center justify-center font-bold text-xs border rounded">1/2</span> Half Box
                    </Button>
                    <Button variant="outline" className="justify-start" onClick={() => updateInventory("3/4_BOX")}>
                      <span className="w-4 h-4 mr-2 flex items-center justify-center font-bold text-xs border rounded">3/4</span> 3/4 Box
                    </Button>
                    <Button variant="outline" className="justify-start" onClick={() => updateInventory("FULL_BOX")}>
                      <CheckCircle2 className="w-4 h-4 mr-2 text-green-500"/> Full Box / Plenty
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    Note: If they say "Not sure", say: "No worries — whichever one is closest is fine."
                  </p>
                </>
              ) : (
                 <div className="bg-muted p-2 rounded text-sm flex gap-2 items-center">
                    <Package className="w-4 h-4 text-muted-foreground" />
                    Recorded: <span className="font-semibold">{data.inventoryLevel}</span>
                 </div>
              )}
            </ScriptStep>
          )}

          {/* STEP 3: DELIVERY */}
          {(step === "DELIVERY" || step === "GRABBA" || step === "CLOSING") && (
            <ScriptStep 
              isActive={step === "DELIVERY"}
              isDone={step !== "DELIVERY"}
              title="3. Delivery Timing"
              icon={<Calendar className="w-4 h-4" />}
            >
              {step === "DELIVERY" ? (
                <>
                  <ScriptText>
                    {data.restockPriority === 'URGENT' ? "Got it — we’ll make sure you don’t run out." : 
                     data.restockPriority === 'SOON' ? "Okay, good timing." : 
                     "Perfect. I’ll note that."}
                    <br/><br/>
                    <strong>What day this week feels best for a delivery?</strong>
                  </ScriptText>
                  <div className="flex gap-2 mt-4">
                    <div className="flex-1">
                      <Label htmlFor="day" className="sr-only">Day</Label>
                      <input 
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="e.g. Tuesday, Tomorrow, Weekends..."
                        value={deliveryDayInput}
                        onChange={(e) => setDeliveryDayInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && submitDelivery()}
                        autoFocus
                      />
                    </div>
                    <Button onClick={submitDelivery}>Next</Button>
                  </div>
                </>
              ): (
                <div className="bg-muted p-2 rounded text-sm flex gap-2 items-center">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    Delivery: <span className="font-semibold">{data.deliveryDay}</span>
                 </div>
              )}
            </ScriptStep>
          )}

          {/* STEP 4: GRABBA */}
          {(step === "GRABBA" || step === "CLOSING") && (
            <ScriptStep 
               isActive={step === "GRABBA"}
               isDone={step !== "GRABBA"}
               title="4. Grabba Offer"
               icon={<ThumbsUp className="w-4 h-4" />}
            >
              {step === "GRABBA" ? (
                <>
                  <ScriptText>
                    Just so you know, we do have <strong>Grabba</strong> available as well.<br/>
                    Some stores add it when they’re already scheduling a delivery.<br/>
                    <br/>
                    <em>(Wait for interest. If interested, explain: Starter order is half a box, 50 tubes.)</em>
                    <br/><br/>
                    <strong>Would you like to add a starter order, or stick with your regular restock?</strong>
                  </ScriptText>
                  
                  <div className="grid grid-cols-1 gap-2 mt-4">
                    <Button variant="secondary" onClick={() => updateGrabba("STARTER_ADDED")}>
                      <CheckCircle2 className="w-4 h-4 mr-2 text-green-600"/> Add Starter Order (Use "A")
                    </Button>
                    <Button variant="outline" onClick={() => updateGrabba("INTERESTED_LATER")}>
                      <Calendar className="w-4 h-4 mr-2 text-blue-600"/> Interested - Later / Future
                    </Button>
                    <Button variant="ghost" onClick={() => updateGrabba("NOT_INTERESTED")}>
                       <XCircle className="w-4 h-4 mr-2 text-muted-foreground"/> Not Interested
                    </Button>
                  </div>
                </>
              ) : (
                <div className="bg-muted p-2 rounded text-sm flex gap-2 items-center">
                    <ThumbsUp className="w-4 h-4 text-muted-foreground" />
                    Grabba: <span className="font-semibold">{data.grabbaInterest}</span>
                 </div>
              )}
            </ScriptStep>
          )}

          {/* STEP 5: CLOSING */}
          {step === "CLOSING" && (
             <ScriptStep 
                isActive={true} 
                isDone={false} 
                title="5. Wrap Up"
                icon={<ArrowRight className="w-4 h-4" />}
            >
              <ScriptText>
                {data.grabbaInterest === 'STARTER_ADDED' 
                  ? "Perfect. I’ll note a starter Grabba order. You can adjust quantities when the rep confirms." 
                  : "No problem. I’ll just keep Grabba noted for future deliveries."}
                <br/><br/>
                Alright, I’ve got you scheduled for <strong>{data.deliveryDay}</strong>.<br/>
                Thanks for the quick check-in — we’ll see you then.
              </ScriptText>
              <div className="mt-6 flex justify-end">
                <Button onClick={finishScript} size="lg" className="w-full bg-green-600 hover:bg-green-700">
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Complete & Log
                </Button>
              </div>
            </ScriptStep>
          )}

        </div>
      </ScrollArea>
    </div>
  );
}

function ScriptStep({ children, title, isActive, isDone, icon }: { children: React.ReactNode, title: string, isActive: boolean, isDone: boolean, icon: React.ReactNode }) {
  return (
    <div className={cn("border rounded-lg transition-all", isActive ? "border-primary bg-background shadow-sm" : isDone ? "border-border/50 opacity-80" : "opacity-50")}>
      <div className={cn("px-4 py-2 border-b flex items-center gap-2 font-medium text-sm", isActive ? "bg-primary/5 text-primary" : "bg-muted/50")}>
        {icon} {title}
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

function ScriptText({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <p className={cn("text-base leading-relaxed whitespace-pre-wrap", className)}>
      {children}
    </p>
  );
}
