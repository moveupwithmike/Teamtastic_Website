"use client";

import { CalendarDays } from "lucide-react";
import { track } from "@/lib/analytics";

export default function FamilyDateCheckLink({ occasion, source }) {
  return (
    <a
      href="#availability"
      onClick={() => track("family_date_check_clicked", { occasion, source })}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#D81B60] px-6 font-bold text-white shadow-lg shadow-pink-600/20 hover:bg-pink-700"
    >
      Check your date <CalendarDays className="h-5 w-5" />
    </a>
  );
}
