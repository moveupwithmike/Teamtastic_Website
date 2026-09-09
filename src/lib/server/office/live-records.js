export function createLiveRecordFilter({ classifications = [], reportingSince = null, ready = true } = {}) {
  const reportingSinceMs = reportingSince ? Date.parse(reportingSince) : 0;
  const index = new Map(classifications.map((row) => [`${row.record_type}:${row.record_id}`, row]));

  function isAfterBaseline(value) {
    if (!reportingSinceMs) return true;
    const timestamp = Date.parse(value || "");
    return Number.isFinite(timestamp) && timestamp >= reportingSinceMs;
  }

  function isProductionId(recordType, recordId) {
    if (!ready || !recordId) return false;
    return index.get(`${recordType}:${recordId}`)?.classification === "production";
  }

  function wasPromotedAfterBaseline(recordType, recordId) {
    if (!reportingSinceMs) return false;
    const timestamp = Date.parse(index.get(`${recordType}:${recordId}`)?.classified_at || "");
    return Number.isFinite(timestamp) && timestamp >= reportingSinceMs;
  }

  function isLiveId(recordType, recordId, createdAt) {
    return isProductionId(recordType, recordId)
      && (isAfterBaseline(createdAt) || wasPromotedAfterBaseline(recordType, recordId));
  }

  function isLiveRecord(recordType, row) {
    return Boolean(row?.id) && isLiveId(recordType, row.id, row.created_at);
  }

  return { ready, reportingSince, isAfterBaseline, isProductionId, isLiveId, isLiveRecord };
}

export async function loadLiveRecordFilter(db, recordTypes) {
  const [configResult, classificationsResult] = await Promise.all([
    db.from("system_config").select("sales_reporting_since").eq("id", true).maybeSingle(),
    db.from("production_record_classification_status")
      .select("record_type,record_id,classification,classified_at")
      .in("record_type", recordTypes)
      .limit(5000),
  ]);
  const ready = !configResult.error && !classificationsResult.error;
  return createLiveRecordFilter({
    classifications: classificationsResult.data || [],
    reportingSince: configResult.data?.sales_reporting_since || null,
    ready,
  });
}
