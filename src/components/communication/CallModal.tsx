import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Phone, PhoneCall, PhoneOff, Building2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface BusinessPhoneNumber {
  id: string;
  phone_number: string;
  type: string;
  label: string | null;
  is_default: boolean | null;
  business_id: string;
  businesses: {
    id: string;
    name: string;
    primary_color: string | null;
  } | null;
}

interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (businessId?: string) => void;
  destinationPhone: string;
  entityName?: string;
  entityType?: string;
  businessPhoneNumbers: BusinessPhoneNumber[];
  defaultBusinessId?: string;
  isLoading?: boolean;
}

export function CallModal({
  isOpen,
  onClose,
  onConfirm,
  destinationPhone,
  entityName,
  entityType,
  businessPhoneNumbers,
  defaultBusinessId,
  isLoading = false,
}: CallModalProps) {
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>(
    defaultBusinessId || ""
  );

  // Set default business when modal opens
  useEffect(() => {
    if (isOpen) {
      if (defaultBusinessId) {
        setSelectedBusinessId(defaultBusinessId);
      } else if (businessPhoneNumbers.length > 0) {
        const defaultNumber = businessPhoneNumbers.find(bp => bp.is_default);
        setSelectedBusinessId(
          defaultNumber?.business_id || businessPhoneNumbers[0].business_id
        );
      }
    }
  }, [isOpen, defaultBusinessId, businessPhoneNumbers]);

  const selectedNumber = businessPhoneNumbers.find(
    bp => bp.business_id === selectedBusinessId
  );

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    } else if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const handleConfirm = () => {
    onConfirm(selectedBusinessId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            Place Outbound Call
          </DialogTitle>
          <DialogDescription>
            Review the call details before connecting via Twilio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Destination */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Calling
            </label>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <PhoneCall className="h-5 w-5 text-primary" />
              </div>
              <div>
                {entityName && (
                  <p className="font-medium">{entityName}</p>
                )}
                <p className={cn(
                  "text-lg font-mono",
                  !entityName && "font-medium"
                )}>
                  {formatPhone(destinationPhone)}
                </p>
                {entityType && (
                  <Badge variant="secondary" className="mt-1 capitalize">
                    {entityType}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Business Selector - optional */}
          {businessPhoneNumbers.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Calling From (Caller ID)
              </label>
              <Select
                value={selectedBusinessId}
                onValueChange={setSelectedBusinessId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select business line" />
                </SelectTrigger>
                <SelectContent>
                  {businessPhoneNumbers.map((bp) => (
                    <SelectItem key={bp.id} value={bp.business_id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{bp.businesses?.name || "Unknown"}</span>
                        <span className="text-muted-foreground">
                          ({formatPhone(bp.phone_number)})
                        </span>
                        {bp.is_default && (
                          <Badge variant="outline" className="ml-1 text-xs">
                            Default
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedNumber && (
                <p className="text-sm text-muted-foreground">
                  The recipient will see <strong>{formatPhone(selectedNumber.phone_number)}</strong> as the caller ID.
                </p>
              )}
            </div>
          )}

          {businessPhoneNumbers.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Call will be placed using the default Twilio number.
            </p>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            <PhoneOff className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <PhoneCall className="h-4 w-4 mr-2" />
                Call Now
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
