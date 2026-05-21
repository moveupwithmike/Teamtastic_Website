export const metadata = {
  title: "Ultimate Virtual Event Planning Guide & Checklist | Teamtastic",
  description:
    "The ultimate corporate event planning checklist. Plan, coordinate, customize questions, and host a stress-free, high-engagement virtual team social from start to finish.",
  openGraph: {
    title: "Event Planning Guide — Teamtastic Interactive Planner",
    description: "The interactive, step-by-step corporate event planning checklist.",
    url: "https://teamtastic.events/resources/event-planning-guide",
  },
};

export default function EventPlanningLayout({ children }) {
  return (
    <>
      {children}
      {/* Schema.org Article Structured Data for high B2B SEO performance */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "TechArticle",
            "headline": "Ultimate Virtual Event Planning Guide & Interactive Checklist",
            "description": "A comprehensive interactive checklist and blueprint for corporate HR leads and event planners to host high-octane team-building games with zero technical friction.",
            "inLanguage": "en",
            "author": {
              "@type": "Organization",
              "name": "Teamtastic"
            },
            "publisher": {
              "@type": "Organization",
              "name": "Teamtastic",
              "logo": {
                "@type": "ImageObject",
                "url": "https://teamtastic.events/logo-highfive.png"
              }
            }
          }),
        }}
      />
    </>
  );
}
