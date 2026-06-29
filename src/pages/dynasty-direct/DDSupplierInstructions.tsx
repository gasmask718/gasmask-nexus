// Dynasty Direct — Supplier shipping instructions
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Truck, FileText, Camera, MessageCircle } from "lucide-react";

export default function DDSupplierInstructions() {
  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Package className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">📦 Shipping Instructions for Suppliers</h1>
          <p className="text-sm text-muted-foreground">Everything you need to fulfill Dynasty Direct orders.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="w-5 h-5" /> How it works
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>When you receive a new order:</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Pack the items securely</li>
            <li>Print the packing slip</li>
            <li>Schedule a carrier pickup</li>
            <li>Ship within 2 business days</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Carrier pickup guide</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-5">
          <Carrier
            name="UPS Daily Pickup"
            url="https://www.ups.com/dropoff"
            bullets={[
              "Schedule a pickup at your location",
              "UPS comes to your door daily",
              "Cost: ~$4–8 per pickup",
              "Free drop-off at any UPS Store",
            ]}
          />
          <Carrier
            name="FedEx Daily Pickup"
            url="https://www.fedex.com/en-us/shipping/schedule-pickup.html"
            bullets={[
              "Schedule recurring daily pickup",
              "FedEx driver comes every day",
              "Free drop-off at FedEx Office",
            ]}
          />
          <Carrier
            name="USPS Carrier Pickup"
            url="https://tools.usps.com/schedule-pickup-steps.htm"
            bullets={[
              "Free carrier pickup from your address",
              "Next-day scheduling available",
              "Most convenient for small packages",
            ]}
          />
          <Carrier
            name="DHL Express"
            url="https://www.dhl.com/us-en/home/get-a-quote.html"
            bullets={[
              "Schedule pickup online",
              "Good for international shipments",
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Camera className="w-5 h-5" /> Packing requirements
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <ol className="list-decimal pl-5 space-y-1">
            <li>Pack each order separately</li>
            <li>Include the packing slip inside</li>
            <li>Seal securely with tape</li>
            <li>Write the Dynasty Direct order reference on the outside</li>
            <li>Take a photo before sealing (in case of damage claims)</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tracking requirements</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>After shipping you <strong>must</strong>:</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Get the tracking number from the carrier</li>
            <li>
              Reply to your order notification: text <code>DONE [tracking number]</code> to
              our WhatsApp line, or enter it in your supplier portal.
            </li>
            <li>We notify the customer automatically once tracking is received.</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-5 h-5" /> Packing slip
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>
            A branded packing slip is generated automatically for every order. Open the
            order in your supplier portal and click <strong>Print packing slip</strong>.
          </p>
          <p className="text-muted-foreground text-xs">
            Slip includes: Dynasty Direct order #, product name + quantity, customer name
            (no customer address on standard orders).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="w-5 h-5" /> Contact us
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p>Questions about an order?</p>
          <p>Email: <a className="underline" href="mailto:suppliers@dynastydirect.com">suppliers@dynastydirect.com</a></p>
          <p>WhatsApp: Reply to any order notification.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function Carrier({ name, url, bullets }: { name: string; url: string; bullets: string[] }) {
  return (
    <div>
      <div className="font-semibold">
        {name} — <a href={url} target="_blank" rel="noreferrer" className="text-primary underline">{url.replace(/^https?:\/\//, "")}</a>
      </div>
      <ul className="list-disc pl-5 mt-1 text-muted-foreground space-y-0.5">
        {bullets.map((b) => <li key={b}>{b}</li>)}
      </ul>
    </div>
  );
}
