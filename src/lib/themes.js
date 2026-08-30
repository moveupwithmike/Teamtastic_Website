// Structured data for the Teamtastic seasonal/theme content engine.
//
// One theme = one authoritative URL under /themes/[slug]. Pages are generated
// from this data by the shared theme template (src/components/ThemePage.js).
//
// Guidelines for editing:
// - Never fabricate stats, reviews, or customer quotes. Every claim is factual
//   or clearly framed as an option/capability.
// - Keep `intro` a self-contained 50–70 word direct answer. AI search engines
//   in 2026 extract citations from the first 30% of a page.
// - `topGames` is a ranked "best games" list (citation-friendly format).
//   Pitches must match the mapped game's real mechanics (see gamesData.json).
// - Heritage/culture themes follow extra-careful editorial standards: opt-in,
//   co-created with the client, celebratory, and never stereotyping.
// - Keep `seo.lastModified` as the real date content was last substantively
//   updated. The sitemap uses it instead of a fabricated today().

import { POSTS } from "@/lib/blog-posts";

export const THEME_CATEGORIES = [
  {
    key: "seasons",
    label: "Seasons & Holidays",
    description: "Calendar-driven programming with broad, recurring demand.",
  },
  {
    key: "heritage",
    label: "Heritage & Culture",
    description: "Respectful, co-created observance programming for workplaces.",
  },
  {
    key: "workplace",
    label: "Workplace Moments",
    description: "Company-life moments that benefit from a structured format.",
  },
];

export const THEMES = [
  {
    slug: "fall-team-building",
    category: "seasons",
    name: "Fall Team Building",
    eyebrow: "Autumn · September–November",
    title: "Fall Team Building: 7 Games Remote & Hybrid Teams Enjoy in Autumn",
    metaTitle: "Fall Team Building Activities for Remote & Hybrid Teams | Teamtastic",
    metaDescription:
      "Fall-themed virtual team building with live hosts: custom fall trivia, music, meme, and survey rounds for remote and hybrid teams of 15–500+.",
    intro:
      "Fall team building is any remote or hybrid event that uses autumn themes — harvest flavors, cozy energy, spooky season, and gratitude — to help coworkers connect. The most effective fall team events are live-hosted game shows with custom trivia, music, and meme rounds, because structured formats get everyone participating without forced icebreakers. Teamtastic runs these for teams of 15 to 500+ across any time zone.",
    summary: [
      "Custom fall content: trivia, music, and meme rounds personalized with your team's own answers and inside jokes",
      "Live-hosted by a professional MC over Zoom, Teams, or your existing video tool",
      "No downloads — players join from any phone, laptop, or tablet",
      "Works for 15 to 500+ employees, across one time zone or many",
    ],
    benefits: [
      "High participation: fast rounds and low-pressure formats keep even camera-shy teammates engaged",
      "Zero planning stress: you pick the vibe, we handle hosting, scoring, and pacing",
      "Company personalization: autumn favorites and team inside jokes woven into every round",
      "Multi-time-zone friendly: schedule mornings, afternoons, or evenings across the team",
    ],
    topGames: [
      {
        slug: "survey-showdown",
        pitch: "Fall survey rounds — best Halloween candy, hot-cocoa heat index, leaf-raking hot takes — get the whole team answering together.",
      },
      {
        slug: "trivia",
        pitch: "Custom fall trivia: harvest history, spooky facts, back-to-school, and autumn pop culture, tuned to any team size.",
      },
      {
        slug: "name-that-tune",
        pitch: "A music round stacked with fall and early-season songs your team will actually know and want to guess.",
      },
      {
        slug: "what-the-meme",
        pitch: "Pick the caption for seasonal memes. Low-pressure, funny, and completely camera-off friendly.",
      },
      {
        slug: "the-hot-seat",
        pitch: "Friendly fall superlatives — 'most likely to order pumpkin spice with extra whip' — decided by team vote.",
      },
      {
        slug: "scavenger-hunt",
        pitch: "A themed hunt for the coziest sweater, favorite mug, or most inexplicable desk pumpkin; gets people up and moving.",
      },
      {
        slug: "awards-night",
        pitch: "A light autumn awards segment that closes the event on a warm, celebratory note.",
      },
    ],
    details: [
      [
        "Your run of show",
        "Every themed event opens with a warm, structured warm-up, then moves through survey, trivia, and music rounds, and ends with recognition. You choose the length — 60, 75, or 90 minutes.",
      ],
      [
        "Customization & personalization",
        "Send us your team's fall favorites, company milestones, and inside jokes and we weave them into the deck. Custom company trivia is included on every hosted package.",
      ],
      [
        "Live hosting & production",
        "A professional MC runs energy, pacing, and scoring so leaders can participate instead of running the show. Lobbies launch instantly in any browser.",
      ],
      [
        "Sizing & logistics",
        "Handles 15 to 500+ participants. For large teams we add team captains and chat rounds so every table, region, or department still feels present.",
      ],
    ],
    agenda: {
      label: "A polished 60-minute autumn event",
      items: [
        ["00:00", "Welcome & housekeeping", "The MC sets the tone and preps the room."],
        ["00:05", "Fall favorites warm-up", "Cozy low-stakes rounds to wake the room up."],
        ["00:15", "Round 1 — Survey Showdown", "Team answers drive a live fall survey."],
        ["00:30", "Round 2 — Custom fall trivia", "History, pop culture, and your company."],
        ["00:45", "Round 3 — Name That Tune", "Songs of the season, guessed as a team."],
        ["01:00", "Superlatives & awards", "Recognition closes the event on a high note."],
      ],
    },
    faqs: [
      {
        q: "What is fall team building?",
        a: "Fall team building is a virtual, hybrid, or in-person team gathering that uses autumn themes to help colleagues connect. Teamtastic delivers it as a live-hosted game show with custom fall trivia, music, meme, and survey rounds — structured so everyone participates without awkward icebreakers.",
      },
      {
        q: "How many people can attend a fall team event?",
        a: "Events are built for teams of 15 to 500+. For larger groups we add team captains and chat rounds so every pod, office, or region stays involved.",
      },
      {
        q: "Do employees need to download anything?",
        a: "No. Players join from any modern web browser on a phone, laptop, or tablet. The host shares a lobby link and play begins in under 30 seconds.",
      },
      {
        q: "Can you customize trivia for our company?",
        a: "Yes. Custom company trivia and personalization are included on hosted packages. You share team details and inside jokes and we build them into the autumn deck.",
      },
      {
        q: "How is a fall team event priced?",
        a: "Hosted events are $35 per person with a $350 minimum. A $200 deposit reserves your date and the balance is invoiced after the event.",
      },
      {
        q: "What video platform do you use?",
        a: "Events run over Zoom, Teams, Google Meet, or your own video tool. Players answer in our browser lobby while watching the shared screen.",
      },
    ],
    relatedArticles: [
      "virtual-holiday-party-games",
      "virtual-icebreaker-games",
      "zoom-team-building-games",
      "team-building-for-remote-engineering-teams",
    ],
    relatedThemes: ["halloween", "holiday-team-building"],
    hero: {
      gradient: "radial-gradient(ellipse at top, rgba(249,115,22,0.22), rgba(3,7,18,0.98) 60%, #030712 100%)",
      accent: "#f97316",
      icon: "Leaf",
      badgeClass: "border-orange-400/30 bg-orange-400/10 text-orange-200",
    },
    form: {
      source: "theme_fall_team_building",
      entryPoint: "theme_fall_team_building_inline",
      eyebrow: "Fall availability",
      title: "Get fall event dates & pricing",
      subtitle: "$35 per person · $350 minimum · $200 reserves your date",
      submitLabel: "Check fall availability",
      depositLabel: "Reserve with $200 deposit",
      defaultOccasion: "social-hour",
      defaultTeamSize: "",
      holidayQualification: false,
    },
    seo: {
      lastModified: "2026-08-29",
      changeFrequency: "weekly",
      priority: 0.9,
    },
  },

  {
    slug: "halloween",
    category: "seasons",
    name: "Halloween Team Building",
    eyebrow: "Spooky Season · October",
    title: "Halloween Team Building Activities for Remote Teams",
    metaTitle: "Halloween Team Building Activities for Remote Teams | Teamtastic",
    metaDescription:
      "Friendly, opt-in Halloween virtual events for work: custom Halloween trivia, costume highlights, spooky music, and meme rounds — hosted live for remote teams.",
    intro:
      "Halloween team building for remote teams is a hosted game show that leans into the playful, low-gore side of spooky season — costume highlights, custom Halloween trivia, spooky music rounds, and meme battles. Done right it is friendly and fully opt-in: costumes are never required, nothing is graphic, and introverts can participate from chat. These events work in any workplace, with or without a holiday committee.",
    summary: [
      "Playful and G-rated: spooky fun without gore or scares someone didn't volunteer for",
      "Costumes welcome but never required — participation is always opt-in",
      "Campus-safe and inclusive, built for teams across time zones",
      "Custom Halloween trivia and meme rounds personalized with your company",
    ],
    benefits: [
      "A natural theme for October team socials, offsites, and department meetings",
      "Highest-energy formats: meme battles, music rounds, and caption contests carry the agenda",
      "Fully camera-off friendly so shy team members can join from chat",
      "An easy 'fall festival' alternative for workplaces that skip Halloween specifically",
    ],
    topGames: [
      {
        slug: "what-the-meme",
        pitch: "Spooky meme caption battles — the signature round of a remote Halloween event and our most requested costume-adjacent game.",
      },
      {
        slug: "trivia",
        pitch: "Custom Halloween trivia spanning folklore, movies, candy rankings, and October pop culture.",
      },
      {
        slug: "name-that-tune",
        pitch: "A music round built from spooky soundtracks and Halloween-adjacent songs teams know by heart.",
      },
      {
        slug: "awards-night",
        pitch: "A best-costume showcase and light awards segment — the celebratory close every October event wants.",
      },
      {
        slug: "the-hot-seat",
        pitch: "Vote-driven October superlatives: 'most likely to binge a horror series in one night' and friends.",
      },
      {
        slug: "mystery-box",
        pitch: "Collaborative spooky-season rounds that feel like a mystery without scaring anyone off.",
      },
      {
        slug: "emoji-madness",
        pitch: "Puzzle out candy-versus-cosplay emoji clues as a whole team — quick, silly, and inclusive.",
      },
    ],
    details: [
      [
        "Appropriate for every workplace",
        "Hosts keep the tone playful and G-rated by default. If your team prefers a 'fall festival' framing over Halloween itself, we run the same event without the spooky language.",
      ],
      [
        "Costume-optional by design",
        "We never force cosplay. Anyone can share a costume photo; everyone else plays from chat or camera. Camera-off teammates are equally scored.",
      ],
      [
        "Fully customizable deck",
        "Send us your team's October favorites — snacks, shows, shared jokes — and we build them into trivia and survey rounds.",
      ],
      [
        "Scales to any team size",
        "From a 20-person squad to a 500+ company event, team captains and chat rounds keep everyone in the game.",
      ],
    ],
    agenda: {
      label: "A 60-minute spooky season show",
      items: [
        ["00:00", "Welcome & housekeeping", "Host sets the friendly, opt-in tone."],
        ["00:05", "Warm-up — candy rankings", "A stress-free opening survey round."],
        ["00:15", "Round 1 — Spooky trivia", "Folklore, movies, and candy science."],
        ["00:30", "Round 2 — Name That Tune", "Soundtracks of the season, team guesses."],
        ["00:45", "Round 3 — Meme battle", "The room picks the winning captions."],
        ["01:00", "Costume highlights & awards", "Voluntary showcase and a warm close."],
      ],
    },
    faqs: [
      {
        q: "Is Halloween team building appropriate for every workplace?",
        a: "Yes. Teamtastic hosts run Halloween events as playful, G-rated programming. If your team prefers to skip Halloween framing entirely, the same games run as a 'fall festival' event.",
      },
      {
        q: "Are employees required to wear costumes?",
        a: "Never. Costumes are welcome but completely optional, and only people who choose to share a photo or turn on camera are featured. Chat participation counts exactly the same as camera participation.",
      },
      {
        q: "Why is a hosted Halloween event better than a DIY office game?",
        a: "A hosted show keeps energy, scoring, and pace moving so leaders can join the fun. DIY virtual offices often devolve into silence or side-conversations; structured rounds hold everyone's attention.",
      },
      {
        q: "Can you make custom Halloween trivia for our company?",
        a: "Yes. Custom company trivia and personalization are included on hosted packages — we mix October themes with your team's own stories, projects, and inside jokes.",
      },
      {
        q: "How many people can a Halloween event handle?",
        a: "Events run from 15 to 500+ participants. For larger groups we use team captains and chat rounds so every region or department stays involved.",
      },
    ],
    relatedArticles: [
      "virtual-holiday-party-games",
      "zoom-team-building-games",
      "virtual-icebreaker-games",
      "corporate-game-show-ideas-for-work",
    ],
    relatedThemes: ["fall-team-building", "holiday-team-building"],
    hero: {
      gradient: "radial-gradient(ellipse at top, rgba(168,85,247,0.25), rgba(3,7,18,0.98) 60%, #030712 100%)",
      accent: "#a855f7",
      icon: "Ghost",
      badgeClass: "border-purple-400/30 bg-purple-400/10 text-purple-200",
    },
    form: {
      source: "theme_halloween",
      entryPoint: "theme_halloween_inline",
      eyebrow: "October availability",
      title: "Get October event dates & pricing",
      subtitle: "$35 per person · $350 minimum · $200 reserves your date",
      submitLabel: "Check October availability",
      depositLabel: "Reserve with $200 deposit",
      defaultOccasion: "social-hour",
      defaultTeamSize: "",
      holidayQualification: false,
    },
    seo: {
      lastModified: "2026-08-29",
      changeFrequency: "weekly",
      priority: 0.9,
    },
  },

  {
    slug: "holiday-team-building",
    category: "seasons",
    name: "Holiday Team Building",
    eyebrow: "Winter · November–January",
    title: "Holiday Team Building Activities for Remote & Hybrid Teams",
    metaTitle: "Holiday Team Building Activities for Remote Teams | Teamtastic",
    metaDescription:
      "Inclusive holiday team building with live hosts: year-in-review awards, holiday trivia, music rounds, and survey games for remote and hybrid teams.",
    intro:
      "Holiday team building is a structured, live-hosted event that celebrates the year-end season with warm, inclusive focus — holiday trivia, year-in-review awards, music rounds, and survey games. Unlike a free-form happy hour, a hosted game show keeps content respectful of every holiday, belief, and background while still feeling festive. Teamtastic couples these events with dedicated holiday party formats for teams planning a bigger December celebration.",
    summary: [
      "Inclusive festive content: year-in-review and gratitude framing that works across beliefs",
      "Year-end awards and superlatives that close the year on a positive note",
      "Pairs with our full holiday party formats, large-group shows, and family game nights",
      "Custom company trivia and December-focused music rounds on every hosted package",
    ],
    benefits: [
      "A structured alternative to free-form holiday happy hours that everyone attends",
      "Year-in-review games that celebrate team wins without an awkward slide deck",
      "Live-hosted by a professional MC so leaders can relax and enjoy the room",
      "Clears December dates early — high-demand season books out in advance",
    ],
    topGames: [
      {
        slug: "trivia",
        pitch: "Holiday and winter-season trivia covering traditions, film classics, and December pop culture — always framed inclusively.",
      },
      {
        slug: "survey-showdown",
        pitch: "Team-wide holiday survey rounds: favorite winter traditions, best year-end snack, most-watched holiday movie.",
      },
      {
        slug: "name-that-tune",
        pitch: "Music rounds built around familiar holiday and winter songs that teams genuinely know.",
      },
      {
        slug: "awards-night",
        pitch: "A custom year-in-review awards segment that turns company milestones into golden moments.",
      },
      {
        slug: "superlatives",
        pitch: "Good-natured year-end superlatives — 'most likely to overcommit in Q1' — voted on by the team.",
      },
      {
        slug: "finish-the-lyric",
        pitch: "A playful lyric-finish round on holiday and winter songs, friendly for every camera setting.",
      },
      {
        slug: "memory-lane",
        pitch: "A warm look back at the team's year with photos, polls, and shared highlights.",
      },
    ],
    details: [
      [
        "Inclusive by design",
        "Rounds use a holiday-neutral, year-end framing — gratitude, winter warmth, and recognition — so teams of every belief and background feel included.",
      ],
      [
        "Pairs with a full holiday party",
        "Run a quick team-building session before a bigger party, or let us plan the whole December event. We offer dedicated virtual holiday party formats.",
      ],
      [
        "Year-in-review customization",
        "Send us your team's wins, moments, and memes from the last twelve months and we turn them into awards, trivia, and memory rounds.",
      ],
      [
        "Large-team tooling",
        "For 100–500+ teammates we add team captains, chat rounds, and regional pods so the whole company stays in the room.",
      ],
    ],
    agenda: {
      label: "A 75-minute year-end celebration",
      items: [
        ["00:00", "Welcome & warm-up", "Host sets an inclusive, celebratory tone."],
        ["00:10", "Round 1 — Holiday survey", "The room's favorites, revealed live."],
        ["00:25", "Round 2 — Custom year trivia", "December classics and your company."],
        ["00:40", "Round 3 — Name That Tune", "Songs of the season, guessed as teams."],
        ["00:55", "Year-in-review awards", "Milestones and superlatives the team votes on."],
        ["01:15", "Wrap & toast", "A warm close to the company year."],
      ],
    },
    faqs: [
      {
        q: "What is holiday team building?",
        a: "Holiday team building is a hosted remote or hybrid event that celebrates the year-end season with warm, inclusive programming — holiday trivia, survey rounds, music games, and year-in-review awards — instead of a free-form happy hour.",
      },
      {
        q: "How is this different from a virtual holiday party?",
        a: "A holiday party is usually the main social event and comes in dedicated formats. Holiday team building is the structured games-and-recognition side, which many teams run first — or we pair the two into one complete celebration.",
      },
      {
        q: "Do you accommodate every holiday and belief?",
        a: "Yes. Our default framing centers winter warmth, gratitude, and year-end recognition rather than any single religious holiday. Teams doing a Christmas-specific party can customize content within our inclusive baseline.",
      },
      {
        q: "How many people can attend?",
        a: "From a 15-person team to 500+ person company events. Large groups use team captains and chat rounds so every office and region stays involved.",
      },
      {
        q: "How early should we book a December event?",
        a: "Early. December prime-time dates are limited and fill up weeks ahead. Checking availability early in the fall protects your team's preferred date.",
      },
    ],
    relatedArticles: [
      "holiday-team-building-activities-for-remote-teams",
      "how-to-plan-a-remote-office-holiday-party",
      "virtual-holiday-party-ideas-for-large-teams",
      "virtual-christmas-party-ideas-for-work",
    ],
    featuredPages: [
      { href: "/virtual-holiday-party", label: "Virtual Holiday Party formats" },
      { href: "/virtual-year-end-team-celebration", label: "Year-End Team Celebration" },
      { href: "/virtual-holiday-party-for-large-groups", label: "Large-Group Holiday Events" },
      { href: "/virtual-family-game-night", label: "Family Game Night" },
    ],
    relatedThemes: ["fall-team-building", "halloween"],
    hero: {
      gradient: "radial-gradient(ellipse at top, rgba(56,189,248,0.22), rgba(3,7,18,0.98) 60%, #030712 100%)",
      accent: "#38bdf8",
      icon: "Snowflake",
      badgeClass: "border-sky-400/30 bg-sky-400/10 text-sky-200",
    },
    form: {
      source: "theme_holiday_team_building",
      entryPoint: "theme_holiday_team_building_inline",
      eyebrow: "Holiday availability",
      title: "Check holiday dates and pricing",
      subtitle: "$35 per person · $350 minimum · $200 reserves your date",
      submitLabel: "Check dates and pricing",
      depositLabel: "Reserve with $200 deposit",
      defaultOccasion: "holiday",
      defaultTeamSize: "",
      holidayQualification: true,
    },
    seo: {
      lastModified: "2026-08-29",
      changeFrequency: "weekly",
      priority: 0.9,
    },
  },

  {
    slug: "black-history-month",
    category: "heritage",
    name: "Black History Month Team Building",
    eyebrow: "Heritage · Every February",
    title: "Black History Month Team Building: Respectful Programs That Honor Heritage",
    metaTitle: "Black History Month Team Building for Workplaces | Teamtastic",
    metaDescription:
      "Respectful, co-created Black History Month programs for remote teams: custom heritage trivia, music, recognition, and joyful connection with trained hosts.",
    intro:
      "Black History Month team building is a workplace program that honors Black history, culture, and contributions through respectful, joyful connection — not a lecture or a forced check-in. The best programs are co-created with your team, center Black employees' voices, and pair optional custom trivia and music rounds with space for recognition and stories. Teamtastic hosts these 60–90 minute events with culturally-competent facilitators.",
    summary: [
      "Co-created content: trivia, music, and recognition rounds shaped together with your team's input",
      "Opt-in by design — no one is put on the spot, and chat participation counts equally",
      "Celebratory and educational without performing anyone else's story",
      "Culturally-competent live hosting over Zoom, Teams, or your own platform",
    ],
    benefits: [
      "Structured recognition that lands better than a wellness-hour lecture",
      "Space for joy, connection, and team-wide education in one 60–90 minute window",
      "Facilitators trained to keep tone respectful, inclusive, and warm",
      "A foundation that supports year-round inclusion programming, not just February",
    ],
    topGames: [
      {
        slug: "trivia",
        pitch: "Co-created heritage and culture trivia — questions your team helps shape so content is accurate, warm, and relevant.",
      },
      {
        slug: "name-that-tune",
        pitch: "Music rounds spanning genres and eras of Black excellence, chosen in collaboration with your team.",
      },
      {
        slug: "awards-night",
        pitch: "A recognition segment that lifts up colleagues' contributions — framed so anyone can receive or share it.",
      },
      {
        slug: "the-spotlight",
        pitch: "Opt-in sharing and reflection rounds for team members who want to volunteer stories, wins, or memories.",
      },
      {
        slug: "memory-lane",
        pitch: "A warm, team-built trip through shared moments that closes the program on a connected note.",
      },
      {
        slug: "superlatives",
        pitch: "Playful team-vote superlatives that keep energy high between the more reflective rounds.",
      },
    ],
    details: [
      [
        "Co-creation is the standard",
        "We plan content with your team and, where helpful, an employee resource group or advisor. Questions, music, and framing are approved before the event so nothing is presumed.",
      ],
      [
        "Opt-in and safe",
        "No one is called on, spotlighted, or asked to represent their identity. Camera-off, chat-only participation earns equal scores and equal celebration.",
      ],
      [
        "Recognition, not performance",
        "Awards and spotlight rounds recognize colleagues' contributions and invite voluntary sharing — honoring heritage without putting anyone on display.",
      ],
      [
        "Year-round support",
        "Heritage months are not the only time moments like this matter. We coach teams on formats that work all year and are happy to plan follow-on programming.",
      ],
    ],
    agenda: {
      label: "A 75-minute respectful celebration",
      items: [
        ["00:00", "Purpose & welcome", "Host frames the program's intent in collaboration with your team."],
        ["00:10", "Round 1 — Co-created trivia", "Heritage and culture content your team shaped."],
        ["00:30", "Round 2 — Music round", "Eras and genres of Black excellence."],
        ["00:45", "Round 3 — Opt-in spotlight", "Voluntary stories, wins, and reflections."],
        ["01:05", "Recognition & close", "Gratitude, connection, and what's next."],
      ],
    },
    faqs: [
      {
        q: "What makes a respectful Black History Month event at work?",
        a: "Respect starts with co-creation: planning content with your team and, where possible, an employee resource group or advisor so nothing is presumed. It also means opt-in participation, avoiding stereotypes and diversity-token framing, and treating February as one node in year-round inclusion — not a single spotlight week.",
      },
      {
        q: "Can you create custom trivia about Black history and culture?",
        a: "Yes. Custom company trivia and content are included on hosted packages. For heritage programming we co-create questions, music, and framing with your team so the content is accurate, celebratory, and relevant, and we confirm it before the event.",
      },
      {
        q: "Who hosts the event?",
        a: "A professional Teamtastic MC trained in culturally-competent, inclusive facilitation. They read the room, keep the tone warm, and work from your approved agenda — never from off-the-cuff assumptions.",
      },
      {
        q: "Is this appropriate for a team that isn't majority Black?",
        a: "Yes. Focused on education and shared celebration, these events help any team appreciate heritage and recognize colleagues. The key is co-creation, authentic content, and treating it as one part of ongoing inclusion rather than a one-off.",
      },
      {
        q: "How many people can attend?",
        a: "Events run from 15 to 500+ participants. Larger groups use team captains and chat rounds so every region and office stays connected.",
      },
    ],
    relatedArticles: [
      "employee-engagement-activities-remote-teams",
      "remote-team-engagement-tips",
      "virtual-icebreaker-games",
    ],
    relatedThemes: ["holiday-team-building", "fall-team-building"],
    hero: {
      gradient: "radial-gradient(ellipse at top, rgba(225,29,72,0.24), rgba(3,7,18,0.98) 60%, #030712 100%)",
      accent: "#e11d48",
      icon: "HeartHandshake",
      badgeClass: "border-rose-400/30 bg-rose-400/10 text-rose-200",
    },
    form: {
      source: "theme_black_history_month",
      entryPoint: "theme_black_history_month_inline",
      eyebrow: "Heritage programming",
      title: "Plan a respectful, co-created program",
      subtitle: "$35 per person · $350 minimum · $200 reserves your date",
      submitLabel: "Plan my program",
      depositLabel: "Reserve with $200 deposit",
      defaultOccasion: "social-hour",
      defaultTeamSize: "",
      holidayQualification: false,
    },
    seo: {
      lastModified: "2026-08-29",
      changeFrequency: "weekly",
      priority: 0.9,
    },
  },
];

export function themeBySlug(slug) {
  return THEMES.find((theme) => theme.slug === slug) || null;
}

export function themesByCategory(category) {
  return THEMES.filter((theme) => theme.category === category);
}

export function relatedPostSlugs(theme) {
  return (theme.relatedArticles || [])
    .map((slug) => ({ slug, post: POSTS.find((p) => p.slug === slug) || null }))
    .filter(({ post }) => Boolean(post));
}