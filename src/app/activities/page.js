import { redirect } from "next/navigation";

// /activities is an alias for /games. Redirect permanently to avoid
// duplicate content and ensure crawlers index only the canonical URL.
export default function ActivitiesPage() {
  redirect("/games");
}
