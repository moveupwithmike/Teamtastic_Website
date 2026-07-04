// Server component — exports static metadata for the /games catalog page.
// The interactive catalog itself lives in GamesCatalog (client component).
import GamesCatalog from "@/components/GamesCatalog";

export const metadata = {
  title: "Virtual Team Building Games & Activities | Teamtastic",
  description:
    "Browse 51+ live-hosted virtual team building games: trivia battles, escape rooms, music rounds, collaborative puzzles, and more. Perfect for remote and hybrid teams of 5 to 500+.",
  alternates: { canonical: "https://teamtastic.events/games" },
  openGraph: {
    title: "Virtual Team Building Games & Activities | Teamtastic",
    description:
      "51+ live-hosted virtual games for remote teams. High-energy trivia, escape rooms, music bingo, and collaborative puzzles.",
    url: "https://teamtastic.events/games",
  },
};

export default function GamesPage() {
  return <GamesCatalog />;
}
