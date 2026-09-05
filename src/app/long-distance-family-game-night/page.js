import FamilyOccasionPage from "@/components/FamilyOccasionPage";
import { familyOccasion } from "@/lib/family-demand";

export default function LongDistanceFamilyGameNightPage() {
  return <FamilyOccasionPage occasion={familyOccasion("distance")} />;
}
