import Link from "next/link";
import { ArrowRight, CalendarDays, Gamepad2, Sparkles } from "lucide-react";
import { THEME_CATEGORIES, themesByCategory } from "@/lib/themes";

export const metadata = {
  alternates: {
    canonical: "https://teamtastic.events/themes",
  },
  title: "Seasonal & Themed Team Building Events | Teamtastic",
  description:
    "Live-hosted themed team building for fall, Halloween, holiday season, and heritage observances — custom trivia, music, and game show rounds for remote and hybrid teams.",
  openGraph: {
    title: "Seasonal & Themed Team Building Events | Teamtastic",
    description: "Fall, Halloween, holiday, and heritage-themed virtual events with live hosts for remote and hybrid teams.",
    url: "https://teamtastic.events/themes",
    images: [{ url: "/teamtastic-og.png", width: 1200, height: 630, alt: "Teamtastic themed team building events" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Seasonal & Themed Team Building Events | Teamtastic",
    description: "Fall, Halloween, holiday, and heritage-themed virtual events with live hosts.",
    images: ["/teamtastic-og.png"],
  },
};

const THEME_ICONS = { Leaf: "🍂", Ghost: "👻", Snowflake: "❄️", HeartHandshake: "🤝" };

function safeJsonLd(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export default function ThemesPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://teamtastic.events" },
      { "@type": "ListItem", position: 2, name: "Seasonal & Themed Team Building", item: "https://teamtastic.events/themes" },
    ],
  };

  return (
    <main className="min-h-screen bg-brand-dark text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(structuredData) }} />

      <section className="relative overflow-hidden pb-16 pt-24 md:pb-20 md:pt-32">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(124,58,237,0.22),_rgba(3,7,18,0.98)_60%,_#030712_100%)]" />
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-amber-200">
            <CalendarDays className="h-4 w-4" /> Themed events, planned around your calendar
          </div>
          <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
            Seasonal &amp; Themed Team Building for Remote Teams
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-zinc-300">
            Seasonal and themed team building turns a normal team event into a moment people look forward to — fall
            gatherings, spooky-season socials, inclusive holiday celebrations, and heritage observances handled with
            care. Every theme is a live-hosted game show with custom trivia, music, and game rounds, run by a
            professional MC for teams of 15 to 500+.
          </p>
        </div>
      </section>

      {THEME_CATEGORIES.filter((category) => themesByCategory(category.key).length > 0).map((category) => (
        <section key={category.key} className="border-t border-white/5 py-16 md:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-300">{category.label}</p>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">{category.description}</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {themesByCategory(category.key).map((theme) => (
                <Link
                  key={theme.slug}
                  href={`/themes/${theme.slug}`}
                  className="group flex flex-col rounded-3xl border border-white/10 bg-white/[0.03] p-7 transition-all hover:-translate-y-0.5 hover:border-purple-500/30 hover:bg-white/[0.06]"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xl">
                      {THEME_ICONS[theme.hero.icon] || <Sparkles className="h-5 w-5 text-purple-400" />}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      {theme.eyebrow}
                    </span>
                  </div>
                  <h2 className="mt-5 text-lg font-bold text-white group-hover:text-purple-300 transition-colors">{theme.name}</h2>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-400">{theme.summary[0]}</p>
                  <span className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-purple-400">
                    Plan a {theme.name.toLowerCase()} event
                    <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className="border-t border-white/5 bg-zinc-950/50 py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-extrabold sm:text-4xl">Also inside the Teamtastic calendar</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-zinc-400">
            A few dedicated event formats live outside the theme index — here&rsquo;s where they belong.
          </p>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { href: "/virtual-holiday-party", label: "Virtual Holiday Party", note: "The full December celebration format" },
              { href: "/virtual-year-end-team-celebration", label: "Year-End Team Celebration", note: "Award shows and year-in-review programming" },
              { href: "/virtual-family-game-night", label: "Virtual Family Game Night", note: "Connecting employees and their families" },
            ].map(({ href, label, note }) => (
              <Link key={href} href={href} className="flex items-start justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition-all hover:border-purple-500/30 hover:bg-white/[0.06]">
                <span>
                  <span className="block font-bold text-white">{label}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-zinc-500">{note}</span>
                </span>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-purple-400" />
              </Link>
            ))}
            <Link href="/games" className="flex items-start justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6 transition-all hover:border-purple-500/30 hover:bg-white/[0.06]">
              <span>
                <span className="block font-bold text-white">The full game catalog</span>
                <span className="mt-1 block text-xs leading-relaxed text-zinc-500">Every format we run, explained with lobbies</span>
              </span>
              <Gamepad2 className="mt-1 h-4 w-4 shrink-0 text-purple-400" />
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-white/5 py-16 md:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-extrabold sm:text-4xl">Not sure which theme fits your team?</h2>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400">
            Answer a few questions and we&rsquo;ll recommend a format, theme, and package for your group size, vibe, and date.
          </p>
          <Link href="/#quiz" className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#D81B60] px-7 text-sm font-bold hover:bg-pink-600">
            Find your match <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}