import Pricing from "@/components/Pricing";
import Link from "next/link";
import { ArrowRight, HelpCircle } from "lucide-react";

export const metadata = {
  title: "Pricing — Virtual Team Building Plans for Every Team | Teamtastic",
  description:
    "Not just a game. An experience. Live-hosted team events with high-energy MC facilitation, custom inside jokes, music, and virtual confetti. Custom B2B pricing from $35-$65 per person.",
  alternates: {
    canonical: "https://teamtastic.events/pricing",
  },
  openGraph: {
    title: "Teamtastic Pricing | Virtual Team Building Plans",
    description: "Live-hosted virtual corporate events led by professional comedically-trained emcees. Transparent rates from $35-$65/pp. Enforce $400 minimum.",
    url: "https://teamtastic.events/pricing",
  },
};

const faqs = [
  { 
    q: "What if my team is small?", 
    a: "We welcome groups of all sizes! We use a base event minimum fee of $400 so that small squads get the complete premium professional emcee host experience without any quality compromises." 
  },
  { 
    q: "Can you customize the games to our company?", 
    a: "Absolutely. With our Custom Theme Build addon, we inject your custom brand palette, corporate logo assets, customized question slides, inside company jokes, and specific player shoutouts right into the game show dashboard." 
  },
  { 
    q: "Do you support international or global teams?", 
    a: "Yes! We run virtual team builders globally across every single time zone. We also offer Snack and Prop Kit shipping internationally (advance shipping timelines apply)." 
  },
  { 
    q: "What video platforms do you support?", 
    a: "We support Zoom, Microsoft Teams, Webex, Google Meet, and custom browser streams. We handle all room pacing so your organizers can sit back and laugh alongside the team." 
  },
  { 
    q: "How does billing and invoicing work?", 
    a: "We offer B2B corporate billing! All corporate packages support formal purchase orders, structured invoicing, secure deposit payments, and standard expense approval workflows." 
  },
];

export default function PricingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Teamtastic Virtual Team-Building",
    "areaServed": "Global",
    "provider": {
      "@type": "Organization",
      "name": "Teamtastic"
    },
    "offers": {
      "@type": "AggregateOffer",
      "priceCurrency": "USD",
      "lowPrice": "35",
      "highPrice": "65",
      "priceSpecification": [
        {
          "@type": "UnitPriceSpecification",
          "price": "35-65",
          "unitText": "per person"
        }
      ]
    }
  };

  return (
    <main className="flex flex-col min-h-screen bg-brand-dark pt-12">
      {/* JSON-LD Schema for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Page Header */}
      <section className="relative pt-20 pb-4 overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-purple/10 via-zinc-950 to-zinc-950" />
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Pick a core package matching your event structure, then tailor it with fun, dynamic add-ons below. Every hosted session is run live by an energetic comedically-trained MC.
          </p>
        </div>
      </section>

      {/* Overhauled Pricing & Calculator Component */}
      <div className="pb-16">
        <Pricing />
      </div>

      {/* Overhauled Pricing FAQ */}
      <section className="py-20 bg-zinc-950/40 border-t border-white/5">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-purple/10 border border-brand-purple/30 text-xs font-semibold text-brand-purple">
              <HelpCircle className="h-3.5 w-3.5 text-brand-pink" />
              Frequently Asked Questions
            </div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">Pricing FAQs</h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq) => (
              <div 
                key={faq.q} 
                className="glassmorphism rounded-2xl p-6 border border-white/5 hover:border-brand-purple/10 transition-all duration-300 text-left"
              >
                <h3 className="font-bold text-white mb-2 flex items-start gap-2.5">
                  <span className="text-brand-purple text-lg leading-none">?</span>
                  <span>{faq.q}</span>
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed pl-5">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dynamic bottom CTA section */}
      <section className="py-24 text-center relative overflow-hidden bg-gradient-to-t from-brand-purple/10 to-transparent border-t border-white/5">
        <div className="max-w-3xl mx-auto px-4 space-y-6 relative z-10">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight">
            Because your team deserves an experience.
          </h2>
          <p className="text-zinc-400 max-w-lg mx-auto text-base">
            Bring the music, trigger the soundboards, crown the champion, and make memories that last. Contact us today or lock in your pricing with our planner quiz.
          </p>
          
          <div className="flex flex-wrap gap-4 justify-center pt-6">
            <Link
              href="/#quiz"
              className="px-8 py-4 rounded-2xl text-base font-bold text-white bg-gradient-to-r from-brand-purple to-brand-pink hover:from-brand-purple/90 hover:to-brand-pink/90 shadow-lg shadow-brand-purple/30 transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.02]"
            >
              🎉 Book Your Teamtastic Event
            </Link>
            <Link
              href="/#quiz"
              className="px-8 py-4 rounded-2xl text-base font-bold text-white bg-white/10 hover:bg-white/15 transition-all duration-300 hover:-translate-y-0.5 border border-white/10 hover:scale-[1.02]"
            >
              💳 Get Quote & Pay Deposit
            </Link>
            <a
              href="mailto:hello@teamtastic.events"
              className="px-8 py-4 rounded-2xl text-base font-bold text-zinc-300 bg-white/5 hover:bg-white/10 transition-all duration-300 hover:-translate-y-0.5 border border-white/5 hover:scale-[1.02]"
            >
              Talk to Michael
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
