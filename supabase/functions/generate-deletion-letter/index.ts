import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const BUREAU_ADDRESSES: Record<string, string> = {
  Equifax: "Equifax Information Services LLC\nP.O. Box 740256\nAtlanta, GA 30374",
  Experian: "Experian\nP.O. Box 4500\nAllen, TX 75013",
  TransUnion: "TransUnion LLC\nConsumer Dispute Center\nP.O. Box 2000\nChester, PA 19016",
};

const CHEXSYSTEMS_ADDRESS = "ChexSystems, Inc.\nAttn: Consumer Relations\nP.O. Box 583399\nMinneapolis, MN 55458";

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function generateBureauLetter(r: any): string {
  const today = formatDate();
  const bureauAddr = BUREAU_ADDRESSES[r.bureau] || BUREAU_ADDRESSES.TransUnion;

  const templates: Record<string, string> = {
    standard_deletion: `${today}

${r.full_name}
${r.address || ""}
${r.city || ""}, ${r.state || ""} ${r.zip || ""}

${bureauAddr}

Re: Dispute of Inaccurate Information — Request for Deletion
SSN (Last 4): XXX-XX-${r.ssn_last4 || "XXXX"}
Date of Birth: ${r.date_of_birth || "N/A"}

To Whom It May Concern:

I am writing pursuant to my rights under the Fair Credit Reporting Act, Section 611(a), to formally dispute the following inaccurate information appearing on my credit report.

Account Number: ${r.account_number || "N/A"}
Creditor/Furnisher: ${r.creditor_name || "N/A"}
Reason for Dispute: ${r.dispute_reason || "This information is inaccurate and does not belong on my credit report."}

Under the FCRA §611(a), you are required to conduct a reasonable reinvestigation of this disputed item within 30 days of receiving this notice. If you are unable to verify the accuracy of this information, it must be promptly deleted from my credit file.

I request that you:
1. Investigate this disputed item immediately
2. Forward all relevant documentation to the furnisher
3. Delete the item if it cannot be verified
4. Send me an updated copy of my credit report reflecting any changes

Thank you for your prompt attention to this matter.

Sincerely,

____________________________
${r.full_name}`,

    goodwill: `${today}

${r.full_name}
${r.address || ""}
${r.city || ""}, ${r.state || ""} ${r.zip || ""}

${r.creditor_name || "Creditor"}
${bureauAddr}

Re: Goodwill Adjustment Request
Account Number: ${r.account_number || "N/A"}

To Whom It May Concern:

I am writing to respectfully request a goodwill adjustment to remove the negative reporting associated with the above-referenced account.

I acknowledge that this account was previously delinquent. However, I have since brought the account current and have maintained a consistent payment history. The circumstances that led to the late payment were temporary and have been fully resolved.

Reason: ${r.dispute_reason || "I experienced a temporary financial hardship that has since been resolved."}

I value my relationship with your organization and hope you will consider this goodwill adjustment as a reflection of my commitment to financial responsibility.

Thank you for your time and consideration.

Sincerely,

____________________________
${r.full_name}
SSN (Last 4): XXX-XX-${r.ssn_last4 || "XXXX"}`,

    cease_desist: `${today}

${r.full_name}
${r.address || ""}
${r.city || ""}, ${r.state || ""} ${r.zip || ""}

${r.creditor_name || "Collection Agency"}

Re: Cease and Desist Notice
Account Number: ${r.account_number || "N/A"}

CEASE AND DESIST

To Whom It May Concern:

Pursuant to my rights under the Fair Debt Collection Practices Act (FDCPA), 15 U.S.C. § 1692c, I am formally demanding that you immediately cease and desist all communication with me regarding the above-referenced account.

This includes but is not limited to:
- Phone calls to my home, work, or mobile phone
- Letters, emails, or text messages
- Contact with third parties regarding this debt
- Any further collection activity

${r.dispute_reason || "I dispute the validity of this debt in its entirety."}

Any further contact after receipt of this letter will be considered a violation of federal law and may result in legal action.

This letter is not an acknowledgment of the debt.

Sincerely,

____________________________
${r.full_name}
Date of Birth: ${r.date_of_birth || "N/A"}`,

    debt_validation: `${today}

${r.full_name}
${r.address || ""}
${r.city || ""}, ${r.state || ""} ${r.zip || ""}

${r.creditor_name || "Collection Agency"}

Re: Debt Validation Request Under FDCPA §809(b)
Account Number: ${r.account_number || "N/A"}
SSN (Last 4): XXX-XX-${r.ssn_last4 || "XXXX"}

To Whom It May Concern:

Pursuant to my rights under the Fair Debt Collection Practices Act, Section 809(b), I am formally requesting validation of the above-referenced debt.

Please provide the following:
1. The amount of the debt and how it was calculated
2. The name and address of the original creditor
3. A copy of the original signed agreement or contract
4. Proof that you are licensed to collect debts in my state
5. Proof that the statute of limitations has not expired
6. A complete payment history from the original creditor

${r.dispute_reason || "I dispute this debt and request full validation before any further collection activity."}

Under the FDCPA, you must cease all collection activity until you have provided adequate validation of this debt. Failure to validate will require deletion of this item from all credit reporting agencies.

Sincerely,

____________________________
${r.full_name}`,

    method_of_verification: `${today}

${r.full_name}
${r.address || ""}
${r.city || ""}, ${r.state || ""} ${r.zip || ""}

${bureauAddr}

Re: Method of Verification Request — FCRA §611(a)(6)(B)(iii)
SSN (Last 4): XXX-XX-${r.ssn_last4 || "XXXX"}
Date of Birth: ${r.date_of_birth || "N/A"}

To Whom It May Concern:

I previously disputed the following item on my credit report, and you reported that it was "verified" as accurate.

Account Number: ${r.account_number || "N/A"}
Creditor/Furnisher: ${r.creditor_name || "N/A"}

Pursuant to FCRA §611(a)(6)(B)(iii) and §611(a)(7), I am requesting a detailed description of the method of verification you used to confirm this item, including:

1. The name, address, and telephone number of the furnisher contacted
2. The specific documents or records reviewed
3. The dates of communication with the furnisher
4. The exact method used to verify the accuracy of this information

${r.dispute_reason || "I maintain that this information is inaccurate and request full transparency regarding your verification process."}

If you are unable to provide this information within 15 days, I request that this item be permanently deleted from my credit file.

Sincerely,

____________________________
${r.full_name}`,
  };

  return templates[r.letter_type] || templates.standard_deletion;
}

function generateChexSystemsLetter(r: any): string {
  const today = formatDate();

  const templates: Record<string, string> = {
    dispute: `${today}

${r.full_name}
${r.address || ""}
${r.city || ""}, ${r.state || ""} ${r.zip || ""}

${CHEXSYSTEMS_ADDRESS}

Re: Formal Dispute of Inaccurate ChexSystems Record
File Number: ${r.chexsystems_file_number || "N/A"}
SSN (Last 4): XXX-XX-${r.ssn_last4 || "XXXX"}
Date of Birth: ${r.date_of_birth || "N/A"}

To Whom It May Concern:

I am writing to formally dispute the following inaccurate information appearing on my ChexSystems consumer report, pursuant to my rights under the Fair Credit Reporting Act (FCRA).

Reporting Bank: ${r.chexsystems_reporting_bank || "N/A"}
Item Description: ${r.chexsystems_item_description || "N/A"}
Amount Owed: $${r.chexsystems_amount_owed || "0.00"}
Dispute Type: ${r.chexsystems_dispute_type || "Inaccurate"}

This information is ${r.chexsystems_dispute_type || "inaccurate"} and I request that you investigate this item and remove it from my file if it cannot be verified within 30 days as required by the FCRA §611.

Please send me an updated copy of my ChexSystems report upon completion of your investigation.

Sincerely,

____________________________
${r.full_name}`,

    early_removal: `${today}

${r.full_name}
${r.address || ""}
${r.city || ""}, ${r.state || ""} ${r.zip || ""}

${CHEXSYSTEMS_ADDRESS}

Re: Request for Early Removal of ChexSystems Record
File Number: ${r.chexsystems_file_number || "N/A"}
SSN (Last 4): XXX-XX-${r.ssn_last4 || "XXXX"}

To Whom It May Concern:

I am writing to request the early removal of a record from my ChexSystems consumer report.

Reporting Bank: ${r.chexsystems_reporting_bank || "N/A"}
Item Description: ${r.chexsystems_item_description || "N/A"}
Original Amount: $${r.chexsystems_amount_owed || "0.00"}
Report Date: ${r.chexsystems_report_date || "N/A"}

I understand that ChexSystems records are typically retained for five years. However, I have taken significant steps to rehabilitate my banking history, including:

1. Resolving any outstanding balances with the reporting institution
2. Maintaining responsible banking practices
3. Demonstrating good faith financial behavior

I respectfully request that this record be removed early in light of these rehabilitation efforts. I am prepared to provide documentation of resolved balances upon request.

Sincerely,

____________________________
${r.full_name}`,

    identity_theft_claim: `${today}

${r.full_name}
${r.address || ""}
${r.city || ""}, ${r.state || ""} ${r.zip || ""}

${CHEXSYSTEMS_ADDRESS}

Re: Identity Theft Claim — Request for Block Under FCRA §605B
File Number: ${r.chexsystems_file_number || "N/A"}
SSN (Last 4): XXX-XX-${r.ssn_last4 || "XXXX"}
Date of Birth: ${r.date_of_birth || "N/A"}

To Whom It May Concern:

I am a victim of identity theft and I am writing to request that the following fraudulent information be blocked from my ChexSystems consumer report pursuant to FCRA Section 605B.

Reporting Bank: ${r.chexsystems_reporting_bank || "N/A"}
Fraudulent Item: ${r.chexsystems_item_description || "N/A"}
Amount: $${r.chexsystems_amount_owed || "0.00"}

I did not open this account, authorize any transactions on this account, or benefit from this account in any way. This account was opened as a result of identity theft.

Enclosed please find:
- A copy of my FTC Identity Theft Report
- A copy of my government-issued photo identification
- Proof of my current address

Under FCRA §605B, you are required to block this information within 4 business days of receiving this notice and the required documentation.

Please also note my FTC report in my consumer file for future reference.

Sincerely,

____________________________
${r.full_name}`,

    opt_out: `${today}

${r.full_name}
${r.address || ""}
${r.city || ""}, ${r.state || ""} ${r.zip || ""}

${CHEXSYSTEMS_ADDRESS}

Re: Opt-Out Request and Security Freeze
File Number: ${r.chexsystems_file_number || "N/A"}
SSN (Last 4): XXX-XX-${r.ssn_last4 || "XXXX"}
Date of Birth: ${r.date_of_birth || "N/A"}

To Whom It May Concern:

I am writing to exercise my rights under the Fair Credit Reporting Act to:

1. OPT-OUT: I request that ChexSystems cease sharing my consumer report information with third parties for prescreened offers and marketing purposes, as permitted under FCRA §604.

2. SECURITY FREEZE: I request that a security freeze be placed on my ChexSystems consumer file. No consumer report should be released to any third party without my express authorization.

Please confirm in writing that both the opt-out and security freeze have been applied to my file.

If a PIN or password is required to lift the freeze in the future, please provide it to me at the address above.

Sincerely,

____________________________
${r.full_name}`,
  };

  return templates[r.chexsystems_letter_type] || templates.dispute;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { recipient_id } = await req.json();
    if (!recipient_id) {
      return new Response(JSON.stringify({ error: "recipient_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: recipient, error } = await supabase
      .from("deletion_letter_recipients")
      .select("*")
      .eq("id", recipient_id)
      .single();

    if (error || !recipient) {
      return new Response(JSON.stringify({ error: "Recipient not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let letter: string;
    if (recipient.is_chexsystems) {
      letter = generateChexSystemsLetter(recipient);
    } else {
      letter = generateBureauLetter(recipient);
    }

    // Save generated letter
    await supabase
      .from("deletion_letter_recipients")
      .update({ generated_letter: letter, generated_at: new Date().toISOString(), letter_status: "ready_to_send" })
      .eq("id", recipient_id);

    return new Response(JSON.stringify({ success: true, letter }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
