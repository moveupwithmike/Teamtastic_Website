import { Outfit, Caveat } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

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
  description: "Virtual team building that teams actually love. 20+ live interactive games including trivia, escape rooms, and music rounds for remote/hybrid teams. Free to try.",
  metadataBase: new URL("https://teamtastic.events"),
  openGraph: {
    title: "Virtual Team Building Activities & Online Games | Teamtastic",
    description: "Virtual team building that teams actually love. 20+ live interactive games including trivia, escape rooms, and music rounds for remote/hybrid teams.",
    url: "https://teamtastic.events",
    siteName: "Teamtastic Events",
    images: [
      {
        url: "/teamtastic_website_mockup.png",
        width: 1920,
        height: 1080,
        alt: "Teamtastic Storefront Hero",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Virtual Team Building Activities & Online Games | Teamtastic",
    description: "Virtual team building that teams actually love. 20+ live interactive games.",
    images: ["/teamtastic_website_mockup.png"],
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
        <Navbar />
        <div className="flex-grow flex flex-col">
          {children}
        </div>
        <Footer />
      </body>
    </html>
  );
}
