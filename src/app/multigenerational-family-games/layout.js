import { familyOccasion } from "@/lib/family-demand";

const page = familyOccasion("multigenerational");

export const metadata = {
  title: `${page.title} | Teamtastic`,
  description: page.metaDescription,
  alternates: { canonical: `https://teamtastic.events/${page.slug}` },
  openGraph: { title: page.title, description: page.metaDescription, url: `https://teamtastic.events/${page.slug}`, images: [{ url: page.image, alt: page.imageAlt }] },
};

export default function Layout({ children }) { return children; }
