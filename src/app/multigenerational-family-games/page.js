import FamilyOccasionPage from "@/components/FamilyOccasionPage";
import { familyOccasion } from "@/lib/family-demand";

export default function MultigenerationalFamilyGamesPage() {
  return <FamilyOccasionPage occasion={familyOccasion("multigenerational")} />;
}
