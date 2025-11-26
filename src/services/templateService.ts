import { supabase } from "@/integrations/supabase/client";

export interface TemplateVariables {
  [key: string]: string | number | Date;
}

/**
 * Render a template with variable substitution
 */
export function renderTemplate(content: string, variables: TemplateVariables): string {
  let rendered = content;
  
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`\\{${key}\\}`, "g");
    rendered = rendered.replace(regex, String(value));
  });
  
  return rendered;
}

/**
 * Get templates by brand and type
 */
export async function getTemplates(brand: string, templateType: string) {
  const { data, error } = await supabase
    .from("communication_templates")
    .select("*")
    .eq("brand", brand as any)
    .eq("template_type", templateType as any)
    .eq("is_active", true);

  if (error) throw error;
  return data;
}

/**
 * Get a specific template by category
 */
export async function getTemplateByCategory(
  brand: string,
  templateType: string,
  category: string
) {
  const { data, error } = await supabase
    .from("communication_templates")
    .select("*")
    .eq("brand", brand as any)
    .eq("template_type", templateType as any)
    .eq("category", category as any)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Render and send SMS using template
 */
export async function sendSMSFromTemplate(
  brand: string,
  category: string,
  phoneNumber: string,
  variables: TemplateVariables
) {
  const template = await getTemplateByCategory(brand, "sms", category);
  const message = renderTemplate(template.content, variables);

  // TODO: Integrate with actual SMS service
  console.log("Sending SMS:", { phoneNumber, message });
  
  return { success: true, message };
}

/**
 * Render and send email using template
 */
export async function sendEmailFromTemplate(
  brand: string,
  category: string,
  email: string,
  variables: TemplateVariables
) {
  const template = await getTemplateByCategory(brand, "email", category);
  const subject = template.subject ? renderTemplate(template.subject, variables) : "";
  const body = renderTemplate(template.content, variables);

  // TODO: Integrate with actual email service
  console.log("Sending Email:", { email, subject, body });
  
  return { success: true, subject, body };
}

/**
 * Get call script for AI agent
 */
export async function getCallScript(brand: string, category: string, variables: TemplateVariables) {
  const template = await getTemplateByCategory(brand, "call_script", category);
  const script = renderTemplate(template.content, variables);
  
  return script;
}

/**
 * Get brand tone configuration
 */
export async function getBrandTone(brand: string) {
  const { data, error } = await supabase
    .from("communication_templates")
    .select("*")
    .eq("brand", brand as any)
    .eq("template_type", "tone_pack" as any)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (error) {
    // Return default tone if no tone pack exists
    return {
      style: "professional",
      voice: "friendly",
      personality: "helpful",
    };
  }

  return data.tone_config || {};
}

/**
 * Bulk send SMS to multiple recipients using template
 */
export async function bulkSendSMS(
  brand: string,
  category: string,
  recipients: Array<{ phoneNumber: string; variables: TemplateVariables }>
) {
  const template = await getTemplateByCategory(brand, "sms", category);
  
  const results = await Promise.all(
    recipients.map(async ({ phoneNumber, variables }) => {
      try {
        const message = renderTemplate(template.content, variables);
        // TODO: Integrate with actual SMS service
        console.log("Bulk SMS:", { phoneNumber, message });
        return { phoneNumber, success: true };
      } catch (error) {
        return { phoneNumber, success: false, error };
      }
    })
  );

  return results;
}
