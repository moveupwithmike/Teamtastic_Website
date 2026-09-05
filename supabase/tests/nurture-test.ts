import {
  buildFamilyNurtureEmail,
  buildNurtureEmail,
  nextFamilyNurtureStep,
  nextNurtureStep,
} from "../functions/_shared/nurture.ts";

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

Deno.test("nurture steps remain ordered and do not skip prerequisites", () => {
  assert(nextNurtureStep(23, new Set()) === null, "nothing should be due before day one");
  assert(nextNurtureStep(80, new Set())?.type === "nurture_day1", "day one must be sent first");
  assert(nextNurtureStep(80, new Set(["nurture_day1"]))?.type === "nurture_day3", "day three should follow day one");
  assert(nextNurtureStep(200, new Set(["nurture_day1", "nurture_day3"]))?.type === "nurture_day7", "day seven should be last");
});

Deno.test("nurture email uses canonical recommendation data and escapes names", () => {
  const email = buildNurtureEmail("nurture_day1", {
    name: "<Buyer>", email: "buyer@example.com", submission_id: "lead-1", recommendation_key: "social",
  }, "https://pay.example.com/deposit");
  assert(email.subject.includes("Superlatives + The Hot Seat"), "expected canonical social recommendation");
  assert(email.html.includes("&lt;Buyer&gt;"), "expected escaped lead name");
  assert(email.html.includes("prefilled_email=buyer%40example.com"), "expected prefilled deposit URL");
});

Deno.test("family nurture uses its own timing, copy, and reservation amount", () => {
  assert(nextFamilyNurtureStep(47, new Set()) === null, "family nurture should wait until day two");
  assert(nextFamilyNurtureStep(130, new Set())?.type === "family_nurture_day2", "family day two must be first");
  assert(nextFamilyNurtureStep(130, new Set(["family_nurture_day2"]))?.type === "family_nurture_day5", "family day five should follow");
  const email = buildFamilyNurtureEmail("family_nurture_day2", {
    name: "<Jordan>",
    email: "family@example.com",
    submission_id: "family-1",
    group_name: "Rivera Family",
    occasion: "reunion",
  }, "https://pay.example.com/family");
  assert(email.subject.includes("Rivera Family"), "expected the optional group name");
  assert(email.html.includes("&lt;Jordan&gt;"), "expected escaped lead name");
  assert(email.html.includes("$100 deposit"), "expected the family reservation amount");
});
