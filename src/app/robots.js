export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: "https://teamtastic.events/sitemap.xml",
  };
}
