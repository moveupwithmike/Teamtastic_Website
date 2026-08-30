// Remediation verification harness: runs the NEW boundary corpus (booking vs not_now)
// and the unsubscribe guard corpus (required phrases + benign look-alikes) against the
// actual, currently-remediated classifier code. Separate from run-certification.ts,
// which re-runs the original frozen 129-message corpus untouched.
//
// Run: deno run --no-check --allow-env supabase/tests/certification/run-remediation-verification.ts

import { BOUNDARY_CORPUS, UNSUBSCRIBE_GUARD_CORPUS } from "./boundary-corpus.ts";
import { productionClassify } from "./production-baseline-classifier-snapshot.ts";
import { classifyFuzzyRegex, classifyHardStop } from "../../functions/_shared/gmail-classification.ts";

function enhancedClassify(subject: string, body: string) {
  const text = `${subject}\n${body}`.toLowerCase();
  return classifyHardStop(text) ?? classifyFuzzyRegex(text, body);
}

console.log("\n=== BOUNDARY CORPUS (booking_request vs not_now vs question vs interested vs ambiguous) ===");
console.log(`Size: ${BOUNDARY_CORPUS.length}\n`);

for (const mode of ["A", "B"] as const) {
  let correct = 0;
  const misses: string[] = [];
  const hotFalsePositives: string[] = [];
  for (const c of BOUNDARY_CORPUS) {
    const output = mode === "A" ? productionClassify(c.subject, c.body) : enhancedClassify(c.subject, c.body);
    const match = output.classification === c.primary || output.classification === c.secondary;
    if (match) correct++;
    else misses.push(`  [${c.id}] "${c.body}" gold=${c.primary}${c.secondary ? "/" + c.secondary : ""} predicted=${output.classification}@${output.confidence}`);
    const isHot = ["interested", "pricing_request", "booking_request"].includes(output.classification) && output.confidence >= 0.75;
    const goldIsHotWorthy = ["interested", "pricing_request", "booking_request"].includes(c.primary) || (c.secondary && ["interested", "pricing_request", "booking_request"].includes(c.secondary));
    if (isHot && !goldIsHotWorthy) hotFalsePositives.push(`  FALSE HOT [${c.id}] "${c.body}" gold=${c.primary} predicted=${output.classification}@${output.confidence}`);
  }
  console.log(`--- MODE ${mode} --- accuracy: ${correct}/${BOUNDARY_CORPUS.length} (${((correct / BOUNDARY_CORPUS.length) * 100).toFixed(1)}%)`);
  console.log("Misses:");
  console.log(misses.length ? misses.join("\n") : "  (none)");
  console.log("Hot-lead false positives:");
  console.log(hotFalsePositives.length ? hotFalsePositives.join("\n") : "  (none)");
  console.log("");
}

console.log("\n=== UNSUBSCRIBE GUARD CORPUS ===");
console.log(`Size: ${UNSUBSCRIBE_GUARD_CORPUS.length} (${UNSUBSCRIBE_GUARD_CORPUS.filter((c) => c.mustUnsubscribe).length} required opt-out phrases, ${UNSUBSCRIBE_GUARD_CORPUS.filter((c) => !c.mustUnsubscribe).length} benign look-alikes)\n`);

for (const mode of ["A", "B"] as const) {
  let falseNegatives = 0;
  let falsePositives = 0;
  const details: string[] = [];
  for (const c of UNSUBSCRIBE_GUARD_CORPUS) {
    const output = mode === "A" ? productionClassify("Re: outreach", c.body) : enhancedClassify("Re: outreach", c.body);
    const isUnsubscribe = output.classification === "unsubscribe";
    if (c.mustUnsubscribe && !isUnsubscribe) {
      falseNegatives++;
      details.push(`  UNSAFE MISS [${c.id}] "${c.body}" -> ${output.classification} (must be unsubscribe)`);
    } else if (!c.mustUnsubscribe && isUnsubscribe) {
      falsePositives++;
      details.push(`  FALSE TRIGGER [${c.id}] "${c.body}" -> unsubscribe (should be: ${c.expectedIfNot})`);
    } else {
      details.push(`  ok [${c.id}] "${c.body}" -> ${output.classification}`);
    }
  }
  console.log(`--- MODE ${mode} --- unsubscribe false negatives: ${falseNegatives}, false positives: ${falsePositives}`);
  console.log(details.join("\n"));
  console.log("");
}
