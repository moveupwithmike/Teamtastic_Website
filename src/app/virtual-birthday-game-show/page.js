import FamilyOccasionPage from "@/components/FamilyOccasionPage";
import { familyOccasion } from "@/lib/family-demand";

export default function VirtualBirthdayGameShowPage() {
  return <FamilyOccasionPage occasion={familyOccasion("birthday")} />;
}
