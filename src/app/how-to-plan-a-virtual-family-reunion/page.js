import FamilyOccasionPage from "@/components/FamilyOccasionPage";
import { familyOccasion } from "@/lib/family-demand";

export default function HowToPlanVirtualFamilyReunionPage() {
  return <FamilyOccasionPage occasion={familyOccasion("reunionGuide")} />;
}
