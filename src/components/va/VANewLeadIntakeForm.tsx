import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Send, UserPlus, MessageSquare } from "lucide-react";

const schema = z.object({
  business_name: z.string().trim().min(1, "Business name is required").max(160),
  contact_name: z.string().trim().max(120).optional().or(z.literal("")),
  phone: z
    .string()
    .trim()
    .min(7, "Phone is required")
    .max(20)
    .regex(/^[+()\-\s\d]+$/i, "Invalid phone number"),
  email: z.string().trim().email("Invalid email").max(200).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  onCreated?: () => void;
}

export function VANewLeadIntakeForm({ onCreated }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [smsSending, setSmsSending] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      business_name: "",
      contact_name: "",
      phone: "",
      email: "",
      city: "",
      state: "",
      notes: "",
    },
  });

  const buildSmsBody = (v: FormValues) =>
    [
      `New Lead: ${v.business_name}`,
      v.contact_name ? `Contact: ${v.contact_name}` : null,
      v.phone ? `Phone: ${v.phone}` : null,
      v.email ? `Email: ${v.email}` : null,
      v.city || v.state ? `Location: ${[v.city, v.state].filter(Boolean).join(", ")}` : null,
      v.notes ? `Notes: ${v.notes}` : null,
    ]
      .filter(Boolean)
      .join("\n");

  const onSubmit = async (values: FormValues) => {
    if (!user) {
      toast.error("Not signed in");
      return;
    }
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("brandaro_qualified_leads")
        .insert({
          business_name: values.business_name,
          contact_name: values.contact_name || null,
          phone_number: values.phone,
          email: values.email || null,
          city: values.city || null,
          state: values.state || null,
          notes: values.notes || null,
          assigned_va: user.id,
          lead_status: "new",
          source: "va_intake",
        });
      if (error) throw error;
      toast.success("Lead created");
      form.reset();
      onCreated?.();
    } catch (e: any) {
      toast.error(e.message || "Failed to create lead");
    } finally {
      setSaving(false);
    }
  };

  const handleSendSms = async () => {
    const valid = await form.trigger();
    if (!valid) {
      toast.error("Fix form errors before sending");
      return;
    }
    const values = form.getValues();
    setSmsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: {
          to_number: values.phone,
          message_body: buildSmsBody(values),
        },
      });
      if (error) throw error;
      if (data && data.success === false) {
        throw new Error(data.error_message || "SMS failed");
      }
      toast.success(`SMS sent to ${values.phone}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to send SMS");
    } finally {
      setSmsSending(false);
    }
  };

  return (
    <Card className="bg-slate-800/50 border border-slate-700 p-6 text-slate-100">
      <div className="flex items-center gap-2 mb-1">
        <UserPlus className="h-5 w-5 text-cyan-400" />
        <h2 className="text-lg font-bold text-white">New Lead Intake</h2>
      </div>
      <p className="text-xs text-slate-400 mb-5">
        Capture a new lead and optionally send the details by SMS.
      </p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="business_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300">Business name *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
                      placeholder="Acme Smoke Shop"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contact_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300">Contact name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
                      placeholder="Jane Doe"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300">Phone *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
                      placeholder="+1 555 123 4567"
                    />
                  </FormControl>
                  <FormDescription className="text-slate-500">
                    Used for calls and SMS.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300">Email</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
                      placeholder="owner@store.com"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300">City</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
                      placeholder="Miami"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300">State</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
                      placeholder="FL"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-300">Notes</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={4}
                    className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
                    placeholder="Anything worth remembering about this lead..."
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex flex-wrap gap-3 pt-2">
            <Button
              type="submit"
              disabled={saving}
              className="bg-cyan-600 hover:bg-cyan-700 text-white gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Save Lead
            </Button>
            <Button
              type="button"
              onClick={handleSendSms}
              disabled={smsSending}
              variant="outline"
              className="border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/10 hover:text-cyan-200 gap-2"
            >
              {smsSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageSquare className="h-4 w-4" />
              )}
              Send as SMS
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-slate-400 hover:text-white"
              onClick={() => form.reset()}
              disabled={saving || smsSending}
            >
              Reset
            </Button>
          </div>
        </form>
      </Form>
    </Card>
  );
}
