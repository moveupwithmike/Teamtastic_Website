import Pricing from "@/components/Pricing";
import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";

export const metadata = {
  title: "Pricing — Virtual Team Building Plans for Every Team | Teamtastic",
  description:
    "Teamtastic pricing: Free self-service arcade for small teams, custom professional packages, and fully hosted VIP events. Get a quote tailored to your team size and budget.",
  openGraph: {
    title: "Teamtastic Pricing | Virtual Team Building Plans",
    description: "Free arcade play up to 10 players. Custom quotes for professional and VIP hosted corporate events. No hidden fees.",
    url: "https://teamtastic.events/pricing",
  },
};

const faqs = [
  { q: "Is there a free plan?", a: "Yes — you can launch a free lobby for up to 10 players with no credit card at teamtastic.games. Standard games are available immediately." },
  { q: "How is pricing determined for larger events?", a: "Professional and VIP packages are priced based on team size, event duration, frequency, and level of emcee facilitation. Complete our Event Quiz to get a custom quote in minutes." },
  { q: "Do you support corporate invoicing or purchase orders?", a: "Yes. All paid packages support formal B2B invoicing, PO numbers, and structured billing for finance team approval." },
  { q: "What's the difference between Professional and VIP?", a: "Professional packages support recurring self-hosted or lightly assisted events. VIP packages feature our founder as a dedicated live Master Emcee for the entire event." },
  { q: "Is there a minimum team size?", a: "No minimum for the free tier. Professional packages are optimized for teams of 15–200. VIP hosted events typically serve 50–500+ participants." },
];

export default function PricingPage() {
  return (
    <main className="flex flex-col min-h-screen bg-brand-dark">
      {/* Page Header */}
      <section className="relative pt-24 pb-4 overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-pink-900/20 via-zinc-950 to-zinc-950" />
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-zinc-400 max-w-xl mx-auto">
            Start free. Scale when you need it. Every custom package includes a free 15-minute consultation.
          </p>
        </div>
      </section>

      {/* Reuse Pricing Component */}
      <Pricing />

      {/* Pricing FAQ */}
      <section className="py-16 bg-zinc-950/40 border-t border-white/5">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-extrabold text-white text-center mb-10">Pricing FAQs</h2>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <div key={faq.q} className="glassmorphism rounded-2xl p-6 border border-white/5">
                <h3 className="font-bold text-white mb-2">{faq.q}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 text-center">
        <div className="space-y-4">
          <p className="text-zinc-400 text-sm flex items-center justify-center gap-2">
            <MessageCircle className="h-4 w-4 text-purple-400" />
            Still have questions? Take the quiz and we&apos;ll follow up personally.
          </p>
          <Link
            href="/#quiz"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-[0_0_25px_rgba(139,92,246,0.4)] transition-all duration-300 hover:-translate-y-1"
          >
            Get Your Custom Quote <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </main>
  );
}
