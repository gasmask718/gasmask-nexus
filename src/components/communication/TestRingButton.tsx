import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PhoneCall, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { TestRingResultModal, type TestRingResult } from "./TestRingResultModal";
import { useVoiceDevice } from "@/contexts/VoiceDeviceProvider";

interface TestRingButtonProps {
  routeId?: string;
  businessId?: string;
  phoneNumberId?: string;
  userId?: string;
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "icon";
  className?: string;
  label?: string;
}

export function TestRingButton({
  routeId,
  businessId,
  phoneNumberId,
  userId,
  variant = "outline",
  size = "sm",
  className,
  label = "Test Ring",
}: TestRingButtonProps) {
  const [result, setResult] = useState<TestRingResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const { canMakeCalls, disabledReason } = useVoiceDevice();

  const testRingMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('test-ring', {
        body: { routeId, businessId, phoneNumberId, userId },
      });

      if (error) {
        console.error("Test Ring error details:", error);
        throw new Error(error.message || "Test Ring failed");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return data as TestRingResult;
    },
    onSuccess: (data) => {
      setResult(data);
      setShowResult(true);
      if (data.success) {
        toast.success("Test Ring initiated - phone should ring!");
      } else {
        toast.error(`Test Ring failed: ${data.summary.failureReason}`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Test Ring error: ${error.message}`);
    },
  });

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => testRingMutation.mutate()}
        disabled={testRingMutation.isPending || !canMakeCalls}
        className={className}
        title={canMakeCalls ? "Place a real test call to verify routing" : disabledReason ?? "Voice not ready"}
      >
        {testRingMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <PhoneCall className="h-4 w-4" />
        )}
        {size !== "icon" && <span className="ml-1">{label}</span>}
      </Button>

      <TestRingResultModal
        result={result}
        isOpen={showResult}
        onClose={() => setShowResult(false)}
      />
    </>
  );
}
