import PolicyShell, { PolicySection } from "@/components/PolicyShell";
import Link from "next/link";

export const metadata = {
  title: "Terms of Service | Teamtastic",
  description: "The terms that apply when you request a quote, book a hosted Teamtastic event, make a payment, or use teamtastic.events.",
  alternates: {
    canonical: "https://teamtastic.events/terms",
  },
};

export default function TermsPage() {
  return (
    <PolicyShell eyebrow="Teamtastic policies" title="Terms of Service" updated="August 29, 2026">
      <PolicySection title="Acceptance of these terms">
        <p>
          By using teamtastic.events, submitting an inquiry, booking an event, or making a payment, you agree to
          these Terms of Service. If you are booking on behalf of a company or organization, you confirm that you
          are authorized to accept these terms on its behalf.
        </p>
      </PolicySection>

      <PolicySection title="Our services">
        <p>
          Teamtastic provides live-hosted virtual team building events for businesses and groups, self-service
          online games, event planning and quoting, and planning calls. Everything we promise about a specific
          event is set out in writing before the event — in a proposal, quote, or confirmation — and these terms
          apply unless the written documents say otherwise.
        </p>
      </PolicySection>

      <PolicySection title="Quotes, pricing, and payment">
        <p>
          Estimates produced by our pricing quiz are estimates, not final quotes. Final pricing is confirmed in a
          written quote for your event.
        </p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li>Event deposits reserve your date and are applied to your total. For hosted events the deposit is $200; for family events it is $100, unless your quote says otherwise.</li>
          <li>The remaining balance is invoiced according to your quote.</li>
          <li>Payments are processed by Stripe, a third-party payment processor. Payment card data is handled by Stripe under its own terms.</li>
          <li>Corporate billing supports purchase orders, structured invoicing, and standard expense-approval workflows where arranged in writing.</li>
          <li>Add-ons you select are priced at the time of your quote.</li>
        </ul>
      </PolicySection>

      <PolicySection title="Cancellations, refunds, and rescheduling">
        <p>
          Cancellation and refund eligibility for hosted events follows our{" "}
          <Link href="/cancellation-policy" className="text-pink-300 underline decoration-pink-300/40 underline-offset-2 hover:text-pink-200">Cancellation, Refund &amp; Rescheduling Policy</Link>.
          Refunds are calculated from the total amount you have paid, including any deposit, and are based on the
          scheduled start time of your event in the event’s time zone.
        </p>
        <p>
          Planning calls are free to book, and can be canceled or rescheduled using the link in your confirmation
          email or by emailing hello@teamtastic.events.
        </p>
      </PolicySection>

      <PolicySection title="Your responsibilities">
        <ul className="list-disc space-y-1.5 pl-6">
          <li>Provide accurate contact and event information.</li>
          <li>Ensure content contributed to an event (answers, captions, photos, jokes) is office-appropriate, not unlawful, and legally yours to share.</li>
          <li>Obtain any consent needed from participants, including consent for minors in your group.</li>
          <li>Follow your host’s guidance and the rules of the video platform you use.</li>
        </ul>
        <p>
          Content that is unlawful, harassing, defamatory, or disruptive may be removed, and Teamtastic may decline
          or end participation in that case without a refund for the affected event.
        </p>
      </PolicySection>

      <PolicySection title="User content and intellectual property">
        <p>
          You keep the rights to content you contribute. By contributing content to an event, you grant Teamtastic
          a limited license to use it to run that event and related services.
        </p>
        <p>
          Our games, rounds, hosting materials, branding, and site content are Teamtastic’s, and may not be
          reproduced, recorded and redistributed, or resold without our written permission.
        </p>
      </PolicySection>

      <PolicySection title="Third-party services">
        <p>
          Video and conference platforms, payment processing, email delivery, and other third-party services have
          their own terms and privacy practices. Your use of each is subject to that provider’s terms. See our{" "}
          <Link href="/privacy" className="text-pink-300 underline decoration-pink-300/40 underline-offset-2 hover:text-pink-200">Privacy Policy</Link> for the services we use.
        </p>
      </PolicySection>

      <PolicySection title="Availability and disclaimers">
        <p>
          Event dates and times are subject to availability and are held only once a deposit or signed quote is in
          place. Our services are provided “as is” and “as available.” To the extent permitted by law, we do not
          warrant that the service will be uninterrupted or error-free.
        </p>
      </PolicySection>

      <PolicySection title="Limitation of liability">
        <p>
          To the extent permitted by law, Teamtastic’s total liability for any claim related to your use of the
          service or participation in an event is limited to the amount you paid us in the 12 months before the
          claim. We are not liable for indirect, incidental, or consequential damages, including lost profits or
          business opportunity.
        </p>
      </PolicySection>

      <PolicySection title="Indemnification">
        <p>
          To the extent permitted by law, you agree to indemnify Teamtastic against claims that arise from content
          you contribute to an event or from your breach of these terms.
        </p>
      </PolicySection>

      <PolicySection title="Governing law">
        <p>
          These terms are governed by the laws of the jurisdiction where Teamtastic is established. Teamtastic is
          a small business, and when its legal entity details are published, this section will be updated to name
          the governing state and jurisdiction. Until then, disputes will be resolved in good faith by emailing
          hello@teamtastic.events.
        </p>
      </PolicySection>

      <PolicySection title="Changes to these terms">
        <p>
          We may update these terms as the service evolves. Updated terms will be posted on this page with a new
          “Last updated” date and apply to activity after that date.
        </p>
      </PolicySection>

      <PolicySection title="Contact">
        <p>
          Questions about these terms can be sent to hello@teamtastic.events.
        </p>
      </PolicySection>
    </PolicyShell>
  );
}