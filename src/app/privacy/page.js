import PolicyShell, { PolicySection } from "@/components/PolicyShell";

export const metadata = {
  title: "Privacy Policy | Teamtastic",
  description: "How Teamtastic collects, uses, and protects your information when you visit teamtastic.events, request an event quote, or book a hosted event.",
  alternates: {
    canonical: "https://teamtastic.events/privacy",
  },
};

export default function PrivacyPolicyPage() {
  return (
    <PolicyShell eyebrow="Teamtastic policies" title="Privacy Policy" updated="August 29, 2026">
      <PolicySection title="About this policy">
        <p>
          This policy explains what information Teamtastic collects, how it is used, and the choices you have.
          It applies to teamtastic.events and the enabled features it offers, including event quote requests,
          hosted-event bookings, deposits, planning calls, and self-service games.
        </p>
        <p>Questions about this policy can be sent to hello@teamtastic.events.</p>
      </PolicySection>

      <PolicySection title="Who we are">
        <p>
          Teamtastic is a small-business provider of live-hosted virtual team building events. This policy is
          operated by the Teamtastic team using the contact address above. If you ask about a booking, purchase,
          or privacy request, a real person will review it.
        </p>
      </PolicySection>

      <PolicySection title="Information you give us">
        <p>When you request a quote, reserve a date, book a planning call, or join a hosted event, we collect the information you submit, including:</p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li>Your name, email address, and company or family/group name.</li>
          <li>Event details you provide: team or group size, occasion, preferred vibe, preferred and alternate dates, time zone, preferred time, budget range, package interest, and decision timeline.</li>
          <li>Phone number, when you choose to provide it.</li>
          <li>Booking details for planning calls: your requested time and time zone.</li>
          <li>Anything else you write to us or include in a message or email.</li>
        </ul>
        <p>Payment details are collected by Stripe at checkout. We receive a confirmation of the transaction and the amount paid; we do not receive or store your full card number.</p>
      </PolicySection>

      <PolicySection title="Information collected automatically">
        <p>
          Like most websites, we collect technical information about visits, including the pages you view, the
          referring page, device and browser type, and your IP address. IP addresses and a Cloudflare Turnstile
          check are used to protect our forms from bots and to prevent abuse. See “Cookies and analytics” below
          for what depends on your consent.
        </p>
      </PolicySection>

      <PolicySection title="How we use your information">
        <ul className="list-disc space-y-1.5 pl-6">
          <li>To respond to your inquiry, prepare quotes and estimates, and follow up on your request.</li>
          <li>To reserve dates, send confirmations and reminders, and run hosted events you book.</li>
          <li>To arrange planning calls and send you booking confirmations and cancellation or rescheduling notices.</li>
          <li>To send service messages about your request, and occasional event ideas and offers unless you tell us to stop.</li>
          <li>To prevent fraud and abuse, keep the site secure, and improve our services.</li>
        </ul>
        <p>We never sell your personal information.</p>
      </PolicySection>

      <PolicySection title="Cookies, storage, and analytics">
        <p>
          We use a small amount of browser storage for consent choice and for analytics sessions. When you first
          visit, a consent notice explains our analytics use. In some regions we treat analytics as opt-in — no
          analytics or advertising tags run until you click “Accept.” Elsewhere analytics are on by default and you
          can opt out at any time using the same notice or by emailing us.
        </p>
        <p>Analytics use PostHog, which is loaded through a first-party endpoint on this domain. With your consent, advertising measurement may also be enabled for Meta (via the Meta Pixel) and Google (Google Analytics 4 and Google Ads conversion tracking).</p>
        <p>When you submit a lead form, a conversion event may be sent to these advertising tools. Form fields such as your name, email address, phone number, and message text are filtered out before analytics events are sent — analytics does not receive those details.</p>
      </PolicySection>

      <PolicySection title="Third-party services">
        <p>
          We use a small number of specialized services to operate the site. Each processes data under its own
          terms and practices, and each is limited to what is needed for the feature in question:
        </p>
        <ul className="list-disc space-y-1.5 pl-6">
          <li>Supabase — database and hosting that stores the information you submit.</li>
          <li>Stripe — payment processing and refunds at checkout.</li>
          <li>Resend — sending booking and service emails.</li>
          <li>Zoom and Google Calendar — scheduling and hosting planning calls.</li>
          <li>Cloudflare Turnstile — bot protection on forms.</li>
          <li>PostHog — analytics (consent-based, first-party proxy).</li>
          <li>Meta and Google — advertising measurement, only after consent is granted.</li>
          <li>Scheduling may, where configured, point to a third-party booking tool such as Calendly.</li>
        </ul>
        <p>Hosted events take place over the video conference platform your organization chooses. Teamtastic’s own software does not record events; recording behavior, if any, is controlled by the hosting organization.</p>
      </PolicySection>

      <PolicySection title="User-submitted content">
        <p>
          Quiz answers, captions, photos, and other content you contribute are used to run your event. We do not
          publish that content beyond your event or share it with other groups without permission. Content shared
          in an event should be office-appropriate and legally yours to share; the organizer is responsible for
          obtaining consent from anyone whose content or likeness is included.
        </p>
      </PolicySection>

      <PolicySection title="Children">
        <p>
          The service is provided to businesses and adults. It is not directed at children, and we do not knowingly
          collect information from children. Organizers who include minors in an event are responsible for
          obtaining any consent required of parents or guardians for that participation.
        </p>
      </PolicySection>

      <PolicySection title="Data retention">
        <p>
          We keep inquiry, booking, payment, and correspondence records for as long as needed to serve you, honor
          our cancellation and refund commitments, and maintain our business records. If you would like your data
          removed, email hello@teamtastic.events and we will review your request.
        </p>
      </PolicySection>

      <PolicySection title="Your choices and rights">
        <ul className="list-disc space-y-1.5 pl-6">
          <li>Withdraw or change analytics consent using the consent notice on the site.</li>
          <li>Opt out of promotional emails at any time by replying or emailing hello@teamtastic.events.</li>
          <li>Request access to, correction of, or deletion of your personal information by emailing us.</li>
          <li>Cancel or reschedule a booking using the link in your booking confirmation or by emailing us.</li>
        </ul>
        <p>We will act on verifiable requests and respond within a reasonable time.</p>
      </PolicySection>

      <PolicySection title="Transfer of data internationally">
        <p>
          The third-party services we use operate in various countries. As a result, your information may be
          processed outside the country where you are located. We rely on those services’ responsibility for data
          protection and on the measures that apply to the ways we use them.
        </p>
      </PolicySection>

      <PolicySection title="Security">
        <p>
          The site is served over HTTPS, which encrypts information in transit. Access to your information is
          limited to people who need it to operate Teamtastic, and payment card data is handled entirely by Stripe.
        </p>
      </PolicySection>

      <PolicySection title="Changes to this policy">
        <p>
          We may update this policy as the service changes. When we do, the updated version will be posted on this
          page with a new “Last updated” date. Significant changes will be called out to customers we can reach.
        </p>
      </PolicySection>

      <PolicySection title="Contact">
        <p>
          Privacy questions, requests, and complaints can be sent to hello@teamtastic.events. If you believe data
          has been mishandled, you may also contact the relevant supervisory authority in your jurisdiction.
        </p>
      </PolicySection>
    </PolicyShell>
  );
}