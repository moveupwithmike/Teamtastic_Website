import FamilyOccasionPage from "@/components/FamilyOccasionPage";
import { familyOccasion } from "@/lib/family-demand";

export default function VirtualFamilyReunionGameShowPage() {
  return <FamilyOccasionPage occasion={familyOccasion("reunion")} />;
}
