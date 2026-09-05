import FamilyOccasionPage from "@/components/FamilyOccasionPage";
import { familyOccasion } from "@/lib/family-demand";

export default function VirtualAnniversaryPartyPage() {
  return <FamilyOccasionPage occasion={familyOccasion("anniversary")} />;
}
