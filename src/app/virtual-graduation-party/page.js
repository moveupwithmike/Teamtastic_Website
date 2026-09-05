import FamilyOccasionPage from "@/components/FamilyOccasionPage";
import { familyOccasion } from "@/lib/family-demand";

export default function VirtualGraduationPartyPage() {
  return <FamilyOccasionPage occasion={familyOccasion("graduation")} />;
}
