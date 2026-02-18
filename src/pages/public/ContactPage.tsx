import { Mail, MapPin, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

/**
 * ContactPage — Public contact page
 * SEO-friendly, no auth required
 */
export default function ContactPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 space-y-16">
      <section className="text-center space-y-4">
        <h1 className="text-4xl font-black text-foreground tracking-tight">
          Get In <span className="text-primary">Touch</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          Have questions about wholesale pricing, becoming an ambassador, or partnering with us? We'd love to hear from you.
        </p>
      </section>

      <div className="grid md:grid-cols-2 gap-12">
        {/* Contact Form */}
        <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="Your name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea id="message" placeholder="How can we help?" rows={5} />
          </div>
          <Button type="submit" className="w-full">Send Message</Button>
        </form>

        {/* Contact Info */}
        <div className="space-y-6">
          {[
            { icon: Mail, label: 'Email', value: 'info@gasmask.com' },
            { icon: Phone, label: 'Phone', value: '(555) 123-4567' },
            { icon: MapPin, label: 'Location', value: 'New York, NY' },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-4 p-4 rounded-xl border border-border bg-card">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-sm text-muted-foreground">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
