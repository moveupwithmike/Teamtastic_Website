import { notFound } from "next/navigation";
import ThemePage from "@/components/ThemePage";
import { THEMES, themeBySlug } from "@/lib/themes";

export function generateStaticParams() {
  return THEMES.map((theme) => ({ slug: theme.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const theme = themeBySlug(slug);
  if (!theme) return {};

  const canonical = `https://teamtastic.events/themes/${theme.slug}`;

  return {
    title: theme.metaTitle,
    description: theme.metaDescription,
    alternates: { canonical },
    openGraph: {
      title: theme.metaTitle,
      description: theme.metaDescription,
      url: canonical,
      images: [{ url: "/teamtastic-og.png", width: 1200, height: 630, alt: `${theme.name} by Teamtastic` }],
    },
    twitter: {
      card: "summary_large_image",
      title: theme.metaTitle,
      description: theme.metaDescription,
      images: ["/teamtastic-og.png"],
    },
  };
}

export default async function ThemeSlugPage({ params }) {
  const { slug } = await params;
  const theme = themeBySlug(slug);

  if (!theme) {
    notFound();
  }

  return <ThemePage theme={theme} />;
}