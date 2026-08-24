// Canonical notification-suppression predicate for lead provenance.
//
// The decision input is exclusively the authoritative
// production_record_classification_status value fetched server-side for the
// lead (and its prospect). Caller-controlled request fields can never reach
// this predicate, so provenance cannot be spoofed through payloads.
//
//   'production'            -> deliver normally
//   null / undefined        -> deliver normally (production default)
//   'test_qa'               -> suppress
//   'certification'         -> suppress
//   'unresolved'            -> suppress (fail closed)
//   anything else           -> suppress (fail closed)
export function provenanceBlocksDelivery(classification: string | null | undefined): boolean {
  if (classification === null || classification === undefined) return false;
  return classification !== "production";
}
