import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle,
  Gamepad2,
  Ghost,
  Globe2,
  HeartHandshake,
  Leaf,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Users,
} from "lucide-react";
import gamesPool from "@/lib/gamesData.json";
import { relatedPostSlugs, themeBySlug } from "@/lib/themes";
import CorporateLeadForm from "@/components/CorporateLeadForm";

const ICONS = { Leaf, Ghost, Snowflake, HeartHandshake };

const gamesBySlug = gamesPool.reduce((map, game) => {
  map[game.slug] = game;
  return map;
}, {});

function safeJsonLd(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export default function ThemePage({ theme }) {
  const accentIcon = ICONS[theme.hero.icon] || Sparkles;
  const Icon = accentIcon;
  const games = theme.topGames
    .map((entry, index) => ({ ...entry, position: index + 1, game: gamesBySlug[entry.slug] }))
    .filter((entry) => Boolean(entry.game));

  const relatedPosts = relatedPostSlugs(theme).map(({ slug, post }) => ({ slug, post }));

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Seasonal & Themed Team Building", item: "https://teamtastic.events/themes" },
        { "@type": "ListItem", position: 2, name: theme.name, item: `https://teamtastic.events/themes/${theme.slug}` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: theme.faqs.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: games.map(({ position, game }) => ({
        "@type": "ListItem",
        position,
        name: game.title,
        url: `https://teamtastic.events/games/${game.slug}`,
      })),
    },
  ];

  return (
    <main className="min-h-screen bg-brand-dark text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(structuredData) }} />

      <section className="relative overflow-hidden pb-16 pt-24 md:pb-24 md:pt-32">
        <div className="absolute inset-0 -z-10" style={{ background: theme.hero.gradient }} />
        <div className="mx-auto grid max-w-7xl items-start gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
          <div className="lg:col-span-7">
            <Link
              href="/themes"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> All themed events
            </Link>
            <div className={`mt-6 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.18em] ${theme.hero.badgeClass}`}>
              <Icon className="h-4 w-4" /> {theme.eyebrow}
            </div>
            <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
              {theme.title}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-300">{theme.intro}</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {theme.summary.map((item) => (
                <div key={item} className="flex gap-3 text-sm text-zinc-300">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#theme-quote" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#D81B60] px-7 text-sm font-bold hover:bg-pink-600">
                Check my dates and pricing <ArrowRight className="h-4 w-4" />
              </a>
              <Link href="/#quiz" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-7 text-sm font-bold hover:bg-white/10">
                Find a custom package
              </Link>
            </div>
          </div>
          <div id="theme-quote" className="lg:col-span-5">
            <CorporateLeadForm
              source={theme.form.source}
              entryPoint={theme.form.entryPoint}
              eyebrow={theme.form.eyebrow}
              title={theme.form.title}
              subtitle={theme.form.subtitle}
              submitLabel={theme.form.submitLabel}
              depositLabel={theme.form.depositLabel}
              defaultOccasion={theme.form.defaultOccasion}
              defaultTeamSize={theme.form.defaultTeamSize}
              holidayQualification={theme.form.holidayQualification}
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
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-300">Best games for {theme.name.toLowerCase()}</p>
            <h2 className="mt-3 text-3xl font-extrabold sm:text-5xl">Game formats our hosts run most</h2>
            <p className="mt-4 text-sm leading-relaxed text-zinc-400">
              Curated by Teamtastic hosts for {theme.name.toLowerCase()}. Every pick maps to a real game in our catalog, so what you book is what you get.
            </p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {games.map(({ position, game, pitch }) => (
              <Link
                key={game.slug}
                href={`/games/${game.slug}`}
                className="group flex gap-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all hover:border-purple-500/30 hover:bg-white/[0.06]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm font-black" style={{ color: theme.hero.accent }}>
                  {position}
                </span>
                <div>
                  <h3 className="font-bold text-white group-hover:text-purple-300 transition-colors">{game.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{pitch}</p>
                  <span className="inline-flex items-center gap-1 pt-3 text-xs font-bold text-purple-400">
                    See how {game.title} works <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/5 bg-zinc-950/50 py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="max-w-3xl text-3xl font-extrabold sm:text-5xl">What&rsquo;s included in a {theme.name.toLowerCase()} event</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {theme.details.map(([title, copy]) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <h3 className="font-bold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">Sample run of show</p>
            <h2 className="mt-3 text-3xl font-extrabold sm:text-5xl">{theme.agenda.label}</h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {theme.agenda.items.map(([time, title, copy]) => (
              <div key={time} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <p className="text-sm font-black text-brand-pink">{time}</p>
                <h3 className="mt-2 font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/5 bg-zinc-950/50 py-16 md:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-3xl font-extrabold">Questions planners ask</h2>
          <div className="mt-9 space-y-4">
            {theme.faqs.map((item) => (
              <div key={item.q} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <h3 className="font-bold">{item.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {theme.featuredPages?.length > 0 && (
        <section className="py-16 md:py-20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-center text-2xl font-extrabold sm:text-4xl">Planning a bigger celebration?</h2>
            <div className="mt-9 grid gap-4 sm:grid-cols-2">
              {theme.featuredPages.map(({ href, label }) => (
                <Link key={href} href={href} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all hover:border-purple-500/30 hover:bg-white/[0.06]">
                  <span className="font-bold text-white">{label}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-purple-400" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="border-t border-white/5 bg-zinc-950/50 py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-extrabold sm:text-4xl">Read next</h2>
          <div className="mt-9 grid gap-4 md:grid-cols-2">
            {relatedPosts.length > 0 &&
              relatedPosts.map(({ slug, post }) => (
                <Link key={slug} href={`/blog/${slug}`} className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all hover:border-purple-500/30 hover:bg-white/[0.06]">
                  <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-purple-400" />
                  <span>
                    <span className="block font-bold text-white">{post.title}</span>
                    <span className="mt-1 block text-xs text-zinc-500">{post.category} · {post.readTime}</span>
                  </span>
                </Link>
              ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-extrabold sm:text-4xl">Explore more themed events</h2>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {theme.relatedThemes.map((slug) => {
              const related = themeBySlug(slug);
              if (!related) return null;
              const RelatedIcon = ICONS[related.hero.icon] || Sparkles;
              return (
                <Link key={slug} href={`/themes/${slug}`} className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all hover:border-purple-500/30 hover:bg-white/[0.06]">
                  <RelatedIcon className="h-5 w-5 shrink-0" style={{ color: related.hero.accent }} />
                  <span>
                    <span className="block font-bold text-white group-hover:text-purple-300 transition-colors">{related.name}</span>
                    <span className="mt-0.5 block text-xs text-zinc-500">{related.eyebrow}</span>
                  </span>
                </Link>
              );
            })}
            <Link href="/themes" className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-sm font-bold text-zinc-300 transition-all hover:border-purple-500/30 hover:text-white">
              <Gamepad2 className="h-5 w-5 text-purple-400" /> Browse all themes
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-white/5 bg-zinc-950/50 py-16 md:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-300">Plan your {theme.name.toLowerCase()}</p>
          <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">Check availability for your {theme.name.toLowerCase()} event</h2>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400">
            Tell us your team size, preferred vibe, and dates. Michael will follow up within one business day — or you can reserve your date directly.
          </p>
          <a href="#theme-quote" className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#D81B60] px-7 text-sm font-bold hover:bg-pink-600">
            Check my dates <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>
    </main>
  );
}