// Offline certification harness. Runs the ACTUAL production-baseline snapshot (Mode A)
// and the ACTUAL current repo classifier (Mode B, imported directly from
// supabase/functions/_shared/gmail-classification.ts — not a reimplementation) against
// the human-gold-labeled corpus, and reports per-intent precision/recall, confusion
// pairs, and hot-lead safety. Mode C (LLM fallback) is analyzed separately in the
// certification report itself: no ANTHROPIC_API_KEY exists in this environment, so
// Mode C's classification quality is assessed by manually applying the exact
// LLM_SYSTEM_PROMPT/LLM_TOOL_SCHEMA the deployed code would send, not by a metered API
// call — see the report's "Mode C" section for that reasoning and its results, and
// gmail-classification-llm-failure-modes-test.ts for the mocked-fetch behavioral proof
// of the LLM call path itself (timeouts, malformed output, provider errors, etc).
//
// Run: deno run --no-check --allow-env supabase/tests/certification/run-certification.ts

import { CORPUS, HOT_INTENT_STRESS_CASES, type CorpusCase } from "./corpus.ts";
import { productionClassify } from "./production-baseline-classifier-snapshot.ts";
import { classifyFuzzyRegex, classifyHardStop } from "../../functions/_shared/gmail-classification.ts";
import { HOT_MIN_CONFIDENCE, HOT_INTENTS } from "../../../src/lib/server/office/hot-lead.js";

type Classification = { classification: string; confidence: number; reason: string; method: string };

function enhancedClassify(subject: string, body: string): Classification {
  const text = `${subject}\n${body}`.toLowerCase();
  return classifyHardStop(text) ?? classifyFuzzyRegex(text, body);
}

// Production's 5-label taxonomy cannot express pricing_request/booking_request/
// objection/not_now at all. To score it fairly (not just "always wrong" on labels it
// structurally cannot produce), each gold label is mapped to the closest production
// label it WOULD be trained/expected to fall back to per its own taxonomy, purely for
// the precision/recall table's "close enough" column. The exact-match table (the
// primary metric) always compares against the true 9-label gold, unmapped.
const PRODUCTION_TAXONOMY_CEILING: Record<string, string> = {
  interested: "interested",
  pricing_request: "interested", // closest production has: "send me details/pricing" matches its "interested" regex
  booking_request: "interested", // "book a call/demo" is explicitly in production's own interested regex
  objection: "unknown",
  not_now: "unknown",
  not_interested: "not_interested",
  referral: "referral",
  question: "question",
  unknown: "unknown",
  unsubscribe: "unsubscribe",
  legal: "legal",
  complaint: "complaint",
  out_of_office: "out_of_office",
};

type Mode = "A" | "B";

function runMode(mode: Mode, cases: CorpusCase[]) {
  const results = cases.map((c) => {
    const output = mode === "A" ? productionClassify(c.subject, c.body) : enhancedClassify(c.subject, c.body);
    const exactMatch = output.classification === c.primary || output.classification === c.secondary;
    const ceilingMatch = mode === "A"
      ? output.classification === (PRODUCTION_TAXONOMY_CEILING[c.primary] ?? c.primary)
      : exactMatch;
    return { case: c, output, exactMatch, ceilingMatch };
  });
  return results;
}

function precisionRecall(results: ReturnType<typeof runMode>, useCeiling: boolean) {
  const labels = new Set<string>();
  for (const r of results) {
    labels.add(r.case.primary);
    labels.add(r.output.classification);
  }
  const table: Record<string, { tp: number; fp: number; fn: number }> = {};
  for (const label of labels) table[label] = { tp: 0, fp: 0, fn: 0 };

  const confusion: Record<string, number> = {};
  for (const r of results) {
    const gold = r.case.primary;
    const predicted = r.output.classification;
    const match = useCeiling ? r.ceilingMatch : r.exactMatch;
    if (match) {
      table[gold].tp++;
    } else {
      table[gold].fn++;
      table[predicted].fp++;
      const key = `${gold} -> ${predicted}`;
      confusion[key] = (confusion[key] || 0) + 1;
    }
  }
  const rows = Object.entries(table).map(([label, { tp, fp, fn }]) => {
    const precision = tp + fp === 0 ? null : tp / (tp + fp);
    const recall = tp + fn === 0 ? null : tp / (tp + fn);
    return { label, tp, fp, fn, precision, recall };
  }).sort((a, b) => a.label.localeCompare(b.label));
  const confusionSorted = Object.entries(confusion).sort((a, b) => b[1] - a[1]);
  return { rows, confusionSorted };
}

function hotLeadSafety(results: ReturnType<typeof runMode>) {
  const falsePositives: { id: string; body: string; gold: string; predicted: string; confidence: number }[] = [];
  const trueHot: { id: string; body: string; gold: string; predicted: string; confidence: number }[] = [];
  for (const r of results) {
    const isHot = HOT_INTENTS.includes(r.output.classification) && r.output.confidence >= HOT_MIN_CONFIDENCE;
    if (!isHot) continue;
    const goldIsHotWorthy = HOT_INTENTS.includes(r.case.primary) || r.case.secondary && HOT_INTENTS.includes(r.case.secondary);
    const entry = { id: r.case.id, body: r.case.body, gold: r.case.primary, predicted: r.output.classification, confidence: r.output.confidence };
    if (goldIsHotWorthy) trueHot.push(entry); else falsePositives.push(entry);
  }
  return { falsePositives, trueHot };
}

function main() {
  const all = [...CORPUS, ...HOT_INTENT_STRESS_CASES];
  console.log(`\n=== CORPUS SIZE: ${all.length} (${CORPUS.length} main + ${HOT_INTENT_STRESS_CASES.length} hot-lead stress cases) ===\n`);

  for (const mode of ["A", "B"] as Mode[]) {
    const results = runMode(mode, all);
    const exactAccuracy = results.filter((r) => r.exactMatch).length / results.length;
    const ceilingAccuracy = results.filter((r) => r.ceilingMatch).length / results.length;
    console.log(`\n----- MODE ${mode} -----`);
    console.log(`Exact-taxonomy accuracy: ${(exactAccuracy * 100).toFixed(1)}%`);
    if (mode === "A") console.log(`Taxonomy-ceiling accuracy (best production's 5 labels could ever do): ${(ceilingAccuracy * 100).toFixed(1)}%`);

    const { rows, confusionSorted } = precisionRecall(results, mode === "A");
    console.log("Per-label precision/recall:");
    for (const row of rows) {
      const p = row.precision === null ? "n/a" : (row.precision * 100).toFixed(0) + "%";
      const r = row.recall === null ? "n/a" : (row.recall * 100).toFixed(0) + "%";
      console.log(`  ${row.label.padEnd(16)} tp=${row.tp} fp=${row.fp} fn=${row.fn}  precision=${p} recall=${r}`);
    }
    console.log("Top confusion pairs (gold -> predicted):");
    for (const [pair, count] of confusionSorted.slice(0, 15)) console.log(`  ${pair}: ${count}`);

    const { falsePositives, trueHot } = hotLeadSafety(results);
    console.log(`Hot-lead treatment: ${trueHot.length} correctly-hot, ${falsePositives.length} FALSE POSITIVE (non-hot-worthy message treated as hot)`);
    for (const fp of falsePositives) console.log(`  FALSE HOT: [${fp.id}] "${fp.body}" gold=${fp.gold} predicted=${fp.predicted}@${fp.confidence}`);
  }

  console.log("\n=== FULL PER-CASE OUTPUT (Mode A / Mode B) ===");
  const resultsA = runMode("A", all);
  const resultsB = runMode("B", all);
  for (let i = 0; i < all.length; i++) {
    const c = all[i];
    const a = resultsA[i].output;
    const b = resultsB[i].output;
    console.log(JSON.stringify({
      id: c.id, category: c.category, body: c.body, gold: c.primary, goldSecondary: c.secondary ?? null,
      modeA: { label: a.classification, confidence: a.confidence, match: resultsA[i].exactMatch },
      modeB: { label: b.classification, confidence: b.confidence, match: resultsB[i].exactMatch },
    }));
  }
}

main();
