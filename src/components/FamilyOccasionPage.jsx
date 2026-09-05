import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, Check, Gamepad2, Heart, Sparkles, Users } from "lucide-react";
import CorporateLeadForm from "@/components/CorporateLeadForm";
import { FAMILY_OCCASIONS } from "@/lib/family-demand";

const icons = [Users, Sparkles, Gamepad2];

export default function FamilyOccasionPage({ occasion }) {
  const related = Object.values(FAMILY_OCCASIONS).filter((item) => item.slug !== occasion.slug);
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: occasion.title,
      description: occasion.description,
      provider: { "@type": "Organization", name: "Teamtastic", url: "https://teamtastic.events" },
      areaServed: "Worldwide",
      offers: {
        "@type": "Offer",
        price: "35",
        priceCurrency: "USD",
        description: "$35 per person, $250 minimum, with a $100 date-reservation deposit",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: occasion.faqs.map(([question, answer]) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ];

  return (
    <main className="bg-white text-zinc-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />

      <section className="overflow-hidden border-b border-zinc-200 bg-gradient-to-br from-violet-50 via-white to-amber-50 py-16 sm:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-purple-700">{occasion.eyebrow}</p>
            <h1 className="mt-4 text-4xl font-black leading-[1.05] tracking-tight text-zinc-950 sm:text-6xl">
              {occasion.title}
            </h1>
            <p className="mt-4 text-2xl font-extrabold text-pink-600">{occasion.accent}</p>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-700">{occasion.description}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#availability" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#D81B60] px-6 font-bold text-white shadow-lg shadow-pink-600/20 hover:bg-pink-700">
                Check your date <CalendarDays className="h-5 w-5" />
              </a>
              <Link href="/family-trivia-starter" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-purple-200 bg-white px-6 font-bold text-purple-800 hover:border-purple-400">
                Make free family trivia <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
            <p className="mt-5 text-sm font-semibold text-zinc-600">$35 per person · $250 minimum · $100 reserves your date</p>
          </div>
          <div className="relative min-h-[360px] overflow-hidden rounded-[2rem] border-8 border-white shadow-2xl sm:min-h-[480px]">
            <Image src={occasion.image} alt={occasion.imageAlt} fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
            <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-zinc-950/85 p-4 text-white backdrop-blur">
              <p className="font-bold">Live host. Customizable games. No downloads.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-purple-700">Designed for real families</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Everyone gets to play. Nobody has to host.</h2>
            <p className="mt-5 text-lg leading-relaxed text-zinc-600">{occasion.intro}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {occasion.benefits.map((benefit) => (
              <div key={benefit} className="flex gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check className="h-4 w-4" /></span>
                <p className="font-semibold leading-relaxed text-zinc-800">{benefit}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-zinc-950 py-16 text-white sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-pink-400">Games that fit the occasion</p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">A complete show, customized for your group</h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {occasion.games.map(([name, description], index) => {
              const Icon = icons[index];
              return (
                <article key={name} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                  <Icon className="h-8 w-8 text-pink-400" />
                  <h3 className="mt-5 text-xl font-extrabold">{name}</h3>
                  <p className="mt-3 leading-relaxed text-zinc-300">{description}</p>
                </article>
              );
            })}
          </div>
          <div className="mt-10 rounded-3xl border border-purple-400/20 bg-purple-500/10 p-6 sm:p-8">
            <h3 className="text-xl font-extrabold">Example question ideas</h3>
            <ul className="mt-4 grid gap-3 md:grid-cols-3">
              {occasion.examples.map((example) => <li key={example} className="rounded-xl bg-black/20 p-4 text-zinc-200">“{example}”</li>)}
            </ul>
            <p className="mt-4 text-sm text-zinc-400">These are examples, not customer quotes. Your actual questions can be customized using details you approve.</p>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-purple-700">Simple from start to finish</p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">You bring the people. We run the party.</h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              ["1", "Tell us about the group", "Share the occasion, group size, preferred date, and the style your family enjoys."],
              ["2", "We shape the show", "We recommend the games and collect only the custom details you choose to share."],
              ["3", "Join and play", "Your host welcomes everyone, explains the games, keeps score, and runs the finale."],
            ].map(([number, title, copy]) => (
              <div key={number} className="rounded-3xl border border-zinc-200 p-6">
                <span className="text-4xl font-black text-purple-200">{number}</span>
                <h3 className="mt-3 text-xl font-extrabold">{title}</h3>
                <p className="mt-2 leading-relaxed text-zinc-600">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="availability" className="scroll-mt-24 bg-gradient-to-br from-purple-950 via-zinc-950 to-pink-950 py-16 text-white sm:py-20">
        <div className="mx-auto grid max-w-7xl items-start gap-10 px-4 sm:px-6 lg:grid-cols-[0.75fr_1.25fr] lg:px-8">
          <div className="lg:sticky lg:top-24">
            <Heart className="h-10 w-10 text-pink-400" />
            <h2 className="mt-5 text-3xl font-black sm:text-4xl">Check your date without committing</h2>
            <p className="mt-4 leading-relaxed text-zinc-300">Tell Michael what you are planning. You will receive availability and a recommended format within one business day.</p>
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-2xl font-black">$35 per person</p>
              <p className="mt-1 text-zinc-300">$250 minimum · $100 date-reservation deposit</p>
            </div>
          </div>
          <CorporateLeadForm
            isFamily
            source="michael_family_concierge"
            entryPoint={occasion.entryPoint}
            defaultOccasion={occasion.occasion}
            holidayQualification
            eyebrow="Family date check"
            title={`Check availability for your ${occasion.occasion === "long-distance" ? "family game night" : occasion.occasion}`}
          />
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-black sm:text-4xl">Questions families ask</h2>
          <div className="mt-8 space-y-3">
            {occasion.faqs.map(([question, answer]) => (
              <details key={question} className="group rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                <summary className="cursor-pointer list-none font-extrabold text-zinc-900">{question}</summary>
                <p className="mt-3 leading-relaxed text-zinc-600">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-200 bg-zinc-50 py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-black">Explore another family occasion</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {related.map((item) => (
              <Link key={item.slug} href={`/${item.slug}`} className="group rounded-2xl border border-zinc-200 bg-white p-5 hover:border-purple-300 hover:shadow-md">
                <p className="font-extrabold text-zinc-950">{item.title}</p>
                <p className="mt-1 text-sm text-zinc-600">{item.accent}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-purple-700">Explore <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
