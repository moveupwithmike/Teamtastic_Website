import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";

export const metadata = {
  alternates: {
    canonical: "https://teamtastic.events/resources/faq",
  },
  title: "FAQ — Virtual Team Building Questions Answered | Teamtastic",
  description:
    "Answers to the most common questions about Teamtastic virtual team building events — from platform compatibility to pricing, group sizes, and emcee details.",
};

const categories = [
  {
    name: "Getting Started",
    faqs: [
      { q: "Do I need to create an account to play?", a: "Players never need an account. Only the host needs a Teamtastic account to create and manage lobbies. Players join via a shared link." },
      { q: "Does anything need to be downloaded?", a: "No. Teamtastic runs entirely in the browser. Nothing to install for hosts or players on any device." },
      { q: "How quickly can I launch a game?", a: "You can have an active game lobby running in under 60 seconds at teamtastic.games." },
      { q: "What devices are supported?", a: "Desktops, laptops, tablets, and mobile phones. Any device with a modern browser (Chrome, Safari, Firefox, Edge) works perfectly." },
    ],
  },
  {
    name: "Events & Games",
    faqs: [
      { q: "How many people can participate at once?", a: "The free tier supports up to 10 players. Custom professional packages support 15–200. VIP hosted events accommodate 50–500+ participants." },
      { q: "What types of games are available?", a: "Trivia, Survey Showdown (Family Feud style), Meme Battle, Sound Bite Trivia, Escape Rooms, and more. New formats are added regularly." },
      { q: "Can I customize questions for my company?", a: "Yes. You can upload custom question packs covering your company culture, industry knowledge, or any theme you choose." },
      { q: "Can I brand the games with our company logo and colors?", a: "Yes — all paid packages allow you to inject your company logo and color palette for a fully branded experience." },
      { q: "How long do events typically run?", a: "Events range from 20-minute warm-up sessions to 90-minute full productions. Most corporate sessions run 45–60 minutes." },
    ],
  },
  {
    name: "Platform & Compatibility",
    faqs: [
      { q: "Does Teamtastic work with Zoom?", a: "Yes. Run Teamtastic alongside any Zoom call. Share the game link in the Zoom chat and players join directly in their browser." },
      { q: "Does it work with Microsoft Teams?", a: "Yes. The same browser-link approach works perfectly with Microsoft Teams, Google Meet, Webex, and any other conferencing tool." },
      { q: "Do we need to share screens?", a: "For self-hosted sessions, the host typically shares their screen to show the main game stage. For VIP hosted events, the emcee manages all screen sharing." },
    ],
  },
  {
    name: "Pricing & Billing",
    faqs: [
      { q: "Is there a truly free option?", a: "Yes. You can launch a free lobby for up to 10 players at any time with no credit card required." },
      { q: "How do custom packages work?", a: "We quote based on your team size, event frequency, and level of emcee facilitation. Complete our Event Quiz to get a tailored quote in minutes." },
      { q: "Do you support purchase orders and corporate invoicing?", a: "Yes. All paid packages support PO numbers, formal invoicing, and structured corporate billing." },
      { q: "Is there a refund policy?", a: "Yes, based on when you cancel relative to your event's start time: 7+ days before, 100% refund. 48 hours to 7 days before, 50% refund. Less than 48 hours before, 25% refund. At or after the event start time, or a no-show, no refund. Rescheduling is available subject to availability, and may carry a transfer fee depending on timing and prep already completed. Full details and examples: https://teamtastic.events/cancellation-policy" },
    ],
  },
];

export default function FAQ() {
  return (
    <main className="flex flex-col min-h-screen bg-brand-dark">
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-900/20 via-zinc-950 to-zinc-950" />
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white">Frequently Asked Questions</h1>
          <p className="text-zinc-400">Everything you need to know before your first Teamtastic event.</p>
          <Link href="/#quiz" className="inline-flex items-center gap-1.5 text-sm text-purple-400 hover:text-purple-300 transition-colors">
            Can&apos;t find your answer? Take the Event Quiz <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="py-12 pb-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 space-y-12">
          {categories.map((cat) => (
            <div key={cat.name}>
              <h2 className="text-lg font-bold text-purple-400 uppercase tracking-wider mb-5">{cat.name}</h2>
              <div className="space-y-3">
                {cat.faqs.map((faq) => (
                  <div key={faq.q} className="glassmorphism rounded-2xl p-5 border border-white/5">
                    <div className="flex gap-3">
                      <ChevronDown className="h-5 w-5 text-purple-400 shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-bold text-white mb-1.5">{faq.q}</h3>
                        <p className="text-sm text-zinc-400 leading-relaxed">{faq.a}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: categories.flatMap((cat) =>
              cat.faqs.map((faq) => ({
                "@type": "Question",
                name: faq.q,
                acceptedAnswer: { "@type": "Answer", text: faq.a },
              }))
            ),
          }),
        }}
      />
    </main>
  );
}
