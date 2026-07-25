import { Outfit, Caveat } from "next/font/google";
// @ts-ignore - CSS side-effect import; plain tsc can't type relative CSS imports, Next's own build-time checker already understands them.
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Toaster } from "sonner";
import ConsentBanner from "@/components/ConsentBanner";
import AdPixels from "@/components/AdPixels";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata = {
  title: "Virtual Team Building Activities & Online Games | Teamtastic",
  description: "Live-hosted virtual team building games for remote and hybrid teams, with custom trivia, game shows, and zero downloads. Free to try.",
  metadataBase: new URL("https://teamtastic.events"),
  alternates: {
    canonical: "https://teamtastic.events",
  },
  openGraph: {
    title: "Virtual Team Building Activities & Online Games | Teamtastic",
    description: "Virtual team building that teams actually love. 20+ live interactive games including trivia, escape rooms, and music rounds for remote/hybrid teams.",
    url: "https://teamtastic.events",
    siteName: "Teamtastic Events",
    images: [
      {
        url: "/teamtastic-og.png",
        width: 1200,
        height: 630,
        alt: "Teamtastic live-hosted virtual team building game show",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Virtual Team Building Activities & Online Games | Teamtastic",
    description: "Virtual team building that teams actually love. 20+ live interactive games.",
    images: ["/teamtastic-og.png"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${caveat.variable} h-full antialiased dark`}
      style={{ colorScheme: "dark" }}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100 font-sans selection:bg-purple-500 selection:text-white">
        <ConsentBanner />
        <AdPixels />
        <Toaster richColors position="bottom-right" theme="dark" />
        <Navbar />
        <div className="flex-grow flex flex-col">
          {children}
        </div>
        <Footer />
      </body>
    </html>
  );
}
