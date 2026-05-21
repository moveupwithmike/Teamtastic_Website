import Link from "next/link";
import { ArrowRight, Pencil, Clock, User } from "lucide-react";

export const metadata = {
  title: "Virtual Team Building Blog — Tips, Ideas & Guides | Teamtastic",
  description:
    "Expert virtual team building ideas, remote engagement tips, icebreaker guides, and corporate event inspiration from the Teamtastic team.",
  openGraph: {
    title: "Teamtastic Blog — Virtual Team Building Ideas & Guides",
    description: "Expert tips for HR leaders, team managers, and event planners running virtual and hybrid team events.",
    url: "https://teamtastic.events/blog",
  },
};

const posts = [
  {
    slug: "virtual-team-building-ideas",
    title: "50 Virtual Team Building Ideas Your Team Will Actually Love",
    excerpt: "Stop settling for boring Zoom happy hours. Here are 50 creative virtual team building ideas — from high-energy game shows to collaborative art sessions — guaranteed to drive real engagement.",
    readTime: "12 min read",
    date: "May 15, 2025",
    category: "Ideas & Inspiration",
    categoryColor: "text-purple-400 border-purple-500/30 bg-purple-500/10",
    gradient: "from-purple-500/10 to-pink-500/5",
  },
  {
    slug: "remote-team-engagement-tips",
    title: "How to Boost Remote Employee Engagement in 2025",
    excerpt: "Remote work is here to stay — but so is the engagement crisis. Discover the proven strategies HR leaders are using to keep distributed teams connected, motivated, and genuinely happy.",
    readTime: "9 min read",
    date: "May 8, 2025",
    category: "HR & Culture",
    categoryColor: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
    gradient: "from-emerald-500/10 to-teal-500/5",
  },
  {
    slug: "virtual-icebreaker-games",
    title: "21 Virtual Icebreaker Games That Don't Feel Awkward",
    excerpt: "Most virtual icebreakers make everyone cringe. These 21 low-pressure, genuinely fun options work even for the most camera-shy team members — no forced fun required.",
    readTime: "8 min read",
    date: "April 28, 2025",
    category: "Icebreakers",
    categoryColor: "text-sky-400 border-sky-500/30 bg-sky-500/10",
    gradient: "from-sky-500/10 to-blue-500/5",
  },
  {
    slug: "corporate-game-show-activities",
    title: "Corporate Game Show Ideas: Bring the Energy to Your Next Virtual Event",
    excerpt: "The corporate game show format is the most engaging virtual event type we've seen — and it's wildly underutilized. Here's how to run one, what makes it work, and why teams love it.",
    readTime: "10 min read",
    date: "April 14, 2025",
    category: "Game Shows",
    categoryColor: "text-amber-400 border-amber-500/30 bg-amber-500/10",
    gradient: "from-amber-500/10 to-orange-500/5",
  },
];

export default function Blog() {
  return (
    <main className="flex flex-col min-h-screen bg-brand-dark">
      {/* Header */}
      <section className="relative pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-zinc-950 to-zinc-950" />
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-xs font-semibold text-purple-300">
            <Pencil className="h-3 w-3" />
            Expert Insights for Remote Teams
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white">The Teamtastic Blog</h1>
          <p className="text-zinc-400 max-w-xl mx-auto">
            Virtual team building ideas, remote engagement guides, and event planning insights from the people who run the most energy-packed corporate game shows on the internet.
          </p>
        </div>
      </section>

      {/* Blog Posts Grid */}
      <section className="py-12 pb-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className={`glassmorphism rounded-2xl p-7 border border-white/5 hover:border-white/10 hover:-translate-y-1 transition-all duration-300 group flex flex-col bg-gradient-to-br ${post.gradient}`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${post.categoryColor}`}>
                    {post.category}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors mb-3 leading-snug">
                  {post.title}
                </h2>
                <p className="text-sm text-zinc-400 leading-relaxed flex-1 mb-5">{post.excerpt}</p>
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{post.readTime}</span>
                    <span className="flex items-center gap-1"><User className="h-3 w-3" />Teamtastic</span>
                  </div>
                  <span className="flex items-center gap-1 text-purple-400 font-semibold group-hover:gap-2 transition-all">
                    Read <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
