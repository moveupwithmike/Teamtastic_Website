import HolidayConversionPage from "@/components/HolidayConversionPage";

export const revalidate = 3600;

export const metadata = {
  title: "Virtual Year-End Team Celebration | Inclusive Company Event | Teamtastic",
  description: "Plan an inclusive virtual year-end celebration with company awards, custom year-in-review trivia, team games, and a live professional host.",
  alternates: { canonical: "https://teamtastic.events/virtual-year-end-team-celebration" },
  openGraph: {
    title: "An Inclusive Virtual Year-End Celebration for Global Teams",
    description: "Recognition, year-in-review trivia, team games, and a live host—without centering one holiday tradition.",
    url: "https://teamtastic.events/virtual-year-end-team-celebration",
  },
};

const faq = [
  { q: "Can the event avoid Christmas-specific content?", a: "Yes. We can make the entire experience winter-themed, year-end focused, company-centered, or globally inclusive without religious holiday references." },
  { q: "Can we recognize employees and company milestones?", a: "Yes. We can build awards, team shoutouts, launches, customer wins, and year-in-review moments directly into the show." },
  { q: "Does this work across global time zones?", a: "Yes. Share your team locations and preferred time zone in the request. We will help choose a format and time that works for the widest group." },
  { q: "Can leadership participate without hosting?", a: "Yes. Leaders can welcome the team or present awards while the Teamtastic emcee handles instructions, pacing, games, and scoring." },
];

export default function VirtualYearEndTeamCelebration() {
  return <HolidayConversionPage
    eyebrow="Inclusive year-end celebrations"
    headline="Celebrate the Year Your Whole Global Team Shared"
    description="A live-hosted virtual celebration built around company wins, team recognition, custom year-in-review trivia, and inclusive games—without assuming everyone celebrates the same holiday."
    source="year_end_celebration_page"
    entryPoint="year_end_celebration_inline"
    formTitle="Plan your year-end celebration"
    formOccasion="private-milestone"
    benefits={["Inclusive winter or year-end language", "Custom awards and company milestones", "Works across Zoom, Teams, Meet, and Webex", "Facilitation handled from welcome to final scores"]}
    agenda={[["0–10 min", "Welcome + year in review", "Celebrate key wins, launches, and people who shaped the year."], ["10–35 min", "Custom team game show", "Mix company trivia, surveys, music, and collaborative rounds."], ["35–50 min", "Recognition + awards", "Feature employee shoutouts, team values, and playful awards."], ["50–60 min", "Final challenge + celebration", "Reveal the winners and end with a screenshot-worthy team moment."]]}
    detailsTitle="Inclusive by design, personal to your company"
    details={[["Theme choices", "Choose winter, year-end, company celebration, or a light mix of global traditions."], ["Global participation", "Use team play, chat, captains, and low-pressure rounds so different cultures and communication styles can participate."], ["Company storytelling", "Turn milestones, launches, values, and memorable moments into custom content."], ["Leadership moments", "Build in a concise executive welcome or awards segment without making leaders run the event."]]}
    faq={faq}
  />;
}
