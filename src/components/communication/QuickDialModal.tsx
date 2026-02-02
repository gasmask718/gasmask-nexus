import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone, PhoneCall, X } from "lucide-react";

interface QuickDialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCall: (phone: string, name?: string) => void;
  initialPhone?: string;
}

export function QuickDialModal({
  isOpen,
  onClose,
  onCall,
  initialPhone = "",
}: QuickDialModalProps) {
  const [phone, setPhone] = useState(initialPhone);
  const [name, setName] = useState("");

  const formatPhoneInput = (value: string) => {
    // Remove non-digit characters except + at the start
    const cleaned = value.replace(/[^\d+]/g, "");
    return cleaned;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhoneInput(e.target.value));
  };

  const handleCall = () => {
    if (phone.trim()) {
      onCall(phone.trim(), name.trim() || undefined);
      setPhone("");
      setName("");
      onClose();
    }
  };

  const handleClose = () => {
    setPhone("");
    setName("");
    onClose();
  };

  const isValidPhone = phone.replace(/\D/g, "").length >= 10;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            Quick Dial
          </DialogTitle>
          <DialogDescription>
            Enter a phone number to place an outbound call.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number *</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1 (555) 123-4567"
              value={phone}
              onChange={handlePhoneChange}
              className="font-mono text-lg"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Include country code for international numbers (e.g., +1 for US)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Contact Name (Optional)</Label>
            <Input
              id="name"
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleCall} disabled={!isValidPhone}>
            <PhoneCall className="h-4 w-4 mr-2" />
            Call Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
