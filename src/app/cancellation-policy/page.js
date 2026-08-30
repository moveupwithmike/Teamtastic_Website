import Link from "next/link";
import PolicyShell, { PolicySection } from "@/components/PolicyShell";
import { CANCELLATION_POLICY_TABLE } from "@/lib/cancellation-policy";

export const metadata = {
  title: "Cancellation, Refund & Rescheduling Policy | Teamtastic",
  description: "Teamtastic’s hosted-event cancellation, refund, and rescheduling terms, including the 100%, 50%, 25%, and 0% refund tiers and how they are calculated.",
  alternates: {
    canonical: "https://teamtastic.events/cancellation-policy",
  },
};

export default function CancellationPolicyPage() {
  return (
    <PolicyShell eyebrow="Teamtastic policies" title="Cancellation, Refund &amp; Rescheduling Policy" updated="August 29, 2026">
      <PolicySection title="Overview">
        <p>
          This policy applies to paid hosted events booked with Teamtastic. Refund eligibility is calculated from
          the <strong className="text-white">scheduled start time of your event, in the event’s time zone</strong>.
          The tier that applies is based on when you cancel compared with that start time.
        </p>
        <p>
          Planning calls are free to book, so no refund applies to them — see below for how to cancel or
          reschedule a call.
        </p>
      </PolicySection>

      <PolicySection title="Refund schedule">
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-white">
              <tr>
                <th className="px-4 py-3 font-bold">When you cancel</th>
                <th className="px-4 py-3 font-bold">Refund</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {CANCELLATION_POLICY_TABLE.map((row) => (
                <tr key={row.tier} className="text-zinc-300">
                  <td className="px-4 py-3">{row.appliesTo}</td>
                  <td className="px-4 py-3 font-bold text-white">{row.refundPercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PolicySection>

      <PolicySection title="What the refund is based on">
        <p>
          The refund percentage applies to the total amount you have paid to date for the event, including your
          deposit. For example, if you have paid a $200 deposit and then $800 of the balance, a 50% refund is $500.
        </p>
        <p>
          Timing is measured to the minute using the scheduled start time in the event’s time zone — the day of the
          week is not what matters; the exact start time is.
        </p>
      </PolicySection>

      <PolicySection title="Examples">
        <ul className="list-disc space-y-1.5 pl-6">
          <li>Event starts October 10 at 5:00 pm and you cancel October 2 — more than 7 days out — you receive a 100% refund.</li>
          <li>Event starts October 10 at 5:00 pm and you cancel October 7 at 6:00 pm (about 3 days out) — you receive a 50% refund.</li>
          <li>Event starts October 10 at 5:00 pm and you cancel October 9 at 6:00 pm (less than 48 hours out) — you receive a 25% refund.</li>
          <li>You cancel at 5:01 pm, after the event start time, or you never join — no refund.</li>
        </ul>
      </PolicySection>

      <PolicySection title="Rescheduling and transfers">
        <p>
          We want to accommodate schedule changes whenever we can. Rescheduling an event to a new date is permitted
          subject to availability. Depending on when the change is requested and the preparation already completed
          for your event, a rescheduling or transfer fee may apply. If you have questions about rescheduling, email
          hello@teamtastic.events before your event date.
        </p>
      </PolicySection>

      <PolicySection title="No-shows">
        <p>
          If an event takes place but you do not join, or if you cancel at or after the scheduled start time, no
          refund is available.
        </p>
      </PolicySection>

      <PolicySection title="How to cancel or reschedule a hosted event">
        <p>
          Email hello@teamtastic.events with your name and event details. We will confirm the applicable refund
          based on this policy and, where eligible, initiate the refund to your original payment method. Refund
          timing after that is set by Stripe and your bank or card provider.
        </p>
      </PolicySection>

      <PolicySection title="Planning calls">
        <p>
          Planning calls are free and can be canceled or rescheduled using the link in your confirmation email, or
          by emailing hello@teamtastic.events.
        </p>
      </PolicySection>

      <PolicySection title="Payment disputes">
        <p>
          If you believe a charge was made in error, contact us at hello@teamtastic.events before initiating a
          dispute with your bank. We will review your case under this policy and, where a refund is owed, issue it
          directly.
        </p>
      </PolicySection>

      <PolicySection title="Related documents">
        <p>
          This policy is the customer-facing version of the same refund tiers used by our team. It complements our{" "}
          <Link href="/terms" className="text-pink-300 underline decoration-pink-300/40 underline-offset-2 hover:text-pink-200">Terms of Service</Link> and{" "}
          <Link href="/privacy" className="text-pink-300 underline decoration-pink-300/40 underline-offset-2 hover:text-pink-200">Privacy Policy</Link>,
          and you can find summary answers in the{" "}
          <Link href="/resources/faq" className="text-pink-300 underline decoration-pink-300/40 underline-offset-2 hover:text-pink-200">FAQ</Link>.
        </p>
      </PolicySection>
    </PolicyShell>
  );
}