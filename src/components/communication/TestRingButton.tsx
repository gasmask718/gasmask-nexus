import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PhoneCall, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { TestRingResultModal, type TestRingResult } from "./TestRingResultModal";

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

  const testRingMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-ring`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            routeId,
            businessId,
            phoneNumberId,
            userId,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Test Ring failed");
      }

      return response.json() as Promise<TestRingResult>;
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

  const handleClick = () => {
    testRingMutation.mutate();
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleClick}
        disabled={testRingMutation.isPending}
        className={className}
        title="Place a real test call to verify routing"
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
