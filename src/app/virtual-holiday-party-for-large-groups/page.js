import HolidayConversionPage from "@/components/HolidayConversionPage";

export const revalidate = 3600;

export const metadata = {
  title: "Virtual Holiday Party for Large Groups | 75–300+ Employees | Teamtastic",
  description: "Host a virtual corporate holiday party for 75–300+ employees with team scoring, live production, custom content, and reliable large-group facilitation.",
  alternates: { canonical: "https://teamtastic.events/virtual-holiday-party-for-large-groups" },
  openGraph: {
    title: "Large Virtual Corporate Holiday Events That Stay Interactive",
    description: "A live-hosted holiday game show designed for 75–300+ employees, with team scoring and production support.",
    url: "https://teamtastic.events/virtual-holiday-party-for-large-groups",
  },
};

const faq = [
  { q: "How do 300 people participate without chaos?", a: "We use one main room, clear team assignments, captains, chat participation, short rounds, visible scoring, and a professional host who keeps everyone oriented." },
  { q: "Do we need breakout rooms?", a: "Not necessarily. Most large events work more smoothly in one main room. Breakouts are available when the program and facilitation plan genuinely benefit from them." },
  { q: "Can Teamtastic support procurement?", a: "Yes. We can provide a written proposal, defined scope, package pricing, payment schedule, platform details, and a primary event contact." },
  { q: "Can the event be customized for multiple departments or regions?", a: "Yes. Teams can represent departments, locations, or functions, with custom questions and recognition moments for each group." },
];

export default function LargeGroupHolidayParty() {
  return <HolidayConversionPage
    eyebrow="Large corporate holiday events"
    headline="A Virtual Holiday Show Built for 75–300+ Employees"
    description="Give the whole company a clear way to participate. Teamtastic combines main-room production, live facilitation, team scoring, custom content, and recognition moments in one reliable large-group experience."
    source="large_holiday_event_page"
    entryPoint="large_holiday_event_inline"
    formTitle="Plan your large holiday event"
    defaultTeamSize="150+"
    benefits={["Main-room format minimizes breakout friction", "Team captains and chat keep everyone involved", "Visible scoring across departments or regions", "Proposal and production plan for stakeholder approval"]}
    agenda={[["0–8 min", "Produced welcome + rules", "Orient the entire room quickly, assign teams, and explain participation."], ["8–25 min", "Company trivia + surveys", "Use accessible rounds that work through captains and chat."], ["25–45 min", "Department challenge", "Run fast team rounds with clear score updates and recognition."], ["45–60 min", "Finale + company celebration", "Close with awards, winner reveals, and a coordinated group moment."]]}
    detailsTitle="The production details large events need"
    details={[["Participation structure", "Teams, captains, chat, polls, and shared answers keep the experience interactive without asking hundreds of people to speak."], ["Reliability plan", "We confirm the video platform, host permissions, joining flow, player link, run of show, and organizer contact in advance."], ["Customization", "Add company branding, milestone questions, department matchups, leadership moments, and custom awards."], ["Procurement readiness", "Receive a defined scope, package recommendation, pricing, deposit schedule, and implementation timeline for internal approval."]]}
    faq={faq}
  />;
}
