import Link from "next/link";
import { ArrowRight, CheckCircle, Clock3, Globe2, ShieldCheck, Sparkles, Users } from "lucide-react";
import CorporateLeadForm from "@/components/CorporateLeadForm";
import { HOLIDAY_CAMPAIGN, holidayOfferCopy } from "@/lib/holiday-campaign";

export default function HolidayConversionPage({
  eyebrow,
  headline,
  description,
  source,
  entryPoint,
  formTitle,
  formOccasion = "holiday",
  defaultTeamSize = "",
  benefits,
  agenda,
  detailsTitle,
  details,
  faq,
}) {
  const offer = holidayOfferCopy();
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })),
  };

  return (
    <main className="min-h-screen bg-brand-dark text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <section className="relative overflow-hidden pb-16 pt-24 md:pb-24 md:pt-32">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(124,58,237,0.25),_rgba(3,7,18,0.98)_60%,_#030712_100%)]" />
        <div className="mx-auto grid max-w-7xl items-start gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-amber-200">
              <Clock3 className="h-4 w-4" /> {HOLIDAY_CAMPAIGN.availabilityMessage}
            </div>
            <p className="mt-7 text-xs font-black uppercase tracking-[0.2em] text-brand-pink">{eyebrow}</p>
            <h1 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">{headline}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-300">{description}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="#holiday-quote" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#D81B60] px-7 text-sm font-bold hover:bg-pink-600">Check dates and pricing <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/virtual-holiday-party" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-7 text-sm font-bold hover:bg-white/10">Explore all holiday formats</Link>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {benefits.map((benefit) => <div key={benefit} className="flex gap-3 text-sm text-zinc-300"><CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />{benefit}</div>)}
            </div>
          </div>
          <div id="holiday-quote" className="lg:col-span-5">
            <CorporateLeadForm
              source={source}
              entryPoint={entryPoint}
              eyebrow="Holiday availability"
              title={formTitle}
              subtitle={offer.short}
              successTitle="Your holiday event brief is saved."
              successBody="Michael will review your dates, time zone, team size, and preferred format, then follow up with availability."
              submitLabel="Check dates and pricing"
              depositLabel="Start my $200 date hold"
              defaultOccasion={formOccasion}
              defaultTeamSize={defaultTeamSize}
              holidayQualification
            />
          </div>
        </div>
      </section>

      <section className="border-y border-white/5 bg-zinc-950/50 py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-6 px-4 text-sm font-semibold text-zinc-300">
          <span className="inline-flex gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300" /> No downloads</span>
          <span className="inline-flex gap-2"><Globe2 className="h-4 w-4 text-sky-300" /> Global time zones</span>
          <span className="inline-flex gap-2"><Users className="h-4 w-4 text-purple-300" /> Live professional host</span>
          <span className="inline-flex gap-2"><Sparkles className="h-4 w-4 text-amber-300" /> Company customization</span>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center"><p className="text-xs font-black uppercase tracking-[0.2em] text-sky-300">Sample run of show</p><h2 className="mt-3 text-3xl font-extrabold sm:text-5xl">A polished 60-minute celebration</h2></div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {agenda.map(([time, title, copy]) => <div key={time} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"><p className="text-sm font-black text-brand-pink">{time}</p><h3 className="mt-2 font-bold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-zinc-400">{copy}</p></div>)}
          </div>
        </div>
      </section>

      <section className="border-y border-white/5 bg-zinc-950/50 py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="max-w-3xl text-3xl font-extrabold sm:text-5xl">{detailsTitle}</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {details.map(([title, copy]) => <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"><h3 className="font-bold text-white">{title}</h3><p className="mt-2 text-sm leading-relaxed text-zinc-400">{copy}</p></div>)}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-3xl font-extrabold">Questions planners ask</h2>
          <div className="mt-9 space-y-4">{faq.map((item) => <div key={item.q} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"><h3 className="font-bold">{item.q}</h3><p className="mt-2 text-sm leading-relaxed text-zinc-400">{item.a}</p></div>)}</div>
          <div className="mt-9 text-center"><Link href="#holiday-quote" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#D81B60] px-7 text-sm font-bold">Check my dates <ArrowRight className="h-4 w-4" /></Link></div>
        </div>
      </section>
    </main>
  );
}
