/**
 * PrivacyPolicyPage — Public privacy policy (required for A2P 10DLC approval).
 * Publicly accessible at /privacy. Includes the mandatory carrier phrase:
 * "No mobile information will be shared with third parties for marketing."
 */
export default function PrivacyPolicyPage() {
  const updated = 'July 17, 2026';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 text-foreground">
      <header className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mt-2">Last updated: {updated}</p>
      </header>

      <section className="space-y-4 text-sm sm:text-base leading-relaxed">
        <p>
          GasMask ("we", "us", "our") respects your privacy. This Privacy Policy
          explains what information we collect, how we use it, and the choices
          you have. By using our website, services, or messaging programs, you
          agree to this Policy.
        </p>

        <h2 className="text-xl font-semibold pt-4">Information We Collect</h2>
        <p>
          We collect information you provide directly to us, including your
          name, business name, email address, phone number, shipping address,
          and order details. We also collect limited technical information
          (device, browser, IP address) when you interact with our site.
        </p>

        <h2 className="text-xl font-semibold pt-4">How We Use Your Information</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>To process orders, deliveries, invoices, and payments.</li>
          <li>To provide customer support and account notifications.</li>
          <li>To send transactional and, with consent, marketing messages.</li>
          <li>To improve our products, services, and website.</li>
          <li>To comply with legal, tax, and regulatory obligations.</li>
        </ul>

        <h2 className="text-xl font-semibold pt-4">SMS / Text Messaging</h2>
        <p>
          When you opt in to our SMS program you may receive messages such as
          order confirmations, delivery updates, reorder reminders, account
          notifications, and — where you have consented — promotional offers.
          Message frequency varies. Message and data rates may apply. Reply{' '}
          <strong>HELP</strong> for help or <strong>STOP</strong> to unsubscribe
          at any time.
        </p>
        <p className="font-semibold">
          No mobile information will be shared with third parties for marketing.
        </p>
        <p>
          Mobile opt-in data and consent are not shared with any third party for
          their own marketing purposes. We share phone numbers only with the
          service providers that help us deliver messages you have requested
          (for example, our SMS carrier and telecommunications vendors), and
          only for the limited purpose of delivering those messages.
        </p>

        <h2 className="text-xl font-semibold pt-4">How We Share Information</h2>
        <p>
          We do not sell your personal information. We share information only
          with service providers who help us operate our business (payments,
          shipping, hosting, SMS delivery, analytics), or when required by law.
          These providers are contractually limited to using your information
          only to perform services for us.
        </p>

        <h2 className="text-xl font-semibold pt-4">Data Retention</h2>
        <p>
          We retain your information for as long as your account is active or as
          needed to provide services, comply with legal obligations, resolve
          disputes, and enforce our agreements.
        </p>

        <h2 className="text-xl font-semibold pt-4">Your Choices</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>You may opt out of marketing SMS at any time by replying STOP.</li>
          <li>You may request access, correction, or deletion of your data.</li>
          <li>You may unsubscribe from marketing emails via the link in any email.</li>
        </ul>

        <h2 className="text-xl font-semibold pt-4">Security</h2>
        <p>
          We use reasonable administrative, technical, and physical safeguards
          designed to protect your information. No method of transmission or
          storage is 100% secure.
        </p>

        <h2 className="text-xl font-semibold pt-4">Children's Privacy</h2>
        <p>
          Our services are intended for adults operating retail businesses. We
          do not knowingly collect information from children under 13.
        </p>

        <h2 className="text-xl font-semibold pt-4">Changes to this Policy</h2>
        <p>
          We may update this Policy from time to time. Material changes will be
          reflected by updating the "Last updated" date above.
        </p>

        <h2 className="text-xl font-semibold pt-4">Contact Us</h2>
        <p>
          Questions about this Policy or your data? Email{' '}
          <a href="mailto:support@gasmask.com" className="text-primary underline">
            support@gasmask.com
          </a>{' '}
          or visit our{' '}
          <a href="/contact" className="text-primary underline">contact page</a>.
        </p>
      </section>
    </div>
  );
}
