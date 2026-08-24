import { assert, assertEquals, assertStrictEquals } from "jsr:@std/assert@1";
import { provenanceBlocksDelivery } from "../functions/_shared/lead-notifications.ts";

// Canonical classification semantics for notification delivery.
Deno.test("production classification allows delivery", () => {
  assertStrictEquals(provenanceBlocksDelivery("production"), false);
});

Deno.test("absent classification defaults to production delivery", () => {
  assertStrictEquals(provenanceBlocksDelivery(null), false);
  assertStrictEquals(provenanceBlocksDelivery(undefined), false);
});

Deno.test("test_qa classification suppresses delivery", () => {
  assertStrictEquals(provenanceBlocksDelivery("test_qa"), true);
});

Deno.test("certification classification suppresses delivery", () => {
  assertStrictEquals(provenanceBlocksDelivery("certification"), true);
});

Deno.test("unresolved classification fails closed", () => {
  assertStrictEquals(provenanceBlocksDelivery("unresolved"), true);
});

// Provenance spoofing: the predicate accepts ONLY the server-fetched ledger
// status. No caller-controlled payload shape can influence the decision, and
// adversarial values never widen delivery.
Deno.test("caller-supplied provenance flags cannot bypass or force classification", () => {
  const adversarial: unknown[] = [
    { synthetic_test: false },
    { synthetic_test: true },
    { classification: "production", owner_confirmed_production: true },
    "production",
    "PRODUCTION",
    " production ",
    "",
    0,
    1,
    true,
    false,
  ];
  for (const value of adversarial) {
    const decision = provenanceBlocksDelivery(value as string | null | undefined);
    // Only the exact canonical string 'production' (case/space-sensitive by
    // design, since the database CHECK constrains it) may allow delivery.
    // Every other input — including near-misses like "PRODUCTION" or
    // " production " — fails closed.
    assertEquals(decision, value !== "production");
    assert(typeof decision === "boolean");
  }
});

// Database/Edge agreement: mirror of the SQL boundary used by
// automation.record_affects_production_readiness / lead_notifications_blocked.
Deno.test("edge boundary agrees with database classification semantics", () => {
  const cases: Array<[string, boolean]> = [
    ["production", false],
    ["test_qa", true],
    ["certification", true],
    ["unresolved", true],
  ];
  for (const [classification, blocked] of cases) {
    assertEquals(provenanceBlocksDelivery(classification), blocked);
  }
});
